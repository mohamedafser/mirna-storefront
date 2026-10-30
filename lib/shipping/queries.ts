import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CheckoutShipping, ShippingMethodCode } from "@/types/domain";

/**
 * Delivery options for the signed-in customer's cart to one of their own
 * addresses, through checkout_shipping_options() (mirna-admin migration 037).
 * The database does all of it: the country comes from the stored address,
 * the subtotal from its own prices for the cart, and the charge from the
 * admin's rates in that country's currency, free-delivery threshold
 * included. Nothing priced here is trusted later: place_order() quotes the
 * chosen method again.
 *
 * "legacy": the function doesn't exist yet (migration 037 not applied), so
 * checkout keeps its previous behaviour (delivery confirmed after ordering).
 */

const METHOD_CODES: readonly ShippingMethodCode[] = ["STANDARD", "EXPRESS"];

export async function getCheckoutShipping(
  addressId: string,
  currencyCode: string,
): Promise<CheckoutShipping> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkout_shipping_options", {
    p_address_id: addressId,
    p_currency_code: currencyCode,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return { status: "legacy" };
    console.error("[shipping] options failed", error.code, error.message);
    return { status: "error" };
  }

  const amount = (value: string) => value as Intl.StringNumericLiteral;
  return {
    status: "ready",
    options: data
      .filter((row) => METHOD_CODES.includes(row.method_code as ShippingMethodCode))
      .map((row) => ({
        methodId: row.method_id,
        code: row.method_code as ShippingMethodCode,
        amount: amount(row.amount),
        baseAmount: amount(row.base_amount),
        isFree: row.is_free,
        freeRemaining: row.free_shipping_remaining ? amount(row.free_shipping_remaining) : null,
        minDays: row.min_delivery_days,
        maxDays: row.max_delivery_days,
        orderTotal: row.order_total ? amount(row.order_total) : null,
      })),
  };
}
