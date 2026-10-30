import { monthlyForecast, type PlYear, type PlProjectionMethod } from "./company-pl-analysis";
/** Reuse the P&L scalar forecast maths with operational values only; no accounting reads. */
export function operationalForecast(values: (number | null)[], previous: (number | null)[], year: number, completedMonths: number, method: PlProjectionMethod): number[] | null {
  if (completedMonths < 1 || values.slice(0, completedMonths).some(value => value === null)) return null;
  if ((method === "seasonal" || method === "growth") && previous.some(value => value === null)) return null;
  const adapter = (series: (number | null)[], y: number, count: number): PlYear => ({ year: y, reportedMonths: count, monthLabels: Array.from({ length: 12 }, (_, month) => `${month + 1}`), order: [], lines: new Map([["sales", series], ["gross profit", Array(12).fill(0)], ["overheads", Array(12).fill(0)], ["net profit", Array(12).fill(0)]]) });
  const forecast = monthlyForecast(adapter(values, year, completedMonths), adapter(previous, year - 1, 12), method);
  return [...values.slice(0, completedMonths).map(value => value ?? 0), ...forecast.map(row => row.sales)];
}