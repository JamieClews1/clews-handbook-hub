import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Minus, AlertTriangle, RefreshCw, CheckCircle2, Database } from "lucide-react";
import { cn } from "@/lib/utils";

type Summary = {
  jobs_today: number; jobs_prev: number;
  tonnes_in_today: number; tonnes_in_prev: number;
  drivers_today: number; drivers_prev: number;
  crm_open: number; crm_unassigned: number;
  contaminations_open: number; contaminations_no_charge: number;
  permits_expiring: number;
  skiptrak_last_sync: string | null; midweigh_last_sync: string | null;
};

function Delta({ now, prev, suffix }: { now: number; prev: number; suffix?: string }) {
  if (!prev && !now) return <span className="text-xs text-muted-foreground">No movement either day</span>;
  if (!prev) return <span className="text-xs text-muted-foreground">None same day last week</span>;
  const pct = ((now - prev) / prev) * 100;
  const Icon = Math.abs(pct) < 0.5 ? Minus : pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium",
      Math.abs(pct) < 0.5 ? "text-muted-foreground" : pct > 0 ? "text-primary" : "text-destructive")}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct).toFixed(1)}%
      <span className="ml-1 font-normal text-muted-foreground">vs last week ({prev.toLocaleString("en-GB", { maximumFractionDigits: 1 })}{suffix})</span>
    </span>
  );
}

function Kpi({ label, value, sub, to }: { label: string; value: string; sub: React.ReactNode; to: string }) {
  return (
    <Link to={to} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full border-border/60 transition-colors group-hover:border-primary/40">
        <CardContent className="space-y-1 p-4">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          <div>{sub}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Freshness({ name, at }: { name: string; at: string | null }) {
  const stale = !at || differenceInHours(new Date(), new Date(at)) > 24;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
      stale ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground")}>
      <Database className="h-3 w-3" />
      {name}: {at ? `updated ${formatDistanceToNow(new Date(at), { addSuffix: true })}` : "never synced"}
    </span>
  );
}

/** Read-only live overview. Figures come from existing records; nothing here changes data. */
export function LiveDashboard() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_summary");
      if (error) throw error;
      return data as unknown as Summary;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
          <span className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Couldn't load today's figures.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const attention = data ? [
    { n: data.crm_unassigned, label: "unassigned CRM tickets", to: "/crm" },
    { n: data.contaminations_no_charge, label: "open contaminations with no charge set", to: "/performance-hub/contaminations" },
    { n: data.permits_expiring, label: "permits expiring in the next 30 days", to: "/permits" },
    ...(!data.skiptrak_last_sync || differenceInHours(new Date(), new Date(data.skiptrak_last_sync)) > 24
      ? [{ n: 1, label: "Skiptrak data not updated in 24 hours", to: "/data-hub/uploads" }] : []),
    ...(!data.midweigh_last_sync || differenceInHours(new Date(), new Date(data.midweigh_last_sync)) > 24
      ? [{ n: 1, label: "Midweigh data not updated in 24 hours", to: "/data-hub/uploads" }] : []),
  ].filter((a) => a.n > 0) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Today</h2>
        <div className="flex flex-wrap items-center gap-2">
          {data && <><Freshness name="Skiptrak" at={data.skiptrak_last_sync} /><Freshness name="Midweigh" at={data.midweigh_last_sync} /></>}
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            {dataUpdatedAt ? `As of ${new Date(dataUpdatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-lg" />)
        ) : (
          <>
            <Kpi label="Skip jobs today" value={data.jobs_today.toLocaleString("en-GB")} sub={<Delta now={data.jobs_today} prev={data.jobs_prev} />} to="/route-one" />
            <Kpi label="Tonnes in today (weighbridge)" value={`${Number(data.tonnes_in_today).toFixed(1)} t`} sub={<Delta now={Number(data.tonnes_in_today)} prev={Number(data.tonnes_in_prev)} suffix=" t" />} to="/weigh-one" />
            <Kpi label="Drivers on jobs today" value={data.drivers_today.toLocaleString("en-GB")} sub={<Delta now={data.drivers_today} prev={data.drivers_prev} />} to="/route-one" />
            <Kpi label="Open queries" value={(data.crm_open + data.contaminations_open).toLocaleString("en-GB")}
              sub={<span className="text-xs text-muted-foreground">{data.crm_open.toLocaleString("en-GB")} CRM · {data.contaminations_open.toLocaleString("en-GB")} contaminations</span>} to="/crm" />
          </>
        )}
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Needs attention</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /></div>
          ) : attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Nothing flagged right now.</p>
          ) : (
            <ul className="divide-y divide-border">
              {attention.map((a) => (
                <li key={a.label}>
                  <Link to={a.to} className="flex items-center gap-2 py-2 text-sm hover:text-primary">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-destructive" />
                    {a.label.includes("not updated") ? a.label : <><span className="font-semibold tabular-nums">{a.n.toLocaleString("en-GB")}</span> {a.label}</>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
