// Domain types derived from the shared database schema (owned by mirna-admin).
// Do not redeclare columns by hand; pick from the generated types instead.
import type { PriceRow } from "@/lib/currency/money";
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
   * Distinct active products listed in the category (main or extra category,
   * mirna-admin 027). A top-level category's count includes its
   * subcategories; a product in both counts once.
   */
  productCount: number;
  /** null = top-level category (shown in the header); else its parent's id. */
  parentId: string | null;
}

/** An active product tag (mirna-admin 027) that at least one active product has. */
export interface CatalogueTag {
  id: string;
  name: string;
  slug: string;
}

/**
 * A product attribute the catalogue can filter by (Color, Size, Length …),
 * with the active values that at least one active product (or one of its
 * active variants) has, in admin order.
 */
export interface FilterAttribute {
  code: string;
  name: string;
  /** "color": values are swatches (colorHex); "select": text chips. */
  kind: "color" | "select";
  values: FilterAttributeValue[];
}

export interface FilterAttributeValue {
  label: string;
  /** URL slug, unique within the attribute (?filter={code}.{slug}). */
  slug: string;
  colorHex: string | null;
}

/** Where a product is listed and how it's tagged, for the product page. */
export interface ProductTaxonomy {
  /** Every active category the product is in (main first), with its parent's id. */
  categories: { name: string; slug: string; parentId: string | null }[];
  tags: { name: string; slug: string }[];
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
  /**
   * Admin-set prices per currency (product and variant rows, minor units).
   * What's shown comes from these, in the visitor's currency; the legacy
   * price fields above are the product's own currency only.
   */
  prices: PriceRow[];
  category: { name: string; slug: string } | null;
  /** Primary image, else the lowest sort_order; null → placeholder. */
  image: { url: string; alt: string | null } | null;
  /** The next image, shown on hover (devices with a mouse). */
  hoverImage?: { url: string; alt: string | null } | null;
  /** Active tags, by name, shown over the image (empty before migration 029). */
  tags?: { name: string; slug: string }[];
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
  /**
   * false: the customer may leave it unchosen (a detail like Fabric); any
   * in-stock variant matching the other choices is then used.
   */
  required: boolean;
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
  /** No admin-set price in the cart's currency: the line is shown but can't be bought. */
  priceMissing: boolean;
  quantity: number;
  /** price × quantity (exact decimal). */
  subtotal: string;
  /** false when the product can't be ordered right now (excluded from totals). */
  available: boolean;
  /**
   * Units that can be ordered now (at most 99, never exact stock above it).
   * A quantity above it must be lowered before checkout.
   */
  maxQuantity: number;
}

export interface CartSummary {
  items: CartItem[];
  /** Line keys no longer sold (inactive or deleted product or variant); removed from the cart. */
  removed: string[];
  /** Sum of available items, in the cart's currency (empty when nothing can be bought). */
  totals: { currencyCode: string; amount: string; itemCount: number }[];
  /** The cart's currency (every amount above is in it), with its decimals for display. */
  currency: { code: string; decimals: number } | null;
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

/**
 * One saved product, read on the server from the CURRENT product row. Only
 * the product id comes from the client (or wishlist_items); no inventory
 * numbers, only a yes/no.
 */
export interface WishlistItem {
  productId: string;
  name: string;
  slug: string;
  image: { url: string; alt: string | null } | null;
  price: string;
  /** Only set when it is greater than `price`. */
  compareAtPrice: string | null;
  currencyCode: string;
  /** Admin-set prices per currency (see ProductCardData.prices). */
  prices: PriceRow[];
  /** Whether it (for a product with variants: any variant) can be ordered now. */
  available: boolean;
  /** Sold per variant: options are chosen on the product page. */
  hasVariants: boolean;
}
