import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { outgoingStream } from "@/lib/outgoing-waste-streams";

type Row = { job_number: string; job_date: string; ewc: string | null; waste_description: string | null; customer: string | null; weight_t: number | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const t = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 1 });

async function fetchYear(year: number, jobType: "WASTEOUT" | "IN"): Promise<Row[]> {
  let all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from("data_hub_jobs")
      .select("job_number, job_date, ewc, waste_description, customer, weight_t")
      .eq("source", "midweigh")
      .gte("job_date", `${year}-01-01`)
      .lte("job_date", `${year}-12-31`)
      .order("id", { ascending: true })
      .range(from, from + 999);
    q = jobType === "WASTEOUT" ? q.eq("job_type", "WASTEOUT") : q.in("job_type", ["WASTEIN", "SKIP"]);
    const { data, error } = await q;
    if (error) throw error;
    all = all.concat((data ?? []) as Row[]);
    if (!data || data.length < 1000) break;
  }
  const seen = new Set<string>();
  return all.filter((r) => (seen.has(r.job_number) ? false : (seen.add(r.job_number), true)));
}

const tonnes = (r: Row) => (r.weight_t ?? 0) / 1000; // Midweigh stores kg

const OutgoingWastes = () => {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const years = [thisYear, thisYear - 1, thisYear - 2];

  const out = useQuery({ queryKey: ["outgoing-wastes", year], queryFn: () => fetchYear(year, "WASTEOUT") });
  const prev = useQuery({ queryKey: ["outgoing-wastes", year - 1], queryFn: () => fetchYear(year - 1, "WASTEOUT") });
  const inc = useQuery({ queryKey: ["incoming-wastes-total", year], queryFn: () => fetchYear(year, "IN") });

  const data = useMemo(() => {
    const rows = out.data ?? [];
    const streams = new Map<string, { loads: number; t: number; prev: number }>();
    const dest = new Map<string, { loads: number; t: number; prev: number; streams: Set<string> }>();
    const prevDest = new Map<string, number>();
    const monthly = MONTHS.map((m) => ({ month: m, [String(year)]: 0, [String(year - 1)]: 0 } as Record<string, number | string>));
    for (const r of rows) {
      const s = outgoingStream(r.ewc, r.waste_description);
      const e = streams.get(s) ?? { loads: 0, t: 0, prev: 0 };
      e.loads++; e.t += tonnes(r); streams.set(s, e);
      const name = r.customer?.trim() || "Unknown";
      const d = dest.get(name) ?? { loads: 0, t: 0, streams: new Set() };
      d.loads++; d.t += tonnes(r); d.streams.add(s); dest.set(name, d);
      const mi = new Date(r.job_date).getMonth();
      (monthly[mi][String(year)] as number) += tonnes(r);
    }
    for (const r of prev.data ?? []) {
      const s = outgoingStream(r.ewc, r.waste_description);
      const e = streams.get(s) ?? { loads: 0, t: 0, prev: 0 };
      e.prev += tonnes(r); streams.set(s, e);
      (monthly[new Date(r.job_date).getMonth()][String(year - 1)] as number) += tonnes(r);
    }
    const total = rows.reduce((a, r) => a + tonnes(r), 0);
    const prevTotal = (prev.data ?? []).reduce((a, r) => a + tonnes(r), 0);
    const inTotal = (inc.data ?? []).reduce((a, r) => a + tonnes(r), 0);
    return {
      total, prevTotal, inTotal, loads: rows.length,
      streams: [...streams.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.t - a.t),
      dest: [...dest.entries()].map(([name, v]) => ({ name, loads: v.loads, t: v.t, streams: [...v.streams].join(", ") })).sort((a, b) => b.t - a.t),
      monthly: monthly.map((m) => ({ ...m, [String(year)]: Math.round(m[String(year)] as number), [String(year - 1)]: Math.round(m[String(year - 1)] as number) })),
    };
  }, [out.data, prev.data, inc.data, year]);

  const loading = out.isLoading || prev.isLoading || inc.isLoading;
  const change = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(1)}%` : "—");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Outgoing wastes</h2>
          <p className="text-sm text-muted-foreground">Actual weighed loads leaving the yard (Midweigh Waste Out), grouped by EWC code.</p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Loading outgoing wastes…</CardContent></Card>
      ) : out.error ? (
        <Card><CardContent className="py-10 text-center text-destructive">Couldn't load outgoing loads. Please try again.</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Tonnes out", t(data.total)],
              ["Loads out", data.loads.toLocaleString("en-GB")],
              [`vs ${year - 1}`, change(data.total, data.prevTotal)],
              ["Tonnes in (yard)", t(data.inTotal)],
            ].map(([label, value]) => (
              <Card key={label}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>By waste stream</CardTitle><CardDescription>Real tonnes per stream, compared with {year - 1}.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Stream</TableHead><TableHead className="text-right">Loads</TableHead><TableHead className="text-right">Tonnes</TableHead>
                  <TableHead className="text-right">Share</TableHead><TableHead className="text-right">{year - 1} tonnes</TableHead><TableHead className="text-right">Change</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.streams.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.loads}</TableCell>
                      <TableCell className="text-right tabular-nums">{t(s.t)}</TableCell>
                      <TableCell className="text-right tabular-nums">{data.total ? ((s.t / data.total) * 100).toFixed(1) : "0"}%</TableCell>
                      <TableCell className="text-right tabular-nums">{t(s.prev)}</TableCell>
                      <TableCell className="text-right tabular-nums">{change(s.t, s.prev)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Monthly tonnes out</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />
                  <Bar dataKey={String(year - 1)} fill="hsl(var(--muted-foreground))" />
                  <Bar dataKey={String(year)} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Destinations</CardTitle><CardDescription>Where outgoing loads went in {year}.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Destination</TableHead><TableHead>Streams</TableHead><TableHead className="text-right">Loads</TableHead><TableHead className="text-right">Tonnes</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.dest.map((d) => (
                    <TableRow key={d.name}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.streams}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.loads}</TableCell>
                      <TableCell className="text-right tabular-nums">{t(d.t)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default OutgoingWastes;
