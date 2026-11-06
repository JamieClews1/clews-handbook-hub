import { currentSiteContainers, type HistoryJob } from "./site-history";
import { normalisePostcode } from "@/hooks/usePostcodeCoords";
import type { StandingBinRule } from "./standing-bins";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

// Builds one map entry per physical site from the same Skiptrak movements the
// Live Jobs dashboard uses, so a marker's container count can never disagree
// with the dashboard. Presentation only: nothing here writes records.

export type SiteMapContainer = {
  container: string;
  category: string;
  wastes: string[];
  count: number;
};

export type SiteMapEntry = {
  key: string;
  site: string;
  names: string[];
  customers: string[];
  address: string;
  postcode: string;
  containers: SiteMapContainer[];
  total: number;
};

const mostCommon = <T,>(values: T[]): T | null => {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestCount = 0;
  for (const value of values) {
    const next = (counts.get(value) ?? 0) + 1;
    counts.set(value, next);
    if (next > bestCount) {
      best = value;
      bestCount = next;
    }
  }
  return best;
};

const textList = (values: (string | null | undefined)[]) =>
  [...new Set(values.map(v => String(v ?? "").trim()).filter(Boolean))].sort();

const addressOf = (job: HistoryJob) =>
  [job.address, job.address2, job.address3].map(v => String(v ?? "").trim()).filter(Boolean).join(", ");

export function siteMapEntries(
  jobs: HistoryJob[],
  rules: StandingBinRule[],
  settings: LiveJobsSettings,
  since: string,
  today: string,
): SiteMapEntry[] {
  const groups = new Map<string, HistoryJob[]>();
  for (const job of jobs) {
    const site = String(job.site ?? "").trim();
    if (!site) continue;
    const key = site.toLowerCase();
    const group = groups.get(key);
    if (group) group.push(job);
    else groups.set(key, [job]);
  }

  const entries: SiteMapEntry[] = [];
  for (const [key, group] of groups) {
    const containers = currentSiteContainers(group, rules, settings, since, today);
    entries.push({
      key,
      site: mostCommon(group.map(j => String(j.site ?? "").trim())) ?? key,
      names: textList(group.map(j => j.site)),
      customers: textList(group.map(j => j.customer)),
      address: mostCommon(group.map(addressOf).filter(Boolean)) ?? "",
      postcode: mostCommon(group.map(j => j.postcode).filter(Boolean)) ?? "",
      containers,
      total: containers.reduce((n, c) => n + c.count, 0),
    });
  }

  return entries.sort((a, b) => b.total - a.total || a.site.localeCompare(b.site));
}

/** Matches company, site name, postcode (with or without its space) or address. */
export function filterSiteMapEntries(entries: SiteMapEntry[], term: string): SiteMapEntry[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return entries;
  const compact = needle.replace(/\s+/g, "");
  return entries.filter(entry => {
    const haystack = [entry.site, entry.customers.join(" "), entry.address].join(" ").toLowerCase();
    if (haystack.includes(needle)) return true;
    const postcode = normalisePostcode(entry.postcode).toLowerCase();
    return postcode.length >= 3 && (postcode.includes(compact) || compact.includes(postcode));
  });
}

/** Distinct normalised postcodes worth looking up on the map. */
export function siteMapPostcodes(entries: SiteMapEntry[]): string[] {
  const out = new Set<string>();
  for (const entry of entries) {
    const postcode = normalisePostcode(entry.postcode);
    if (postcode.length >= 5) out.add(postcode);
  }
  return [...out].sort();
}
