import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripeAmount, stripeDecimals } from "./amount.ts";

describe("stripeDecimals", () => {
  it("uses three decimals for KWD, BHD and OMR", () => {
    for (const code of ["KWD", "BHD", "OMR"]) assert.equal(stripeDecimals(code), 3);
  });

  it("uses two decimals for AED, SAR, QAR, USD and GBP", () => {
    for (const code of ["AED", "SAR", "QAR", "USD", "GBP"]) assert.equal(stripeDecimals(code), 2);
  });
});

describe("stripeAmount", () => {
  it("passes the database's minor units through unchanged", () => {
    assert.equal(stripeAmount("AED", 2, 12550), 12550);
    assert.equal(stripeAmount("KWD", 3, 12340), 12340);
  });

  it("refuses a currency whose store decimals differ from Stripe's", () => {
    assert.equal(stripeAmount("KWD", 2, 1234), null);
    assert.equal(stripeAmount("AED", 3, 1234), null);
  });

  it("refuses missing, zero, negative and fractional amounts", () => {
    assert.equal(stripeAmount("AED", null, 100), null);
    assert.equal(stripeAmount("AED", 2, null), null);
    assert.equal(stripeAmount("AED", 2, 0), null);
    assert.equal(stripeAmount("AED", 2, -5), null);
    assert.equal(stripeAmount("AED", 2, 10.5), null);
  });
});
