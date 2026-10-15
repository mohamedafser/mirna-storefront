"use client";

import { useEffect, useState } from "react";
import { ProductCarousel } from "@/components/catalogue/product-carousel";
import { Container } from "@/components/ui/container";
import { useI18n } from "@/lib/i18n/client";
import { clearRecentlyViewed, readRecentlyViewed } from "@/lib/recently-viewed";
import type { ProductCardData } from "@/types/domain";

/**
 * "Recently viewed": the products this browser opened last (see
 * lib/recently-viewed.ts), as a full-width carousel section closing the page
 * (top border, centred title). Read after mount (the server can't know
 * them) and hidden while empty. On a product page `excludeId` leaves out the
 * product being viewed.
 */
export function RecentlyViewed({ excludeId }: { excludeId?: string } = {}) {
  const { messages } = useI18n();
  const t = messages.home.recent;
  const [products, setProducts] = useState<ProductCardData[]>([]);

  useEffect(() => {
    // Browser-only data: read once after hydration so server and client HTML match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProducts(readRecentlyViewed().filter((product) => product.id !== excludeId));
  }, [excludeId]);

  if (products.length === 0) return null;
  return (
    // Full-width 1px divider above, then 50px / 80px (desktop) of breathing room.
    <div className="border-t py-[3.125rem] lg:py-20">
      <Container size="wide">
        <ProductCarousel
          products={products}
          title={t.title}
          heading="plain"
          action={
            <button
              type="button"
              onClick={() => {
                clearRecentlyViewed();
                setProducts([]);
              }}
              className="caps cursor-pointer text-[0.625rem] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {t.clear}
            </button>
          }
        />
      </Container>
    </div>
  );
}
