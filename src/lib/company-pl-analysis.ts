// Read-only analysis of imported P&L worksheets. Never writes records.
const MONTH = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2})$/i;
const SUMMARY = new Set(["sales", "purchases", "direct expenses", "gross profit", "gross profit %", "overheads", "net profit", "net profit/loss", "net profit/(loss)", "dividend"]);

export type PlYear = { year: number; monthLabels: string[]; lines: Map<string, (number | null)[]>; order: string[]; reportedMonths: number };
export type PlPeriodTotals = { year: number; sales: number; grossProfit: number; overheads: number; netProfit: number; grossMargin: number; netMargin: number };

export function parseAmount(value: string | undefined): number | null {
  const text = String(value ?? "").trim().replace(/[£,\s]/g, "");
  if (!text || text.startsWith("#")) return null;
  const negative = /^\(.*\)$/.test(text);
  const n = Number(text.replace(/[()]/g, ""));
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

const norm = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

export function parsePlSheet(rows: string[][]): PlYear | null {
  const headerIndex = rows.findIndex((row) => row.filter((cell) => MONTH.test(cell.trim())).length >= 6);
  if (headerIndex < 0) return null;
  const header = rows[headerIndex];
  const columns = header.map((cell, i) => (MONTH.test(cell.trim()) ? i : -1)).filter((i) => i >= 0);
  const yearMatch = header[columns[0]].trim().match(MONTH);
  if (!yearMatch) return null;
  const year = 2000 + Number(yearMatch[2]);
  const lines = new Map<string, (number | null)[]>();
  const order: string[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const label = String(row[0] ?? "").trim();
    if (!label) continue;
    const values = columns.map((c) => parseAmount(row[c]));
    if (values.every((v) => v === null)) continue;
    const key = norm(label);
    if (lines.has(key)) continue; // first occurrence = summary line
    lines.set(key, values);
    order.push(label);
  }
  const sales = lines.get("sales") ?? [];
  let reportedMonths = 0;
  while (reportedMonths < columns.length && (sales[reportedMonths] ?? 0) !== 0) reportedMonths++;
  return { year, monthLabels: columns.map((c) => header[c].trim()), lines, order, reportedMonths };
}

export const sumTo = (values: (number | null)[] | undefined, months: number) =>
  (values ?? []).slice(0, months).reduce<number>((total, v) => total + (v ?? 0), 0);

function line(y: PlYear, ...keys: string[]) {
  for (const key of keys) { const v = y.lines.get(key); if (v) return v; }
  return undefined;
}

export function periodTotals(y: PlYear, months: number): PlPeriodTotals {
  const sales = sumTo(line(y, "sales"), months);
  const grossProfit = sumTo(line(y, "gross profit"), months);
  const overheads = sumTo(line(y, "overheads"), months);
  const netProfit = sumTo(line(y, "net profit", "net profit/loss", "net profit/(loss)"), months);
  return { year: y.year, sales, grossProfit, overheads, netProfit, grossMargin: sales ? grossProfit / sales : 0, netMargin: sales ? netProfit / sales : 0 };
}

/** Explains the net profit change: volume at old margin, margin change, overheads, remainder. */
export function profitBridge(prev: PlPeriodTotals, cur: PlPeriodTotals) {
  const sales = (cur.sales - prev.sales) * prev.grossMargin;
  const margin = (cur.grossMargin - prev.grossMargin) * cur.sales;
  const overheads = -(cur.overheads - prev.overheads);
  const change = cur.netProfit - prev.netProfit;
  return { sales, margin, overheads, other: change - sales - margin - overheads, change };
}

export function costWatch(prev: PlYear, cur: PlYear, months: number) {
  const prevSales = sumTo(line(prev, "sales"), months);
  const curSales = sumTo(line(cur, "sales"), months);
  return cur.order
    .filter((label) => !SUMMARY.has(norm(label)) && prev.lines.has(norm(label)))
    .map((label) => {
      const before = sumTo(prev.lines.get(norm(label)), months);
      const after = sumTo(cur.lines.get(norm(label)), months);
      return { label, before, after, change: after - before, pct: before ? (after - before) / Math.abs(before) : null, shareBefore: prevSales ? before / prevSales : 0, shareAfter: curSales ? after / curSales : 0 };
    })
    .filter((row) => row.before !== 0 || row.after !== 0);
}

export function monthlyNet(y: PlYear) {
  const net = line(y, "net profit", "net profit/loss", "net profit/(loss)") ?? [];
  return y.monthLabels.slice(0, y.reportedMonths).map((label, i) => ({ label, value: net[i] ?? 0 }));
}

export type PlProjection = { key: "seasonal" | "average" | "recent"; label: string; actual: PlPeriodTotals; remaining: PlPeriodTotals; projected: PlPeriodTotals };
export type PlForecastMonth = { label: string; sales: number; grossProfit: number; overheads: number; netProfit: number; seasonal: boolean };

/**
 * Month-by-month forecast for the unreported remainder of the year.
 * With a complete prior year, each month's sales follow that year's seasonal shape
 * (e.g. a December slowdown) scaled by this year's matched-period sales growth;
 * otherwise months repeat this year's monthly averages. Gross margin stays at the
 * year-to-date level; overheads and the reported-net residual continue at their
 * year-to-date monthly averages. Read-only: source worksheets stay unchanged.
 */
export function monthlyForecast(cur: PlYear, prev: PlYear): PlForecastMonth[] {
  const months = cur.reportedMonths;
  if (months < 1 || months >= 12) return [];
  const actual = periodTotals(cur, months);
  if (!actual.sales) return [];
  const overheadPerMonth = actual.overheads / months;
  const residualPerMonth = (actual.netProfit - actual.grossProfit + actual.overheads) / months;
  const build = (label: string, sales: number, seasonal: boolean): PlForecastMonth => {
    const grossProfit = sales * actual.grossMargin;
    return { label, sales, grossProfit, overheads: overheadPerMonth, netProfit: grossProfit - overheadPerMonth + residualPerMonth, seasonal };
  };
  const labels = cur.monthLabels;
  const prevSales = prev.year === cur.year - 1 && prev.reportedMonths === 12 ? line(prev, "sales") : undefined;
  const matchedPrev = sumTo(prevSales, months);
  if (prevSales && prevSales.slice(0, 12).every((v) => v !== null) && matchedPrev > 0) {
    const growth = actual.sales / matchedPrev;
    return labels.slice(months, 12).map((label, i) => build(label, (prevSales[months + i] ?? 0) * growth, true));
  }
  const avgSales = actual.sales / months;
  return labels.slice(months, 12).map((label) => build(label, avgSales, false));
}

/** Indicative year-end estimates only; source worksheets and reported totals stay unchanged. */
export function yearEndProjections(cur: PlYear, prev: PlYear): PlProjection[] {
  const months = cur.reportedMonths;
  if (months < 1 || months > 12) return [];
  const complete = (y: PlYear, count: number) => [line(y, "sales"), line(y, "gross profit"), line(y, "overheads"), line(y, "net profit", "net profit/loss", "net profit/(loss)")]
    .every((values) => values && values.slice(0, count).length === count && values.slice(0, count).every((v) => v !== null));
  if (!complete(cur, months)) return [];
  const actual = periodTotals(cur, months);
  const remainingMonths = 12 - months;
  const totals = (sales: number, grossProfit: number, overheads: number, netProfit: number): PlPeriodTotals => ({ year: cur.year, sales, grossProfit, overheads, netProfit, grossMargin: sales ? grossProfit / sales : 0, netMargin: sales ? netProfit / sales : 0 });
  const make = (key: PlProjection["key"], label: string, remaining: PlPeriodTotals): PlProjection => ({ key, label, actual, remaining, projected: totals(actual.sales + remaining.sales, actual.grossProfit + remaining.grossProfit, actual.overheads + remaining.overheads, actual.netProfit + remaining.netProfit) });
  const scale = (t: PlPeriodTotals, factor: number) => totals(t.sales * factor, t.grossProfit * factor, t.overheads * factor, t.netProfit * factor);
  const results: PlProjection[] = [make("average", "Year-to-date average", scale(actual, remainingMonths / months))];
  const recentMonths = Math.min(3, months);
  const earlier = periodTotals(cur, months - recentMonths);
  const recent = totals(actual.sales - earlier.sales, actual.grossProfit - earlier.grossProfit, actual.overheads - earlier.overheads, actual.netProfit - earlier.netProfit);
  results.push(make("recent", `Latest ${recentMonths} months`, scale(recent, remainingMonths / recentMonths)));
  if (prev.year === cur.year - 1 && prev.reportedMonths === 12 && complete(prev, 12)) {
    const matched = periodTotals(prev, months);
    const full = periodTotals(prev, 12);
    if (matched.sales > 0) {
      const sales = (full.sales - matched.sales) * (actual.sales / matched.sales);
      const grossProfit = sales * actual.grossMargin;
      const overheads = actual.overheads / months * remainingMonths;
      const residual = (actual.netProfit - actual.grossProfit + actual.overheads) / months * remainingMonths;
      results.unshift(make("seasonal", "Prior-year sales seasonality", totals(sales, grossProfit, overheads, grossProfit - overheads + residual)));
    }
  }
  return results;
}
