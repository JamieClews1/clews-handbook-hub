import type { PlYear } from "./company-pl-analysis";
import type { TradingEvidence } from "./company-pl-trading";

export const OTHER_REVENUE_LINES = ["recyclables", "rfs till sales", "other sales"] as const;
export function salesMonths(year: PlYear, trading: TradingEvidence | null, allowCombined = true) {
  const cutoffMonth = trading?.cutoff?.startsWith(String(year.year)) ? Number(trading.cutoff.slice(5, 7)) : 0;
  return year.monthLabels.slice(0, Math.max(year.reportedMonths, cutoffMonth)).map((label, i) => {
    const recorded = i < year.reportedMonths;
    const skip = trading?.months.find(m => m.yr === year.year && m.mo === i + 1 && m.source === "skiptrak");
    const mid = trading?.months.find(m => m.yr === year.year && m.mo === i + 1 && m.source === "midweigh");
    const portal = skip && mid ? Number(skip.value) + Number(mid.value) : null;
    const categories = OTHER_REVENUE_LINES.map(key => ({ key, value: recorded ? year.lines.get(key)?.[i] ?? 0 : null }));
    const other = recorded ? categories.reduce((s, c) => s + (c.value ?? 0), 0) : null;
    const waste = recorded ? year.lines.get("waste income")?.[i] ?? null : null;
    const accounting = recorded ? year.lines.get("sales")?.[i] ?? null : null;
    const partial = i + 1 === cutoffMonth && Number(trading?.cutoff?.slice(8, 10)) < new Date(Date.UTC(year.year, cutoffMonth, 0)).getUTCDate();
    return { label, skip: skip ? Number(skip.value) : null, mid: mid ? Number(mid.value) : null, portal, other, waste, accounting, categories,
      combined: allowCombined && !partial && portal !== null && other !== null ? portal + other : null,
      gap: !partial && portal !== null && waste !== null ? portal - waste : null,
      reconciliation: waste !== null && other !== null && accounting !== null ? waste + other - accounting : null,
      unpriced: (skip?.unpriced ?? 0) + (mid?.unpriced ?? 0), partial };
  });
}

/** Never publish a partial total as a complete period. */
export function completeSalesTotal(values: (number | null)[]): number | null {
  return values.length && values.every(v => v !== null) ? values.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
}