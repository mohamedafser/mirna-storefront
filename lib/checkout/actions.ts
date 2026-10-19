"use server";

import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { getCustomerOrNull } from "@/lib/auth/dal";
import { parseAmount } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";

/**
 * Places the order through the place_order() database function (mirna-admin
 * migrations 017, 025, 031), which does everything in one transaction:
 * re-reads the customer's own cart and address, checks the address is in a
 * country the store ships to and every product is active and in stock, prices
 * it from the admin-set prices in the chosen currency (refusing any line
 * without one), writes orders + order_items snapshots with that currency and
 * only then clears the cart.
 *
 * From the form we take only ids: the address, a per-page checkout key (the
 * same key never creates two orders), the currency and the total the customer
 * saw, which the database compares with its own total. The customer is the session's user,
 * and the stored prices and totals are always the database's.
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
};

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

  if (!isUuid(addressId)) return { error: "addressInvalid" };
  if (!isUuid(checkoutKey) || expectedTotal === null || !/^[A-Z]{3}$/.test(currencyCode)) {
    return { error: "cartChanged" };
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
  let { data, error } = await supabase.rpc("place_order", {
    ...args,
    p_currency_code: currencyCode,
  });
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

  redirect(localizedHref(locale, routes.orderConfirmation(order.placed_order_id)));
}
