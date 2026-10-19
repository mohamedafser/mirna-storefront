// Wishlist rules shared by the browser (guest wishlist) and the server
// (customer wishlist). A wishlist is only a list of product ids, newest
// first: names, prices and availability are always looked up again on the
// server.

import { isUuid } from "@/lib/utils/uuid";

/** Matches the wishlist_items cap (migration 028): keeps reads to one bounded query. */
export const MAX_WISHLIST_ITEMS = 100;

/**
 * Turns untrusted input (localStorage, a Server Action argument) into valid
 * ids: drops anything that isn't a lowercase UUID, removes duplicates (the
 * first occurrence wins, so the order is kept) and caps the length.
 */
export function sanitizeWishlist(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = new Set<string>();
  for (const id of input) {
    if (ids.size >= MAX_WISHLIST_ITEMS) break;
    if (isUuid(id)) ids.add(id);
  }
  return [...ids];
}

/**
 * The guest ids to add to an account wishlist on sign-in: those not already
 * saved, in the guest's order, limited to the room left. Merging twice adds
 * nothing the second time.
 */
export function idsToMerge(account: readonly string[], guest: readonly string[]): string[] {
  const saved = new Set(account);
  const room = Math.max(0, MAX_WISHLIST_ITEMS - saved.size);
  return sanitizeWishlist(guest)
    .filter((id) => !saved.has(id))
    .slice(0, room);
}
