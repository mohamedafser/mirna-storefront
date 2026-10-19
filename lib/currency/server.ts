import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { activeRegion } from "@/config/region";
import { createPublicClient } from "@/lib/supabase/public";
import {
  CURRENCY_COOKIE,
  CURRENCY_SOURCE_COOKIE,
  isCurrencySource,
  legacyPriceRows,
  resolveCurrency,
  type Currency,
  type CurrencySource,
  type PriceRow,
} from "./money";

/** Missing table / relation / function: migration 031 isn't applied yet. */
export function isMissingPrices(error: { code?: string } | null): boolean {
  return ["42P01", "PGRST200", "PGRST202", "PGRST205"].includes(error?.code ?? "");
}

/** Decimals Intl uses for a currency (AED 2, KWD 3): for legacy prices only. */
function intlDecimals(code: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * Whether per-currency prices exist (mirna-admin migration 031). Until then
 * the storefront keeps selling in each product's own currency from its
 * legacy price columns (legacyPrices), like before. Cached.
 */
export async function hasCurrencyPrices(): Promise<boolean> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogue");

  const { error } = await createPublicClient().from("currencies").select("code").limit(1);
  if (!error) return true;
  if (isMissingPrices(error)) {
    console.warn("[currency] currencies not set up yet (migration 031): legacy prices");
    return false;
  }
  console.error("[currency] currencies check failed", error.code, error.message);
  cacheLife({ stale: 30, revalidate: 15, expire: 300 });
  return true;
}

/** Price rows from legacy columns, in the product's own currency (before 031). */
export function legacyPrices(
  currencyCode: string,
  rows: readonly { variantId: string | null; price: string; compareAt: string | null }[],
): PriceRow[] {
  return legacyPriceRows({ code: currencyCode, decimals: intlDecimals(currencyCode) }, rows);
}

/**
 * The currencies the store sells in (mirna-admin migration 031: public read),
 * default first. Cached for every visitor like the catalogue; [] if they
 * can't be read (prices then show as unavailable rather than breaking pages).
 */
export async function getCurrencies(): Promise<Currency[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogue");

  const { data, error } = await createPublicClient()
    .from("currencies")
    .select("code, symbol, decimals, is_default")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("code", { ascending: true });
  if (isMissingPrices(error)) {
    // Before migration 031: the market's currency only (legacy prices).
    const code = activeRegion.currencyCode;
    return [{ code, symbol: code, decimals: intlDecimals(code), isDefault: true }];
  }
  if (error) {
    console.error("[currency] currencies failed", error.code, error.message);
    // Short, so a fixed table shows prices again within seconds.
    cacheLife({ stale: 30, revalidate: 15, expire: 300 });
    return [];
  }
  return data.map((row) => ({
    code: row.code,
    symbol: row.symbol,
    decimals: row.decimals,
    isDefault: row.is_default,
  }));
}

/**
 * This request's currency: the visitor's choice (cookie, set by the header
 * switcher, the checkout address or proxy.ts from their location) when it's
 * an active currency, else the default. Reads cookies: Server Actions and
 * request-time pages only.
 */
export async function getRequestCurrency(): Promise<{
  currency: Currency | null;
  source: CurrencySource | null;
}> {
  const [store, currencies] = await Promise.all([cookies(), getCurrencies()]);
  const chosen = store.get(CURRENCY_COOKIE)?.value;
  const currency = resolveCurrency(currencies, chosen);
  const source = store.get(CURRENCY_SOURCE_COOKIE)?.value;
  return {
    currency,
    source: currency?.code === chosen && isCurrencySource(source) ? source : null,
  };
}
