"use server";

import { getCustomerOrNull } from "@/lib/auth/dal";
import { CartLookupError, getSellableProducts } from "@/lib/cart/pricing";
import { publicImageUrl } from "@/lib/catalogue/queries";
import { compareAmounts } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";
import type { WishlistItem } from "@/types/domain";
import { idsToMerge, MAX_WISHLIST_ITEMS, sanitizeWishlist } from "./rules";

/**
 * Wishlist Server Actions.
 *
 * - Guests: the wishlist lives in localStorage. Actions only validate (is the
 *   product active?) and return `ids: null`; the browser stores it itself.
 * - Signed-in active customers: the wishlist lives in `wishlist_items` (RLS:
 *   active customers, own rows only; the insert policy also checks the
 *   product is active). Actions read and write it with the customer's session
 *   and return the stored ids, newest first.
 *
 * Nothing the client sends is trusted beyond product ids, and those are
 * re-validated here. Staff and deactivated accounts are treated as guests.
 */

export type WishlistError =
  | "notFound" // inactive, deleted or unknown product
  | "full"
  | "unexpected";

export type WishlistResult =
  { ok: true; ids: string[] | null } | { ok: false; error: WishlistError; ids: string[] | null };

type Supabase = Awaited<ReturnType<typeof createClient>>;

class WishlistLookupError extends Error {
  constructor() {
    super("The wishlist could not be loaded.");
    this.name = "WishlistLookupError";
  }
}

/** Lookup errors are logged where they happen (here, or in the product lookup). */
const alreadyLogged = (error: unknown) =>
  error instanceof WishlistLookupError || error instanceof CartLookupError;

/** The customer's saved product ids (RLS: own rows only), newest first. */
async function readCustomerIds(supabase: Supabase, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(MAX_WISHLIST_ITEMS);
  if (error) {
    console.error("[wishlist] read failed", error.code, error.message);
    throw new WishlistLookupError();
  }
  return data.map((row) => row.product_id);
}

/**
 * Saves products for the customer. A product already saved is left alone
 * (ON CONFLICT DO NOTHING on the unique (user_id, product_id)), so a retry,
 * a second tab or a repeated merge never creates a duplicate.
 */
async function insertIds(
  supabase: Supabase,
  ids: readonly string[],
): Promise<WishlistError | null> {
  if (ids.length === 0) return null;
  const { error } = await supabase.from("wishlist_items").upsert(
    ids.map((id) => ({ product_id: id })),
    { onConflict: "user_id,product_id", ignoreDuplicates: true },
  );
  if (!error) return null;
  // 54000: the database's 100-item cap (another tab filled it meanwhile).
  if (error.code === "54000") return "full";
  console.error("[wishlist] write failed", error.code, error.message);
  return "unexpected";
}

async function guarded(
  run: (customer: { id: string } | null) => Promise<WishlistResult>,
): Promise<WishlistResult> {
  try {
    return await run(await getCustomerOrNull());
  } catch (error) {
    if (!alreadyLogged(error)) console.error("[wishlist] action failed", error);
    return { ok: false, error: "unexpected", ids: null };
  }
}

/** Adds an active product (a product, never a variant: options are chosen later). */
export async function addToWishlist(productId: unknown): Promise<WishlistResult> {
  return guarded(async (customer) => {
    if (!isUuid(productId)) return { ok: false, error: "notFound", ids: null };
    const products = await getSellableProducts([productId]);
    if (!products.has(productId)) return { ok: false, error: "notFound", ids: null };
    if (!customer) return { ok: true, ids: null };

    const supabase = await createClient();
    const ids = await readCustomerIds(supabase, customer.id);
    if (ids.includes(productId)) return { ok: true, ids };
    if (ids.length >= MAX_WISHLIST_ITEMS) return { ok: false, error: "full", ids };
    const error = await insertIds(supabase, [productId]);
    const updated = await readCustomerIds(supabase, customer.id);
    return error ? { ok: false, error, ids: updated } : { ok: true, ids: updated };
  });
}

/** Removes a product (customers; guests change localStorage directly). Any id is accepted. */
export async function removeFromWishlist(productId: unknown): Promise<WishlistResult> {
  return guarded(async (customer) => {
    if (!isUuid(productId)) return { ok: false, error: "notFound", ids: null };
    if (!customer) return { ok: true, ids: null };

    const supabase = await createClient();
    const { error } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("user_id", customer.id)
      .eq("product_id", productId);
    if (error) console.error("[wishlist] delete failed", error.code, error.message);
    const ids = await readCustomerIds(supabase, customer.id);
    return error ? { ok: false, error: "unexpected", ids } : { ok: true, ids };
  });
}

/**
 * Called by the browser on load and after sign-in. For a customer, merges the
 * guest wishlist into `wishlist_items` (products not saved yet and still
 * active; duplicates are skipped, up to the 100-item cap) and returns the
 * stored ids. For a guest, returns `ids: null`.
 */
export async function syncWishlist(guestIds: unknown): Promise<WishlistResult> {
  return guarded(async (customer) => {
    if (!customer) return { ok: true, ids: null };

    const supabase = await createClient();
    const ids = await readCustomerIds(supabase, customer.id);
    const candidates = idsToMerge(ids, sanitizeWishlist(guestIds));
    if (candidates.length === 0) return { ok: true, ids };

    // Inactive or deleted products are skipped (the insert policy would refuse them).
    const active = await getSellableProducts(candidates);
    const error = await insertIds(
      supabase,
      candidates.filter((id) => active.has(id)),
    );
    const merged = await readCustomerIds(supabase, customer.id);
    return error ? { ok: false, error, ids: merged } : { ok: true, ids: merged };
  });
}

export type WishlistView =
  | { ok: true; signedIn: boolean; ids: string[]; items: WishlistItem[]; removed: number }
  | { ok: false };

/**
 * The wishlist page's data, read from the current product rows. For a
 * customer the stored ids are used (the argument is ignored) and products
 * that are no longer sold (inactive) are deleted from the account; for a
 * guest the given ids are read and the caller drops the missing ones.
 * `removed` counts the products dropped this way.
 */
export async function getWishlistView(guestIds: unknown): Promise<WishlistView> {
  try {
    const customer = await getCustomerOrNull();
    const supabase = customer ? await createClient() : null;
    const ids =
      supabase && customer
        ? await readCustomerIds(supabase, customer.id)
        : sanitizeWishlist(guestIds);

    const products = await getSellableProducts(ids);
    const kept = ids.filter((id) => products.has(id));
    const gone = ids.filter((id) => !products.has(id));
    if (supabase && customer && gone.length > 0) {
      const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("user_id", customer.id)
        .in("product_id", gone);
      if (error) console.error("[wishlist] cleanup failed", error.code, error.message);
    }

    const items = kept.map((id): WishlistItem => {
      const { row, prices, available, hasVariants } = products.get(id)!;
      const image = row.images[0];
      const url = image ? publicImageUrl(image.public_url, image.storage_path) : null;
      const compareAt = row.compare_at_price;
      return {
        productId: row.id,
        name: row.name,
        slug: row.slug,
        image: url && image ? { url, alt: image.alt_text?.trim() || null } : null,
        price: row.price,
        compareAtPrice: compareAt && compareAmounts(compareAt, row.price) > 0 ? compareAt : null,
        currencyCode: row.currency_code,
        prices,
        available,
        hasVariants,
      };
    });
    return { ok: true, signedIn: Boolean(customer), ids: kept, items, removed: gone.length };
  } catch (error) {
    if (!alreadyLogged(error)) console.error("[wishlist] view failed", error);
    return { ok: false };
  }
}
