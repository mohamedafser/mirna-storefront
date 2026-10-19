import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ShareButton } from "@/components/product/share-button";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import type { Messages } from "@/lib/i18n/messages";
import type { ProductCardData } from "@/types/domain";
import { ProductPrice } from "./product-price";
import { ImagePlaceholder } from "./image-placeholder";
import { ProductCardImage } from "./product-card-image";

/** next/image `sizes` for the catalogue grid (2 → 3 → 4 columns). */
export const PRODUCT_IMAGE_SIZES = "(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, 50vw";

/**
 * Product tile: image (or the neutral placeholder), category, name and
 * price. The card is one link to the product page (Phase 7); the wishlist
 * heart and the share button sit over the image's top corner as siblings of
 * that link (never nested inside it), so each is its own keyboard stop. No
 * cart or stock information.
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
  headingLevel?: "h2" | "h3" | "h4";
  /** Preload the image (first row above the fold). */
  priority?: boolean;
}) {
  return (
    <article className="group relative">
      <Link
        href={localizedHref(locale, routes.product(product.slug))}
        className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-brand-soft">
          {product.image ? (
            <ProductCardImage
              image={product.image}
              hoverImage={product.hoverImage}
              name={product.name}
              sizes={PRODUCT_IMAGE_SIZES}
              priority={priority}
            />
          ) : (
            <ImagePlaceholder label={t.noImage} />
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
          <Heading className="caps mt-1.5 line-clamp-2 text-[0.6875rem] leading-relaxed font-medium break-words decoration-1 underline-offset-4 group-hover:underline">
            {product.name}
          </Heading>
          <ProductPrice prices={product.prices} className="mt-2" />
        </div>
      </Link>
      {/* Siblings of the card link (never nested in it): their own keyboard stops. */}
      <div className="absolute end-2 top-2 flex flex-col items-end gap-2">
        <WishlistButton productId={product.id} productName={product.name} />
        <ShareButton slug={product.slug} name={product.name} />
      </div>
    </article>
  );
}
