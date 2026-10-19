import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AddToCart } from "@/components/cart/add-to-cart";
import { Breadcrumbs } from "@/components/catalogue/breadcrumbs";
import { ProductCarousel } from "@/components/catalogue/product-carousel";
import { ProductPrice } from "@/components/catalogue/product-price";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { ProductGallery } from "@/components/product/product-gallery";
import {
  ProductAvailability,
  ProductPurchaseProvider,
  VariantPicker,
  VariantPrice,
  VariantSku,
} from "@/components/product/product-purchase";
import { ProductReviews } from "@/components/product/product-reviews";
import { RatingStars } from "@/components/product/rating-stars";
import { ShareButton } from "@/components/product/share-button";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { isSlug } from "@/lib/catalogue/params";
import { RecordView } from "@/components/product/record-view";
import {
  getProductAvailability,
  getProductDetail,
  getProductTaxonomy,
  getRelatedProducts,
  getVariantAvailability,
} from "@/lib/catalogue/queries";
import { priceRange } from "@/lib/catalogue/variant-selection";
import { toIntlLocale } from "@/lib/format";
import { format, plural, type Messages } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { getProductReviews } from "@/lib/reviews/queries";
import { pageMetadata } from "@/lib/seo";
import type { ProductDetail, ProductSpec } from "@/types/domain";

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
 * streams behind a skeleton; the product data itself is cached. The gallery
 * and the purchase area (variant options, price, SKU, Add to cart) are
 * Client Components; for a product with variants they share the chosen
 * variant through <ProductPurchaseProvider>.
 */
