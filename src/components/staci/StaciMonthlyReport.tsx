import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Download, PenLine, CheckCircle2, Loader2, Truck } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/SignaturePad";
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

const TARE_KG = 20;

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

interface SignedReport {
  id: string;
  period_start: string;
  period_end: string;
  signer_name: string | null;
  signer_position: string | null;
  signed_at: string | null;
  report_data: any;
}

interface Props {
  customerId?: string;
  customerName?: string;
  isPortalView?: boolean;
}

export function StaciMonthlyReport({ customerId, customerName, isPortalView = false }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [rows, setRows] = useState<PalletRow[]>([]);
  const [dolavData, setDolavData] = useState<{ papersWeightKg: number; glassWeightKg: number }>({ papersWeightKg: 0, glassWeightKg: 0 });
  const [fetching, setFetching] = useState(false);
  const [signedReports, setSignedReports] = useState<SignedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [haulageData, setHaulageData] = useState<{ loads: number; totalCost: number; ratePerLoad: number }>({ loads: 0, totalCost: 0, ratePerLoad: 0 });

  // Signing state (admin only)
  const [showSignature, setShowSignature] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerPosition, setSignerPosition] = useState("");
  const [signing, setSigning] = useState(false);

  // Load signed reports
  useEffect(() => {
    if (!user) return;
    const loadSignedReports = async () => {
      setLoadingReports(true);
      let query = supabase
        .from("staci_monthly_reports")
        .select("id, period_start, period_end, signer_name, signer_position, signed_at, report_data")
        .order("period_start", { ascending: false });

      if (customerId) {
        query = query.eq("customer_id", customerId);
      }

      const { data } = await query;
      setSignedReports((data as SignedReport[]) ?? []);
      setLoadingReports(false);
    };
    loadSignedReports();
  }, [user, customerId]);

  // Load pallet data for preview (admin only)
  useEffect(() => {
    if (isPortalView || !user) return;
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

      // Aggregate dolav data from load_reports
      const reportIds = [...new Set(mapped.map((r) => r.load_report_id))];
      if (reportIds.length > 0) {
        const { data: reportData } = await supabase
          .from("load_reports")
          .select("papers_dolav_weight_kg, glass_dolav_weight_kg")
          .in("id", reportIds);
        
        let papersTotal = 0;
        let glassTotal = 0;
        (reportData ?? []).forEach((r: any) => {
          papersTotal += Number(r.papers_dolav_weight_kg) || 0;
          glassTotal += Number(r.glass_dolav_weight_kg) || 0;
        });
        setDolavData({ papersWeightKg: papersTotal, glassWeightKg: glassTotal });
      } else {
        setDolavData({ papersWeightKg: 0, glassWeightKg: 0 });
      }

      const { data: haulageJobs } = await supabase
        .from("data_hub_jobs")
        .select("job_number, raw")
        .ilike("customer", "%staci%")
        .eq("source", "skiptrak")
        .gte("job_date", from)
        .lte("job_date", to);

      if (haulageJobs && haulageJobs.length > 0) {
        let totalHaulageCost = 0;
        haulageJobs.forEach((j: any) => {
          const cost = parseFloat(j.raw?.Cost ?? j.raw?.cost ?? "0");
          if (!isNaN(cost)) totalHaulageCost += cost;
        });
        const avgRate = haulageJobs.length > 0 ? totalHaulageCost / haulageJobs.length : 0;
        setHaulageData({ loads: haulageJobs.length, totalCost: totalHaulageCost, ratePerLoad: avgRate });
      } else {
        setHaulageData({ loads: 0, totalCost: 0, ratePerLoad: 0 });
      }

      setFetching(false);
    };
    fetchData();
  }, [user, dateFrom, dateTo, isPortalView]);

  // Compute stats
  const stats = useMemo(() => {
    const colourMap: Record<string, { count: number; weightKg: number; cost: number }> = {};
    let totalPallets = 0;
    let totalWeightKg = 0;
    let totalCost = 0;
    let goodPallets = 0;

    rows.forEach((r) => {
      const count = r.pallet_count;
      const netWeight = Math.max(0, r.weight_kg - TARE_KG * count);
      const rate = STACI_PALLET_RATES[r.colour] ?? 0;
      const isWasteWood = r.colour === "waste_wood";
      const lineCost = isWasteWood ? (netWeight / 1000) * rate * count : rate * count;

      if (!colourMap[r.colour]) colourMap[r.colour] = { count: 0, weightKg: 0, cost: 0 };
      colourMap[r.colour].count += count;
      colourMap[r.colour].weightKg += netWeight * count;
      colourMap[r.colour].cost += lineCost;

      totalPallets += count;
      totalWeightKg += netWeight * count;
      totalCost += lineCost;
      if (r.pallet_type === "good") goodPallets += count;
    });

    const palletRebate = goodPallets * STACI_PALLET_GOOD_REBATE;
    const netCost = totalCost - palletRebate;

    // Waste breakdown
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

    // Add dolav weights to waste aggregation
    if (dolavData.papersWeightKg > 0) {
      wasteAgg["paper"] = (wasteAgg["paper"] ?? 0) + dolavData.papersWeightKg;
      totalBreakdownWeight += dolavData.papersWeightKg;
    }
    if (dolavData.glassWeightKg > 0) {
      wasteAgg["glass"] = (wasteAgg["glass"] ?? 0) + dolavData.glassWeightKg;
      totalBreakdownWeight += dolavData.glassWeightKg;
    }

    const wasteRows = Object.entries(wasteAgg)
      .filter(([, kg]) => kg > 0)
      .map(([key, kg]) => ({
        key,
        label: WASTE_TYPE_LABELS[key as keyof StaciWasteBreakdown] ?? (key === "glass" ? "Glass" : key),
        kg,
        tonnes: kg / 1000,
        pct: totalBreakdownWeight > 0 ? (kg / totalBreakdownWeight) * 100 : 0,
        recyclable: RECYCLABLE_WASTE_TYPES.includes(key as any) || key === "glass",
        nonRecoverable: NON_RECYCLABLE_WASTE_TYPES.includes(key as any),
        wood: key === WOOD_TYPE,
      }))
      .sort((a, b) => b.kg - a.kg);

    const recyclableKg = wasteRows.filter((w) => w.recyclable).reduce((s, w) => s + w.kg, 0);
    const nonRecoverableKg = wasteRows.filter((w) => w.nonRecoverable).reduce((s, w) => s + w.kg, 0);
    const woodKg = wasteRows.filter((w) => w.wood).reduce((s, w) => s + w.kg, 0);

    return { colourMap, totalPallets, totalWeightKg, totalCost, goodPallets, palletRebate, netCost, wasteRows, totalBreakdownWeight, recyclableKg, nonRecoverableKg, woodKg };
  }, [rows, dolavData]);

  const buildReportData = () => ({
    period: { from: format(dateFrom, "yyyy-MM-dd"), to: format(dateTo, "yyyy-MM-dd") },
    totalPallets: stats.totalPallets,
    totalWeightKg: Math.round(stats.totalWeightKg),
    grossCost: +stats.totalCost.toFixed(2),
    palletRebate: +stats.palletRebate.toFixed(2),
    netCost: +stats.netCost.toFixed(2),
    colourBreakdown: Object.entries(stats.colourMap).map(([colour, d]) => ({
      colour: STACI_COLOUR_CONFIG[colour as StaciPalletColour]?.label ?? colour,
      pallets: d.count,
      weightKg: Math.round(d.weightKg),
      cost: +d.cost.toFixed(2),
    })),
    wasteBreakdown: stats.wasteRows.map((w) => ({
      material: w.label,
      kg: Math.round(w.kg),
      tonnes: +w.tonnes.toFixed(2),
      pct: +w.pct.toFixed(1),
      category: w.recyclable ? "Recyclable" : w.wood ? "Wood" : "Non-Recoverable",
    })),
    recyclablePct: stats.totalBreakdownWeight > 0 ? +((stats.recyclableKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0,
    nonRecoverablePct: stats.totalBreakdownWeight > 0 ? +((stats.nonRecoverableKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0,
    woodPct: stats.totalBreakdownWeight > 0 ? +((stats.woodKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0,
    haulage: {
      loads: haulageData.loads,
      ratePerLoad: +haulageData.ratePerLoad.toFixed(2),
      totalCost: +haulageData.totalCost.toFixed(2),
    },
  });

  const handleSign = async (signatureData: string) => {
    if (!signerName.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    setSigning(true);

    // Determine customer - use first customer from data or provided customerId
    const cId = customerId || rows[0]?.customer_name;
    // We need a valid customer_id UUID. Let's find it from the data.
    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId) {
      // Find from customers table by name
      const customerNameFromData = rows[0]?.customer_name;
      if (customerNameFromData) {
        const { data: custData } = await supabase
          .from("customers")
          .select("id")
          .eq("customer_name", customerNameFromData)
          .maybeSingle();
        resolvedCustomerId = custData?.id;
      }
    }

    if (!resolvedCustomerId) {
      toast({ title: "Could not determine customer", variant: "destructive" });
      setSigning(false);
      return;
    }

    const reportData = buildReportData();

    const { error } = await supabase.from("staci_monthly_reports").insert({
      customer_id: resolvedCustomerId,
      period_start: format(dateFrom, "yyyy-MM-dd"),
      period_end: format(dateTo, "yyyy-MM-dd"),
      report_data: reportData,
      signed_by: user?.id,
      signer_name: signerName.trim(),
      signer_position: signerPosition.trim() || null,
      signature_image: signatureData,
      signed_at: new Date().toISOString(),
    });

    if (error) {
      toast({ title: "Error saving report", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Report signed & saved" });
      setShowSignature(false);
      setSignerName("");
      setSignerPosition("");
      // Refresh list
      const { data: updated } = await supabase
        .from("staci_monthly_reports")
        .select("id, period_start, period_end, signer_name, signer_position, signed_at, report_data")
        .order("period_start", { ascending: false })
        .limit(20);
      setSignedReports((updated as SignedReport[]) ?? []);
    }
    setSigning(false);
  };

  const exportSignedReport = (report: SignedReport) => {
    const rd = report.report_data;
    const wb = XLSX.utils.book_new();

    // Summary tab
    const summaryData = [
      ["STACI Monthly Recycling Report"],
      ["Prepared by Clews Recycling Limited"],
      [],
      ["Period", `${format(new Date(report.period_start), "dd/MM/yyyy")} – ${format(new Date(report.period_end), "dd/MM/yyyy")}`],
      ["Signed By", report.signer_name ?? ""],
      ["Position", report.signer_position ?? ""],
      ["Date Signed", report.signed_at ? format(new Date(report.signed_at), "dd/MM/yyyy HH:mm") : ""],
      [],
      ["Metric", "Value"],
      ["Total Pallets", rd.totalPallets],
      ["Total Weight (kg)", rd.totalWeightKg],
      ["Total Weight (t)", (rd.totalWeightKg / 1000).toFixed(2)],
      ["Gross Cost (£)", rd.grossCost],
      ["Pallet Rebate (£)", rd.palletRebate],
      ["Net Cost (£)", rd.netCost],
      [],
      ["Haulage"],
      ["Loads", rd.haulage?.loads ?? 0],
      ["Rate per Load (£)", rd.haulage?.ratePerLoad ?? 0],
      ["Total Haulage Cost (£)", rd.haulage?.totalCost ?? 0],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

    // Pallet breakdown tab
    const palletData = [
      ["Colour", "Pallets", "Weight (kg)", "Cost (£)"],
      ...(rd.colourBreakdown ?? []).map((c: any) => [c.colour, c.pallets, c.weightKg, c.cost]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(palletData), "Pallet Breakdown");

    // Recycling report tab
    const recyclingData = [
      ["STACI Recycling Report – Verified"],
      ["Period", `${format(new Date(report.period_start), "dd/MM/yyyy")} – ${format(new Date(report.period_end), "dd/MM/yyyy")}`],
      ["Signed By", `${report.signer_name}${report.signer_position ? ` (${report.signer_position})` : ""}`],
      [],
      ["Waste Type", "Weight (kg)", "Weight (t)", "% of Total", "Category"],
      ...(rd.wasteBreakdown ?? []).map((w: any) => [w.material, w.kg, w.tonnes, `${w.pct}%`, w.category]),
      [],
      ["Category Summary", "", "", ""],
      ["Recyclable", "", "", `${rd.recyclablePct}%`],
      ["Non-Recoverable", "", "", `${rd.nonRecoverablePct}%`],
      ["Wood", "", "", `${rd.woodPct}%`],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recyclingData), "Recycling Report");

    XLSX.writeFile(wb, `STACI_Verified_Report_${report.period_start}_${report.period_end}.xlsx`);
    toast({ title: "Report downloaded" });
  };

  // PORTAL VIEW: only show list of signed reports to download
  if (isPortalView) {
    return (
      <div className="space-y-4">
        {loadingReports ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
          </div>
        ) : signedReports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No verified monthly reports available yet.
          </div>
        ) : (
          <div className="space-y-3">
            {signedReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">
                      {format(new Date(report.period_start), "dd MMM yyyy")} – {format(new Date(report.period_end), "dd MMM yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Signed by {report.signer_name}{report.signer_position ? ` (${report.signer_position})` : ""} 
                      {report.signed_at && ` on ${format(new Date(report.signed_at), "dd/MM/yyyy")}`}
                    </p>
                    {report.report_data?.haulage?.loads > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Haulage: {report.report_data.haulage.loads} loads @ £{report.report_data.haulage.ratePerLoad} = £{report.report_data.haulage.totalCost}
                      </p>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => exportSignedReport(report)} className="gap-2">
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ADMIN VIEW: generate, preview, sign & manage reports
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PenLine className="h-5 w-5" />
          Monthly Report (Requires Signature)
        </CardTitle>
        <CardDescription>
          Generate a verified report for the period. This requires your signature as a Clews staff member before it can be downloaded by customers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date pickers */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(dateFrom, "dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm")}>
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(dateTo, "dd MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          {fetching && <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>}
        </div>

        {/* Preview stats */}
        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Pallets", value: stats.totalPallets.toLocaleString() },
                { label: "Weight", value: `${(stats.totalWeightKg / 1000).toFixed(2)} t` },
                { label: "Gross", value: `£${stats.totalCost.toFixed(2)}` },
                { label: "Net", value: `£${stats.netCost.toFixed(2)}` },
                { label: "Haulage", value: haulageData.loads > 0 ? `${haulageData.loads} loads` : "—" },
              ].map((k) => (
                <div key={k.label} className="text-center p-3 border rounded-lg">
                  <p className="text-lg font-bold">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Haulage detail */}
            {haulageData.loads > 0 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-500/5">
                <Truck className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Haulage: {haulageData.loads} loads @ £{haulageData.ratePerLoad.toFixed(2)} each</p>
                  <p className="text-xs text-muted-foreground">Total: £{haulageData.totalCost.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Recycling summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <p className="text-lg font-bold text-green-600">
                  {stats.totalBreakdownWeight > 0 ? ((stats.recyclableKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Recyclable</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <p className="text-lg font-bold text-red-600">
                  {stats.totalBreakdownWeight > 0 ? ((stats.nonRecoverableKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Non-Recoverable</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10">
                <p className="text-lg font-bold text-amber-600">
                  {stats.totalBreakdownWeight > 0 ? ((stats.woodKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Wood</p>
              </div>
            </div>

            {/* Sign section */}
            {!showSignature ? (
              <Button onClick={() => setShowSignature(true)} className="gap-2">
                <PenLine className="h-4 w-4" /> Sign & Publish Report
              </Button>
            ) : (
              <div className="space-y-4 border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <img src={clewsLogo} alt="Clews" className="h-8 w-auto" />
                  <span className="text-sm font-medium">Staff Verification</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Your Name *</Label>
                    <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="e.g. John Smith" />
                  </div>
                  <div className="space-y-1">
                    <Label>Position</Label>
                    <Input value={signerPosition} onChange={(e) => setSignerPosition(e.target.value)} placeholder="e.g. Operations Manager" />
                  </div>
                </div>
                <SignaturePad
                  onSave={handleSign}
                  onCancel={() => setShowSignature(false)}
                />
                {signing && <p className="text-sm text-muted-foreground animate-pulse">Saving…</p>}
              </div>
            )}
          </div>
        )}

        {rows.length === 0 && !fetching && (
          <p className="text-sm text-muted-foreground text-center py-4">No data for this period.</p>
        )}

        {/* Previously signed reports */}
        {signedReports.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-medium text-sm text-muted-foreground">Signed Reports</h4>
            {signedReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">
                      {format(new Date(report.period_start), "dd MMM yyyy")} – {format(new Date(report.period_end), "dd MMM yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {report.signer_name}{report.signed_at && ` · ${format(new Date(report.signed_at), "dd/MM/yyyy")}`}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-200">Verified</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
