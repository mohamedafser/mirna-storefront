import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { PriceRow } from "@/lib/currency/money";
import { hasCurrencyPrices, legacyPrices } from "@/lib/currency/server";
import { compareAmounts } from "@/lib/money";
import type {
  CatalogueCategory,
  CatalogueTag,
  NavCategory,
  ProductCardData,
  ProductDetail,
  ProductTaxonomy,
} from "@/types/domain";
import { normalizeSearch, PAGE_SIZE, type CatalogueState, type SortOption } from "./params";
import { lookupProductStock, lookupVariantStock, STOCK_TAG } from "./stock";
import {
  ATTRIBUTE_SELECT,
  ATTRIBUTE_VALUE_SELECT,
  buildOptions,
  buildSpecs,
  type ProductAttributeRow,
  type VariantRow,
} from "./variants";

/**
 * Public catalogue reads. Every query:
 * - runs as `anon` through the cookie-less client, so RLS (owned by
 *   mirna-admin) only returns active categories, active products and those
 *   products' images; the explicit `is_active = true` filters say the same
 *   thing in the query itself;
 * - selects only card fields: no inventory, SKU, description or admin data;
 * - filters, sorts and paginates in PostgreSQL, never in JavaScript;
 * - is cached for every visitor ("use cache", short lifetime) because the
 *   result does not depend on who is asking. mirna-admin cannot revalidate
 *   this app's cache, so admin changes appear within the `minutes` profile
 *   (about a minute). The `catalogue` tag is ready for on-demand revalidation.
 *
 * Errors are logged server-side and rethrown as a generic error; the error
 * boundary shows a friendly message and never the database details.
 */

const CATALOGUE_TAG = "catalogue";

/**
 * A product's admin-set prices in every currency (mirna-admin 031; RLS: active
 * products, variants and currencies only). The visitor's currency is picked
 * on the client (components/currency), so these cached results stay the same
 * for everyone.
 */
export const PRICE_SELECT = "variant_id, currency_code, price, sale_price";

export interface PriceRowData {
  variant_id: string | null;
  currency_code: string;
  price: number;
  sale_price: number | null;
}

export function toPriceRows(rows: readonly PriceRowData[] | null | undefined): PriceRow[] {
  return (rows ?? []).map((row) => ({
    variantId: row.variant_id,
    currency: row.currency_code,
    price: row.price,
    salePrice: row.sale_price,
  }));
}

const PRODUCT_CARD_SELECT = `id, name, slug, price::text, compare_at_price::text, currency_code,
  category:categories(name, slug),
  images:product_images(public_url, storage_path, alt_text)`;

const SORT_COLUMNS: Record<SortOption, { column: string; ascending: boolean }> = {
  newest: { column: "created_at", ascending: false },
  "price-asc": { column: "price", ascending: true },
  "price-desc": { column: "price", ascending: false },
  "name-asc": { column: "name", ascending: true },
  "name-desc": { column: "name", ascending: false },
};

class CatalogueError extends Error {
  constructor() {
    super("The catalogue could not be loaded.");
    this.name = "CatalogueError";
  }
}

function fail(context: string, error: { code?: string; message?: string }): never {
  console.error(`[catalogue] ${context} failed`, error.code, error.message);
  throw new CatalogueError();
}

// Public Storage objects only (the buckets mirna-admin uploads to). Anything
// else falls back to the placeholder instead of breaking next/image, whose
// remotePatterns allow exactly this prefix (next.config.ts).
function storagePrefix(): string {
  return `${getSupabaseEnv().url.replace(/\/$/, "")}/storage/v1/object/public/`;
}

export function publicImageUrl(
  url: string | null | undefined,
  fallbackPath?: string,
): string | null {
  const prefix = storagePrefix();
  if (url?.startsWith(prefix)) return url;
  if (fallbackPath)
    return `${prefix}product-images/${fallbackPath.split("/").map(encodeURIComponent).join("/")}`;
  return null;
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  price: string;
  compare_at_price: string | null;
  currency_code: string;
  /** Absent before migration 031 (legacy prices). */
  prices?: PriceRowData[];
  category: { name: string; slug: string } | null;
  images: { public_url: string | null; storage_path: string; alt_text: string | null }[];
}