export default async function ProductPage({ params }: Props) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <Suspense
      fallback={
        <Container size="wide" className="py-8 sm:py-12">
          <ProductSkeleton label={messages.product.loading} />
        </Container>
      }
    >
      <ProductDetails params={params} locale={locale} messages={messages} />
    </Suspense>
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
  const hasVariants = product.variants.length > 0;
  // All in parallel, each cached on its own (no waterfall, no N+1).
  const [availability, available, taxonomy, reviews, related] = await Promise.all([
    // Yes/no per variant (never quantities), so sold-out choices can be shown.
    hasVariants
      ? getVariantAvailability(product.variants.map((variant) => variant.id))
      : Promise.resolve({}),
    // Yes/no for the product (with variants: whether any variant is in stock).
    getProductAvailability(product.id),
    // Every category it's listed in, and its tags (mirna-admin 027 / 029).
    getProductTaxonomy(product.id),
    // null until mirna-admin migration 027 (reviews) is applied.
    getProductReviews(product.id),
    getRelatedProducts(product.id, product.category?.slug ?? null),
  ]);
  const rating = reviews && reviews.summary.count > 0 ? reviews.summary : null;
  const ratingText = rating
    ? new Intl.NumberFormat(toIntlLocale(locale), {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(rating.average)
    : "";
  const range = priceRange(product.variants);

  // Basic schema.org Product. No availability: it changes faster than this
  // cached markup. A product with variants gets its price range.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: describe(product, messages),
    sku: product.sku,
    url,
    ...(product.images.length > 0 && { image: product.images.map((image) => image.url) }),
    ...(product.category && { category: product.category.name }),
    ...(rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating.average,
        reviewCount: rating.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    offers: range
      ? {
          "@type": "AggregateOffer",
          url,
          lowPrice: range.min,
          highPrice: range.max,
          offerCount: product.variants.length,
          priceCurrency: product.currencyCode,
        }
      : {
          "@type": "Offer",
          url,
          price: product.price,
          priceCurrency: product.currencyCode,
        },
  };

  // Snapshot for this browser's "Recently viewed" row on the home page.
  const card = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currencyCode: product.currencyCode,
    prices: product.prices,
    category: product.category,
    image: product.images[0] ? { url: product.images[0].url, alt: product.images[0].alt } : null,
    hoverImage: product.images[1]
      ? { url: product.images[1].url, alt: product.images[1].alt }
      : null,
  };

  return (
    <>
      <Container size="wide" className="py-8 sm:py-12">
        <article>
          <RecordView product={card} />
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

          <Purchase product={product} availability={availability}>
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
                {rating && (
                  <a
                    href="#reviews"
                    className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RatingStars rating={rating.average} />
                    <span>
                      {ratingText} · {plural(locale, rating.count, messages.reviews.reviewCount)}
                    </span>
                  </a>
                )}
                {hasVariants ? (
                  <VariantPrice prices={product.prices} />
                ) : (
                  <ProductPrice prices={product.prices} size="lg" align="start" className="mt-5" />
                )}
                {product.shortDescription && (
                  <p className="mt-5 text-sm leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
                    {product.shortDescription}
                  </p>
                )}

                <ProductAvailability available={available} />

                {/* Purchase area: availability is checked again on the server when adding. */}
                <VariantPicker prices={product.prices} />
                <AddToCart
                  productId={product.id}
                  productName={product.name}
                  prices={product.prices}
                  available={available}
                />
                <div className="mt-4 flex items-start gap-3">
                  {/* Saves the product (not a variant): options are chosen when buying. */}
                  <WishlistButton
                    productId={product.id}
                    productName={product.name}
                    variant="detail"
                    className="min-w-0 flex-1"
                  />
                  {/* Same canonical URL and description as the page metadata. */}
                  <ShareButton
                    slug={product.slug}
                    name={product.name}
                    description={describe(product, messages)}
                    variant="detail"
                  />
                </div>

                <section aria-labelledby="product-details" className="mt-8">
                  <h2 id="product-details" className="caps text-[0.6875rem] font-medium">
                    {t.details}
                  </h2>
                  <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
                    {taxonomy.categories.length > 1 ? (
                      <>
                        <dt className="text-muted-foreground">{t.categories}</dt>
                        <dd className="flex flex-wrap gap-x-3 gap-y-1">
                          {taxonomy.categories.map((category) => (
                            <Link
                              key={category.slug}
                              href={localizedHref(locale, routes.category(category.slug))}
                              className="underline underline-offset-4 hover:opacity-70"
                            >
                              {category.name}
                            </Link>
                          ))}
                        </dd>
                      </>
                    ) : (
                      product.category && (
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
                      )
                    )}
                    <dt className="text-muted-foreground">{t.sku}</dt>
                    <dd dir="ltr" className="text-start break-all">
                      <VariantSku fallback={product.sku} />
                    </dd>
                    {product.specs.map((spec) => (
                      <SpecRow key={spec.attributeId} spec={spec} locale={locale} t={t} />
                    ))}
                    {taxonomy.tags.length > 0 && (
                      <>
                        <dt className="text-muted-foreground">{t.tags}</dt>
                        <dd>
                          <ul className="flex flex-wrap gap-2">
                            {taxonomy.tags.map((tag) => (
                              <li key={tag.slug}>
                                <Link
                                  href={`${localizedHref(locale, routes.products)}?tag=${encodeURIComponent(tag.slug)}`}
                                  aria-label={format(t.tagLink, { name: tag.name })}
                                  className="inline-flex min-h-8 items-center border px-2.5 text-xs transition-colors hover:border-foreground"
                                >
                                  {tag.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    )}
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
          </Purchase>

          {reviews && (
            <ProductReviews
              productId={product.id}
              productSlug={product.slug}
              data={reviews}
              locale={locale}
              messages={messages}
            />
          )}
        </article>

        {related.length > 0 && (
          <ProductCarousel
            products={related}
            title={messages.product.related}
            className="mt-16 sm:mt-24"
          />
        )}
      </Container>

      {/* Closes the page, full width, like the shop and category pages. */}
      <RecentlyViewed excludeId={product.id} />
    </>
  );
}

/** Variant state for products with variants; a simple product needs none. */
function Purchase({
  product,
  availability,
  children,
}: {
  product: ProductDetail;
  availability: Record<string, boolean>;
  children: ReactNode;
}) {
  if (product.variants.length === 0) return children;
  return (
    <ProductPurchaseProvider
      options={product.options}
      variants={product.variants}
      availability={availability}
    >
      {children}
    </ProductPurchaseProvider>
  );
}

/** One descriptive attribute in the details list. Values are admin-entered text. */
function SpecRow({
  spec,
  locale,
  t,
}: {
  spec: ProductSpec;
  locale: Locale;
  t: Messages["product"];
}) {
  const { value } = spec;
  let content: ReactNode;
  switch (value.kind) {
    case "text":
      content = <span className="whitespace-pre-line">{value.text}</span>;
      break;
    case "number": {
      const number = new Intl.NumberFormat(toIntlLocale(locale), {
        maximumFractionDigits: 4,
      }).format(value.value as Intl.StringNumericLiteral);
      content = value.unit ? `${number} ${value.unit}` : number;
      break;
    }
    case "boolean":
      content = value.value ? t.yes : t.no;
      break;
    case "choice":
      content = (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {value.values.map((choice) => (
            <span key={choice.label} className="inline-flex items-center gap-1.5">
              {choice.colorHex && (
                <span
                  aria-hidden
                  className="size-3 rounded-full border border-black/10"
                  style={{ backgroundColor: choice.colorHex }}
                />
              )}
              {choice.label}
            </span>
          ))}
        </span>
      );
      break;
  }
  return (
    <>
      <dt className="text-muted-foreground">{spec.name}</dt>
      <dd className="break-words">{content}</dd>
    </>
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
