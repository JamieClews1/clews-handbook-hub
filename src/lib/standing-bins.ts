import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { londonCalendarKey } from "./ui-calendar";
import { rentalContainerKey, rentalCustomerKey } from "./rental-open-movements";

/** Staff-confirmed number of containers standing on one site position
 * (site + container size + EWC). Skiptrak lines carry no asset numbers, so two
 * identical bins serviced only by exchanges collapse into one; a rule restores them. */
export type StandingBinRule = {
  id: string;
  customer: string | null;
  site: string;
  container_type: string;
  ewc: string;
  bin_count: number;
  active: boolean;
  notes?: string | null;
};

type MovementLike = {
  id: string;
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  container_type: string | null;
  movement_type: string | null;
  ewc: string | null;
};

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const ewcKey = (s: string | null | undefined) => (s ?? "").replace(/\s/g, "");

export const STANDING_PREFIX = "standing:";
export const isStandingBinJob = (job: { id: string }) => job.id.startsWith(STANDING_PREFIX);

export function standingRuleMatches(rule: StandingBinRule, job: MovementLike): boolean {
  if (norm(job.site) !== norm(rule.site)) return false;
  if (!job.container_type || rentalContainerKey(job.container_type) !== rentalContainerKey(rule.container_type)) return false;
  if (ewcKey(job.ewc) !== ewcKey(rule.ewc)) return false;
  if (rule.customer && rentalCustomerKey(job.customer) !== rentalCustomerKey(rule.customer)) return false;
  return true;
}

/** Add virtual establishing deliveries so the shared replays count the confirmed
 * number of bins. Only tops up to the rule: real deliveries already in the window
 * count towards it, and any later real collection still reduces the total, so a
 * removed bin clears itself without editing the rule. Rules with no recent
 * movement for their position add nothing. */
export function withStandingBins<T extends MovementLike>(jobs: T[], rules: StandingBinRule[], today = londonCalendarKey()): T[] {
  const extra: T[] = [];
  for (const rule of rules) {
    if (!rule.active || rule.bin_count < 1) continue;
    const matched = jobs.filter(j => j.job_date && j.job_date <= today && !isStandingBinJob(j) && standingRuleMatches(rule, j));
    if (!matched.length) continue;
    const delivered = matched.filter(j => j.movement_type === "Deliver").length;
    const collected = matched.filter(j => j.movement_type === "Collect").length;
    const current = delivered === 0 && collected === 0 ? 0 : Math.max(delivered - collected, 0);
    const missing = rule.bin_count - current;
    if (missing <= 0) continue;
    const start = matched.reduce((min, j) => (j.job_date! < min ? j.job_date! : min), matched[0].job_date!);
    const template = [...matched].sort((a, b) => (b.job_date ?? "").localeCompare(a.job_date ?? ""))[0];
    for (let i = 0; i < missing; i++) {
      extra.push({ ...template, id: `${STANDING_PREFIX}${rule.id}:${i}`, job_number: "0", job_date: start, movement_type: "Deliver", rental_status: "Y" } as T);
    }
  }
  return extra.length ? [...extra, ...jobs] : jobs;
}

export function useStandingBinRules(): StandingBinRule[] {
  const [rules, setRules] = useState<StandingBinRule[]>([]);
  useEffect(() => {
    supabase.from("site_standing_bins").select("id,customer,site,container_type,ewc,bin_count,active,notes").eq("active", true)
      .then(({ data }) => setRules((data ?? []) as StandingBinRule[]));
  }, []);
  return rules;
}
