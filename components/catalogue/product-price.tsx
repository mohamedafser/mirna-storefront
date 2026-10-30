"use client";

import { useDisplayCurrency } from "@/components/currency/currency-provider";
import { Badge } from "@/components/ui/badge";
import { toIntlLocale } from "@/lib/format";
import {
  cardPrice,
  formatMinor,
  lookupPrice,
  percentOff,
  type PriceRow,
} from "@/lib/currency/money";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";

/**
 * Price in the visitor's currency, from the admin-set prices (never
 * converted). A sale price is shown with the regular price struck through and
 * labelled for screen readers, so the discount isn't conveyed by colour
 * alone, followed by the percentage off ("25% off", rounded down). Without a price in that currency it says so instead.
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
  // The server's currency while hydrating, then the visitor's (no mismatch).
  const currency = useDisplayCurrency();
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
      <SaleChip percent={percentOff(found)} size={size} />
    </p>
  );
}

/** Shared look: whole percent, shown and read as "25% off". */
export function usePercentText() {
  const { locale, messages } = useI18n();
  const t = messages.catalogue;
  return (percent: number) => {
    const value = new Intl.NumberFormat(toIntlLocale(locale), {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(percent / 100);
    return {
      visible: format(t.percentOff, { percent: value }),
      spoken: format(t.percentOffLabel, { percent: value }),
    };
  };
}

function SaleChip({ percent, size }: { percent: number | null; size: "sm" | "lg" }) {
  const text = usePercentText();
  if (percent === null) return null;
  const { visible, spoken } = text(percent);
  return (
    <Badge tone="primary" className={cn("self-center tabular-nums", size === "lg" && "text-xs")}>
      <span aria-hidden>{visible}</span>
      <span className="sr-only">{spoken}</span>
    </Badge>
  );
}
