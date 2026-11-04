import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

// Sign-in, account, cart and checkout pages opt out with a noindex meta tag, not
// a Disallow rule: a crawler that may not fetch a page can't read that tag, and
// the URL can still be indexed from links to it. Disallow only covers endpoints
// that aren't pages. Never block /_next/: Google needs it to render the site.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/*/auth/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
