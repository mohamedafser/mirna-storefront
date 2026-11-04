import "server-only";
import { cookies } from "next/headers";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { sanitizeLines, type CartLine } from "@/lib/cart/rules";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * What the Google sign-in needs to remember across the trip to Google. It is
 * kept in an httpOnly cookie, not the URL, so the callback URL stays fixed (and
 * easy to allow-list in Supabase) and nothing in it can be set from a link.
 */

export type OAuthOrigin = "login" | "signup";

export interface OAuthState {
  /** Where to go afterwards. Validated again on the way back. */
  next: unknown;
  /** The page to return to if it fails. */
  from: OAuthOrigin;
  /** This browser's guest cart, so a page like checkout sees it straight away. */
  cart: CartLine[];
}

const OAUTH_COOKIE = "mirna-oauth";
const OAUTH_MAX_AGE = 10 * 60; // seconds; about how long Supabase's sign-in state lasts
/** Browsers drop cookies over about 4 KB. */
const MAX_COOKIE_LENGTH = 3500;

/**
 * Built from NEXT_PUBLIC_SITE_URL, never from the request's Host header, so a
 * forged Host can't send the code elsewhere. Must be in Supabase → Auth → URL
 * Configuration → Redirect URLs.
 */
export function oauthCallbackUrl(locale: Locale): string {
  return new URL(localizedHref(locale, routes.authCallback), siteConfig.url).href;
}

export async function setOAuthState(state: OAuthState): Promise<void> {
  // A cart too big to carry still arrives: the browser merges it after the redirect.
  const withCart = JSON.stringify(state);
  const value =
    encodeURIComponent(withCart).length <= MAX_COOKIE_LENGTH
      ? withCart
      : JSON.stringify({ ...state, cart: [] });
  (await cookies()).set(OAUTH_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not strict: it must come back on the top-level redirect from Google.
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_MAX_AGE,
  });
}

/** Reads and clears it: it applies to one sign-in. */
export async function takeOAuthState(): Promise<OAuthState | null> {
  const store = await cookies();
  const value = store.get(OAUTH_COOKIE)?.value;
  if (!value) return null;
  store.delete(OAUTH_COOKIE);
  try {
    const parsed = JSON.parse(value) as Partial<OAuthState>;
    return {
      next: parsed.next,
      from: parsed.from === "signup" ? "signup" : "login",
      cart: sanitizeLines(parsed.cart),
    };
  } catch {
    return null;
  }
}

/**
 * Whether Google is switched on in Supabase. Without this check, clicking the
 * button before the Dashboard is set up lands on a page of raw JSON from
 * Supabase. If the check itself fails, sign-in goes ahead and reports any error.
 */
export async function isGoogleEnabled(): Promise<boolean> {
  const { url, anonKey } = getSupabaseEnv();
  try {
    const response = await fetch(new URL("/auth/v1/settings", url), {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return true;
    const settings = (await response.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return true;
  }
}
