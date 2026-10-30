import "server-only";
import type { Currency } from "@/lib/currency/money";
import { getRequestCurrency } from "@/lib/currency/server";
import { createClient } from "@/lib/supabase/server";
import type { CartSummary } from "@/types/domain";
import { CartLookupError, priceLines } from "./pricing";
import { lineKey, MAX_CART_LINES, type CartLine } from "./rules";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The customer's stored cart lines (RLS: own rows only), oldest first. */
export async function readCustomerLines(supabase: Supabase, userId: string): Promise<CartLine[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id, variant_id, quantity")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(MAX_CART_LINES);
  if (error) {
    console.error("[cart] read failed", error.code, error.message);
    throw new CartLookupError();
  }
  return data.map((row) => ({
    productId: row.product_id,
    variantId: row.variant_id,
    quantity: row.quantity,
  }));
}

/** Inserts or updates one line (unique per customer + variant, or + simple product). */
export async function writeLine(
  supabase: Supabase,
  userId: string,
  line: Pick<CartLine, "productId" | "variantId">,
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

/**
 * Merges a guest cart into the customer's stored cart (one line per product
 * or variant; the larger quantity wins, so retrying never doubles anything;
 * lines that are no longer sold, or don't match the product's options, are
 * skipped) and returns the stored lines. `userId` must be the signed-in
 * customer's (RLS checks it too).
 */
export async function mergeGuestLines(
  supabase: Supabase,
  userId: string,
  guest: readonly CartLine[],
): Promise<{ ok: boolean; lines: CartLine[] }> {
  const lines = await readCustomerLines(supabase, userId);
  if (guest.length === 0) return { ok: true, lines };

  // Same rules as the cart page: only lines it would show as sold are merged.
  const priced = await priceLines([...guest], (await getRequestCurrency()).currency);
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
    ok = (await writeLine(supabase, userId, line, line.quantity, existing !== undefined)) && ok;
    current.set(key, line.quantity);
  }
  return { ok, lines: await readCustomerLines(supabase, userId) };
}

/**
 * Deletes the customer's lines for the given keys (see lineKey): variant
 * lines by variant id, simple-product lines by product id + no variant.
 */
export async function deleteCustomerLines(
  supabase: Supabase,
  userId: string,
  lines: readonly CartLine[],
): Promise<boolean> {
  const variantIds = lines.flatMap((line) => (line.variantId ? [line.variantId] : []));
  const productIds = lines.flatMap((line) => (line.variantId ? [] : [line.productId]));
  const results = await Promise.all([
    variantIds.length > 0
      ? supabase.from("cart_items").delete().eq("user_id", userId).in("variant_id", variantIds)
      : null,
    productIds.length > 0
      ? supabase
          .from("cart_items")
          .delete()
          .eq("user_id", userId)
          .is("variant_id", null)
          .in("product_id", productIds)
      : null,
  ]);
  let ok = true;
  for (const result of results) {
    if (result?.error) {
      console.error("[cart] delete failed", result.error.code, result.error.message);
      ok = false;
    }
  }
  return ok;
}

/**
 * The customer's cart priced in `currency` from the admin-set prices. Lines
 * that are no longer sold are deleted. Used by the cart page and checkout.
 * `customerId` must come from the DAL, never from the client.
 */
export async function loadCustomerCart(
  customerId: string,
  currency: Currency | null,
): Promise<{ lines: CartLine[]; summary: CartSummary }> {
  const supabase = await createClient();
  let lines = await readCustomerLines(supabase, customerId);
  const summary = await priceLines(lines, currency);
  if (summary.removed.length > 0) {
    const removed = lines.filter((line) => summary.removed.includes(lineKey(line)));
    await deleteCustomerLines(supabase, customerId, removed);
    lines = lines.filter((line) => !summary.removed.includes(lineKey(line)));
  }
  return { lines, summary };
}
