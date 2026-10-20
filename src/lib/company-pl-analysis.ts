// Read-only analysis of imported P&L worksheets. Never writes records.
import { SSF } from "xlsx";
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
  const originalHeader = rows[headerIndex];
  const knownYear = originalHeader.find((cell) => MONTH.test(cell.trim()))?.trim().match(MONTH)?.[2];
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const header = originalHeader.map((cell, i) => {
    if (MONTH.test(cell.trim())) return cell;
    const serial = Number(cell.trim().replace(/,/g, ""));
    if (serial < 40000 || serial > 70000) return cell;
    const date = SSF.parse_date_code(serial);
    if (!date || date.d !== 1 || String(date.y).slice(-2) !== knownYear) return cell;
    const next = originalHeader[i + 1]?.trim().match(MONTH);
    if (!next || names[date.m] !== next[1] || next[2] !== knownYear) return cell;
    return `${names[date.m - 1]}-${knownYear}`;
  });
  const columns = header.map((cell, i) => (MONTH.test(cell.trim()) ? i : -1)).filter((i) => i >= 0);
  if (columns.length !== 12 || columns.some((c, i) => header[c].trim() !== `${names[i]}-${knownYear}` || (i > 0 && c !== columns[i - 1] + 1))) return null;
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

export type PlProjectionMethod = "seasonal" | "growth" | "average" | "recent";
export type PlProjection = { key: PlProjectionMethod; label: string; actual: PlPeriodTotals; remaining: PlPeriodTotals; projected: PlPeriodTotals };
export type PlForecastMonth = { label: string; sales: number; grossProfit: number; overheads: number; netProfit: number; seasonal: boolean };

/** Plain-English documentation of each projection model, shown in Settings. */
export const PL_PROJECTION_METHODS: { key: PlProjectionMethod; label: string; summary: string; calculation: string; bestFor: string; caution: string }[] = [
  {
    key: "seasonal",
    label: "Prior-year seasonality",
    summary: "Follows last year's monthly pattern — busy and quiet months, including any year-end slowdown — scaled by this year's growth.",
    calculation: "Remaining sales = last year's sales for each remaining month × (this year's sales so far ÷ last year's sales for the same months). Overheads follow last year's monthly overhead pattern, scaled the same way. Gross margin stays at this year's year-to-date level.",
    bestFor: "Businesses with a repeating yearly rhythm, when a complete previous year is available.",
    caution: "Assumes this year keeps last year's shape. A one-off event last year (e.g. a lost contract) is carried into the forecast.",
  },
  {
    key: "growth",
    label: "Flat growth rate",
    summary: "Every remaining month equals this year's average month, grown by the same rate sales have grown versus last year.",
    calculation: "Remaining sales per month = (this year's average monthly sales) × (this year's sales so far ÷ last year's sales for the same months). Gross margin and overheads as for the seasonal model.",
    bestFor: "Steadily growing businesses without a strong monthly pattern.",
    caution: "Ignores seasonality entirely — a December slowdown or summer peak will not appear.",
  },
  {
    key: "average",
    label: "Year-to-date average",
    summary: "Every remaining month repeats this year's average month so far.",
    calculation: "Remaining sales per month = this year's sales so far ÷ months reported. The same average applies to gross profit, overheads and net profit.",
    bestFor: "A quick, stable baseline when the year so far looks typical.",
    caution: "Repeats any one-off income (e.g. a single large sale) in every remaining month, and ignores seasonality.",
  },
  {
    key: "recent",
    label: "Latest 3 months",
    summary: "Every remaining month repeats the average of the most recent three reported months.",
    calculation: "Remaining sales per month = average monthly sales over the latest three reported months. The same applies to gross profit, overheads and net profit.",
    bestFor: "When trading has recently shifted — up or down — and earlier months no longer reflect the run-rate.",
    caution: "Reacts strongly to a single unusual recent month and ignores seasonality.",
  },
];

/**
 * Month-by-month forecast for the unreported remainder of the year.
 * With a complete prior year, each month's sales follow that year's seasonal shape
 * (e.g. a December slowdown) scaled by this year's matched-period sales growth;
 * otherwise months repeat this year's monthly averages. Gross margin stays at the
 * year-to-date level; overheads and the reported-net residual continue at their
 * year-to-date monthly averages. Read-only: source worksheets stay unchanged.
 */
