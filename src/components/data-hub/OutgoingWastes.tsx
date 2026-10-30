import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { outgoingStream, outgoingHeadlineTotals, outgoingPercentage, outgoingYearChange, midweighRowTonnes as tonnes } from "@/lib/outgoing-waste-streams";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { annualReportingPeriod, comparisonPeriod, periodLabel } from "@/lib/insights-period";
import { parseLoadReportDate } from "@/lib/load-report-dates";

type Row = { job_number: string; job_date: string; ewc: string | null; waste_description: string | null; customer: string | null; weight_t: number | null; product: string | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const t = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 1 });

async function fetchYear(start: string, end: string, jobType: "WASTEOUT" | "IN"): Promise<Row[]> {
  let all: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from("data_hub_jobs")
      .select("job_number, job_date, ewc, waste_description, customer, weight_t, product:raw->>Product" as string)
      .eq("source", "midweigh")
      .gte("job_date", start)
      .lte("job_date", end)
      .gt("weight_t", 0)
      .order("id", { ascending: true })
      .range(from, from + 999);
    q = jobType === "WASTEOUT" ? q.eq("job_type", "WASTEOUT") : q.in("job_type", ["WASTEIN", "SKIP"]);
    const { data, error } = await q.returns<Row[]>();
    if (error) throw error;
    all = all.concat((data ?? []) as Row[]);
    if (!data || data.length < 1000) break;
  }
  const seen = new Set<string>();
  return all.filter((r) => (seen.has(r.job_number) ? false : (seen.add(r.job_number), true)));
}

