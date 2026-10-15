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
  /**
   * Active products in the category (RLS-filtered count, one query for all).
   * A top-level category's count includes its subcategories.
   */
  productCount: number;
  /** null = top-level category (shown in the header); else its parent's id. */
  parentId: string | null;
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
  /** The next image, shown on hover (devices with a mouse). */
  hoverImage?: { url: string; alt: string | null } | null;
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
  /** Descriptive attributes (Material, Length …), in the product type's order. */
  specs: ProductSpec[];
  /** Variant options (Size, Colour …); empty for a simple product. */
  options: ProductOption[];
  /** Purchasable variants; empty for a simple product. No stock numbers. */
  variants: ProductVariant[];
}

/** One descriptive attribute of a product (admin "product attributes"). */
export interface ProductSpec {
  attributeId: string;
  name: string;
  value:
    | { kind: "text"; text: string }
    /** NUMERIC as a decimal string, formatted on render; unit like "cm". */
    | { kind: "number"; value: string; unit: string | null }
    | { kind: "boolean"; value: boolean }
    | { kind: "choice"; values: { label: string; colorHex: string | null }[] };
}

/** A variant axis: one attribute the customer picks a value for. */
export interface ProductOption {
  attributeId: string;
  name: string;
  /** "color" options render as swatches. */
  kind: "select" | "color";
  /** Only values used by at least one purchasable variant, in admin order. */
  values: { id: string; label: string; colorHex: string | null }[];
}

/** A purchasable variant (active, with active attributes and values). */
export interface ProductVariant {
  id: string;
  sku: string;
  price: string;
  /** Only set when it is greater than `price`. */
  compareAtPrice: string | null;
  /** One of the product's images, or null to keep the gallery as it is. */
  imageId: string | null;
  /** attributeId → attribute value id, exactly one per option. */
  values: Record<string, string>;
}

/** A chosen option as the cart and checkout show it ("Size" / "M"). */
export interface VariantOptionLabel {
  name: string;
  value: string;
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
 * One cart line priced on the server from the CURRENT product (or variant)
 * row. Prices are decimal strings; nothing here comes from the client except
 * the product id, variant id and quantity. No inventory numbers: only a yes/no.
 */
export interface CartItem {
  /** variantId ?? productId: identifies the line (see lib/cart/rules.ts lineKey). */
  key: string;
  productId: string;
  /** null for a simple product. */
  variantId: string | null;
  /** The variant's options; empty for a simple product. */
  options: VariantOptionLabel[];
  /**
   * The product now has variants but this line has none (added before the
   * variants existed): the customer must pick options on the product page.
   * Such a line is unavailable.
   */
  needsOptions: boolean;
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
  /** Line keys no longer sold (inactive or deleted product or variant); removed from the cart. */
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

/** A header link: a top-level category and its subcategories (dropdown). */
export interface NavCategory {
  name: string;
  slug: string;
  children: { name: string; slug: string }[];
}

/** Published reviews of a product at a glance. */
export interface ReviewSummary {
  count: number;
  /** 0 when there are no reviews. */
  average: number;
  /** Number of reviews per star, index 0 = 1 star … index 4 = 5 stars. */
  stars: [number, number, number, number, number];
}

/** A published product review (verified buyer). */
export interface ProductReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  /** Display snapshot such as "Mirna A.", set by the database. */
  authorName: string;
  createdAt: string;
  edited: boolean;
}

/** The signed-in customer's standing for one product's reviews. */
export interface MyReview {
  /** A verified buyer (delivered order containing the product). */
  eligible: boolean;
  review: {
    id: string;
    rating: number;
    title: string | null;
    body: string;
    hidden: boolean;
  } | null;
}
