import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { outgoingStream, outgoingHeadlineTotals, outgoingPercentage, outgoingYearChange } from "./outgoing-waste-streams";


describe("outgoing annual comparisons", () => {
  it("shows waste out divided by waste in, without capping at 100%", () => {
    assert.equal(outgoingPercentage(120, 100), 120);
    assert.equal(outgoingPercentage(50, 100), 50);
    assert.equal(outgoingPercentage(10, 0), null);
  });
  it("compares tonnes with the previous year", () => {
    assert.equal(outgoingYearChange(120, 100), 20);
    assert.equal(outgoingYearChange(80, 100), -20);
    assert.equal(outgoingYearChange(100, 0), null);
  });
});

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

describe("outgoingHeadlineTotals", () => {
  const rows = [
    { ewc: "19 12 12", waste_description: null, product: "WASTE OUT", weight_t: 1000 },
    { ewc: "19 12 10", waste_description: null, product: null, weight_t: 2000 },
    { ewc: "19 12 12", waste_description: null, product: "TROMMEL", weight_t: 3000 },
    { ewc: "15 01 01", waste_description: null, product: null, weight_t: 4000 },
  ];

  it("totals tonnes out from kilogram weights", () => {
    assert.equal(outgoingHeadlineTotals(rows).total, 10);
  });

  it("zero to landfill excludes only recorded Waste Out landfill loads", () => {
    const r = outgoingHeadlineTotals(rows);
    assert.equal(r.landfill, 1);
    assert.equal(r.zeroToLandfill, 9);
  });

  it("recycling excludes landfill and RDF", () => {
    const r = outgoingHeadlineTotals(rows);
    assert.equal(r.rdf, 2);
    assert.equal(r.recycling, 7);
  });

  it("counts residual loads with no recorded product as zero to landfill", () => {
    const r = outgoingHeadlineTotals([{ ewc: "20 03 01", waste_description: null, product: null, weight_t: 5000 }]);
    assert.equal(r.zeroToLandfill, 5);
    assert.equal(r.recycling, 5);
  });

  it("returns zeros when there are no outgoing loads", () => {
    assert.deepEqual(outgoingHeadlineTotals([]), { total: 0, landfill: 0, rdf: 0, zeroToLandfill: 0, recycling: 0 });
  });
});

