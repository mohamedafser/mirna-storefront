// Domain types derived from the shared database schema (owned by mirna-admin).
// Do not redeclare columns by hand; pick from the generated types instead.
import type { Enums, Tables } from "@/lib/supabase/database.types";

export type { Direction, Locale } from "@/config/i18n";
export type { CountryCode, CurrencyCode, RegionConfig } from "@/config/region";

// Tables the storefront may read publicly (RLS: active rows only, anon role).
export type Category = Tables<"categories">;
export type Product = Tables<"products">;
export type ProductImage = Tables<"product_images">;

/** orders.status (Phase 14: shown to the customer, changed only by admins). */
export type OrderStatus = Enums<"order_status">;

/** An active category as the storefront lists it (categories card, filters, nav). */
export interface CatalogueCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Public Storage URL, or null to show the placeholder. */
  imageUrl: string | null;
  /** Active products in the category (RLS-filtered count, one query for all). */
  productCount: number;
}

/**
 * Just what a product card needs. Prices stay NUMERIC decimal strings
 * (never floats); no inventory, SKU or admin fields are selected.
 */
export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  price: string;
  /** Only set when it is greater than `price`. */
  compareAtPrice: string | null;
  currencyCode: string;
  category: { name: string; slug: string } | null;
  /** Primary image, else the lowest sort_order; null → placeholder. */
  image: { url: string; alt: string | null } | null;
}

/**
 * The product page. SKU is shown to customers as a reference code; no
 * inventory, IDs of other records or admin fields are included.
 */
export interface ProductDetail extends Omit<ProductCardData, "image"> {
  sku: string;
  shortDescription: string | null;
  /** Plain text (the admin uses a textarea); rendered with line breaks, never as HTML. */
  description: string | null;
  /** Primary first, then sort_order. Empty → placeholder. */
  images: { id: string; url: string; alt: string | null }[];
}

/**
 * The signed-in visitor as the account area sees them (lib/auth/dal.ts).
 * Role and status come from `profiles` (read under RLS), never from the client.
 */
export interface CurrentCustomer {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: Tables<"profiles">["role"];
  isActive: boolean;
  createdAt: string | null;
}

/**
 * One cart line priced on the server from the CURRENT product row. Prices
 * are decimal strings; nothing here comes from the client except the
 * product id and quantity. No inventory numbers: only a yes/no.
 */
export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  image: { url: string; alt: string | null } | null;
  price: string;
  compareAtPrice: string | null;
  currencyCode: string;
  quantity: number;
  /** price × quantity (exact decimal). */
  subtotal: string;
  /** false when the product can't be ordered right now (excluded from totals). */
  available: boolean;
}

export interface CartSummary {
  items: CartItem[];
  /** Product ids that are no longer sold (inactive or deleted); removed from the cart. */
  removed: string[];
  /** Sum of available items, one entry per currency (normally just one). */
  totals: { currencyCode: string; amount: string; itemCount: number }[];
}

/** A saved address as the account area shows and edits it (own rows only, RLS). */
export interface Address {
  id: string;
  fullName: string;
  phone: string;
  /** addresses.street */
  line1: string;
  /** addresses.building */
  line2: string | null;
  city: string;
  /** addresses.state_region (an emirate's stored English name in the UAE). */
  region: string | null;
  countryCode: string;
  postalCode: string | null;
  isDefault: boolean;
}
