import { describe, expect, it } from "vitest";
import { poToJobPrefill, prefillFormFields, type PoInterpretation } from "./po-job-prefill";

const base: PoInterpretation = {
  po_number: "PO-1234", broker: "GoGreen", end_customer: "Acme Ltd", site_name: "Acme Rugby",
  site_address: "1 Mill Road, Rugby", postcode: "cv21 1ha", container: "8 yard skip", waste_type: "General waste",
  ewc_code: "17 09 04", service: "delivery", requested_date: "2026-11-20", price_net: 185, extras: null, notes: null,
};

describe("PO to New Job prefill", () => {
  it("uses the end customer, falling back to the broker", () => {
    expect(poToJobPrefill(base).customer).toBe("Acme Ltd");
    expect(poToJobPrefill({ ...base, end_customer: null }).customer).toBe("GoGreen");
  });

  it("books wait & load as a delivery and notes it", () => {
    const p = poToJobPrefill({ ...base, service: "wait_and_load" });
    expect(p.type).toBe("delivery");
    expect(p.notes).toContain("wait & load");
  });

  it("keeps the PO price in the notes, never as the job price", () => {
    const p = poToJobPrefill(base);
    expect(p.notes).toContain("PO price: £185.00 net");
    expect(prefillFormFields(p)).not.toHaveProperty("haulage_cost");
  });

  it("drops a date that is not a full YYYY-MM-DD", () => {
    expect(poToJobPrefill({ ...base, requested_date: "20/11/2026" }).date).toBe("");
  });

  it("resolves container wording to the booking choice", () => {
    expect(prefillFormFields({ container: "8 yard skip" })).toMatchObject({ container_type: "Skip", container_size: "8yd" });
    expect(prefillFormFields({ container: "40yd RoRo" })).toMatchObject({ container_type: "Ro Ro", container_size: "40yd" });
  });

  it("leaves fields the PO does not mention untouched", () => {
    const fields = prefillFormFields(poToJobPrefill({ ...base, site_name: null, container: null, requested_date: null }));
    expect(fields).not.toHaveProperty("site_name");
    expect(fields).not.toHaveProperty("container_type");
    expect(fields).not.toHaveProperty("scheduled_date");
  });
});
