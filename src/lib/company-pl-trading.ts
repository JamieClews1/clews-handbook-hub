import type { PlForecastMonth } from "./company-pl-analysis";
export type TradingMonth = { source: string; yr: number; mo: number; jobs: number; tonnes: number; value: number; unpriced: number };
export type TradingEvidence = { cutoff: string | null; months: TradingMonth[]; customers: { source: string; customer: string; current_value: number; previous_value: number; current_tonnes: number; previous_tonnes: number }[] };

/** Relative operational momentum, not accounting income. Matched reporting days are supplied by the RPC. */
export function tradingFactor(data: TradingEvidence | null, year: number, reportedMonths: number, forecastMonth: number): number | null {
  if (!data?.cutoff) return null;
  const lastMonth = Number(data.cutoff.slice(5, 7));
  if (lastMonth <= reportedMonths) return null;
  const recentStart = Math.max(reportedMonths + 1, lastMonth - 1);
  const start = forecastMonth <= lastMonth ? forecastMonth : recentStart;
  const end = forecastMonth <= lastMonth ? forecastMonth : lastMonth;
  const sum = (yr: number, from: number, to: number) => data.months.filter((m) => m.yr === yr && m.mo >= from && m.mo <= to).reduce((s, m) => s + Number(m.value), 0);
  const basePrev = sum(year - 1, 1, reportedMonths), baseCur = sum(year, 1, reportedMonths);
  const recentPrev = sum(year - 1, start, end), recentCur = sum(year, start, end);
  if (basePrev <= 0 || baseCur <= 0 || recentPrev <= 0 || recentCur <= 0) return null;
  for (const source of ["skiptrak", "midweigh"]) {
    // A missing baseline month is unknown, not zero: it would artificially inflate recent growth.
    if (![year, year - 1].every((yr) => Array.from({ length: reportedMonths }, (_, i) => i + 1).every((mo) => data.months.some((m) => m.source === source && m.yr === yr && m.mo === mo)))) return null;
    if (![year, year - 1].every((yr) => data.months.some((m) => m.source === source && m.yr === yr && m.mo >= start && m.mo <= end))) return null;
  }
  return (recentCur / recentPrev) / (baseCur / basePrev);
}

export function adjustTradingForecast(rows: PlForecastMonth[], data: TradingEvidence | null, year: number, reportedMonths: number): PlForecastMonth[] {
  return rows.map((m, i) => {
    const factor = tradingFactor(data, year, reportedMonths, reportedMonths + i + 1);
    if (factor === null) return m;
    const sales = m.sales * factor, grossProfit = m.grossProfit * factor;
    return { ...m, sales, grossProfit, netProfit: m.netProfit + grossProfit - m.grossProfit };
  });
}