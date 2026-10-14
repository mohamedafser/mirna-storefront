"use client";

import { useId, useState, type FormEvent } from "react";
import { buttonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeRegion } from "@/config/region";
import { catalogueHref, type CatalogueState } from "@/lib/catalogue/params";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { compareAmounts, parseAmount } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import { StateFields, useCatalogueNavigation, useUrlSyncedValue } from "./catalogue-navigation";

export interface CatalogueFiltersProps {
  /** Localised path of the current catalogue page. */
  path: string;
  state: CatalogueState;
  /** Called when a filter navigates (the mobile drawer closes itself). */
  onNavigate?: () => void;
}

/**
 * Price filter, used in the desktop sidebar and the mobile drawer. Categories
 * are chosen from the header menu, not here.
 */
export function CatalogueFilters({ path, state, onNavigate }: CatalogueFiltersProps) {
  return (
    <div className="grid gap-10">
      <PriceFilter path={path} state={state} onNavigate={onNavigate} />
    </div>
  );
}

function PriceFilter({
  path,
  state,
  onNavigate,
}: {
  path: string;
  state: CatalogueState;
  onNavigate?: () => void;
}) {
  const { messages } = useI18n();
  const t = messages.catalogue;
  const { navigate } = useCatalogueNavigation();
  const id = useId();
  const [min, setMin] = useUrlSyncedValue(state.minPrice ?? "");
  const [max, setMax] = useUrlSyncedValue(state.maxPrice ?? "");
  const [invalid, setInvalid] = useState<{ min: boolean; max: boolean }>({
    min: false,
    max: false,
  });
  const errorId = `${id}-error`;
  const hasPrice = Boolean(state.minPrice || state.maxPrice);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let minPrice = min.trim() ? parseAmount(min) : null;
    let maxPrice = max.trim() ? parseAmount(max) : null;
    const errors = { min: Boolean(min.trim()) && !minPrice, max: Boolean(max.trim()) && !maxPrice };
    setInvalid(errors);
    if (errors.min || errors.max) return;
    if (minPrice && maxPrice && compareAmounts(minPrice, maxPrice) > 0) {
      [minPrice, maxPrice] = [maxPrice, minPrice];
    }
    onNavigate?.();
    navigate(catalogueHref(path, state, { minPrice, maxPrice }));
  }

  const field = (key: "min" | "max", label: string, value: string, set: (v: string) => void) => (
    <div className="min-w-0 flex-1">
      <label htmlFor={`${id}-${key}`} className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </label>
      <Input
        id={`${id}-${key}`}
        name={key === "min" ? "minPrice" : "maxPrice"}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => set(event.target.value)}
        aria-invalid={invalid[key] || undefined}
        aria-describedby={invalid[key] ? errorId : undefined}
        className={cn("h-10", invalid[key] && "border-error")}
      />
    </div>
  );

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="caps text-[0.6875rem] font-medium">
        {format(t.priceRange, { currency: activeRegion.currencyCode })}
      </h2>
      <form action={path} onSubmit={apply} noValidate className="mt-4">
        <div className="flex items-end gap-3">
          {field("min", t.minPrice, min, setMin)}
          <span aria-hidden className="pb-2.5 text-muted-foreground">
            –
          </span>
          {field("max", t.maxPrice, max, setMax)}
        </div>
        {(invalid.min || invalid.max) && (
          <p id={errorId} role="alert" className="mt-2 text-xs text-error">
            {t.priceInvalid}
          </p>
        )}
        <StateFields state={state} omit={["minPrice", "maxPrice"]} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={buttonClassName({ size: "sm", className: "flex-1" })}>
            {t.apply}
          </button>
          {hasPrice && (
            <button
              type="button"
              onClick={() => {
                setInvalid({ min: false, max: false });
                onNavigate?.();
                navigate(catalogueHref(path, state, { minPrice: null, maxPrice: null }));
              }}
              className={buttonClassName({ size: "sm", variant: "outline", className: "flex-1" })}
            >
              {t.clearPrice}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
