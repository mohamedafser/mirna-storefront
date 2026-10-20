import "server-only";
import { MAX_QUANTITY } from "@/lib/cart/rules";
import { createPublicClient } from "@/lib/supabase/public";

// How many units can be ordered right now, per product or variant: 0 when
// sold out, otherwise up to MAX_QUANTITY (the database never reveals stock
// above the cart limit). mirna-admin 033 (product_stock_limit() /
// variant_stock_limit()); until it is applied the yes/no availability
// functions are used instead (in stock = MAX_QUANTITY).

type Lookup =
  | { ok: true; limits: Map<string, number> }
  | { ok: false; error: { code?: string; message?: string } };

/** 033 not applied yet: the function doesn't exist. */
const isMissing = (error: { code?: string } | null) =>
  error?.code === "PGRST202" || error?.code === "42883";

let warned = false;
function warnMissing() {
  if (warned) return;
  warned = true;
  console.warn(
    "[stock] product_stock_limit() / variant_stock_limit() missing (mirna-admin 033): quantities capped at the cart maximum only",
  );
}

const fromAvailable = (available: boolean) => (available ? MAX_QUANTITY : 0);

/** Per active product (absent = inactive or unknown). */
export async function lookupProductStock(ids: readonly string[]): Promise<Lookup> {
  if (ids.length === 0) return { ok: true, limits: new Map() };
  const supabase = createPublicClient();
  const limits = await supabase.rpc("product_stock_limit", { p_product_ids: [...ids] });
  if (!limits.error) {
    return {
      ok: true,
      limits: new Map(limits.data.map((row) => [row.product_id, row.max_quantity])),
    };
  }
  if (!isMissing(limits.error)) return { ok: false, error: limits.error };
  warnMissing();
  const fallback = await supabase.rpc("product_availability", { p_product_ids: [...ids] });
  if (fallback.error) return { ok: false, error: fallback.error };
  return {
    ok: true,
    limits: new Map(fallback.data.map((row) => [row.product_id, fromAvailable(row.available)])),
  };
}

/** Per purchasable variant (absent = not purchasable, e.g. an inactive value). */
export async function lookupVariantStock(ids: readonly string[]): Promise<Lookup> {
  if (ids.length === 0) return { ok: true, limits: new Map() };
  const supabase = createPublicClient();
  const limits = await supabase.rpc("variant_stock_limit", { p_variant_ids: [...ids] });
  if (!limits.error) {
    return {
      ok: true,
      limits: new Map(limits.data.map((row) => [row.variant_id, row.max_quantity])),
    };
  }
  if (!isMissing(limits.error)) return { ok: false, error: limits.error };
  warnMissing();
  const fallback = await supabase.rpc("variant_availability", { p_variant_ids: [...ids] });
  if (fallback.error) return { ok: false, error: fallback.error };
  return {
    ok: true,
    limits: new Map(fallback.data.map((row) => [row.variant_id, fromAvailable(row.available)])),
  };
}