function toProductCard(row: ProductRow): ProductCardData {
  // The embedded images are already ordered primary-first, then sort_order.
  const [image, second] = row.images;
  const url = image ? publicImageUrl(image.public_url, image.storage_path) : null;
  const hoverUrl = second ? publicImageUrl(second.public_url, second.storage_path) : null;
  const compareAt = row.compare_at_price;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    // A discount is shown only when compare-at is strictly greater (the
    // database enforces this too); null, zero or lower values are ignored.
    compareAtPrice: compareAt && compareAmounts(compareAt, row.price) > 0 ? compareAt : null,
    currencyCode: row.currency_code,
    prices: row.prices
      ? toPriceRows(row.prices)
      : legacyPrices(row.currency_code, [
          { variantId: null, price: row.price, compareAt: row.compare_at_price },
        ]),
    category: row.category,
    image: url ? { url, alt: image.alt_text?.trim() || null } : null,
    hoverImage: url && hoverUrl ? { url: hoverUrl, alt: second.alt_text?.trim() || null } : null,
  };
}

/**
 * Two embedded images per product (card + hover): primary first, then lowest
 * sort_order. Optional filters, each an inner-joined embed (one request, each
 * product returned once however many of its rows match):
 * - `categoryIds`: listed in ANY of these categories, main or extra
 *   (product_categories, mirna-admin 027). `legacy` filters on the main
 *   category (products.category_id) instead: see withTaxonomyFallback.
 * - `tagIds`: has ANY of these tags (product_tags).
 */
function productCardQuery({
  withCount = false,
  categoryIds = null,
  tagIds = [],
  legacy = false,
  prices,
}: {
  withCount?: boolean;
  categoryIds?: readonly string[] | null;
  tagIds?: readonly string[];
  legacy?: boolean;
  /** Embed per-currency prices (once migration 031 exists: hasCurrencyPrices()). */
  prices: boolean;
}) {
  const joins = [
    prices ? `prices:product_prices(${PRICE_SELECT})` : null,
    categoryIds && !legacy ? "in_category:product_categories!inner(category_id)" : null,
    tagIds.length > 0 ? "with_tag:product_tags!inner(tag_id)" : null,
  ].filter(Boolean);
  let query = createPublicClient()
    .from("products")
    .select(
      [PRODUCT_CARD_SELECT, ...joins].join(",\n  ") as typeof PRODUCT_CARD_SELECT,
      withCount ? { count: "exact" } : undefined,
    )
    .eq("is_active", true)
    .order("is_primary", { referencedTable: "images", ascending: false })
    .order("sort_order", { referencedTable: "images", ascending: true })
    .limit(2, { referencedTable: "images" });
  if (categoryIds) {
    query = legacy
      ? query.in("category_id", categoryIds)
      : query.in("in_category.category_id", categoryIds);
  }
  if (tagIds.length > 0) query = query.in("with_tag.tag_id", tagIds);
  return query;
}

/**
 * The storefront reads product_categories / product_tags / tags only once
 * mirna-admin migration 029 grants it (draft in docs/proposed-migrations/).
 * Until then those reads are refused (42501), or the count function is
 * missing (PGRST202): category pages then fall back to the main category,
 * tags are simply not shown, and nothing else breaks.
 */
function isTaxonomyAccessError(error: { code?: string } | null): boolean {
  return error?.code === "42501" || error?.code === "PGRST202" || error?.code === "PGRST200";
}

/**
 * Runs a category-scoped query on product_categories, or (before 029) on the
 * main category. `run(legacy)` builds and awaits the query.
 */
async function withTaxonomyFallback<T extends { error: { code?: string } | null }>(
  run: (legacy: boolean) => PromiseLike<T>,
): Promise<T> {
  const result = await run(false);
  if (!isTaxonomyAccessError(result.error)) return result;
  console.warn(
    "[catalogue] product_categories not readable yet (migration 029): main category only",
  );
  return run(true);
}

