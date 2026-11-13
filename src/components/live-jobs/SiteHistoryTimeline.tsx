import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ContainerTimeline, TimelineLegend, TimelineSelectionBar, type TimelineRowModel, type TimelineScale } from "@/components/route-one/ContainerTimeline";
import { isArticContainer } from "@/lib/artic-site-jobs";
import { mergeDots, onSiteSince, shortFrequency, skipDot, timelineFlags } from "@/lib/container-timeline";
import { detectCadenceWeeks } from "@/lib/route-job-schedules";
import { isCompletedRentalMovement } from "@/lib/rental-open-movements";
import type { BinHistory, HistoryJob } from "@/lib/site-history";
import { formatEwc, standardWasteName } from "@/lib/waste-streams";

const CHAIN = new Set(["Deliver", "Exchange", "Collect", "Tip/Return"]);
const KEEP = new Set(["Deliver", "Exchange", "Tip/Return"]);

/**
 * Site History's dot timeline of every bin position (on site, previous and trailers), built from
 * the same bin histories as the list. View only: clicking a dot opens the existing job view.
 */
export default function SiteHistoryTimeline({ bins, today, isOwn, movement, onViewJob }: {
  bins: BinHistory[]; today: string; movement: string;
  isOwn: (site: string, container: string) => boolean;
  onViewJob: (job: HistoryJob) => void;
}) {
  const [scale, setScale] = useState<TimelineScale>("week");
  const [selected, setSelected] = useState<string | null>(null);
  const byNumber = useMemo(() => new Map(bins.flatMap(b => b.jobs.map(j => [j.job_number, j] as const))), [bins]);
  const severalSites = new Set(bins.map(b => b.site.toLowerCase())).size > 1;

  const rows = useMemo<TimelineRowModel[]>(() => bins.map(b => {
    const trailer = isArticContainer(b.container);
    const jobs = b.jobs.filter(j => (trailer || CHAIN.has(j.movement_type ?? "")) && (movement === "all" || j.movement_type === movement));
    const dots = mergeDots(jobs.map(j => {
      const done = isCompletedRentalMovement(j, today);
      return !done && (j.job_date ?? "") < today ? null : skipDot(j, done, today);
    }).filter((d): d is NonNullable<typeof d> => Boolean(d)), []);
    const cadence = trailer ? null : detectCadenceWeeks(b.jobs.filter(j => KEEP.has(j.movement_type ?? "")).map(j => j.job_date));
    const waste = (b.waste ? standardWasteName(b.waste, b.ewc, { source: "skiptrak" }) : "") || formatEwc(b.ewc) || "Waste not recorded";
    const group: TimelineRowModel["group"] = trailer ? "trailer" : b.onSite > 0 ? "onsite" : "cleared";
    return {
      key: b.key, group, muted: group === "cleared",
      title: `${b.onSite > 1 ? `${b.onSite} × ` : ""}${waste}`, ewc: formatEwc(b.ewc) || null, container: b.container,
      site: severalSites ? b.site : null,
      badges: <>{!trailer && <Badge variant="outline" className="font-normal">{isOwn(b.site, b.container) ? "Own" : "Clews"}</Badge>}<Badge variant="outline" className="font-normal tabular-nums">{b.jobs.length} jobs</Badge></>,
      since: group === "onsite" ? onSiteSince(dots, today) : null,
      frequency: cadence ? shortFrequency(cadence) : null,
      dots, chained: !trailer,
      flags: timelineFlags(dots, { today, cadenceWeeks: group === "onsite" ? cadence : null, chained: !trailer, scheduleActive: false }),
      actions: null,
    };
  }).filter(r => r.dots.length > 0), [bins, today, movement, isOwn, severalSites]);

  if (!rows.length) return <p className="text-muted-foreground">No jobs found for this selection.</p>;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <div className="mr-auto"><TimelineLegend /></div>
      <ToggleGroup type="single" size="sm" variant="outline" value={scale} onValueChange={v => { if (v === "week" || v === "month") setScale(v); }} aria-label="Timeline zoom">
        <ToggleGroupItem value="week">Weeks</ToggleGroupItem>
        <ToggleGroupItem value="month">Months</ToggleGroupItem>
      </ToggleGroup>
    </div>
    <ContainerTimeline rows={rows} today={today} focusJob={null} selectedKey={selected} onSelect={setSelected} scale={scale} className="max-h-[70vh]" />
    <TimelineSelectionBar rows={rows} selectedKey={selected} onSelect={setSelected} today={today}
      actions={dot => { const job = byNumber.get(dot.jobNumber); return job ? <Button type="button" size="sm" variant="outline" onClick={() => onViewJob(job)}><Eye className="h-4 w-4" />View job</Button> : null; }} />
  </div>;
}
