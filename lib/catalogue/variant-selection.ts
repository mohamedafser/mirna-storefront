// Variant selection on the product page. Pure functions (no React), so the
// matching rules are easy to reason about and test.

import { compareAmounts } from "@/lib/money";
import type { ProductOption, ProductVariant } from "@/types/domain";

/** attributeId → chosen attribute value id (missing = not chosen yet). */
export type Selection = Readonly<Record<string, string>>;

/** variantId → can at least one be ordered now. Missing ids count as unavailable. */
export type Availability = Readonly<Record<string, boolean>>;

/**
 * - available:   choosing it (with the other choices) gives an in-stock variant
 * - unavailable: it exists, but not in stock with the other current choices;
 *                still selectable (the other choices are adjusted)
 * - disabled:    no in-stock variant has this value at all
 */
export type ValueState = "available" | "unavailable" | "disabled";

const matches = (variant: ProductVariant, selection: Selection, except?: string) =>
  Object.entries(selection).every(
    ([attributeId, valueId]) => attributeId === except || variant.values[attributeId] === valueId,
  );

/**
 * The variant for a selection that has every required option, else null.
 * Optional options left unchosen (Fabric) match any value, so several
 * variants can match: the first one in stock is used.
 */
export function findVariant(
  options: readonly ProductOption[],
  variants: readonly ProductVariant[],
  selection: Selection,
  availability: Availability = {},
): ProductVariant | null {
  if (options.some((option) => option.required && !selection[option.attributeId])) return null;
  const matching = variants.filter((variant) => matches(variant, selection));
  return matching.find((variant) => availability[variant.id]) ?? matching[0] ?? null;
}

/** Required options that still need a value. */
export function missingOptions(
  options: readonly ProductOption[],
  selection: Selection,
): ProductOption[] {
  return options.filter((option) => option.required && !selection[option.attributeId]);
}

export function valueState(
  variants: readonly ProductVariant[],
  availability: Availability,
  selection: Selection,
  attributeId: string,
  valueId: string,
): ValueState {
  const withValue = variants.filter(
    (variant) => variant.values[attributeId] === valueId && availability[variant.id],
  );
  if (withValue.length === 0) return "disabled";
  return withValue.some((variant) => matches(variant, selection, attributeId))
    ? "available"
    : "unavailable";
}

/**
 * Chooses a value. When it doesn't combine with the other choices into an
 * in-stock variant, the in-stock variant with this value that keeps the most
 * of the other choices is used instead, and those choices change to match.
 */
export function selectValue(
  variants: readonly ProductVariant[],
  availability: Availability,
  selection: Selection,
  attributeId: string,
  valueId: string,
): Selection {
  const next = { ...selection, [attributeId]: valueId };
  const candidates = variants.filter(
    (variant) => variant.values[attributeId] === valueId && availability[variant.id],
  );
  if (candidates.length === 0 || candidates.some((variant) => matches(variant, next))) return next;

  const kept = (variant: ProductVariant) =>
    Object.entries(next).filter(([id, value]) => variant.values[id] === value).length;
  const best = candidates.reduce((a, b) => (kept(b) > kept(a) ? b : a));
  // Only the options the customer had already chosen change; others stay open.
  return Object.fromEntries(Object.keys(next).map((id) => [id, best.values[id]]));
}

/** Lowest and highest price over the variants (decimal strings). */
export function priceRange(
  variants: readonly ProductVariant[],
): { min: string; max: string } | null {
  if (variants.length === 0) return null;
  let min = variants[0].price;
  let max = variants[0].price;
  for (const { price } of variants) {
    if (compareAmounts(price, min) < 0) min = price;
    if (compareAmounts(price, max) > 0) max = price;
  }
  return { min, max };
}