/**
 * Adds each card's active tags (by name) in ONE extra request for the whole
 * list. Kept apart from the card query so that before migration 029, or if
 * tags can't be read, the cards still load, just without tags.
 */
async function withCardTags(cards: ProductCardData[]): Promise<ProductCardData[]> {
  if (cards.length === 0) return cards;
  const { data, error } = await createPublicClient()
    .from("product_tags")
    .select("product_id, tag:tags(name, slug)")
    .in(
      "product_id",
      cards.map((card) => card.id),
    );
  if (error) {
    if (!isTaxonomyAccessError(error)) console.error("[catalogue] card tags failed", error.code);
    return cards;
  }
  const byProduct = new Map<string, { name: string; slug: string }[]>();
  for (const row of data as unknown as {
    product_id: string;
    tag: { name: string; slug: string } | null;
  }[]) {
    if (!row.tag) continue;
    byProduct.set(row.product_id, [...(byProduct.get(row.product_id) ?? []), row.tag]);
  }
  return cards.map((card) => ({
    ...card,
    tags: (byProduct.get(card.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/**
 * Active categories in admin display order, each with its active product
 * count. One request: the count is an embedded aggregate, not N+1 queries.
 */
export async function getActiveCategories(): Promise<CatalogueCategory[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const supabase = createPublicClient();
  const [{ data, error }, counts] = await Promise.all([
    supabase
      .from("categories")
      // products(count): main-category counts, only used until migration 029.
      .select("id, name, slug, description, image_url, parent_id, products(count)")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      // Same sort order: the order they were created in (Women before Kids).
      .order("created_at", { ascending: true })
      .order("name", { ascending: true }),
    supabase.rpc("category_product_counts"),
  ]);
  if (error) fail("categories", error);

  if (!counts.error) {
    // Distinct products per category scope (main + extra categories).
    const byId = new Map(counts.data.map((row) => [row.category_id, row.product_count]));
    return data.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      imageUrl: publicImageUrl(row.image_url),
      productCount: byId.get(row.id) ?? 0,
      parentId: row.parent_id,
    }));
  }
  if (!isTaxonomyAccessError(counts.error)) fail("category counts", counts.error);

  const categories = data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: publicImageUrl(row.image_url),
    productCount: row.products[0]?.count ?? 0,
    parentId: row.parent_id,
  }));
  // Before 029: a parent's count adds its (active) subcategories' products.
  return categories.map((category) =>
    category.parentId
      ? category
      : {
          ...category,
          productCount: categories
            .filter((child) => child.parentId === category.id)
            .reduce((sum, child) => sum + child.productCount, category.productCount),
        },
  );
}

/**
 * Header navigation: top-level active categories in display order, each with
 * its active subcategories. Never throws: without the catalogue the header
 * simply shows no category links.
 */
export async function getNavCategories(): Promise<NavCategory[]> {
  let categories: CatalogueCategory[];
  try {
    categories = await getActiveCategories();
  } catch {
    return [];
  }
  return categories
    .filter((category) => !category.parentId)
    .map((category) => ({
      name: category.name,
      slug: category.slug,
      children: categories
        .filter((child) => child.parentId === category.id)
        .map((child) => ({ name: child.name, slug: child.slug })),
    }));
}

/**
 * Active tags that at least one active product has (RLS, migration 029), by
 * name. [] before 029 or if tags can't be read: the tag filter is then
 * simply not shown.
 */
export async function getActiveTags(): Promise<CatalogueTag[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const { data, error } = await createPublicClient()
    .from("tags")
    .select("id, name, slug, used:product_tags!inner(product_id)")
    .order("name", { ascending: true })
    .limit(1, { referencedTable: "used" })
    .limit(200);
  if (error) {
    if (!isTaxonomyAccessError(error)) console.error("[catalogue] tags failed", error.code);
    return [];
  }
  return data.map((row) => ({ id: row.id, name: row.name, slug: row.slug }));
}

/**
 * Active tag ids for ?tag= slugs. `unmatched` is true when tags were asked
 * for but none is an active tag: the listing is then empty (like an unknown
 * ?category=), rather than silently showing everything.
 */
