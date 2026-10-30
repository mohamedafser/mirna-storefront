import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bestPercentOff,
  percentOff,
  cardPrice,
  decimalToMinor,
  formatMinor,
  legacyPriceRows,
  lookupPrice,
  minorToDecimal,
  payable,
  resolveCurrency,
  type PriceRow,
} from "./money.ts";

// Intl separates a code from the amount with a (narrow) no-break space.
const plain = (text: string) => text.replace(/[  ]/g, " ");

describe("formatMinor", () => {
  it("shows three decimals for BHD and KWD", () => {
    assert.equal(plain(formatMinor(1500, { code: "BHD", decimals: 3 }, "en-BH")), "BHD 1.500");
    assert.equal(plain(formatMinor(12345, { code: "KWD", decimals: 3 }, "en-KW")), "KWD 12.345");
    assert.equal(plain(formatMinor(1, { code: "KWD", decimals: 3 }, "en-KW")), "KWD 0.001");
  });

  it("shows two decimals for the others", () => {
    assert.equal(formatMinor(123456, { code: "INR", decimals: 2 }, "en-IN"), "₹1,234.56");
    assert.equal(formatMinor(1999, { code: "USD", decimals: 2 }, "en-US"), "$19.99");
    assert.equal(formatMinor(2500, { code: "GBP", decimals: 2 }, "en-GB"), "£25.00");
    assert.equal(plain(formatMinor(995, { code: "EUR", decimals: 2 }, "de-DE")), "9,95 €");
  });

  it("is exact for large amounts", () => {
    assert.equal(
      formatMinor("99999999999999", { code: "USD", decimals: 2 }, "en-US"),
      "$999,999,999,999.99",
    );
  });

  it("uses Arabic digits in Arabic", () => {
    assert.match(formatMinor(1500, { code: "BHD", decimals: 3 }, "ar-BH"), /١٫٥٠٠/);
  });
});

describe("minorToDecimal", () => {
  it("pads to the currency's decimals", () => {
    assert.equal(minorToDecimal(1500, 3), "1.500");
    assert.equal(minorToDecimal(7, 2), "0.07");
    assert.equal(minorToDecimal(42, 0), "42");
  });
});

const rows: PriceRow[] = [
  { variantId: null, currency: "INR", price: 149900, salePrice: 129900 },
  { variantId: null, currency: "BHD", price: 7500, salePrice: null },
  { variantId: "v-large", currency: "BHD", price: 8250, salePrice: null },
  { variantId: "v-large", currency: "KWD", price: 6000, salePrice: null },
  { variantId: "v-small", currency: "KWD", price: 5500, salePrice: 5000 },
];

describe("lookupPrice", () => {
  it("uses the variant's own price, else the product's", () => {
    assert.deepEqual(lookupPrice(rows, "BHD", "v-large"), { price: 8250, salePrice: null });
    assert.deepEqual(lookupPrice(rows, "BHD", "v-small"), { price: 7500, salePrice: null });
    assert.deepEqual(lookupPrice(rows, "INR"), { price: 149900, salePrice: 129900 });
  });

  it("returns null when no price was set (never converts)", () => {
    assert.equal(lookupPrice(rows, "USD"), null);
    assert.equal(lookupPrice(rows, "KWD"), null);
    assert.equal(lookupPrice(rows, "INR", "v-unknown")?.price, 149900);
  });
});

describe("payable / cardPrice", () => {
  it("pays the sale price when there is one", () => {
    assert.equal(payable({ price: 149900, salePrice: 129900 }), 129900);
    assert.equal(payable({ price: 7500, salePrice: null }), 7500);
  });

  it("shows the product price, else the lowest variant price", () => {
    assert.deepEqual(cardPrice(rows, "BHD"), { price: 7500, salePrice: null, from: false });
    assert.deepEqual(cardPrice(rows, "KWD"), { price: 5500, salePrice: 5000, from: true });
    assert.equal(cardPrice(rows, "USD"), null);
  });
});

describe("resolveCurrency", () => {
  const currencies = [
    { code: "INR", symbol: "₹", decimals: 2, isDefault: true },
    { code: "BHD", symbol: "BD", decimals: 3, isDefault: false },
  ];

  it("keeps an active choice and falls back to the default", () => {
    assert.equal(resolveCurrency(currencies, "BHD")?.code, "BHD");
    assert.equal(resolveCurrency(currencies, "USD")?.code, "INR");
    assert.equal(resolveCurrency(currencies, null)?.code, "INR");
    assert.equal(resolveCurrency([], "INR"), null);
  });
});

describe("legacy prices (before per-currency prices)", () => {
  it("converts NUMERIC strings to minor units, rounding half up", () => {
    assert.equal(decimalToMinor("99.5", 2), 9950);
    assert.equal(decimalToMinor("12.345", 2), 1235);
    assert.equal(decimalToMinor("12.344", 2), 1234);
    assert.equal(decimalToMinor("1.5", 3), 1500);
    assert.equal(decimalToMinor("7", 0), 7);
  });

  it("maps compare-at to the regular price and the price to the sale price", () => {
    assert.deepEqual(
      legacyPriceRows({ code: "AED", decimals: 2 }, [
        { variantId: null, price: "99.5", compareAt: "120" },
        { variantId: "v1", price: "80", compareAt: null },
        { variantId: "v2", price: "0", compareAt: null },
      ]),
      [
        { variantId: null, currency: "AED", price: 12000, salePrice: 9950 },
        { variantId: "v1", currency: "AED", price: 8000, salePrice: null },
      ],
    );
  });
});

describe("percentOff", () => {
  it("rounds down so a discount is never overstated", () => {
    assert.equal(percentOff({ price: 10000, salePrice: 7500 }), 25);
    assert.equal(percentOff({ price: 3000, salePrice: 2000 }), 33);
    assert.equal(percentOff({ price: 1999, salePrice: 1000 }), 49);
  });

  it("is at least 1 and null without a real sale", () => {
    assert.equal(percentOff({ price: 100000, salePrice: 99999 }), 1);
    assert.equal(percentOff({ price: 1000, salePrice: null }), null);
    assert.equal(percentOff({ price: 1000, salePrice: 1000 }), null);
  });

  it("stays exact for large amounts", () => {
    assert.equal(percentOff({ price: 99999999999999, salePrice: 49999999999999 }), 50);
  });
});

describe("bestPercentOff", () => {
  const row = (
    variantId: string | null,
    price: number,
    salePrice: number | null,
    currency = "AED",
  ) => ({ variantId, currency, price, salePrice });

  it("gives the discount of the prices that are on sale", () => {
    assert.equal(bestPercentOff([row(null, 200, 150)], "AED"), 25);
    // Variants on sale, the product's own price not: still their discount.
    assert.equal(
      bestPercentOff(
        [row("a", 90000, 79900), row("b", 90000, 79900), row(null, 79900, null)],
        "AED",
      ),
      11,
    );
  });

  it("takes the biggest when discounts differ", () => {
    assert.equal(bestPercentOff([row("a", 100, 70), row("b", 100, 90)], "AED"), 30);
  });

  it("only looks at the visitor's currency", () => {
    assert.equal(bestPercentOff([row(null, 200, 150, "SAR"), row(null, 200, null)], "AED"), null);
  });
});
