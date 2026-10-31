import { NextResponse, type NextRequest } from "next/server";
import { currencyForCountry } from "@/config/currency";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/config/i18n";
import { activeRegion } from "@/config/region";
import { localizedHref, routes } from "@/config/navigation";
import { REDIRECT_PARAM } from "@/lib/auth/redirect";
import { CURRENCY_COOKIE, CURRENCY_SOURCE_COOKIE } from "@/lib/currency/money";
import { matchAcceptLanguage } from "@/lib/i18n/negotiate";
import { redirectPreservingSession, updateSession } from "@/lib/supabase/proxy";

const ONE_YEAR = 60 * 60 * 24 * 365;

// First path segment after the locale ("/en/account/…" → "account").
const PROTECTED_SECTIONS = new Set([routes.account.slice(1), routes.checkout.slice(1)]);
// Pages under a protected section that guests may open: the wishlist shows
// the browser's saved items and offers to sign in.
const PUBLIC_PAGES = new Set<string>([routes.wishlist]);
// Sign-in pages a signed-in visitor doesn't need (sent to their account).
const GUEST_ONLY_SECTIONS = new Set([routes.login.slice(1), routes.signup.slice(1)]);

function preferredLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return matchAcceptLanguage(request.headers.get("accept-language")) ?? activeRegion.defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first, section] = pathname.split("/");

  // 1. Unprefixed URL (/, /products, …) → add the preferred locale.
  if (!isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }
  const locale = first;

  // 2. Refresh the Supabase session cookie (no network call for guests).
  const { response, userId } = await updateSession(request);

  // 3. Optimistic auth redirects. The role/status check happens server-side
  //    in the DAL (lib/auth/dal.ts); this only checks for a session.
  const page = pathname.slice(locale.length + 1).replace(/\/$/, "");
  if (PROTECTED_SECTIONS.has(section) && !PUBLIC_PAGES.has(page) && !userId) {
    const url = new URL(localizedHref(locale, routes.login), request.url);
    // Remember the page they wanted (validated again after sign-in).
    url.searchParams.set(REDIRECT_PARAM, pathname + request.nextUrl.search);
    return redirectPreservingSession(response, url);
  }
  if (GUEST_ONLY_SECTIONS.has(section) && userId) {
    return redirectPreservingSession(
      response,
      new URL(localizedHref(locale, routes.account), request.url),
    );
  }

  // 4. First visit: prices in the currency of the visitor's country (from the
  //    host's IP geolocation header), when the store ships there. Otherwise
  //    no cookie, and the default currency applies. A currency picked in the
  //    header, or from the delivery address at checkout, replaces this one.
  if (!request.cookies.has(CURRENCY_COOKIE)) {
    const country =
      request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry");
    const currency = currencyForCountry(country);
    if (currency) {
      const options = { path: "/", maxAge: ONE_YEAR, sameSite: "lax" } as const;
      response.cookies.set(CURRENCY_COOKIE, currency, options);
      response.cookies.set(CURRENCY_SOURCE_COOKIE, "geo", options);
    }
  }

  // 5. Remember the language the visitor is browsing in.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  // Skip static assets, PWA files, metadata routes, image files and Route
  // Handlers under /api (JSON endpoints: no locale redirect).
  matcher: [
    "/((?!api/|_next/static|_next/image|icons/|images/|sw\\.js|offline\\.html|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml)$).*)",
  ],
};
