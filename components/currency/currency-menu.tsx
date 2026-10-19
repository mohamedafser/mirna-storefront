"use client";

import { Check, Coins } from "lucide-react";
import { headerActionClassName } from "@/components/navigation/header-actions";
import { Dropdown, dropdownItemClassName } from "@/components/ui/dropdown";
import { currencyName } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";
import { useCurrency } from "./currency-provider";

/**
 * Header button (₹ INR) that opens a currency popover. The choice is saved in
 * a cookie and wins over the currency picked from the visitor's location or
 * delivery address. Hidden when the store sells in one currency only.
 */
export function CurrencyMenu() {
  const { messages } = useI18n();
  const { currencies, currency } = useCurrency();
  if (currencies.length < 2 || !currency) return null;

  return (
    <Dropdown
      label={messages.currency.label}
      triggerClassName={cn(headerActionClassName, "caps text-[0.6875rem] font-medium")}
      trigger={<span aria-hidden>{currency.code}</span>}
      panelClassName="w-64"
    >
      {(close) => <CurrencyOptions onChoose={close} />}
    </Dropdown>
  );
}

/** The currency list (header popover, mobile menu). */
export function CurrencyOptions({ onChoose }: { onChoose?: () => void }) {
  const { locale, messages } = useI18n();
  const { currencies, currency: current, setCurrency } = useCurrency();
  return (
    <ul aria-label={messages.currency.label} className="grid gap-0.5">
      {currencies.map((currency) => {
        const active = currency.code === current?.code;
        return (
          <li key={currency.code}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => {
                setCurrency(currency.code);
                onChoose?.();
              }}
              className={cn(dropdownItemClassName, active && "font-medium")}
            >
              <span aria-hidden className="w-9 shrink-0 text-xs text-muted-foreground" dir="ltr">
                {currency.symbol}
              </span>
              <span className="flex-1 text-start">
                {currencyName(currency.code, locale)}{" "}
                <span className="text-muted-foreground" dir="ltr">
                  ({currency.code})
                </span>
              </span>
              {active && <Check aria-hidden className="text-primary!" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Mobile menu section: label + the list. */
export function CurrencySwitcher() {
  const { messages } = useI18n();
  const { currencies } = useCurrency();
  if (currencies.length < 2) return null;
  return (
    <div>
      <p className="caps mb-3 flex items-center gap-2 text-[0.6875rem] font-medium">
        <Coins aria-hidden className="size-3.5" />
        {messages.currency.label}
      </p>
      <CurrencyOptions />
    </div>
  );
}
