import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, PenLine, CheckCircle2, Loader2, Truck } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/SignaturePad";
import clewsLogo from "@/assets/clews-logo.png";
import * as XLSX from "xlsx";
import {
  WASTE_TYPE_LABELS,
  RECYCLABLE_WASTE_TYPES,
  NON_RECYCLABLE_WASTE_TYPES,
  WOOD_TYPE,
  type StaciWasteBreakdown,
  type StaciPalletColour,
  STACI_COLOUR_CONFIG,
} from "@/components/load-reports/staci/types";

interface SignedReport {
  id: string;
  period_start: string;
  period_end: string;
  signer_name: string | null;
  signer_position: string | null;
  signed_at: string | null;
  report_data: any;
}

interface DashboardStats {
  colourMap: Record<string, { count: number; weightKg: number; cost: number }>;
  totalPallets: number;
  totalWeightKg: number;
  totalCost: number;
  goodPallets: number;
  scrapPallets: number;
  palletRebate: number;
  netCost: number;
  wasteRows: Array<{
    key: string;
    label: string;
    kg: number;
    tonnes: number;
    pct: number;
    recyclable: boolean;
    nonRecoverable: boolean;
    wasteForEnergy?: boolean;
    landfill?: boolean;
    wood: boolean;
  }>;
  totalBreakdownWeight: number;
  recyclableKg: number;
  nonRecoverableKg: number;
  wasteForEnergyKg?: number;
  landfillKg?: number;
  woodKg: number;
}

interface DashboardHaulage {
  artic: { loads: number; totalCost: number; rate: number };
  pickup: { loads: number; totalCost: number; rate: number };
  totalLoads: number;
  totalCost: number;
}

interface Props {
  customerId?: string;
  customerName?: string;
  isPortalView?: boolean;
  /** Dashboard-computed stats - used for admin preview & snapshot */
  dashboardStats?: DashboardStats;
  /** Dashboard haulage data */
  dashboardHaulage?: DashboardHaulage;
  /** Total weight of bales, dolavs, scrap metal loose (kg) */
  balesDolavTotalWeightKg?: number;
  /** Pre-computed Monthly Net Cost from dashboard */
  monthlyNetCost?: number;
  /** Pre-computed Monthly Recycling Invoice from dashboard */
  monthlyRecyclingInvoice?: number;
  /** Dashboard date range */
  dateFrom?: Date;
  dateTo?: Date;
  /** Whether dashboard is still loading */
  dashboardLoading?: boolean;
}

