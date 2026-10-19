"use client";

import Link from "next/link";
import { useId, useState, type FormEvent, type MouseEvent } from "react";
import { buttonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localizedHref, routes } from "@/config/navigation";
import { activeRegion } from "@/config/region";
import { catalogueHref, optionToken, toggleTag, type CatalogueState } from "@/lib/catalogue/params";
import { toIntlLocale } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { compareAmounts, parseAmount } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import type { CatalogueCategory, CatalogueTag, FilterAttribute } from "@/types/domain";
import { StateFields, useCatalogueNavigation, useUrlSyncedValue } from "./catalogue-navigation";

export interface CatalogueFiltersProps {
  /** Localised path of the current catalogue page. */
  path: string;
  state: CatalogueState;
  categories: CatalogueCategory[];
  tags: CatalogueTag[];
  /** Attribute filters (Color, Size …; [] hides them). */
  attributes: FilterAttribute[];
  /** Set on /categories/[slug]: the category comes from the path. */
  currentCategory?: CatalogueCategory;
  /** Called when a filter navigates (the mobile drawer closes itself). */
  onNavigate?: () => void;
}

/**
 * Category, sale, attribute (colour, size …), tag and price filters, used in
 * the desktop sidebar and the mobile drawer. Every filter is a URL change
 * (links and GET forms work before JavaScript loads).
 */
export function CatalogueFilters(props: CatalogueFiltersProps) {
  const { path, state, tags, attributes, onNavigate } = props;
  return (
    <div className="grid gap-10">
      <CategoryFilter {...props} />
      <SaleFilter path={path} state={state} onNavigate={onNavigate} />
      {attributes.map((attribute) => (
        <AttributeFilter
          key={attribute.code}
          path={path}
          state={state}
          attribute={attribute}
          onNavigate={onNavigate}
        />
      ))}
      {tags.length > 0 && (
        <TagFilter path={path} state={state} tags={tags} onNavigate={onNavigate} />
      )}
      <PriceFilter path={path} state={state} onNavigate={onNavigate} />
    </div>
  );
}

/**
 * /products: every active category as a two-level tree ("All" first), which
 * sets ?category= (a parent includes its subcategories).
 * /categories/[slug]: the category's family (its parent or itself, then the
 * subcategories) as links to their pages, keeping search, tags and price.
 */
