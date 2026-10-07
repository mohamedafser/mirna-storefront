/**
 * Storefront identity and public URLs — the single source for metadata,
 * the manifest, the footer and SEO helpers. Localised copy (tagline,
 * description) lives in messages/<locale>.json under `site`.
 */

/** Canonical origin, e.g. https://shop.example.com (no trailing slash). */
function resolveSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    if (configured) return new URL(configured);
  } catch {
    // Fall through to the local default on a malformed value.
  }
  return new URL("http://localhost:3006");
}

export const siteConfig = {
  name: "Mirna",
  url: resolveSiteUrl(),
  /** Brand colour (light --foreground) for the manifest and browser UI. */
  themeColor: "#1c1b1b",
  /**
   * Public contact channels and social profiles. Left empty until the business
   * provides real ones: the footer and Contact page show a "coming soon" note
   * instead of inventing details.
   */
  contact: {
    email: undefined as string | undefined,
    phone: undefined as string | undefined,
  },
  social: [] as ReadonlyArray<{ name: string; href: string }>,
  /**
   * Full-bleed homepage hero photograph, e.g. { src: "/images/hero.jpg",
   * alt: "…" } (file in public/images/). Until real campaign imagery exists
   * the hero shows a neutral tonal backdrop instead of stock photos.
   */
  heroImage: undefined as { src: string; alt: string } | undefined,
} as const;
