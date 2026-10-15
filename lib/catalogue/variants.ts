// Turns the attribute / variant rows PostgREST embeds (mirna-admin migrations
// 023–025) into the storefront's product options. Pure functions, shared by
// the product page and cart pricing, so both agree on what a variant is.
//
// Rows arrive already filtered by RLS (anon): only active attributes, active
// values, and active variants of active products. An embed that comes back
// null therefore means "inactive", and the row that needs it is skipped.

import { compareAmounts } from "@/lib/money";
import type {
  ProductOption,
  ProductSpec,
  ProductVariant,
  VariantOptionLabel,
} from "@/types/domain";

export interface AttributeRow {
  id: string;
  name: string;
  data_type: string;
  unit: string | null;
  /** product_type_attributes rows: the attribute's position per product type. */
  type_order: { product_type_id: string; sort_order: number }[];
}

export interface AttributeValueRow {
  id: string;
  value: string;
  color_hex: string | null;
  sort_order: number;
}

export interface ProductAttributeRow {
  value_text: string | null;
  value_number: string | null;
  value_boolean: boolean | null;
  attribute: AttributeRow | null;
  value: AttributeValueRow | null;
}

export interface VariantValueRow {
  attribute: AttributeRow | null;
  value: AttributeValueRow | null;
}

export interface VariantRow {
  id: string;
  sku: string;
  price: string;
  compare_at_price: string | null;
  image_id: string | null;
  sort_order: number;
  values: VariantValueRow[];
}

/** PostgREST select for an attribute embed (shared by every query). */
export const ATTRIBUTE_SELECT =
  "id, name, data_type, unit, type_order:product_type_attributes(product_type_id, sort_order)";
export const ATTRIBUTE_VALUE_SELECT = "id, value, color_hex, sort_order";

const LAST = Number.MAX_SAFE_INTEGER;

/** Attributes in the product type's order, then by name (like the admin's labels). */
function byTypeOrder(productTypeId: string | null) {
  const position = (attribute: AttributeRow) =>
    attribute.type_order.find((row) => row.product_type_id === productTypeId)?.sort_order ?? LAST;
  return (a: AttributeRow, b: AttributeRow) =>
    position(a) - position(b) || a.name.localeCompare(b.name);
}

const byValueOrder = (a: AttributeValueRow, b: AttributeValueRow) =>
  a.sort_order - b.sort_order || a.value.localeCompare(b.value);

/** A variant's complete value set, or null when any attribute or value is hidden (inactive). */
function variantValues(rows: readonly VariantValueRow[]) {
  if (rows.length === 0) return null;
  const values: { attribute: AttributeRow; value: AttributeValueRow }[] = [];
  for (const entry of rows) {
    if (!entry.attribute || !entry.value) return null;
    values.push({ attribute: entry.attribute, value: entry.value });
  }
  return values;
}

/**
 * The product's options (one per attribute its variants vary on) and its
 * purchasable variants. A variant must have a value for every option: one
 * made for an older set of options (the admin keeps those) is left out, so
 * every remaining variant is exactly one combination.
 */
export function buildOptions(
  productTypeId: string | null,
  rows: readonly VariantRow[],
): { options: ProductOption[]; variants: ProductVariant[] } {
  const complete = rows.flatMap((row) => {
    const values = variantValues(row.values);
    return values ? [{ row, values }] : [];
  });

  const attributes = new Map<string, AttributeRow>();
  const values = new Map<string, Map<string, AttributeValueRow>>();
  for (const { values: entries } of complete) {
    for (const { attribute, value } of entries) {
      attributes.set(attribute.id, attribute);
      const known = values.get(attribute.id) ?? new Map<string, AttributeValueRow>();
      known.set(value.id, value);
      values.set(attribute.id, known);
    }
  }

  const options: ProductOption[] = [...attributes.values()]
    .sort(byTypeOrder(productTypeId))
    .map((attribute) => ({
      attributeId: attribute.id,
      name: attribute.name,
      kind: attribute.data_type === "COLOR" ? "color" : "select",
      values: [...(values.get(attribute.id)?.values() ?? [])].sort(byValueOrder).map((value) => ({
        id: value.id,
        label: value.value,
        colorHex: attribute.data_type === "COLOR" ? value.color_hex : null,
      })),
    }));

  const variants = complete
    .filter(({ values: entries }) => entries.length === options.length)
    .sort((a, b) => a.row.sort_order - b.row.sort_order)
    .map(({ row, values: entries }) => ({
      id: row.id,
      sku: row.sku,
      price: row.price,
      compareAtPrice:
        row.compare_at_price && compareAmounts(row.compare_at_price, row.price) > 0
          ? row.compare_at_price
          : null,
      imageId: row.image_id,
      values: Object.fromEntries(entries.map(({ attribute, value }) => [attribute.id, value.id])),
    }));

  // Options only list values a remaining variant uses.
  for (const option of options) {
    option.values = option.values.filter((value) =>
      variants.some((variant) => variant.values[option.attributeId] === value.id),
    );
  }
  return variants.length > 0 ? { options, variants } : { options: [], variants: [] };
}

/** A variant's options for the cart ("Size: M", "Colour: Red"), or null if incomplete. */
export function variantLabel(
  productTypeId: string | null,
  rows: readonly VariantValueRow[],
): VariantOptionLabel[] | null {
  const values = variantValues(rows);
  if (!values) return null;
  const order = byTypeOrder(productTypeId);
  return values
    .sort((a, b) => order(a.attribute, b.attribute))
    .map(({ attribute, value }) => ({ name: attribute.name, value: value.value }));
}

/**
 * The product's descriptive attributes, grouped per attribute (a multi-value
 * attribute lists all its values). Attributes that are variant options are
 * left out: the option picker shows them.
 */
export function buildSpecs(
  productTypeId: string | null,
  rows: readonly ProductAttributeRow[],
  optionIds: ReadonlySet<string>,
): ProductSpec[] {
  const groups = new Map<string, { attribute: AttributeRow; rows: ProductAttributeRow[] }>();
  for (const row of rows) {
    if (!row.attribute || optionIds.has(row.attribute.id)) continue;
    const group = groups.get(row.attribute.id) ?? { attribute: row.attribute, rows: [] };
    group.rows.push(row);
    groups.set(row.attribute.id, group);
  }

  const specs: ProductSpec[] = [];
  const order = byTypeOrder(productTypeId);
  for (const { attribute, rows: group } of [...groups.values()].sort((a, b) =>
    order(a.attribute, b.attribute),
  )) {
    const first = group[0];
    let value: ProductSpec["value"] | null = null;
    switch (attribute.data_type) {
      case "TEXT":
        value = first.value_text?.trim() ? { kind: "text", text: first.value_text.trim() } : null;
        break;
      case "NUMBER":
        value =
          first.value_number !== null
            ? { kind: "number", value: first.value_number, unit: attribute.unit }
            : null;
        break;
      case "BOOLEAN":
        value =
          first.value_boolean !== null ? { kind: "boolean", value: first.value_boolean } : null;
        break;
      case "SELECT":
      case "COLOR": {
        const values = group
          .flatMap((row) => (row.value ? [row.value] : []))
          .sort(byValueOrder)
          .map((choice) => ({
            label: choice.value,
            colorHex: attribute.data_type === "COLOR" ? choice.color_hex : null,
          }));
        value = values.length > 0 ? { kind: "choice", values } : null;
        break;
      }
    }
    if (value) specs.push({ attributeId: attribute.id, name: attribute.name, value });
  }
  return specs;
}
