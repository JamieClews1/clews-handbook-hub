import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildJobInvoiceLines, invoiceBlockers } from "./job-invoice";

const job = { job_number: "R100", haulage_cost: 180, charge_per_tonne: 120, weight_included_t: 1, vat_rate: 20 };
const t = (id: string, kg: number) => ({ id, ticket_number: id, net_weight_kg: kg });

describe("RouteOne job invoice", () => {
  it("charges booked haulage plus tonnes above the included first tonne", () => {
    const { lines, totalTonnes, chargeableTonnes } = buildJobInvoiceLines(job, [t("WB1", 2500)]);
    assert.equal(totalTonnes, 2.5);
    assert.equal(chargeableTonnes, 1.5);
    assert.equal(lines[0].net_amount, 180);
    assert.equal(lines[1].net_amount, 180); // 1.5 t × £120
    assert.equal(lines[1].vat_amount, 36);
  });
  it("adds up every weigh ticket on the job", () => {
    const { totalTonnes, lines } = buildJobInvoiceLines(job, [t("WB1", 1200), t("WB2", 1800)]);
    assert.equal(totalTonnes, 3);
    assert.equal(lines[1].quantity, 2);
  });
  it("converts kilograms to tonnes (7,840 kg is 7.84 t, not 7,840 t)", () => {
    const { totalTonnes } = buildJobInvoiceLines({ ...job, weight_included_t: 0 }, [t("WB1", 7840)]);
    assert.equal(totalTonnes, 7.84);
  });
  it("uses the minimum weight charge when it is higher", () => {
    const { lines } = buildJobInvoiceLines({ ...job, min_weight_charge: 100 }, [t("WB1", 1300)]);
    assert.equal(lines[1].net_amount, 100);
  });
  it("adds no tonnage charge when within the included tonnes", () => {
    const { lines } = buildJobInvoiceLines(job, [t("WB1", 800)]);
    assert.equal(lines.length, 1);
  });
  it("includes weighbridge extras and contamination", () => {
    const { lines } = buildJobInvoiceLines({ ...job, contamination_charge: 75 }, [{ ...t("WB1", 1000), extras: [{ description: "Mattress", cost: 25 }] }]);
    assert.deepEqual(lines.map(l => l.net_amount), [180, 25, 75]);
  });
  it("blocks a job with no price", () => {
    const b = invoiceBlockers({ jobCompleted: true, hasCustomer: true, financeMissing: [], poRequired: false, po: null, lines: [], pendingContamination: false });
    assert.deepEqual(b, ["No price on the job"]);
  });
});