function CategoryFilter({
  path,
  state,
  categories,
  currentCategory,
  onNavigate,
}: CatalogueFiltersProps) {
  const { locale, messages } = useI18n();
  const t = messages.catalogue;
  const { navigate } = useCatalogueNavigation();
  const id = useId();
  const number = new Intl.NumberFormat(toIntlLocale(locale));

  const top = categories.filter((category) => !category.parentId);
  const childrenOf = (parentId: string) =>
    categories.filter((category) => category.parentId === parentId);

  let groups: CatalogueCategory[];
  let hrefFor: (category: CatalogueCategory | null) => string;
  let isCurrent: (category: CatalogueCategory | null) => boolean;
  if (currentCategory) {
    const root = currentCategory.parentId
      ? categories.find((category) => category.id === currentCategory.parentId)
      : currentCategory;
    if (!root || childrenOf(root.id).length === 0) return null; // nothing to browse into
    groups = [root];
    hrefFor = (category) =>
      catalogueHref(localizedHref(locale, routes.category(category?.slug ?? root.slug)), state);
    isCurrent = (category) => category?.id === currentCategory.id;
  } else {
    if (top.length === 0) return null;
    groups = top;
    hrefFor = (category) => catalogueHref(path, state, { category: category?.slug ?? null });
    isCurrent = (category) => (category?.slug ?? null) === state.category;
  }

  const go = (href: string, sameCatalogue: boolean) => (event: MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.();
    if (!sameCatalogue) return; // another category page: a normal navigation
    event.preventDefault();
    navigate(href);
  };

  const item = (category: CatalogueCategory | null, depth: 0 | 1, label?: string) => {
    const href = hrefFor(category);
    const current = isCurrent(category);
    return (
      <li key={category?.id ?? "all"}>
        <Link
          href={href}
          scroll={false}
          aria-current={current ? "true" : undefined}
          onClick={go(href, !currentCategory)}
          className={cn(
            "flex min-h-9 items-center justify-between gap-3 py-1 text-sm transition-colors hover:text-foreground",
            depth === 1 && "ps-4",
            current ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          <span className={cn("min-w-0 truncate", current && "underline underline-offset-4")}>
            {label ?? category?.name}
          </span>
          {category && (
            <span className="shrink-0 text-xs tabular-nums">
              {number.format(category.productCount)}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="caps text-[0.6875rem] font-medium">
        {currentCategory ? t.subcategories : t.category}
      </h2>
      <ul className="mt-3 grid">
        {!currentCategory && item(null, 0, t.allCategories)}
        {groups.map((group) => [
          item(group, 0, currentCategory ? format(t.allIn, { name: group.name }) : undefined),
          ...childrenOf(group.id).map((child) => item(child, currentCategory ? 0 : 1)),
        ])}
      </ul>
    </nav>
  );
}

/**
 * Tags as checkboxes: products with ANY ticked tag are shown. Each change
 * updates the URL straight away (?tag=a&tag=b).
 */
function TagFilter({
  path,
  state,
  tags,
  onNavigate,
}: {
  path: string;
  state: CatalogueState;
  tags: CatalogueTag[];
  onNavigate?: () => void;
}) {
  const { messages } = useI18n();
  const t = messages.catalogue;
  const { navigate } = useCatalogueNavigation();
  const id = useId();

  const change = (nextTags: string[]) => {
    onNavigate?.();
    navigate(catalogueHref(path, state, { tags: nextTags }));
  };

  return (
    <fieldset aria-describedby={`${id}-hint`} className="min-w-0">
      <legend className="caps text-[0.6875rem] font-medium">{t.tags}</legend>
      <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
        {t.tagsHint}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => {
          const checked = state.tags.includes(tag.slug);
          return (
            <li key={tag.id}>
              <label
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center gap-2 border px-3 text-xs transition-colors select-none hover:border-foreground",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  checked && "border-foreground bg-foreground text-background",
                )}
              >
                <input
                  type="checkbox"
                  name="tag"
                  value={tag.slug}
                  checked={checked}
                  onChange={() => change(toggleTag(state.tags, tag.slug))}
                  className="sr-only"
                />
                {tag.name}
              </label>
            </li>
          );
        })}
      </ul>
      {state.tags.length > 0 && (
        <button
          type="button"
          onClick={() => change([])}
          className="caps mt-3 cursor-pointer text-[0.625rem] font-medium underline underline-offset-4 hover:opacity-70"
        >
          {t.clearTags}
        </button>
      )}
    </fieldset>
  );
}

/** "On sale" switch (?sale=1): discounted pieces only. */
function SaleFilter({
  path,
  state,
  onNavigate,
}: {
  path: string;
  state: CatalogueState;
  onNavigate?: () => void;
}) {
  const { messages } = useI18n();
  const t = messages.catalogue;
  const { navigate } = useCatalogueNavigation();
  const id = useId();

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 select-none",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring",
      )}
    >
      <span className="min-w-0">
        <span className="caps block text-[0.6875rem] font-medium">{t.onSale}</span>
        <span id={`${id}-hint`} className="mt-1 block text-xs text-muted-foreground">
          {t.onSaleHint}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        name="sale"
        value="1"
        checked={state.sale}
        aria-describedby={`${id}-hint`}
        onChange={() => {
          onNavigate?.();
          navigate(catalogueHref(path, state, { sale: !state.sale }));
        }}
        className="peer sr-only"
      />
      {/* Track and knob; the knob slides to the inline end when on. */}
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full border border-border bg-muted transition-colors peer-checked:border-foreground peer-checked:bg-foreground"
      >
        <span
          className={cn(
            "absolute top-0.5 size-[1.125rem] rounded-full bg-background shadow-sm transition-[inset-inline-start] duration-300 ease-out",
            state.sale ? "start-[calc(100%-1.25rem)]" : "start-0.5",
          )}
        />
      </span>
    </label>
  );
}

/**
 * One attribute's values as checkboxes (?filter=code.value, repeatable):
 * colours as swatches with their names, other attributes (size, length …)
 * as square chips. Ticking several values of one attribute shows products
 * with ANY of them.
 */
