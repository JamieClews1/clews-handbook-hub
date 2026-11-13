import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowRightLeft, CalendarClock, ExternalLink, Info, Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { addDaysKey } from "@/lib/route-job-schedules";
import { dayGap, dotDate, dotDateYear, dotDay, fullDate, labelSides, timelineAxis, type TimelineDot, type TimelineFlag } from "@/lib/container-timeline";

/** One container (or trailer stream) row; only displays jobs, actions are the existing pop-up buttons. */
export type TimelineRowModel = {
  key: string; group: "onsite" | "trailer";
  title: string; ewc: string | null; container: string; site: string | null;
  badges?: ReactNode;
  since: { date: string; jobNumber: string; known: boolean } | null;
  frequency: string | null;
  dots: TimelineDot[]; chained: boolean; flags: TimelineFlag[];
  actions: ReactNode;
  bookNext?: { label: string; busy: boolean; disabled: boolean; run: () => void };
};

const PX = 14; // per day, about 6 weeks either side visible
const LEFT = 240;
const H = 140, DOT_Y = 82;
const DOT_STYLE: Record<TimelineDot["kind"], string> = {
  completed: "bg-success border-success",
  booked: "bg-warning border-warning",
  scheduled: "bg-background border-warning border-dashed",
  collection: "bg-destructive border-destructive",
};

