import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";

const START_DATE = "2026-07-01";
const PAGE = 1000;

type MissingJob = {
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  waste_description: string | null;
  container_type: string | null;
};

async function fetchAllRows<T>(
  build: (from: number, to: number) => any,
): Promise<T[]> {
  let from = 0;
  const all: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

const today = () => new Date().toISOString().slice(0, 10);

export const MissingPdasPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState<MissingJob[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobs, docs] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase
            .from("data_hub_jobs")
            .select("job_number, job_date, customer, site, waste_description, container_type")
            .eq("source", "skiptrak")
            .gte("job_date", START_DATE)
            .lte("job_date", today())
            .order("job_date", { ascending: false })
            .range(from, to),
        ),
        fetchAllRows<any>((from, to) =>
          supabase
            .from("wtn_documents")
            .select("job_number")
            .not("job_number", "is", null)
            .range(from, to),
        ),
      ]);

      const uploaded = new Set(
        docs.map((d) => String(d.job_number ?? "").trim().replace(/^0+/, "")).filter(Boolean),
      );

      const seen = new Set<string>();
      const rows: MissingJob[] = [];
      for (const j of jobs) {
        const num = String(j.job_number ?? "").trim();
        if (!num) continue;
        const key = num.replace(/^0+/, "");
        if (uploaded.has(key) || seen.has(key)) continue;
        seen.add(key);
        rows.push(j as MissingJob);
      }

      setTotalJobs(jobs.length);
      setMissing(rows);
    } catch (e: any) {
      toast({ title: "Could not check PDAs", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return missing;
    return missing.filter((m) =>
      [m.job_number, m.customer, m.site, m.waste_description].some((v) =>
        (v ?? "").toLowerCase().includes(term),
      ),
    );
  }, [missing, search]);

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of missing) {
      if (!m.job_date) continue;
      const key = m.job_date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [missing]);

  const exportCsv = () => {
    const header = ["Job number", "Job date", "Customer", "Site", "Waste", "Container"];
    const lines = [header.join(",")];
    for (const m of filtered) {
      lines.push(
        [m.job_number, m.job_date ?? "", m.customer ?? "", m.site ?? "", m.waste_description ?? "", m.container_type ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `missing-pdas-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadedCount = totalJobs - missing.length;
  const pct = totalJobs ? Math.round((uploadedCount / totalJobs) * 100) : 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Missing PDAs
            </CardTitle>
            <CardDescription>
              Skiptrak jobs since 1 July {START_DATE.slice(0, 4)} with no PDA document uploaded yet.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Recheck
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-2" /> Export list
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Jobs since 1 July</p>
            <p className="text-2xl font-bold tabular-nums">{totalJobs}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">PDAs received</p>
            <p className="text-2xl font-bold tabular-nums">
              {uploadedCount} <span className="text-sm font-normal text-muted-foreground">({pct}%)</span>
            </p>
          </div>
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs text-muted-foreground">Still missing</p>
            <p className="text-2xl font-bold tabular-nums text-destructive">{missing.length}</p>
          </div>
        </div>

        {byMonth.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {byMonth.map(([month, count]) => (
              <Badge key={month} variant="secondary">
                {new Date(`${month}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}: {count}
              </Badge>
            ))}
          </div>
        )}

        <Input
          placeholder="Search job number, customer, site or waste…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="rounded-md border overflow-auto max-h-[500px]">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Job Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Waste</TableHead>
                <TableHead>Container</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {loading ? "Checking…" : "Every job since 1 July has a PDA uploaded."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((m) => (
                <TableRow key={m.job_number}>
                  <TableCell className="font-medium text-destructive">{m.job_number}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {m.job_date ? new Date(m.job_date).toLocaleDateString("en-GB") : "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{m.customer ?? "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{m.site ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{m.waste_description ?? "—"}</TableCell>
                  <TableCell>{m.container_type ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
