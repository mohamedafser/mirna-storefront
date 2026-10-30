// Multi-currency prices (mirna-admin migration 031). Prices are admin-set per
// currency as INTEGER MINOR UNITS in that currency's decimals (1.500 BHD =
// 1500, 12.50 AED = 1250) and are never converted: no price in a currency
// means "not sold in that currency". Self-contained (no imports), so
// `node --test` runs its tests directly; safe in client and server code.

export interface Currency {
  code: string;
  symbol: string;
  /** 0–3: digits after the decimal point (BHD / KWD 3, most others 2). */
  decimals: number;
  isDefault: boolean;
}

/** Regular price and optional sale price, in minor units. */
export interface MinorPrice {
  price: number;
  salePrice: number | null;
}

/** One product_prices row as the storefront reads it. */
export interface PriceRow extends MinorPrice {
  variantId: string | null;
  currency: string;
}

/** Currency cookie (ISO code) and how it was chosen. */
export const CURRENCY_COOKIE = "mirna-currency";
export const CURRENCY_SOURCE_COOKIE = "mirna-currency-source";
/**
 * "user": picked in the header (always wins); "address": from the delivery
 * address at checkout; "geo": from the visitor's location (proxy.ts).
 */
export type CurrencySource = "user" | "address" | "geo";

export function isCurrencySource(value: unknown): value is CurrencySource {
  return value === "user" || value === "address" || value === "geo";
}

/** 1500 with 3 decimals → "1.500" (exact, always every decimal). */
export function minorToDecimal(minor: number | bigint | string, decimals: number): string {
  const digits = BigInt(minor)
    .toString()
    .padStart(decimals + 1, "0");
  return decimals > 0 ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : digits;
}

/**
 * Formats minor units with Intl.NumberFormat, showing exactly the currency's
 * decimals ("BHD 1.500", "₹1,234.56"). The amount reaches Intl as a decimal
 * string, so nothing goes through floating point.
 */
export function formatMinor(
  minor: number | bigint | string,
  currency: Pick<Currency, "code" | "decimals">,
  intlLocale: string,
): string {
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(minorToDecimal(minor, currency.decimals) as Intl.StringNumericLiteral);
}

/**
 * The price a product (or one of its variants) sells for in `currency`: the
 * variant's own row, else the product's row; null when the admin set none
 * (the item is then not sold in that currency — never converted).
 */
export function lookupPrice(
  rows: readonly PriceRow[],
  currency: string,
  variantId: string | null = null,
): MinorPrice | null {
  const match = (id: string | null) =>
    rows.find((row) => row.currency === currency && row.variantId === id);
  const row = (variantId ? match(variantId) : undefined) ?? match(null);
  return row ? { price: row.price, salePrice: row.salePrice } : null;
}

/** What the customer pays: the sale price when set, else the price. */
export function payable(price: MinorPrice): number {
  return price.salePrice ?? price.price;
}

/**
 * A product card's price in `currency`: the product's own price, else the
 * lowest variant price ("from"). null = not sold in that currency.
 */
export function cardPrice(
  rows: readonly PriceRow[],
  currency: string,
): (MinorPrice & { from: boolean }) | null {
  const own = lookupPrice(rows, currency);
  if (own) return { ...own, from: false };
  const variants = rows.filter((row) => row.currency === currency && row.variantId);
  if (variants.length === 0) return null;
  const lowest = variants.reduce((min, row) => (payable(row) < payable(min) ? row : min));
  const differ = variants.some((row) => payable(row) !== payable(lowest));
  return { price: lowest.price, salePrice: lowest.salePrice, from: differ };
}

/**
 * The currency to use: the chosen code when it's one of the active
 * currencies, else the default (else the first active one).
 */
export function resolveCurrency(
  currencies: readonly Currency[],
  chosen: string | null | undefined,
): Currency | null {
  return (
    currencies.find((currency) => currency.code === chosen) ??
    currencies.find((currency) => currency.isDefault) ??
    currencies[0] ??
    null
  );
}

/**
 * A NUMERIC decimal string ("99.5", "12.345") in minor units at `decimals`,
 * rounded half up: for prices stored before per-currency prices existed.
 */
export function decimalToMinor(amount: string, decimals: number): number {
  const [integer, fraction = ""] = amount.split(".");
  const kept = BigInt(integer + fraction.padEnd(decimals, "0").slice(0, decimals));
  const roundUp = (fraction[decimals] ?? "0") >= "5";
  return Number(kept + BigInt(roundUp ? 1 : 0));
}

/**
 * Price rows from the legacy single-currency columns (products / variants
 * price + compare_at_price in products.currency_code): used until mirna-admin
 * migration 031 adds product_prices. Same mapping as its backfill: the
 * compare-at price is the regular price and the selling price the sale price.
 */
export function legacyPriceRows(
  currency: Pick<Currency, "code" | "decimals">,
  rows: readonly { variantId: string | null; price: string; compareAt: string | null }[],
): PriceRow[] {
  return rows.flatMap(({ variantId, price, compareAt }) => {
    const pays = decimalToMinor(price, currency.decimals);
    const was = compareAt ? decimalToMinor(compareAt, currency.decimals) : null;
    if (pays <= 0) return [];
    return [
      was && was > pays
        ? { variantId, currency: currency.code, price: was, salePrice: pays }
        : { variantId, currency: currency.code, price: pays, salePrice: null },
    ];
  });
}

/**
 * Whole percent off a sale price: (price − salePrice) / price, rounded DOWN
 * so a discount is never overstated, and at least 1. Exact integer math on
 * minor units (BigInt: no floating point). null when there's no sale.
 */
export function percentOff(price: MinorPrice): number | null {
  const { price: regular, salePrice } = price;
  if (salePrice === null || salePrice >= regular || regular <= 0) return null;
  const percent = Number(((BigInt(regular) - BigInt(salePrice)) * BigInt(100)) / BigInt(regular));
  return Math.max(1, percent);
}

/**
 * The percentage off for a product's sale label: among its prices in
 * `currency` (its own and its variants') that have a sale price, the biggest
 * discount. null when nothing is on sale in that currency.
 */
export function bestPercentOff(rows: readonly PriceRow[], currency: string): number | null {
  const onSale = rows
    .filter((row) => row.currency === currency)
    .map((row) => percentOff(row))
    .filter((value): value is number => value !== null);
  return onSale.length > 0 ? Math.max(...onSale) : null;
}
