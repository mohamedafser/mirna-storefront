import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { CatalogueSkeleton } from "@/components/catalogue/catalogue-skeleton";
import { CatalogueView } from "@/components/catalogue/catalogue-view";
import { SectionHeading } from "@/components/home/section-heading";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { getFilterAttributes, resolveOptions } from "@/lib/catalogue/filters";
import { isSlug, parseCatalogueParams } from "@/lib/catalogue/params";
import {
  categoryScope,
  getActiveCategories,
  getActiveTags,
  getProductListing,
  resolveTags,
  type ProductListing,
} from "@/lib/catalogue/queries";
import { format, type Messages } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { RecentlyViewed } from "@/components/home/recently-viewed";

type Props = PageProps<"/[lang]/categories/[slug]">;

/** The active category for a slug, from the cached category list (no extra query). */
async function findCategory(slug: string) {
  if (!isSlug(slug)) return null;
  const categories = await getActiveCategories();
  return { categories, category: categories.find((c) => c.slug === slug) ?? null };
}

// Metadata from the real category. Unknown or inactive slugs get a noindex
// "not found" title; the page itself renders the 404.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale, messages] = await Promise.all([params, getLocale(), getMessages()]);
  const category = (await findCategory(slug))?.category;
  if (!category) {
    return { title: messages.errors.notFoundTitle, robots: { index: false, follow: true } };
  }
  return pageMetadata({
    locale,
    path: routes.category(category.slug),
    siteName: messages.site.name,
    title: category.name,
    description:
      category.description?.trim().slice(0, 200) ||
      format(messages.catalogue.categoryIntro, { name: category.name }),
  });
}

/**
 * Canonical category page. It resolves the slug to an active category and
 * renders the same CatalogueView as /products, locked to that category.
 * The slug is only known at request time, so the content streams behind a
 * skeleton (the App Shell); the data itself is cached.
 */
export default async function CategoryPage({ params, searchParams }: Props) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <>
      <Container size="wide" className="py-10 sm:py-14">
        <Suspense fallback={<CategoryPageSkeleton label={messages.catalogue.loading} />}>
          <CategoryCatalogue
            params={params}
            searchParams={searchParams}
            locale={locale}
            messages={messages}
          />
        </Suspense>
      </Container>
      <RecentlyViewed />
    </>
  );
}

async function CategoryCatalogue({
  params,
  searchParams,
  locale,
  messages,
}: Pick<Props, "params" | "searchParams"> & { locale: Locale; messages: Messages }) {
  const { slug } = await params;
  const found = await findCategory(slug);
  if (!found?.category) notFound();
  const { categories, category } = found;
  const t = messages.catalogue;

  // The path carries the category; a stray ?category= is ignored here.
  const state = { ...parseCatalogueParams(await searchParams), category: null };
  const [tags, attributes, optionFilter] = await Promise.all([
    getActiveTags(),
    getFilterAttributes(),
    resolveOptions(state.options),
  ]);
  const tagFilter = resolveTags(tags, state.tags);
  const listing: ProductListing =
    tagFilter.unmatched || optionFilter.unmatched
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
          // A top-level category also lists its subcategories' products, and
          // products whose extra categories include it.
          categoryScope(categories, category.id),
          tagFilter.ids,
          optionFilter.productIds,
        );

  const parent = category.parentId
    ? categories.find((candidate) => candidate.id === category.parentId)
    : undefined;

  return (
    <>
      <Breadcrumbs
        label={t.breadcrumb}
        items={[
          { label: messages.nav.home, href: localizedHref(locale, routes.home) },
          ...(parent
            ? [{ label: parent.name, href: localizedHref(locale, routes.category(parent.slug)) }]
            : []),
          { label: category.name },
        ]}
      />
      <div className="mt-8">
        <SectionHeading
          as="h1"
          id="page-title"
          title={category.name}
          subtitle={
            category.description?.trim() || format(t.categoryIntro, { name: category.name })
          }
        />
      </div>
      <div className="mt-12 sm:mt-14">
        <CatalogueView
          locale={locale}
          messages={messages}
          path={localizedHref(locale, routes.category(category.slug))}
          state={state}
          categories={categories}
          tags={tags}
          attributes={attributes}
          listing={listing}
          currentCategory={category}
        />
      </div>
    </>
  );
}

function CategoryPageSkeleton({ label }: { label: string }) {
  return (
    <>
      <div aria-hidden className="flex flex-col items-center">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="mt-4 h-2 w-6" />
        <Skeleton className="mt-6 h-3 w-72 max-w-full" />
      </div>
      <div className="mt-12 sm:mt-14">
        <CatalogueSkeleton label={label} />
      </div>
    </>
  );
}
