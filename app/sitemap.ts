import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { getActiveCategories, getActiveProductSlugs } from "@/lib/catalogue/queries";
import { toIntlLocale } from "@/lib/format";

// Public pages, each listed with its language alternates, plus every active
// category and product page.
const PAGES = [routes.home, routes.products, routes.categories, routes.about, routes.contact];

const absolute = (path: string) => new URL(path, siteConfig.url).href;

function entry(path: string): MetadataRoute.Sitemap[number] {
  return {
    url: absolute(localizedHref(defaultLocale, path)),
    alternates: {
      languages: Object.fromEntries(
        locales.map((locale) => [toIntlLocale(locale), absolute(localizedHref(locale, path))]),
      ),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let catalogue: string[] = [];
  try {
    const [categories, productSlugs] = await Promise.all([
      getActiveCategories(),
      getActiveProductSlugs(),
    ]);
    catalogue = [
      ...categories.map((category) => routes.category(category.slug)),
      ...productSlugs.map(routes.product),
    ];
  } catch {
    // The catalogue is unavailable: still serve the static pages.
  }
  return [...PAGES, ...catalogue].map(entry);
}
