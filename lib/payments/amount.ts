// Stripe amounts. The amount charged always comes from the database
// (order_payment_state().amount_minor, computed from the stored order
// total); this only checks that the store's currency decimals agree with
// Stripe's minor units, so a KWD order is never charged ten times over.
// Self-contained (no imports), so `node --test` runs its tests directly.

// docs.stripe.com/currencies
const ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);
const THREE_DECIMAL = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

/** Digits after the decimal point in Stripe's minor units (AED 2, KWD 3, JPY 0). */
export function stripeDecimals(currencyCode: string): number {
  const code = currencyCode.toUpperCase();
  if (ZERO_DECIMAL.has(code)) return 0;
  if (THREE_DECIMAL.has(code)) return 3;
  return 2;
}

/**
 * The amount to send Stripe, or null when it can't be charged safely: the
 * store's decimals differ from Stripe's, or the amount isn't a positive
 * whole number of minor units.
 */
export function stripeAmount(
  currencyCode: string,
  storeDecimals: number | null,
  amountMinor: number | null,
): number | null {
  if (storeDecimals === null || amountMinor === null) return null;
  if (stripeDecimals(currencyCode) !== storeDecimals) return null;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  return amountMinor;
}
