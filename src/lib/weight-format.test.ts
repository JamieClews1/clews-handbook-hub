import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatKgAsTonnes, formatTonnes } from "./weight-format";

describe("weight format", () => {
  it("always shows tonnes to 3 decimal places", () => {
    assert.equal(formatTonnes(0.6), "0.600");
    assert.equal(formatTonnes(12), "12.000");
  });
  it("converts kilograms to tonnes", () => {
    assert.equal(formatKgAsTonnes(600), "0.600");
    assert.equal(formatKgAsTonnes(18250), "18.250");
  });
  it("shows a dash when there is no weight", () => {
    assert.equal(formatTonnes(null), "—");
    assert.equal(formatKgAsTonnes(undefined, "-"), "-");
  });
});
