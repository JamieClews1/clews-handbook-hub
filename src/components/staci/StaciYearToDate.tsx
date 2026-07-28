import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, CalendarRange } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  customerId?: string;
}

interface SignedReport {
  id: string;
  period_start: string;
  period_end: string;
  report_data: any;
  signer_name: string | null;
  signed_at: string | null;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function StaciYearToDate({ customerId }: Props) {
  const { toast } = useToast();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<SignedReport[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const from = `${year}-01-01`;
      const to = `${year}-12-31`;
      let q = supabase
        .from("staci_monthly_reports")
        .select("id, period_start, period_end, report_data, signer_name, signed_at")
        .gte("period_start", from)
        .lte("period_start", to)
        .order("period_start", { ascending: true });
      if (customerId) q = q.eq("customer_id", customerId);
      const { data, error } = await q;
      if (error) toast({ title: "Error loading YTD", description: error.message, variant: "destructive" });
      setReports((data as SignedReport[]) ?? []);
      setLoading(false);
    };
    load();
  }, [year, customerId, toast]);

  const availableYears = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur, cur - 1, cur - 2, cur - 3];
  }, []);

  // Aggregate everything
  const agg = useMemo(() => {
    let totalPallets = 0;
    let totalWeightKg = 0;
    let grossCost = 0;
    let palletRebate = 0;
    let netCost = 0;
    let goodPallets = 0;

    let haulageLoads = 0;
    let haulageCost = 0;
    let articLoads = 0, articCost = 0;
    let pickupLoads = 0, pickupCost = 0;

    const colourMap: Record<string, { pallets: number; weightKg: number; cost: number }> = {};
    const wasteMap: Record<string, { kg: number; category: string }> = {};

    // per-month rows
    const monthly: Record<string, {
      month: string; monthLabel: string; pallets: number; weightKg: number; grossCost: number;
      palletRebate: number; netCost: number; haulageCost: number; haulageLoads: number;
      recyclableKg: number; wfeKg: number; landfillKg: number; woodKg: number;
    }> = {};

    reports.forEach((r) => {
      const d = r.report_data ?? {};
      totalPallets += Number(d.totalPallets ?? 0);
      totalWeightKg += Number(d.totalWeightKg ?? 0);
      grossCost += Number(d.grossCost ?? 0);
      palletRebate += Number(d.palletRebate ?? 0);
      netCost += Number(d.netCost ?? 0);
      goodPallets += Number(d.goodPallets ?? 0);

      const h = d.haulage ?? {};
      haulageLoads += Number(h.loads ?? 0);
      haulageCost += Number(h.totalCost ?? 0);
      articLoads += Number(h.artic?.loads ?? 0);
      articCost += Number(h.artic?.totalCost ?? 0);
      pickupLoads += Number(h.pickup?.loads ?? 0);
      pickupCost += Number(h.pickup?.totalCost ?? 0);

      (d.colourBreakdown ?? []).forEach((c: any) => {
        const k = c.colour ?? "Unknown";
        if (!colourMap[k]) colourMap[k] = { pallets: 0, weightKg: 0, cost: 0 };
        colourMap[k].pallets += Number(c.pallets ?? 0);
        colourMap[k].weightKg += Number(c.weightKg ?? 0);
        colourMap[k].cost += Number(c.cost ?? 0);
      });

      let recyclableKg = 0, wfeKg = 0, landfillKg = 0, woodKg = 0;
      (d.wasteBreakdown ?? []).forEach((w: any) => {
        const k = w.material ?? "Unknown";
        const cat = w.category ?? "";
        const kg = Number(w.kg ?? 0);
        if (!wasteMap[k]) wasteMap[k] = { kg: 0, category: cat };
        wasteMap[k].kg += kg;
        if (cat === "Recyclable") recyclableKg += kg;
        else if (cat === "Wood") woodKg += kg;
        else if (cat === "Landfill") landfillKg += kg;
        else wfeKg += kg;
      });

      const dateKey = r.period_start.slice(0, 7); // yyyy-mm
      const monthIdx = Number(dateKey.slice(5, 7)) - 1;
      const label = MONTH_LABELS[monthIdx] ?? dateKey;
      if (!monthly[dateKey]) {
        monthly[dateKey] = {
          month: dateKey, monthLabel: label, pallets: 0, weightKg: 0, grossCost: 0,
          palletRebate: 0, netCost: 0, haulageCost: 0, haulageLoads: 0,
          recyclableKg: 0, wfeKg: 0, landfillKg: 0, woodKg: 0,
        };
      }
      const m = monthly[dateKey];
      m.pallets += Number(d.totalPallets ?? 0);
      m.weightKg += Number(d.totalWeightKg ?? 0);
      m.grossCost += Number(d.grossCost ?? 0);
      m.palletRebate += Number(d.palletRebate ?? 0);
      m.netCost += Number(d.netCost ?? 0);
      m.haulageCost += Number(h.totalCost ?? 0);
      m.haulageLoads += Number(h.loads ?? 0);
      m.recyclableKg += recyclableKg;
      m.wfeKg += wfeKg;
      m.landfillKg += landfillKg;
      m.woodKg += woodKg;
    });

    const totalBreakdownKg = Object.values(wasteMap).reduce((s, w) => s + w.kg, 0);
    const recyclableKg = Object.values(wasteMap).filter(w => w.category === "Recyclable").reduce((s, w) => s + w.kg, 0);
    const wfeKg = Object.values(wasteMap).filter(w => w.category !== "Recyclable" && w.category !== "Landfill" && w.category !== "Wood").reduce((s, w) => s + w.kg, 0);
    const landfillKg = Object.values(wasteMap).filter(w => w.category === "Landfill").reduce((s, w) => s + w.kg, 0);
    const woodKg = Object.values(wasteMap).filter(w => w.category === "Wood").reduce((s, w) => s + w.kg, 0);

    // Ensure every month Jan–Dec is present
    for (let i = 0; i < 12; i++) {
      const mm = String(i + 1).padStart(2, "0");
      const key = `${year}-${mm}`;
      if (!monthly[key]) {
        monthly[key] = {
          month: key, monthLabel: MONTH_LABELS[i], pallets: 0, weightKg: 0, grossCost: 0,
          palletRebate: 0, netCost: 0, haulageCost: 0, haulageLoads: 0,
          recyclableKg: 0, wfeKg: 0, landfillKg: 0, woodKg: 0,
        };
      }
    }
    const monthRows = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalPallets, totalWeightKg, grossCost, palletRebate, netCost, goodPallets,
      haulageLoads, haulageCost, articLoads, articCost, pickupLoads, pickupCost,
      colourMap, wasteMap, totalBreakdownKg, recyclableKg, wfeKg, landfillKg, woodKg,
      monthRows,
    };
  }, [reports]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const summary = [
      [`STACI Year To Date Report – ${year}`],
      ["Signed reports included", reports.length],
      [],
      ["Metric", "Value"],
      ["Total Pallets", agg.totalPallets],
      ["Good Pallets", agg.goodPallets],
      ["Total Weight (kg)", Math.round(agg.totalWeightKg)],
      ["Total Weight (t)", (agg.totalWeightKg / 1000).toFixed(2)],
      ["Gross Cost (£)", agg.grossCost.toFixed(2)],
      ["Pallet Rebate (£)", agg.palletRebate.toFixed(2)],
      ["Net Cost (£)", agg.netCost.toFixed(2)],
      [],
      ["Haulage Loads", agg.haulageLoads],
      ["Haulage Cost (£)", agg.haulageCost.toFixed(2)],
      ["Artic Loads", agg.articLoads],
      ["Artic Cost (£)", agg.articCost.toFixed(2)],
      ["Pickup/Dolav Loads", agg.pickupLoads],
      ["Pickup/Dolav Cost (£)", agg.pickupCost.toFixed(2)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "YTD Summary");

    const monthlyRows = [
      ["Month", "Pallets", "Weight (t)", "Gross Cost (£)", "Rebate (£)", "Net Cost (£)", "Haulage Loads", "Haulage Cost (£)", "Recyclable (kg)", "Waste For Energy (kg)", "Landfill (kg)", "Wood (kg)"],
      ...agg.monthRows.map((m) => [
        `${m.monthLabel} ${year}`, m.pallets, (m.weightKg / 1000).toFixed(2), m.grossCost.toFixed(2),
        m.palletRebate.toFixed(2), m.netCost.toFixed(2), m.haulageLoads, m.haulageCost.toFixed(2),
        Math.round(m.recyclableKg), Math.round(m.wfeKg), Math.round(m.landfillKg), Math.round(m.woodKg),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyRows), "Monthly Breakdown");

    const colours = [
      ["Colour", "Pallets", "Weight (kg)", "Cost (£)"],
      ...Object.entries(agg.colourMap).map(([c, d]) => [c, d.pallets, Math.round(d.weightKg), d.cost.toFixed(2)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(colours), "Pallet Colours");

    const waste = [
      ["Material", "Weight (kg)", "Weight (t)", "% of Total", "Category"],
      ...Object.entries(agg.wasteMap).sort((a, b) => b[1].kg - a[1].kg).map(([mat, d]) => [
        mat, Math.round(d.kg), (d.kg / 1000).toFixed(2),
        agg.totalBreakdownKg > 0 ? ((d.kg / agg.totalBreakdownKg) * 100).toFixed(1) + "%" : "0%",
        d.category,
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
            {loading ? "Loading…" : `${reports.length} signed monthly report${reports.length === 1 ? "" : "s"}`}
          </span>
          <div className="ml-auto">
            <Button variant="outline" onClick={handleExport} disabled={reports.length === 0} className="gap-2">
              <Download className="h-4 w-4" /> Export YTD
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</CardContent></Card>
      ) : reports.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No signed monthly reports for {year}. Sign monthly reports to build up the year-to-date view.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Pallets YTD", value: agg.totalPallets.toLocaleString() },
              { label: "Weight YTD", value: `${(agg.totalWeightKg / 1000).toFixed(2)} t` },
              { label: "Net Cost YTD", value: `£${agg.netCost.toFixed(2)}`, highlight: true },
              { label: "Pallet Rebate YTD", value: `£${agg.palletRebate.toFixed(2)}` },
              { label: "Haulage YTD", value: agg.haulageLoads > 0 ? `${agg.haulageLoads} loads · £${agg.haulageCost.toFixed(0)}` : "—" },
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
            <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Trend – Weight & Net Cost</CardTitle></CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agg.monthRows.map(m => ({ name: m.monthLabel, weight: +(m.weightKg / 1000).toFixed(2), netCost: +m.netCost.toFixed(2) }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="weight" name="Weight (t)" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="netCost" name="Net Cost (£)" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
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
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pallets</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Gross (£)</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rebate (£)</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Net (£)</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Haulage (£)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agg.monthRows.map((m) => (
                      <tr key={m.month} className="border-b border-border/50">
                        <td className="py-1.5 px-3 font-medium">{m.monthLabel} {year}</td>
                        <td className="py-1.5 px-3 text-right">{m.pallets.toLocaleString()}</td>
                        <td className="py-1.5 px-3 text-right">{(m.weightKg / 1000).toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right">£{m.grossCost.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right text-green-600">-£{m.palletRebate.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right font-medium">£{m.netCost.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right">{m.haulageLoads > 0 ? `£${m.haulageCost.toFixed(2)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 px-3">Total</td>
                      <td className="py-2 px-3 text-right">{agg.totalPallets.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{(agg.totalWeightKg / 1000).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">£{agg.grossCost.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-green-600">-£{agg.palletRebate.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">£{agg.netCost.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">£{agg.haulageCost.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Pallet Colour Totals</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Colour</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pallets</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Cost (£)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agg.colourMap).map(([c, d]) => (
                      <tr key={c} className="border-b border-border/50">
                        <td className="py-1.5 px-3">{c}</td>
                        <td className="py-1.5 px-3 text-right">{d.pallets}</td>
                        <td className="py-1.5 px-3 text-right">{(d.weightKg / 1000).toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right">£{d.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Waste Type Totals</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Material</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(agg.wasteMap).sort((a, b) => b[1].kg - a[1].kg).map(([m, d]) => (
                      <tr key={m} className="border-b border-border/50">
                        <td className="py-1.5 px-3">{m}</td>
                        <td className="py-1.5 px-3 text-right">{(d.kg / 1000).toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right">{totalPct(d.kg).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 px-3">Total</td>
                      <td className="py-2 px-3 text-right">{(agg.totalBreakdownKg / 1000).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="py-3 text-xs text-muted-foreground">
              YTD figures are collated directly from signed monthly reports. Any period without a signed report is not included.
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
