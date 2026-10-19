"use client";

import { toIntlLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import type { CartItem } from "@/types/domain";

/** The line can be bought in the chosen quantity (checkout needs every line to). */
export function canCheckOut(item: CartItem): boolean {
  return item.available && item.quantity <= item.maxQuantity;
}

/**
 * Under a cart line whose quantity is more than can be ordered now (stock
 * went down after it was added): says how many are left, with a button that
 * lowers the line to that. Renders nothing otherwise.
 */
export function StockNote({
  item,
  disabled,
  onQuantity,
}: {
  item: CartItem;
  disabled: boolean;
  onQuantity: (quantity: number) => void;
}) {
  const { locale, messages } = useI18n();
  const t = messages.cart;
  if (!item.available || item.quantity <= item.maxQuantity) return null;
  const count = new Intl.NumberFormat(toIntlLocale(locale)).format(item.maxQuantity);
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-warning">
      {format(t.exceedsStock, { count })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onQuantity(item.maxQuantity)}
        className="font-medium text-foreground underline underline-offset-4 hover:opacity-70 disabled:opacity-50"
      >
        {format(t.reduceTo, { count })}
      </button>
    </p>
  );
}
