import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { newExchangeForm } from "./route-job-exchange";

describe("new exchange", () => {
  const original = { id: "original", job_number: "52197", customer_name: "SUEZ", site_name: "Evri", site_address: "Unit 1", haulage_cost: 110, charge_per_tonne: 195, po_number: "COV391348", scheduled_date: "2026-10-26", assigned_driver_id: "driver", status: "completed", net_weight_t: 4, weighbridge_transaction_id: "wb", customer_signature: "signed", photos: ["photo"], paid: true, invoice_id: "invoice", cost_items: [{ name: "Wait", qty: 1, charge: 20 }] };
  it("starts a new unsaved exchange with copied booking details and selected date", () => {
    const result = newExchangeForm({}, original, "2026-10-27");
    for (const [key, value] of Object.entries({ customer_name: "SUEZ", site_name: "Evri", site_address: "Unit 1", haulage_cost: 110, charge_per_tonne: 195, po_number: "COV391348", job_type: "exchange", scheduled_date: "2026-10-27", assigned_driver_id: "", vehicle_reg: "" })) assert.equal(result[key], value);
    assert.ok(result.notes.includes("52197"));
    assert.equal(result.id, undefined);
  });
  it("never copies evidence, weights, payment or invoices and leaves original unchanged", () => {
    const before = structuredClone(original);
    const result = newExchangeForm({ weighbridge_transaction_id: "", outbound_weight_t: "", contamination_query_id: "" }, original, "2026-10-27");
    assert.equal(result.weighbridge_transaction_id, "");
    for (const key of ["status", "net_weight_t", "customer_signature", "photos", "paid", "invoice_id"]) assert.equal(result[key], undefined);
    result.cost_items[0].charge = 0;
    assert.deepEqual(original, before);
  });
});