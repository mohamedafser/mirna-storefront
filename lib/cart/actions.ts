"use server";

import { getCustomerOrNull } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { CartSummary } from "@/types/domain";
import { deleteCustomerLines, loadCustomerCart, readCustomerLines } from "./customer-cart";
import { CartLookupError, checkLine, priceLines } from "./pricing";
import {
  clampQuantity,
  isProductId,
  isValidQuantity,
  isVariantRef,
  lineKey,
  MAX_CART_LINES,
  sanitizeLines,
  type CartLine,
} from "./rules";

/**
 * Cart Server Actions.
 *
 * - Guests: the cart lives in localStorage. Actions only validate (is the
 *   product / variant sold and available?) and price lines; they return
 *   `lines: null` and the browser stores the result itself.
 * - Signed-in active customers: the cart lives in `cart_items` (RLS: own rows
 *   only; the insert policy also checks the product / variant). Actions read
 *   and write it with the customer's session and return the stored lines.
 *
 * Nothing the client sends is trusted beyond a product id, a variant id and
 * a quantity: all are re-validated here, prices always come from `products`
 * or `product_variants`.
 */

export type CartError =
  | "unavailable" // not orderable right now
  | "notFound" // inactive, deleted or unknown product or variant
  | "optionsRequired" // a product with variants, added without one
  | "invalidQuantity"
  | "cartFull"
  | "unexpected";

export type CartResult =
  | { ok: true; lines: CartLine[] | null }
  | { ok: false; error: CartError; lines: CartLine[] | null };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** One line: a variant id, else a product id with no variant. */
interface LineRef {
  productId: string;
  variantId: string | null;
}

/** Inserts or updates one line (unique per customer + variant, or + simple product). */
async function writeLine(
  supabase: Supabase,
  userId: string,
  line: LineRef,
  quantity: number,
  exists: boolean,
): Promise<boolean> {
  const update = () => {
    const query = supabase.from("cart_items").update({ quantity }).eq("user_id", userId);
    return line.variantId
      ? query.eq("variant_id", line.variantId)
      : query.eq("product_id", line.productId).is("variant_id", null);
  };

  let { error } = exists
    ? await update()
    : await supabase
        .from("cart_items")
        .insert({ product_id: line.productId, variant_id: line.variantId, quantity });
  // Added in another tab meanwhile: the unique index stops a duplicate line.
  if (error?.code === "23505") ({ error } = await update());
  if (error) console.error("[cart] write failed", error.code, error.message);
  return !error;
}

async function guarded(
  run: (customer: { id: string } | null) => Promise<CartResult>,
): Promise<CartResult> {
  try {
    return await run(await getCustomerOrNull());
  } catch (error) {
    if (!(error instanceof CartLookupError)) console.error("[cart] action failed", error);
    return { ok: false, error: "unexpected", lines: null };
  }
}

function parseRef(productId: unknown, variantId: unknown): LineRef | null {
  return isProductId(productId) && isVariantRef(variantId) ? { productId, variantId } : null;
}

/**
 * Adds `quantity` of an active, available product, or of one of its
 * purchasable variants (capped at the line maximum). A product with variants
 * can only be added with a variant of that product.
 */
export async function addToCart(
  productId: unknown,
  variantId: unknown,
  quantity: unknown,
): Promise<CartResult> {
  return guarded(async (customer) => {
    const ref = parseRef(productId, variantId);
    if (!ref) return { ok: false, error: "notFound", lines: null };
    if (!isValidQuantity(quantity)) return { ok: false, error: "invalidQuantity", lines: null };

    const check = await checkLine(ref.productId, ref.variantId);
    if (check !== "ok") return { ok: false, error: check, lines: null };

    if (!customer) return { ok: true, lines: null };

    const supabase = await createClient();
    const lines = await readCustomerLines(supabase, customer.id);
    const existing = lines.find((line) => lineKey(line) === lineKey(ref));
    if (!existing && lines.length >= MAX_CART_LINES) {
      return { ok: false, error: "cartFull", lines };
    }
    const next = clampQuantity((existing?.quantity ?? 0) + quantity);
    const written = await writeLine(supabase, customer.id, ref, next, Boolean(existing));
    const updated = await readCustomerLines(supabase, customer.id);
    return written
      ? { ok: true, lines: updated }
      : { ok: false, error: "unexpected", lines: updated };
  });
}

