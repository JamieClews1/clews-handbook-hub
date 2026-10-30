import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { metricDelta } from "@/lib/insights-period";
export default function InsightMetric({ label, value, previous, formatValue, definition, rate = false, lowerIsBetter = false, loading, note }: { label: string; value: number | null; previous?: number | null; formatValue: (value: number) => string; definition: string; rate?: boolean; lowerIsBetter?: boolean; loading?: boolean; note?: string }) {
  const delta = value !== null && previous != null ? metricDelta(value, previous, rate) : null;
  const good = delta !== null && (lowerIsBetter ? delta < 0 : delta > 0);
  const Arrow = delta !== null && delta < 0 ? TrendingDown : TrendingUp;
  return <article className="min-w-0 rounded-lg border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-2"><p className="text-sm text-muted-foreground">{label}</p><Popover><PopoverTrigger asChild><Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label={`${label} definition`}><Info className="h-3.5 w-3.5" /></Button></PopoverTrigger><PopoverContent className="text-sm">{definition}</PopoverContent></Popover></div>
    {loading ? <Skeleton className="my-3 h-8 w-28" /> : <p className="mt-2 text-2xl font-semibold tabular-nums">{value === null ? "—" : formatValue(value)}</p>}
    <Badge variant="outline" className="mt-2 border-primary/20 bg-primary/5 text-primary">Actual</Badge>
    {!loading && previous != null && <p className={`mt-3 flex flex-wrap items-center gap-1 text-xs tabular-nums ${delta === 0 || delta === null ? "text-muted-foreground" : good ? "text-primary" : "text-destructive"}`}><Arrow className="h-3.5 w-3.5" />{delta === null ? "Comparison unavailable" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} ${rate ? "pp" : "%"}`}<span className="text-muted-foreground">vs {formatValue(previous)}</span></p>}
    {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
  </article>;
}