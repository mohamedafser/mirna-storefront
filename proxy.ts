import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/config/i18n";
import { activeRegion } from "@/config/region";
import { matchAcceptLanguage } from "@/lib/i18n/negotiate";
import { updateSession } from "@/lib/supabase/proxy";

const ONE_YEAR = 60 * 60 * 24 * 365;

function preferredLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return matchAcceptLanguage(request.headers.get("accept-language")) ?? activeRegion.defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first] = pathname.split("/");

  // 1. Unprefixed URL (/, /products, …) → add the preferred locale.
  if (!isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }
  const locale = first;

  // 2. Refresh the Supabase session cookie (customer sign-in arrives in
  //    Phase 8; until then visitors are guests and this is a no-op). Route
  //    protection for /account etc. is added here in that phase.
  const { response } = await updateSession(request);

  // 3. Remember the language the visitor is browsing in.
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
  // Skip static assets, PWA files, metadata routes and image files.
  matcher: [
    "/((?!_next/static|_next/image|icons/|images/|sw\\.js|offline\\.html|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml)$).*)",
  ],
};
