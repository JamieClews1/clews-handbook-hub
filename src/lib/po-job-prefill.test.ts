import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { poToJobPrefill, prefillFormFields, type PoInterpretation } from "./po-job-prefill";

const base: PoInterpretation = {
  po_number: "PO-1234", broker: "GoGreen", end_customer: "Acme Ltd", site_name: "Acme Rugby",
  site_address: "1 Mill Road, Rugby", postcode: "cv21 1ha", container: "8 yard skip", waste_type: "General waste",
  ewc_code: "17 09 04", service: "delivery", requested_date: "2026-11-20", price_net: 185, extras: null, notes: null,
};

describe("PO to New Job prefill", () => {
  it("uses the end customer, falling back to the broker", () => {
    assert.equal(poToJobPrefill(base).customer, "Acme Ltd");
    assert.equal(poToJobPrefill({ ...base, end_customer: null }).customer, "GoGreen");
  });

  it("books wait & load as a delivery and notes it", () => {
    const p = poToJobPrefill({ ...base, service: "wait_and_load" });
    assert.equal(p.type, "delivery");
    assert.match(p.notes, /wait & load/);
  });

  it("keeps the PO price in the notes, never as the job price", () => {
    const p = poToJobPrefill(base);
    assert.match(p.notes, /PO price: £185\.00 net/);
    assert.equal("haulage_cost" in prefillFormFields(p), false);
  });

  it("drops a date that is not a full YYYY-MM-DD", () => {
    assert.equal(poToJobPrefill({ ...base, requested_date: "20/11/2026" }).date, "");
  });

  it("resolves container wording to the booking choice", () => {
    assert.deepEqual(prefillFormFields({ container: "8 yard skip" }), { container_type: "Skip", container_size: "8yd" });
    assert.deepEqual(prefillFormFields({ container: "40yd RoRo" }), { container_type: "Ro Ro", container_size: "40yd" });
  });

  it("leaves fields the PO does not mention untouched", () => {
    const fields = prefillFormFields(poToJobPrefill({ ...base, site_name: null, container: null, requested_date: null }));
    for (const k of ["site_name", "container_type", "scheduled_date"]) assert.equal(k in fields, false);
  });
});
