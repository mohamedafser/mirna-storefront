/**
 * schema.org JSON-LD builders. Each returns one node; render them with
 * <JsonLd> (components/seo/json-ld.tsx). They only describe what the caller
 * passes in, which must be real data shown on the page: a value that is missing
 * is left out of the markup, never filled with a placeholder. URLs are absolute
 * (absoluteUrl() in lib/seo.ts).
 *
 * Plain functions with no app imports, so they can be unit tested.
 */

export type JsonLdNode = Record<string, unknown>;

/** Serialized for a <script> tag: "<" is escaped, so a value can't close the tag. */
export function serializeJsonLd(nodes: JsonLdNode | readonly JsonLdNode[]): string {
  const data = Array.isArray(nodes)
    ? { "@context": "https://schema.org", "@graph": nodes }
    : { "@context": "https://schema.org", ...nodes };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function websiteNode({
  id,
  url,
  name,
  description,
  language,
  publisherId,
  searchUrlTemplate,
}: {
  id: string;
  url: string;
  name: string;
  description: string;
  language: string;
  publisherId: string;
  /** Catalogue search, with {search_term_string} where the query goes. */
  searchUrlTemplate: string;
}): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": id,
    url,
    name,
    description,
    inLanguage: language,
    publisher: { "@id": publisherId },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: searchUrlTemplate },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationNode({
  id,
  url,
  name,
  description,
  logo,
  sameAs = [],
  email,
  telephone,
  address = [],
  countryCode,
}: {
  id: string;
  url: string;
  name: string;
  description: string;
  logo: string;
  /** Published social profiles. */
  sameAs?: readonly string[];
  email?: string | null;
  telephone?: string | null;
  address?: readonly string[];
  countryCode?: string | null;
}): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": id,
    url,
    name,
    description,
    logo,
    ...(sameAs.length > 0 && { sameAs }),
    ...((email || telephone) && {
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        ...(email && { email }),
        ...(telephone && { telephone }),
      },
    }),
    ...(address.length > 0 && {
      address: {
        "@type": "PostalAddress",
        streetAddress: address.join(", "),
        ...(countryCode && { addressCountry: countryCode }),
      },
    }),
  };
}

/**
 * The trail shown on the page, in order. The last entry is the current page,
 * which Google doesn't need a URL for.
 */
export function breadcrumbNode(items: ReadonlyArray<{ name: string; url?: string }>): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url && index < items.length - 1 && { item: item.url }),
    })),
  };
}

/** A category page. */
export function collectionPageNode({
  url,
  name,
  description,
  language,
}: {
  url: string;
  name: string;
  description: string;
  language: string;
}): JsonLdNode {
  return { "@type": "CollectionPage", url, name, description, inLanguage: language };
}

/**
 * A product page. `offer` is one price or, for a product with variants, the
 * range. No availability: it changes faster than this cached markup.
 */
export function productNode({
  url,
  name,
  description,
  sku,
  images,
  category,
  rating,
  currency,
  offer,
}: {
  url: string;
  name: string;
  description: string;
  sku: string;
  images: readonly string[];
  category?: string | null;
  /** Only when the product has reviews. */
  rating?: { average: number; count: number } | null;
  currency: string;
  offer:
    | { price: string | number }
    | { lowPrice: string | number; highPrice: string | number; count: number };
}): JsonLdNode {
  return {
    "@type": "Product",
    name,
    description,
    sku,
    url,
    ...(images.length > 0 && { image: images }),
    ...(category && { category }),
    ...(rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating.average,
        reviewCount: rating.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    offers:
      "price" in offer
        ? { "@type": "Offer", url, price: offer.price, priceCurrency: currency }
        : {
            "@type": "AggregateOffer",
            url,
            lowPrice: offer.lowPrice,
            highPrice: offer.highPrice,
            offerCount: offer.count,
            priceCurrency: currency,
          },
  };
}
