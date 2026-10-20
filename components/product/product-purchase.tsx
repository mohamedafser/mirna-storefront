"use client";

import {
  createContext,
  use,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ProductPrice } from "@/components/catalogue/product-price";
import { useCurrency } from "@/components/currency/currency-provider";
import {
  findVariant,
  missingOptions,
  selectValue,
  valueState,
  type Availability,
  type Selection,
} from "@/lib/catalogue/variant-selection";
import { lookupPrice, formatMinor, payable, type PriceRow } from "@/lib/currency/money";
import { toIntlLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { ProductOption, ProductVariant } from "@/types/domain";

interface ProductPurchase {
  options: ProductOption[];
  variants: ProductVariant[];
  availability: Availability;
  selection: Selection;
  select: (attributeId: string, valueId: string) => void;
  /** The exact variant for a complete selection, else null. */
  variant: ProductVariant | null;
  /** Whether `variant` can be ordered now. */
  available: boolean;
  /** Units of `variant` that can be ordered now (0 without a complete choice). */
  maxQuantity: number;
  /** Options still to choose. */
  missing: ProductOption[];
  /** Image to show: the variant's, or the first matching variant's for a partial choice. */
  imageId: string | null;
  /** true after Add to cart was pressed with options missing: the picker shows errors. */
  showMissing: boolean;
  /** Shows the missing-option errors and moves focus to the first missing option. */
  revealMissing: () => void;
  /** The picker's container (used to focus a missing option). */
  pickerRef: RefObject<HTMLDivElement | null>;
}

const PurchaseContext = createContext<ProductPurchase | null>(null);

/**
 * Variant selection state for one product page, shared by the gallery (image),
 * price, option picker, SKU and Add to cart. Only rendered for products with
 * variants; for a simple product useProductPurchase() returns null.
 *
 * Every option is required: nothing is pre-selected, so the customer picks
 * each value (size, colour, length …) before the exact variant is known and
 * can be added. `stock` is the orderable units per variant from the server
 * (capped at the cart maximum); the server checks again when the line is
 * added and at checkout.
 */
export function ProductPurchaseProvider({
  options,
  variants,
  stock,
  children,
}: {
  options: ProductOption[];
  variants: ProductVariant[];
  stock: Readonly<Record<string, number>>;
  children: ReactNode;
}) {
  const availability = useMemo<Availability>(
    () => Object.fromEntries(Object.entries(stock).map(([id, units]) => [id, units > 0])),
    [stock],
  );
  const [selection, setSelection] = useState<Selection>({});
  const [showMissing, setShowMissing] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const value = useMemo<ProductPurchase>(() => {
    const variant = findVariant(options, variants, selection);
    // Nothing chosen yet: keep the product's primary image.
    const partial =
      Object.keys(selection).length > 0 &&
      variants.find(
        (candidate) =>
          candidate.imageId &&
          Object.entries(selection).every(([id, valueId]) => candidate.values[id] === valueId),
      );
    const missing = missingOptions(options, selection);
    return {
      options,
      variants,
      availability,
      selection,
      select: (attributeId, valueId) =>
        setSelection((current) =>
          selectValue(variants, availability, current, attributeId, valueId),
        ),
      variant,
      available: Boolean(variant && availability[variant.id]),
      maxQuantity: variant ? (stock[variant.id] ?? 0) : 0,
      missing,
      imageId: variant?.imageId ?? (partial ? partial.imageId : null),
      showMissing,
      revealMissing: () => {
        setShowMissing(true);
        const first = missing[0];
        pickerRef.current
          ?.querySelector<HTMLInputElement>(
            `[data-option="${first?.attributeId}"] input:not(:disabled)`,
          )
          ?.focus();
      },
      pickerRef,
    };
  }, [options, variants, availability, stock, selection, showMissing]);

  return <PurchaseContext value={value}>{children}</PurchaseContext>;
}

export function useProductPurchase(): ProductPurchase | null {
  return use(PurchaseContext);
}

/**
 * The price for the current choice, in the visitor's currency: the chosen
 * variant's price (and its regular price when on sale), else "From" the
 * lowest variant price when prices differ.
 */
export function VariantPrice({ prices }: { prices: readonly PriceRow[] }) {
  const purchase = useProductPurchase();
  if (!purchase) return null;
  const shown = purchase.variant ?? (purchase.variants.length === 1 ? purchase.variants[0] : null);
  // Without a choice: every purchasable variant's price ("From" when they differ).
  const rows = shown
    ? prices
    : prices.filter(
        (row) =>
          !row.variantId || purchase.variants.some((variant) => variant.id === row.variantId),
      );
  return (
    <ProductPrice
      prices={rows}
      variantId={shown?.id ?? null}
      size="lg"
      align="start"
      className="mt-5"
    />
  );
}

/**
 * "In stock" / "Sold out" for what the customer is looking at: the chosen
 * variant once every option is picked, else the product (for a product with
 * variants: whether any variant is in stock). A yes/no only, never stock
 * numbers; the server checks again when adding to the cart.
 */
export function ProductAvailability({ available }: { available: boolean }) {
  const { messages } = useI18n();
  const t = messages.product;
  const purchase = useProductPurchase();
  const inStock = purchase?.variant ? purchase.available : available;
  return (
    <p className="mt-4 flex items-center gap-2 text-xs">
      <span className="sr-only">{t.availability}: </span>
      <span
        aria-hidden
        className={cn("size-2 rounded-full", inStock ? "bg-success" : "bg-muted-foreground")}
      />
      <span className={inStock ? "text-success" : "text-muted-foreground"}>
        {inStock ? t.inStock : t.soldOut}
      </span>
    </p>
  );
}

/** The chosen variant's SKU, else the product's. */
export function VariantSku({ fallback }: { fallback: string }) {
  const purchase = useProductPurchase();
  return <>{purchase?.variant?.sku ?? fallback}</>;
}

/**
 * One radio group per option (native radios: arrow keys, labels and
 * announcements come from the browser). Colours are swatches with their name
 * as the accessible label. Values that can't be bought at all are disabled;
 * values that don't combine with the other choices stay selectable, are
 * struck through, and choosing one adjusts the other choices. After an
 * attempt to add with options missing, each missing group shows an error.
 */
export function VariantPicker({ prices }: { prices: readonly PriceRow[] }) {
  const { locale, messages } = useI18n();
  const { currency } = useCurrency();
  const t = messages.product;
  const purchase = useProductPurchase();
  const id = useId();
  if (!purchase || purchase.options.length === 0) return null;
  const { options, variants, availability, selection, select, variant, available } = purchase;
  const { showMissing, pickerRef } = purchase;

  const chosen = options
    .map((option) => option.values.find((value) => value.id === selection[option.attributeId]))
    .flatMap((value) => (value ? [value.label] : []));

  return (
    <div ref={pickerRef} className="mt-6 grid gap-6" role="group" aria-label={t.options}>
      {options.map((option) => {
        const current = option.values.find((value) => value.id === selection[option.attributeId]);
        const color = option.kind === "color";
        const error = showMissing && !current;
        const errorId = `${id}-${option.attributeId}-error`;
        return (
          <fieldset
            key={option.attributeId}
            data-option={option.attributeId}
            aria-describedby={error ? errorId : undefined}
            className="min-w-0"
          >
            <legend className={cn("caps text-[0.6875rem] font-medium", error && "text-error")}>
              {option.name}
              <span aria-hidden className="ms-0.5">
                *
              </span>
              {current && (
                <span className="ms-2 font-normal tracking-normal normal-case text-muted-foreground">
                  {current.label}
                </span>
              )}
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {option.values.map((value) => {
                const state = valueState(
                  variants,
                  availability,
                  selection,
                  option.attributeId,
                  value.id,
                );
                const muted = state !== "available";
                return (
                  <label
                    key={value.id}
                    title={color ? value.label : undefined}
                    className={cn(
                      "relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center border text-sm transition-colors select-none",
                      "hover:border-foreground has-[:checked]:border-foreground",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                      "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40 has-[:disabled]:hover:border-border",
                      color
                        ? "rounded-full p-1"
                        : "px-4 has-[:checked]:bg-foreground has-[:checked]:text-background",
                      muted && !color && "text-muted-foreground line-through",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${id}-${option.attributeId}`}
                      value={value.id}
                      checked={current?.id === value.id}
                      disabled={state === "disabled"}
                      onChange={() => select(option.attributeId, value.id)}
                      className="sr-only"
                    />
                    {color ? (
                      <>
                        <span
                          aria-hidden
                          className="relative block size-8 overflow-hidden rounded-full border border-black/10"
                          style={{ backgroundColor: value.colorHex ?? undefined }}
                        >
                          {muted && (
                            // Diagonal strike, so "unavailable" isn't shown by colour alone.
                            <span className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-foreground" />
                          )}
                        </span>
                        <span className="sr-only">{value.label}</span>
                      </>
                    ) : (
                      value.label
                    )}
                    {muted && (
                      <span className="sr-only">
                        {`, ${state === "disabled" ? t.soldOut : t.notAvailableWith}`}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {error && (
              <p id={errorId} className="mt-2 text-xs text-error">
                {format(t.chooseOption, { name: option.name })}
              </p>
            )}
          </fieldset>
        );
      })}

      <p aria-live="polite" className="text-xs text-muted-foreground empty:hidden">
        {variant &&
          format(t.selectionStatus, {
            options: chosen.join(" / "),
            price: (() => {
              const found = currency && lookupPrice(prices, currency.code, variant.id);
              return found && currency
                ? formatMinor(payable(found), currency, toIntlLocale(locale))
                : format(messages.catalogue.notAvailableIn, { currency: currency?.code ?? "" });
            })(),
            status: available ? t.inStock : t.soldOut,
          })}
      </p>
    </div>
  );
}
