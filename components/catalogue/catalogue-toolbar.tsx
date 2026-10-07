import { X } from "lucide-react";
import Link from "next/link";
import type { Locale } from "@/config/i18n";
import { activeRegion } from "@/config/region";
import { catalogueHref, type CatalogueState } from "@/lib/catalogue/params";
import { formatPrice } from "@/lib/format";
import { format, plural, type Messages } from "@/lib/i18n/messages";
import type { CatalogueCategory } from "@/types/domain";
import { FilterDrawer } from "./filter-drawer";
import { SearchInput } from "./search-input";
import { SortSelect } from "./sort-select";

/**
 * Search, result count, mobile filter button, sort, and removable chips for
 * the active search/filters. Interactive parts are small client islands; the
 * chips are plain links.
 */
export function CatalogueToolbar({
  locale,
  t,
  path,
  state,
  categories,
  activeCategory,
  total,
}: {
  locale: Locale;
  t: Messages["catalogue"];
  path: string;
  state: CatalogueState;
  categories: CatalogueCategory[];
  activeCategory: string | null;
  /** Result count, or null when unknown (page out of range). */
  total: number | null;
}) {
  // Price chips use the market currency, the same one the filter is labelled with.
  const price = (amount: string) =>
    formatPrice(amount as Intl.StringNumericLiteral, locale, activeRegion.currencyCode);
  const priceLabel =
    state.minPrice && state.maxPrice
      ? format(t.priceBetween, { min: price(state.minPrice), max: price(state.maxPrice) })
      : state.minPrice
        ? format(t.priceFrom, { amount: price(state.minPrice) })
        : state.maxPrice
          ? format(t.priceUpTo, { amount: price(state.maxPrice) })
          : null;
  const categoryName = state.category
    ? (categories.find((category) => category.slug === state.category)?.name ?? state.category)
    : null;

  const chips = [
    state.q && {
      label: format(t.searchResultsFor, { q: state.q }),
      href: catalogueHref(path, state, { q: "" }),
    },
    categoryName && { label: categoryName, href: catalogueHref(path, state, { category: null }) },
    priceLabel && {
      label: priceLabel,
      href: catalogueHref(path, state, { minPrice: null, maxPrice: null }),
    },
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));
  const filterCount = [state.category, state.minPrice || state.maxPrice].filter(Boolean).length;

  return (
    <div className="grid gap-5">
      <SearchInput path={path} state={state} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total !== null && plural(locale, total, t.results)}
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <FilterDrawer
            path={path}
            state={state}
            categories={categories}
            activeCategory={activeCategory}
          />
          <SortSelect path={path} state={state} />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="sr-only">{t.activeFilters}</h2>
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li key={chip.href}>
                <Link
                  href={chip.href}
                  scroll={false}
                  aria-label={format(t.removeFilter, { label: chip.label })}
                  className="inline-flex min-h-9 items-center gap-2 border bg-card px-3 text-xs transition-colors hover:border-foreground"
                >
                  <span className="max-w-[16rem] truncate">{chip.label}</span>
                  <X aria-hidden className="size-3.5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
          {filterCount > 1 && (
            <Link
              href={catalogueHref(path, state, { category: null, minPrice: null, maxPrice: null })}
              scroll={false}
              className="caps inline-flex min-h-9 items-center px-2 text-[0.625rem] font-medium underline underline-offset-4 hover:opacity-70"
            >
              {t.clearFilters}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
