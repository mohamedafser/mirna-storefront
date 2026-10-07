import type { Locale } from "./i18n";

/**
 * Storefront routes. Every page lives under a locale (/en/…, /ar/…); build
 * hrefs with these helpers instead of concatenating strings in components.
 */
export const routes = {
  home: "/",
  products: "/products",
  categories: "/categories",
  about: "/about",
  contact: "/contact",
  // Entry points reserved in the header; real pages arrive in later phases.
  account: "/account", // Phase 8: customer authentication
  cart: "/cart", // Phase 9: cart
  // Catalogue detail pages: categories since Phase 6, products in Phase 7.
  product: (slug: string) => `/products/${encodeURIComponent(slug)}`,
  category: (slug: string) => `/categories/${encodeURIComponent(slug)}`,
} as const;

/** Locale-prefixed href: localizedHref("ar", "/about") → "/ar/about". */
export function localizedHref(locale: Locale, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Keys into messages.nav. */
export type NavKey = "home" | "shop" | "categories" | "about" | "contact";

export const mainNav: ReadonlyArray<{ key: NavKey; href: string }> = [
  { key: "home", href: routes.home },
  { key: "shop", href: routes.products },
  { key: "categories", href: routes.categories },
  { key: "about", href: routes.about },
  { key: "contact", href: routes.contact },
];
