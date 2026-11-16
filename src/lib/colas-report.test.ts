import { it } from "node:test";
import assert from "node:assert/strict";
import { buildColasMonth, cumulative, classifyStream, isHazardousEwc, parseWeightKg, reportingPeriods, type BuildMonthInput } from "./colas-report";

const haz = new Set(["15 02 02", "16 01 07", "13 02 05"]);
const base = (over: Partial<BuildMonthInput> = {}): BuildMonthInput => ({
  year: 2026, month: 7, today: "2026-11-16", jobs: [], midweigh: [], manual: [], costs: [], consignments: new Map(), hazardousCodes: haz, ...over,
});
const job = (o: Partial<BuildMonthInput["jobs"][number]>) => ({ job_number: "1", job_date: "2026-07-09", ewc: "15 01 01", waste_description: "Paper and Cardboard", weight_t: 0.1, cost: 84.43, movement: "Tip/Return", status: "Y", tipping_location: "Clews Recycling Ltd", site: "Colas Road", container_type: "12 Yard Enc", weighbridge_ref: null, ...o });

it("year-to-date carries forward monthly totals (45 + 52 + 48 = 145 t)", () => {
  const m = (t: number) => ({ hazardous_t: 0, non_hazardous_t: t, costs: { hazardous: 0, non_hazardous: 0 } as any });
  const ytd = cumulative([m(45), m(52), m(48)]);
  assert.deepEqual(ytd.map(y => y.total_t), [45, 97, 145]);
});

it("opening balances are added once, not per month", () => {
  const m = (t: number) => ({ hazardous_t: t, non_hazardous_t: 0, costs: { hazardous: 10, non_hazardous: 0 } as any });
  const ytd = cumulative([m(1), m(2)], { hazardous_t: 5, non_hazardous_t: 0, hazardous_cost: 100, non_hazardous_cost: 0 });
  assert.equal(ytd[1].hazardous_t, 8);
  assert.equal(ytd[1].hazardous_cost, 120);
});

it("correcting an earlier month changes every later cumulative total", () => {
  const m = (t: number) => ({ hazardous_t: 0, non_hazardous_t: t, costs: { hazardous: 0, non_hazardous: 0 } as any });
  assert.equal(cumulative([m(45), m(52), m(48)])[2].total_t, 145);
  assert.equal(cumulative([m(40), m(52), m(48)])[2].total_t, 140);
});

it("a missing weight is flagged, never counted as zero-complete", () => {
  const month = buildColasMonth(base({ jobs: [job({ weight_t: null })] }));
  assert.equal(month.missingWeights, 1);
  assert.equal(month.lines[0].weight_t, null);
  assert.equal(month.sources.find(s => s.key === "skiptrak")?.status, "requires_verification");
  assert.equal(month.complete, false);
});

it("a missing Skiptrak weight is filled from the linked Midweigh ticket in kg", () => {
  const month = buildColasMonth(base({ jobs: [job({ job_number: "49138", weight_t: null })], midweigh: [{ job_number: "83033", job_date: "2026-07-10", ewc: "15 01 01", waste_description: "Paper", weight_kg: 140, linked_skip_job: "49138" }] }));
  assert.equal(month.non_hazardous_t, 0.14);
  assert.equal(month.lines.length, 1, "linked weighbridge ticket is not double-counted");
});

it("Robert Hopkins oil-contaminated packaging is hazardous; 1 tonne = 1,000 kg for manual kg entries", () => {
  const month = buildColasMonth(base({
    jobs: [job({ job_number: "49133", ewc: "15 02 02", waste_description: "Oil Contaminated Packaging, absorbents, PPE", weight_t: 0.4, tipping_location: "Robert Hopkins Environmental" })],
    manual: [{ id: "a", provider: "enva", collection_date: "2026-07-20", waste_stream: "waste_engine_oil", hazardous: true, weight_kg: 1250, status: "confirmed" }],
  }));
  assert.equal(month.hazardous_t, 1.65);
  assert.equal(month.lines.find(l => l.reference === "49133")?.provider, "robert_hopkins");
});

it("Sage costs (ex VAT) replace provisional Skiptrak charges, with adjustments shown separately", () => {
  const jobs = [job({ cost: 100 })];
  assert.equal(buildColasMonth(base({ jobs })).costs.provisional, true);
  const m = buildColasMonth(base({ jobs, costs: [
    { year: 2026, month: 7, category: "non_hazardous", entry_type: "sage_import", amount_ex_vat: 90 },
    { year: 2026, month: 7, category: "non_hazardous", entry_type: "adjustment", amount_ex_vat: 5 },
    { year: 2026, month: 7, category: "non_hazardous", entry_type: "sage_import", amount_ex_vat: 1000, voided_at: "2026-11-01" },
  ] }));
  assert.equal(m.costs.source, "sage");
  assert.equal(m.costs.non_hazardous, 95);
  assert.equal(m.costs.sageNonHazardous, 90);
  assert.equal(m.costs.adjustmentsNonHazardous, 5);
});

it("providers with no entries are awaiting information until staff approve the source", () => {
  const m = buildColasMonth(base());
  assert.equal(m.sources.find(s => s.key === "enva")?.status, "awaiting");
  const m2 = buildColasMonth(base({ overrides: { enva: { status: "approved", note: "No collection" } } }));
  assert.equal(m2.sources.find(s => s.key === "enva")?.status, "approved");
});

it("deliveries and uncompleted jobs carry no weight expectation", () => {
  const m = buildColasMonth(base({ jobs: [job({ movement: "Deliver", weight_t: null }), job({ job_number: "2", status: "N", weight_t: null })] }));
  assert.equal(m.missingWeights, 0);
  assert.equal(m.lines.length, 1);
});

it("classifies hazardous codes with or without the asterisk", () => {
  assert.equal(isHazardousEwc("15 02 02", haz), true);
  assert.equal(isHazardousEwc("15 02 03", haz), false);
  assert.equal(classifyStream("15 02 02", "Oil filters", true), "oil_filters");
  assert.equal(classifyStream("15 01 06", "Co-Mingled Mixed Packaging", false), "co_mingled");
});

it("weights parse to kg and reporting years can start in any month", () => {
  assert.equal(parseWeightKg("1,250"), 1250);
  assert.equal(parseWeightKg("1.2 t"), 1200);
  assert.deepEqual(reportingPeriods(2026, 4)[11], { year: 2027, month: 3 });
});

it("non-hazardous loads to Robert Hopkins do not need a consignment reference", () => {
  const m = buildColasMonth(base({ jobs: [job({ job_number: "51808", ewc: "15 02 03", waste_description: "Used Aircon Filters", weight_t: 3.96, tipping_location: "Robert Hopkins Environmental" })] }));
  assert.equal(m.sources.find(s => s.key === "robert_hopkins")?.status, "received");
});
