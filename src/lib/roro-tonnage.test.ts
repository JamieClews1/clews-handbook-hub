import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quoteRowLabel } from "./roro-tonnage";

describe("quoteRowLabel", () => {
  it("drops the internal Inc 2 / Inc 3 suffix from RoRo rows", () => {
    assert.equal(quoteRowLabel("20 - 40 yd RoRo Inc 2 / Inc 3"), "20 - 40 yd RoRo");
  });

  it("handles spacing variants", () => {
    assert.equal(quoteRowLabel("20-40yd RoRo, inc 2 / inc 3"), "20-40yd RoRo");
    assert.equal(quoteRowLabel("20 - 40 yd RoRo - Inc2 / Inc3"), "20 - 40 yd RoRo");
  });

  it("leaves labels without the suffix untouched", () => {
    assert.equal(quoteRowLabel("6 yd inc 6T"), "6 yd inc 6T");
    assert.equal(quoteRowLabel("8 yd General Waste"), "8 yd General Waste");
    assert.equal(quoteRowLabel(null), "");
  });
});
