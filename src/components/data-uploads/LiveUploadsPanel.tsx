import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Radio } from "lucide-react";

type LiveJob = {
  id: string;
  job_number: string;
  source: string;
  customer: string | null;
  site: string | null;
  waste_description: string | null;
  weight_t: number | null;
  updated_at: string;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function LiveUploadsPanel() {
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [tick, setTick] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("data_hub_jobs")
      .select("id, job_number, source, customer, site, waste_description, weight_t, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (!error && data) setJobs(data as LiveJob[]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 5000);
    const ticker = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const within = (mins: number, src?: string) =>
      jobs.filter(
        (j) =>
          now - new Date(j.updated_at).getTime() <= mins * 60 * 1000 &&
          (src ? j.source === src : true),
      ).length;
    return {
      last5: within(5),
      last60: within(60),
      last24h: within(60 * 24),
      skiptrak1h: within(60, "skiptrak"),
      midweigh1h: within(60, "midweigh"),
    };
  }, [jobs, tick]);

  const isFresh = (iso: string) => Date.now() - new Date(iso).getTime() < 60 * 1000;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                </span>
                Live uploads activity
              </CardTitle>
              <CardDescription>
                Auto-refreshing every 5s · last refresh {timeAgo(lastRefresh.toISOString())}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Last 5 min", value: stats.last5 },
              { label: "Last hour", value: stats.last60 },
              { label: "Last 24 hours", value: stats.last24h },
              { label: "Skiptrak (1h)", value: stats.skiptrak1h },
              { label: "Midweigh (1h)", value: stats.midweigh1h },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Recent upserts
          </CardTitle>
          <CardDescription>Latest 100 records by updated time. Rows within 60s are highlighted.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto max-w-full">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Waste</TableHead>
                  <TableHead className="text-right">Weight (t)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                      {loading ? "Loading…" : "No recent activity."}
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j) => (
                    <TableRow key={j.id} className={isFresh(j.updated_at) ? "bg-primary/5" : undefined}>
                      <TableCell className="whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          {isFresh(j.updated_at) && (
                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          )}
                          {timeAgo(j.updated_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={j.source === "skiptrak" ? "default" : "secondary"}>{j.source}</Badge>
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{j.job_number}</TableCell>
                      <TableCell className="whitespace-nowrap">{j.customer ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{j.site ?? "—"}</TableCell>
                      <TableCell className="max-w-[24rem] truncate" title={j.waste_description ?? ""}>
                        {j.waste_description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {j.weight_t == null
                          ? "—"
                          : j.source === "midweigh"
                            ? (j.weight_t / 1000).toFixed(2)
                            : j.weight_t.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
