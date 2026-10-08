import { sanitizeLines, type CartLine } from "./rules";

/**
 * Browser storage for the guest cart. Only product ids and quantities are
 * kept: never prices, names or anything personal. Every access is wrapped in
 * try/catch (private mode, blocked storage) and the contents are re-validated
 * on read, because anything in localStorage can be edited by hand.
 */
const CART_KEY = "mirna-cart-v1";
/** Last price the visitor saw per product: only used to say "price changed". */
const SEEN_PRICES_KEY = "mirna-cart-seen-prices-v1";

export const CART_STORAGE_KEY = CART_KEY;

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the cart still works for this page view.
  }
}

export function readGuestCart(): CartLine[] {
  return sanitizeLines(read(CART_KEY));
}

export function writeGuestCart(lines: readonly CartLine[]): void {
  write(CART_KEY, lines.length > 0 ? lines : null);
}

export function readSeenPrices(): Record<string, string> {
  const value = read(SEEN_PRICES_KEY);
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && /^\d+(\.\d+)?$/.test(entry[1]),
    ),
  );
}

export function writeSeenPrices(prices: Record<string, string>): void {
  write(SEEN_PRICES_KEY, Object.keys(prices).length > 0 ? prices : null);
}

/**
 * Cheap "is someone signed in?" hint from the Supabase session cookie
 * (sb-<project>-auth-token, possibly chunked as .0, .1…). It only decides when
 * to ask the server; the server verifies the session itself.
 */
export function hasSessionCookie(): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(document.cookie);
}

export function rememberPrice(productId: string, price: string): void {
  writeSeenPrices({ ...readSeenPrices(), [productId]: price });
}
