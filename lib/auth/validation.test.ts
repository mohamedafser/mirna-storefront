import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeCode, validateCode } from "./validation.ts";

describe("normalizeCode", () => {
  it("accepts other digit scripts and pasted separators", () => {
    assert.equal(normalizeCode("٠١٢٣٤٥"), "012345");
    assert.equal(normalizeCode("۰۱۲۳۴۵"), "012345");
    assert.equal(normalizeCode(" 012 345 "), "012345");
    assert.equal(normalizeCode("012-345"), "012345");
  });
});

describe("validateCode", () => {
  it("wants exactly six digits", () => {
    assert.deepEqual(validateCode("012345"), {});
    assert.deepEqual(validateCode(""), { code: "codeRequired" });
    assert.deepEqual(validateCode("12345"), { code: "codeInvalid" });
    assert.deepEqual(validateCode("1234567"), { code: "codeInvalid" });
    assert.deepEqual(validateCode("12a456"), { code: "codeInvalid" });
  });
});
