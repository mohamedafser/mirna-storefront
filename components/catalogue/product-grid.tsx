import type { Locale } from "@/config/i18n";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { ProductCardData } from "@/types/domain";
import { ProductCard } from "./product-card";
import { StaggerList } from "./stagger-list";

/**
 * Responsive product grid: 1 column on very narrow phones, 2 on phones and
 * tablets, then 3 (beside the filter sidebar) or 4 (full width) on desktop.
 * Cards rise and fade in, staggered, as they scroll into view (StaggerList).
 * The first `eager` photos load at once: a desktop row is up to 4 cards, and
 * any of them can be the page's Largest Contentful Paint.
 */
export function ProductGrid({
  products,
  locale,
  t,
  layout = "full",
  headingLevel,
  eager = 4,
  className,
}: {
  products: ProductCardData[];
  locale: Locale;
  t: Messages["catalogue"];
  /** "sidebar": the grid shares the row with the filter panel. */
  layout?: "full" | "sidebar";
  headingLevel?: "h2" | "h3" | "h4";
  /** How many photos to load at once (0 when the grid starts below the fold). */
  eager?: number;
  className?: string;
}) {
  return (
    <StaggerList
      className={cn(
        "grid grid-cols-1 gap-x-4 gap-y-10 min-[22rem]:grid-cols-2 sm:gap-x-6",
        layout === "full" ? "lg:grid-cols-4 lg:gap-x-10" : "lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {products.map((product, index) => (
        <li key={product.id} className="min-w-0">
          <ProductCard
            product={product}
            locale={locale}
            t={t}
            headingLevel={headingLevel}
            priority={index < eager}
          />
        </li>
      ))}
    </StaggerList>
  );
}
