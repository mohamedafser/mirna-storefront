"use client";

import { useDisplayCurrency } from "@/components/currency/currency-provider";
import { Badge } from "@/components/ui/badge";
import { bestPercentOff, type PriceRow } from "@/lib/currency/money";
import { usePercentText } from "./product-price";

/**
 * The sale label over a product image, in the visitor's currency: the
 * percentage off ("25% off") of its prices that have a sale price (the
 * biggest, if its variants differ). Nothing when no price in that currency
 * is on sale. A list item of ImageTags.
 */
export function SaleBadge({ prices }: { prices: readonly PriceRow[] }) {
  // The server's currency while hydrating, then the visitor's (no mismatch).
  const currency = useDisplayCurrency();
  const text = usePercentText();
  const percent = currency ? bestPercentOff(prices ?? [], currency.code) : null;
  if (percent === null) return null;
  const { visible, spoken } = text(percent);
  return (
    <li>
      <Badge tone="primary" className="bg-background tabular-nums">
        <span aria-hidden>{visible}</span>
        <span className="sr-only">{spoken}</span>
      </Badge>
    </li>
  );
}
