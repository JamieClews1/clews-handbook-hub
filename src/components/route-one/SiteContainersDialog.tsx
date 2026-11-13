import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { ArrowRightLeft, CalendarClock, Loader2, MapPin, Package, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLiveJobsSettings } from "@/hooks/useLiveJobsSettings";
import { currentSiteContainers, HISTORY_FIELDS, type HistoryJob, type LastMovement, type SiteBin } from "@/lib/site-history";
import { isCompletedRentalMovement } from "@/lib/rental-open-movements";
import type { StandingBinRule } from "@/lib/standing-bins";
import { londonCalendarKey } from "@/lib/ui-calendar";
import { parseLoadReportDate } from "@/lib/load-report-dates";
import { formatEwc, standardWasteName } from "@/lib/waste-streams";
import { bookingContainerLabel } from "@/lib/container-taxonomy";

export type ContainersSite = { customer: string; site: string; address: string; postcode: string };
export type OnSiteContainer = { container: string; count: number; lastMoved: LastMovement | null; bin?: SiteBin };
type Booked = { key: string; date: string; type: string; container: string; source: string };

const dateLabel = (value: string | null | undefined) => {
  const date = parseLoadReportDate(value ?? null);
  return date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "Undated";
};
const daysAgo = (value: string, today: string) => {
  const a = parseLoadReportDate(value), b = parseLoadReportDate(today);
  if (!a || !b) return "";
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 60 ? `${days} days ago` : `${Math.round(days / 7)} weeks ago`;
};
const quoted = (value: string) => `"${value.replace(/["\\]/g, "\\$&")}"`;
const wasteLabel = (waste: string | null, ewc: string | null) => (waste ? standardWasteName(waste, ewc, { source: "skiptrak" }) : "") || formatEwc(ewc) || "Waste not recorded";

async function readPages<T>(read: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await read(from, from + 499);
    if (error) throw new Error(error.message);
    all.push(...((data ?? []) as T[]));
    if (!Array.isArray(data) || data.length < 500) return all;
  }
}

/**
 * Read-only view of containers estimated on a site (same replay as Live Jobs and
 * Site History) shown before a booking is started. Choosing an action only fills
 * the booking form; nothing is saved here.
 */
