import type { Metadata, Viewport } from "next";
import { Montserrat, Nunito_Sans, Tajawal } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { getDirection, locales } from "@/config/i18n";
import { siteConfig } from "@/config/site";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getMessages } from "@/lib/i18n/server";
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
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();
  return {
    metadataBase: siteConfig.url,
    title: { default: messages.site.title, template: `%s | ${messages.site.name}` },
    description: messages.site.description,
    applicationName: messages.site.name,
    appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
    formatDetection: { telephone: false, email: false, address: false },
    icons: {
      icon: [
        { url: "/icons/icon.svg", type: "image/svg+xml" },
        { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
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
        </I18nProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
