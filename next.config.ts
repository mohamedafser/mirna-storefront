import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Catalogue images (Phase 6) are public Supabase Storage objects uploaded by
// mirna-admin; next/image resizes them. Only this project's public buckets.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storagePattern = supabaseUrl ? [new URL("/storage/v1/object/public/**", supabaseUrl)] : [];

// Every canonical URL, the sitemap and structured data are built from this.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL) {
  console.warn(
    "NEXT_PUBLIC_SITE_URL is not set: canonical URLs and the sitemap will point at localhost.",
  );
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Crawlers that get metadata in <head>, before the page. Browsers get it streamed,
  // which is faster, but into <body>, where Google ignores rel=canonical. This is
  // Next.js's default list (next/dist/shared/lib/router/utils/html-bots.js), which
  // setting this replaces, plus Googlebot, which it leaves out.
  htmlLimitedBots:
    /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  images: {
    remotePatterns: [
      ...storagePattern,
      // Customers' Google profile pictures (mirna-admin migration 047 allows only this host).
      new URL("https://*.googleusercontent.com/**"),
    ],
  },
  partialPrefetching: true,
  experimental: {
    // Root layout lives under app/[lang]; this renders unmatched URLs.
    globalNotFound: true,
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    // Browsers and crawlers that don't read the <link> tags ask for this path.
    return [{ source: "/favicon.ico", destination: "/icons/favicon-32.png" }];
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Always fetch the latest service worker; restrict what it can load.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