function useNarrow(max = 759) {
  const query = `(max-width: ${max}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on); on();
    return () => m.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

export function TimelineLegend() {
  const item = (dot: ReactNode, label: string) => <span className="inline-flex items-center gap-1.5">{dot}{label}</span>;
  const d = (cls: string) => <span className={cn("inline-block h-3 w-3 rounded-full border-2", cls)} />;
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Timeline key">
    {item(d(DOT_STYLE.completed), "Completed")}
    {item(d(DOT_STYLE.booked), "Booked exchange")}
    {item(d(DOT_STYLE.scheduled), "Exchange from schedule, not assigned")}
    {item(d(DOT_STYLE.collection), "Collection")}
    {item(<span className="inline-block h-3 w-3 rounded-full bg-muted ring-2 ring-info ring-offset-1 ring-offset-background" />, "This job")}
    {item(<span className="inline-block h-3.5 w-0.5 bg-foreground/70" />, "Today")}
    {item(<AlertTriangle className="h-3.5 w-3.5 text-warning-text" />, "Needs a look")}
  </div>;
}

type Placed = { dot: TimelineDot; x: number; side: "above" | "below" | "none" };

function Strip({ row, start, width, today, focusJob, selectedKey, onSelect, showAxis, mondays }: {
  row: TimelineRowModel; start: string; width: number; today: string; focusJob: string | null; selectedKey: string | null;
  onSelect: (key: string) => void; showAxis: boolean; mondays: string[];
}) {
  const xOf = (date: string) => (dayGap(start, date) + 0.5) * PX;
  const placed = useMemo<Placed[]>(() => {
    const visible = row.dots.filter(d => d.date >= start);
    const sides = labelSides(visible);
    return visible.map((dot, i) => ({ dot, x: xOf(dot.date), side: sides[i] }));
  }, [row.dots, start]); // eslint-disable-line react-hooks/exhaustive-deps
  const earlier = row.dots.some(d => d.date < start);
  const todayX = xOf(today);
  // Chain segments: solid grey in the past, dashed yellow in the future.
  const segments: { x1: number; x2: number; future: boolean }[] = [];
  if (row.chained) {
    const pts = [...(earlier && placed.length ? [{ x: 0 }] : []), ...placed.map(p => ({ x: p.x }))];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1].x, b = pts[i].x;
      if (b <= todayX) segments.push({ x1: a, x2: b, future: false });
      else if (a >= todayX) segments.push({ x1: a, x2: b, future: true });
      else { segments.push({ x1: a, x2: todayX, future: false }); segments.push({ x1: todayX, x2: b, future: true }); }
    }
  }
  // Flags in two lanes so neighbouring tags do not overlap.
  const lanes: number[] = [-Infinity, -Infinity];
  const flags = row.flags.filter(f => f.date >= start).map(f => {
    const x = xOf(f.date);
    const lane = x - lanes[0] >= 120 ? 0 : x - lanes[1] >= 120 ? 1 : 0;
    lanes[lane] = x;
    return { ...f, x, lane };
  });
  const top = showAxis ? 22 : 0;

  return <div className="relative" style={{ width, height: H + top }}>
    {showAxis && <AxisLabels mondays={mondays} start={start} today={today} />}
    <div className="absolute inset-x-0 bottom-0" style={{ top }}>
      {mondays.map(m => <div key={m} aria-hidden className="absolute inset-y-0 w-px bg-border/70" style={{ left: dayGap(start, m) * PX }} />)}
      <div aria-hidden className="absolute inset-y-0 z-[1] w-0.5 -translate-x-1/2 bg-foreground/70" style={{ left: todayX }} />
      {segments.map((s, i) => <div key={i} aria-hidden className={cn("absolute z-[2]", s.future ? "border-t-2 border-dashed border-warning" : "h-0.5 bg-muted-foreground/40")} style={{ left: s.x1, width: Math.max(0, s.x2 - s.x1), top: DOT_Y - 1 }} />)}
      {flags.map((f, i) => <span key={`${f.date}-${i}`} className={cn("absolute z-[3] inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none",
        f.tone === "warn" ? "border-warning/50 bg-warning-subtle text-warning-text" : "border-border bg-muted text-muted-foreground")} style={{ left: f.x, top: 4 + f.lane * 20 }}>
        {f.tone === "warn" ? <AlertTriangle className="h-3 w-3" /> : <Info className="h-3 w-3" />}{f.label}
      </span>)}
      {placed.map(({ dot, x, side }) => {
        const focus = Boolean(focusJob) && dot.jobNumber === focusJob;
        const selected = selectedKey === dot.key;
        return <div key={dot.key}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" data-dot={dot.key} onClick={() => onSelect(dot.key)} aria-pressed={selected}
                aria-label={`Job ${dot.jobNumber}, ${dot.movement}, ${fullDate(dot.date)}, ${dot.status}`}
                className={cn("absolute z-[4] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  DOT_STYLE[dot.kind], focus && "ring-[3px] ring-info ring-offset-2 ring-offset-background", selected && "scale-125", selected && !focus && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
                style={{ left: x, top: DOT_Y }} />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-semibold">#{dot.jobNumber} · {dot.movement}</p>
              <p>{fullDate(dot.date)}</p>
              <p className="text-muted-foreground">{dot.status} · {dot.source}</p>
            </TooltipContent>
          </Tooltip>
          {(side !== "none" || focus || selected) && <div className="pointer-events-none absolute z-[3] -translate-x-1/2 whitespace-nowrap rounded bg-background px-1 text-center text-[11px] leading-tight"
            style={side !== "above" ? { left: x, top: DOT_Y + (focus ? 16 : 12) } : { left: x, bottom: H - DOT_Y + (focus ? 16 : 12) }}>
            <div className="font-semibold">{dotDay(dot.date)}</div>
            <div className="text-muted-foreground tabular-nums">{dotDate(dot.date)}</div>
            {focus && <div className="font-semibold text-info tabular-nums">#{dot.jobNumber}</div>}
          </div>}
        </div>;
      })}
    </div>
  </div>;
}

function AxisLabels({ mondays, start, today }: { mondays: string[]; start: string; today: string }) {
  const todayX = (dayGap(start, today) + 0.5) * PX;
  const end = dayGap(start, mondays[mondays.length - 1] ?? start) * PX;
  return <div className="absolute inset-x-0 top-0 h-[22px] overflow-hidden border-b border-border text-[10px] text-muted-foreground">
    {mondays.filter(m => { const x = dayGap(start, m) * PX; return Math.abs(x + 25 - todayX) > 45 && x < end; }).map(m => <span key={m} className="absolute top-1 whitespace-nowrap pl-1 tabular-nums" style={{ left: dayGap(start, m) * PX }}>Mon {dotDate(m)}</span>)}
    <span className="absolute top-0.5 z-[2] -translate-x-1/2 rounded bg-foreground px-1 font-semibold text-background" style={{ left: (dayGap(start, today) + 0.5) * PX }}>Today</span>
  </div>;
}

function LeftCell({ row, today }: { row: TimelineRowModel; today: string }) {
  return <div className="space-y-1.5 p-3">
    <div>
      <p className="text-sm font-semibold leading-snug">{row.title}</p>
      <p className="text-xs text-muted-foreground">{[row.ewc, row.container].filter(Boolean).join(" · ")}</p>
      {row.site && <p className="truncate text-xs text-muted-foreground" title={row.site}>Skiptrak: {row.site}</p>}
    </div>
    <div className="flex flex-wrap gap-1">
      {row.since && <Badge variant="outline" className="font-normal">{row.since.known ? "On site since" : "On site before"} {dotDateYear(row.since.date, today)}</Badge>}
      {row.frequency && <Badge variant="secondary" className="font-normal">{row.frequency}</Badge>}
      {row.badges}
    </div>
    <div className="flex flex-wrap gap-1.5">{row.actions}</div>
  </div>;
}

/** Week-by-week timeline of every container on a site. Clicking a dot only selects it. */
export function ContainerTimeline({ rows, today, focusJob, selectedKey, onSelect }: {
  rows: TimelineRowModel[]; today: string; focusJob: string | null; selectedKey: string | null; onSelect: (key: string) => void;
}) {
  const narrow = useNarrow();
  const last = rows.flatMap(r => r.dots.map(d => d.date)).sort().pop() ?? null;
  const focusDate = focusJob ? rows.flatMap(r => r.dots).find(d => d.jobNumber === focusJob)?.date ?? null : null;
  const axis = useMemo(() => timelineAxis(today, last, 12, 6, 26, focusDate), [today, last, focusDate]);
  const width = Math.max(720, axis.days * PX);
  const scroller = useRef<HTMLDivElement>(null);
  const initial = Math.max(0, dayGap(axis.start, addDaysKey(today, -42)) * PX);
  const focusRow = focusJob ? rows.find(r => r.dots.some(d => d.jobNumber === focusJob)) : undefined;
  const focusDot = focusRow?.dots.find(d => d.jobNumber === focusJob);

  // Open at six weeks back, or centred on the job it was opened from.
  useLayoutEffect(() => {
    const target = focusDot ? (dayGap(axis.start, focusDot.date) + 0.5) * PX : null;
    const todayX = (dayGap(axis.start, today) + 0.5) * PX;
    // Wide screens open six weeks back; phones open just before today so upcoming jobs show.
    const scrollEl = (el: HTMLElement, visibleWidth: number) => { el.scrollLeft = target !== null ? Math.max(0, target - visibleWidth / 2) : narrow ? Math.max(0, todayX - visibleWidth * 0.3) : initial; };
    if (!narrow && scroller.current) scrollEl(scroller.current, scroller.current.clientWidth - LEFT);
    if (narrow) scroller.current?.querySelectorAll<HTMLElement>("[data-strip-scroll]").forEach(el => scrollEl(el, el.clientWidth));
    if (focusRow) scroller.current?.querySelector(`[data-row="${CSS.escape(focusRow.key)}"]`)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrow, axis.start, rows.length, focusDot?.key]);

  const groups: { id: TimelineRowModel["group"]; title: string; icon?: ReactNode }[] = [
    { id: "onsite", title: "Containers on site" },
    { id: "trailer", title: "Trailer jobs (no container left on site)", icon: <Truck className="h-4 w-4" /> },
  ];
  const tint = (row: TimelineRowModel) => row === focusRow;

  if (narrow) return <div ref={scroller} className="space-y-4">
    {groups.map(g => {
      const list = rows.filter(r => r.group === g.id);
      if (!list.length) return null;
      return <section key={g.id} className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">{g.icon}{g.title}</h3>
        {list.map(row => <div key={row.key} data-row={row.key} className={cn("overflow-hidden rounded-md border border-border bg-card", tint(row) && "border-info/50")}>
          <div className={cn(tint(row) && "bg-info/5")}><LeftCell row={row} today={today} /></div>
          <div data-strip-scroll className={cn("overflow-x-auto border-t border-border", tint(row) && "bg-info/5")}>
            <Strip row={row} start={axis.start} width={width} today={today} focusJob={focusJob} selectedKey={selectedKey} onSelect={onSelect} showAxis mondays={axis.mondays} />
          </div>
        </div>)}
      </section>;
    })}
  </div>;

  return <div ref={scroller} className="overflow-x-auto rounded-md border border-border bg-card">
    <div style={{ width: LEFT + width }}>
      <div className="flex border-b border-border">
        <div className="sticky left-0 z-[6] shrink-0 border-r border-border bg-card px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground" style={{ width: LEFT }}>Week beginning</div>
        <div className="relative h-[22px]" style={{ width }}><AxisLabels mondays={axis.mondays} start={axis.start} today={today} /></div>
      </div>
      {groups.map(g => {
        const list = rows.filter(r => r.group === g.id);
        if (!list.length) return null;
        return <div key={g.id}>
          <div className="border-b border-border bg-muted/60">
            <h3 className="sticky left-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold">{g.icon}{g.title}</h3>
          </div>
          {list.map(row => <div key={row.key} data-row={row.key} className="flex border-b border-border last:border-b-0">
            <div className="sticky left-0 z-[6] shrink-0 border-r border-border bg-card" style={{ width: LEFT }}>
              <div className={cn("h-full", tint(row) && "bg-info/5")}><LeftCell row={row} today={today} /></div>
            </div>
            <div className={cn("flex items-center", tint(row) && "bg-info/5")}>
              <Strip row={row} start={axis.start} width={width} today={today} focusJob={focusJob} selectedKey={selectedKey} onSelect={onSelect} showAxis={false} mondays={axis.mondays} />
            </div>
          </div>)}
        </div>;
      })}
    </div>
  </div>;
}

/** Footer bar for the selected dot: details, neighbouring jobs and the existing actions. */
export function TimelineSelectionBar({ rows, selectedKey, onSelect, today, onOpenJob, focusExchange }: {
  rows: TimelineRowModel[]; selectedKey: string | null; onSelect: (key: string) => void; today: string;
  onOpenJob?: (nativeId: string, intent: "open" | "move") => void;
  /** Exchange from the job the pop-up was opened from (existing editor flow). */
  focusExchange?: { jobNumber: string; run: () => void };
}) {
  const row = rows.find(r => r.dots.some(d => d.key === selectedKey));
  if (!row) return <div className="border-t-2 border-info/60 px-1 pt-3 text-sm text-muted-foreground">Select a job on the timeline to see its details here.</div>;
  const i = row.dots.findIndex(d => d.key === selectedKey);
  const dot = row.dots[i];
  const prev = row.dots[i - 1], next = row.dots[i + 1];
  const chip = (d: TimelineDot, dir: "prev" | "current" | "next") => <button type="button" key={d.key} onClick={() => onSelect(d.key)}
    className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors", dir === "current" ? "border-info bg-info/10 font-semibold text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted")}>
    {dir === "prev" && <ArrowLeft className="h-3 w-3" />}#{d.jobNumber} · {dotDay(d.date)} {dotDate(d.date)}{dir === "next" && <ArrowRight className="h-3 w-3" />}
  </button>;
  const canOpen = Boolean(dot.nativeId && onOpenJob);
  const exchange = row.bookNext ?? (focusExchange && dot.jobNumber === focusExchange.jobNumber ? { label: "Book next exchange", busy: false, disabled: false, run: focusExchange.run } : undefined);
  return <div className="space-y-2 border-t-2 border-info/60 pt-3" aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5 text-sm">
        <p className="font-semibold">#{dot.jobNumber} · {dot.movement} · {row.container} · {row.title}{row.ewc ? ` ${row.ewc}` : ""}</p>
        <p>{fullDate(dot.date)} · <span className={cn(dot.kind === "completed" ? "text-success" : dot.kind === "collection" ? "text-destructive" : "text-warning-text", "font-medium")}>{dot.status}</span>{dot.date < today && dot.kind !== "completed" && dot.kind !== "collection" ? " (date passed)" : ""}</p>
        {row.since && <p className="text-muted-foreground">{row.since.known ? `Container arrived ${dotDay(row.since.date)} ${dotDateYear(row.since.date, today)} with job #${row.since.jobNumber}` : `On site before ${dotDay(row.since.date)} ${dotDateYear(row.since.date, today)} (job #${row.since.jobNumber} is the first record in the last 12 months)`}</p>}
        <p className="text-muted-foreground">{row.chained ? `Job ${i + 1} of ${row.dots.length} in this container's chain` : `Trailer job ${i + 1} of ${row.dots.length} here`}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!canOpen} title={canOpen ? undefined : dot.source === "Skip" ? "Skiptrak jobs are changed in Skiptrak" : "Open this job from the Route One board"} onClick={() => dot.nativeId && onOpenJob?.(dot.nativeId, "move")}><CalendarClock className="h-4 w-4" />Move date</Button>
        <Button type="button" size="sm" variant="outline" disabled={!canOpen} title={canOpen ? undefined : dot.source === "Skip" ? "Skiptrak jobs open in Skiptrak" : "Open this job from the Route One board"} onClick={() => dot.nativeId && onOpenJob?.(dot.nativeId, "open")}><ExternalLink className="h-4 w-4" />Open job</Button>
        {exchange && <Button type="button" size="sm" disabled={exchange.disabled || exchange.busy} onClick={exchange.run}>{exchange.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}{exchange.label}</Button>}
      </div>
    </div>
    <div className="flex flex-wrap gap-1.5">{prev && chip(prev, "prev")}{chip(dot, "current")}{next && chip(next, "next")}</div>
  </div>;
}
