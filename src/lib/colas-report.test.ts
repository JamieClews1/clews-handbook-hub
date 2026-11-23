import { it } from "node:test";
import assert from "node:assert/strict";
import { buildColasMonth, cumulative, classifyStream, isHazardousEwc, lineSource, parseWeightKg, weeklyMondays, reportingPeriods, type BuildMonthInput } from "./colas-report";

const haz = new Set(["15 02 02", "16 01 07", "13 02 05"]);
const base = (over: Partial<BuildMonthInput> = {}): BuildMonthInput => ({
  year: 2026, month: 7, today: "2026-11-16", jobs: [], midweigh: [], manual: [], costs: [], consignments: new Map(), hazardousCodes: haz, weeklyFrom: null, ...over,
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

it("an unreadable consignment note is flagged as an issue, even after the source is approved", () => {
  const rhJob = job({ job_number: "49134", ewc: "15 02 02", waste_description: "Oil Contaminated Packaging", weight_t: 0.3, tipping_location: "Robert Hopkins Environmental" });
  const m = buildColasMonth(base({ jobs: [rhJob], consignmentIssues: new Map([["49134", "unreadable" as const]]), overrides: { robert_hopkins: { status: "approved" } } }));
  assert.equal(m.lines[0].consignmentIssue, "unreadable");
  assert.ok(m.outstanding.some(o => o.includes("can't be read") && o.includes("49134")));
  assert.equal(m.complete, false);
});

it("the unreadable flag clears once the consignment number is entered", () => {
  const rhJob = job({ job_number: "49134", ewc: "15 02 02", waste_description: "Oil Contaminated Packaging", weight_t: 0.3, tipping_location: "Robert Hopkins Environmental" });
  const m = buildColasMonth(base({ jobs: [rhJob], consignments: new Map([["49134", "COLASR/00155"]]), consignmentIssues: new Map([["49134", "unreadable" as const]]) }));
  assert.equal(m.lines[0].consignmentIssue, null);
  assert.ok(!m.outstanding.some(o => o.includes("49134")));
});

import { buildArisings, DEFAULT_TREATMENTS, treatmentFor } from "./colas-report";
const aline = (o: any) => ({ stream: "cardboard_paper", hazardous: false, weight_t: 1, charge: null, needsWeight: false, consignmentRef: null, ...o });

it("RDF / energy recovery counts as recycled: 2 t recycled + 1 t RDF of 3 t = 100% recycled, 0% landfill", () => {
  const a = buildArisings([aline({ weight_t: 2 }), aline({ stream: "mixed_municipal", weight_t: 1 })]);
  assert.equal(a.groups[0].total.removed, 3);
  assert.equal(a.groups[0].total.rdf, 1);
  assert.equal(a.groups[0].total.pctRecycled, 100);
  assert.equal(a.groups[0].total.pctLandfill, 0);
});

it("only landfill lowers % recycled: 25% landfill on 4 t gives 1 t landfill and 75% recycled", () => {
  const a = buildArisings([aline({ weight_t: 4 })], { cardboard_paper: { recycled: 75, rdf: 0, landfill: 25 } });
  const row = a.groups[0].rows.find(r => r.key === "cardboard_paper")!;
  assert.equal(row.landfill, 1);
  assert.equal(row.pctRecycled, 75);
  assert.equal(row.pctLandfill, 25);
});

it("an empty stream row has no percentage instead of claiming 100%", () => {
  const a = buildArisings([]);
  const row = a.groups[1].rows.find(r => r.key === "aerosols")!;
  assert.equal(row.removed, 0);
  assert.equal(row.pctRecycled, null);
});

it("a saved treatment that does not add up to 100% falls back to the default", () => {
  assert.deepEqual(treatmentFor("plastic", { plastic: { recycled: 50, rdf: 10, landfill: 10 } }), DEFAULT_TREATMENTS.plastic);
});

it("a waste line shows the weighbridge ticket its weight came from", () => {
  const month = buildColasMonth(base({ jobs: [job({ job_number: "49138", weight_t: null })], midweigh: [{ job_number: "83033", job_date: "2026-07-10", ewc: "15 01 01", waste_description: "Paper", weight_kg: 140, linked_skip_job: "49138" }] }));
  const src = lineSource(month.lines[0]);
  assert.equal(src.source, "Skiptrak job 49138");
  assert.deepEqual(src.tickets, ["83033"]);
  assert.match(src.weightFrom, /weighbridge/i);
});

it("a Skiptrak job keeps its own recorded weighbridge ticket", () => {
  const month = buildColasMonth(base({ jobs: [job({ job_number: "51534", weighbridge_ref: "87495" })] }));
  assert.deepEqual(lineSource(month.lines[0]).tickets, ["87495"]);
});

it("an Enva entry is shown as an Enva collection with its consignment, not a ticket", () => {
  const month = buildColasMonth(base({ manual: [{ id: "e1", provider: "enva", collection_date: "2026-07-06", waste_stream: "aqueous_oil_mix", hazardous: true, weight_kg: 12000, status: "confirmed", consignment_ref: "COLASR/11939" }] }));
  const src = lineSource(month.lines[0]);
  assert.equal(src.source, "Enva collection · consignment COLASR/11939");
  assert.deepEqual(src.tickets, []);
});

const manualEntry = (o: any) => ({ id: "m1", provider: "bm", collection_date: "2026-07-15", waste_stream: "co_mingled", hazardous: false, weight_kg: null, status: "confirmed", ...o });

it("a wheelie bin lift with no weight counts as 0.5 t", () => {
  const month = buildColasMonth(base({ jobs: [job({ container_type: "660 litre Wheelie Bin", movement: "Exchange", weight_t: null })] }));
  assert.equal(month.lines[0].weight_t, 0.5);
  assert.equal(month.lines[0].weightSource, "assumed");
  assert.equal(month.missingWeights, 0);
});

it("a weighed wheelie bin keeps its recorded weight, not 0.5 t", () => {
  const month = buildColasMonth(base({ jobs: [job({ container_type: "660 litre Wheelie Bin", weight_t: 0.04 })] }));
  assert.equal(month.lines[0].weight_t, 0.04);
});

it("a wheelie bin weighed on the linked Clews ticket uses that weight, not 0.5 t", () => {
  const month = buildColasMonth(base({ jobs: [job({ job_number: "45058", container_type: "660 litre Wheelie Bin", weight_t: null })], midweigh: [{ job_number: "76741", job_date: "2026-07-09", ewc: "15 01 06", waste_description: "Mixed", weight_kg: 40, linked_skip_job: "45058" }] }));
  assert.equal(month.lines[0].weight_t, 0.04);
});

it("a skip with no weight is still flagged as missing, not assumed", () => {
  const month = buildColasMonth(base({ jobs: [job({ container_type: "8 Yard", weight_t: null })] }));
  assert.equal(month.lines[0].weight_t, null);
  assert.equal(month.missingWeights, 1);
});

it("a B&M wheelie bin entry with no weight counts as 0.05 t", () => {
  const month = buildColasMonth(base({ manual: [manualEntry({ provider: "bm" })] as any }));
  assert.equal(month.lines[0].weight_t, 0.05);
  assert.equal(month.missingWeights, 0);
});

it("a Fortress food waste entry with no weight counts as 0.03 t", () => {
  const month = buildColasMonth(base({ manual: [manualEntry({ provider: "fortress", waste_stream: "food" })] as any }));
  assert.equal(month.lines[0].weight_t, 0.03);
  assert.equal(month.lines[0].weightSource, "assumed");
});

it("an Enva entry with no weight is still flagged as missing", () => {
  const month = buildColasMonth(base({ manual: [manualEntry({ provider: "enva", waste_stream: "aqueous_oil_mix", hazardous: true })] as any }));
  assert.equal(month.lines[0].weight_t, null);
  assert.equal(month.missingWeights, 1);
});

const weekly = (o: Partial<BuildMonthInput> = {}) => base({ year: 2026, month: 11, today: "2026-11-23", weeklyFrom: "2026-01-01", ...o });

it("each week adds one B&M mixed wheelie bin at 0.05 t and one Fortress food waste at 0.03 t", () => {
  const month = buildColasMonth(weekly());
  // Mondays 2, 9, 16 and 23 November are up to today
  const bm = month.lines.filter(l => l.weekly && l.provider === "bm");
  const ft = month.lines.filter(l => l.weekly && l.provider === "fortress");
  assert.equal(bm.length, 4);
  assert.equal(ft.length, 4);
  assert.ok(bm.every(l => l.weight_t === 0.05 && l.stream === "mixed_municipal" && l.weightSource === "assumed"));
  assert.ok(ft.every(l => l.weight_t === 0.03 && l.stream === "food"));
});

it("weekly collections are not added for weeks after today", () => {
  assert.deepEqual(weeklyMondays(2026, 11, "2026-11-20"), ["2026-11-02", "2026-11-09", "2026-11-16"]);
});

it("weekly collections do not start before the agreed start date", () => {
  // Starting Tuesday 10 Nov counts that week (Monday 9th), then the 16th and 23rd
  const month = buildColasMonth(weekly({ weeklyFrom: "2026-11-10" }));
  assert.equal(month.lines.filter(l => l.weekly && l.provider === "bm").length, 3);
});

it("a week with a staff-entered B&M entry uses that entry instead of the weekly one", () => {
  const month = buildColasMonth(weekly({ manual: [manualEntry({ provider: "bm", collection_date: "2026-11-11", weight_kg: 60 })] as any }));
  const bm = month.lines.filter(l => l.provider === "bm");
  assert.equal(bm.length, 4);
  assert.equal(bm.find(l => l.date === "2026-11-11")?.weight_t, 0.06);
  assert.equal(bm.some(l => l.weekly && l.date === "2026-11-09"), false);
});
