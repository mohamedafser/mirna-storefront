import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import type { ProductListing } from "@/lib/catalogue/queries";
import {
  catalogueHref,
  hasActiveFilters,
  NO_FILTERS,
  PAGE_SIZE,
  type CatalogueState,
} from "@/lib/catalogue/params";
import type { Messages } from "@/lib/i18n/messages";
import type { CatalogueCategory, CatalogueTag, FilterAttribute } from "@/types/domain";
import { CatalogueFilters } from "./catalogue-filters";
import { CatalogueNavigation, CatalogueResults } from "./catalogue-navigation";
import { CatalogueToolbar } from "./catalogue-toolbar";
import { EmptyCatalogue, type EmptyReason } from "./empty-catalogue";
import { Pagination } from "./pagination";
import { ProductGrid } from "./product-grid";

/**
 * The shared catalogue body for /products and /categories/[slug]:
 *   desktop: filter sidebar | toolbar + grid + pagination
 *   mobile:  toolbar (filter drawer button) + grid + pagination
 * Server Component; only the search, sort and filter controls are client
 * islands. All state comes from the URL (`state`).
 */
export function CatalogueView({
  locale,
  messages,
  path,
  state,
  categories,
  tags,
  attributes,
  listing,
  currentCategory,
}: {
  locale: Locale;
  messages: Messages;
  /** Localised path of this catalogue page (/en/products, /ar/categories/x). */
  path: string;
  state: CatalogueState;
  categories: CatalogueCategory[];
  /** Active tags for the tag filter ([] hides it). */
  tags: CatalogueTag[];
  /** Attribute filters (getFilterAttributes(); [] hides them). */
  attributes: FilterAttribute[];
  listing: ProductListing;
  /** /categories/[slug]: the category is fixed by the path, so it is not a removable filter. */
  currentCategory?: CatalogueCategory;
}) {
  const t = messages.catalogue;
  const categoryPage = Boolean(currentCategory);
  // On a category page the category comes from the path (state.category is null).
  const filtered = hasActiveFilters(state);
  const filterProps = { path, state, categories, tags, attributes, currentCategory };

  let empty: {
    reason: EmptyReason;
    actions: Parameters<typeof EmptyCatalogue>[0]["actions"];
  } | null = null;
  if (listing.status === "out-of-range") {
    empty = { reason: "out-of-range", actions: { firstPage: catalogueHref(path, state) } };
  } else if (listing.total === 0) {
    const clearFilters = catalogueHref(path, state, NO_FILTERS);
    const clearSearch = state.q ? catalogueHref(path, state, { q: "" }) : undefined;
    empty = filtered
      ? { reason: "filters", actions: { clearFilters, clearSearch } }
      : state.q
        ? { reason: "search", actions: { clearSearch } }
        : {
            reason: "empty",
            actions: categoryPage ? { allProducts: localizedHref(locale, routes.products) } : {},
          };
  }

  return (
    <CatalogueNavigation>
      <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
        <aside aria-label={t.filters} className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-h)+2rem)]">
            <CatalogueFilters {...filterProps} />
          </div>
        </aside>

        <div className="min-w-0">
          <CatalogueToolbar
            locale={locale}
            t={t}
            path={path}
            state={state}
            categories={categories}
            tags={tags}
            attributes={attributes}
            filterProps={filterProps}
            total={listing.status === "ok" ? listing.total : null}
          />

          <CatalogueResults label={t.updating} className="mt-10">
            <h2 className="sr-only">{t.productsTitle}</h2>
            {empty ? (
              <EmptyCatalogue reason={empty.reason} t={t} actions={empty.actions} />
            ) : (
              listing.status === "ok" && (
                <>
                  <ProductGrid products={listing.products} locale={locale} t={t} layout="sidebar" />
                  <Pagination
                    href={(target) => catalogueHref(path, state, { page: target })}
                    page={listing.page}
                    pageCount={listing.pageCount}
                    total={listing.total}
                    pageSize={PAGE_SIZE}
                    locale={locale}
                    t={t}
                  />
                </>
              )
            )}
          </CatalogueResults>
        </div>
      </div>
    </CatalogueNavigation>
  );
}
