import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { outgoingStream, outgoingHeadlineTotals } from "./outgoing-waste-streams";


describe("outgoingStream", () => {
  it("groups both paper EWC codes as Paper / Card", () => {
    assert.equal(outgoingStream("19 12 01"), "Paper / Card");
    assert.equal(outgoingStream("15 01 01"), "Paper / Card");
  });
  it("falls back to description when EWC unknown", () => {
    assert.equal(outgoingStream("", "paper and cardboard"), "Paper / Card");
    assert.equal(outgoingStream(null, "mystery"), "Other");
  });
  it("reports the Trommel product separately under EWC 19 12 12", () => {
    assert.equal(outgoingStream("19 12 12", null, "TROMMEL"), "Trommel");
    assert.equal(outgoingStream("19 12 12", null, " trommel "), "Trommel");
  });
  it("reports Waste Out product under EWC 19 12 12 as Landfill", () => {
    assert.equal(outgoingStream("19 12 12", null, "WASTE OUT"), "Landfill");
    assert.equal(outgoingStream("19 12 12", null, " waste   out "), "Landfill");
  });
  it("keeps RDF-bound residual separate from Landfill and Trommel", () => {
    assert.equal(outgoingStream("19 12 12", null, "WASTE OUT (FOR RDF)"), "Residual");
  });
  it("does not infer landfill or trommel from destinations or a missing product", () => {
    assert.equal(outgoingStream("19 12 12", null, "Sappahire Cotesbach Landfill"), "Residual");
    assert.equal(outgoingStream("19 12 12"), "Residual");
    assert.equal(outgoingStream("20 03 01", null, "Some Landfill Site"), "Residual");
  });
});
