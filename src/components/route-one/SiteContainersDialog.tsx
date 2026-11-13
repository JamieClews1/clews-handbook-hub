import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { ArrowRightLeft, Copy, Loader2, MapPin, Repeat, Truck } from "lucide-react";
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
import { addDaysKey, binFutureBookings, detectCadenceWeeks, nativeMatchesBin, nextExchangeAfterBookings, scheduleCoversBin, skipMatchesBin, type BinPosition, type FutureBooking, type ScheduleRow } from "@/lib/route-job-schedules";
import { dotDate, dotDay, mergeDots, nativeDot, onSiteSince, shortFrequency, skipDot, timelineFlags } from "@/lib/container-timeline";
import { ContainerTimeline, TimelineLegend, TimelineSelectionBar, type TimelineRowModel } from "./ContainerTimeline";
import { ScheduleEditorDialog, scheduleDraftFromSkiptrak, type ScheduleDraft } from "./ScheduleEditorDialog";

export type PreviousJobMode = "exchange" | "duplicate";

export type ContainersSite = { customer: string; site: string; address: string; postcode: string };
/** `after` is set when exchanges are already booked for the bin, so the new one follows the last booking. */
export type OnSiteContainer = { container: string; count: number; lastMoved: LastMovement | null; bin?: SiteBin; after?: { jobNumber: string; date: string; cadenceWeeks: number | null } };
type Booked = { key: string; date: string; type: string; container: string; source: string };
type NativeBooking = { id: string; job_number: string | null; scheduled_date: string; job_type: string; site_name: string | null; container_type: string | null; container_size: string | null; ewc_code: string | null; schedule_id: string | null; status: string | null; assigned_driver_id: string | null };
const CHAIN_MOVEMENTS = new Set(["Deliver", "Exchange", "Collect", "Tip/Return"]);
const KEEP_MOVEMENTS = new Set(["Deliver", "Exchange", "Tip/Return", "WasteTruck"]);
const norm = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

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
export function SiteContainersDialog({ site, onOpenChange, onUseSite, onBookExchange, onUsePreviousJob, scheduleOnly = false, onSchedulesChanged, focusJob = null, onOpenJob, onExchangeFocusJob }: {
  site: ContainersSite | null;
  onOpenChange: (open: boolean) => void;
  onUseSite?: () => void;
  onBookExchange?: (container: OnSiteContainer) => Promise<void>;
  /** Scheduled jobs page: only offer setting up or editing schedules. */
  scheduleOnly?: boolean;
  onSchedulesChanged?: () => void;
  /** Prefill from a previous Skip job (by row id) as an exchange or an identical repeat. */
  onUsePreviousJob?: (jobId: string, mode: PreviousJobMode) => Promise<void>;
  /** Job number the pop-up was opened from: ringed, its row tinted and scrolled into view. */
  focusJob?: string | null;
  /** Open a Route One job in the job editor (Open job / Move date). */
  onOpenJob?: (nativeId: string, intent: "open" | "move") => void;
  /** Book an exchange from the job the pop-up was opened from (existing editor exchange flow). */
  onExchangeFocusJob?: () => void;
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
  const [selected, setSelected] = useState<string | null>(null);
  const request = useRef(0);
  const today = londonCalendarKey();
  const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

  useEffect(() => {
    if (!site?.site) { setJobs([]); setNative([]); setSelected(null); return; }
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
        // Same 12-month window as the Skip history so Route One copies of those jobs can be opened.
        readPages<NativeBooking>((from, to) => supabase.from("route_one_jobs").select("id,job_number,scheduled_date,job_type,site_name,container_type,container_size,ewc_code,schedule_id,status,assigned_driver_id").in("site_name", siteNames).or(`scheduled_date.gte.${since}${focusJob ? `,job_number.eq.${quoted(focusJob)}` : ""}`).order("scheduled_date").order("id").range(from, to)),
        supabase.from("route_one_job_schedules").select("*").or(`site_name.in.(${siteNames.map(quoted).join(",")}),match_site.in.(${siteNames.map(quoted).join(",")})`),
      ]);
      if (standing.error || own.error || saved.error) throw new Error("unavailable");
      if (id !== request.current) return;
      setNames(siteNames);
      setJobs(history);
      setRules((standing.data ?? []) as StandingBinRule[]);
      setOwnKeys(new Set((own.data ?? []).map(r => r.bin_key)));
      setNative(routeOne);
      setSchedules((saved.data ?? []) as ScheduleRow[]);
    })()
      .catch(() => { if (id === request.current) setError("Containers on site could not be loaded."); })
      .finally(() => { if (id === request.current) setLoading(false); });
  }, [site?.site, site?.customer, retry, since, today, focusJob]);

  const current = useMemo(() => currentSiteContainers(jobs, rules, settings, since, today), [jobs, rules, settings, since, today]);
  const total = current.reduce((n, c) => n + c.count, 0);
  const lastJob = useMemo(() => jobs.filter(j => isCompletedRentalMovement(j, today)).sort((a, b) => (b.job_date ?? "").localeCompare(a.job_date ?? ""))[0], [jobs, today]);
  /** Route One jobs still to do; past and completed ones only appear on the timeline. */
  const openNative = useMemo(() => native.filter(j => j.scheduled_date >= today && j.status !== "completed"), [native, today]);
  const booked = useMemo(() => {
    const rows = new Map<string, Booked>();
    for (const j of jobs) if (j.job_date && j.job_date >= today && !isCompletedRentalMovement(j, today)) rows.set(j.job_number, { key: j.job_number, date: j.job_date, type: j.movement_type ?? "Job", container: j.container_type ?? "", source: "Skip" });
    for (const j of openNative) { const key = j.job_number || j.id; if (!rows.has(key)) rows.set(key, { key, date: j.scheduled_date, type: j.job_type, container: bookingContainerLabel(j.container_type, j.container_size), source: j.schedule_id ? "Scheduled" : "Route One" }); }
    return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [jobs, openNative, today]);

  const artic = useMemo(() => previousArticJobs(jobs, today), [jobs, today]);
  /** Bookings already made for a bin, its repeat interval and any saved schedule. */
  const planFor = (pos: BinPosition) => {
    const future: FutureBooking[] = binFutureBookings(pos, jobs, openNative, j => Boolean(j.job_date && j.job_date >= today && !isCompletedRentalMovement(j as HistoryJob, today)));
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
  const usePrevious = async (jobId: string, mode: PreviousJobMode, key: string) => {
    if (!onUsePreviousJob) return;
    setBooking(key);
    try { await onUsePreviousJob(jobId, mode); } finally { setBooking(null); }
  };
  const book = async (c: OnSiteContainer, key: string) => {
    setBooking(key);
    try { await onBookExchange?.(c); } finally { setBooking(null); }
  };

  /** Dots for one bin position or trailer stream: its Skiptrak jobs plus matching Route One jobs. */
  const dotsFor = (pos: BinPosition, chained: boolean) => {
    const skip = jobs.filter(j => skipMatchesBin(j, pos) && (!chained || CHAIN_MOVEMENTS.has(j.movement_type ?? "")))
      .map(j => { const done = isCompletedRentalMovement(j, today); return !done && (j.job_date ?? "") < today ? null : skipDot(j, done, today); })
      .filter((d): d is NonNullable<typeof d> => Boolean(d));
    return mergeDots(skip, native.filter(j => nativeMatchesBin(j, pos)).map(nativeDot));
  };
  const scheduleBadge = (plan: ReturnType<typeof planFor>) => plan.schedule && <Badge variant="secondary" className="gap-1 font-normal"><Repeat className="h-3 w-3" />{plan.schedule.active ? "Scheduled" : "Schedule paused"}</Badge>;
  const scheduleButton = (pos: BinPosition, lastJobId: string | null, plan: ReturnType<typeof planFor>, schedKey: string, label: string, disabled = false) =>
    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={disabled || booking !== null} onClick={() => void openSchedule(pos, lastJobId, plan, schedKey)} aria-label={`${plan.schedule ? "Edit schedule" : "Schedule"} for ${label}`}>
      {booking === schedKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Repeat className="h-3.5 w-3.5" />}{plan.schedule ? "Edit schedule" : "Schedule"}
    </Button>;

  const rows = useMemo<TimelineRowModel[]>(() => {
    const out: TimelineRowModel[] = [];
    const severalBinSites = new Set(current.flatMap(c => c.bins.map(b => b.site.toLowerCase()))).size > 1;
    for (const c of current) {
      const own = names.some(n => ownKeys.has(`${n.toLowerCase().trim()}|||${c.container.toLowerCase().trim()}`));
      for (const b of c.bins) {
        const key = `${c.container}|${b.site}|${b.ewc ?? ""}`;
        const pos = { site: b.site, container: c.container, ewc: b.ewc };
        const plan = planFor(pos);
        const dots = dotsFor(pos, true);
        const frequency = plan.schedule ? shortFrequency(plan.schedule.interval_weeks) : plan.cadence ? shortFrequency(plan.cadence) : null;
        const canBook = !scheduleOnly && Boolean(onBookExchange);
        const bookLabel = plan.lastBooked ? "Book next exchange" : "Book exchange";
        const runBook = () => void book({ container: c.container, count: b.count, lastMoved: b.lastMoved, bin: b, after: plan.lastBooked ? { jobNumber: plan.lastBooked.key, date: plan.lastBooked.date, cadenceWeeks: plan.cadence } : undefined }, key);
        out.push({
          key, group: "onsite", title: `${b.count > 1 ? `${b.count} × ` : ""}${wasteLabel(b.waste, b.ewc)}`, ewc: formatEwc(b.ewc) || null, container: c.container,
          site: severalBinSites ? b.site : null,
          badges: <><Badge variant="outline" className="font-normal">{own ? "Own" : "Clews"}</Badge>{scheduleBadge(plan)}</>,
          since: onSiteSince(dots, today), frequency, dots, chained: true,
          flags: timelineFlags(dots, { today, cadenceWeeks: plan.schedule?.interval_weeks ?? plan.cadence, chained: true, scheduleActive: Boolean(plan.schedule?.active) }),
          actions: <>
            {scheduleButton(pos, b.lastMoved?.jobId ?? null, plan, `sched:${key}`, `${c.container} ${b.ewc ?? ""}`, !b.lastMoved && !plan.schedule)}
            {canBook && <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={!b.lastMoved || booking !== null} onClick={runBook}>
              {booking === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}{bookLabel}
            </Button>}
          </>,
          bookNext: canBook ? { label: bookLabel, busy: booking === key, disabled: !b.lastMoved || booking !== null, run: runBook } : undefined,
        });
      }
    }
    if (onUsePreviousJob || scheduleOnly || focusJob) {
      const severalTrailerSites = new Set(artic.map(x => x.site.toLowerCase())).size > 1;
      for (const a of artic) {
        const pos = { site: a.site, container: a.container, ewc: a.ewc };
        const plan = planFor(pos);
        const dots = dotsFor(pos, false);
        const dupKey = `dup:${a.key}`, exKey = `ex:${a.key}`;
        const canUse = !scheduleOnly && Boolean(onUsePreviousJob);
        out.push({
          key: a.key, group: "trailer", title: wasteLabel(a.waste, a.ewc), ewc: formatEwc(a.ewc) || null, container: a.container,
          site: severalTrailerSites ? a.site : null,
          badges: <>{a.standing && <Badge variant="secondary" className="font-normal">Standing trailer</Badge>}{scheduleBadge(plan)}</>,
          since: null, frequency: plan.schedule ? shortFrequency(plan.schedule.interval_weeks) : plan.cadence ? shortFrequency(plan.cadence) : null,
          dots, chained: false, flags: timelineFlags(dots, { today, cadenceWeeks: null, chained: false, scheduleActive: Boolean(plan.schedule?.active) }),
          actions: <>
            {scheduleButton(pos, a.last.id, plan, `sched:${a.key}`, `trailer ${a.container}`)}
            {canUse && <>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={booking !== null} onClick={() => void usePrevious(a.last.id, "duplicate", dupKey)} aria-label={`Duplicate job ${a.last.jobNumber}`}>
                {booking === dupKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}Duplicate
              </Button>
              <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={booking !== null} onClick={() => void usePrevious(a.last.id, "exchange", exKey)} aria-label={`Book trailer exchange from job ${a.last.jobNumber}`}>
                {booking === exKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}Book exchange
              </Button>
            </>}
          </>,
          bookNext: canUse ? { label: "Book exchange", busy: booking === exKey, disabled: booking !== null, run: () => void usePrevious(a.last.id, "exchange", exKey) } : undefined,
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, artic, jobs, native, openNative, schedules, names, ownKeys, today, booking, scheduleOnly, onBookExchange, onUsePreviousJob, focusJob]);

  const focusDot = focusJob ? rows.flatMap(r => r.dots.map(d => ({ d, r }))).find(x => x.d.jobNumber === focusJob) : undefined;
  useEffect(() => { if (focusDot && !selected) setSelected(focusDot.d.key); }, [focusDot, selected]);
  const shown = new Set(rows.flatMap(r => r.dots.map(d => d.jobNumber)));
  const otherBooked = booked.filter(b => !shown.has(b.key));
  const summary = current.map(c => `${c.count} × ${c.container}`).join(", ");

  return <Dialog open={Boolean(site)} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
      <DialogHeader className="shrink-0 space-y-2 border-b border-border px-5 py-4 pr-12">
        <DialogTitle>Containers on site</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-1">
            <p className="font-medium text-foreground">{site?.customer}{site?.site ? ` · ${site.site}` : ""}</p>
            <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" />{[site?.address, site?.postcode].filter(Boolean).join(", ") || "Address not recorded"}</p>
            {!loading && !error && <p className="text-foreground"><span className="font-semibold tabular-nums">{total ? `${summary} on site` : "No containers on site"}</span>
              {(onUsePreviousJob || scheduleOnly || focusJob) && artic.length > 0 && <span className="text-muted-foreground"> · {artic.length} trailer {artic.length === 1 ? "stream" : "streams"}</span>}
              <span className="text-xs text-muted-foreground"> · estimated from completed Skip movements, as in Live Jobs</span></p>}
          </div>
        </DialogDescription>
        {focusJob && <div className="rounded-md border border-info/40 bg-info/10 px-3 py-2 text-sm text-foreground">
          You opened this from job <span className="font-semibold tabular-nums">#{focusJob}</span>
          {focusDot ? <> · {focusDot.r.title}{focusDot.r.ewc ? ` ${focusDot.r.ewc}` : ""} · {dotDay(focusDot.d.date)} {dotDate(focusDot.d.date)}</> : <span className="text-muted-foreground"> · not matched to a container here yet</span>}
        </div>}
      </DialogHeader>

      {/* Flex column: the timeline takes the spare height and scrolls itself, keeping its sideways scrollbar on screen. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {loading && <div role="status" className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Checking containers on site…</div>}
        {error && !loading && <div role="alert" className="flex flex-wrap items-center gap-3 py-4 text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={() => setRetry(n => n + 1)}>Try again</Button></div>}

        {!loading && !error && <>
          {rows.length > 0 && <div className="shrink-0"><TimelineLegend /></div>}
          {rows.length > 0 ? <ContainerTimeline rows={rows} today={today} focusJob={focusJob} selectedKey={selected} onSelect={setSelected} />
            : <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">No containers currently identified on site.</p>
              {lastJob && <p>Last job here: <span className="font-medium">{lastJob.movement_type}</span> · {lastJob.container_type} · {dateLabel(lastJob.job_date)} ({daysAgo(lastJob.job_date ?? "", today)})</p>}
            </div>}

          {otherBooked.length > 0 && <div className="shrink-0 space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Truck className="h-4 w-4" />{rows.length ? "Other upcoming bookings here" : "Upcoming bookings"}</h3>
            <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
              {otherBooked.map(b => <li key={`${b.source}:${b.key}`} className="flex flex-wrap items-center gap-2 px-3 py-2"><span className="font-medium tabular-nums">{dateLabel(b.date)}</span><span className="capitalize">{b.type.replace(/_/g, " ")}</span><span className="text-muted-foreground">{b.container}</span><Badge variant="outline" className="ml-auto">{b.source} #{b.key}</Badge></li>)}
            </ul>
          </div>}
        </>}
      </div>

      {!loading && !error && rows.length > 0 && <div className="shrink-0 bg-background px-5 pb-3">
        <TimelineSelectionBar rows={rows} selectedKey={selected} onSelect={setSelected} today={today} onOpenJob={onOpenJob}
          focusExchange={focusJob && onExchangeFocusJob ? { jobNumber: focusJob, run: onExchangeFocusJob } : undefined} />
      </div>}

      <DialogFooter className="shrink-0 gap-2 border-t border-border px-5 py-3">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{focusJob ? "Close" : "Cancel"}</Button>
        {scheduleOnly ? site && <Button type="button" variant="outline" onClick={() => setScheduleDraft({ customer_name: site.customer, site_name: site.site, site_address: site.address || null, site_postcode: site.postcode || null, job_type: "exchange", interval_weeks: 1, start_date: today, book_ahead_days: 14, vat_rate: 20 })}><Repeat className="h-4 w-4" />Schedule a new job here</Button>
          : onUseSite && <Button type="button" variant="outline" onClick={onUseSite}>Use this site for another job</Button>}
      </DialogFooter>
      <ScheduleEditorDialog draft={scheduleDraft} onOpenChange={open => { if (!open) setScheduleDraft(null); }} onSaved={() => { setRetry(n => n + 1); onSchedulesChanged?.(); }} />
    </DialogContent>
  </Dialog>;
}