export function resolveTags(
  tags: CatalogueTag[],
  slugs: readonly string[],
): { ids: string[]; unmatched: boolean } {
  const ids = tags
    .filter((tag) => slugs.includes(tag.slug))
    .map((tag) => tag.id)
    .sort();
  return { ids, unmatched: slugs.length > 0 && ids.length === 0 };
}

/**
 * The category ids a category's pages show products from: itself plus its
 * active subcategories (a subcategory just itself).
 */
export function categoryScope(categories: CatalogueCategory[], id: string): string[] {
  return [id, ...categories.filter((child) => child.parentId === id).map((child) => child.id)];
}

/** The newest active products in a category scope (home page category rows). */
export async function getCategoryProducts(
  categoryIds: string[],
  limit: number,
): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const prices = await hasCurrencyPrices();
  const { data, error } = await withTaxonomyFallback((legacy) =>
    productCardQuery({ categoryIds, legacy, prices })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(limit),
  );
  if (error) fail("category products", error);
  return withCardTags((data as ProductRow[]).map(toProductCard));
}

/**
 * "You may also like" for a product page: other active products from the
 * same category first, then from its parent category's scope, then the
 * newest products, up to `limit`. At most three small cached queries.
 */
export async function getRelatedProducts(
  productId: string,
  categorySlug: string | null,
  limit = 8,
): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const categories = categorySlug ? await getActiveCategories() : [];
  const category = categories.find((item) => item.slug === categorySlug);
  const scopes: (string[] | null)[] = [];
  if (category) {
    scopes.push([category.id]);
    if (category.parentId) scopes.push(categoryScope(categories, category.parentId));
  }
  scopes.push(null);

  const prices = await hasCurrencyPrices();
  const found: ProductCardData[] = [];
  for (const scope of scopes) {
    if (found.length >= limit) break;
    const exclude = `(${[productId, ...found.map((product) => product.id)].join(",")})`;
    const { data, error } = await withTaxonomyFallback((legacy) =>
      productCardQuery({ categoryIds: scope, legacy, prices })
        .not("id", "in", exclude)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(limit - found.length),
    );
    if (error) fail("related products", error);
    found.push(...(data as ProductRow[]).map(toProductCard));
  }
  return withCardTags(found);
}

/**
 * ILIKE pattern matching every word in order: "oud candle" → "%oud%candle%".
 * normalizeSearch() drops LIKE/PostgREST wildcards, quotes and backslashes;
 * the value is double-quoted in the filter, so commas and parentheses are safe.
 */
function searchPattern(q: string): string | null {
  const words = normalizeSearch(q).split(" ").filter(Boolean);
  return words.length > 0 ? `%${words.join("%")}%` : null;
}

export type ProductListing =
  | { status: "ok"; products: ProductCardData[]; total: number; page: number; pageCount: number }
  /** The requested page is past the last one for these filters. */
  | { status: "out-of-range"; page: number };

/**
 * One page of active products for a catalogue state, in ONE request (rows +
 * exact count). `categoryIds` is the resolved active category's scope
 * (categoryScope(); from ?category= or /categories/[slug]), or null for
 * every category; a product matches if ANY of its categories (main or extra)
 * is in it. `tagIds` are resolved active tags: a product matches if it has
 * ANY of them. `productIds` (resolveOptions(): attribute filters) limits the
 * listing to those products; `state.sale` to discounted ones (a compare-at
 * price in the product's own currency, like the price filter and sort).
 * Search covers the product name and slug; SKU is internal and not searched.
 */
