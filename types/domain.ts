// Domain types derived from the shared database schema (owned by mirna-admin).
// Do not redeclare columns by hand; pick from the generated types instead.
import type { Tables } from "@/lib/supabase/database.types";

export type { Direction, Locale } from "@/config/i18n";
export type { CountryCode, CurrencyCode, RegionConfig } from "@/config/region";

// Tables the storefront may read publicly (RLS: active rows only, anon role).
export type Category = Tables<"categories">;
export type Product = Tables<"products">;
export type ProductImage = Tables<"product_images">;

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
