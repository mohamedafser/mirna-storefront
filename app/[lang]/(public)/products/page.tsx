import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { CatalogueSkeleton } from "@/components/catalogue/catalogue-skeleton";
import { CatalogueView } from "@/components/catalogue/catalogue-view";
import { SectionHeading } from "@/components/home/section-heading";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { getFilterAttributes, resolveOptions } from "@/lib/catalogue/filters";
import { parseCatalogueParams } from "@/lib/catalogue/params";
import {
  categoryScope,
  getActiveCategories,
  getActiveTags,
  getProductListing,
  resolveTags,
  type ProductListing,
} from "@/lib/catalogue/queries";
import type { Messages } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { RecentlyViewed } from "@/components/home/recently-viewed";

// Canonical is always /products: search, sort, page and ?category= states
// don't compete with it (categories have their own canonical pages).
export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.pages.products;
  return pageMetadata({
    locale,
    path: routes.products,
    siteName: messages.site.name,
    title: t.title,
    description: t.description,
  });
}

/**
 * Product catalogue. The heading is part of the static shell; the results
 * depend on searchParams, so they stream in behind a skeleton.
 */
export default async function ProductsPage({ searchParams }: PageProps<"/[lang]/products">) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.catalogue;

  return (
    <>
      <Container size="wide" className="py-10 sm:py-14">
        <Breadcrumbs
          label={t.breadcrumb}
          items={[
            { label: messages.nav.home, href: localizedHref(locale, routes.home) },
            { label: t.productsTitle },
          ]}
        />
        <div className="mt-8">
          <SectionHeading
            as="h1"
            id="page-title"
            title={t.productsTitle}
            subtitle={t.productsSubtitle}
          />
        </div>
        <div className="mt-12 sm:mt-14">
          <Suspense fallback={<CatalogueSkeleton label={t.loading} />}>
            <ProductsCatalogue searchParams={searchParams} locale={locale} messages={messages} />
          </Suspense>
        </div>
      </Container>
      <RecentlyViewed />
    </>
  );
}

async function ProductsCatalogue({
  searchParams,
  locale,
  messages,
}: {
  searchParams: PageProps<"/[lang]/products">["searchParams"];
  locale: Locale;
  messages: Messages;
}) {
  const state = parseCatalogueParams(await searchParams);
  const [categories, tags, attributes, optionFilter] = await Promise.all([
    getActiveCategories(),
    getActiveTags(),
    getFilterAttributes(),
    resolveOptions(state.options),
  ]);
  // ?category= must name an active category; anything else matches nothing.
  const category = state.category
    ? (categories.find((candidate) => candidate.slug === state.category) ?? null)
    : null;

  const tagFilter = resolveTags(tags, state.tags);

  const listing: ProductListing =
    (state.category && !category) || tagFilter.unmatched || optionFilter.unmatched
      ? { status: "ok", products: [], total: 0, page: 1, pageCount: 1 }
      : await getProductListing(
          {
            q: state.q,
            minPrice: state.minPrice,
            maxPrice: state.maxPrice,
            sale: state.sale,
            sort: state.sort,
            page: state.page,
          },
          category ? categoryScope(categories, category.id) : null,
          tagFilter.ids,
          optionFilter.productIds,
        );

  return (
    <CatalogueView
      locale={locale}
      messages={messages}
      path={localizedHref(locale, routes.products)}
      state={state}
      categories={categories}
      tags={tags}
      attributes={attributes}
      listing={listing}
    />
  );
}
