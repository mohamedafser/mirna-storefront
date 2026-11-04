import type { Metadata, Viewport } from "next";
import { Montserrat, Nunito_Sans, Tajawal } from "next/font/google";
import { WhatsAppButton } from "@/components/contact/whatsapp-button";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { getDirection, locales } from "@/config/i18n";
import { siteConfig } from "@/config/site";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { openGraphLocale } from "@/lib/seo";
import { themeInitScript } from "@/lib/theme";
import "../globals.css";

// Editorial type system: Nunito Sans (body), Montserrat (uppercase display:
// headings, navigation, buttons) and Tajawal for Arabic, a geometric face
// that matches Montserrat's proportions.
const body = Nunito_Sans({ variable: "--font-body", subsets: ["latin"] });
const heading = Montserrat({ variable: "--font-heading", subsets: ["latin"] });
const arabic = Tajawal({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700"],
  // Four files that would otherwise be preloaded on every page, competing with
  // the LCP image on English pages, which never use them. Arabic pages still get
  // them straight from the CSS, with fallback text showing until they arrive.
  preload: false,
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  // Static pages get it at build time and crawlers at request time: set it for both.
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  return {
    metadataBase: siteConfig.url,
    title: { default: messages.site.title, template: `%s | ${messages.site.name}` },
    description: messages.site.description,
    applicationName: messages.site.name,
    appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
    formatDetection: { telephone: false, email: false, address: false },
    // Defaults for pages without pageMetadata() (lib/seo.ts), which replaces them.
    openGraph: {
      type: "website",
      siteName: messages.site.name,
      title: messages.site.title,
      description: messages.site.description,
      locale: openGraphLocale(locale),
      images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: messages.site.name }],
    },
    twitter: {
      card: "summary",
      title: messages.site.title,
      description: messages.site.description,
    },
    ...(googleVerification && { verification: { google: googleVerification } }),
    icons: {
      icon: [
        { url: "/icons/icon.svg", type: "image/svg+xml" },
        { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
        // Google Search shows a favicon whose size is a multiple of 48px.
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // enables env(safe-area-inset-*)
  // Matches --background in globals.css.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#170d0e" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${body.variable} ${heading.variable} ${arabic.variable} antialiased`}
      // globals.css sets smooth scrolling; this lets Next.js turn it off
      // during route transitions.
      data-scroll-behavior="smooth"
      // The inline script may set data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* Browser extensions add body attributes. */}
      <body className="min-h-dvh" suppressHydrationWarning>
        <I18nProvider locale={locale} messages={messages}>
          {children}
          {/* Every page, including error and not-found pages. */}
          <WhatsAppButton />
        </I18nProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
