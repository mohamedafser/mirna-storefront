import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { FilterAttribute } from "@/types/domain";
import { isSlug, optionToken } from "./params";

/**
 * Attribute filters (?filter=color.black&filter=size.m). The values a product
 * has come from two places in mirna-admin's schema: product_attributes
 * (product level) and variant_attribute_values (each active variant). Both
 * are read once into a cached index of value → product ids, so a filtered
 * listing is one extra `id in (…)` condition rather than a join per value.
 */

/** PostgREST returns at most this many rows per request (Supabase default). */
const ROWS_PER_REQUEST = 1000;

interface IndexedAttribute extends FilterAttribute {
  /** Product ids per value slug. */
  products: Record<string, string[]>;
}

/** URL slug for a value label ("Burgundy Red" → "burgundy-red"); the id when it has no latin letters. */
function valueSlug(label: string, id: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return isSlug(slug) ? slug : id;
}

/** Every row of a paged read, ROWS_PER_REQUEST at a time. */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += ROWS_PER_REQUEST) {
    const { data, error } = await page(from, from + ROWS_PER_REQUEST - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < ROWS_PER_REQUEST) return rows;
  }
}

/**
 * Filterable attributes (choice and colour types) with the values in use and
 * the products that have each. [] when attributes can't be read: the
 * attribute filters are then simply not shown.
 */
async function getAttributeIndex(): Promise<IndexedAttribute[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogue");

  const supabase = createPublicClient();
  const [attributes, productValues, variantValues] = await Promise.all([
    supabase
      .from("attributes")
      .select(
        "id, code, name, data_type, values:attribute_values(id, value, color_hex, sort_order, is_active)",
      )
      .eq("is_active", true)
      .in("data_type", ["SELECT", "COLOR"])
      .order("name", { ascending: true }),
    readAll((from, to) =>
      supabase
        .from("product_attributes")
        .select("product_id, attribute_value_id, product:products!inner(id)")
        .not("attribute_value_id", "is", null)
        .eq("product.is_active", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAll((from, to) =>
      supabase
        .from("variant_attribute_values")
        .select("attribute_value_id, variant:product_variants!inner(id, product_id)")
        .eq("variant.is_active", true)
        .order("variant_id", { ascending: true })
        .order("attribute_id", { ascending: true })
        .range(from, to),
    ),
  ]);
  if (attributes.error || !productValues || !variantValues) {
    console.error("[catalogue] attribute filters failed", attributes.error?.code);
    // Short, so a recovered read shows the filters again within seconds.
    cacheLife({ stale: 30, revalidate: 15, expire: 300 });
    return [];
  }

  // Value id → the active products that have it.
  const productsByValue = new Map<string, Set<string>>();
  const add = (valueId: string | null, productId: string) => {
    if (!valueId) return;
    const set = productsByValue.get(valueId) ?? new Set<string>();
    set.add(productId);
    productsByValue.set(valueId, set);
  };
  for (const row of productValues) add(row.attribute_value_id, row.product_id);
  for (const row of variantValues)
    if (row.variant) add(row.attribute_value_id, row.variant.product_id);

  return attributes.data.flatMap((attribute) => {
    const products: Record<string, string[]> = {};
    const values = [...attribute.values]
      .filter((value) => value.is_active && productsByValue.has(value.id))
      .sort((a, b) => a.sort_order - b.sort_order || a.value.localeCompare(b.value))
      .flatMap((value) => {
        const slug = valueSlug(value.value, value.id);
        if (products[slug]) return []; // two values with the same name: keep the first
        products[slug] = [...productsByValue.get(value.id)!].sort();
        return [{ label: value.value, slug, colorHex: value.color_hex }];
      });
    if (values.length === 0 || !isSlug(attribute.code)) return [];
    const kind = attribute.data_type === "COLOR" ? ("color" as const) : ("select" as const);
    return [{ code: attribute.code, name: attribute.name, kind, values, products }];
  });
}

/** The attribute filters to show (no product ids: safe to pass to the client). */
export async function getFilterAttributes(): Promise<FilterAttribute[]> {
  const index = await getAttributeIndex();
  return index.map(({ code, name, kind, values }) => ({ code, name, kind, values }));
}

/**
 * Product ids matching ?filter= tokens: ANY selected value of an attribute,
 * and ALL selected attributes. null = no attribute filter. `unmatched` when
 * values were asked for but none is known (the listing is then empty, like
 * an unknown tag) or no product has them all.
 */
export async function resolveOptions(
  tokens: readonly string[],
): Promise<{ productIds: string[] | null; unmatched: boolean }> {
  if (tokens.length === 0) return { productIds: null, unmatched: false };
  const index = await getAttributeIndex();

  // Per attribute with a selection: the products having ANY chosen value.
  const groups = index.flatMap((attribute) => {
    const chosen = attribute.values.filter((value) =>
      tokens.includes(optionToken(attribute.code, value.slug)),
    );
    return chosen.length > 0
      ? [new Set(chosen.flatMap((value) => attribute.products[value.slug]))]
      : [];
  });
  const [first, ...rest] = groups;
  const productIds = first ? [...first].filter((id) => rest.every((group) => group.has(id))) : [];
  return productIds.length > 0
    ? { productIds: productIds.sort(), unmatched: false }
    : { productIds: [], unmatched: true };
}
