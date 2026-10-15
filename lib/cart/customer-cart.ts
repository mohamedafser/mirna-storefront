import "server-only";
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
 * The customer's cart priced from current product and variant rows. Lines
 * that are no longer sold are deleted. Used by the cart page and checkout.
 * `customerId` must come from the DAL, never from the client.
 */
export async function loadCustomerCart(
  customerId: string,
): Promise<{ lines: CartLine[]; summary: CartSummary }> {
  const supabase = await createClient();
  let lines = await readCustomerLines(supabase, customerId);
  const summary = await priceLines(lines);
  if (summary.removed.length > 0) {
    const removed = lines.filter((line) => summary.removed.includes(lineKey(line)));
    await deleteCustomerLines(supabase, customerId, removed);
    lines = lines.filter((line) => !summary.removed.includes(lineKey(line)));
  }
  return { lines, summary };
}
