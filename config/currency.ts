import type { CountryCode, CurrencyCode } from "./region";

/**
 * Countries the store delivers to, with the currency their customers pay in.
 * Mirrors mirna-admin's `country_currency` table (migrations 031, 035), which is the
 * authority at checkout (place_order() refuses any other country). Used here
 * to pick a visitor's currency from their location (proxy.ts) and to limit
 * the countries an address can be saved in.
 */
export const shippingCountries: Readonly<Record<CountryCode, CurrencyCode>> = {
  IN: "INR",
  US: "USD",
  BH: "BHD",
  QA: "QAR",
  GB: "GBP",
  BE: "EUR",
  DE: "EUR",
  SA: "SAR",
  KW: "KWD",
  AE: "AED",
  OM: "OMR",
};

/** The currency for a delivery / visitor country, or null if the store doesn't ship there. */
export function currencyForCountry(countryCode: string | null | undefined): CurrencyCode | null {
  const code = countryCode?.toUpperCase();
  return code && Object.hasOwn(shippingCountries, code) ? shippingCountries[code] : null;
}
