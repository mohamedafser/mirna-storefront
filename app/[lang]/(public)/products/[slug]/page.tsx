import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { ProductPrice } from "@/components/catalogue/product-price";
import { ProductGallery } from "@/components/product/product-gallery";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { isSlug } from "@/lib/catalogue/params";
import { getProductDetail } from "@/lib/catalogue/queries";
import { format, type Messages } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";
import type { ProductDetail } from "@/types/domain";

type Props = PageProps<"/[lang]/products/[slug]">;

/** Active product for a slug, or null. Cached, so metadata and page share one query. */
async function findProduct(slug: string): Promise<ProductDetail | null> {
  return isSlug(slug) ? getProductDetail(slug) : null;
}

/** Plain-text summary for meta description / JSON-LD, cut at a word boundary. */
function summary(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function describe(product: ProductDetail, messages: Messages): string {
  const text = product.shortDescription ?? product.description;
  return text ? summary(text) : format(messages.product.metaFallback, { name: product.name });
}

// Real product metadata (title, description, canonical, hreflang, Open Graph
// with the primary image). Unknown or inactive products get a noindex
// "not found" title and no product details.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale, messages] = await Promise.all([params, getLocale(), getMessages()]);
  const product = await findProduct(slug);
  if (!product) {
    return { title: messages.product.notFoundTitle, robots: { index: false, follow: true } };
  }
  const image = product.images[0];
  return pageMetadata({
    locale,
    path: routes.product(product.slug),
    siteName: messages.site.name,
    title: product.name,
    description: describe(product, messages),
    image: image ? { url: image.url, alt: image.alt ?? product.name } : undefined,
  });
}

/**
 * Product details. The slug is only known at request time, so the content
 * streams behind a skeleton; the product data itself is cached. Only the
 * gallery is a Client Component.
 */
export default async function ProductPage({ params }: Props) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <Container size="wide" className="py-8 sm:py-12">
      <Suspense fallback={<ProductSkeleton label={messages.product.loading} />}>
        <ProductDetails params={params} locale={locale} messages={messages} />
      </Suspense>
    </Container>
  );
}

async function ProductDetails({
  params,
  locale,
  messages,
}: Pick<Props, "params"> & { locale: Locale; messages: Messages }) {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) notFound();
  const t = messages.product;
  const url = new URL(localizedHref(locale, routes.product(product.slug)), siteConfig.url).href;

  // Basic schema.org Product. No availability: stock is not public yet.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: describe(product, messages),
    sku: product.sku,
    url,
    ...(product.images.length > 0 && { image: product.images.map((image) => image.url) }),
    ...(product.category && { category: product.category.name }),
    offers: {
      "@type": "Offer",
      url,
      price: product.price,
      priceCurrency: product.currencyCode,
    },
  };

  return (
    <article>
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped: safe inside <script>.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <Breadcrumbs
        label={messages.catalogue.breadcrumb}
        align="start"
        items={[
          { label: messages.nav.home, href: localizedHref(locale, routes.home) },
          product.category
            ? {
                label: product.category.name,
                href: localizedHref(locale, routes.category(product.category.slug)),
              }
            : {
                label: messages.catalogue.productsTitle,
                href: localizedHref(locale, routes.products),
              },
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid gap-8 sm:mt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 xl:gap-20">
        <ProductGallery name={product.name} images={product.images} />

        <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
          {product.category && (
            <Link
              href={localizedHref(locale, routes.category(product.category.slug))}
              className="caps text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              {product.category.name}
            </Link>
          )}
          <h1 className="caps mt-3 text-lg leading-snug font-medium break-words sm:text-xl">
            {product.name}
          </h1>
          <ProductPrice
            product={product}
            locale={locale}
            t={messages.catalogue}
            size="lg"
            align="start"
            className="mt-5"
          />
          {product.shortDescription && (
            <p className="mt-5 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
              {product.shortDescription}
            </p>
          )}

          {/* Purchase area: Phase 9 adds Add to Cart here. Until then, a plain note. */}
          <p className="mt-8 border-y py-4 text-sm text-muted-foreground">{t.orderingSoon}</p>

          <section aria-labelledby="product-details" className="mt-8">
            <h2 id="product-details" className="caps text-[0.6875rem] font-medium">
              {t.details}
            </h2>
            <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
              {product.category && (
                <>
                  <dt className="text-muted-foreground">{t.category}</dt>
                  <dd>
                    <Link
                      href={localizedHref(locale, routes.category(product.category.slug))}
                      className="underline underline-offset-4 hover:opacity-70"
                    >
                      {product.category.name}
                    </Link>
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">{t.sku}</dt>
              <dd dir="ltr" className="text-start break-all">
                {product.sku}
              </dd>
            </dl>
          </section>

          {product.description && (
            <section aria-labelledby="product-description" className="mt-10">
              <h2 id="product-description" className="caps text-[0.6875rem] font-medium">
                {t.description}
              </h2>
              {/* Plain text from the admin textarea: line breaks kept, never parsed as HTML. */}
              <p className="mt-4 text-sm leading-relaxed text-pretty break-words whitespace-pre-line">
                {product.description}
              </p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}

function ProductSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <Skeleton className="h-2.5 w-48" />
      <div className="mt-6 grid gap-8 sm:mt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 xl:gap-20">
        <Skeleton className="aspect-[4/5]" />
        <div>
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-4 h-5 w-3/4" />
          <Skeleton className="mt-6 h-5 w-32" />
          <Skeleton className="mt-6 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-5/6" />
          <Skeleton className="mt-10 h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
