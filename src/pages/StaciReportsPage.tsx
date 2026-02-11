import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, CalendarIcon, Download, Package } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";
import * as XLSX from "xlsx";
import {
  STACI_PALLET_RATES,
  STACI_PALLET_GOOD_REBATE,
  WASTE_TYPE_LABELS,
  RECYCLABLE_WASTE_TYPES,
  NON_RECYCLABLE_WASTE_TYPES,
  WOOD_TYPE,
  type StaciWasteBreakdown,
  type StaciPalletColour,
  STACI_COLOUR_CONFIG,
} from "@/components/load-reports/staci/types";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { StaciMonthlyReport } from "@/components/staci/StaciMonthlyReport";

/* ── helpers ─────────────────────────────────────────── */

const TARE_KG = 20; // per‑pallet tare

interface PalletRow {
  id: string;
  colour: StaciPalletColour;
  weight_kg: number;
  pallet_type: string;
  pallet_count: number;
  description: string | null;
  waste_breakdown: StaciWasteBreakdown | null;
  load_report_id: string;
  report_date: string;
  site_name: string | null;
  customer_name: string | null;
}

/* ── page ─────────────────────────────────────────────── */

const StaciReportsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [rows, setRows] = useState<PalletRow[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  /* ── fetch data ── */
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setFetching(true);
      const from = format(dateFrom, "yyyy-MM-dd");
      const to = format(dateTo, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("staci_pallet_entries")
        .select("id, colour, weight_kg, pallet_type, pallet_count, description, waste_breakdown, load_report_id, load_reports!inner(report_date, status, customer_sites(site_name, customers(customer_name)))")
        .gte("load_reports.report_date", from)
        .lte("load_reports.report_date", to)
        .eq("load_reports.status", "submitted");

      if (error) {
        console.error(error);
        toast({ title: "Error loading data", description: error.message, variant: "destructive" });
        setFetching(false);
        return;
      }

      const mapped: PalletRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        colour: r.colour,
        weight_kg: r.weight_kg,
        pallet_type: r.pallet_type ?? "good",
        pallet_count: r.pallet_count ?? 1,
        description: r.description,
        waste_breakdown: r.waste_breakdown as StaciWasteBreakdown | null,
        load_report_id: r.load_report_id,
        report_date: r.load_reports?.report_date ?? "",
        site_name: r.load_reports?.customer_sites?.site_name ?? null,
        customer_name: r.load_reports?.customer_sites?.customers?.customer_name ?? null,
      }));

      setRows(mapped);
      setFetching(false);
    };
    fetchData();
  }, [user, dateFrom, dateTo]);

  /* ── computed stats ── */
  const stats = useMemo(() => {
    // colour summary
    const colourMap: Record<string, { count: number; weightKg: number; cost: number }> = {};
    let totalPallets = 0;
    let totalWeightKg = 0;
    let totalCost = 0;
    let goodPallets = 0;
    let scrapPallets = 0;

    rows.forEach((r) => {
      const count = r.pallet_count;
      const netWeight = Math.max(0, r.weight_kg - TARE_KG * count);
      const rate = STACI_PALLET_RATES[r.colour] ?? 0;
      const isWasteWood = r.colour === "waste_wood";
      const lineCost = isWasteWood
        ? (netWeight / 1000) * rate * count
        : rate * count;

      if (!colourMap[r.colour]) colourMap[r.colour] = { count: 0, weightKg: 0, cost: 0 };
      colourMap[r.colour].count += count;
      colourMap[r.colour].weightKg += netWeight * count;
      colourMap[r.colour].cost += lineCost;

      totalPallets += count;
      totalWeightKg += netWeight * count;
      totalCost += lineCost;

      if (r.pallet_type === "good") goodPallets += count;
      else scrapPallets += count;
    });

    const palletRebate = goodPallets * STACI_PALLET_GOOD_REBATE;
    const netCost = totalCost - palletRebate;

    // waste breakdown
    const wasteAgg: Record<string, number> = {};
    let totalBreakdownWeight = 0;

    rows.forEach((r) => {
      if (!r.waste_breakdown) return;
      const netWeight = Math.max(0, r.weight_kg - TARE_KG * r.pallet_count);
      const entryWeight = netWeight * r.pallet_count;
      (Object.keys(r.waste_breakdown) as (keyof StaciWasteBreakdown)[]).forEach((key) => {
        const pct = (r.waste_breakdown as StaciWasteBreakdown)[key] ?? 0;
        const kg = (pct / 100) * entryWeight;
        wasteAgg[key] = (wasteAgg[key] ?? 0) + kg;
        totalBreakdownWeight += kg;
      });
    });

    const wasteRows = Object.entries(wasteAgg)
      .filter(([, kg]) => kg > 0)
      .map(([key, kg]) => ({
        key: key as keyof StaciWasteBreakdown,
        label: WASTE_TYPE_LABELS[key as keyof StaciWasteBreakdown] ?? key,
        kg,
        tonnes: kg / 1000,
        pct: totalBreakdownWeight > 0 ? (kg / totalBreakdownWeight) * 100 : 0,
        recyclable: RECYCLABLE_WASTE_TYPES.includes(key as any),
        nonRecoverable: NON_RECYCLABLE_WASTE_TYPES.includes(key as any),
        wood: key === WOOD_TYPE,
      }))
      .sort((a, b) => b.kg - a.kg);

    const recyclableKg = wasteRows.filter((w) => w.recyclable).reduce((s, w) => s + w.kg, 0);
    const nonRecoverableKg = wasteRows.filter((w) => w.nonRecoverable).reduce((s, w) => s + w.kg, 0);
    const woodKg = wasteRows.filter((w) => w.wood).reduce((s, w) => s + w.kg, 0);

    return {
      colourMap,
      totalPallets,
      totalWeightKg,
      totalCost,
      goodPallets,
      scrapPallets,
      palletRebate,
      netCost,
      wasteRows,
      totalBreakdownWeight,
      recyclableKg,
      nonRecoverableKg,
      woodKg,
    };
  }, [rows]);

  /* ── export ── */
  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    // Tab 1: Period Summary
    const summaryData = [
      ["STACI Recycling Report"],
      ["Period", `${format(dateFrom, "dd/MM/yyyy")} – ${format(dateTo, "dd/MM/yyyy")}`],
      ["Generated", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Metric", "Value"],
      ["Total Pallets", stats.totalPallets],
      ["Total Weight (kg)", Math.round(stats.totalWeightKg)],
      ["Total Weight (t)", (stats.totalWeightKg / 1000).toFixed(2)],
      ["Good Pallets", stats.goodPallets],
      ["Scrap Pallets", stats.scrapPallets],
      ["Gross Cost (£)", stats.totalCost.toFixed(2)],
      ["Pallet Rebate (£)", stats.palletRebate.toFixed(2)],
      ["Net Cost (£)", stats.netCost.toFixed(2)],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");

    // Tab 2: Colour Breakdown
    const colourData = [
      ["Colour", "Pallets", "Weight (kg)", "Rate", "Cost (£)"],
      ...Object.entries(stats.colourMap).map(([colour, d]) => [
        STACI_COLOUR_CONFIG[colour as StaciPalletColour]?.label ?? colour,
        d.count,
        Math.round(d.weightKg),
        `£${STACI_PALLET_RATES[colour as StaciPalletColour]?.toFixed(2) ?? "0.00"}`,
        d.cost.toFixed(2),
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(colourData);
    XLSX.utils.book_append_sheet(wb, ws2, "Pallet Breakdown");

    // Tab 3: Recycling Report
    const recyclingData = [
      ["STACI Recycling Report"],
      ["Period", `${format(dateFrom, "dd/MM/yyyy")} – ${format(dateTo, "dd/MM/yyyy")}`],
      [],
      ["Waste Type", "Weight (kg)", "Weight (t)", "% of Total", "Category"],
      ...stats.wasteRows.map((w) => [
        w.label,
        Math.round(w.kg),
        w.tonnes.toFixed(2),
        w.pct.toFixed(1) + "%",
        w.recyclable ? "Recyclable" : w.wood ? "Wood" : "Non-Recoverable",
      ]),
      [],
      ["Category", "Weight (kg)", "% of Total"],
      ["Recyclable", Math.round(stats.recyclableKg), stats.totalBreakdownWeight > 0 ? ((stats.recyclableKg / stats.totalBreakdownWeight) * 100).toFixed(1) + "%" : "0%"],
      ["Non-Recoverable", Math.round(stats.nonRecoverableKg), stats.totalBreakdownWeight > 0 ? ((stats.nonRecoverableKg / stats.totalBreakdownWeight) * 100).toFixed(1) + "%" : "0%"],
      ["Wood", Math.round(stats.woodKg), stats.totalBreakdownWeight > 0 ? ((stats.woodKg / stats.totalBreakdownWeight) * 100).toFixed(1) + "%" : "0%"],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(recyclingData);
    XLSX.utils.book_append_sheet(wb, ws3, "Recycling Report");

    // Tab 4: Raw data
    const rawData = [
      ["Date", "Site", "Customer", "Description", "Colour", "Pallet Count", "Weight (kg)", "Type"],
      ...rows.map((r) => [
        r.report_date,
        r.site_name ?? "",
        r.customer_name ?? "",
        r.description ?? "",
        STACI_COLOUR_CONFIG[r.colour]?.label ?? r.colour,
        r.pallet_count,
        r.weight_kg,
        r.pallet_type,
      ]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws4, "Raw Data");

    XLSX.writeFile(wb, `STACI_Report_${format(dateFrom, "yyyyMMdd")}_${format(dateTo, "yyyyMMdd")}.xlsx`);
    toast({ title: "Report exported" });
  };

  /* ── chart data ── */
  const pieData = useMemo(() => {
    const recyclablePct = stats.totalBreakdownWeight > 0 ? (stats.recyclableKg / stats.totalBreakdownWeight) * 100 : 0;
    const nonRecoverablePct = stats.totalBreakdownWeight > 0 ? (stats.nonRecoverableKg / stats.totalBreakdownWeight) * 100 : 0;
    const woodPct = stats.totalBreakdownWeight > 0 ? (stats.woodKg / stats.totalBreakdownWeight) * 100 : 0;
    return [
      { name: "Recyclable", value: +recyclablePct.toFixed(1), fill: "hsl(142, 71%, 45%)" },
      { name: "Non-Recoverable", value: +nonRecoverablePct.toFixed(1), fill: "hsl(0, 72%, 51%)" },
      { name: "Wood", value: +woodPct.toFixed(1), fill: "hsl(30, 60%, 45%)" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const colourBarData = useMemo(() => {
    return Object.entries(stats.colourMap).map(([colour, d]) => ({
      name: STACI_COLOUR_CONFIG[colour as StaciPalletColour]?.label ?? colour,
      pallets: d.count,
      cost: +d.cost.toFixed(2),
      fill: colour === "red" ? "hsl(0, 72%, 51%)" : colour === "yellow" ? "hsl(48, 96%, 53%)" : colour === "blue" ? "hsl(217, 91%, 60%)" : colour === "green" ? "hsl(142, 71%, 45%)" : "hsl(30, 60%, 45%)",
    }));
  }, [stats]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/portal">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Package className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">STACI Reports</h1>
              <p className="text-muted-foreground">Pallet costs & recycling breakdown</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={rows.length === 0} className="gap-2">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>

        {/* Date range */}
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Period:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateFrom, "dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateTo, "dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {fetching && <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>}
          </CardContent>
        </Card>

        {rows.length === 0 && !fetching ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No submitted STACI load reports found for this period.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Pallets", value: stats.totalPallets.toLocaleString() },
                { label: "Total Weight", value: `${(stats.totalWeightKg / 1000).toFixed(2)} t` },
                { label: "Gross Cost", value: `£${stats.totalCost.toFixed(2)}` },
                { label: "Net Cost", value: `£${stats.netCost.toFixed(2)}` },
              ].map((kpi) => (
                <Card key={kpi.label}>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pallet colour breakdown table + bar chart */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Pallet Colour Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Colour</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pallets</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rate</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Cost (£)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.colourMap).map(([colour, d]) => (
                          <tr key={colour} className="border-b border-border/50">
                            <td className="py-1.5 px-3 flex items-center gap-2">
                              <span className={cn("w-3 h-3 rounded-full", STACI_COLOUR_CONFIG[colour as StaciPalletColour]?.bgColor)} />
                              {STACI_COLOUR_CONFIG[colour as StaciPalletColour]?.label ?? colour}
                            </td>
                            <td className="py-1.5 px-3 text-right">{d.count}</td>
                            <td className="py-1.5 px-3 text-right">{(d.weightKg / 1000).toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right">£{STACI_PALLET_RATES[colour as StaciPalletColour]?.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right font-medium">{d.cost >= 0 ? `£${d.cost.toFixed(2)}` : `-£${Math.abs(d.cost).toFixed(2)}`}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-semibold">
                          <td className="py-2 px-3">Total</td>
                          <td className="py-2 px-3 text-right">{stats.totalPallets}</td>
                          <td className="py-2 px-3 text-right">{(stats.totalWeightKg / 1000).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right" />
                          <td className="py-2 px-3 text-right">£{stats.totalCost.toFixed(2)}</td>
                        </tr>
                        <tr className="text-green-600">
                          <td className="py-1 px-3" colSpan={4}>Pallet Rebate ({stats.goodPallets} × £{STACI_PALLET_GOOD_REBATE.toFixed(2)})</td>
                          <td className="py-1 px-3 text-right font-medium">-£{stats.palletRebate.toFixed(2)}</td>
                        </tr>
                        <tr className="font-bold text-lg">
                          <td className="py-2 px-3" colSpan={4}>Net Cost</td>
                          <td className="py-2 px-3 text-right">£{stats.netCost.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Cost by Colour</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={colourBarData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip formatter={(v: number) => [`£${v.toFixed(2)}`, "Cost"]} />
                      <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                        {colourBarData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Waste breakdown */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Waste Type Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Material</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">%</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.wasteRows.map((w) => (
                          <tr key={w.key} className="border-b border-border/50">
                            <td className="py-1.5 px-3">{w.label}</td>
                            <td className="py-1.5 px-3 text-right">{w.tonnes.toFixed(2)}</td>
                            <td className="py-1.5 px-3 text-right">{w.pct.toFixed(1)}%</td>
                            <td className="py-1.5 px-3">
                              <span className={cn("text-xs px-2 py-0.5 rounded-full", w.recyclable ? "bg-green-100 text-green-700" : w.wood ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                                {w.recyclable ? "Recyclable" : w.wood ? "Wood" : "Non-Recoverable"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-semibold">
                          <td className="py-2 px-3">Total</td>
                          <td className="py-2 px-3 text-right">{(stats.totalBreakdownWeight / 1000).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">100%</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Summary row */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-green-500/10">
                      <p className="text-lg font-bold text-green-600">{stats.totalBreakdownWeight > 0 ? ((stats.recyclableKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%</p>
                      <p className="text-xs text-muted-foreground">Recyclable</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-500/10">
                      <p className="text-lg font-bold text-red-600">{stats.totalBreakdownWeight > 0 ? ((stats.nonRecoverableKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%</p>
                      <p className="text-xs text-muted-foreground">Non-Recoverable</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-500/10">
                      <p className="text-lg font-bold text-amber-600">{stats.totalBreakdownWeight > 0 ? ((stats.woodKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%</p>
                      <p className="text-xs text-muted-foreground">Wood</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recyclable vs Non-Recoverable</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px]">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={60} label={({ name, value }) => `${name}: ${value}%`}>
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v}%`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">No waste breakdown data</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Monthly Report Section */}
        <StaciMonthlyReport />

        {/* Clews branding footer */}
        <div className="flex items-center justify-center gap-3 py-6 opacity-50">
          <img src={clewsLogo} alt="Clews Recycling" className="h-6 w-auto" />
          <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Clews Recycling</span>
        </div>
      </main>
    </div>
  );
};

export default StaciReportsPage;
