import "server-only";
import { publicImageUrl } from "@/lib/catalogue/queries";
import { compareAmounts, multiplyAmount, sumAmounts } from "@/lib/money";
import { createPublicClient } from "@/lib/supabase/public";
import type { CartItem, CartSummary } from "@/types/domain";
import type { CartLine } from "./rules";

/** Raised when the catalogue can't be read; actions turn it into a safe error. */
export class CartLookupError extends Error {
  constructor() {
    super("The cart could not be loaded.");
    this.name = "CartLookupError";
  }
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  compare_at_price: string | null;
  currency_code: string;
  images: { public_url: string | null; storage_path: string; alt_text: string | null }[];
}

/**
 * The active products among `ids`, plus whether each can be ordered now.
 * Runs as `anon` (RLS: active products only) and never touches `inventory`
 * directly: product_availability() returns only a boolean per product.
 */
export async function getSellableProducts(ids: readonly string[]) {
  if (ids.length === 0) return new Map<string, { row: ProductRow; available: boolean }>();
  const supabase = createPublicClient();

  const [products, availability] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, name, slug, sku, price::text, compare_at_price::text, currency_code,
         images:product_images(public_url, storage_path, alt_text)`,
      )
      .eq("is_active", true)
      .in("id", ids)
      .order("is_primary", { referencedTable: "images", ascending: false })
      .order("sort_order", { referencedTable: "images", ascending: true })
      .limit(1, { referencedTable: "images" }),
    supabase.rpc("product_availability", { p_product_ids: [...ids] }),
  ]);

  for (const [context, error] of [
    ["products", products.error],
    ["availability", availability.error],
  ] as const) {
    if (error) {
      console.error(`[cart] ${context} lookup failed`, error.code, error.message);
      throw new CartLookupError();
    }
  }

  const available = new Map(availability.data!.map((row) => [row.product_id, row.available]));
  return new Map(
    (products.data as unknown as ProductRow[]).map((row) => [
      row.id,
      { row, available: available.get(row.id) ?? false },
    ]),
  );
}

/**
 * Prices cart lines from the current product rows. Client-side prices are
 * never used: the browser only ever sends product ids and quantities.
 * Inactive or deleted products are reported in `removed`; unavailable ones
 * stay listed but are left out of the totals.
 */
export async function priceLines(lines: readonly CartLine[]): Promise<CartSummary> {
  const products = await getSellableProducts(lines.map((line) => line.productId));

  const items: CartItem[] = [];
  const removed: string[] = [];
  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product) {
      removed.push(line.productId);
      continue;
    }
    const { row, available } = product;
    const image = row.images[0];
    const url = image ? publicImageUrl(image.public_url, image.storage_path) : null;
    items.push({
      productId: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      image: url ? { url, alt: image.alt_text?.trim() || null } : null,
      price: row.price,
      compareAtPrice:
        row.compare_at_price && compareAmounts(row.compare_at_price, row.price) > 0
          ? row.compare_at_price
          : null,
      currencyCode: row.currency_code,
      quantity: line.quantity,
      subtotal: multiplyAmount(row.price, line.quantity),
      available,
    });
  }

  // Totals per currency (a market normally has one), available items only.
  const byCurrency = new Map<string, CartItem[]>();
  for (const item of items) {
    if (!item.available) continue;
    byCurrency.set(item.currencyCode, [...(byCurrency.get(item.currencyCode) ?? []), item]);
  }
  const totals = [...byCurrency].map(([currencyCode, group]) => ({
    currencyCode,
    amount: sumAmounts(group.map((item) => item.subtotal)),
    itemCount: group.reduce((total, item) => total + item.quantity, 0),
  }));

  return { items, removed, totals };
}
