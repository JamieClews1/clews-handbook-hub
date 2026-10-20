import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Download, Gem, Printer, Smartphone } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { computeStock, type StockInputs } from "@/lib/metals";
import { MetalDispatchForm } from "@/components/metals/MetalDispatchForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck } from "lucide-react";

const db = supabase as any;
const kg = (n: number) => `${Math.round(n).toLocaleString("en-GB")} kg`;
const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";
const day = (s: string) => s.slice(0, 10);

function toCsv(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${name}.csv`; a.click();
}

function useMetals() {
  return useQuery({
    queryKey: ["nf-all"],
    queryFn: async () => {
      const [g, b, p, c, s, d, a, am] = await Promise.all([
        db.from("nf_grades").select("*").order("display_order"),
        db.from("nf_buyers").select("*").order("name"),
        db.from("nf_prices").select("*").order("effective_date", { ascending: false }),
        db.from("nf_collections").select("*").order("recorded_at", { ascending: false }).limit(5000),
        db.from("nf_sort_entries").select("*").order("recorded_at", { ascending: false }).limit(10000),
        db.from("nf_dispatches").select("*").order("dispatch_date", { ascending: false }).limit(5000),
        db.from("nf_adjustments").select("*").order("created_at", { ascending: false }),
        db.from("nf_amendments").select("*").order("created_at", { ascending: false }).limit(1000),
      ]);
      return { grades: g.data ?? [], buyers: b.data ?? [], prices: p.data ?? [], collections: c.data ?? [], sorts: s.data ?? [], dispatches: d.data ?? [], adjustments: a.data ?? [], amendments: am.data ?? [] };
    },
  });
}

export default function MetalsPage() {
  const { data, isLoading } = useMetals();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [gradeFilter, setGradeFilter] = useState("all");
  const [dispatchGrade, setDispatchGrade] = useState<string | null>(null);

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Loading…</div>;
  const gName = (id: string) => data.grades.find((g: any) => g.id === id)?.name ?? "—";
  const bName = (id: string) => data.buyers.find((b: any) => b.id === id)?.name ?? "—";
  const stock = computeStock(data as StockInputs);

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Gem className="text-primary" />Non-Ferrous Metals</h1>
          <p className="text-muted-foreground">Collection, sorting, stock, sales and prices. Yard staff record weights on the phone app.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><label className="text-xs text-muted-foreground">From</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">To</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All grades</SelectItem>{data.grades.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button className="gap-2" onClick={() => setDispatchGrade("")}><Truck className="h-4 w-4" />Record metal leaving site</Button>
          <Button asChild variant="outline" className="gap-2"><a href="/metals-yard" target="_blank" rel="noreferrer"><Smartphone className="h-4 w-4" />Yard app</a></Button>
        </div>
      </div>

      {stock.filter((s) => s.alert !== "ok").map((s) => (
        <div key={s.grade.id} className={`rounded-lg border p-3 flex items-center gap-2 font-medium ${s.alert === "over" ? "border-destructive bg-destructive/10 text-destructive" : "border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)]"}`}>
          <AlertTriangle className="h-5 w-5" />
          {s.grade.name}: {kg(s.kg)} in stock {s.alert === "over" ? `— at or over the ${s.grade.stock_limit_kg} kg limit. Sell now.` : `— approaching the ${s.grade.stock_limit_kg} kg limit.`}
          {s.grade.name.toLowerCase() === "lead" && " Lead must be sold before holdings exceed 500 kg."}
        </div>
      ))}

      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap h-auto">
          {["dashboard:Dashboard", "records:Collection & Sorting", "stock:Stock", "sales:Dispatches & Sales", "prices:Metal Prices", "reports:Reports", "settings:Settings", "audit:Audit History"].map((t) => {
            const [v, l] = t.split(":"); return <TabsTrigger key={v} value={v}>{l}</TabsTrigger>;
          })}
        </TabsList>
        <TabsContent value="dashboard"><Dashboard data={data} stock={stock} from={from} to={to} gName={gName} /></TabsContent>
        <TabsContent value="records"><Records data={data} from={from} to={to} grade={gradeFilter} gName={gName} /></TabsContent>
        <TabsContent value="stock"><StockTab data={data} stock={stock} onDispatch={setDispatchGrade} /></TabsContent>
        <TabsContent value="sales"><Sales data={data} from={from} to={to} grade={gradeFilter} gName={gName} bName={bName} onDispatch={() => setDispatchGrade(gradeFilter === "all" ? "" : gradeFilter)} /></TabsContent>
        <TabsContent value="prices"><Prices data={data} gName={gName} bName={bName} /></TabsContent>
        <TabsContent value="reports"><Reports data={data} stock={stock} from={from} to={to} grade={gradeFilter} gName={gName} bName={bName} /></TabsContent>
        <TabsContent value="settings"><Settings data={data} /></TabsContent>
        <TabsContent value="audit"><Audit data={data} /></TabsContent>
      </Tabs>
      <Dialog open={dispatchGrade !== null} onOpenChange={open => { if (!open) setDispatchGrade(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" aria-describedby={undefined}><DialogHeader><DialogTitle>Record metal leaving site</DialogTitle></DialogHeader>{dispatchGrade !== null && <MetalDispatchForm data={data} initialGradeId={dispatchGrade} onSaved={() => setDispatchGrade(null)} />}</DialogContent></Dialog>
    </div>
  );
}

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${tone ?? ""}`}>{value}</p></CardContent></Card>
);

