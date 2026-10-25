import { describe, expect, it } from "vitest";
import { applyBookingKind, wasteOutEstimate } from "./waste-out-job";

describe("waste out booking", () => {
  it("clears customer pricing and sets Clews as producer", () => {
    const f = applyBookingKind({ customer_name: "Acme", haulage_cost: 200, charge_per_tonne: 90, rental_enabled: true }, "waste_out");
    expect(f).toMatchObject({ job_type: "waste_out_skip", customer_name: "Clews Recycling", haulage_cost: "", charge_per_tonne: "", rental_enabled: false });
  });
  it("estimates gate fee as rate × tonnes", () => {
    expect(wasteOutEstimate({ waste_out_estimate_type: "gate_fee", waste_out_estimate_per_tonne: 95, weight_included_t: 8.5 })).toEqual({ type: "gate_fee", total: 807.5 });
  });
  it("gives no estimate without a type", () => {
    expect(wasteOutEstimate({ waste_out_estimate_type: "", waste_out_estimate_per_tonne: 95, weight_included_t: 8 })).toBeNull();
  });
});
