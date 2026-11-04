import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarize } from "./text.ts";

describe("summarize", () => {
  it("flattens line breaks and keeps short text whole", () => {
    assert.equal(summarize("  One\n\ntwo   three "), "One two three");
  });

  it("cuts long text at a word boundary", () => {
    assert.equal(summarize("alpha beta gamma", 12), "alpha beta…");
  });
});
