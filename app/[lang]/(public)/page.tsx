import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/catalogue/catalogue-skeleton";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { Hero } from "@/components/home/hero";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { ProductGridPlaceholder } from "@/components/home/placeholder-grid";
import { SectionHeading } from "@/components/home/section-heading";
import { buttonClassName } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { categoryScope, getActiveCategories, getCategoryProducts } from "@/lib/catalogue/queries";
import { toIntlLocale } from "@/lib/format";
import { getHeroSlides } from "@/lib/home/hero";
import type { Messages } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

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
function homeJsonLd(locale: Locale, messages: Messages) {
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
        ...(siteConfig.social.length > 0 && {
          sameAs: siteConfig.social.map((profile) => profile.href),
        }),
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
  const [locale, messages, heroSlides] = await Promise.all([
    getLocale(),
    getMessages(),
    getHeroSlides(),
  ]);
  const t = messages.home;
  const href = (path: string) => localizedHref(locale, path);

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped: safe inside <script>.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeJsonLd(locale, messages)).replace(/</g, "\\u003c"),
        }}
      />
      <Hero locale={locale} t={t.hero} slides={heroSlides} />

      <section aria-labelledby="latest-title" className="py-16 sm:py-24">
        <Container size="wide">
          <SectionHeading id="latest-title" title={t.latest.title} subtitle={t.latest.subtitle} />
          <Suspense
            fallback={
              <div className="mt-12 sm:mt-14">
                <ProductGridSkeleton items={4} />
              </div>
            }
          >
            <CategoryRows locale={locale} messages={messages} />
          </Suspense>
          <div className="mt-14 text-center">
            <Link href={href(routes.products)} className={buttonClassName()}>
              {t.latest.viewAll}
            </Link>
          </div>
        </Container>
      </section>

      <RecentlyViewed />
    </>
  );
}

/**
 * One row per top-level category (Women, Kids, …) that has products, in admin
 * display order: its name, its newest products (subcategories included) and a
 * link to its page. Products of different top-level categories never share a
 * row.
 */
async function CategoryRows({ locale, messages }: { locale: Locale; messages: Messages }) {
  const t = messages.home.latest;
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
      <ProductGridPlaceholder icon={Sparkles} title={t.emptyTitle} description={t.emptyBody} />
    );
  }
  return (
    <div className="mt-12 grid gap-16 sm:mt-14 sm:gap-20">
      {filled.map(({ category, products }) => {
        const headingId = `category-row-${category.slug}`;
        return (
          <section key={category.id} aria-labelledby={headingId}>
            <div className="mb-6 flex items-end justify-between gap-4 border-b pb-3 sm:mb-8">
              <h3 id={headingId} className="caps text-xs font-medium sm:text-[0.8125rem]">
                {category.name}
              </h3>
              <Link
                href={localizedHref(locale, routes.category(category.slug))}
                className="caps shrink-0 text-[0.6875rem] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t.viewCategory}
              </Link>
            </div>
            <ProductGrid
              products={products}
              locale={locale}
              t={messages.catalogue}
              headingLevel="h4"
            />
          </section>
        );
      })}
    </div>
  );
}
