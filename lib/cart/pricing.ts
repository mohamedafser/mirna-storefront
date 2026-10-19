import "server-only";
import {
  PRICE_SELECT,
  publicImageUrl,
  toPriceRows,
  type PriceRowData,
} from "@/lib/catalogue/queries";
import {
  ATTRIBUTE_SELECT,
  ATTRIBUTE_VALUE_SELECT,
  variantLabel,
  type VariantValueRow,
} from "@/lib/catalogue/variants";
import {
  lookupPrice,
  minorToDecimal,
  payable,
  type Currency,
  type PriceRow,
} from "@/lib/currency/money";
import { multiplyAmount, sumAmounts } from "@/lib/money";
import { hasCurrencyPrices, legacyPrices } from "@/lib/currency/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { CartItem, CartSummary, VariantOptionLabel } from "@/types/domain";
import { lineKey, type CartLine } from "./rules";

/** Raised when the catalogue can't be read; actions turn it into a safe error. */
export class CartLookupError extends Error {
  constructor() {
    super("The cart could not be loaded.");
    this.name = "CartLookupError";
  }
}

interface ImageRow {
  public_url: string | null;
  storage_path: string;
  alt_text: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  compare_at_price: string | null;
  currency_code: string;
  product_type_id: string | null;
  images: ImageRow[];
  /** At most one visible (active) variant: only "has variants?" matters. */
  variants: { id: string }[];
  /** Absent before migration 031 (legacy prices). */
  prices?: PriceRowData[];
}

interface VariantRow {
  id: string;
  product_id: string;
  sku: string;
  price: string;
  compare_at_price: string | null;
  image: ImageRow | null;
  values: VariantValueRow[];
}

export interface SellableProduct {
  row: ProductRow;
  /**
   * Admin-set prices per currency (product and variant rows). Before
   * migration 031: the product's legacy price only (see rowsFor).
   */
  prices: PriceRow[];
  legacy: boolean;
  available: boolean;
  /** Sold per variant: a line without a variant can't be bought. */
  hasVariants: boolean;
}

export interface SellableVariant {
  row: VariantRow;
  options: VariantOptionLabel[];
  available: boolean;
}

function lookupFailed(context: string, error: { code?: string; message?: string }): never {
  console.error(`[cart] ${context} lookup failed`, error.code, error.message);
  throw new CartLookupError();
}

/**
 * The active products among `ids`, plus whether each can be ordered now.
 * Runs as `anon` (RLS: active products only) and never touches `inventory`
 * directly: product_availability() returns only a boolean per product (for
 * a product with variants: whether any variant is in stock).
 */
export async function getSellableProducts(
  ids: readonly string[],
): Promise<Map<string, SellableProduct>> {
  if (ids.length === 0) return new Map();
  const supabase = createPublicClient();
  const withPrices = await hasCurrencyPrices();

  const [products, availability] = await Promise.all([
    supabase
      .from("products")
      .select(
        `id, name, slug, sku, price::text, compare_at_price::text, currency_code, product_type_id,
         images:product_images(public_url, storage_path, alt_text),
         variants:product_variants(id)${withPrices ? `,\n         prices:product_prices(${PRICE_SELECT})` : ""}`,
      )
      .eq("is_active", true)
      .in("id", ids)
      .order("is_primary", { referencedTable: "images", ascending: false })
      .order("sort_order", { referencedTable: "images", ascending: true })
      .limit(1, { referencedTable: "images" })
      // Not a count: anon has column-level SELECT on product_variants, which
      // an embedded count(*) is refused (42501). One id answers the question.
      .limit(1, { referencedTable: "variants" }),
    supabase.rpc("product_availability", { p_product_ids: [...ids] }),
  ]);
  if (products.error) lookupFailed("products", products.error);
  if (availability.error) lookupFailed("availability", availability.error);

  const available = new Map(availability.data.map((row) => [row.product_id, row.available]));
  return new Map(
    (products.data as unknown as ProductRow[]).map((row) => [
      row.id,
      {
        row,
        prices: row.prices
          ? toPriceRows(row.prices)
          : legacyPrices(row.currency_code, [
              { variantId: null, price: row.price, compareAt: row.compare_at_price },
            ]),
        legacy: !row.prices,
        available: available.get(row.id) ?? false,
        hasVariants: row.variants.length > 0,
      },
    ]),
  );
}

/**
 * The purchasable variants among `ids` (active, of an active product, with
 * active attributes and values), with their option labels and whether each
 * can be ordered now (variant_availability(): a yes/no, never quantities).
 * `productTypes` orders the labels like the product page does.
 */
export async function getSellableVariants(
  ids: readonly string[],
  productTypes: ReadonlyMap<string, string | null>,
): Promise<Map<string, SellableVariant>> {
  if (ids.length === 0) return new Map();
  const supabase = createPublicClient();

  const [variants, availability] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        `id, product_id, sku, price::text, compare_at_price::text,
         image:product_images!product_variants_image_fkey(public_url, storage_path, alt_text),
         values:variant_attribute_values(
           attribute:attributes(${ATTRIBUTE_SELECT}),
           value:attribute_values(${ATTRIBUTE_VALUE_SELECT}))`,
      )
      .eq("is_active", true)
      .in("id", ids),
    supabase.rpc("variant_availability", { p_variant_ids: [...ids] }),
  ]);
  if (variants.error) lookupFailed("variants", variants.error);
  if (availability.error) lookupFailed("variant availability", availability.error);

  // Absent from variant_availability() = not purchasable (e.g. an inactive value).
  const available = new Map(availability.data.map((row) => [row.variant_id, row.available]));
  const result = new Map<string, SellableVariant>();
  for (const row of variants.data as unknown as VariantRow[]) {
    const options = variantLabel(productTypes.get(row.product_id) ?? null, row.values);
    if (!options || !available.has(row.id)) continue;
    result.set(row.id, { row, options, available: available.get(row.id) ?? false });
  }
  return result;
}

