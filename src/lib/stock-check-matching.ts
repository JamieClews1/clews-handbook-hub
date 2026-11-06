import { stockContainerKey } from "./stock-check-availability";

type StockType = { id: string; name: string; data_hub_keywords: string[] };
/** Same normalised longest-match classification for jobs, yard and profiles. */
export function bestStockType<T extends StockType>(value: string, types: T[]): T | null {
  const haystack = stockContainerKey(value.replace(/\bcu\.?\s*yds?\b/gi, "yd"));
  let best: T | null = null;
  let length = 0;
  for (const type of types) {
    for (const keyword of [...(type.data_hub_keywords ?? []), type.name]) {
      const key = stockContainerKey(keyword);
      if (!key || key.length <= length) continue;
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(haystack)) {
        best = type; length = key.length;
      }
    }
  }
  return best;
}