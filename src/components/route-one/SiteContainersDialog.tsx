import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { ArrowRightLeft, CalendarCheck, CalendarClock, Copy, Loader2, MapPin, Package, Repeat, Truck } from "lucide-react";
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
import { previousArticJobs } from "@/lib/artic-site-jobs";
import { addDaysKey, binFutureBookings, detectCadenceWeeks, nextExchangeAfterBookings, scheduleCoversBin, scheduleFrequencyLabel, type BinPosition, type FutureBooking, type ScheduleRow } from "@/lib/route-job-schedules";
import { ScheduleEditorDialog, scheduleDraftFromSkiptrak, type ScheduleDraft } from "./ScheduleEditorDialog";

export type PreviousJobMode = "exchange" | "duplicate";

export type ContainersSite = { customer: string; site: string; address: string; postcode: string };
/** `after` is set when exchanges are already booked for the bin, so the new one follows the last booking. */
export type OnSiteContainer = { container: string; count: number; lastMoved: LastMovement | null; bin?: SiteBin; after?: { jobNumber: string; date: string; cadenceWeeks: number | null } };
type Booked = { key: string; date: string; type: string; container: string; source: string };
type NativeBooking = { id: string; job_number: string | null; scheduled_date: string; job_type: string; site_name: string | null; container_type: string | null; container_size: string | null; ewc_code: string | null; schedule_id: string | null };
const KEEP_MOVEMENTS = new Set(["Deliver", "Exchange", "Tip/Return", "WasteTruck"]);
const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const shortDate = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

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
export function SiteContainersDialog({ site, onOpenChange, onUseSite, onBookExchange, onUsePreviousJob, scheduleOnly = false, onSchedulesChanged }: {
  site: ContainersSite | null;
  onOpenChange: (open: boolean) => void;
  onUseSite?: () => void;
  onBookExchange?: (container: OnSiteContainer) => Promise<void>;
  /** Scheduled jobs page: only offer setting up or editing schedules. */
  scheduleOnly?: boolean;
  onSchedulesChanged?: () => void;
  /** Prefill from a previous Skip job (by row id) as an exchange or an identical repeat. */
  onUsePreviousJob?: (jobId: string, mode: PreviousJobMode) => Promise<void>;
}) {
  const { settings } = useLiveJobsSettings();
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [rules, setRules] = useState<StandingBinRule[]>([]);
  const [ownKeys, setOwnKeys] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<string[]>([]);
  const [native, setNative] = useState<NativeBooking[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(null);
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
      const [history, standing, own, routeOne, saved] = await Promise.all([
        readPages<HistoryJob>((from, to) => supabase.from("data_hub_jobs").select(HISTORY_FIELDS).eq("source", "skiptrak").in("site", siteNames).gte("job_date", since).order("job_date", { ascending: false }).order("id").range(from, to)),
        supabase.from("site_standing_bins").select("id,customer,site,container_type,ewc,bin_count,active,notes").eq("active", true).in("site", siteNames),
        supabase.from("rental_chases").select("bin_key").eq("own_skip", true),
        supabase.from("route_one_jobs").select("id,job_number,scheduled_date,job_type,site_name,container_type,container_size,ewc_code,schedule_id,status").in("site_name", siteNames).gte("scheduled_date", today).neq("status", "completed").order("scheduled_date").limit(200),
        supabase.from("route_one_job_schedules").select("*").or(`site_name.in.(${siteNames.map(quoted).join(",")}),match_site.in.(${siteNames.map(quoted).join(",")})`),
      ]);
      if (standing.error || own.error || routeOne.error || saved.error) throw new Error("unavailable");
      if (id !== request.current) return;
      setNames(siteNames);
      setJobs(history);
      setRules((standing.data ?? []) as StandingBinRule[]);
      setOwnKeys(new Set((own.data ?? []).map(r => r.bin_key)));
      setNative((routeOne.data ?? []) as NativeBooking[]);
      setSchedules((saved.data ?? []) as ScheduleRow[]);
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
    for (const j of native) { const key = j.job_number || j.id; if (!rows.has(key)) rows.set(key, { key, date: j.scheduled_date, type: j.job_type, container: bookingContainerLabel(j.container_type, j.container_size), source: j.schedule_id ? "Scheduled" : "Route One" }); }
    return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [jobs, native, today]);

  const artic = useMemo(() => previousArticJobs(jobs, today), [jobs, today]);
  /** Bookings already made for a bin, its repeat interval and any saved schedule. */
  const planFor = (pos: BinPosition) => {
    const future: FutureBooking[] = binFutureBookings(pos, jobs, native, j => Boolean(j.job_date && j.job_date >= today && !isCompletedRentalMovement(j as HistoryJob, today)));
    const dates = jobs.filter(j => norm(j.site) === norm(pos.site) && norm(j.container_type) === norm(pos.container) && norm(j.ewc) === norm(pos.ewc) && KEEP_MOVEMENTS.has(j.movement_type ?? "")).map(j => j.job_date);
    const cadence = detectCadenceWeeks([...dates, ...future.map(f => f.date)]);
    const schedule = schedules.find(s => scheduleCoversBin(s, pos)) ?? null;
    return { future, cadence, schedule, lastBooked: future[future.length - 1] ?? null };
  };
  const openSchedule = async (pos: BinPosition, lastJobId: string | null, plan: ReturnType<typeof planFor>, key: string) => {
    if (plan.schedule) { setScheduleDraft({ ...plan.schedule }); return; }
    if (!site || !lastJobId) return;
    setBooking(key);
    try {
      const { data, error } = await supabase.from("data_hub_jobs").select("job_number,customer,site,container_type,waste_description,ewc,raw").eq("id", lastJobId).maybeSingle();
      if (error || !data) { setError("That bin's last job could not be loaded."); return; }
      const step = 7 * (plan.cadence ?? 1);
      const lastKnown = plan.lastBooked?.date ?? jobs.find(j => j.id === lastJobId)?.job_date ?? today;
      let start = nextExchangeAfterBookings(lastKnown, plan.cadence, null) ?? today;
      while (start < today) start = addDaysKey(start, step);
      setScheduleDraft(scheduleDraftFromSkiptrak(data, site, { intervalWeeks: plan.cadence, startDate: start }));
    } finally { setBooking(null); }
  };
  const planLines = (plan: ReturnType<typeof planFor>) => <>
    {plan.future.length > 0 && <p className="text-sm"><CalendarCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-primary" />Booked next <span className="font-medium">{plan.future.slice(0, 3).map(f => `${shortDate(f.date)} (#${f.key})`).join(" · ")}</span>{plan.future.length > 3 && <span className="text-muted-foreground"> +{plan.future.length - 3} more</span>}</p>}
    {plan.schedule ? <p className="text-xs"><Badge variant="secondary" className="mr-1.5 gap-1"><Repeat className="h-3 w-3" />{plan.schedule.active ? "Scheduled" : "Schedule paused"}</Badge>{scheduleFrequencyLabel(plan.schedule.interval_weeks)}{plan.schedule.booked_until && <span className="text-muted-foreground"> · booked to {shortDate(plan.schedule.booked_until)}</span>}</p>
      : plan.cadence && <p className="text-xs text-muted-foreground"><Repeat className="mr-1 inline h-3 w-3 align-[-1px]" />Runs {scheduleFrequencyLabel(plan.cadence).toLowerCase()}</p>}
  </>;
  const usePrevious = async (jobId: string, mode: PreviousJobMode, key: string) => {
    if (!onUsePreviousJob) return;
    setBooking(key);
    try { await onUsePreviousJob(jobId, mode); } finally { setBooking(null); }
  };
  const book = async (c: OnSiteContainer, key: string) => {
    setBooking(key);
    try { await onBookExchange?.(c); } finally { setBooking(null); }
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
                  const pos = { site: b.site, container: c.container, ewc: b.ewc };
                  const plan = planFor(pos);
                  const schedKey = `sched:${key}`;
                  return <li key={key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium">{b.count > 1 ? `${b.count} × ` : ""}{wasteLabel(b.waste, b.ewc)}{b.ewc && <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{formatEwc(b.ewc)}</span>}</p>
                      {severalSites && <p className="text-xs text-muted-foreground">Skiptrak site: {b.site}</p>}
                      {b.lastMoved ? <p className="text-sm"><CalendarClock className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground" />Last moved <span className="font-medium whitespace-nowrap">{dateLabel(b.lastMoved.date)}</span> <span className="text-muted-foreground">({daysAgo(b.lastMoved.date, today)}) · {b.lastMoved.movement} · job #{b.lastMoved.jobNumber}</span></p> : <p className="text-sm text-muted-foreground">Last movement not recorded</p>}
                      {planLines(plan)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={(!b.lastMoved && !plan.schedule) || booking !== null} onClick={() => void openSchedule(pos, b.lastMoved?.jobId ?? null, plan, schedKey)} aria-label={`${plan.schedule ? "Edit schedule" : "Schedule"} for ${c.container} ${b.ewc ?? ""}`}>
                        {booking === schedKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}{plan.schedule ? "Edit schedule" : "Schedule"}
                      </Button>
                      {!scheduleOnly && onBookExchange && <Button type="button" size="sm" disabled={!b.lastMoved || booking !== null} onClick={() => void book({ container: c.container, count: b.count, lastMoved: b.lastMoved, bin: b, after: plan.lastBooked ? { jobNumber: plan.lastBooked.key, date: plan.lastBooked.date, cadenceWeeks: plan.cadence } : undefined }, key)}>
                        {booking === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}{plan.lastBooked ? "Book next exchange" : "Book exchange"}
                      </Button>}
                    </div>
                  </li>;
                })}
              </ul>
            </li>;
          })}
        </ul>}

        {artic.length > 0 && (onUsePreviousJob || scheduleOnly) && <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Truck className="h-4 w-4" />Trailer jobs here</h3>
          <p className="text-xs text-muted-foreground">Previous artic work at this site in the last 12 months. Repeat the last job, or book an exchange to swap a standing trailer.</p>
          <ul className="divide-y divide-border rounded-md border border-border" aria-label="Previous trailer jobs">
            {artic.map(a => {
              const dupKey = `dup:${a.key}`, exKey = `ex:${a.key}`, schedKey = `sched:${a.key}`;
              const pos = { site: a.site, container: a.container, ewc: a.ewc };
              const plan = planFor(pos);
              const severalSites = new Set(artic.map(x => x.site.toLowerCase())).size > 1;
              return <li key={a.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-semibold">{a.container}</span>{a.standing && <Badge variant="secondary">Standing trailer</Badge>}</p>
                  <p className="text-sm">{wasteLabel(a.waste, a.ewc)}{a.ewc && <span className="ml-1.5 text-muted-foreground tabular-nums">{formatEwc(a.ewc)}</span>}</p>
                  {severalSites && <p className="text-xs text-muted-foreground">Skiptrak site: {a.site}</p>}
                  <p className="text-xs text-muted-foreground"><CalendarClock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />Last {a.last.movement} {dateLabel(a.last.date)} ({daysAgo(a.last.date, today)}) · job #{a.last.jobNumber} · {Object.entries(a.movements).map(([m, n]) => `${n} ${m}`).join(" · ")}</p>
                  {planLines(plan)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={booking !== null} onClick={() => void openSchedule(pos, a.last.id, plan, schedKey)} aria-label={`${plan.schedule ? "Edit schedule" : "Schedule"} for trailer ${a.container}`}>
                    {booking === schedKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}{plan.schedule ? "Edit schedule" : "Schedule"}
                  </Button>
                  {!scheduleOnly && onUsePreviousJob && <>
                  <Button type="button" size="sm" variant="outline" disabled={booking !== null} onClick={() => void usePrevious(a.last.id, "duplicate", dupKey)} aria-label={`Duplicate job ${a.last.jobNumber}`}>
                    {booking === dupKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}Duplicate
                  </Button>
                  <Button type="button" size="sm" disabled={booking !== null} onClick={() => void usePrevious(a.last.id, "exchange", exKey)} aria-label={`Book trailer exchange from job ${a.last.jobNumber}`}>
                    {booking === exKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}Book exchange
                  </Button>
                  </>}
                </div>
              </li>;
            })}
          </ul>
        </div>}

        {booked.length > 0 && <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Truck className="h-4 w-4" />All upcoming bookings</h3>
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {booked.map(b => <li key={`${b.source}:${b.key}`} className="flex flex-wrap items-center gap-2 px-3 py-2"><span className="font-medium tabular-nums">{dateLabel(b.date)}</span><span className="capitalize">{b.type.replace(/_/g, " ")}</span><span className="text-muted-foreground">{b.container}</span><Badge variant="outline" className="ml-auto">{b.source} #{b.key}</Badge></li>)}
          </ul>
        </div>}
      </div>}

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        {scheduleOnly ? site && <Button type="button" variant="outline" onClick={() => setScheduleDraft({ customer_name: site.customer, site_name: site.site, site_address: site.address || null, site_postcode: site.postcode || null, job_type: "exchange", interval_weeks: 1, start_date: today, book_ahead_days: 14, vat_rate: 20 })}><Repeat className="h-4 w-4" />Schedule a new job here</Button>
          : onUseSite && <Button type="button" variant="outline" onClick={onUseSite}>Use this site for another job</Button>}
      </DialogFooter>
      <ScheduleEditorDialog draft={scheduleDraft} onOpenChange={open => { if (!open) setScheduleDraft(null); }} onSaved={() => { setRetry(n => n + 1); onSchedulesChanged?.(); }} />
    </DialogContent>
  </Dialog>;
}