export async function getProductListing(
  state: Omit<CatalogueState, "category" | "tags" | "options">,
  categoryIds: string[] | null,
  tagIds: string[] = [],
  productIds: string[] | null = null,
): Promise<ProductListing> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const from = (state.page - 1) * PAGE_SIZE;
  const pattern = searchPattern(state.q);
  const { column, ascending } = SORT_COLUMNS[state.sort];

  const prices = await hasCurrencyPrices();
  const { data, error, count } = await withTaxonomyFallback((legacy) => {
    let query = productCardQuery({ withCount: true, categoryIds, tagIds, legacy, prices });
    if (state.minPrice) query = query.gte("price", state.minPrice);
    if (state.maxPrice) query = query.lte("price", state.maxPrice);
    if (state.sale) query = query.not("compare_at_price", "is", null);
    if (productIds) query = query.in("id", productIds);
    if (pattern) query = query.or(`name.ilike."${pattern}",slug.ilike."${pattern}"`);
    return (
      query
        .order(column, { ascending })
        // Deterministic tie-break so pages never overlap or skip products.
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
    );
  });

  // PostgREST answers 416 / PGRST103 when the offset is past the last row.
  if (error?.code === "PGRST103") return { status: "out-of-range", page: state.page };
  if (error) fail("products", error);

  const total = count ?? 0;
  return {
    status: "ok",
    products: await withCardTags((data as ProductRow[]).map(toProductCard)),
    total,
    page: state.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// Attributes and variants (mirna-admin 023–025): RLS returns only active
// attributes, values and variants of this active product; never stock.
const PRODUCT_DETAIL_SELECT = `id, name, slug, sku, short_description, description,
  price::text, compare_at_price::text, currency_code, product_type_id,
  category:categories(name, slug),
  images:product_images(id, public_url, storage_path, alt_text),
  attributes:product_attributes(value_text, value_number::text, value_boolean,
    attribute:attributes(${ATTRIBUTE_SELECT}),
    value:attribute_values(${ATTRIBUTE_VALUE_SELECT})),
  variants:product_variants(id, sku, price::text, compare_at_price::text, image_id, sort_order,
    values:variant_attribute_values(
      attribute:attributes(${ATTRIBUTE_SELECT}),
      value:attribute_values(${ATTRIBUTE_VALUE_SELECT})))`;

interface ProductDetailRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  short_description: string | null;
  description: string | null;
  price: string;
  compare_at_price: string | null;
  currency_code: string;
  product_type_id: string | null;
  /** Absent before migration 031 (legacy prices). */
  prices?: PriceRowData[];
  category: { name: string; slug: string } | null;
  images: {
    id: string;
    public_url: string | null;
    storage_path: string;
    alt_text: string | null;
  }[];
  attributes: ProductAttributeRow[];
  variants: VariantRow[];
}

/**
 * Everything the product page shows, in ONE request: the active product, its
 * active category (null when the category is inactive, via RLS), all of its
 * images (primary first, then sort_order), its attributes and its purchasable
 * variants. No inventory is read: anon has no access to it; per-variant
 * availability is a separate, shorter-lived lookup (getVariantAvailability).
 * Returns null for unknown or inactive slugs. Cached, so generateMetadata and
 * the page share one result.
 */
export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const withPrices = await hasCurrencyPrices();
  const { data, error } = await createPublicClient()
    .from("products")
    .select(
      (withPrices
        ? `${PRODUCT_DETAIL_SELECT},\n  prices:product_prices(${PRICE_SELECT})`
        : PRODUCT_DETAIL_SELECT) as typeof PRODUCT_DETAIL_SELECT,
    )
    .eq("is_active", true)
    .eq("slug", slug)
    .order("is_primary", { referencedTable: "images", ascending: false })
    .order("sort_order", { referencedTable: "images", ascending: true })
    .order("created_at", { referencedTable: "images", ascending: true })
    // Bounded like variant_availability() (500 ids per call).
    .order("sort_order", { referencedTable: "variants", ascending: true })
    .limit(500, { referencedTable: "variants" })
    .maybeSingle();
  if (error) fail("product", error);
  if (!data) return null;

  const row = data as unknown as ProductDetailRow;
  const compareAt = row.compare_at_price;
  const { options, variants } = buildOptions(row.product_type_id, row.variants);
  const images = row.images.flatMap((image) => {
    const url = publicImageUrl(image.public_url, image.storage_path);
    return url ? [{ id: image.id, url, alt: image.alt_text?.trim() || null }] : [];
  });
  const imageIds = new Set(images.map((image) => image.id));
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    shortDescription: row.short_description?.trim() || null,
    description: row.description?.trim() || null,
    price: row.price,
    compareAtPrice: compareAt && compareAmounts(compareAt, row.price) > 0 ? compareAt : null,
    currencyCode: row.currency_code,
    prices: row.prices
      ? toPriceRows(row.prices)
      : legacyPrices(row.currency_code, [
          { variantId: null, price: row.price, compareAt: row.compare_at_price },
          ...row.variants.map((variant) => ({
            variantId: variant.id,
            price: variant.price,
            compareAt: variant.compare_at_price,
          })),
        ]),
    category: row.category,
    images,
    specs: buildSpecs(
      row.product_type_id,
      row.attributes,
      new Set(options.map((option) => option.attributeId)),
    ),
    options,
    // A variant image the gallery can't show (unusable URL) is ignored.
    variants: variants.map((variant) =>
      variant.imageId && !imageIds.has(variant.imageId) ? { ...variant, imageId: null } : variant,
    ),
  };
}

