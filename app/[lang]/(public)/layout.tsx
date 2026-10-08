import { CartProvider } from "@/components/cart/cart-provider";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { getMessages } from "@/lib/i18n/server";

/**
 * Storefront chrome: skip link, header, main, footer. Later phases can add
 * sibling route groups (e.g. a minimal checkout layout) under app/[lang].
 */
export default async function PublicLayout({ children }: LayoutProps<"/[lang]">) {
  const messages = await getMessages();
  return (
    // Cart state for the header count, product pages and the cart page.
    <CartProvider>
      <div className="flex min-h-dvh flex-col px-safe">
        <a
          href="#main"
          className="caps sr-only z-50 bg-primary text-xs px-5 py-3 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
        >
          {messages.common.skipToContent}
        </a>
        <Header />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer />
      </div>
    </CartProvider>
  );
}
