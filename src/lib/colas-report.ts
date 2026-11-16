/**
 * Colas Rail bespoke waste reporting — pure calculation module.
 * Builds each month's figures from underlying records (Skiptrak jobs, linked Midweigh weights,
 * other-provider entries and Sage costs). Missing weights are reported, never treated as zero.
 */

export type ColasStreamKey =
  | "cardboard_paper" | "plastic" | "mixed_municipal" | "co_mingled" | "wood" | "mixed_cd" | "food" | "metal" | "misc"
  | "waste_engine_oil" | "contaminated_packaging" | "aqueous_oil_mix" | "hydraulic_pipes" | "oil_filters" | "aerosols"
  | "oil_contaminated_paint" | "other_hazardous";

export const COLAS_STREAMS: { key: ColasStreamKey; label: string; hazardous: boolean }[] = [
  { key: "cardboard_paper", label: "Cardboard and paper", hazardous: false },
  { key: "plastic", label: "Plastic", hazardous: false },
  { key: "mixed_municipal", label: "Mixed municipal waste", hazardous: false },
  { key: "co_mingled", label: "Co mingled DMR", hazardous: false },
  { key: "wood", label: "Wood waste", hazardous: false },
  { key: "mixed_cd", label: "Mixed construction & demolition", hazardous: false },
  { key: "food", label: "Food waste", hazardous: false },
  { key: "metal", label: "Scrap metal", hazardous: false },
  { key: "misc", label: "Misc", hazardous: false },
  { key: "waste_engine_oil", label: "Waste engine oil", hazardous: true },
  { key: "contaminated_packaging", label: "Contaminated packaging & absorbents", hazardous: true },
  { key: "aqueous_oil_mix", label: "Aqueous oil mix", hazardous: true },
  { key: "hydraulic_pipes", label: "Hydraulic pipes", hazardous: true },
  { key: "oil_filters", label: "Oil filters", hazardous: true },
  { key: "aerosols", label: "Aerosols", hazardous: true },
  { key: "oil_contaminated_paint", label: "Oil contaminated waste & empty paint tins", hazardous: true },
  { key: "other_hazardous", label: "Other hazardous", hazardous: true },
];
export const streamLabel = (k: string) => COLAS_STREAMS.find(s => s.key === k)?.label ?? k;
export const streamIsHazardous = (k: string) => COLAS_STREAMS.find(s => s.key === k)?.hazardous ?? false;

export type ColasProvider = "clews" | "robert_hopkins" | "midweigh" | "enva" | "bm" | "fortress" | "other";
export const PROVIDER_LABELS: Record<ColasProvider, string> = {
  clews: "Clews Recycling (Skiptrak)",
  robert_hopkins: "Robert Hopkins (Skiptrak / QuickConsign)",
  midweigh: "Clews weighbridge (Midweigh)",
  enva: "Enva",
  bm: "B&M",
  fortress: "Fortress",
  other: "Other",
};
export const MANUAL_PROVIDERS = ["enva", "bm", "fortress"] as const;
export type ManualProvider = (typeof MANUAL_PROVIDERS)[number];
export const MANUAL_DEFAULT_STREAM: Record<ManualProvider, ColasStreamKey> = {
  enva: "waste_engine_oil",
  bm: "mixed_municipal",
  fortress: "food",
};

