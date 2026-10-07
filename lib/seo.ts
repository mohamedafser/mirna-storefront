import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/config/i18n";
import { localizedHref } from "@/config/navigation";
import { toIntlLocale } from "@/lib/format";

/** Open Graph locale, e.g. "en_AE". */
export function openGraphLocale(locale: Locale): string {
  return toIntlLocale(locale).replace("-", "_");
}

// Placeholder share image (the brand mark) until real campaign imagery exists.
const DEFAULT_SHARE_IMAGE = { url: "/icons/icon-512.png", width: 512, height: 512 };

/**
 * Metadata for one page: title, description, canonical URL, hreflang
 * alternates for every locale, Open Graph and Twitter/X cards. `path` is
 * locale-less ("/about"; routes.product(slug) in Phase 6). Relative URLs
 * resolve against metadataBase (NEXT_PUBLIC_SITE_URL, root layout).
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
  return {
    // Only set when given: an explicit `title: undefined` would override the
    // layout's default title and leave the page with no <title> at all.
    ...(title ? { title } : {}),
    description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(locales.map((l) => [toIntlLocale(l), localizedHref(l, path)])),
        "x-default": localizedHref(defaultLocale, path),
      },
    },
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
      ...(image ? { images: [image.url] } : {}),
    },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}
