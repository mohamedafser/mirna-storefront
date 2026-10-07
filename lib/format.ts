import type { Locale } from "@/config/i18n";
import { activeRegion, type CurrencyCode } from "@/config/region";

/**
 * Centralised Intl formatting. Never hard-code currency codes, symbols,
 * decimal places or date formats in components — call these instead.
 */

/** BCP 47 tag combining UI language with the market, e.g. "en-AE", "ar-AE". */
export function toIntlLocale(locale: Locale, countryCode = activeRegion.countryCode): string {
  return `${locale}-${countryCode}`;
}

/**
 * Formats a price. Pass the PostgreSQL NUMERIC value as a decimal string:
 * select it with a cast (`.select("price::text")`) so JSON parsing never turns
 * it into a float. Intl formats decimal strings exactly, so money never goes
 * through floating-point arithmetic. Decimal places follow the currency
 * (2 for AED, 3 for KWD, 0 for JPY).
 *
 * `currencyCode` should come from the record (products.currency_code); it
 * defaults to the active market's currency (AED for the UAE).
 */
export function formatPrice(
  amount: Intl.StringNumericLiteral | bigint,
  locale: Locale,
  currencyCode: CurrencyCode = activeRegion.currencyCode,
): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

/** Formats a timestamp in the market's timezone (Asia/Dubai for AE). */
export function formatDateTime(
  date: Date | string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  timeZone = activeRegion.timezone,
): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), { ...options, timeZone }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}
