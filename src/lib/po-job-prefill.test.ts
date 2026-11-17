import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { poToJobPrefill, prefillFormFields, type PoInterpretation } from "./po-job-prefill";

const base: PoInterpretation = {
  po_number: "PO-1234", broker: "GoGreen", end_customer: "Acme Ltd", site_name: "Acme Rugby",
  site_address: "1 Mill Road, Rugby", postcode: "cv21 1ha", container: "8 yard skip", waste_type: "General waste",
  ewc_code: "17 09 04", service: "delivery", requested_date: "2026-11-20", price_net: 185, extras: null, notes: null,
};

describe("PO to New Job prefill", () => {
  it("books a broker PO under the matched broker account with the end customer as the site", () => {
    const p = poToJobPrefill({ ...base, broker: "Reconomy UK Ltd t/a Circle Waste", end_customer: "Travis Perkins Trading Co Ltd", site_name: "Daventry - Sopwith Way" },
      { customer_name: "Reconomy (UK) Limited", customer_code: "SK0694", matched_from: "Reconomy UK Ltd t/a Circle Waste" });
    assert.equal(p.customer, "Reconomy (UK) Limited");
    assert.equal(p.site, "Travis Perkins Trading Co Ltd");
    assert.match(p.notes, /PO site: Daventry - Sopwith Way/);
  });

  it("uses a householder's first address line as the site", () => {
    const p = poToJobPrefill({ ...base, end_customer: "Jason Woodcock", end_customer_is_private: true, site_address: "Main Street,Monks Kirby,Rugby" },
      { customer_name: "Go Green Limited", customer_code: "ZZGOG001", matched_from: "GoGreen" });
    assert.equal(p.site, "Main Street");
  });

  it("treats a personal name with a street site as a householder even without the AI flag", () => {
    const p = poToJobPrefill({ ...base, end_customer: "Jason Woodcock", end_customer_is_private: false, site_name: "Main Street", site_address: "Main Street,Monks Kirby,Rugby" },
      { customer_name: "Go Green Limited", customer_code: "ZZGOG001", matched_from: "GoGreen" });
    assert.equal(p.site, "Main Street");
    const biz = poToJobPrefill({ ...base, end_customer: "Pioneer Construction Services Ltd", site_name: null, site_address: "Unit 2/3 Pelham Road, Rugby" },
      { customer_name: "LB Waste Management", customer_code: null, matched_from: "LB Waste" });
    assert.equal(biz.site, "Pioneer Construction Services Ltd");
  });

  it("books a direct customer PO under the customer with the PO's site name", () => {
    const p = poToJobPrefill({ ...base, broker: null });
    assert.equal(p.customer, "Acme Ltd");
    assert.equal(p.site, "Acme Rugby");
  });

  it("maps unknown waste wording on 17 09 04 to Construction & Demolition and notes the PO wording", () => {
    const p = poToJobPrefill({ ...base, waste_type: "Mixed construction and demolition wastes", ewc_code: "17.09.04" });
    assert.equal(p.waste, "Construction & Demolition");
    assert.equal(p.ewc, "17 09 04");
    assert.match(p.notes, /PO waste: Mixed construction and demolition wastes/);
  });

  it("leaves a £0 price and 'Anytime' out of the notes", () => {
    const p = poToJobPrefill({ ...base, price_net: 0, time_preference: "Anytime" });
    assert.doesNotMatch(p.notes, /PO price/);
    assert.doesNotMatch(p.notes, /Anytime/);
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

  it("keeps the full order notes, other instructions and site contact", () => {
    const po = { ...base, order_notes: "call on route", site_contact_name: "Sam", site_contact_phone: "07791586993", time_preference: "No preference",
      notes: "Documentation must state the waste producer's SIC code and the Waste Management Hierarchy Statement" };
    const p = poToJobPrefill(po);
    assert.match(p.notes, /^Order notes: call on route$/m);
    assert.match(p.notes, /Site contact: Sam 07791586993/);
    assert.match(p.notes, /SIC code and the Waste Management Hierarchy Statement/);
    assert.doesNotMatch(p.notes, /No preference/);
    assert.deepEqual([prefillFormFields(p).site_contact_name, prefillFormFields(p).site_contact_phone], ["Sam", "07791586993"]);
  });

  it("drops a date that is not a full YYYY-MM-DD", () => {
    assert.equal(poToJobPrefill({ ...base, requested_date: "20/11/2026" }).date, "");
  });

  it("resolves container wording to the booking choice", () => {
    assert.deepEqual(prefillFormFields({ container: "8 yard skip" }), { container_type: "Skip", container_size: "8yd" });
    assert.deepEqual(prefillFormFields({ container: "40yd RoRo" }), { container_type: "Ro Ro", container_size: "40yd" });
  });

  it("leaves fields the PO does not mention untouched", () => {
    const fields = prefillFormFields(poToJobPrefill({ ...base, end_customer: null, site_name: null, container: null, requested_date: null }));
    for (const k of ["site_name", "container_type", "scheduled_date"]) assert.equal(k in fields, false);
  });
});
