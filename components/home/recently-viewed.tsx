"use client";

import { useEffect, useState } from "react";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { Container } from "@/components/ui/container";
import { useI18n } from "@/lib/i18n/client";
import { clearRecentlyViewed, readRecentlyViewed } from "@/lib/recently-viewed";
import type { ProductCardData } from "@/types/domain";

/**
 * Home page "Recently viewed": the products this browser opened last (see
 * lib/recently-viewed.ts), laid out like the category rows above it. Read
 * after mount (the server can't know them), and hidden while empty.
 */
export function RecentlyViewed() {
  const { locale, messages } = useI18n();
  const t = messages.home.recent;
  const [products, setProducts] = useState<ProductCardData[]>([]);

  useEffect(() => {
    // Browser-only data: read once after hydration so server and client HTML match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProducts(readRecentlyViewed());
  }, []);

  if (products.length === 0) return null;
  return (
    <section aria-labelledby="recent-title" className="pb-16 sm:pb-24">
      <Container size="wide">
        <div className="mb-6 flex items-end justify-between gap-4 border-b pb-3 sm:mb-8">
          <h2 id="recent-title" className="caps text-xs font-medium sm:text-[0.8125rem]">
            {t.title}
          </h2>
          <button
            type="button"
            onClick={() => {
              clearRecentlyViewed();
              setProducts([]);
            }}
            className="caps shrink-0 cursor-pointer text-[0.6875rem] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {t.clear}
          </button>
        </div>
        <ProductGrid products={products} locale={locale} t={messages.catalogue} headingLevel="h3" />
      </Container>
    </section>
  );
}