export function StaciMonthlyReport({
  customerId,
  customerName,
  isPortalView = false,
  dashboardStats,
  dashboardHaulage,
  balesDolavTotalWeightKg = 0,
  monthlyNetCost = 0,
  monthlyRecyclingInvoice = 0,
  dateFrom,
  dateTo,
  dashboardLoading = false,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [signedReports, setSignedReports] = useState<SignedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

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

  const stats = dashboardStats;
  const haulageData = dashboardHaulage ?? { artic: { loads: 0, totalCost: 0, rate: 0 }, pickup: { loads: 0, totalCost: 0, rate: 0 }, totalLoads: 0, totalCost: 0 };
  const fromDate = dateFrom ?? new Date();
  const toDate = dateTo ?? new Date();

  const buildReportData = () => {
    if (!stats) return null;
    return {
      period: { from: format(fromDate, "yyyy-MM-dd"), to: format(toDate, "yyyy-MM-dd") },
      totalPallets: stats.totalPallets,
      totalWeightKg: Math.round(stats.totalWeightKg + balesDolavTotalWeightKg),
      grossCost: +stats.totalCost.toFixed(2),
      palletRebate: +stats.palletRebate.toFixed(2),
      netCost: +stats.netCost.toFixed(2),
      goodPallets: stats.goodPallets,
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
        category: w.recyclable ? "Recyclable" : w.landfill ? "Landfill" : w.wood ? "Wood" : "Waste For Energy",
      })),
      recyclablePct: stats.totalBreakdownWeight > 0 ? +((stats.recyclableKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0,
      wasteForEnergyPct: stats.totalBreakdownWeight > 0 ? +(((stats.wasteForEnergyKg ?? stats.nonRecoverableKg) / stats.totalBreakdownWeight) * 100).toFixed(1) : 0,
      landfillPct: stats.totalBreakdownWeight > 0 ? +(((stats.landfillKg ?? 0) / stats.totalBreakdownWeight) * 100).toFixed(1) : 0,
      woodPct: stats.totalBreakdownWeight > 0 ? +((stats.woodKg / stats.totalBreakdownWeight) * 100).toFixed(1) : 0,
      haulage: {
        loads: haulageData.totalLoads,
        ratePerLoad: haulageData.totalLoads > 0 ? +(haulageData.totalCost / haulageData.totalLoads).toFixed(2) : 0,
        totalCost: +haulageData.totalCost.toFixed(2),
        artic: { loads: haulageData.artic.loads, rate: +haulageData.artic.rate.toFixed(2), totalCost: +haulageData.artic.totalCost.toFixed(2) },
        pickup: { loads: haulageData.pickup.loads, rate: +haulageData.pickup.rate.toFixed(2), totalCost: +haulageData.pickup.totalCost.toFixed(2) },
      },
    };
  };

  const handleSign = async (signatureData: string) => {
    if (!signerName.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    setSigning(true);

    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId) {
      // Find Staci customer
      const { data: custData } = await supabase
        .from("customers")
        .select("id")
        .ilike("customer_name", "%staci%")
        .maybeSingle();
      resolvedCustomerId = custData?.id;
    }

    if (!resolvedCustomerId) {
      toast({ title: "Could not determine customer", variant: "destructive" });
      setSigning(false);
      return;
    }

    const reportData = buildReportData();
    if (!reportData) {
      toast({ title: "No data to sign", variant: "destructive" });
      setSigning(false);
      return;
    }

    const { error } = await supabase.from("staci_monthly_reports").insert({
      customer_id: resolvedCustomerId,
      period_start: format(fromDate, "yyyy-MM-dd"),
      period_end: format(toDate, "yyyy-MM-dd"),
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
      ["Total Loads", rd.haulage?.loads ?? 0],
      ["Total Haulage Cost (£)", rd.haulage?.totalCost ?? 0],
    ];
    if (rd.haulage?.artic?.loads > 0) {
      summaryData.push(["Artic Loads", rd.haulage.artic.loads]);
      summaryData.push(["Artic Rate (£)", rd.haulage.artic.rate]);
      summaryData.push(["Artic Total (£)", rd.haulage.artic.totalCost]);
    }
    if (rd.haulage?.pickup?.loads > 0) {
      summaryData.push(["Pickup/Dolav Loads", rd.haulage.pickup.loads]);
      summaryData.push(["Pickup/Dolav Rate (£)", rd.haulage.pickup.rate]);
      summaryData.push(["Pickup/Dolav Total (£)", rd.haulage.pickup.totalCost]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");

    const palletData = [
      ["Colour", "Pallets", "Weight (kg)", "Cost (£)"],
      ...(rd.colourBreakdown ?? []).map((c: any) => [c.colour, c.pallets, c.weightKg, c.cost]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(palletData), "Pallet Breakdown");

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
      ["Waste For Energy", "", "", `${rd.wasteForEnergyPct ?? rd.nonRecoverablePct}%`],
      ["Landfill", "", "", `${rd.landfillPct ?? 0}%`],
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

  const hasData = stats && stats.totalPallets > 0;

  // ADMIN VIEW: preview using dashboard stats, sign & manage reports
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
        {/* Period label from dashboard */}
        <p className="text-sm font-medium text-muted-foreground">
          Period: {format(fromDate, "dd MMM yyyy")} – {format(toDate, "dd MMM yyyy")}
        </p>

        {dashboardLoading && <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>}

        {/* Preview stats from dashboard */}
        {hasData && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Pallets", value: stats.totalPallets.toLocaleString() },
                { label: "Weight", value: `${((stats.totalWeightKg + balesDolavTotalWeightKg) / 1000).toFixed(2)} t` },
                { label: "Monthly Net Cost", value: `£${monthlyNetCost.toFixed(2)}` },
                { label: "Monthly Recycling Invoice", value: `£${monthlyRecyclingInvoice.toFixed(2)}` },
                { label: "Haulage", value: haulageData.totalLoads > 0 ? `${haulageData.totalLoads} loads` : "—" },
              ].map((k) => (
                <div key={k.label} className="text-center p-3 border rounded-lg">
                  <p className="text-lg font-bold">{k.value}</p>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Haulage detail */}
            {haulageData.totalLoads > 0 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-500/5">
                <Truck className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">
                    Haulage: {haulageData.totalLoads} loads
                    {haulageData.totalLoads > 0 && ` @ £${(haulageData.totalCost / haulageData.totalLoads).toFixed(2)} avg`}
                  </p>
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
                  {stats.totalBreakdownWeight > 0 ? (((stats.wasteForEnergyKg ?? stats.nonRecoverableKg) / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Waste For Energy</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <p className="text-lg font-bold text-red-600">
                  {stats.totalBreakdownWeight > 0 ? (((stats.landfillKg ?? 0) / stats.totalBreakdownWeight) * 100).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Landfill</p>
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

        {!hasData && !dashboardLoading && (
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
