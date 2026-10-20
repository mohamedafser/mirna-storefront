"use client";

import { Minus, Plus } from "lucide-react";
import { toIntlLocale } from "@/lib/format";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/cart/rules";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";

const stepButton =
  "inline-flex size-11 items-center justify-center transition-opacity hover:opacity-70 disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5";

/**
 * − value + control. The value is a live region so screen readers hear the
 * new quantity; the buttons stop at 1 and at `max` (what's in stock, at most
 * 99; removing is a separate action). A value above `max` can still be
 * lowered.
 */
export function QuantityStepper({
  value,
  onChange,
  label,
  max = MAX_QUANTITY,
  disabled = false,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  /** Accessible name of the group, e.g. "Quantity for Oud candle". */
  label: string;
  /** Highest value + reaches (stock); never above MAX_QUANTITY. */
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const { locale, messages } = useI18n();
  const t = messages.cart;
  const limit = Math.min(max, MAX_QUANTITY);
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex h-11 items-center border border-border", className)}
    >
      <button
        type="button"
        className={stepButton}
        aria-label={t.decrease}
        disabled={disabled || value <= MIN_QUANTITY}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-8 text-center text-sm tabular-nums">
        {new Intl.NumberFormat(toIntlLocale(locale)).format(value)}
      </output>
      <button
        type="button"
        className={stepButton}
        aria-label={t.increase}
        disabled={disabled || value >= limit}
        onClick={() => onChange(Math.min(value + 1, limit))}
      >
        <Plus aria-hidden />
      </button>
    </div>
  );
}
