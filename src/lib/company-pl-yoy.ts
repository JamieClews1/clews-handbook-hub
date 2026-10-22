import { parsePlSheet, type PlYear } from "./company-pl-analysis";
import type { PlSheetName, PlSheets } from "./company-pl";

export type PlStreamKind = "revenue" | "cost" | "summary";
const summaries = new Set(["sales", "purchases", "direct expenses", "gross profit", "gross profit %", "overheads", "net profit", "net profit/loss", "net profit/(loss)", "dividend"]);
const keyOf = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

export function workbookYears(records: { imported_at: string; sheets: PlSheets }[], source: PlSheetName): PlYear[] {
  const years = new Map<number, PlYear>();
  for (const record of [...records].sort((a, b) => a.imported_at.localeCompare(b.imported_at))) {
    const rows = record.sheets[source];
    const year = rows ? parsePlSheet(rows) : null;
    if (year) years.set(year.year, year);
  }
  return [...years.values()].sort((a, b) => a.year - b.year);
}

export function plStreams(years: PlYear[]) {
  const labels = new Map<string, string>();
  for (const year of years) for (const label of year.order) labels.set(keyOf(label), label);
  return [...labels].filter(([key]) => !key.includes("%"))
    .map(([key, label]) => ({ key, label, kind: (summaries.has(key) ? "summary" : /sales|income|recyclables/i.test(key) ? "revenue" : "cost") as PlStreamKind }));
}

/** Missing, errored and unreported cells are unknown, never zero or forecasts. */
export function comparePlStream(years: PlYear[], key: string, start: number, end: number) {
  const first = Math.max(1, Math.min(12, start));
  const last = Math.max(first, Math.min(12, end));
  const valueAt = (year: PlYear, month: number): number | null => month <= year.reportedMonths ? year.lines.get(key)?.[month - 1] ?? null : null;
  const totals = years.map(year => {
    const values = Array.from({ length: last - first + 1 }, (_, i) => valueAt(year, first + i));
    const total = values.every(value => value !== null) ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
    return { year: year.year, total };
  });
  const monthly = Array.from({ length: last - first + 1 }, (_, i) => ({
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][first + i - 1],
    ...Object.fromEntries(years.map(year => [String(year.year), valueAt(year, first + i)])),
  }));
  return { monthly, totals: totals.map(row => {
    const previous = totals.find(candidate => candidate.year === row.year - 1)?.total;
    const delta = row.total !== null && previous != null ? row.total - previous : null;
    return { ...row, delta, percent: delta !== null && previous ? delta / Math.abs(previous) : null };
  }) };
}