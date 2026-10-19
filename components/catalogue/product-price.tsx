"use client";

import { useCurrency } from "@/components/currency/currency-provider";
import { toIntlLocale } from "@/lib/format";
import { cardPrice, formatMinor, lookupPrice, type PriceRow } from "@/lib/currency/money";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";

/**
 * Price in the visitor's currency, from the admin-set prices (never
 * converted). A sale price is shown with the regular price struck through and
 * labelled for screen readers, so the discount isn't conveyed by colour
 * alone. Without a price in that currency it says so instead.
 *
 * With `variantId` it shows that variant's price (its own, else the
 * product's); without, the product's price, else "From" the lowest variant
 * price.
 */
export function ProductPrice({
  prices,
  variantId,
  size = "sm",
  align = "center",
  className,
}: {
  prices: readonly PriceRow[];
  variantId?: string | null;
  /** "lg" on the product page, "sm" on cards. */
  size?: "sm" | "lg";
  align?: "center" | "start";
  className?: string;
}) {
  const { locale, messages } = useI18n();
  const t = messages.catalogue;
  const { currency } = useCurrency();
  const text = size === "lg" ? "text-xl" : "text-sm";

  // `?? []`: "Recently viewed" snapshots saved before prices existed have none.
  const rows = prices ?? [];
  const found = !currency
    ? null
    : variantId
      ? lookupPrice(rows, currency.code, variantId)
      : cardPrice(rows, currency.code);
  if (!currency || !found) {
    return (
      <p
        className={cn(size === "lg" ? "text-base" : "text-xs", "text-muted-foreground", className)}
      >
        {format(t.notAvailableIn, { currency: currency?.code ?? "" })}
      </p>
    );
  }

  const money = (minor: number) => formatMinor(minor, currency, toIntlLocale(locale));
  const pays = money(found.salePrice ?? found.price);
  const label =
    "from" in found && found.from ? format(messages.product.priceFrom, { price: pays }) : pays;
  if (found.salePrice === null) {
    return <p className={cn(text, className)}>{label}</p>;
  }
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
        <span className="font-semibold">{label}</span>
      </span>
      <span className="text-muted-foreground">
        <span className="sr-only">{t.originalPrice}: </span>
        <del className={size === "lg" ? "text-base" : "text-xs"}>{money(found.price)}</del>
      </span>
    </p>
  );
}