type Props = { externalStartDate?: Date; externalEndDate?: Date; comparisonStartDate?: Date; comparisonEndDate?: Date; compare?: boolean; view?: "all" | "destinations" };
const OutgoingWastes = ({ externalStartDate, externalEndDate, comparisonStartDate, comparisonEndDate, compare = true, view = "all" }: Props = {}) => {

  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const years = [thisYear, thisYear - 1, thisYear - 2];

  const annual = annualReportingPeriod(year);
  const start = externalStartDate?.toISOString().slice(0, 10) ?? annual.start;
  const end = externalEndDate?.toISOString().slice(0, 10) ?? annual.end;
  const prior = comparisonPeriod({ start, end, compare: "year" });
  const prevStart = comparisonStartDate?.toISOString().slice(0, 10) ?? prior?.start ?? start;
  const prevEnd = comparisonEndDate?.toISOString().slice(0, 10) ?? prior?.end ?? end;
  const currentLabel = periodLabel(start, end);
  const previousLabel = periodLabel(prevStart, prevEnd);
  const out = useQuery({ queryKey: ["outgoing-wastes-period", start, end], queryFn: () => fetchYear(start, end, "WASTEOUT"), staleTime: 300000 });
  const prev = useQuery({ queryKey: ["outgoing-wastes-period", prevStart, prevEnd], queryFn: () => fetchYear(prevStart, prevEnd, "WASTEOUT"), enabled: compare, staleTime: 300000 });
  const inc = useQuery({ queryKey: ["incoming-wastes-period", start, end], queryFn: () => fetchYear(start, end, "IN"), staleTime: 300000 });
  const prevInc = useQuery({ queryKey: ["incoming-wastes-period", prevStart, prevEnd], queryFn: () => fetchYear(prevStart, prevEnd, "IN"), enabled: compare, staleTime: 300000 });

  const data = useMemo(() => {
    const rows = out.data ?? [];
    const streams = new Map<string, { loads: number; t: number; prev: number }>();
    const dest = new Map<string, { loads: number; t: number; prev: number; streams: Set<string> }>();
    const prevDest = new Map<string, number>();
    const monthly = MONTHS.map((m) => ({ month: m, [String(year)]: 0, [String(year - 1)]: 0 } as Record<string, number | string>));
    for (const r of rows) {
      const s = outgoingStream(r.ewc, r.waste_description, r.product);
      const e = streams.get(s) ?? { loads: 0, t: 0, prev: 0 };
      e.loads++; e.t += tonnes(r); streams.set(s, e);
      const name = r.customer?.trim() || "Unknown";
      const d = dest.get(name) ?? { loads: 0, t: 0, prev: 0, streams: new Set() };
      d.loads++; d.t += tonnes(r); d.streams.add(s); dest.set(name, d);
      const mi = (parseLoadReportDate(r.job_date)?.getUTCMonth() ?? 0);
      (monthly[mi][String(year)] as number) += tonnes(r);
    }
    for (const r of (compare ? prev.data ?? [] : [])) {
      const s = outgoingStream(r.ewc, r.waste_description, r.product);
      const e = streams.get(s) ?? { loads: 0, t: 0, prev: 0 };
      e.prev += tonnes(r); streams.set(s, e);
      const pname = r.customer?.trim() || "Unknown";
      prevDest.set(pname, (prevDest.get(pname) ?? 0) + tonnes(r));
      (monthly[(parseLoadReportDate(r.job_date)?.getUTCMonth() ?? 0)][String(year - 1)] as number) += tonnes(r);
    }
    const total = rows.reduce((a, r) => a + tonnes(r), 0);
    const prevTotal = ((compare ? prev.data ?? [] : [])).reduce((a, r) => a + tonnes(r), 0);
    const inTotal = (inc.data ?? []).reduce((a, r) => a + tonnes(r), 0);
    const prevInTotal = ((compare ? prevInc.data ?? [] : [])).reduce((a, r) => a + tonnes(r), 0);
    const headlines = outgoingHeadlineTotals(rows);
    const prevHeadlines = outgoingHeadlineTotals((compare ? prev.data ?? [] : []));
    return {
      total, prevTotal, inTotal, prevInTotal, loads: rows.length, prevLoads: prev.data?.length ?? 0, headlines, prevHeadlines,

      streams: [...streams.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.t - a.t),
      dest: [...new Set([...dest.keys(), ...prevDest.keys()])].map((name) => {
        const v = dest.get(name);
        return { name, loads: v?.loads ?? 0, t: v?.t ?? 0, prev: prevDest.get(name) ?? 0, streams: [...(v?.streams ?? [])].join(", ") };
      }).sort((a, b) => b.t - a.t),
      monthly: monthly.map((m) => ({ ...m, [String(year)]: Math.round(m[String(year)] as number), [String(year - 1)]: Math.round(m[String(year - 1)] as number) })),
    };
  }, [out.data, prev.data, inc.data, prevInc.data, year, compare]);

  const loading = out.isLoading || inc.isLoading || (compare && (prev.isLoading || prevInc.isLoading));
  const change = (a: number, b: number) => {
    const value = outgoingYearChange(a, b);
    return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };
  const outToIn = outgoingPercentage(data.headlines.total, data.inTotal);
  const previousOutToIn = outgoingPercentage(data.prevHeadlines.total, data.prevInTotal);
  const comparison = (current: number, previous: number, unit = "t") => !compare ? "" : !prev.data?.length ? "Comparison unavailable: no prior-period records" : `${previousLabel}: ${t(previous)} ${unit} · ${change(current, previous)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Outgoing wastes</h2>
          <p className="text-sm text-muted-foreground">Actual weighed Midweigh WASTEOUT loads · all units · EWC and recorded product.</p>
        </div>
        {!externalStartDate && <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>}
      </div>
      <p className="text-xs text-muted-foreground">{currentLabel}{compare ? ` versus ${previousLabel}` : ""}. Current-year comparisons use matched elapsed dates, not a full prior year.</p>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">{[0,1,2].map(key => <Skeleton key={key} className="h-44 w-full" />)}</div>
      ) : out.error || inc.error || (compare && (prev.error || prevInc.error)) ? (
        <Card><CardContent className="py-10 text-center text-destructive">Couldn't load complete Midweigh figures. <Button variant="outline" onClick={() => { void out.refetch(); void inc.refetch(); void prev.refetch(); void prevInc.refetch(); }}>Try again</Button></CardContent></Card>
      ) : (
        <>
          {view === "all" && <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Total tonnes out",
                value: t(data.headlines.total),
                note: `${data.loads.toLocaleString("en-GB")} loads`,
                comparison: comparison(data.headlines.total, data.prevHeadlines.total),
                showIncoming: true,
              },
              {
                label: "Zero to landfill",
                value: t(data.headlines.zeroToLandfill),
                note: `${data.headlines.total ? ((data.headlines.zeroToLandfill / data.headlines.total) * 100).toFixed(1) : "0"}% of tonnes out · landfill ${t(data.headlines.landfill)}t`,
                comparison: comparison(data.headlines.zeroToLandfill, data.prevHeadlines.zeroToLandfill),
              },
              {
                label: "Recycling",
                value: t(data.headlines.recycling),
                note: `${data.headlines.total ? ((data.headlines.recycling / data.headlines.total) * 100).toFixed(1) : "0"}% of tonnes out · excludes landfill and RDF ${t(data.headlines.rdf)}t`,
                comparison: comparison(data.headlines.recycling, data.prevHeadlines.recycling),
              },
            ].map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{c.label}</p><Badge variant="outline" className="text-primary">Actual</Badge></div>
                  <p className="text-2xl font-semibold tabular-nums">{c.value} <span className="text-sm font-normal text-muted-foreground">t</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>
                  <p className="mt-2 text-xs tabular-nums text-muted-foreground">{c.comparison}</p>
                  {c.showIncoming && (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-primary">Waste in (yard)</span>
                        <span className="text-lg font-semibold tabular-nums text-primary">{t(data.inTotal)}t</span>
                      </div>
                      <p className="text-xs tabular-nums text-muted-foreground">{comparison(data.inTotal, data.prevInTotal)}</p>
                      <p className="mt-2 text-sm font-semibold tabular-nums">Waste out = {outToIn === null ? "—" : `${outToIn.toFixed(1)}%`} of waste in</p>
                      <p className="text-xs tabular-nums text-muted-foreground">{previousLabel}: {previousOutToIn === null ? "—" : `${previousOutToIn.toFixed(1)}%`} of waste in</p>
                    <p className="mt-2 text-xs text-muted-foreground">{outToIn !== null && outToIn > 100 ? "Above 100%: review stock movements and internal transfers; the cause is not established by these totals." : "Outgoing tonnes divided by yard intake; not a material recovery yield."}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Loads out", data.loads.toLocaleString("en-GB"), comparison(data.loads, data.prevLoads, "")],
              ["RDF out (tonnes)", t(data.headlines.rdf), comparison(data.headlines.rdf, data.prevHeadlines.rdf)],
              ["Tonnes in (yard)", t(data.inTotal), comparison(data.inTotal, data.prevInTotal)],
            ].map(([label, value, prior]) => (
              <Card key={label}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs tabular-nums text-muted-foreground">{prior}</p></CardContent></Card>
            ))}
          </div>


          <Card>
            <CardHeader><CardTitle>By waste stream</CardTitle><CardDescription>Recorded tonnes · {currentLabel}{compare ? ` · versus ${previousLabel}` : ""}.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Stream</TableHead><TableHead className="text-right">Loads</TableHead><TableHead className="text-right">Tonnes</TableHead>
                  <TableHead className="text-right">Share</TableHead><TableHead className="text-right">{compare ? previousLabel : "Comparison off"}</TableHead><TableHead className="text-right">Change</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.streams.filter(s => s.t > 0).map((s) => (
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
                  {compare && <Bar dataKey={String(year - 1)} name={previousLabel} fill="hsl(var(--muted-foreground))" />}
                  <Bar dataKey={String(year)} name={currentLabel} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          </>}
          <Card>
            <CardHeader><CardTitle>Destinations</CardTitle><CardDescription>Where outgoing loads went · {currentLabel}.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Destination</TableHead><TableHead>Streams</TableHead><TableHead className="text-right">Loads</TableHead><TableHead className="text-right">Tonnes</TableHead>
                  <TableHead className="text-right">{compare ? previousLabel : "Comparison off"}</TableHead><TableHead className="text-right">Change</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.dest.filter(d => d.t > 0).map((d) => (
                    <TableRow key={d.name}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.streams}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.loads}</TableCell>
                      <TableCell className="text-right tabular-nums">{t(d.t)}</TableCell>
                      <TableCell className="text-right tabular-nums">{t(d.prev)}</TableCell>
                      <TableCell className="text-right tabular-nums">{change(d.t, d.prev)}</TableCell>
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
