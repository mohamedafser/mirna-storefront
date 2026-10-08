import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CartSummary } from "@/types/domain";
import { CartLookupError, priceLines } from "./pricing";
import { MAX_CART_LINES, type CartLine } from "./rules";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The customer's stored cart lines (RLS: own rows only), oldest first. */
export async function readCustomerLines(supabase: Supabase, userId: string): Promise<CartLine[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id, quantity")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(MAX_CART_LINES);
  if (error) {
    console.error("[cart] read failed", error.code, error.message);
    throw new CartLookupError();
  }
  return data.map((row) => ({ productId: row.product_id, quantity: row.quantity }));
}

/**
 * The customer's cart priced from current product rows. Lines for products
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
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", customerId)
      .in("product_id", summary.removed);
    if (error) console.error("[cart] cleanup failed", error.code, error.message);
    lines = lines.filter((line) => !summary.removed.includes(line.productId));
  }
  return { lines, summary };
}
