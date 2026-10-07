import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

// Served at /manifest.webmanifest and linked automatically by Next.js.
// Installation is optional: the storefront never prompts for it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: "Shop quality products online with Mirna, in English or Arabic.",
    // proxy.ts redirects / to the visitor's language (/en or /ar).
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // Matches the light --background token.
    background_color: "#fdf9f4",
    theme_color: siteConfig.themeColor,
    categories: ["shopping"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
