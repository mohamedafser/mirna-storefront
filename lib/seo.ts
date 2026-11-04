import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/config/i18n";
import { localizedHref } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { toIntlLocale } from "@/lib/format";

/** Absolute URL on the public origin (NEXT_PUBLIC_SITE_URL). */
export function absoluteUrl(path: string): string {
  return new URL(path, siteConfig.url).href;
}

/** Open Graph locale, e.g. "en_AE". */
export function openGraphLocale(locale: Locale): string {
  return toIntlLocale(locale).replace("-", "_");
}

/**
 * hreflang values and their locale-prefixed URLs for one page, from
 * config/i18n.ts: adding a language there adds it here, and with one language
 * there are no tags at all.
 *
 * Language only ("ar", not "ar-AE"): each language has one URL, serving every
 * market the store ships to (prices follow the visitor's currency). "ar-AE"
 * would tell Google the page is for the UAE only, and send Arabic speakers in
 * Saudi Arabia or Kuwait to x-default, which is English.
 */
export function hreflangAlternates(path: string): Record<string, string> {
  if (locales.length < 2) return {};
  return {
    ...Object.fromEntries(locales.map((locale) => [locale, localizedHref(locale, path)])),
    "x-default": localizedHref(defaultLocale, path),
  };
}

// Placeholder share image (the brand mark) until real campaign imagery exists.
const DEFAULT_SHARE_IMAGE = { url: "/icons/icon-512.png", width: 512, height: 512 };

const INDEXED: Metadata["robots"] = {
  index: true,
  follow: true,
  // Lets Google show large product photos and full snippets in results.
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

const NOT_INDEXED: Metadata["robots"] = { index: false, follow: true };

/**
 * Metadata for one page: title, description, robots, Open Graph and Twitter/X
 * cards, and for an indexed page its canonical URL and hreflang alternates.
 * `path` is locale-less ("/about", routes.product(slug)). Relative URLs resolve
 * against metadataBase (NEXT_PUBLIC_SITE_URL, root layout).
 *
 * Next.js merges metadata shallowly, so the full openGraph/twitter objects
 * are built here rather than partially inherited from the layout.
 */
export function pageMetadata({
  locale,
  path,
  siteName,
  title,
  description,
  index = true,
  image,
}: {
  locale: Locale;
  path: string;
  siteName: string;
  /**
   * Page title, shown as "{title} | {siteName}" by the layout template.
   * Use { absolute } for a full title without the suffix (the home page).
   */
  title?: string | { absolute: string };
  description: string;
  /** false for utility pages (account, cart) that shouldn't be indexed. */
  index?: boolean;
  /** Share image (absolute URL), e.g. a product photo. Defaults to the brand mark. */
  image?: { url: string; alt: string };
}): Metadata {
  const url = localizedHref(locale, path);
  const shareTitle =
    typeof title === "object" ? title.absolute : title ? `${title} | ${siteName}` : siteName;
  const languages = hreflangAlternates(path);
  return {
    // Only set when given: an explicit `title: undefined` would override the
    // layout's default title and leave the page with no <title> at all.
    ...(title ? { title } : {}),
    description,
    robots: index ? INDEXED : NOT_INDEXED,
    // A page that asks not to be indexed has no canonical or language versions to declare.
    ...(index && { alternates: { canonical: url, languages } }),
    openGraph: {
      type: "website",
      siteName,
      title: shareTitle,
      description,
      url,
      locale: openGraphLocale(locale),
      alternateLocale: locales.filter((l) => l !== locale).map(openGraphLocale),
      images: [image ?? { ...DEFAULT_SHARE_IMAGE, alt: siteName }],
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: shareTitle,
      description,
      images: [image?.url ?? DEFAULT_SHARE_IMAGE.url],
    },
  };
}
