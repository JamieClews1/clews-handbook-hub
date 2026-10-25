import { it } from "node:test";
import assert from "node:assert/strict";
import { applyBookingKind, wasteOutEstimate } from "./waste-out-job";

it("waste out clears customer pricing and sets Clews as producer", () => {
  const f = applyBookingKind({ customer_name: "Acme", haulage_cost: 200, charge_per_tonne: 90, rental_enabled: true }, "waste_out");
  assert.equal(f.job_type, "waste_out_skip");
  assert.equal(f.customer_name, "Clews Recycling");
  assert.equal(f.haulage_cost, "");
  assert.equal(f.charge_per_tonne, "");
  assert.equal(f.rental_enabled, false);
});

it("gate fee estimate is rate × tonnes", () => {
  assert.deepEqual(wasteOutEstimate({ waste_out_estimate_type: "gate_fee", waste_out_estimate_per_tonne: 95, weight_included_t: 8.5 }), { type: "gate_fee", total: 807.5 });
});

it("no estimate without a type", () => {
  assert.equal(wasteOutEstimate({ waste_out_estimate_type: "", waste_out_estimate_per_tonne: 95, weight_included_t: 8 }), null);
});
