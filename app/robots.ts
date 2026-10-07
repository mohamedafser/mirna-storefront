import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

// Personal pages (account, cart) opt out with a noindex meta tag instead of a
// Disallow rule, so crawlers can still read that tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", siteConfig.url).href,
  };
}
