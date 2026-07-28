import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, CalendarRange } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props {
  customerId?: string;
}

interface JobRow {
  job_date: string;
  job_number: string | null;
  waste_description: string | null;
  weight_t: number | null;
  raw: any;
  source: string | null;
  site: string | null;
  customer: string | null;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function categorise(desc: string): "Recyclable" | "Waste For Energy" | "Landfill" | "Wood" {
  const d = (desc || "").toLowerCase();
  if (/landfill/.test(d)) return "Landfill";
  if (/wood|pallet/.test(d)) return "Wood";
  if (/mixed municipal|residual|mmw|general waste|non[- ]?recycl/.test(d)) return "Waste For Energy";
  return "Recyclable";
}

function costOf(raw: any): number {
  if (!raw || typeof raw !== "object") return 0;
  const c = (raw as any).Cost ?? (raw as any).cost ?? (raw as any)["Total Price"] ?? (raw as any)["Total Cost"];
  if (typeof c === "number") return c;
  if (typeof c === "string") return parseFloat(c) || 0;
  return 0;
}

export function StaciYearToDate({ customerId }: Props) {
  const { toast } = useToast();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [customerName, setCustomerName] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      if (!customerId) { setJobs([]); return; }
      setLoading(true);
      try {
        const [{ data: cust }, { data: siteRows }] = await Promise.all([
          supabase.from("customers").select("customer_name").eq("id", customerId).maybeSingle(),
          supabase.from("customer_sites").select("data_hub_customer").eq("customer_id", customerId),
        ]);
        setCustomerName(cust?.customer_name ?? "");
        const aliases = Array.from(new Set([
          cust?.customer_name,
          ...((siteRows ?? []).map((s: any) => s.data_hub_customer)),
        ].filter(Boolean))) as string[];
        if (aliases.length === 0) { setJobs([]); return; }

        const from = `${year}-01-01`;
        const to = `${year}-12-31`;
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, job_number, waste_description, weight_t, raw, source, site, customer")
          .gte("job_date", from)
          .lte("job_date", to)
          .in("customer", aliases)
          .order("job_date", { ascending: true });
        if (error) throw error;
        setJobs((data as JobRow[]) ?? []);
      } catch (e: any) {
        toast({ title: "Error loading YTD", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [year, customerId, toast]);

  const availableYears = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur - 2, cur - 3];
  }, []);

  const agg = useMemo(() => {
    let totalWeightKg = 0;
    let totalCost = 0;
    let totalJobs = jobs.length;

    const wasteMap: Record<string, { kg: number; category: string; loads: number; cost: number }> = {};
    const monthly: Record<string, {
      month: string; monthLabel: string; loads: number; weightKg: number; cost: number;
      recyclableKg: number; wfeKg: number; landfillKg: number; woodKg: number;
    }> = {};

    for (let i = 0; i < 12; i++) {
      const mm = String(i + 1).padStart(2, "0");
      const key = `${year}-${mm}`;
      monthly[key] = { month: key, monthLabel: MONTH_LABELS[i], loads: 0, weightKg: 0, cost: 0, recyclableKg: 0, wfeKg: 0, landfillKg: 0, woodKg: 0 };
    }

    jobs.forEach((j) => {
      const kg = (Number(j.weight_t ?? 0) || 0) * 1000;
      const cost = costOf(j.raw);
      const desc = j.waste_description || "Unspecified";
      const cat = categorise(desc);
      totalWeightKg += kg;
      totalCost += cost;

      if (!wasteMap[desc]) wasteMap[desc] = { kg: 0, category: cat, loads: 0, cost: 0 };
      wasteMap[desc].kg += kg;
      wasteMap[desc].loads += 1;
      wasteMap[desc].cost += cost;

      const key = (j.job_date || "").slice(0, 7);
      if (monthly[key]) {
        const m = monthly[key];
        m.loads += 1;
        m.weightKg += kg;
        m.cost += cost;
        if (cat === "Recyclable") m.recyclableKg += kg;
        else if (cat === "Wood") m.woodKg += kg;
        else if (cat === "Landfill") m.landfillKg += kg;
        else m.wfeKg += kg;
      }
    });

    const totalBreakdownKg = totalWeightKg;
    const recyclableKg = Object.values(wasteMap).filter(w => w.category === "Recyclable").reduce((s, w) => s + w.kg, 0);
    const wfeKg = Object.values(wasteMap).filter(w => w.category === "Waste For Energy").reduce((s, w) => s + w.kg, 0);
    const landfillKg = Object.values(wasteMap).filter(w => w.category === "Landfill").reduce((s, w) => s + w.kg, 0);
    const woodKg = Object.values(wasteMap).filter(w => w.category === "Wood").reduce((s, w) => s + w.kg, 0);

    const monthRows = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));