export function monthlyForecast(cur: PlYear, prev: PlYear, method: PlProjectionMethod = "seasonal"): PlForecastMonth[] {
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
  const prevComplete = prev.year === cur.year - 1 && prev.reportedMonths === 12;
  const prevSales = prevComplete ? line(prev, "sales") : undefined;
  const matchedPrev = sumTo(prevSales, months);
  const growth = prevSales && matchedPrev > 0 ? actual.sales / matchedPrev : 1;
  if (method === "seasonal" && prevSales && prevSales.slice(0, 12).every((v) => v !== null) && matchedPrev > 0) {
    const prevOh = line(prev, "overheads");
    const prevGp = line(prev, "gross profit");
    const prevNet = line(prev, "net profit", "net profit/loss", "net profit/(loss)");
    const matchedOh = sumTo(prevOh, months);
    const ohGrowth = prevOh && matchedOh > 0 ? actual.overheads / matchedOh : null;
    const prevResiduals = prevNet && prevGp && prevOh ? prevNet.map((n, i) => (n ?? 0) - (prevGp[i] ?? 0) + (prevOh[i] ?? 0)) : null;
    const matchedResidual = prevResiduals ? prevResiduals.slice(0, months).reduce((s, v) => s + v, 0) : 0;
    const residualGrowth = prevResiduals && matchedResidual !== 0 ? (actual.netProfit - actual.grossProfit + actual.overheads) / matchedResidual : null;
    return labels.slice(months, 12).map((label, i) => {
      const mi = months + i;
      const sales = (prevSales[mi] ?? 0) * growth;
      const grossProfit = sales * actual.grossMargin;
      const priorOverhead = prevOh?.[mi];
      const overheads = ohGrowth !== null && priorOverhead != null ? priorOverhead * ohGrowth : overheadPerMonth;
      const residual = residualGrowth !== null && prevResiduals ? prevResiduals[mi] * residualGrowth : residualPerMonth;
      return { label, sales, grossProfit, overheads, netProfit: grossProfit - overheads + residual, seasonal: true };
    });
  }
  if (method === "recent") {
    const recentMonths = Math.min(3, months);
    const recentAvg = sumTo(line(cur, "sales"), months) - sumTo(line(cur, "sales"), months - recentMonths);
    return labels.slice(months, 12).map((label) => build(label, recentAvg / recentMonths, false));
  }
  const avgSales = (actual.sales / months) * (method === "growth" ? growth : 1);
  return labels.slice(months, 12).map((label) => build(label, avgSales, false));
}

/** Per-month actuals for the reported part of the year (sales, gross profit, overheads, net profit). */
export function monthlyActuals(y: PlYear): PlForecastMonth[] {
  const sales = line(y, "sales") ?? [];
  const grossProfit = line(y, "gross profit") ?? [];
  const overheads = line(y, "overheads") ?? [];
  const net = line(y, "net profit", "net profit/loss", "net profit/(loss)") ?? [];
  return y.monthLabels.slice(0, y.reportedMonths).map((label, i) => ({
    label,
    sales: sales[i] ?? 0,
    grossProfit: grossProfit[i] ?? 0,
    overheads: overheads[i] ?? 0,
    netProfit: net[i] ?? 0,
    seasonal: false,
  }));
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
  const matchedPrev = prev.year === cur.year - 1 ? periodTotals(prev, Math.min(months, prev.reportedMonths)) : null;
  if (matchedPrev && matchedPrev.sales > 0 && prev.reportedMonths >= months) {
    const growth = actual.sales / matchedPrev.sales;
    const growthSales = (actual.sales / months) * growth * remainingMonths;
    const growthGp = growthSales * actual.grossMargin;
    const growthOh = (actual.overheads / months) * remainingMonths;
    const growthResidual = ((actual.netProfit - actual.grossProfit + actual.overheads) / months) * remainingMonths;
    results.unshift(make("growth", "Flat growth rate", totals(growthSales, growthGp, growthOh, growthGp - growthOh + growthResidual)));
    if (prev.reportedMonths === 12 && complete(prev, 12)) {
      const full = periodTotals(prev, 12);
      const sales = (full.sales - matchedPrev.sales) * growth;
      const grossProfit = sales * actual.grossMargin;
      // Overheads and the net-profit residual follow the prior year's monthly shape, scaled to this year's level.
      const prevOh = line(prev, "overheads");
      const prevGp = line(prev, "gross profit");
      const prevNet = line(prev, "net profit", "net profit/loss", "net profit/(loss)");
      if (!prevOh || !prevGp || !prevNet) return results;
      const ohGrowth = matchedPrev && sumTo(prevOh, months) > 0 ? actual.overheads / sumTo(prevOh, months) : null;
      const prevResiduals = prevNet.map((n, i) => (n ?? 0) - (prevGp[i] ?? 0) + (prevOh[i] ?? 0));
      const matchedResidual = prevResiduals.slice(0, months).reduce((s, v) => s + v, 0);
      const residualGrowth = matchedResidual !== 0 ? (actual.netProfit - actual.grossProfit + actual.overheads) / matchedResidual : null;
      let overheads = 0;
      let residual = 0;
      for (let mi = months; mi < 12; mi++) {
        const priorOverhead = prevOh[mi];
        overheads += ohGrowth !== null && priorOverhead != null ? priorOverhead * ohGrowth : actual.overheads / months;
        residual += residualGrowth !== null ? prevResiduals[mi] * residualGrowth : (actual.netProfit - actual.grossProfit + actual.overheads) / months;
      }
      results.unshift(make("seasonal", "Prior-year seasonality", totals(sales, grossProfit, overheads, grossProfit - overheads + residual)));
    }
  }
  return results;
}