/** Sets a line's quantity (customers; guests change localStorage directly). */
export async function setCartQuantity(
  productId: unknown,
  variantId: unknown,
  quantity: unknown,
): Promise<CartResult> {
  return guarded(async (customer) => {
    const ref = parseRef(productId, variantId);
    if (!ref) return { ok: false, error: "notFound", lines: null };
    if (!isValidQuantity(quantity)) return { ok: false, error: "invalidQuantity", lines: null };
    if (!customer) return { ok: true, lines: null };

    const supabase = await createClient();
    const written = await writeLine(supabase, customer.id, ref, quantity, true);
    const lines = await readCustomerLines(supabase, customer.id);
    return written ? { ok: true, lines } : { ok: false, error: "unexpected", lines };
  });
}

/** Removes one line, or every line when `productId` is null (clear cart). */
export async function removeFromCart(productId: unknown, variantId: unknown): Promise<CartResult> {
  return guarded(async (customer) => {
    const ref = productId === null ? null : parseRef(productId, variantId);
    if (productId !== null && !ref) return { ok: false, error: "notFound", lines: null };
    if (!customer) return { ok: true, lines: null };

    const supabase = await createClient();
    let ok: boolean;
    if (ref) {
      ok = await deleteCustomerLines(supabase, customer.id, [{ ...ref, quantity: 1 }]);
    } else {
      const { error } = await supabase.from("cart_items").delete().eq("user_id", customer.id);
      if (error) console.error("[cart] delete failed", error.code, error.message);
      ok = !error;
    }
    const lines = await readCustomerLines(supabase, customer.id);
    return ok ? { ok: true, lines } : { ok: false, error: "unexpected", lines };
  });
}

/**
 * Called by the browser on load and after sign-in. For a customer, merges the
 * guest cart into `cart_items` (one line per product or variant; the larger
 * quantity wins, so retrying never doubles anything; lines that are no longer
 * sold, or don't match the product's options, are skipped) and returns the
 * stored lines. For a guest, returns `lines: null`.
 */
export async function syncCart(guestLines: unknown): Promise<CartResult> {
  return guarded(async (customer) => {
    if (!customer) return { ok: true, lines: null };

    const supabase = await createClient();
    const lines = await readCustomerLines(supabase, customer.id);
    const guest = sanitizeLines(guestLines);
    if (guest.length === 0) return { ok: true, lines };

    // Same rules as the cart page: only lines it would show as sold are merged.
    const priced = await priceLines(guest);
    const sellable = new Set(
      priced.items.filter((item) => !item.needsOptions).map((item) => item.key),
    );
    const current = new Map(lines.map((line) => [lineKey(line), line.quantity]));
    let ok = true;
    for (const line of guest) {
      const key = lineKey(line);
      if (!sellable.has(key)) continue;
      const existing = current.get(key);
      if (existing !== undefined && existing >= line.quantity) continue;
      if (existing === undefined && current.size >= MAX_CART_LINES) break;
      ok =
        (await writeLine(supabase, customer.id, line, line.quantity, existing !== undefined)) && ok;
      current.set(key, line.quantity);
    }
    const merged = await readCustomerLines(supabase, customer.id);
    return ok ? { ok: true, lines: merged } : { ok: false, error: "unexpected", lines: merged };
  });
}

export type CartView =
  { ok: true; signedIn: boolean; lines: CartLine[]; summary: CartSummary } | { ok: false };

/**
 * The cart page's data: lines priced from the current product and variant
 * rows. For a customer the stored lines are used (the argument is ignored)
 * and lines that are no longer sold are deleted; for a guest the given lines
 * are priced and the caller drops `summary.removed`.
 */
export async function getCartView(guestLines: unknown): Promise<CartView> {
  try {
    const customer = await getCustomerOrNull();
    if (!customer) {
      const lines = sanitizeLines(guestLines);
      return { ok: true, signedIn: false, lines, summary: await priceLines(lines) };
    }

    return { ok: true, signedIn: true, ...(await loadCustomerCart(customer.id)) };
  } catch (error) {
    if (!(error instanceof CartLookupError)) console.error("[cart] view failed", error);
    return { ok: false };
  }
}
