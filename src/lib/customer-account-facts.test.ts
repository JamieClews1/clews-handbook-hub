import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summariseAccountFacts } from "./customer-account-facts";

const today = new Date("2026-11-04T08:00:00Z");

describe("summariseAccountFacts", () => {
  it("totals loads, tonnes and month range", () => {
    const f = summariseAccountFacts([
      { job_date: "2026-01-10", weight_t: 10.25, waste_description: "Wood" },
      { job_date: "2026-10-02", weight_t: 5, waste_description: "Wood" },
      { job_date: "2026-03-02", weight_t: 1, waste_description: "Metals" },
    ], null, today);
    assert.equal(f.loads, 3);
    assert.equal(f.tonnes, 16.3);
    assert.equal(f.range, "Jan–Oct");
    assert.deepEqual(f.topStreams, ["Wood", "Metals"]);
  });
  it("converts Midweigh kilograms to tonnes and prefers product names", () => {
    const f = summariseAccountFacts([{ job_date: "2026-05-01", weight_t: 12400, waste_description: "wood other than…", source: "midweigh", product: "Wood" }], null, today);
    assert.equal(f.tonnes, 12.4);
    assert.deepEqual(f.topStreams, ["Wood"]);
  });
  it("flags missing, undated and expired licences", () => {
    assert.equal(summariseAccountFacts([], null, today).dutyOfCare.state, "missing");
    assert.equal(summariseAccountFacts([], { waste_carrier_licence: "CBDU1" }, today).dutyOfCare.state, "no-expiry");
    assert.equal(summariseAccountFacts([], { waste_carrier_licence: "CBDU1", waste_carrier_licence_expiry: "2026-01-01" }, today).dutyOfCare.state, "expired");
    assert.equal(summariseAccountFacts([], { waste_carrier_licence: "CBDU1", waste_carrier_licence_expiry: "2027-01-01" }, today).dutyOfCare.state, "ok");
  });
});
