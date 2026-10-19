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
  themeColor: "#291113",
  // Contact details and social profiles are managed in mirna-admin
  // (Settings → Contact information) and read with getStoreContact().
  /**
   * Full-bleed homepage hero photograph, e.g. { src: "/images/hero.jpg",
   * alt: "…" } (file in public/images/). Until real campaign imagery exists
   * the hero shows a neutral tonal backdrop instead of stock photos.
   */
  heroImage: undefined as { src: string; alt: string } | undefined,
} as const;
