import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { compareAmounts } from "@/lib/money";
import type {
  CatalogueCategory,
  NavCategory,
  ProductCardData,
  ProductDetail,
} from "@/types/domain";
import { normalizeSearch, PAGE_SIZE, type CatalogueState, type SortOption } from "./params";
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
    category: row.category,
    image: url ? { url, alt: image.alt_text?.trim() || null } : null,
    hoverImage: url && hoverUrl ? { url: hoverUrl, alt: second.alt_text?.trim() || null } : null,
  };
}

/** Two embedded images per product (card + hover): primary first, then lowest sort_order. */
function productCardQuery({ withCount = false } = {}) {
  return createPublicClient()
    .from("products")
    .select(PRODUCT_CARD_SELECT, withCount ? { count: "exact" } : undefined)
    .eq("is_active", true)
    .order("is_primary", { referencedTable: "images", ascending: false })
    .order("sort_order", { referencedTable: "images", ascending: true })
    .limit(2, { referencedTable: "images" });
}

/**
 * Active categories in admin display order, each with its active product
 * count. One request: the count is an embedded aggregate, not N+1 queries.
 */
export async function getActiveCategories(): Promise<CatalogueCategory[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, name, slug, description, image_url, parent_id, products(count)")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    // Same sort order: the order they were created in (Women before Kids).
    .order("created_at", { ascending: true })
    .order("name", { ascending: true });
  if (error) fail("categories", error);

  const categories = data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: publicImageUrl(row.image_url),
    productCount: row.products[0]?.count ?? 0,
    parentId: row.parent_id,
  }));
  // A parent's count includes its (active) subcategories' products.
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

  const { data, error } = await productCardQuery()
    .in("category_id", categoryIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);
  if (error) fail("category products", error);
  return (data as ProductRow[]).map(toProductCard);
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

  const found: ProductCardData[] = [];
  for (const scope of scopes) {
    if (found.length >= limit) break;
    let query = productCardQuery().not(
      "id",
      "in",
      `(${[productId, ...found.map((product) => product.id)].join(",")})`,
    );
    if (scope) query = query.in("category_id", scope);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(limit - found.length);
    if (error) fail("related products", error);
    found.push(...(data as ProductRow[]).map(toProductCard));
  }
  return found;
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
 * One page of active products for a catalogue state. `categoryIds` is the
 * resolved active category's scope (categoryScope(); from ?category= or
 * /categories/[slug]), or null for every category.
 * Search covers the product name and slug; SKU is internal and not searched.
 */
export async function getProductListing(
  state: Omit<CatalogueState, "category">,
  categoryIds: string[] | null,
): Promise<ProductListing> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOGUE_TAG);

  const from = (state.page - 1) * PAGE_SIZE;
  let query = productCardQuery({ withCount: true });

  if (categoryIds) query = query.in("category_id", categoryIds);
  if (state.minPrice) query = query.gte("price", state.minPrice);
  if (state.maxPrice) query = query.lte("price", state.maxPrice);
  const pattern = searchPattern(state.q);
  if (pattern) query = query.or(`name.ilike."${pattern}",slug.ilike."${pattern}"`);

  const { column, ascending } = SORT_COLUMNS[state.sort];
  const { data, error, count } = await query
    .order(column, { ascending })
    // Deterministic tie-break so pages never overlap or skip products.
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  // PostgREST answers 416 / PGRST103 when the offset is past the last row.
  if (error?.code === "PGRST103") return { status: "out-of-range", page: state.page };
  if (error) fail("products", error);

  const total = count ?? 0;
  return {
    status: "ok",
    products: (data as ProductRow[]).map(toProductCard),
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

  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
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
 * Whether each variant can be ordered right now (variant_availability(),
 * mirna-admin 025: a yes/no per purchasable variant, never quantities).
 * Refreshed in the background every 15 seconds; the server checks again when
 * adding to the cart and at checkout, so this only decides what the page
 * offers.
 *
 * Not the "seconds" profile: an `expire` under 5 minutes makes a cache a
 * request-time "dynamic hole", which dev validation reports as uncached data
 * on every product page with variants. stale ≥ 30s and expire = 5 minutes
 * keep it prerenderable (docs: cacheLife → Prerendering behavior).
 */
export async function getVariantAvailability(
  variantIds: readonly string[],
): Promise<Record<string, boolean>> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 15, expire: 300 });
  cacheTag(CATALOGUE_TAG);

  if (variantIds.length === 0) return {};
  const { data, error } = await createPublicClient().rpc("variant_availability", {
    p_variant_ids: [...variantIds],
  });
  if (error) fail("variant availability", error);
  return Object.fromEntries(data.map((row) => [row.variant_id, row.available]));
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
