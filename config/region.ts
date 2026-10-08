import { defaultLocale, type Locale } from "./i18n";

/**
 * Regional configuration — the ONLY place country, currency and timezone
 * defaults live. Components and utilities read `activeRegion` instead of
 * hard-coding "AE" / "AED" / "Asia/Dubai".
 *
 * To launch a new market, add an entry to `regions` and select it with
 * NEXT_PUBLIC_REGION. Per-record currency still comes from the database
 * (products.currency_code, orders.currency_code).
 */

/** ISO 4217 alphabetic code, e.g. "AED", "SAR", "INR", "USD", "GBP". */
export type CurrencyCode = string;

/** ISO 3166-1 alpha-2 code, e.g. "AE", "SA", "IN", "US", "GB". */
export type CountryCode = string;

export interface RegionConfig {
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  defaultLocale: Locale;
  /** IANA timezone used to display dates for this market. */
  timezone: string;
}

/** A first-level subdivision customers pick from (a UAE emirate). `value` is stored. */
export interface Subdivision {
  /** ISO 3166-2 code; also the key into messages.addresses.subdivisions. */
  code: string;
  /** Stored in addresses.state_region (stable across UI languages). */
  value: string;
}

/**
 * Address rules per country: the subdivision list (when the country uses a
 * fixed list) and whether a postal code is required. Countries without an
 * entry accept free-text state/region and an optional postal code.
 */
export const addressRules: Record<
  CountryCode,
  { subdivisions?: readonly Subdivision[]; postalCodeRequired: boolean }
> = {
  AE: {
    subdivisions: [
      { code: "AE-AZ", value: "Abu Dhabi" },
      { code: "AE-DU", value: "Dubai" },
      { code: "AE-SH", value: "Sharjah" },
      { code: "AE-AJ", value: "Ajman" },
      { code: "AE-UQ", value: "Umm Al Quwain" },
      { code: "AE-RK", value: "Ras Al Khaimah" },
      { code: "AE-FU", value: "Fujairah" },
    ],
    // The UAE has no postal codes.
    postalCodeRequired: false,
  },
};

export const regions = {
  AE: {
    countryCode: "AE",
    currencyCode: "AED",
    defaultLocale,
    timezone: "Asia/Dubai",
  },
} as const satisfies Record<string, RegionConfig>;

export type RegionKey = keyof typeof regions;

function isRegionKey(value: string | undefined): value is RegionKey {
  return value !== undefined && Object.hasOwn(regions, value);
}

const DEFAULT_REGION: RegionKey = "AE";

const configured = process.env.NEXT_PUBLIC_REGION;

export const activeRegion: RegionConfig =
  regions[isRegionKey(configured) ? configured : DEFAULT_REGION];

/**
 * Currencies a product may be priced in: every configured market's currency
 * (just AED today). Adding a region adds its currency automatically.
 */
export const supportedCurrencies: readonly CurrencyCode[] = [
  ...new Set(Object.values(regions).map((region) => region.currencyCode)),
];

/**
 * Countries customers can save addresses in: every configured market (just
 * AE today), active market first. Adding a region adds its country.
 */
export const addressCountries: readonly CountryCode[] = [
  ...new Set([activeRegion.countryCode, ...Object.values(regions).map((r) => r.countryCode)]),
];
