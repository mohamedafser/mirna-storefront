import { ArrowRight, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/catalogue/catalogue-skeleton";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { CollectionTiles } from "@/components/home/collection-tiles";
import { Hero } from "@/components/home/hero";
import { ProductGridPlaceholder } from "@/components/home/placeholder-grid";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { categoryScope, getActiveCategories, getCategoryProducts } from "@/lib/catalogue/queries";
import { toIntlLocale } from "@/lib/format";
import { getHeroSlides } from "@/lib/home/hero";
import { plural, type Messages } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { getStoreContact, type StoreContact } from "@/lib/store/contact";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const hero = siteConfig.heroImage;
  return pageMetadata({
    locale,
    path: routes.home,
    siteName: messages.site.name,
    // The full brand title, without the "| Mirna" page suffix.
    title: { absolute: messages.site.title },
    description: messages.site.description,
    // Campaign photography once configured; the brand mark until then.
    image: hero ? { url: new URL(hero.src, siteConfig.url).href, alt: hero.alt } : undefined,
  });
}

/**
 * schema.org WebSite (with a search action pointing at the catalogue search,
 * eligible for a sitelinks search box) and Organization for the home page.
 */
function homeJsonLd(locale: Locale, messages: Messages, social: StoreContact["social"]) {
  const absolute = (path: string) => new URL(localizedHref(locale, path), siteConfig.url).href;
  const home = absolute(routes.home);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${home}#website`,
        url: home,
        name: messages.site.name,
        description: messages.site.description,
        inLanguage: toIntlLocale(locale),
        publisher: { "@id": `${home}#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${absolute(routes.products)}?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${home}#organization`,
        name: siteConfig.name,
        url: home,
        logo: new URL("/icons/icon-512.png", siteConfig.url).href,
        ...(social.length > 0 && { sameAs: social.map((profile) => profile.href) }),
      },
    ],
  };
}

const PRODUCTS_PER_CATEGORY = 8;

/**
 * Home page. The catalogue sections use cached, RLS-filtered queries (the
 * active categories, then the newest products of each) shared with the
 * catalogue pages, so they are part of the static shell and refresh within
 * the `minutes` cache lifetime.
 */
export default async function HomePage() {
  const [locale, messages, heroSlides, { contact }] = await Promise.all([
    getLocale(),
    getMessages(),
    getHeroSlides(),
    // Same cached call as the footer: no extra request.
    getStoreContact(),
  ]);
  const t = messages.home;

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped: safe inside <script>.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeJsonLd(locale, messages, contact.social)).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      <Hero locale={locale} t={t.hero} slides={heroSlides} />

      {/* Featured collections: one bordered section per top-level category. */}
      <Suspense
        fallback={
          <div className="py-14 lg:py-24">
            <Container size="wide">
              <ProductGridSkeleton items={4} />
            </Container>
          </div>
        }
      >
        <FeaturedCollections locale={locale} messages={messages} />
      </Suspense>

      <Suspense fallback={null}>
        <Collections />
      </Suspense>
    </>
  );
}

/**
 * One "Featured collection" section per top-level category (Women, Kids, …)
 * that has products, in admin display order. Mirna's own layout: a large
 * numbered index (01, 02 …) beside the eyebrow, piece count and category
 * name, a "View all" arrow link at the inline end, the newest products
 * (subcategories included) in a 2 / 4 column grid, and every other section
 * on the soft brand tint.
 */
async function FeaturedCollections({ locale, messages }: { locale: Locale; messages: Messages }) {
  const t = messages.home;
  const all = await getActiveCategories();
  const ids = new Set(all.map((category) => category.id));
  // Top level, or a subcategory whose parent is hidden (inactive).
  const roots = all.filter(
    (category) => category.productCount > 0 && (!category.parentId || !ids.has(category.parentId)),
  );
  const rows = await Promise.all(
    roots.map(async (category) => ({
      category,
      products: await getCategoryProducts(categoryScope(all, category.id), PRODUCTS_PER_CATEGORY),
    })),
  );
  const filled = rows.filter((row) => row.products.length > 0);

  if (filled.length === 0) {
    return (
      <div className="py-14 lg:py-24">
        <Container size="wide">
          <ProductGridPlaceholder
            icon={Sparkles}
            title={t.latest.emptyTitle}
            description={t.latest.emptyBody}
          />
        </Container>
      </div>
    );
  }
  return filled.map(({ category, products }, index) => {
    const headingId = `featured-${category.slug}`;
    const categoryHref = localizedHref(locale, routes.category(category.slug));
    return (
      <section
        key={category.id}
        aria-labelledby={headingId}
        // Every other collection sits on the soft brand tint, so sections read
        // as distinct "rooms" rather than one long list.
        className={cn("py-14 lg:py-24", index % 2 === 1 && "bg-brand-soft/45")}
      >
        <Container size="wide">
          <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 lg:mb-12">
            <div className="flex items-end gap-5">
              <span
                aria-hidden
                className="font-display text-5xl leading-none font-light text-muted-foreground/40 tabular-nums sm:text-6xl"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="caps text-[0.625rem] font-medium text-muted-foreground">
                  {t.featured.eyebrow}
                  <span className="mx-2">·</span>
                  {plural(locale, category.productCount, t.featured.pieces)}
                </p>
                <h2
                  id={headingId}
                  className="mt-2 font-display text-2xl leading-tight font-medium break-words sm:text-3xl"
                >
                  {category.name}
                </h2>
              </div>
            </div>
            <Link
              href={categoryHref}
              className="group/link caps hidden items-center gap-3 text-[0.6875rem] font-medium sm:inline-flex"
            >
              {t.featured.viewAll}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-300 group-hover/link:translate-x-1 rtl:-scale-x-100 rtl:group-hover/link:-translate-x-1"
              />
            </Link>
          </header>
          <ProductGrid
            products={products}
            locale={locale}
            t={messages.catalogue}
            headingLevel="h3"
            // Below the full-screen hero: lazy, so the hero image loads first.
            eager={0}
          />
          {/* Phones: the "view all" link moves under the products. */}
          <div className="mt-10 text-center sm:hidden">
            <Link
              href={categoryHref}
              className="btn-wipe caps inline-flex h-12 w-full items-center justify-center px-8 text-xs font-medium [--wipe-bg:var(--brand)] [--wipe-fg:var(--brand-foreground)]"
            >
              {t.featured.viewAll}
            </Link>
          </div>
        </Container>
      </section>
    );
  });
}

/**
 * Collection tiles after the featured sections: the main (top-level)
 * categories that have products, those with a photo first, in display
 * order; up to four (two rows of the two-column layout). Like the featured sections, a subcategory whose parent is
 * hidden counts as a main category.
 */
async function Collections() {
  const all = await getActiveCategories();
  const ids = new Set(all.map((category) => category.id));
  const tiles = all
    .filter(
      (category) =>
        category.productCount > 0 && (!category.parentId || !ids.has(category.parentId)),
    )
    .sort((a, b) => Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl)))
    .slice(0, 4)
    .map(({ id, name, slug, imageUrl, productCount }) => ({
      id,
      name,
      slug,
      imageUrl,
      productCount,
    }));
  if (tiles.length === 0) return null;
  return <CollectionTiles tiles={tiles} />;
}
