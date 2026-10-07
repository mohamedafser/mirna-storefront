import type { Locale } from "@/config/i18n";
import { formatPrice } from "@/lib/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { ProductCardData } from "@/types/domain";

/**
 * Price in the product's own currency (formatPrice, never a hard-coded
 * "AED"). A compare-at price, when set, is struck through and labelled for
 * screen readers, so the discount is not conveyed by colour alone.
 */
export function ProductPrice({
  product,
  locale,
  t,
  size = "sm",
  align = "center",
  className,
}: {
  product: Pick<ProductCardData, "price" | "compareAtPrice" | "currencyCode">;
  locale: Locale;
  t: Messages["catalogue"];
  /** "lg" on the product page, "sm" on cards. */
  size?: "sm" | "lg";
  align?: "center" | "start";
  className?: string;
}) {
  const text = size === "lg" ? "text-xl" : "text-sm";
  // Values are NUMERIC decimal strings; Intl formats them exactly.
  const price = formatPrice(
    product.price as Intl.StringNumericLiteral,
    locale,
    product.currencyCode,
  );
  if (!product.compareAtPrice) {
    return <p className={cn(text, className)}>{price}</p>;
  }
  const original = formatPrice(
    product.compareAtPrice as Intl.StringNumericLiteral,
    locale,
    product.currencyCode,
  );
  return (
    <p
      className={cn(
        "flex flex-wrap items-baseline gap-x-2.5",
        align === "center" ? "justify-center" : "justify-start",
        text,
        className,
      )}
    >
      <span>
        <span className="sr-only">{t.salePrice}: </span>
        <span className="font-semibold">{price}</span>
      </span>
      <span className="text-muted-foreground">
        <span className="sr-only">{t.originalPrice}: </span>
        <del className={size === "lg" ? "text-base" : "text-xs"}>{original}</del>
      </span>
    </p>
  );
}
