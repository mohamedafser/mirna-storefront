import { sanitizeWishlist } from "./rules";

/**
 * Browser storage for the guest wishlist: product ids only, newest first.
 * Every access is wrapped in try/catch (private mode, blocked storage) and
 * the contents are re-validated on read, because anything in localStorage
 * can be edited by hand.
 */
export const WISHLIST_STORAGE_KEY = "mirna-wishlist-v1";

export function readGuestWishlist(): string[] {
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    return sanitizeWishlist(raw ? JSON.parse(raw) : null);
  } catch {
    return [];
  }
}

export function writeGuestWishlist(ids: readonly string[]): void {
  try {
    if (ids.length === 0) window.localStorage.removeItem(WISHLIST_STORAGE_KEY);
    else window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage full or blocked: the wishlist still works for this page view.
  }
}
