import type { ProductCardData } from "@/types/domain";

/**
 * Recently viewed products, kept in this browser only (localStorage): a
 * snapshot of each product card, newest first. Never sent to the server.
 * Storage can be unavailable (private mode, blocked site data), so every
 * access is guarded and failures simply mean "nothing recorded".
 */
const STORAGE_KEY = "mirna:recently-viewed";
export const RECENTLY_VIEWED_MAX = 8;

function isCard(value: unknown): value is ProductCardData {
  if (!value || typeof value !== "object") return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.id === "string" &&
    typeof card.slug === "string" &&
    typeof card.name === "string" &&
    typeof card.price === "string" &&
    typeof card.currencyCode === "string"
  );
}

export function readRecentlyViewed(): ProductCardData[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isCard).slice(0, RECENTLY_VIEWED_MAX) : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(product: ProductCardData) {
  try {
    const rest = readRecentlyViewed().filter((item) => item.id !== product.id);
    const next = [product, ...rest].slice(0, RECENTLY_VIEWED_MAX);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable or full: skip recording.
  }
}

export function clearRecentlyViewed() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
