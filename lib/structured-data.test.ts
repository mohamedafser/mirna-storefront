import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  breadcrumbNode,
  organizationNode,
  productNode,
  serializeJsonLd,
} from "./structured-data.ts";

describe("serializeJsonLd", () => {
  it("escapes < so a value can't close the script tag", () => {
    const json = serializeJsonLd({ "@type": "Thing", name: "</script><script>alert(1)</script>" });
    assert.ok(!json.includes("<"));
    assert.equal(JSON.parse(json).name, "</script><script>alert(1)</script>");
  });

  it("wraps one node with the context, and several in a graph", () => {
    assert.deepEqual(JSON.parse(serializeJsonLd({ "@type": "Thing" })), {
      "@context": "https://schema.org",
      "@type": "Thing",
    });
    assert.deepEqual(JSON.parse(serializeJsonLd([{ "@type": "A" }, { "@type": "B" }])), {
      "@context": "https://schema.org",
      "@graph": [{ "@type": "A" }, { "@type": "B" }],
    });
  });
});

describe("breadcrumbNode", () => {
  it("numbers from 1 and leaves the URL off the current page", () => {
    const node = breadcrumbNode([
      { name: "Home", url: "https://shop.test/en" },
      { name: "Women", url: "https://shop.test/en/categories/women" },
      { name: "Dress", url: "https://shop.test/en/products/dress" },
    ]);
    assert.deepEqual(node.itemListElement, [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://shop.test/en" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Women",
        item: "https://shop.test/en/categories/women",
      },
      { "@type": "ListItem", position: 3, name: "Dress" },
    ]);
  });
});

describe("organizationNode", () => {
  const base = {
    id: "https://shop.test/#organization",
    url: "https://shop.test/en",
    name: "Mirna",
    description: "A store",
    logo: "https://shop.test/logo.png",
  };

  it("leaves out contact details that aren't published", () => {
    const node = organizationNode({ ...base, email: null, telephone: null, sameAs: [] });
    for (const key of ["contactPoint", "address", "sameAs"]) assert.ok(!(key in node), key);
  });

  it("includes the details that are published", () => {
    const node = organizationNode({
      ...base,
      email: "help@shop.test",
      telephone: null,
      address: ["1 Main St", "Dubai"],
      countryCode: "AE",
      sameAs: ["https://instagram.com/shop"],
    });
    assert.deepEqual(node.contactPoint, {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "help@shop.test",
    });
    assert.deepEqual(node.address, {
      "@type": "PostalAddress",
      streetAddress: "1 Main St, Dubai",
      addressCountry: "AE",
    });
    assert.deepEqual(node.sameAs, ["https://instagram.com/shop"]);
  });
});

describe("productNode", () => {
  const base = {
    url: "https://shop.test/en/products/dress",
    name: "Dress",
    description: "A dress",
    sku: "D1",
    currency: "AED",
  };

  it("uses one Offer for a single price, and leaves out what's missing", () => {
    const node = productNode({ ...base, images: [], rating: null, offer: { price: "100.00" } });
    assert.deepEqual(node.offers, {
      "@type": "Offer",
      url: base.url,
      price: "100.00",
      priceCurrency: "AED",
    });
    for (const key of ["image", "category", "aggregateRating"]) assert.ok(!(key in node), key);
  });

  it("uses an AggregateOffer for a price range", () => {
    const node = productNode({
      ...base,
      images: ["https://shop.test/dress.jpg"],
      offer: { lowPrice: "50.00", highPrice: "90.00", count: 3 },
    });
    assert.deepEqual(node.offers, {
      "@type": "AggregateOffer",
      url: base.url,
      lowPrice: "50.00",
      highPrice: "90.00",
      offerCount: 3,
      priceCurrency: "AED",
    });
    assert.deepEqual(node.image, ["https://shop.test/dress.jpg"]);
  });
});
