"use server";

import { getCustomerOrNull } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { CartSummary } from "@/types/domain";
import { loadCustomerCart, readCustomerLines } from "./customer-cart";
import { CartLookupError, getSellableProducts, priceLines } from "./pricing";
import {
  clampQuantity,
  isProductId,
  isValidQuantity,
  MAX_CART_LINES,
  sanitizeLines,
  type CartLine,
} from "./rules";

/**
 * Cart Server Actions.
 *
 * - Guests: the cart lives in localStorage. Actions only validate (is the
 *   product sold and available?) and price lines; they return `lines: null`
 *   and the browser stores the result itself.
 * - Signed-in active customers: the cart lives in `cart_items` (RLS: own rows
 *   only). Actions read and write it with the customer's session and return
 *   the stored lines.
 *
 * Nothing the client sends is trusted beyond a product id and a quantity:
 * both are re-validated here, prices always come from `products`.
 */

export type CartError =
  | "unavailable" // not orderable right now
  | "notFound" // inactive, deleted or unknown product
  | "invalidQuantity"
  | "cartFull"
  | "unexpected";

export type CartResult =
  | { ok: true; lines: CartLine[] | null }
  | { ok: false; error: CartError; lines: CartLine[] | null };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Inserts or updates one line (unique per customer + product). */
async function writeLine(
  supabase: Supabase,
  userId: string,
  productId: string,
  quantity: number,
  exists: boolean,
): Promise<boolean> {
  const update = () =>
    supabase
      .from("cart_items")
      .update({ quantity })
      .eq("user_id", userId)
      .eq("product_id", productId);

  let { error } = exists
    ? await update()
    : await supabase.from("cart_items").insert({ product_id: productId, quantity });
  // Added in another tab meanwhile: the unique constraint stops a duplicate line.
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

/** Adds `quantity` of an active, available product (capped at the line maximum). */
export async function addToCart(productId: unknown, quantity: unknown): Promise<CartResult> {
  return guarded(async (customer) => {
    if (!isProductId(productId)) return { ok: false, error: "notFound", lines: null };
    if (!isValidQuantity(quantity)) return { ok: false, error: "invalidQuantity", lines: null };

    const product = (await getSellableProducts([productId])).get(productId);
    if (!product) return { ok: false, error: "notFound", lines: null };
    if (!product.available) return { ok: false, error: "unavailable", lines: null };

    if (!customer) return { ok: true, lines: null };

    const supabase = await createClient();
    const lines = await readCustomerLines(supabase, customer.id);
    const existing = lines.find((line) => line.productId === productId);
    if (!existing && lines.length >= MAX_CART_LINES) {
      return { ok: false, error: "cartFull", lines };
    }
    const next = clampQuantity((existing?.quantity ?? 0) + quantity);
    const written = await writeLine(supabase, customer.id, productId, next, Boolean(existing));
    const updated = await readCustomerLines(supabase, customer.id);
    return written
      ? { ok: true, lines: updated }
      : { ok: false, error: "unexpected", lines: updated };
  });
}

/** Sets a line's quantity (customers; guests change localStorage directly). */
export async function setCartQuantity(productId: unknown, quantity: unknown): Promise<CartResult> {
  return guarded(async (customer) => {
    if (!isProductId(productId)) return { ok: false, error: "notFound", lines: null };
    if (!isValidQuantity(quantity)) return { ok: false, error: "invalidQuantity", lines: null };
    if (!customer) return { ok: true, lines: null };

    const supabase = await createClient();
    const written = await writeLine(supabase, customer.id, productId, quantity, true);
    const lines = await readCustomerLines(supabase, customer.id);
    return written ? { ok: true, lines } : { ok: false, error: "unexpected", lines };
  });
}

/** Removes one product, or every line when `productId` is null (clear cart). */
export async function removeFromCart(productId: unknown): Promise<CartResult> {
  return guarded(async (customer) => {
    if (productId !== null && !isProductId(productId)) {
      return { ok: false, error: "notFound", lines: null };
    }
    if (!customer) return { ok: true, lines: null };

    const supabase = await createClient();
    let query = supabase.from("cart_items").delete().eq("user_id", customer.id);
    if (productId) query = query.eq("product_id", productId);
    const { error } = await query;
    if (error) console.error("[cart] delete failed", error.code, error.message);
    const lines = await readCustomerLines(supabase, customer.id);
    return error ? { ok: false, error: "unexpected", lines } : { ok: true, lines };
  });
}

/**
 * Called by the browser on load and after sign-in. For a customer, merges the
 * guest cart into `cart_items` (one line per product; the larger quantity
 * wins, so retrying never doubles anything; inactive products are skipped)
 * and returns the stored lines. For a guest, returns `lines: null`.
 */
export async function syncCart(guestLines: unknown): Promise<CartResult> {
  return guarded(async (customer) => {
    if (!customer) return { ok: true, lines: null };

    const supabase = await createClient();
    const lines = await readCustomerLines(supabase, customer.id);
    const guest = sanitizeLines(guestLines);
    if (guest.length === 0) return { ok: true, lines };

    const sellable = await getSellableProducts(guest.map((line) => line.productId));
    const current = new Map(lines.map((line) => [line.productId, line.quantity]));
    let ok = true;
    for (const line of guest) {
      if (!sellable.has(line.productId)) continue;
      const existing = current.get(line.productId);
      if (existing !== undefined && existing >= line.quantity) continue;
      if (existing === undefined && current.size >= MAX_CART_LINES) break;
      ok =
        (await writeLine(
          supabase,
          customer.id,
          line.productId,
          line.quantity,
          existing !== undefined,
        )) && ok;
      current.set(line.productId, line.quantity);
    }
    const merged = await readCustomerLines(supabase, customer.id);
    return ok ? { ok: true, lines: merged } : { ok: false, error: "unexpected", lines: merged };
  });
}

export type CartView =
  { ok: true; signedIn: boolean; lines: CartLine[]; summary: CartSummary } | { ok: false };

/**
 * The cart page's data: lines priced from the current product rows. For a
 * customer the stored lines are used (the argument is ignored) and lines for
 * products that are no longer sold are deleted; for a guest the given lines
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
