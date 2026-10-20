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
  const year = 2000 + Number(header[columns[0]].trim().match(MONTH)![2]);
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
