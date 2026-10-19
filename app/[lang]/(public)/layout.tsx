import { CartProvider } from "@/components/cart/cart-provider";
import { CurrencyProvider } from "@/components/currency/currency-provider";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";
import { getCurrencies } from "@/lib/currency/server";
import { getMessages } from "@/lib/i18n/server";

/**
 * Storefront chrome: skip link, header, main, footer. Later phases can add
 * sibling route groups (e.g. a minimal checkout layout) under app/[lang].
 */
export default async function PublicLayout({ children }: LayoutProps<"/[lang]">) {
  // Cached (the same for every visitor): the visitor's currency is picked on the client.
  const [messages, currencies] = await Promise.all([getMessages(), getCurrencies()]);
  return (
    // Currency, cart and wishlist state for the header, product cards and
    // pages, and the cart and wishlist pages.
    <CurrencyProvider currencies={currencies}>
      <CartProvider>
        <WishlistProvider>
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
        </WishlistProvider>
      </CartProvider>
    </CurrencyProvider>
  );
}
