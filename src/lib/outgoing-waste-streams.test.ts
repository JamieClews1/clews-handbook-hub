import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { outgoingStream } from "./outgoing-waste-streams";

describe("outgoingStream", () => {
  it("groups both paper EWC codes as Paper / Card", () => {
    assert.equal(outgoingStream("19 12 01"), "Paper / Card");
    assert.equal(outgoingStream("15 01 01"), "Paper / Card");
  });
  it("falls back to description when EWC unknown", () => {
    assert.equal(outgoingStream("", "paper and cardboard"), "Paper / Card");
    assert.equal(outgoingStream(null, "mystery"), "Other");
  });
  it("splits 19 12 12 into Residual vs Trommel fines (landfill) by destination", () => {
    assert.equal(outgoingStream("19 12 12", null, "Crown Waste Management"), "Residual");
    assert.equal(outgoingStream("19 12 12", null, "Sappahire Cotesbach Landfill"), "Trommel fines (landfill)");
    assert.equal(outgoingStream("19 12 12"), "Residual");
    assert.equal(outgoingStream("20 03 01", null, "Some Landfill Site"), "Trommel fines (landfill)");
  });
});
