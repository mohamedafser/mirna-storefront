import type { Locale } from "@/config/i18n";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { ProductCardData } from "@/types/domain";
import { ProductCard } from "./product-card";

/**
 * Responsive product grid: 1 column on very narrow phones, 2 on phones and
 * tablets, then 3 (beside the filter sidebar) or 4 (full width) on desktop.
 */
export function ProductGrid({
  products,
  locale,
  t,
  layout = "full",
  headingLevel,
  className,
}: {
  products: ProductCardData[];
  locale: Locale;
  t: Messages["catalogue"];
  /** "sidebar": the grid shares the row with the filter panel. */
  layout?: "full" | "sidebar";
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  return (
    <ul
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
            priority={index < 2}
          />
        </li>
      ))}
    </ul>
  );
}
