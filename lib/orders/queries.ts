import "server-only";
import { publicImageUrl } from "@/lib/catalogue/queries";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { CurrencyCode } from "@/config/region";
import type { OrderStatus } from "@/types/domain";

/**
 * The signed-in customer's own orders. Read with the customer's session, so
 * RLS (orders_select_own_or_admin, order_items_select_own_or_admin) returns
 * only their orders; the explicit user_id filter (from the verified session,
 * never the URL) says the same thing in the query. Everything shown is the
 * stored order: amounts, item names/SKUs/prices and the address snapshot
 * taken at checkout. Nothing is re-priced from current products. Money
 * columns are selected as text so NUMERIC values never pass through floats.
 */

export const ORDERS_PAGE_SIZE = 10;

export interface OrderItemImage {
  url: string;
  /** Present while the product is still on sale (for a link to it). */
  slug: string;
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  total: Intl.StringNumericLiteral;
  currencyCode: CurrencyCode;
  createdAt: string;
  /** Total quantity. */
  itemCount: number;
  /** Order lines (distinct products). */
  lineCount: number;
  /** The first three lines, for thumbnails. */
  previews: { id: string; name: string; image: OrderItemImage | null }[];
}

/** The snapshot place_order() stores in orders.shipping_address_snapshot. */
export interface AddressSnapshot {
  full_name?: string;
  phone?: string;
  country_code?: string;
  state_region?: string | null;
  city?: string;
  area?: string | null;
  street?: string | null;
  building?: string | null;
  apartment?: string | null;
  postal_code?: string | null;
  additional_instructions?: string | null;
}

export interface CustomerOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  subtotal: Intl.StringNumericLiteral;
  discount: Intl.StringNumericLiteral;
  shipping: Intl.StringNumericLiteral;
  tax: Intl.StringNumericLiteral;
  total: Intl.StringNumericLiteral;
  currencyCode: CurrencyCode;
  createdAt: string;
  updatedAt: string;
  address: AddressSnapshot;
  items: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: Intl.StringNumericLiteral;
    totalPrice: Intl.StringNumericLiteral;
    image: OrderItemImage | null;
  }[];
}

class OrdersError extends Error {
  constructor() {
    super("Your orders could not be loaded.");
    this.name = "OrdersError";
  }
}

function fail(context: string, error: { code?: string; message?: string }): never {
  console.error(`[orders] ${context} failed`, error.code, error.message);
  throw new OrdersError();
}

/**
 * Current image (and slug) of the products still on sale, read as `anon` like
 * the catalogue: images are decoration only. Prices never come from here. A
 * failure only hides the images.
 */
async function productImages(ids: (string | null)[]): Promise<Map<string, OrderItemImage>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const images = new Map<string, OrderItemImage>();
  if (unique.length === 0) return images;

  const { data, error } = await createPublicClient()
    .from("products")
    .select("id, slug, images:product_images(public_url, storage_path)")
    .eq("is_active", true)
    .in("id", unique)
    .order("is_primary", { referencedTable: "images", ascending: false })
    .order("sort_order", { referencedTable: "images", ascending: true })
    .limit(1, { referencedTable: "images" });
  if (error) {
    console.error("[orders] product images lookup failed", error.code, error.message);
    return images;
  }
  for (const product of data) {
    const image = product.images[0];
    const url = image ? publicImageUrl(image.public_url, image.storage_path) : null;
    if (url) images.set(product.id, { url, slug: product.slug });
  }
  return images;
}

export async function listCustomerOrders(
  userId: string,
  page: number,
): Promise<{ orders: CustomerOrderSummary[]; total: number; page: number; pageCount: number }> {
  const supabase = await createClient();
  const from = (page - 1) * ORDERS_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, total::text, currency_code, created_at,
       items:order_items(id, product_id, product_name, quantity, created_at)`,
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .order("created_at", { referencedTable: "order_items", ascending: true })
    .range(from, from + ORDERS_PAGE_SIZE - 1);
  if (error?.code === "PGRST103") {
    // Page past the end ("range not satisfiable"): count only, so the page
    // can send the customer to the last one.
    const counted = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (counted.error) fail("orders count", counted.error);
    const total = counted.count ?? 0;
    return {
      orders: [],
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
    };
  }
  if (error) fail("orders list", error);

  const rows = data as unknown as {
    id: string;
    order_number: number;
    status: OrderStatus;
    total: string;
    currency_code: CurrencyCode;
    created_at: string;
    items: { id: string; product_id: string | null; product_name: string; quantity: number }[];
  }[];
  const images = await productImages(
    rows.flatMap((row) => row.items.slice(0, 3).map((item) => item.product_id)),
  );
  const total = count ?? 0;

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE)),
    orders: rows.map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      total: row.total as Intl.StringNumericLiteral,
      currencyCode: row.currency_code,
      createdAt: row.created_at,
      itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
      lineCount: row.items.length,
      previews: row.items.slice(0, 3).map((item) => ({
        id: item.id,
        name: item.product_name,
        image: (item.product_id && images.get(item.product_id)) || null,
      })),
    })),
  };
}

/** One of the customer's orders, or null (missing or someone else's). */
export async function getCustomerOrder(
  userId: string,
  orderId: string,
): Promise<CustomerOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, subtotal::text, discount::text, shipping::text, tax::text,
       total::text, currency_code, created_at, updated_at, shipping_address_snapshot,
       items:order_items(id, product_id, product_name, sku, quantity, unit_price::text, total_price::text, created_at)`,
    )
    .eq("id", orderId)
    .eq("user_id", userId)
    .order("created_at", { referencedTable: "order_items", ascending: true })
    .maybeSingle();
  if (error) fail("order", error);
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    order_number: number;
    status: OrderStatus;
    subtotal: string;
    discount: string;
    shipping: string;
    tax: string;
    total: string;
    currency_code: CurrencyCode;
    created_at: string;
    updated_at: string;
    shipping_address_snapshot: AddressSnapshot | null;
    items: {
      id: string;
      product_id: string | null;
      product_name: string;
      sku: string;
      quantity: number;
      unit_price: string;
      total_price: string;
    }[];
  };
  const images = await productImages(row.items.map((item) => item.product_id));
  const money = (value: string) => value as Intl.StringNumericLiteral;

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    subtotal: money(row.subtotal),
    discount: money(row.discount),
    shipping: money(row.shipping),
    tax: money(row.tax),
    total: money(row.total),
    currencyCode: row.currency_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    address: row.shipping_address_snapshot ?? {},
    items: row.items.map((item) => ({
      id: item.id,
      name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: money(item.unit_price),
      totalPrice: money(item.total_price),
      image: (item.product_id && images.get(item.product_id)) || null,
    })),
  };
}
