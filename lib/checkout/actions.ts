"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { getCustomerOrNull } from "@/lib/auth/dal";
import { STOCK_TAG } from "@/lib/catalogue/stock";
import { parseAmount } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";

/**
 * Places the order through the place_order() database function (mirna-admin
 * migrations 017, 025, 031, 037), which does everything in one transaction:
 * re-reads the customer's own cart and address, checks the address is in a
 * country the store delivers to and every product is active and in stock,
 * prices it from the admin-set prices in the chosen currency (refusing any
 * line without one), quotes the chosen delivery method for that country and
 * subtotal (free delivery included), writes orders + order_items snapshots
 * (with an immutable shipping snapshot) and only then clears the cart.
 *
 * From the form we take only ids: the address, a per-page checkout key (the
 * same key never creates two orders), the currency, the delivery method and
 * the total the customer saw (delivery included), which the database
 * compares with its own total. The customer is the session's user, and the
 * stored prices, delivery charge and totals are always the database's.
 *
 * Online payment (mirna-admin migration 044): while the store takes
 * payments online, the order is created awaiting payment (its stock held
 * until the payment deadline) and the customer goes on to pay it; the
 * database refuses a currency online payment isn't enabled for.
 */

export type CheckoutError =
  | "cartEmpty"
  | "cartUnavailable"
  | "cartChanged"
  | "addressInvalid"
  | "accountNotAllowed"
  | "mixedCurrency"
  | "priceMissing"
  | "countryNotAllowed"
  | "shippingUnavailable"
  | "shippingChanged"
  | "paymentUnavailable"
  | "signedOut"
  | "unexpected";

export interface CheckoutState {
  error: CheckoutError | null;
}

// place_order() raises these as exception messages.
const DB_ERRORS: Record<string, CheckoutError> = {
  not_authenticated: "signedOut",
  account_not_allowed: "accountNotAllowed",
  address_invalid: "addressInvalid",
  cart_empty: "cartEmpty",
  cart_unavailable: "cartUnavailable",
  cart_changed: "cartChanged",
  mixed_currency: "mixedCurrency",
  price_missing: "priceMissing",
  country_not_allowed: "countryNotAllowed",
  // The currency was disabled meanwhile: the page re-prices in another one.
  currency_invalid: "cartChanged",
  // Migration 037: no delivery to the address's country, the chosen method
  // was changed or disabled meanwhile, or the page priced in another currency.
  shipping_unavailable: "shippingUnavailable",
  shipping_method_invalid: "shippingChanged",
  shipping_currency_mismatch: "cartChanged",
  // Migration 044: online payment isn't enabled for this currency.
  payment_currency_unavailable: "paymentUnavailable",
};

/** Whether the order just placed must be paid online (false before migration 044). */
async function needsPayment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (error && error.code !== "42703") {
    console.error("[checkout] payment status lookup failed", error.code, error.message);
  }
  return data?.payment_status === "PENDING" || data?.payment_status === "FAILED";
}

function localeFrom(formData: FormData): Locale {
  const value = formData.get("locale");
  return isLocale(value) ? value : defaultLocale;
}

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const locale = localeFrom(formData);
  const addressId = formData.get("addressId");
  const checkoutKey = formData.get("checkoutKey");
  const expectedTotal = parseAmount(String(formData.get("expectedTotal") ?? ""));
  const currencyCode = String(formData.get("currencyCode") ?? "");
  // Empty before migration 037 (no delivery options shown).
  const shippingMethodId = formData.get("shippingMethodId");

  if (!isUuid(addressId)) return { error: "addressInvalid" };
  if (!isUuid(checkoutKey) || expectedTotal === null || !/^[A-Z]{3}$/.test(currencyCode)) {
    return { error: "cartChanged" };
  }
  if (shippingMethodId !== null && shippingMethodId !== "" && !isUuid(shippingMethodId)) {
    return { error: "shippingChanged" };
  }

  const customer = await getCustomerOrNull();
  if (!customer) return { error: "signedOut" };

  const supabase = await createClient();
  const args = {
    p_address_id: addressId,
    p_checkout_key: checkoutKey,
    p_expected_total: expectedTotal,
  };
  // The currency the customer saw: locked on the order (never converted).
  const withCurrency = { ...args, p_currency_code: currencyCode };
  let { data, error } = isUuid(shippingMethodId)
    ? await supabase.rpc("place_order", { ...withCurrency, p_shipping_method_id: shippingMethodId })
    : await supabase.rpc("place_order", withCurrency);
  if (error?.code === "PGRST202") {
    // Before mirna-admin migration 031: the single-currency place_order(), which
    // prices in each product's own currency (the legacy prices shown until then).
    ({ data, error } = await supabase.rpc(
      "place_order",
      args as unknown as Parameters<typeof supabase.rpc<"place_order">>[1],
    ));
  }

  if (error) {
    const known = DB_ERRORS[error.message];
    if (!known) console.error("[checkout] place_order failed", error.code, error.message);
    return { error: known ?? "unexpected" };
  }
  const order = data?.[0];
  if (!order) {
    console.error("[checkout] place_order returned no order");
    return { error: "unexpected" };
  }

  // The order took its units out of stock (mirna-admin 043): show it now.
  updateTag(STOCK_TAG);
  const id = order.placed_order_id;
  redirect(
    localizedHref(
      locale,
      (await needsPayment(supabase, id)) ? routes.orderPayment(id) : routes.orderConfirmation(id),
    ),
  );
}
