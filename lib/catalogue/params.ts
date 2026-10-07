import { compareAmounts, parseAmount } from "@/lib/money";

/**
 * Catalogue URL state. The URL is the single source of truth for search,
 * filters, sort and page, so refresh, sharing, bookmarks and back/forward all
 * work. Shared by Server Components (parsing) and Client Components (building
 * hrefs); it has no server-only imports.
 *
 *   /products?q=candle&category=home-fragrance&minPrice=50&maxPrice=500&sort=price-asc&page=2
 *   /categories/home-fragrance?sort=name-asc   (the category comes from the path)
 */

export const SORT_OPTIONS = ["newest", "price-asc", "price-desc", "name-asc", "name-desc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/**
 * There is no `featured` column, so the default order is deterministic:
 * newest first (products_active_created_at_idx), ties broken by id.
 */
export const DEFAULT_SORT: SortOption = "newest";

export const PAGE_SIZE = 20;
/** Guards against absurd offsets; far beyond any real catalogue size. */
const MAX_PAGE = 10_000;
const MAX_QUERY_LENGTH = 100;

export const PARAM = {
  q: "q",
  category: "category",
  minPrice: "minPrice",
  maxPrice: "maxPrice",
  sort: "sort",
  page: "page",
} as const;

export interface CatalogueState {
  /** Normalised search text ("" when absent). */
  q: string;
  /** Category slug from ?category= (null on /categories/[slug], whose path carries it). */
  category: string | null;
  /** Canonical decimal strings, validated with parseAmount(). */
  minPrice: string | null;
  maxPrice: string | null;
  sort: SortOption;
  page: number;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Trims, collapses whitespace and caps the length of a search term. SQL
 * LIKE / PostgREST wildcards, quotes and backslashes are dropped, so the
 * term shown to the visitor is exactly the one searched.
 */
export function normalizeSearch(raw: string): string {
  return raw
    .replace(/[%_*\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return value.length <= 200 && SLUG_PATTERN.test(value);
}

/**
 * Validates untrusted query parameters. Invalid values are dropped rather
 * than rejected with an error page: a bad `minPrice` or `page` falls back to
 * its default, and a reversed price range is swapped.
 */
export function parseCatalogueParams(params: RawSearchParams): CatalogueState {
  const sortParam = first(params[PARAM.sort]);
  const sort = (SORT_OPTIONS as readonly string[]).includes(sortParam)
    ? (sortParam as SortOption)
    : DEFAULT_SORT;

  const pageParam = first(params[PARAM.page]);
  const page = /^\d{1,6}$/.test(pageParam) ? Number(pageParam) : 1;

  const category = first(params[PARAM.category]).trim().toLowerCase();

  let minPrice = parseAmount(first(params[PARAM.minPrice]));
  let maxPrice = parseAmount(first(params[PARAM.maxPrice]));
  if (minPrice && maxPrice && compareAmounts(minPrice, maxPrice) > 0) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    q: normalizeSearch(first(params[PARAM.q])),
    category: isSlug(category) ? category : null,
    minPrice,
    maxPrice,
    sort,
    page: Math.min(Math.max(page, 1), MAX_PAGE),
  };
}

export function hasActiveFilters(state: CatalogueState): boolean {
  return Boolean(state.category || state.minPrice || state.maxPrice);
}

/**
 * href for a catalogue state. Defaults (page 1, default sort, empty values)
 * are omitted so equivalent states share one URL. Changing anything other
 * than the page should pass `page: 1` (the default when not given).
 */
export function catalogueHref(
  path: string,
  state: CatalogueState,
  changes: Partial<CatalogueState> = {},
): string {
  const next = { ...state, page: 1, ...changes };
  const search = new URLSearchParams();
  if (next.q) search.set(PARAM.q, next.q);
  if (next.category) search.set(PARAM.category, next.category);
  if (next.minPrice) search.set(PARAM.minPrice, next.minPrice);
  if (next.maxPrice) search.set(PARAM.maxPrice, next.maxPrice);
  if (next.sort !== DEFAULT_SORT) search.set(PARAM.sort, next.sort);
  if (next.page > 1) search.set(PARAM.page, String(next.page));
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
