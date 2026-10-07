import { ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import type { Messages } from "@/lib/i18n/messages";
import type { ProductCardData } from "@/types/domain";
import { ProductPrice } from "./product-price";

/** next/image `sizes` for the catalogue grid (2 → 3 → 4 columns). */
export const PRODUCT_IMAGE_SIZES = "(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, 50vw";

/**
 * Product tile: image (or the neutral placeholder), category, name and
 * price. The whole card is one link to the product page (Phase 7), so it is
 * a single keyboard stop. No cart, wishlist or stock information.
 */
export function ProductCard({
  product,
  locale,
  t,
  headingLevel: Heading = "h3",
  priority = false,
}: {
  product: ProductCardData;
  locale: Locale;
  t: Messages["catalogue"];
  headingLevel?: "h2" | "h3";
  /** Preload the image (first row above the fold). */
  priority?: boolean;
}) {
  return (
    <article className="group">
      <Link
        href={localizedHref(locale, routes.product(product.slug))}
        className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-brand-soft">
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.alt ?? product.name}
              fill
              sizes={PRODUCT_IMAGE_SIZES}
              priority={priority}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageOff aria-hidden strokeWidth={1} className="size-8" />
              <span className="sr-only">{t.noImage}</span>
            </div>
          )}
          {product.compareAtPrice && (
            <Badge tone="primary" className="absolute start-3 top-3 bg-background">
              {t.sale}
            </Badge>
          )}
        </div>
        <div className="mt-4 px-1 text-center">
          {product.category && (
            <p className="caps truncate text-[0.625rem] text-muted-foreground">
              {product.category.name}
            </p>
          )}
          <Heading className="caps mt-1.5 line-clamp-2 text-[0.6875rem] leading-relaxed font-medium break-words">
            {product.name}
          </Heading>
          <ProductPrice product={product} locale={locale} t={t} className="mt-2" />
        </div>
      </Link>
    </article>
  );
}
