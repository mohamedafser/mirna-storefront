// Cart rules shared by the browser (guest cart) and the server (customer cart,
// pricing). A cart line is only a product id and a quantity: prices, names and
// availability are always looked up again on the server.

import { isUuid } from "@/lib/utils/uuid";

/** Matches the cart_items.quantity check constraint (1–99). */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;
/** Distinct products per cart (keeps pricing to one bounded query). */
export const MAX_CART_LINES = 50;

export interface CartLine {
  productId: string;
  quantity: number;
}

/** Product ids are compared as lowercase UUID strings everywhere. */
export const isProductId = isUuid;

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
 * lines: drops malformed entries, clamps quantities, merges duplicate
 * products and caps the number of lines.
 */
export function sanitizeLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  const byProduct = new Map<string, number>();
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) continue;
    const { productId, quantity } = entry as Record<string, unknown>;
    if (!isProductId(productId) || typeof quantity !== "number" || !Number.isFinite(quantity)) {
      continue;
    }
    const id = productId;
    if (!byProduct.has(id) && byProduct.size >= MAX_CART_LINES) continue;
    byProduct.set(id, clampQuantity((byProduct.get(id) ?? 0) + quantity));
  }
  return [...byProduct].map(([productId, quantity]) => ({ productId, quantity }));
}

export function countItems(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}