export function SiteContainersDialog({ site, onOpenChange, onUseSite, onBookExchange }: {
  site: ContainersSite | null;
  onOpenChange: (open: boolean) => void;
  onUseSite: () => void;
  onBookExchange: (container: OnSiteContainer) => Promise<void>;
}) {
  const { settings } = useLiveJobsSettings();
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [rules, setRules] = useState<StandingBinRule[]>([]);
  const [ownKeys, setOwnKeys] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<string[]>([]);
  const [native, setNative] = useState<Booked[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [booking, setBooking] = useState<string | null>(null);
  const request = useRef(0);
  const today = londonCalendarKey();
  const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

  useEffect(() => {
    if (!site?.site) { setJobs([]); setNative([]); return; }
    const id = ++request.current;
    setLoading(true); setError(""); setJobs([]); setNative([]); setRules([]);
    (async () => {
      const columns = ["site_name", "data_hub_site", "data_hub_site_2", "data_hub_site_3", "data_hub_site_4", "data_hub_site_5"];
      const { data: mapped } = await supabase.from("customer_sites").select(columns.join(",")).eq("is_archived", false).or(columns.map(c => `${c}.eq.${quoted(site.site)}`).join(","));
      const siteNames = [...new Set([site.site, ...((mapped ?? []) as unknown as Record<string, string | null>[]).flatMap(r => columns.map(c => r[c]))].filter((n): n is string => Boolean(n?.trim())))];
      const [history, standing, own, routeOne] = await Promise.all([
        readPages<HistoryJob>((from, to) => supabase.from("data_hub_jobs").select(HISTORY_FIELDS).eq("source", "skiptrak").in("site", siteNames).gte("job_date", since).order("job_date", { ascending: false }).order("id").range(from, to)),
        supabase.from("site_standing_bins").select("id,customer,site,container_type,ewc,bin_count,active,notes").eq("active", true).in("site", siteNames),
        supabase.from("rental_chases").select("bin_key").eq("own_skip", true),
        supabase.from("route_one_jobs").select("id,job_number,scheduled_date,job_type,container_type,container_size,status").in("site_name", siteNames).gte("scheduled_date", today).neq("status", "completed").order("scheduled_date").limit(20),
      ]);
      if (standing.error || own.error || routeOne.error) throw new Error("unavailable");
      if (id !== request.current) return;
      setNames(siteNames);
      setJobs(history);
      setRules((standing.data ?? []) as StandingBinRule[]);
      setOwnKeys(new Set((own.data ?? []).map(r => r.bin_key)));
      setNative((routeOne.data ?? []).map(j => ({ key: j.job_number || j.id, date: j.scheduled_date, type: j.job_type, container: bookingContainerLabel(j.container_type, j.container_size), source: "Route One" })));
    })()
      .catch(() => { if (id === request.current) setError("Containers on site could not be loaded."); })
      .finally(() => { if (id === request.current) setLoading(false); });
  }, [site?.site, site?.customer, retry, since, today]);

  const current = useMemo(() => currentSiteContainers(jobs, rules, settings, since, today), [jobs, rules, settings, since, today]);
  const total = current.reduce((n, c) => n + c.count, 0);
  const lastJob = useMemo(() => jobs.filter(j => isCompletedRentalMovement(j, today)).sort((a, b) => (b.job_date ?? "").localeCompare(a.job_date ?? ""))[0], [jobs, today]);
  const booked = useMemo(() => {
    const rows = new Map<string, Booked>();
    for (const j of jobs) if (j.job_date && j.job_date >= today && !isCompletedRentalMovement(j, today)) rows.set(j.job_number, { key: j.job_number, date: j.job_date, type: j.movement_type ?? "Job", container: j.container_type ?? "", source: "Skip" });
    for (const j of native) if (!rows.has(j.key)) rows.set(j.key, j);
    return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [jobs, native, today]);

  const book = async (c: OnSiteContainer, key: string) => {
    setBooking(key);
    try { await onBookExchange(c); } finally { setBooking(null); }
  };

  return <Dialog open={Boolean(site)} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Containers on site</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">{site?.customer}{site?.site ? ` · ${site.site}` : ""}</p>
            <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" />{[site?.address, site?.postcode].filter(Boolean).join(", ") || "Address not recorded"}</p>
          </div>
        </DialogDescription>
      </DialogHeader>

      {loading && <div role="status" className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Checking containers on site…</div>}
      {error && !loading && <div role="alert" className="flex flex-wrap items-center gap-3 py-4 text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={() => setRetry(n => n + 1)}>Try again</Button></div>}

      {!loading && !error && <div className="space-y-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-3">
          <span className="text-3xl font-semibold tabular-nums">{total}</span>
          <span className="font-medium">{total === 1 ? "container" : "containers"} on site now</span>
          <span className="text-xs text-muted-foreground">Estimated from completed Skip movements, as in Live Jobs</span>
        </div>

        {current.length === 0 ? <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">No containers currently identified on site.</p>
          {lastJob && <p>Last job here: <span className="font-medium">{lastJob.movement_type}</span> · {lastJob.container_type} · {dateLabel(lastJob.job_date)} ({daysAgo(lastJob.job_date ?? "", today)})</p>}
        </div> : <ul className="space-y-2" aria-label="Containers on site">
          {current.map(c => {
            const own = names.some(n => ownKeys.has(`${n.toLowerCase().trim()}|||${c.container.toLowerCase().trim()}`));
            const severalSites = new Set(c.bins.map(b => b.site.toLowerCase())).size > 1;
            return <li key={c.container} className="rounded-md border border-border bg-card">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-semibold tabular-nums">{c.count} × {c.container}</span>
                <Badge variant="outline">{own ? "Own" : "Clews"}</Badge>
              </div>
              <ul className="divide-y divide-border">
                {c.bins.map(b => {
                  const key = `${c.container}|${b.site}|${b.ewc ?? ""}`;
                  return <li key={key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium">{b.count > 1 ? `${b.count} × ` : ""}{wasteLabel(b.waste, b.ewc)}{b.ewc && <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{formatEwc(b.ewc)}</span>}</p>
                      {severalSites && <p className="text-xs text-muted-foreground">Skiptrak site: {b.site}</p>}
                      {b.lastMoved ? <p className="text-sm"><CalendarClock className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground" />Last moved <span className="font-medium whitespace-nowrap">{dateLabel(b.lastMoved.date)}</span> <span className="text-muted-foreground">({daysAgo(b.lastMoved.date, today)}) · {b.lastMoved.movement} · job #{b.lastMoved.jobNumber}</span></p> : <p className="text-sm text-muted-foreground">Last movement not recorded</p>}
                    </div>
                    <Button type="button" size="sm" disabled={!b.lastMoved || booking !== null} onClick={() => void book({ container: c.container, count: b.count, lastMoved: b.lastMoved, bin: b }, key)}>
                      {booking === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}Book exchange
                    </Button>
                  </li>;
                })}
              </ul>
            </li>;
          })}
        </ul>}

        {booked.length > 0 && <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Truck className="h-4 w-4" />Already booked</h3>
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {booked.map(b => <li key={`${b.source}:${b.key}`} className="flex flex-wrap items-center gap-2 px-3 py-2"><span className="font-medium tabular-nums">{dateLabel(b.date)}</span><span className="capitalize">{b.type.replace(/_/g, " ")}</span><span className="text-muted-foreground">{b.container}</span><Badge variant="outline" className="ml-auto">{b.source} #{b.key}</Badge></li>)}
          </ul>
        </div>}
      </div>}

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="button" variant="outline" onClick={onUseSite}>Use this site for another job</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