/**
 * Checks one line before it is stored: the product is active, the variant
 * (if any) is a purchasable variant of THAT product, a product with variants
 * gets a variant, and it can be ordered now.
 */
export async function checkLine(
  productId: string,
  variantId: string | null,
  currency: Currency | null,
): Promise<"ok" | "notFound" | "optionsRequired" | "unavailable" | "priceMissing"> {
  const product = (await getSellableProducts([productId])).get(productId);
  if (!product) return "notFound";
  let variant: SellableVariant | undefined;
  if (!variantId) {
    if (product.hasVariants) return "optionsRequired";
    if (!product.available) return "unavailable";
  } else {
    const types = new Map([[productId, product.row.product_type_id]]);
    variant = (await getSellableVariants([variantId], types)).get(variantId);
    if (!variant || variant.row.product_id !== productId) return "notFound";
    if (!variant.available) return "unavailable";
  }
  // Sold only where the admin set a price in the visitor's currency.
  if (!currency || !lookupPrice(rowsFor(product, variant), currency.code, variantId)) {
    warnPriceMissing(productId, variantId, currency);
    return "priceMissing";
  }
  return "ok";
}

/** A product's price rows, plus (before migration 031) the variant's legacy price. */
function rowsFor(product: SellableProduct, variant: SellableVariant | undefined): PriceRow[] {
  if (!product.legacy || !variant) return product.prices;
  return [
    ...product.prices,
    ...legacyPrices(product.row.currency_code, [
      {
        variantId: variant.row.id,
        price: variant.row.price,
        compareAt: variant.row.compare_at_price,
      },
    ]),
  ];
}

/** Logs a product (or variant) shown or added without a price in a currency. */
function warnPriceMissing(productId: string, variantId: string | null, currency: Currency | null) {
  console.warn(
    `[cart] no ${currency?.code ?? "(no currency)"} price for product ${productId}` +
      (variantId ? ` variant ${variantId}` : "") +
      ": set one in mirna-admin (product form or prices CSV)",
  );
}

const imageOf = (image: ImageRow | null | undefined) => {
  const url = image ? publicImageUrl(image.public_url, image.storage_path) : null;
  return url && image ? { url, alt: image.alt_text?.trim() || null } : null;
};

/**
 * Prices cart lines in `currency` from the admin-set prices (product_prices;
 * never converted). Client-side prices are never used: the browser only ever
 * sends ids and quantities. Lines for an inactive or deleted product or
 * variant are reported in `removed` (by line key); unavailable ones, lines
 * with no price in `currency`, and a product-only line for a product that now
 * has variants stay listed but are left out of the total. The whole cart is
 * always in one currency: switching currency re-prices every line.
 */
export async function priceLines(
  lines: readonly CartLine[],
  currency: Currency | null,
): Promise<CartSummary> {
  const products = await getSellableProducts([...new Set(lines.map((line) => line.productId))]);
  const variants = await getSellableVariants(
    lines.flatMap((line) => (line.variantId ? [line.variantId] : [])),
    new Map([...products].map(([id, product]) => [id, product.row.product_type_id])),
  );

  const items: CartItem[] = [];
  const removed: string[] = [];
  for (const line of lines) {
    const key = lineKey(line);
    const product = products.get(line.productId);
    const variant = line.variantId ? variants.get(line.variantId) : undefined;
    if (!product || (line.variantId && (!variant || variant.row.product_id !== line.productId))) {
      removed.push(key);
      continue;
    }
    const { row } = product;
    const needsOptions = !variant && product.hasVariants;
    const found = currency
      ? lookupPrice(rowsFor(product, variant), currency.code, variant?.row.id ?? null)
      : null;
    if (!found && !needsOptions) warnPriceMissing(row.id, variant?.row.id ?? null, currency);
    const decimals = currency?.decimals ?? 0;
    // Decimal strings in the cart's currency ("1.500"), like every amount in the cart.
    const price = found ? minorToDecimal(payable(found), decimals) : "0";
    const compareAt = found?.salePrice != null ? minorToDecimal(found.price, decimals) : null;
    items.push({
      key,
      productId: row.id,
      variantId: variant?.row.id ?? null,
      options: variant?.options ?? [],
      needsOptions,
      name: row.name,
      slug: row.slug,
      sku: variant?.row.sku ?? row.sku,
      image: imageOf(variant?.row.image) ?? imageOf(row.images[0]),
      price,
      compareAtPrice: compareAt,
      currencyCode: currency?.code ?? row.currency_code,
      priceMissing: !found,
      quantity: line.quantity,
      subtotal: multiplyAmount(price, line.quantity),
      available:
        !needsOptions && Boolean(found) && (variant ? variant.available : product.available),
    });
  }

  // One total, in the cart's currency, of the available items.
  const priced = items.filter((item) => item.available);
  const totals =
    currency && priced.length > 0
      ? [
          {
            currencyCode: currency.code,
            amount: sumAmounts(priced.map((item) => item.subtotal)),
            itemCount: priced.reduce((total, item) => total + item.quantity, 0),
          },
        ]
      : [];

  return {
    items,
    removed,
    totals,
    currency: currency ? { code: currency.code, decimals: currency.decimals } : null,
  };
}
