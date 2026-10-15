// Cart rules shared by the browser (guest cart) and the server (customer cart,
// pricing). A cart line is only a product id, a variant id (null for a simple
// product) and a quantity: prices, names and availability are always looked
// up again on the server.

import { isUuid } from "@/lib/utils/uuid";

/** Matches the cart_items.quantity check constraint (1–99). */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;
/** Distinct lines (products or variants) per cart (keeps pricing to bounded queries). */
export const MAX_CART_LINES = 50;

export interface CartLine {
  productId: string;
  /** The chosen variant of a product with variants; null for a simple product. */
  variantId: string | null;
  quantity: number;
}

/** Product and variant ids are compared as lowercase UUID strings everywhere. */
export const isProductId = isUuid;

/** null (simple product) or a variant id. */
export function isVariantRef(value: unknown): value is string | null {
  return value === null || isUuid(value);
}

/**
 * Identifies a line: the variant id for a variant, else the product id (ids
 * are UUIDs, so the two never collide). A product has one line per variant.
 */
export function lineKey(line: Pick<CartLine, "productId" | "variantId">): string {
  return line.variantId ?? line.productId;
}

export function isValidQuantity(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= MIN_QUANTITY &&
    (value as number) <= MAX_QUANTITY
  );
}

export function clampQuantity(value: number): number {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(value)));
}

/**
 * Turns untrusted input (localStorage, a Server Action argument) into valid
 * lines: drops malformed entries, clamps quantities, merges duplicate lines
 * and caps the number of lines. Lines saved before variants existed have no
 * `variantId` and are read as simple-product lines.
 */
export function sanitizeLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map<string, CartLine>();
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) continue;
    const { productId, variantId = null, quantity } = entry as Record<string, unknown>;
    if (
      !isProductId(productId) ||
      !isVariantRef(variantId) ||
      typeof quantity !== "number" ||
      !Number.isFinite(quantity)
    ) {
      continue;
    }
    const key = lineKey({ productId, variantId });
    const existing = byKey.get(key);
    if (!existing && byKey.size >= MAX_CART_LINES) continue;
    byKey.set(key, {
      productId,
      variantId,
      quantity: clampQuantity((existing?.quantity ?? 0) + quantity),
    });
  }
  return [...byKey.values()];
}

export function countItems(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}
