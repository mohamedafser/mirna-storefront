import type { Locale } from "@/config/i18n";

/**
 * The current page in another locale: ("/en/about", "ar") → "/ar/about".
 * With no pathname (not yet known while streaming) it falls back to that
 * locale's home page.
 */
export function switchLocaleHref(pathname: string | null, locale: Locale): string {
  const rest = pathname?.split("/").slice(2).join("/");
  return `/${locale}${rest ? `/${rest}` : ""}`;
}