/**
 * How many units of each variant can be ordered right now (lib/catalogue/stock:
 * 0 = sold out, at most the cart maximum, never exact stock above it; absent
 * = not purchasable). Refreshed in the background every 15 seconds; the
 * server checks again when adding to the cart and at checkout, so this only
 * decides what the page offers.
 *
 * Not the "seconds" profile: an `expire` under 5 minutes makes a cache a
 * request-time "dynamic hole", which dev validation reports as uncached data
 * on every product page with variants. stale ≥ 30s and expire = 5 minutes
 * keep it prerenderable (docs: cacheLife → Prerendering behavior).
 */
export async function getVariantStock(
  variantIds: readonly string[],
): Promise<Record<string, number>> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 15, expire: 300 });
  cacheTag(CATALOGUE_TAG, STOCK_TAG);

  const result = await lookupVariantStock(variantIds);
  if (!result.ok) fail("variant stock", result.error);
  return Object.fromEntries(result.limits);
}

/**
 * The product page's categories and tags (migration 029; RLS: active ones
 * only). One small cached request. Before 029, or on error, the page shows
 * only the main category and no tags.
 */
export async function getProductTaxonomy(productId: string): Promise<ProductTaxonomy> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const empty: ProductTaxonomy = { categories: [], tags: [] };
  const { data, error } = await createPublicClient()
    .from("products")
    .select(
      `category_id,
       categories:product_categories(category:categories(id, name, slug, parent_id, sort_order)),
       tags:product_tags(tag:tags(name, slug))`,
    )
    .eq("is_active", true)
    .eq("id", productId)
    .maybeSingle();
  if (error) {
    if (!isTaxonomyAccessError(error)) console.error("[catalogue] taxonomy failed", error.code);
    return empty;
  }
  if (!data) return empty;

  const row = data as unknown as {
    category_id: string | null;
    categories: {
      category: {
        id: string;
        name: string;
        slug: string;
        parent_id: string | null;
        sort_order: number;
      } | null;
    }[];
    tags: { tag: { name: string; slug: string } | null }[];
  };
  const categories = row.categories
    .flatMap(({ category }) => (category ? [category] : []))
    // Main category first, then admin display order.
    .sort(
      (a, b) =>
        Number(b.id === row.category_id) - Number(a.id === row.category_id) ||
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name),
    );
  return {
    categories: categories.map(({ name, slug, parent_id }) => ({
      name,
      slug,
      parentId: parent_id,
    })),
    tags: row.tags
      .flatMap(({ tag }) => (tag ? [tag] : []))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * How many units of a simple product can be ordered right now (0 = sold out,
 * at most the cart maximum). For a product with variants only "> 0" matters
 * (whether any variant is in stock). Same short-lived cache as
 * getVariantStock; the server checks again when adding to the cart and at
 * checkout.
 */
export async function getProductStock(productId: string): Promise<number> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 15, expire: 300 });
  cacheTag(CATALOGUE_TAG, STOCK_TAG);

  const result = await lookupProductStock([productId]);
  if (!result.ok) fail("product stock", result.error);
  return result.limits.get(productId) ?? 0;
}

/** Slugs of every active product, for the sitemap (bounded). */
export async function getActiveProductSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const { data, error } = await createPublicClient()
    .from("products")
    .select("slug")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) fail("product slugs", error);
  return data.map((row) => row.slug);
}
