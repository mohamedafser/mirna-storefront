import type { MetadataRoute } from "next";
import { locales } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { getActiveCategories, getActiveProducts } from "@/lib/catalogue/queries";
import { absoluteUrl, hreflangAlternates } from "@/lib/seo";

// An allow-list: only public, indexable pages. Everything else (sign-in, cart,
// checkout, account) is left out by not being here, and is noindex as well.
const PAGES = [routes.home, routes.products, routes.categories, routes.about, routes.contact];

interface Page {
  path: string;
  /** Only where the date is real: a made-up one teaches Google to ignore the field. */
  lastModified?: string;
}

/** One <url> per language: Google needs each version listed with all its alternates. */
function entries({ path, lastModified }: Page): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    Object.entries(hreflangAlternates(path)).map(([lang, href]) => [lang, absoluteUrl(href)]),
  );
  return locales.map((locale) => ({
    url: absoluteUrl(localizedHref(locale, path)),
    ...(lastModified && { lastModified }),
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let catalogue: Page[] = [];
  try {
    const [categories, products] = await Promise.all([getActiveCategories(), getActiveProducts()]);
    catalogue = [
      ...categories.map((category) => ({ path: routes.category(category.slug) })),
      ...products.map((product) => ({
        path: routes.product(product.slug),
        lastModified: product.updatedAt,
      })),
    ];
  } catch (error) {
    // The catalogue is unavailable: still serve the static pages.
    console.error("[sitemap] catalogue unavailable", error);
  }
  return [...PAGES.map((path) => ({ path })), ...catalogue].flatMap(entries);
}