function AttributeFilter({
  path,
  state,
  attribute,
  onNavigate,
}: {
  path: string;
  state: CatalogueState;
  attribute: FilterAttribute;
  onNavigate?: () => void;
}) {
  const { messages } = useI18n();
  const t = messages.catalogue;
  const { navigate } = useCatalogueNavigation();
  const tokens = attribute.values.map((value) => optionToken(attribute.code, value.slug));
  const selected = state.options.filter((option) => tokens.includes(option));

  const change = (options: string[]) => {
    onNavigate?.();
    navigate(catalogueHref(path, state, { options }));
  };
  const color = attribute.kind === "color";

  return (
    <fieldset className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <legend className="caps float-start text-[0.6875rem] font-medium">{attribute.name}</legend>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => change(state.options.filter((option) => !tokens.includes(option)))}
            className="caps cursor-pointer text-[0.625rem] font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t.clearSelection}
          </button>
        )}
      </div>
      <ul className={cn("mt-4 flex flex-wrap", color ? "gap-x-4 gap-y-3" : "gap-2")}>
        {attribute.values.map((value, index) => {
          const token = tokens[index];
          const checked = state.options.includes(token);
          const input = (
            <input
              type="checkbox"
              name="filter"
              value={token}
              checked={checked}
              onChange={() => change(toggleTag(state.options, token))}
              className="sr-only"
            />
          );
          return (
            <li key={token}>
              {color ? (
                <label className="group/swatch flex cursor-pointer items-center gap-2 text-xs select-none">
                  {input}
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-7 place-items-center rounded-full border transition-[box-shadow,border-color]",
                      "group-has-[:focus-visible]/swatch:outline-2 group-has-[:focus-visible]/swatch:outline-offset-2 group-has-[:focus-visible]/swatch:outline-ring",
                      checked
                        ? "border-foreground shadow-[inset_0_0_0_3px_var(--color-background)]"
                        : "border-border group-hover/swatch:border-foreground",
                    )}
                    style={{ backgroundColor: value.colorHex ?? "transparent" }}
                  />
                  <span
                    className={cn(
                      "transition-colors",
                      checked
                        ? "font-medium text-foreground"
                        : "text-muted-foreground group-hover/swatch:text-foreground",
                    )}
                  >
                    {value.label}
                  </span>
                </label>
              ) : (
                <label
                  className={cn(
                    "inline-flex h-10 min-w-10 cursor-pointer items-center justify-center border px-3 text-xs tabular-nums transition-colors select-none hover:border-foreground",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                    checked && "border-foreground bg-foreground text-background",
                  )}
                >
                  {input}
                  {value.label}
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function PriceFilter({
  path,
  state,
  onNavigate,
}: {
  path: string;
  state: CatalogueState;
  onNavigate?: () => void;
}) {
  const { messages } = useI18n();
  const t = messages.catalogue;
  const { navigate } = useCatalogueNavigation();
  const id = useId();
  const [min, setMin] = useUrlSyncedValue(state.minPrice ?? "");
  const [max, setMax] = useUrlSyncedValue(state.maxPrice ?? "");
  const [invalid, setInvalid] = useState<{ min: boolean; max: boolean }>({
    min: false,
    max: false,
  });
  const errorId = `${id}-error`;
  const hasPrice = Boolean(state.minPrice || state.maxPrice);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let minPrice = min.trim() ? parseAmount(min) : null;
    let maxPrice = max.trim() ? parseAmount(max) : null;
    const errors = { min: Boolean(min.trim()) && !minPrice, max: Boolean(max.trim()) && !maxPrice };
    setInvalid(errors);
    if (errors.min || errors.max) return;
    if (minPrice && maxPrice && compareAmounts(minPrice, maxPrice) > 0) {
      [minPrice, maxPrice] = [maxPrice, minPrice];
    }
    onNavigate?.();
    navigate(catalogueHref(path, state, { minPrice, maxPrice }));
  }

  const field = (key: "min" | "max", label: string, value: string, set: (v: string) => void) => (
    <div className="min-w-0 flex-1">
      <label htmlFor={`${id}-${key}`} className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </label>
      <Input
        id={`${id}-${key}`}
        name={key === "min" ? "minPrice" : "maxPrice"}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => set(event.target.value)}
        aria-invalid={invalid[key] || undefined}
        aria-describedby={invalid[key] ? errorId : undefined}
        className={cn("h-10", invalid[key] && "border-error")}
      />
    </div>
  );

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="caps text-[0.6875rem] font-medium">
        {format(t.priceRange, { currency: activeRegion.currencyCode })}
      </h2>
      <form action={path} onSubmit={apply} noValidate className="mt-4">
        <div className="flex items-end gap-3">
          {field("min", t.minPrice, min, setMin)}
          <span aria-hidden className="pb-2.5 text-muted-foreground">
            –
          </span>
          {field("max", t.maxPrice, max, setMax)}
        </div>
        {(invalid.min || invalid.max) && (
          <p id={errorId} role="alert" className="mt-2 text-xs text-error">
            {t.priceInvalid}
          </p>
        )}
        <StateFields state={state} omit={["minPrice", "maxPrice"]} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={buttonClassName({ size: "sm", className: "flex-1" })}>
            {t.apply}
          </button>
          {hasPrice && (
            <button
              type="button"
              onClick={() => {
                setInvalid({ min: false, max: false });
                onNavigate?.();
                navigate(catalogueHref(path, state, { minPrice: null, maxPrice: null }));
              }}
              className={buttonClassName({ size: "sm", variant: "outline", className: "flex-1" })}
            >
              {t.clearPrice}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