    return { totalWeightKg, totalCost, totalJobs, wasteMap, totalBreakdownKg, recyclableKg, wfeKg, landfillKg, woodKg, monthRows };
  }, [jobs, year]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const summary = [
      [`STACI Year To Date Report – ${year}`],
      ["Customer", customerName],
      ["Jobs (Data Hub)", agg.totalJobs],
      [],
      ["Metric", "Value"],
      ["Total Weight (kg)", Math.round(agg.totalWeightKg)],
      ["Total Weight (t)", (agg.totalWeightKg / 1000).toFixed(2)],
      ["Total Cost (£)", agg.totalCost.toFixed(2)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "YTD Summary");

    const monthlyRows = [
      ["Month", "Jobs", "Weight (t)", "Cost (£)", "Recyclable (kg)", "Waste For Energy (kg)", "Landfill (kg)", "Wood (kg)"],
      ...agg.monthRows.map((m) => [
        `${m.monthLabel} ${year}`, m.loads, (m.weightKg / 1000).toFixed(2), m.cost.toFixed(2),
        Math.round(m.recyclableKg), Math.round(m.wfeKg), Math.round(m.landfillKg), Math.round(m.woodKg),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyRows), "Monthly Breakdown");

    const waste = [
      ["Waste Type", "Jobs", "Weight (kg)", "Weight (t)", "% of Total", "Cost (£)", "Category"],
      ...Object.entries(agg.wasteMap).sort((a, b) => b[1].kg - a[1].kg).map(([mat, d]) => [
        mat, d.loads, Math.round(d.kg), (d.kg / 1000).toFixed(2),
        agg.totalBreakdownKg > 0 ? ((d.kg / agg.totalBreakdownKg) * 100).toFixed(1) + "%" : "0%",
        d.cost.toFixed(2), d.category,
      ]),
      [],
      ["Category", "Weight (kg)", "%"],
      ["Recyclable", Math.round(agg.recyclableKg), agg.totalBreakdownKg > 0 ? ((agg.recyclableKg / agg.totalBreakdownKg) * 100).toFixed(1) + "%" : "0%"],
      ["Waste For Energy", Math.round(agg.wfeKg), agg.totalBreakdownKg > 0 ? ((agg.wfeKg / agg.totalBreakdownKg) * 100).toFixed(1) + "%" : "0%"],
      ["Landfill", Math.round(agg.landfillKg), agg.totalBreakdownKg > 0 ? ((agg.landfillKg / agg.totalBreakdownKg) * 100).toFixed(1) + "%" : "0%"],
      ["Wood", Math.round(agg.woodKg), agg.totalBreakdownKg > 0 ? ((agg.woodKg / agg.totalBreakdownKg) * 100).toFixed(1) + "%" : "0%"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(waste), "Waste Breakdown");

    XLSX.writeFile(wb, `STACI_YTD_${year}.xlsx`);
    toast({ title: "YTD report exported" });
  };

  const totalPct = (kg: number) => agg.totalBreakdownKg > 0 ? (kg / agg.totalBreakdownKg) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4 flex flex-wrap items-center gap-4">
          <CalendarRange className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Year</span>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${agg.totalJobs} job${agg.totalJobs === 1 ? "" : "s"} from Data Hub`}
          </span>
          <div className="ml-auto">
            <Button variant="outline" onClick={handleExport} disabled={agg.totalJobs === 0} className="gap-2">
              <Download className="h-4 w-4" /> Export YTD
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>
      ) : agg.totalJobs === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No Data Hub jobs found for {customerName || "this customer"} in {year}.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Jobs YTD", value: agg.totalJobs.toLocaleString() },
              { label: "Weight YTD", value: `${(agg.totalWeightKg / 1000).toFixed(2)} t` },
              { label: "Total Cost YTD", value: `£${agg.totalCost.toFixed(2)}`, highlight: true },
              { label: "Avg Weight / Load", value: agg.totalJobs > 0 ? `${(agg.totalWeightKg / agg.totalJobs / 1000).toFixed(2)} t` : "—" },
            ].map((k) => (
              <Card key={k.label}>
                <CardContent className="py-4 text-center">
                  <p className={`text-2xl font-bold ${(k as any).highlight ? "text-primary" : ""}`}>{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-lg font-bold text-green-600">{totalPct(agg.recyclableKg).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Recyclable</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10">
              <p className="text-lg font-bold text-red-600">{totalPct(agg.wfeKg).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Waste For Energy</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10">
              <p className="text-lg font-bold text-red-600">{totalPct(agg.landfillKg).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Landfill</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/10">
              <p className="text-lg font-bold text-amber-600">{totalPct(agg.woodKg).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Wood</p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Trend – Weight & Cost</CardTitle></CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agg.monthRows.map(m => ({ name: m.monthLabel, weight: +(m.weightKg / 1000).toFixed(2), cost: +m.cost.toFixed(2) }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="weight" name="Weight (t)" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="cost" name="Cost (£)" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Month</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Jobs</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Cost (£)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agg.monthRows.map((m) => (
                      <tr key={m.month} className="border-b border-border/50">
                        <td className="py-1.5 px-3 font-medium">{m.monthLabel} {year}</td>
                        <td className="py-1.5 px-3 text-right">{m.loads.toLocaleString()}</td>
                        <td className="py-1.5 px-3 text-right">{(m.weightKg / 1000).toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right">£{m.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 px-3">Total</td>
                      <td className="py-2 px-3 text-right">{agg.totalJobs.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{(agg.totalWeightKg / 1000).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">£{agg.totalCost.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Waste Type Totals</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Waste Type</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Jobs</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">%</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Cost (£)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(agg.wasteMap).sort((a, b) => b[1].kg - a[1].kg).map(([m, d]) => (
                    <tr key={m} className="border-b border-border/50">
                      <td className="py-1.5 px-3">{m}</td>
                      <td className="py-1.5 px-3 text-right">{d.loads}</td>
                      <td className="py-1.5 px-3 text-right">{(d.kg / 1000).toFixed(2)}</td>
                      <td className="py-1.5 px-3 text-right">{totalPct(d.kg).toFixed(1)}%</td>
                      <td className="py-1.5 px-3 text-right">£{d.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2 px-3">Total</td>
                    <td className="py-2 px-3 text-right">{agg.totalJobs}</td>
                    <td className="py-2 px-3 text-right">{(agg.totalBreakdownKg / 1000).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right">100%</td>
                    <td className="py-2 px-3 text-right">£{agg.totalCost.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-3 text-xs text-muted-foreground">
              YTD figures are sourced directly from the Data Hub (all matched jobs for this customer), so totals reconcile with the Site Report.
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
