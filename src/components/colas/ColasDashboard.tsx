import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CalendarRange, FileClock, FlaskConical, Leaf, PoundSterling, Scale, Sigma } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MONTH_NAMES, PROVIDER_LABELS, monthKey, type ColasProvider } from "@/lib/colas-report";
import { fmtGBP, fmtT, type ColasYearData } from "./useColasData";
import { Chip, KpiCard, StatusChip, ukDateTime } from "./ColasShared";

const C_HAZ = "hsl(var(--primary))";
const C_NON = "hsl(143.57 48.84% 66.27%)";
const C_LINE = "hsl(var(--info))";
const PIE = ["hsl(var(--primary))", "hsl(143.57 48.84% 66.27%)", "hsl(var(--info))", "hsl(var(--warning))", "hsl(var(--muted-foreground))", "hsl(var(--destructive))", "hsl(var(--accent-foreground))"];

export function ColasDashboard({ data, index }: { data: ColasYearData; index: number }) {
  const m = data.months[index];
  const ytd = data.ytd[index];
  const short = (mm: number) => MONTH_NAMES[mm - 1].slice(0, 3);
  const monthly = data.months.map((x, i) => ({ name: short(x.month), Hazardous: x.hazardous_t, "Non-hazardous": x.non_hazardous_t, Cost: x.costs.total, "Year to date": data.ytd[i].total_t, future: x.inProgress && x.lines.length === 0 }));
  const upto = data.months.slice(0, index + 1);
  const prov = new Map<ColasProvider, number>();
  for (const x of upto) for (const p of x.byProvider) prov.set(p.provider, (prov.get(p.provider) ?? 0) + p.tonnes);
  const provData = [...prov.entries()].map(([k, v]) => ({ name: PROVIDER_LABELS[k].replace(/ \(.*\)$/, ""), tonnes: Math.round(v * 1000) / 1000 })).sort((a, b) => b.tonnes - a.tonnes);
  const split = [{ name: "Hazardous", value: m.hazardous_t }, { name: "Non-hazardous", value: m.non_hazardous_t }];
  const lastGen = [...data.periods.values()].map(p => p.last_generated_at).filter(Boolean).sort().pop() ?? null;
  const period = data.periods.get(monthKey(m.year, m.month));
  const outstandingYear = data.months.filter(x => !x.inProgress || x.lines.length).reduce((a, x) => a + x.outstanding.length, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        <KpiCard icon={CalendarRange} label="Reporting month" value={<span className="text-xl">{m.label}</span>} sub={period?.status === "approved" ? <Chip tone="info">Approved</Chip> : m.inProgress ? <Chip tone="neutral">In progress</Chip> : <Chip tone="warn">Awaiting approval</Chip>} />
        <KpiCard icon={Scale} label="Waste this month" value={`${fmtT(m.total_t)} t`} sub={m.missingWeights ? `${m.missingWeights} weight${m.missingWeights === 1 ? "" : "s"} missing` : "All weights recorded"} />
        <KpiCard icon={FlaskConical} label="Hazardous" value={`${fmtT(m.hazardous_t)} t`} />
        <KpiCard icon={Leaf} label="Non-hazardous" value={`${fmtT(m.non_hazardous_t)} t`} />
        <KpiCard icon={PoundSterling} label="Costs this month" value={fmtGBP(m.costs.total)} sub={m.costs.provisional ? "Provisional – Sage not imported" : "From Sage, ex VAT"} />
        <KpiCard icon={AlertTriangle} label="Outstanding this month" value={m.outstanding.length} tone={m.outstanding.length ? "alert" : undefined} sub={`${outstandingYear} across the year so far`} />
        <KpiCard icon={Sigma} label="Year to date" value={`${fmtT(ytd.total_t)} t`} />
        <KpiCard icon={FlaskConical} label="YTD hazardous" value={`${fmtT(ytd.hazardous_t)} t`} />
        <KpiCard icon={Leaf} label="YTD non-hazardous" value={`${fmtT(ytd.non_hazardous_t)} t`} />
        <KpiCard icon={PoundSterling} label="YTD costs" value={fmtGBP(ytd.total_cost)} />
        <KpiCard icon={FileClock} label="Last report generated" value={<span className="text-xl">{lastGen ? ukDateTime(lastGen) : "Not yet"}</span>} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Monthly waste volumes (tonnes)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: number) => `${fmtT(v)} t`} /><Legend />
                <Bar dataKey="Non-hazardous" stackId="a" fill={C_NON} /><Bar dataKey="Hazardous" stackId="a" fill={C_HAZ} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Monthly costs (ex VAT)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis tickFormatter={(v) => `£${Math.round(v / 1000)}k`} /><Tooltip formatter={(v: number) => fmtGBP(v)} />
                <Bar dataKey="Cost" fill={C_HAZ} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Hazardous vs non-hazardous – {m.label}</CardTitle></CardHeader>
          <CardContent className="h-72">
            {m.total_t > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={split} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label={(e) => `${e.name}: ${fmtT(e.value)} t`}>
                  <Cell fill={C_HAZ} /><Cell fill={C_NON} /></Pie><Tooltip formatter={(v: number) => `${fmtT(v)} t`} /></PieChart>
              </ResponsiveContainer>
            ) : <p className="pt-10 text-center text-muted-foreground">No weights recorded for this month yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Waste by collection provider – year to date</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={provData} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={150} /><Tooltip formatter={(v: number) => `${fmtT(v)} t`} />
                <Bar dataKey="tonnes" name="Tonnes">{provData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle className="text-lg">Year-to-date trend (tonnes)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly.slice(0, index + 1)}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: number) => `${fmtT(v)} t`} />
                <Line type="monotone" dataKey="Year to date" stroke={C_LINE} strokeWidth={3} dot /></LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Data check – {m.label}</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {m.sources.map(s => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div><div className="font-medium">{s.label}</div><div className="text-sm text-muted-foreground">{s.detail}{s.note ? ` — ${s.note}` : ""}</div></div>
                <StatusChip status={s.status} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
