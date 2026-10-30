"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import {
  CURRENCY_COOKIE,
  CURRENCY_SOURCE_COOKIE,
  resolveCurrency,
  type Currency,
  type CurrencySource,
} from "@/lib/currency/money";

const ONE_YEAR = 60 * 60 * 24 * 365;

interface CurrencyContextValue {
  /** Active currencies, default first. */
  currencies: Currency[];
  /** The visitor's currency (null only if no currency is set up). */
  currency: Currency | null;
  /** Switches currency; the cart and request-time pages re-price in it. */
  setCurrency: (code: string, source?: CurrencySource) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// The cookie is the single source of truth (the server reads it in Server
// Actions and at checkout); this store just lets components re-render when it
// changes, in this tab or another.
const listeners = new Set<() => void>();

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab switched currency: its cookie is ours too.
  window.addEventListener("focus", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("focus", listener);
  };
}

/**
 * Currency state for the storefront. Pages stay static and cached: every
 * product carries its admin-set prices in each currency, and price components
 * pick the visitor's currency here, on the client. Before hydration (and for
 * crawlers) prices show in the default currency; the visitor's own currency
 * replaces it right after.
 */
export function CurrencyProvider({
  currencies,
  children,
}: {
  currencies: Currency[];
  children: ReactNode;
}) {
  const router = useRouter();
  const chosen = useSyncExternalStore(
    subscribe,
    () => readCookie(CURRENCY_COOKIE),
    () => null,
  );

  const setCurrency = useCallback(
    (code: string, source: CurrencySource = "user") => {
      if (!currencies.some((currency) => currency.code === code)) return;
      const options = `; path=/; max-age=${ONE_YEAR}; samesite=lax`;
      document.cookie = `${CURRENCY_COOKIE}=${code}${options}`;
      document.cookie = `${CURRENCY_SOURCE_COOKIE}=${source}${options}`;
      for (const listener of listeners) listener();
      // Request-time pages (checkout) price on the server: re-render them.
      router.refresh();
    },
    [currencies, router],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({ currencies, currency: resolveCurrency(currencies, chosen), setCurrency }),
    [currencies, chosen, setCurrency],
  );

  return <CurrencyContext value={value}>{children}</CurrencyContext>;
}

export function useCurrency(): CurrencyContextValue {
  const value = use(CurrencyContext);
  if (!value) throw new Error("useCurrency must be used within <CurrencyProvider>");
  return value;
}

const subscribeNever = () => () => {};

/**
 * The currency to DISPLAY prices in. Pages are cached for every visitor, so
 * the server renders the store's default currency; a component hydrating
 * after the provider already switched to the visitor's currency (content
 * inside <Suspense>) would otherwise render different text than the server
 * HTML. This returns the default while the component hydrates and the
 * visitor's currency right after (one extra render, no mismatch).
 *
 * For display only (prices, sale labels); logic that acts on the visitor's
 * currency (checkout, cart actions) uses useCurrency().
 */
export function useDisplayCurrency(): Currency | null {
  const { currencies, currency } = useCurrency();
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  // What the server rendered: no cookie → the default currency.
  return hydrated ? currency : resolveCurrency(currencies, null);
}

/**
 * Formats a decimal amount ("1.500") in a currency with the store's decimals
 * for it (cart, checkout).
 */
export function useFormatAmount(): (amount: string, currencyCode: string) => string {
  const { locale } = useI18n();
  const { currencies } = useCurrency();
  return (amount, currencyCode) =>
    formatPrice(
      amount as Intl.StringNumericLiteral,
      locale,
      currencyCode,
      currencies.find((currency) => currency.code === currencyCode)?.decimals,
    );
}

/** Key for "seen prices" (cart "price changed" hints): per currency, so switching isn't a change. */
export function seenPriceKey(currencyCode: string, lineKey: string): string {
  return `${currencyCode}|${lineKey}`;
}
