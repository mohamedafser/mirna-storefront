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
 * new quantity; the buttons stop at 1 and 99 (removing is a separate action).
 */
export function QuantityStepper({
  value,
  onChange,
  label,
  disabled = false,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  /** Accessible name of the group, e.g. "Quantity for Oud candle". */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const { locale, messages } = useI18n();
  const t = messages.cart;
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
        disabled={disabled || value >= MAX_QUANTITY}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden />
      </button>
    </div>
  );
}