export const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function normaliseEwc(code: string | null | undefined): string {
  const digits = String(code ?? "").replace(/[^0-9]/g, "");
  if (digits.length !== 6) return String(code ?? "").replace(/\*/g, "").trim();
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}`;
}

export function isHazardousEwc(code: string | null | undefined, hazardousCodes: Set<string>): boolean {
  if (!code) return false;
  if (String(code).includes("*")) return true;
  return hazardousCodes.has(normaliseEwc(code));
}

export function classifyStream(ewcRaw: string | null | undefined, descRaw: string | null | undefined, hazardous: boolean): ColasStreamKey {
  const e = normaliseEwc(ewcRaw);
  const d = String(descRaw ?? "").toLowerCase();
  if (hazardous) {
    if (/oil filter/.test(d) || e === "16 01 07") return "oil_filters";
    if (/aerosol/.test(d) || e === "16 05 04" || e === "15 01 11") return "aerosols";
    if (/hydraulic|hose|pipe/.test(d)) return "hydraulic_pipes";
    if (/aqueous|interceptor|oily water/.test(d) || ["13 05 07", "16 10 01", "13 08 02"].includes(e)) return "aqueous_oil_mix";
    if (e.startsWith("13 02") || /engine oil|waste oil|mineral oil/.test(d)) return "waste_engine_oil";
    if (e === "15 02 02" && /packag|absorb|ppe|rag|wipe/.test(d)) return "contaminated_packaging";
    if (/paint/.test(d) || e.startsWith("08 01") || e === "15 01 10") return "oil_contaminated_paint";
    if (e === "15 02 02") return "contaminated_packaging";
    return "other_hazardous";
  }
  if (["15 01 01", "20 01 01"].includes(e) || /cardboard|paper/.test(d)) return "cardboard_paper";
  if (["15 01 06"].includes(e) || /co-?mingled|dmr|dry mixed/.test(d)) return "co_mingled";
  if (["15 01 02", "20 01 39", "07 02 13"].includes(e) || /plastic/.test(d)) return "plastic";
  if (["15 01 03", "17 02 01", "20 01 38", "03 01 05"].includes(e) || /wood|pallet/.test(d)) return "wood";
  if (e === "17 09 04" || /construction|demolition/.test(d)) return "mixed_cd";
  if (["20 01 08", "02 02 03", "02 03 04"].includes(e) || /food/.test(d)) return "food";
  if (e === "20 03 01" || /general waste|municipal/.test(d)) return "mixed_municipal";
  if (e.startsWith("12 01") || e.startsWith("16 01 17") || e.startsWith("17 04") || /metal|ferrous|steel/.test(d)) return "metal";
  return "misc";
}

/** Skiptrak movements that remove waste from site (deliveries only drop an empty container). */
export const isRemovalMovement = (movement: string | null | undefined) => !/^deliver/i.test(String(movement ?? "").trim());

export interface ColasSkiptrakJob {
  job_number: string;
  job_date: string; // YYYY-MM-DD
  ewc: string | null;
  waste_description: string | null;
  weight_t: number | null; // tonnes
  cost: number | null;
  movement: string | null;
  status: string | null; // Skiptrak "Y" = completed
  tipping_location: string | null;
  site: string | null;
  container_type: string | null;
  weighbridge_ref: string | null;
}
export interface ColasMidweighTicket {
  job_number: string;
  job_date: string;
  ewc: string | null;
  waste_description: string | null;
  weight_kg: number | null;
  linked_skip_job: string | null;
}
export interface ColasManualEntryRow {
  id: string;
  provider: string;
  collection_date: string;
  waste_stream: string;
  waste_type?: string | null;
  hazardous: boolean;
  weight_kg: number | null;
  status: string; // awaiting_paperwork | confirmed
  consignment_ref?: string | null;
  collection_reference?: string | null;
  voided_at?: string | null;
}
export interface ColasCostRow {
  year: number;
  month: number;
  category: "hazardous" | "non_hazardous" | string;
  entry_type: "sage_import" | "adjustment" | string;
  amount_ex_vat: number;
  voided_at?: string | null;
}
export type SourceKey = "skiptrak" | "robert_hopkins" | "enva" | "bm" | "fortress" | "sage";
export const SOURCE_LABELS: Record<SourceKey, string> = {
  skiptrak: "Skiptrak data",
  robert_hopkins: "Robert Hopkins hazardous waste",
  enva: "Enva waste oil",
  bm: "B&M wheelie bins",
  fortress: "Fortress food waste",
  sage: "Sage costs",
};
export type SourceStatus = "received" | "awaiting" | "requires_verification" | "approved";
export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  received: "Received",
  awaiting: "Awaiting information",
  requires_verification: "Requires verification",
  approved: "Approved",
};
export type SourceOverride = { status: "approved"; note?: string | null; by?: string | null; at?: string | null };

export interface ColasLine {
  id: string;
  provider: ColasProvider;
  date: string;
  reference: string;
  description: string;
  ewc: string | null;
  stream: ColasStreamKey;
  hazardous: boolean;
  weight_t: number | null;
  weightSource: "skiptrak" | "midweigh" | "manual" | null;
  charge: number | null;
  consignmentRef: string | null;
  needsWeight: boolean;
  awaitingPaperwork: boolean;
}
export interface ColasStreamTotal { key: ColasStreamKey; label: string; hazardous: boolean; tonnes: number; lines: number; missingWeights: number; charges: number }
export interface ColasCosts {
  source: "sage" | "skiptrak" | "none";
  provisional: boolean;
  hazardous: number;
  non_hazardous: number;
  total: number;
  sageHazardous: number;
  sageNonHazardous: number;
  adjustmentsHazardous: number;
  adjustmentsNonHazardous: number;
  skiptrakHazardous: number;
  skiptrakNonHazardous: number;
}
export interface ColasSourceCheck { key: SourceKey; label: string; status: SourceStatus; autoStatus: SourceStatus; detail: string; note?: string | null }
export interface ColasMonth {
  year: number;
  month: number; // 1-12
  label: string;
  inProgress: boolean;
  lines: ColasLine[];
  streams: ColasStreamTotal[];
  hazardous_t: number;
  non_hazardous_t: number;
  total_t: number;
  missingWeights: number;
  costs: ColasCosts;
  byProvider: { provider: ColasProvider; label: string; tonnes: number; lines: number }[];
  sources: ColasSourceCheck[];
  complete: boolean;
  outstanding: string[];
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
export const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const inMonth = (date: string, y: number, m: number) => String(date).slice(0, 7) === monthKey(y, m);

export interface BuildMonthInput {
  year: number;
  month: number;
  today: string; // YYYY-MM-DD (London)
  jobs: ColasSkiptrakJob[];
  midweigh: ColasMidweighTicket[];
  manual: ColasManualEntryRow[];
  costs: ColasCostRow[];
  consignments: Map<string, string | null>; // skiptrak job_number -> consignment ref
  hazardousCodes: Set<string>;
  overrides?: Partial<Record<SourceKey, SourceOverride>>;
}

export function buildColasMonth(input: BuildMonthInput): ColasMonth {
  const { year, month, today, hazardousCodes } = input;
  const key = monthKey(year, month);
  const inProgress = today.slice(0, 7) <= key;
  const midByJob = new Map<string, number>();
  for (const t of input.midweigh) {
    if (t.linked_skip_job && t.weight_kg && t.weight_kg > 0) midByJob.set(String(t.linked_skip_job).trim(), (midByJob.get(String(t.linked_skip_job).trim()) ?? 0) + t.weight_kg);
  }
  const skiptrakNumbers = new Set(input.jobs.map(j => String(j.job_number).trim()));
  const lines: ColasLine[] = [];
  const outstanding: string[] = [];
  let notCompleted = 0;

  for (const j of input.jobs) {
    if (!inMonth(j.job_date, year, month)) continue;
    if (String(j.status ?? "").trim().toUpperCase() !== "Y") { if (j.job_date <= today) notCompleted++; continue; }
    const hazardous = isHazardousEwc(j.ewc, hazardousCodes);
    const stream = classifyStream(j.ewc, j.waste_description, hazardous);
    const removal = isRemovalMovement(j.movement);
    let weight: number | null = j.weight_t && j.weight_t > 0 ? j.weight_t : null;
    let weightSource: ColasLine["weightSource"] = weight != null ? "skiptrak" : null;
    if (weight == null && removal) {
      const kg = midByJob.get(String(j.job_number).trim());
      if (kg) { weight = kg / 1000; weightSource = "midweigh"; }
    }
    const rh = /hopkins/i.test(j.tipping_location ?? "");
    lines.push({
      id: `skiptrak:${j.job_number}`,
      provider: rh ? "robert_hopkins" : "clews",
      date: j.job_date,
      reference: String(j.job_number),
      description: j.waste_description ?? "",
      ewc: j.ewc,
      stream,
      hazardous,
      weight_t: removal ? weight : null,
      weightSource: removal ? weightSource : null,
      charge: j.cost,
      consignmentRef: input.consignments.get(String(j.job_number)) ?? null,
      needsWeight: removal && weight == null,
      awaitingPaperwork: false,
    });
  }
  // Midweigh tickets not linked to a Skiptrak job in this customer's data are their own loads.
  for (const t of input.midweigh) {
    if (!inMonth(t.job_date, year, month)) continue;
    if (t.linked_skip_job && skiptrakNumbers.has(String(t.linked_skip_job).trim())) continue;
    const hazardous = isHazardousEwc(t.ewc, hazardousCodes);
    const w = t.weight_kg && t.weight_kg > 0 ? t.weight_kg / 1000 : null;
    lines.push({
      id: `midweigh:${t.job_number}`,
      provider: "midweigh",
      date: t.job_date,
      reference: String(t.job_number),
      description: t.waste_description ?? "",
      ewc: t.ewc,
      stream: classifyStream(t.ewc, t.waste_description, hazardous),
      hazardous,
      weight_t: w,
      weightSource: w != null ? "midweigh" : null,
      charge: null,
      consignmentRef: null,
      needsWeight: w == null,
      awaitingPaperwork: false,
    });
  }
  for (const e of input.manual) {
    if (e.voided_at || !inMonth(e.collection_date, year, month)) continue;
    const stream = (COLAS_STREAMS.some(s => s.key === e.waste_stream) ? e.waste_stream : "misc") as ColasStreamKey;
    const w = e.weight_kg != null && e.weight_kg >= 0 ? e.weight_kg / 1000 : null;
    const provider = (["enva", "bm", "fortress"].includes(e.provider) ? e.provider : "other") as ColasProvider;
    lines.push({
      id: `manual:${e.id}`,
      provider,
      date: e.collection_date,
      reference: e.consignment_ref || e.collection_reference || "",
      description: e.waste_type || streamLabel(stream),
      ewc: null,
      stream,
      hazardous: e.hazardous,
      weight_t: w,
      weightSource: w != null ? "manual" : null,
      charge: null,
      consignmentRef: e.consignment_ref ?? null,
      needsWeight: w == null,
      awaitingPaperwork: e.status !== "confirmed",
    });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference));

  const streams: ColasStreamTotal[] = COLAS_STREAMS.map(s => {
    const ls = lines.filter(l => l.stream === s.key);
    return {
      key: s.key, label: s.label, hazardous: s.hazardous,
      tonnes: r3(ls.reduce((a, l) => a + (l.weight_t ?? 0), 0)),
      lines: ls.length,
      missingWeights: ls.filter(l => l.needsWeight).length,
      charges: r2(ls.reduce((a, l) => a + (l.charge ?? 0), 0)),
    };
  });
  const hazardous_t = r3(lines.filter(l => l.hazardous).reduce((a, l) => a + (l.weight_t ?? 0), 0));
  const non_hazardous_t = r3(lines.filter(l => !l.hazardous).reduce((a, l) => a + (l.weight_t ?? 0), 0));
  const missingWeights = lines.filter(l => l.needsWeight).length;

  // Costs: Sage (plus authorised adjustments) when imported; otherwise Skiptrak job charges, provisional.
  const mc = input.costs.filter(c => !c.voided_at && c.year === year && c.month === month);
  const sum = (cat: string, type: string) => r2(mc.filter(c => c.category === cat && c.entry_type === type).reduce((a, c) => a + Number(c.amount_ex_vat || 0), 0));
  const sageH = sum("hazardous", "sage_import"), sageN = sum("non_hazardous", "sage_import");
  const adjH = sum("hazardous", "adjustment"), adjN = sum("non_hazardous", "adjustment");
  const hasSage = mc.some(c => c.entry_type === "sage_import");
  const skH = r2(lines.filter(l => l.hazardous).reduce((a, l) => a + (l.charge ?? 0), 0));
  const skN = r2(lines.filter(l => !l.hazardous).reduce((a, l) => a + (l.charge ?? 0), 0));
  const hasSkCharges = lines.some(l => l.charge != null);
  const costs: ColasCosts = hasSage
    ? { source: "sage", provisional: false, hazardous: r2(sageH + adjH), non_hazardous: r2(sageN + adjN), total: r2(sageH + adjH + sageN + adjN), sageHazardous: sageH, sageNonHazardous: sageN, adjustmentsHazardous: adjH, adjustmentsNonHazardous: adjN, skiptrakHazardous: skH, skiptrakNonHazardous: skN }
    : { source: hasSkCharges ? "skiptrak" : "none", provisional: true, hazardous: r2(skH + adjH), non_hazardous: r2(skN + adjN), total: r2(skH + skN + adjH + adjN), sageHazardous: 0, sageNonHazardous: 0, adjustmentsHazardous: adjH, adjustmentsNonHazardous: adjN, skiptrakHazardous: skH, skiptrakNonHazardous: skN };

  const provMap = new Map<ColasProvider, { tonnes: number; lines: number }>();
  for (const l of lines) {
    const p = provMap.get(l.provider) ?? { tonnes: 0, lines: 0 };
    p.tonnes += l.weight_t ?? 0; p.lines += 1; provMap.set(l.provider, p);
  }
  const byProvider = [...provMap.entries()].map(([provider, v]) => ({ provider, label: PROVIDER_LABELS[provider], tonnes: r3(v.tonnes), lines: v.lines }));

  // Source completeness
  const sources: ColasSourceCheck[] = [];
  const add = (k: SourceKey, auto: SourceStatus, detail: string) => {
    const o = input.overrides?.[k];
    sources.push({ key: k, label: SOURCE_LABELS[k], autoStatus: auto, status: o?.status === "approved" ? "approved" : auto, detail, note: o?.note ?? null });
  };
  const sk = lines.filter(l => l.provider === "clews" || l.provider === "midweigh");
  const skMissing = sk.filter(l => l.needsWeight).length;
  if (sk.length === 0) add("skiptrak", "awaiting", inProgress ? "Month in progress — no completed jobs uploaded yet" : "No completed Colas Rail jobs found for this month");
  else add("skiptrak", skMissing || notCompleted ? "requires_verification" : "received",
    [`${sk.length} completed job${sk.length === 1 ? "" : "s"}`, skMissing ? `${skMissing} without a weight` : "", notCompleted ? `${notCompleted} past job${notCompleted === 1 ? "" : "s"} not marked complete in Skiptrak` : ""].filter(Boolean).join(" · "));
  const rh = lines.filter(l => l.provider === "robert_hopkins");
  // Only hazardous loads travel on a consignment note; non-hazardous loads to Robert Hopkins need a weight only.
  const rhMissW = rh.filter(l => l.needsWeight).length, rhMissRef = rh.filter(l => l.hazardous && !l.consignmentRef).length;
  if (rh.length === 0) add("robert_hopkins", inProgress ? "awaiting" : "received", inProgress ? "No hazardous collections recorded yet" : "No Robert Hopkins collections in Skiptrak this month");
  else add("robert_hopkins", rhMissW || rhMissRef ? "requires_verification" : "received",
    [`${rh.length} collection${rh.length === 1 ? "" : "s"}`, rhMissW ? `${rhMissW} without a weight` : "", rhMissRef ? `${rhMissRef} without a consignment reference` : ""].filter(Boolean).join(" · "));
  for (const p of MANUAL_PROVIDERS) {
    const ls = lines.filter(l => l.provider === p);
    if (ls.length === 0) add(p, "awaiting", "No figures entered for this month");
    else {
      const aw = ls.filter(l => l.awaitingPaperwork).length, mw = ls.filter(l => l.needsWeight).length;
      add(p, aw || mw ? "requires_verification" : "received",
        [`${ls.length} entr${ls.length === 1 ? "y" : "ies"}`, mw ? `${mw} without a weight` : "", aw ? `${aw} awaiting paperwork` : ""].filter(Boolean).join(" · "));
    }
  }
  add("sage", hasSage ? "received" : "awaiting", hasSage ? "Sage figures imported" : hasSkCharges ? "Not imported — Skiptrak job charges shown as provisional" : "Not imported");
  for (const s of sources) if (s.status === "awaiting" || s.status === "requires_verification") outstanding.push(`${s.label}: ${s.detail}`);

  return {
    year, month, label: `${MONTH_NAMES[month - 1]} ${year}`, inProgress, lines, streams,
    hazardous_t, non_hazardous_t, total_t: r3(hazardous_t + non_hazardous_t), missingWeights, costs, byProvider, sources,
    complete: outstanding.length === 0, outstanding,
  };
}

export interface ColasOpening { hazardous_t: number; non_hazardous_t: number; hazardous_cost: number; non_hazardous_cost: number }
export interface ColasYtd { hazardous_t: number; non_hazardous_t: number; total_t: number; hazardous_cost: number; non_hazardous_cost: number; total_cost: number }

/** Cumulative figures: opening balance + each month in order. Recomputed from monthly records every time, so edits flow forward. */
export function cumulative(months: Pick<ColasMonth, "hazardous_t" | "non_hazardous_t" | "costs">[], opening?: ColasOpening | null): ColasYtd[] {
  let h = opening?.hazardous_t ?? 0, n = opening?.non_hazardous_t ?? 0, hc = opening?.hazardous_cost ?? 0, nc = opening?.non_hazardous_cost ?? 0;
  return months.map(m => {
    h += m.hazardous_t; n += m.non_hazardous_t; hc += m.costs.hazardous; nc += m.costs.non_hazardous;
    return { hazardous_t: r3(h), non_hazardous_t: r3(n), total_t: r3(h + n), hazardous_cost: r2(hc), non_hazardous_cost: r2(nc), total_cost: r2(hc + nc) };
  });
}

/** The twelve (year, month) periods of a reporting year starting at startMonth. */
export function reportingPeriods(year: number, startMonth = 1): { year: number; month: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m0 = startMonth - 1 + i;
    return { year: year + Math.floor(m0 / 12), month: (m0 % 12) + 1 };
  });
}
export const reportingYearLabel = (year: number, startMonth = 1) => startMonth === 1 ? String(year) : `${year}/${String((year + 1) % 100).padStart(2, "0")}`;

/** Parse a weight cell to kg; accepts "1,234", "1.2 t", "850kg". */
export function parseWeightKg(value: unknown, unitHint: "kg" | "t" = "kg"): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? (unitHint === "t" ? value * 1000 : value) : null;
  const s = String(value).trim().toLowerCase().replace(/,/g, "");
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n) || n < 0) return null;
  if (/\bt(onnes?)?\b|tonne/.test(s) && !/kg/.test(s)) return n * 1000;
  return unitHint === "t" && !/kg/.test(s) ? n * 1000 : n;
}

/** Parse a money cell to a number (strips £ and commas; brackets mean negative). */
export function parseMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[£,()\s-]/g, "");
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
  return neg ? -Number(s) : Number(s);
}

/** Parse a date cell (Excel serial, dd/mm/yyyy, yyyy-mm-dd) to YYYY-MM-DD. */
export function parseDateCell(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/** Duplicate key for imported collection rows. */
export const manualDuplicateKey = (provider: string, date: string, kg: number | null, ref: string | null | undefined) =>
  `${provider}|${date}|${kg == null ? "" : Math.round(kg * 1000) / 1000}|${String(ref ?? "").trim().toLowerCase()}`;

// ---------------------------------------------------------------------------
// "Breakdown of waste arisings" — the layout of Colas Rail's original spreadsheet.
// ---------------------------------------------------------------------------

/** Share of a stream's tonnes recycled, sent to energy recovery (RDF) and landfilled, in percent (sums to 100). */
export interface ColasTreatment { recycled: number; rdf: number; landfill: number }
export type ColasTreatments = Partial<Record<ColasStreamKey, ColasTreatment>>;

/** Starting point copied from the original spreadsheet: mixed municipal waste goes to energy recovery, everything else recycled. Editable in Settings. */
export const DEFAULT_TREATMENTS: Record<ColasStreamKey, ColasTreatment> = Object.fromEntries(
  COLAS_STREAMS.map(s => [s.key, s.key === "mixed_municipal" ? { recycled: 0, rdf: 100, landfill: 0 } : { recycled: 100, rdf: 0, landfill: 0 }]),
) as Record<ColasStreamKey, ColasTreatment>;

export function isValidTreatment(t: ColasTreatment | null | undefined): t is ColasTreatment {
  if (!t) return false;
  const vals = [t.recycled, t.rdf, t.landfill];
  if (vals.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100)) return false;
  return Math.abs(vals.reduce((a, b) => a + b, 0) - 100) < 0.01;
}
export function treatmentFor(key: ColasStreamKey, saved?: ColasTreatments | null): ColasTreatment {
  const t = saved?.[key];
  return isValidTreatment(t) ? t : DEFAULT_TREATMENTS[key];
}

/** Streams the original spreadsheet always lists, even when nothing was collected. */
const SHEET_STREAMS = new Set<ColasStreamKey>([
  "cardboard_paper", "plastic", "mixed_municipal", "co_mingled", "wood", "mixed_cd", "misc",
  "waste_engine_oil", "contaminated_packaging", "aqueous_oil_mix", "hydraulic_pipes", "oil_filters", "aerosols", "oil_contaminated_paint",
]);

export interface ArisingsFigures {
  removed: number; recycled: number; rdf: number; landfill: number;
  /** null when nothing was removed — an empty row has no percentage. */
  pctLandfill: number | null;
  /** Recycled + energy recovery (RDF counts as recycled), as a percentage of removed. */
  pctRecycled: number | null;
  charges: number; collections: number; missingWeights: number;
}
export interface ArisingsRow extends ArisingsFigures { key: ColasStreamKey; label: string; hazardous: boolean; treatment: ColasTreatment }
export interface ArisingsGroup { hazardous: boolean; label: string; rows: ArisingsRow[]; total: ArisingsFigures }
export interface ColasArisings { groups: ArisingsGroup[]; total: ArisingsFigures; consignmentNotes: number }

function figures(parts: { removed: number; recycled: number; rdf: number; landfill: number; charges: number; collections: number; missingWeights: number }): ArisingsFigures {
  const removed = r3(parts.removed);
  return {
    removed, recycled: r3(parts.recycled), rdf: r3(parts.rdf), landfill: r3(parts.landfill),
    pctLandfill: removed > 0 ? Math.round((parts.landfill / parts.removed) * 1000) / 10 : null,
    pctRecycled: removed > 0 ? Math.round(((parts.recycled + parts.rdf) / parts.removed) * 1000) / 10 : null,
    charges: r2(parts.charges), collections: parts.collections, missingWeights: parts.missingWeights,
  };
}
const sumFigures = (rows: ArisingsFigures[]) => figures(rows.reduce((a, r) => ({
  removed: a.removed + r.removed, recycled: a.recycled + r.recycled, rdf: a.rdf + r.rdf, landfill: a.landfill + r.landfill,
  charges: a.charges + r.charges, collections: a.collections + r.collections, missingWeights: a.missingWeights + r.missingWeights,
}), { removed: 0, recycled: 0, rdf: 0, landfill: 0, charges: 0, collections: 0, missingWeights: 0 }));

/** Builds the spreadsheet-style table from collection lines (one month, or several months for year to date). */
export function buildArisings(lines: Pick<ColasLine, "stream" | "hazardous" | "weight_t" | "charge" | "needsWeight" | "consignmentRef">[], saved?: ColasTreatments | null): ColasArisings {
  const groups: ArisingsGroup[] = [false, true].map(hazardous => {
    const rows: ArisingsRow[] = [];
    for (const s of COLAS_STREAMS.filter(x => x.hazardous === hazardous)) {
      const ls = lines.filter(l => l.stream === s.key);
      if (!ls.length && !SHEET_STREAMS.has(s.key)) continue;
      const t = treatmentFor(s.key, saved);
      const removed = ls.reduce((a, l) => a + (l.weight_t ?? 0), 0);
      rows.push({
        key: s.key, label: s.label, hazardous, treatment: t,
        ...figures({ removed, recycled: removed * t.recycled / 100, rdf: removed * t.rdf / 100, landfill: removed * t.landfill / 100,
          charges: ls.reduce((a, l) => a + (l.charge ?? 0), 0), collections: ls.length, missingWeights: ls.filter(l => l.needsWeight).length }),
      });
    }
    return { hazardous, label: hazardous ? "Hazardous" : "Non-hazardous", rows, total: sumFigures(rows) };
  });
  return {
    groups, total: sumFigures(groups.map(g => g.total)),
    consignmentNotes: lines.filter(l => l.hazardous && l.consignmentRef).length,
  };
}
