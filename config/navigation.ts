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
  // Customer accounts (Phase 8). /account/* requires a signed-in customer.
  account: "/account",
  addresses: "/account/addresses",
  newAddress: "/account/addresses/new",
  editAddress: (id: string) => `/account/addresses/${encodeURIComponent(id)}/edit`,
  // Order history (Phase 14).
  orders: "/account/orders",
  order: (id: string) => `/account/orders/${encodeURIComponent(id)}`,
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  /** Route Handler that Supabase email links (confirm, reset) land on. */
  authConfirm: "/auth/confirm",
  cart: "/cart", // Phase 9: cart
  // Checkout (Phase 11): signed-in customers only.
  checkout: "/checkout",
  orderConfirmation: (id: string) => `/checkout/confirmation/${encodeURIComponent(id)}`,
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