function inRange(d: string, from: string, to: string) { const x = day(d); return x >= from && x <= to; }

function Dashboard({ data, stock, from, to, gName }: any) {
  const live = (r: any) => !r.is_voided;
  const t = today(), m = monthStart();
  const sum = (rows: any[]) => rows.reduce((a, r) => a + Number(r.weight_kg), 0);
  const cols = data.collections.filter(live), sorts = data.sorts.filter(live);
  const dispMonth = data.dispatches.filter((d: any) => d.dispatch_date >= m);
  const byGrade = data.grades.map((g: any) => ({ name: g.name, kg: sum(sorts.filter((s: any) => s.grade_id === g.id && inRange(s.recorded_at, from, to))) })).filter((x: any) => x.kg > 0);
  const days: Record<string, { day: string; collected: number; sorted: number }> = {};
  for (const r of cols.filter((r: any) => inRange(r.recorded_at, from, to))) (days[day(r.recorded_at)] ??= { day: day(r.recorded_at), collected: 0, sorted: 0 }).collected += Number(r.weight_kg);
  for (const r of sorts.filter((r: any) => inRange(r.recorded_at, from, to))) (days[day(r.recorded_at)] ??= { day: day(r.recorded_at), collected: 0, sorted: 0 }).sorted += Number(r.weight_kg);
  const series = Object.values(days).sort((a, b) => a.day.localeCompare(b.day));
  const revenue = data.grades.map((g: any) => ({ name: g.name, value: data.dispatches.filter((d: any) => d.grade_id === g.id && d.dispatch_date >= from && d.dispatch_date <= to).reduce((a: number, d: any) => a + Number(d.total_value), 0) })).filter((x: any) => x.value > 0);
  const stockChart = stock.filter((s: any) => s.kg !== 0).map((s: any) => ({ name: s.grade.name, kg: s.kg }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Collected today" value={kg(sum(cols.filter((r: any) => day(r.recorded_at) === t)))} />
        <Stat label="Sorted today" value={kg(sum(sorts.filter((r: any) => day(r.recorded_at) === t)))} />
        <Stat label="Collected this month" value={kg(sum(cols.filter((r: any) => day(r.recorded_at) >= m)))} />
        <Stat label="Sorted this month" value={kg(sum(sorts.filter((r: any) => day(r.recorded_at) >= m)))} />
        <Stat label="Current stock" value={kg(stock.reduce((a: number, s: any) => a + s.kg, 0))} />
        <Stat label="Estimated stock value" value={gbp(stock.reduce((a: number, s: any) => a + s.value, 0))} tone="text-primary" />
        <Stat label="Dispatched this month" value={kg(sum(dispMonth))} />
        <Stat label="Sales revenue this month" value={gbp(dispMonth.reduce((a: number, d: any) => a + Number(d.total_value), 0))} tone="text-primary" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Collection vs sorting over time"><LineChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Legend /><Line dataKey="collected" stroke="hsl(var(--primary))" /><Line dataKey="sorted" stroke="hsl(var(--warning))" /></LineChart></ChartCard>
        <ChartCard title="Sorted weight by grade (kg)"><BarChart data={byGrade}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis /><Tooltip /><Bar dataKey="kg" fill="hsl(var(--primary))" /></BarChart></ChartCard>
        <ChartCard title="Sales revenue by grade (£)"><BarChart data={revenue}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" /></BarChart></ChartCard>
        <ChartCard title="Stock by grade (kg)"><BarChart data={stockChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis /><Tooltip /><Bar dataKey="kg" fill="hsl(var(--warning))" /></BarChart></ChartCard>
      </div>
      <Performance data={data} gName={gName} />
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></CardContent></Card>;
}

function Performance({ data }: any) {
  const now = Date.now();
  const w = (r: any, a: number, b: number) => { const age = (now - new Date(r.recorded_at).getTime()) / 864e5; return age >= a && age < b; };
  const rows = data.grades.map((g: any) => {
    const s = data.sorts.filter((r: any) => !r.is_voided && r.grade_id === g.id);
    const last4 = s.filter((r: any) => w(r, 0, 28)).reduce((a: number, r: any) => a + Number(r.weight_kg), 0);
    const prev4 = s.filter((r: any) => w(r, 28, 56)).reduce((a: number, r: any) => a + Number(r.weight_kg), 0);
    return { g, last4, prev4, avg: last4 / 28, count: s.filter((r: any) => w(r, 0, 28)).length };
  }).sort((a: any, b: any) => b.last4 - a.last4);
  return (
    <Card><CardHeader><CardTitle className="text-base">Recovery performance (last 4 weeks vs previous 4)</CardTitle></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Grade</TableHead><TableHead className="text-right">Entries</TableHead><TableHead className="text-right">Last 4 wks</TableHead><TableHead className="text-right">Previous 4 wks</TableHead><TableHead className="text-right">Avg / day</TableHead><TableHead className="text-right">Est. value</TableHead><TableHead>Trend</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((r: any) => (
          <TableRow key={r.g.id}><TableCell className="font-medium">{r.g.name}</TableCell><TableCell className="text-right">{r.count}</TableCell><TableCell className="text-right">{kg(r.last4)}</TableCell><TableCell className="text-right">{kg(r.prev4)}</TableCell><TableCell className="text-right">{r.avg.toFixed(1)} kg</TableCell><TableCell className="text-right">{gbp(r.last4 / 1000 * Number(r.g.price_per_tonne))}</TableCell>
            <TableCell>{r.last4 === 0 && r.prev4 === 0 ? <Badge variant="outline">None recovered</Badge> : r.last4 < r.prev4 * 0.8 ? <Badge variant="destructive">Declining</Badge> : r.last4 > r.prev4 * 1.2 ? <Badge>Rising</Badge> : <Badge variant="secondary">Steady</Badge>}</TableCell></TableRow>
        ))}</TableBody></Table>
    </CardContent></Card>
  );
}

function useAmend() {
  const { user } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  return async (table: string, rec: any, patch: Record<string, unknown>, reason: string) => {
    const name = user?.email ?? "office";
    for (const [k, v] of Object.entries(patch)) await db.from("nf_amendments").insert({ table_name: table, record_id: rec.id, field: k, old_value: String(rec[k]), new_value: String(v), reason, amended_by: user?.id, amended_by_name: name });
    const { error } = await db.from(table).update(patch).eq("id", rec.id);
    if (error) toast({ title: "Not saved", description: error.message, variant: "destructive" }); else toast({ title: "Correction saved" });
    qc.invalidateQueries({ queryKey: ["nf-all"] });
  };
}

function Records({ data, from, to, grade, gName }: any) {
  const amend = useAmend();
  const [staff, setStaff] = useState("");
  const correct = (table: string, r: any) => {
    const v = prompt(`Correct weight (kg). Current: ${r.weight_kg}. Leave blank to cancel, type 0 to remove the entry.`); if (v === null || v === "") return;
    const reason = prompt("Reason for correction") ?? "";
    const n = Number(v); if (isNaN(n) || n < 0) return;
    amend(table, r, n === 0 ? { is_voided: true } : { weight_kg: n }, reason);
  };
  const f = (r: any) => inRange(r.recorded_at, from, to) && (!staff || r.staff_name.toLowerCase().includes(staff.toLowerCase()));
  const cols = data.collections.filter(f);
  const sorts = data.sorts.filter((r: any) => f(r) && (grade === "all" || r.grade_id === grade));
  return (
    <div className="space-y-4">
      <Input placeholder="Filter by staff member…" value={staff} onChange={(e) => setStaff(e.target.value)} className="max-w-xs" />
      <div className="grid xl:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-base">Collections ({cols.length})</CardTitle></CardHeader><CardContent className="max-h-[600px] overflow-auto">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Staff</TableHead><TableHead className="text-right">Weight</TableHead><TableHead>Notes</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{cols.map((r: any) => <TableRow key={r.id} className={r.is_voided ? "opacity-40 line-through" : ""}><TableCell>{new Date(r.recorded_at).toLocaleString("en-GB")}</TableCell><TableCell>{r.staff_name}</TableCell><TableCell className="text-right">{kg(r.weight_kg)}</TableCell><TableCell className="max-w-48 truncate">{r.notes}{r.photo_path && <PhotoLink path={r.photo_path} />}</TableCell><TableCell>{!r.is_voided && <Button size="sm" variant="ghost" onClick={() => correct("nf_collections", r)}>Correct</Button>}</TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Sorting entries ({sorts.length})</CardTitle></CardHeader><CardContent className="max-h-[600px] overflow-auto">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Grade</TableHead><TableHead>Staff</TableHead><TableHead className="text-right">Weight</TableHead><TableHead>Session</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{sorts.map((r: any) => <TableRow key={r.id} className={r.is_voided ? "opacity-40 line-through" : ""}><TableCell>{new Date(r.recorded_at).toLocaleString("en-GB")}</TableCell><TableCell>{gName(r.grade_id)}</TableCell><TableCell>{r.staff_name}</TableCell><TableCell className="text-right">{kg(r.weight_kg)}</TableCell><TableCell className="text-xs">{r.session_ref}</TableCell><TableCell>{!r.is_voided && <Button size="sm" variant="ghost" onClick={() => correct("nf_sort_entries", r)}>Correct</Button>}</TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
      </div>
    </div>
  );
}

function PhotoLink({ path }: { path: string }) {
  return <Button size="sm" variant="link" className="h-auto p-0 ml-1" onClick={async () => { const { data } = await supabase.storage.from("metal-photos").createSignedUrl(path, 600); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); }}>photo</Button>;
}

function StockTab({ data, stock, onDispatch }: any) {
  const { user } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  const [gradeId, setGradeId] = useState(""); const [amount, setAmount] = useState(""); const [reason, setReason] = useState("");
  const save = async () => {
    const { error } = await db.from("nf_adjustments").insert({ grade_id: gradeId, adjustment_kg: Number(amount), reason, authorised_by: user?.id, authorised_name: user?.email });
    if (error) return toast({ title: "Not saved", description: error.message, variant: "destructive" });
    toast({ title: "Stock adjustment recorded" }); setAmount(""); setReason(""); qc.invalidateQueries({ queryKey: ["nf-all"] });
  };
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Grade</TableHead><TableHead className="text-right">Sorted in</TableHead><TableHead className="text-right">Adjustments</TableHead><TableHead className="text-right">Dispatched</TableHead><TableHead className="text-right">In stock</TableHead><TableHead className="text-right">£/t</TableHead><TableHead className="text-right">Est. value</TableHead><TableHead>Status</TableHead><TableHead>Preferred destination</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{stock.map((s: any) => <TableRow key={s.grade.id}><TableCell className="font-medium">{s.grade.name}{!s.grade.is_active && " (inactive)"}</TableCell><TableCell className="text-right">{kg(s.sorted)}</TableCell><TableCell className="text-right">{kg(s.adjusted)}</TableCell><TableCell className="text-right">{kg(s.dispatched)}</TableCell><TableCell className="text-right font-bold">{kg(s.kg)}</TableCell><TableCell className="text-right">{gbp(Number(s.grade.price_per_tonne))}</TableCell><TableCell className="text-right">{gbp(s.value)}</TableCell>
          <TableCell>{s.kg < 0 ? <Badge variant="destructive">Negative — check</Badge> : s.alert === "over" ? <Badge variant="destructive">Over limit</Badge> : s.alert === "warn" ? <Badge variant="outline">Near limit</Badge> : <Badge variant="secondary">OK</Badge>}</TableCell><TableCell>{s.grade.preferred_destination || "—"}</TableCell><TableCell><Button size="sm" variant="outline" disabled={!s.grade.is_active} onClick={() => onDispatch(s.grade.id)}>Record dispatch</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Opening stock / authorised adjustment</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2 items-end">
        <Select value={gradeId} onValueChange={setGradeId}><SelectTrigger className="w-56"><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent>{data.grades.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select>
        <Input type="number" placeholder="kg (+ add / − remove)" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-48" />
        <Input placeholder="Reason (e.g. opening stock, received from other source, recount)" value={reason} onChange={(e) => setReason(e.target.value)} className="flex-1 min-w-64" />
        <Button disabled={!gradeId || !Number(amount) || !reason.trim()} onClick={save}>Record adjustment</Button>
      </CardContent></Card>
    </div>
  );
}

function Sales({ data, from, to, grade, gName, bName, onDispatch }: any) {
  const rows = data.dispatches.filter((d: any) => d.dispatch_date >= from && d.dispatch_date <= to && (grade === "all" || d.grade_id === grade));
  const totalKg = rows.reduce((a: number, d: any) => a + Number(d.weight_kg), 0), totalV = rows.reduce((a: number, d: any) => a + Number(d.total_value), 0);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Dispatches — {kg(totalKg)}, {gbp(totalV)}</h2><Button className="gap-2" onClick={onDispatch}><Truck className="h-4 w-4" />Record metal leaving site</Button></div>
    <div className="overflow-x-auto border rounded-lg"><Table><TableHeader><TableRow><TableHead>Date / time</TableHead><TableHead>Destination site</TableHead><TableHead>Buyer</TableHead><TableHead>Metal type</TableHead><TableHead className="text-right">Weight</TableHead><TableHead className="text-right">£/t</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Sales ref</TableHead><TableHead>Ticket</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
      <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">No dispatches for these dates.</TableCell></TableRow> : rows.map((d: any) => <TableRow key={d.id}><TableCell className="whitespace-nowrap">{d.dispatch_date}{d.dispatch_time && <span className="block text-muted-foreground">{d.dispatch_time.slice(0, 5)}</span>}</TableCell><TableCell className="font-medium">{d.destination_site || "—"}</TableCell><TableCell>{bName(d.buyer_id)}</TableCell><TableCell>{gName(d.grade_id)}</TableCell><TableCell className="text-right">{kg(d.weight_kg)}</TableCell><TableCell className="text-right">{gbp(Number(d.price_per_tonne))}</TableCell><TableCell className="text-right font-semibold">{gbp(Number(d.total_value))}</TableCell><TableCell>{d.sales_ref}</TableCell><TableCell>{d.weighbridge_ticket}</TableCell><TableCell>{d.notes}</TableCell></TableRow>)}</TableBody>
    </Table></div>
  </div>;
}

function Prices({ data, gName, bName }: any) {
  const { user } = useAuth(); const qc = useQueryClient(); const { toast } = useToast();
  const [f, setF] = useState<any>({ effective_date: today() });
  const save = async () => {
    const { error } = await db.from("nf_prices").insert({ grade_id: f.grade_id, buyer_id: f.buyer_id && f.buyer_id !== "none" ? f.buyer_id : null, price_per_tonne: Number(f.price), effective_date: f.effective_date, notes: f.notes || null, created_by: user?.id });
    if (error) return toast({ title: "Not saved", description: error.message, variant: "destructive" });
    if (!f.buyer_id || f.buyer_id === "none") {
      const g = data.grades.find((x: any) => x.id === f.grade_id);
      await db.from("nf_amendments").insert({ table_name: "nf_grades", record_id: f.grade_id, field: "price_per_tonne", old_value: String(g?.price_per_tonne), new_value: String(f.price), reason: "Price update", amended_by: user?.id, amended_by_name: user?.email });
      await db.from("nf_grades").update({ price_per_tonne: Number(f.price) }).eq("id", f.grade_id);
    }
    toast({ title: "Price saved" }); setF({ effective_date: today() }); qc.invalidateQueries({ queryKey: ["nf-all"] });
  };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card><CardHeader><CardTitle className="text-base">Current prices (per tonne)</CardTitle></CardHeader><CardContent className="p-0">
        <Table><TableBody>{data.grades.filter((g: any) => g.is_active).map((g: any) => <TableRow key={g.id}><TableCell className="font-medium">{g.name}</TableCell><TableCell className="text-right text-lg font-semibold">{gbp(Number(g.price_per_tonne))}</TableCell></TableRow>)}</TableBody></Table>
      </CardContent></Card>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle className="text-base">Update a price</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2">
          <Select value={f.grade_id ?? ""} onValueChange={(v) => setF({ ...f, grade_id: v })}><SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent>{data.grades.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select>
          <Select value={f.buyer_id ?? "none"} onValueChange={(v) => setF({ ...f, buyer_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Standard price (all buyers)</SelectItem>{data.buyers.map((b: any) => <SelectItem key={b.id} value={b.id}>Buyer: {b.name}</SelectItem>)}</SelectContent></Select>
          <Input type="number" placeholder="£ per tonne" value={f.price ?? ""} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <Input type="date" value={f.effective_date} onChange={(e) => setF({ ...f, effective_date: e.target.value })} />
          <Input className="col-span-2" placeholder="Notes" value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <Button className="col-span-2" disabled={!f.grade_id || !(Number(f.price) >= 0) || f.price === undefined} onClick={save}>Save price</Button>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Price history</CardTitle></CardHeader><CardContent className="p-0 max-h-96 overflow-auto">
          <Table><TableHeader><TableRow><TableHead>Effective</TableHead><TableHead>Grade</TableHead><TableHead>Buyer</TableHead><TableHead className="text-right">£/t</TableHead></TableRow></TableHeader>
            <TableBody>{data.prices.map((p: any) => <TableRow key={p.id}><TableCell>{p.effective_date}</TableCell><TableCell>{gName(p.grade_id)}</TableCell><TableCell>{p.buyer_id ? bName(p.buyer_id) : "Standard"}</TableCell><TableCell className="text-right">{gbp(Number(p.price_per_tonne))}</TableCell></TableRow>)}</TableBody></Table>
        </CardContent></Card>
      </div>
    </div>
  );
}

const REPORTS = ["Daily collection", "Daily sorting", "Weekly recovery", "Monthly recovery", "Metal-grade breakdown", "Current stock", "Stock valuation", "Dispatch", "Sales revenue", "Buyer performance", "Staff activity", "Collection-to-sorting reconciliation", "Stock discrepancy"];

function weekKey(d: string) { const x = new Date(d); const m = new Date(x); m.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return m.toISOString().slice(0, 10); }

function Reports({ data, stock, from, to, grade, gName, bName }: any) {
  const [report, setReport] = useState(REPORTS[0]);
  const [staff, setStaff] = useState(""); const [buyer, setBuyer] = useState("all");
  const rows: Record<string, unknown>[] = useMemo(() => {
    const live = (r: any) => !r.is_voided && inRange(r.recorded_at, from, to) && (!staff || r.staff_name.toLowerCase().includes(staff.toLowerCase()));
    const cols = data.collections.filter(live);
    const sorts = data.sorts.filter((r: any) => live(r) && (grade === "all" || r.grade_id === grade));
    const disp = data.dispatches.filter((d: any) => d.dispatch_date >= from && d.dispatch_date <= to && (grade === "all" || d.grade_id === grade) && (buyer === "all" || d.buyer_id === buyer));
    const group = (items: any[], key: (r: any) => string, val: (r: any) => number) => { const m: Record<string, number> = {}; items.forEach((r) => (m[key(r)] = (m[key(r)] ?? 0) + val(r))); return m; };
    switch (report) {
      case "Daily collection": return cols.map((r: any) => ({ Date: new Date(r.recorded_at).toLocaleString("en-GB"), Staff: r.staff_name, "Weight kg": r.weight_kg, Notes: r.notes ?? "" }));
      case "Daily sorting": return sorts.map((r: any) => ({ Date: new Date(r.recorded_at).toLocaleString("en-GB"), Grade: gName(r.grade_id), Staff: r.staff_name, "Weight kg": r.weight_kg, Session: r.session_ref ?? "" }));
      case "Weekly recovery": case "Monthly recovery": {
        const k = report.startsWith("Weekly") ? (r: any) => weekKey(day(r.recorded_at)) : (r: any) => day(r.recorded_at).slice(0, 7);
        const c = group(cols, k, (r) => Number(r.weight_kg)), s = group(sorts, k, (r) => Number(r.weight_kg));
        return [...new Set([...Object.keys(c), ...Object.keys(s)])].sort().map((p) => ({ Period: p, "Collected kg": c[p] ?? 0, "Sorted kg": s[p] ?? 0 }));
      }
      case "Metal-grade breakdown": { const days = Math.max(1, (new Date(to).getTime() - new Date(from).getTime()) / 864e5 + 1); return data.grades.map((g: any) => { const w = sorts.filter((r: any) => r.grade_id === g.id).reduce((a: number, r: any) => a + Number(r.weight_kg), 0); return { Grade: g.name, "Sorted kg": w, "Avg kg/day": +(w / days).toFixed(1), "Est value £": +(w / 1000 * g.price_per_tonne).toFixed(2) }; }); }
      case "Current stock": return stock.map((s: any) => ({ Grade: s.grade.name, "In stock kg": s.kg, "Limit kg": s.grade.stock_limit_kg ?? "" }));
      case "Stock valuation": return stock.map((s: any) => ({ Grade: s.grade.name, "In stock kg": s.kg, "£ per tonne": s.grade.price_per_tonne, "Value £": +s.value.toFixed(2) }));
      case "Dispatch": case "Sales revenue": return disp.map((d: any) => ({ Date: d.dispatch_date, Time: d.dispatch_time?.slice(0, 5) ?? "", "Destination site": d.destination_site ?? "", Buyer: bName(d.buyer_id), Grade: gName(d.grade_id), "Weight kg": d.weight_kg, "£ per tonne": d.price_per_tonne, "Value £": d.total_value, "Sales ref": d.sales_ref ?? "", Ticket: d.weighbridge_ticket ?? "" }));
      case "Buyer performance": { const m: Record<string, { kg: number; v: number; n: number }> = {}; disp.forEach((d: any) => { const k = bName(d.buyer_id); m[k] ??= { kg: 0, v: 0, n: 0 }; m[k].kg += Number(d.weight_kg); m[k].v += Number(d.total_value); m[k].n++; }); return Object.entries(m).map(([b, x]) => ({ Buyer: b, Loads: x.n, "Weight kg": x.kg, "Revenue £": +x.v.toFixed(2), "Avg £/t": x.kg ? +(x.v / (x.kg / 1000)).toFixed(2) : 0 })); }
      case "Staff activity": { const m: Record<string, { c: number; ck: number; s: number; sk: number }> = {}; cols.forEach((r: any) => { m[r.staff_name] ??= { c: 0, ck: 0, s: 0, sk: 0 }; m[r.staff_name].c++; m[r.staff_name].ck += Number(r.weight_kg); }); sorts.forEach((r: any) => { m[r.staff_name] ??= { c: 0, ck: 0, s: 0, sk: 0 }; m[r.staff_name].s++; m[r.staff_name].sk += Number(r.weight_kg); }); return Object.entries(m).map(([n, x]) => ({ Staff: n, Collections: x.c, "Collected kg": x.ck, "Sort entries": x.s, "Sorted kg": x.sk })); }
      case "Collection-to-sorting reconciliation": { const c = group(cols, (r) => day(r.recorded_at), (r) => Number(r.weight_kg)), s = group(sorts, (r) => day(r.recorded_at), (r) => Number(r.weight_kg)); return [...new Set([...Object.keys(c), ...Object.keys(s)])].sort().map((d) => { const diff = (c[d] ?? 0) - (s[d] ?? 0); return { Date: d, "Collected kg": c[d] ?? 0, "Sorted kg": s[d] ?? 0, "Difference kg": +diff.toFixed(1), Flag: (c[d] ?? 0) > 0 && Math.abs(diff) > (c[d] ?? 0) * 0.1 ? "Investigate" : "" }; }); }
      case "Stock discrepancy": return [
        ...stock.filter((s: any) => s.kg < 0).map((s: any) => ({ Type: "Negative stock", Grade: s.grade.name, Detail: `${s.kg} kg`, Date: "" })),
        ...data.adjustments.filter((a: any) => inRange(a.created_at, from, to)).map((a: any) => ({ Type: "Adjustment", Grade: gName(a.grade_id), Detail: `${a.adjustment_kg} kg — ${a.reason} (${a.authorised_name ?? ""})`, Date: day(a.created_at) })),
      ];
    }
    return [];
  }, [report, data, stock, from, to, grade, staff, buyer, gName, bName]);
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center print:hidden">
        <Select value={report} onValueChange={setReport}><SelectTrigger className="w-80"><SelectValue /></SelectTrigger><SelectContent>{REPORTS.map((r) => <SelectItem key={r} value={r}>{r} report</SelectItem>)}</SelectContent></Select>
        <Input placeholder="Staff member" value={staff} onChange={(e) => setStaff(e.target.value)} className="w-44" />
        <Select value={buyer} onValueChange={setBuyer}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All buyers</SelectItem>{data.buyers.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" className="gap-2" disabled={!rows.length} onClick={() => toCsv(rows, `${report.toLowerCase().replace(/\W+/g, "-")}-${from}-to-${to}`)}><Download className="h-4 w-4" />Export CSV</Button>
        <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
      </div>
      <Card><CardHeader><CardTitle className="text-base">{report} report · {from} to {to}</CardTitle></CardHeader><CardContent className="p-0 overflow-auto">
        {rows.length === 0 ? <p className="p-6 text-muted-foreground">No records for these filters.</p> : (
          <Table><TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{rows.map((r, i) => <TableRow key={i}>{cols.map((c) => <TableCell key={c}>{String(r[c] ?? "")}</TableCell>)}</TableRow>)}</TableBody></Table>
        )}
      </CardContent></Card>
    </div>
  );
}

function Settings({ data }: any) {
  const qc = useQueryClient(); const { toast } = useToast();
  const refresh = () => qc.invalidateQueries({ queryKey: ["nf-all"] });
  const [newGrade, setNewGrade] = useState(""); const [newBuyer, setNewBuyer] = useState("");
  const upd = async (table: string, id: string, patch: any) => { const { error } = await db.from(table).update(patch).eq("id", id); if (error) toast({ title: "Not saved", description: error.message, variant: "destructive" }); refresh(); };
  return (
    <div className="grid xl:grid-cols-3 gap-4">
      <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Metal grades</CardTitle></CardHeader><CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">Renaming or deactivating keeps all historical records. Stock limit triggers alerts (warning level shows first).</p>
        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Identification guidance</TableHead><TableHead>Preferred destination</TableHead><TableHead>Warn at kg</TableHead><TableHead>Limit kg</TableHead><TableHead>Order</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
          <TableBody>{data.grades.map((g: any) => <TableRow key={g.id}>
            <TableCell><Input defaultValue={g.name} onBlur={(e) => e.target.value !== g.name && upd("nf_grades", g.id, { name: e.target.value })} /></TableCell>
            <TableCell><Input defaultValue={g.guidance ?? ""} onBlur={(e) => e.target.value !== (g.guidance ?? "") && upd("nf_grades", g.id, { guidance: e.target.value || null })} /></TableCell>
            <TableCell><Input aria-label={`Preferred destination for ${g.name}`} key={g.preferred_destination ?? ""} defaultValue={g.preferred_destination ?? ""} onBlur={(e) => e.target.value.trim() !== (g.preferred_destination ?? "") && upd("nf_grades", g.id, { preferred_destination: e.target.value.trim() || null })} /></TableCell>
            <TableCell><Input type="number" className="w-24" defaultValue={g.warn_at_kg ?? ""} onBlur={(e) => upd("nf_grades", g.id, { warn_at_kg: e.target.value ? Number(e.target.value) : null })} /></TableCell>
            <TableCell><Input type="number" className="w-24" defaultValue={g.stock_limit_kg ?? ""} onBlur={(e) => upd("nf_grades", g.id, { stock_limit_kg: e.target.value ? Number(e.target.value) : null })} /></TableCell>
            <TableCell><Input type="number" className="w-16" defaultValue={g.display_order} onBlur={(e) => upd("nf_grades", g.id, { display_order: Number(e.target.value) })} /></TableCell>
            <TableCell><Switch checked={g.is_active} onCheckedChange={(v) => upd("nf_grades", g.id, { is_active: v })} /></TableCell>
          </TableRow>)}</TableBody></Table>
        <div className="flex gap-2"><Input placeholder="New grade name" value={newGrade} onChange={(e) => setNewGrade(e.target.value)} /><Button disabled={!newGrade.trim()} onClick={async () => { await db.from("nf_grades").insert({ name: newGrade.trim(), display_order: data.grades.length + 1 }); setNewGrade(""); refresh(); }}>Add grade</Button></div>
      </CardContent></Card>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle className="text-base">Buyers</CardTitle></CardHeader><CardContent className="space-y-2">
          {data.buyers.map((b: any) => <div key={b.id} className="flex items-center gap-2"><Input defaultValue={b.name} onBlur={(e) => e.target.value !== b.name && upd("nf_buyers", b.id, { name: e.target.value })} /><Switch checked={b.is_active} onCheckedChange={(v) => upd("nf_buyers", b.id, { is_active: v })} /></div>)}
          <div className="flex gap-2"><Input placeholder="New buyer" value={newBuyer} onChange={(e) => setNewBuyer(e.target.value)} /><Button disabled={!newBuyer.trim()} onClick={async () => { await db.from("nf_buyers").insert({ name: newBuyer.trim() }); setNewBuyer(""); refresh(); }}>Add</Button></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Yard users</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
          <p>Yard staff sign in to the phone app with the same username and PIN as the Banksman app. Add or change them in <a className="text-primary underline" href="/route-one">RouteOne → Setup → Yard staff</a>.</p>
          <p>Office access follows normal staff portal accounts (Admin → Users).</p>
          <p>Phone app link: <span className="font-mono">{window.location.origin}/metals-yard</span> — open on the phone and choose "Add to Home Screen".</p>
        </CardContent></Card>
      </div>
    </div>
  );
}

function Audit({ data }: any) {
  return (
    <Card><CardContent className="p-0 max-h-[700px] overflow-auto">
      <Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Record</TableHead><TableHead>Field</TableHead><TableHead>Original</TableHead><TableHead>Corrected</TableHead><TableHead>Reason</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.amendments.map((a: any) => <TableRow key={a.id}><TableCell>{new Date(a.created_at).toLocaleString("en-GB")}</TableCell><TableCell>{({ nf_collections: "Collection", nf_sort_entries: "Sorting entry", nf_grades: "Grade" } as any)[a.table_name] ?? a.table_name}</TableCell><TableCell>{a.field === "is_voided" ? "Removed" : a.field}</TableCell><TableCell>{a.old_value}</TableCell><TableCell>{a.new_value}</TableCell><TableCell>{a.reason}</TableCell><TableCell>{a.amended_by_name}</TableCell></TableRow>)}
          {data.adjustments.map((a: any) => <TableRow key={a.id}><TableCell>{new Date(a.created_at).toLocaleString("en-GB")}</TableCell><TableCell>Stock adjustment</TableCell><TableCell>kg</TableCell><TableCell>—</TableCell><TableCell>{a.adjustment_kg}</TableCell><TableCell>{a.reason}</TableCell><TableCell>{a.authorised_name}</TableCell></TableRow>)}
        </TableBody></Table>
    </CardContent></Card>
  );
}
