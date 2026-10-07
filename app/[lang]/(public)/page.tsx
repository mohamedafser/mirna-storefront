import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/catalogue/catalogue-skeleton";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { CategoryTiles, CategoryTilesPlaceholder } from "@/components/home/category-tiles";
import { Hero } from "@/components/home/hero";
import { ProductGridPlaceholder } from "@/components/home/placeholder-grid";
import { PromoBanner } from "@/components/home/promo-banner";
import { SectionHeading } from "@/components/home/section-heading";
import { buttonClassName } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { getActiveCategories, getLatestProducts } from "@/lib/catalogue/queries";
import { toIntlLocale } from "@/lib/format";
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

const LATEST_PRODUCTS = 8;
const CATEGORY_TILES = 3;

/**
 * Home page. The catalogue sections use two cached, RLS-filtered queries
 * (the newest active products, the active categories) shared with the
 * catalogue pages, so they are part of the static shell and refresh within
 * the `minutes` cache lifetime.
 */
export default async function HomePage() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
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
      <Hero locale={locale} t={t.hero} />

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
            <LatestProducts locale={locale} messages={messages} />
          </Suspense>
          <div className="mt-14 text-center">
            <Link href={href(routes.products)} className={buttonClassName()}>
              {t.latest.viewAll}
            </Link>
          </div>
        </Container>
      </section>

      <PromoBanner
        id="promo-title"
        eyebrow={t.promo.eyebrow}
        title={t.promo.title}
        body={t.promo.body}
        action={{ href: href(routes.products), label: t.promo.cta }}
      />

      <div className="pt-16 sm:pt-24">
        <Suspense fallback={<Skeleton className="h-[26rem] sm:h-[36rem] lg:h-[40rem]" />}>
          <FeaturedCategories locale={locale} messages={messages} />
        </Suspense>
      </div>
    </>
  );
}

async function LatestProducts({ locale, messages }: { locale: Locale; messages: Messages }) {
  const products = await getLatestProducts(LATEST_PRODUCTS);
  if (products.length === 0) {
    return (
      <ProductGridPlaceholder
        icon={Sparkles}
        title={messages.home.latest.emptyTitle}
        description={messages.home.latest.emptyBody}
      />
    );
  }
  return (
    <ProductGrid
      products={products}
      locale={locale}
      t={messages.catalogue}
      className="mt-12 sm:mt-14"
    />
  );
}

async function FeaturedCategories({ locale, messages }: { locale: Locale; messages: Messages }) {
  const t = messages.home.categories;
  const categories = (await getActiveCategories()).slice(0, CATEGORY_TILES);
  const action = { href: localizedHref(locale, routes.categories), label: t.viewAll };
  if (categories.length === 0) {
    return (
      <CategoryTilesPlaceholder
        id="categories-title"
        eyebrow={t.title}
        title={t.emptyTitle}
        description={t.emptyBody}
        action={action}
      />
    );
  }
  return (
    <CategoryTiles
      id="categories-title"
      title={t.title}
      categories={categories}
      locale={locale}
      t={messages.catalogue}
      action={action}
    />
  );
}
