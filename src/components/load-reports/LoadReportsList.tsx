import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Eye, Pencil, Download, Truck, Filter, Settings, AlertTriangle, FileText, Package, Clock, Wand2, MapPinCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadReportSettings } from "./LoadReportSettings";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getWeighbridgeSource, convertWeightToTonnes } from "@/lib/weighbridge-source";
import { formatLoadReportDate } from "@/lib/load-report-dates";
import { MissingReportsAlert } from "./MissingReportsAlert";
import { CertificateOfDestruction } from "./CertificateOfDestruction";
import { reconcileLineItemsToTargetKg } from "@/lib/reconcile-load-line-items";
import type { LineItem } from "./TallyScreen";

interface LoadReport {
  id: string;
  report_date: string;
  operator_name: string;
  vehicle_reg: string | null;
  total_pallets: number;
  total_weight_kg: number;
  status: string;
  created_at: string;
  notes: string | null;
  site_id?: string | null;
  weighbridge_weight_kg?: number | null;
  site_name?: string | null;
  waste_types?: string[];
  exclude_from_rebate?: boolean;
  pallets_out?: number | null;
  pallets_scrap_count?: number | null;
  last_activity_job?: string | null;
  // Staci-specific extras (rolled into displayed total)
  card_bales_weight_kg?: number | null;
  films_bale_weight_kg?: number | null;
  papers_dolav_weight_kg?: number | null;
  glass_dolav_weight_kg?: number | null;
  scrap_metal_loose_weight_kg?: number | null;
  card_bales_count?: number | null;
  films_bale_count?: number | null;
  papers_dolav_count?: number | null;
  glass_dolav_count?: number | null;
  scrap_metal_loose_count?: number | null;
  card_bales_on_pallets?: boolean | null;
  films_bale_on_pallets?: boolean | null;
  papers_dolav_on_pallets?: boolean | null;
  glass_dolav_on_pallets?: boolean | null;
  scrap_metal_loose_on_pallets?: boolean | null;
}

// Returns the gross weight of the report (matches what hits the weighbridge).
// - Non-Staci: total_weight_kg is already gross (sum of pallet_count × avg_weight_kg).
// - Staci: pallet-entry weights are gross totals, while bale/dolav/loose weights are
//   stored as per-unit gross weights. Good/scrap pallets contribute pallet tare only.
const getDisplayTotalKg = (
  report: LoadReport,
  isStaci: boolean,
  palletWeightKg: number,
) => {
  if (!isStaci) return report.total_weight_kg || 0;

  return (
    (report.total_weight_kg || 0) +
    (report.card_bales_count || 0) * (report.card_bales_weight_kg || 0) +
    (report.films_bale_count || 0) * (report.films_bale_weight_kg || 0) +
    (report.papers_dolav_count || 0) * (report.papers_dolav_weight_kg || 0) +
    (report.glass_dolav_count || 0) * (report.glass_dolav_weight_kg || 0) +
    (report.scrap_metal_loose_count || 0) * (report.scrap_metal_loose_weight_kg || 0) +
    ((report.pallets_out || 0) + (report.pallets_scrap_count || 0)) * (palletWeightKg || 0)
  );
};

interface LoadReportsListProps {
  onNewReport: () => void;
  onViewReport: (id: string) => void;
  onEditReport: (id: string) => void;
  customerType?: "britvic" | "staci" | "vantiva" | "amazon" | "evri" | "other" | null;
}

export const LoadReportsList = ({ onNewReport, onViewReport, onEditReport, customerType }: LoadReportsListProps) => {
  const [reports, setReports] = useState<LoadReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [allReports, setAllReports] = useState(false);
  const [unreconciledOnly, setUnreconciledOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codReport, setCodReport] = useState<LoadReport | null>(null);
  const [codGeneratedIds, setCodGeneratedIds] = useState<Set<string>>(new Set());
  const [defaultPalletWeight, setDefaultPalletWeight] = useState<number>(20);
  const [reconciling, setReconciling] = useState(false);
  const [siteCheckOpen, setSiteCheckOpen] = useState(false);
  const [siteCheckLoading, setSiteCheckLoading] = useState(false);
  const [siteCheckRows, setSiteCheckRows] = useState<
    { id: string; date: string; jobNumber: string; reportSite: string; dataHubSite: string; status: "match" | "mismatch" | "not_found" }[]
  >([]);
  const isStaci = customerType === "staci";
  const isEvri = customerType === "evri";
  const isAmazon = customerType === "amazon";
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("load_report_settings")
        .select("setting_value")
        .eq("setting_key", "default_pallet_weight_kg")
        .maybeSingle();
      if (data?.setting_value != null) {
        setDefaultPalletWeight(Number(data.setting_value) || 20);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchReports(), searchTerm ? 250 : 0);
    return () => clearTimeout(t);
  }, [dateFrom, dateTo, customerType, dateFilterEnabled, searchTerm, allReports]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Get the set of site IDs matching this customer type.
      // For "other" we instead build an EXCLUDE set of site IDs (sites with a specific load_report_type),
      // because the inclusive list can be 1500+ which makes the URL too long → 400 Bad Request.
      let siteIds: string[] = [];
      let excludeSiteIds: string[] = [];

      if (customerType) {
        if (customerType !== "other") {
          const { data: siteData } = await supabase
            .from("customer_sites")
            .select("id")
            .eq("load_report_type", customerType);
          siteIds = siteData?.map((s) => s.id) || [];
        } else {
          // Exclude sites belonging to a non-"other" specific type
          const { data: typedSites } = await supabase
            .from("customer_sites")
            .select("id, load_report_type")
            .not("load_report_type", "is", null)
            .neq("load_report_type", "")
            .neq("load_report_type", "other");
          excludeSiteIds = typedSites?.map((s) => s.id) || [];
        }
      }

      // Build the reports query
      let query = supabase
        .from("load_reports")
        .select("*, customer_sites(site_name), load_line_items(waste_type, pallet_count)")
        .order("created_at", { ascending: false })
        .order("report_date", { ascending: false });

      if (dateFilterEnabled) {
        query = query.gte("report_date", dateFrom).lte("report_date", dateTo);
      } else if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;

        // Also search by customer/site name (lives on the related customer_sites table).
        // Look up matching site IDs first, then include them in the OR clause.
        const { data: matchingSites } = await supabase
          .from("customer_sites")
          .select("id")
          .ilike("site_name", term);
        const matchSiteIds = matchingSites?.map((s) => s.id) || [];

        const orClauses = [
          `notes.ilike.${term}`,
          `operator_name.ilike.${term}`,
          `vehicle_reg.ilike.${term}`,
        ];
        if (matchSiteIds.length > 0) {
          orClauses.push(`site_id.in.(${matchSiteIds.join(",")})`);
        }
        query = query.or(orClauses.join(",")).limit(allReports ? 5000 : 200);
      } else if (allReports) {
        query = query.limit(5000);
      } else {
        query = query.limit(30);
      }

      // Filter by site
      if (customerType && customerType !== "other") {
        if (siteIds.length === 0) {
          setReports([]);
          setLoading(false);
          return;
        }
        query = query.in("site_id", siteIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Client-side filter for "other" — exclude reports tied to typed sites
      let filteredData = data || [];
      if (customerType === "other" && excludeSiteIds.length > 0) {
        const excludeSet = new Set(excludeSiteIds);
        filteredData = filteredData.filter((r: any) => !r.site_id || !excludeSet.has(r.site_id));
      }

      // Fetch weighbridge data for reports with job numbers in notes
      const jobNumbers = filteredData
        .map((r) => r.notes?.trim())
        .filter((n): n is string => !!n);

      let weighbridgeMap: Record<string, number> = {};
      if (jobNumbers.length > 0) {
        const source = getWeighbridgeSource(customerType);
        
        const { data: jobsData } = await supabase
          .from("data_hub_jobs")
          .select("job_number, weight_t")
          .eq("source", source)
          .in("job_number", jobNumbers);

        if (jobsData) {
          weighbridgeMap = jobsData.reduce((acc, job) => {
            const weightInTonnes = convertWeightToTonnes(job.weight_t, source);
            if (weightInTonnes != null) {
              acc[job.job_number] = weightInTonnes * 1000;
            }
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Fetch last activity (most recent job ticket) per site
      const siteNames = [...new Set(filteredData.map((r: any) => r.customer_sites?.site_name).filter(Boolean))];
      let lastActivityMap: Record<string, string> = {};
      if (siteNames.length > 0) {
        const source = getWeighbridgeSource(customerType);
        for (const siteName of siteNames) {
          const { data: latestJob } = await supabase
            .from("data_hub_jobs")
            .select("job_number")
            .eq("source", source)
            .eq("site", siteName)
            .order("job_date", { ascending: false })
            .limit(1);
          if (latestJob && latestJob.length > 0) {
            lastActivityMap[siteName] = latestJob[0].job_number;
          }
        }
      }

      const reportsWithWeighbridge = filteredData.map((report: any) => {
        const wasteTypes = (report.load_line_items || [])
          .filter((li: any) => li.pallet_count > 0)
          .map((li: any) => li.waste_type as string);

        const siteName = report.customer_sites?.site_name ?? null;

        // Evri override: when palletsOut > 0 AND there are cardboard pallets, the
        // load report weight is intentionally higher than the Midweigh weighbridge
        // value (cardboard pallets × 90kg). Do NOT pull/compare the Midweigh upload
        // for these — the load report is the source of truth and should not be
        // re-flagged as needing reconciliation each time new Midweigh data lands.
        const isEvriOverride =
          customerType === "evri" &&
          (report.pallets_out ?? 0) > 0 &&
          wasteTypes.some((wt: string) => wt.toLowerCase().includes("card"));

        return {
          ...report,
          weighbridge_weight_kg: isEvriOverride
            ? null
            : report.notes?.trim()
              ? weighbridgeMap[report.notes.trim()] ?? null
              : null,
          site_name: siteName,
          waste_types: wasteTypes,
          last_activity_job: siteName ? lastActivityMap[siteName] ?? null : null,
        };
      });

      setReports(reportsWithWeighbridge);
    } catch (error: any) {
      toast({
        title: "Error loading reports",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Evri fallback: when no weighbridge weight, target = pallets × 90KG
  const getReconcileTargetKg = (report: LoadReport): number | null => {
    if (report.weighbridge_weight_kg != null && report.weighbridge_weight_kg > 0) {
      return report.weighbridge_weight_kg;
    }
    if (isEvri && (report.total_pallets || 0) > 0) {
      return (report.total_pallets || 0) * 90;
    }
    return null;
  };

  const needsReconciliation = (report: LoadReport) => {
    const target = getReconcileTargetKg(report);
    if (target == null || target <= 0) return false;
    const difference = Math.abs(getDisplayTotalKg(report, isStaci, defaultPalletWeight) - target);
    const percentOut = (difference / target) * 100;
    return percentOut > 0.5; // 0.5% tolerance
  };

  const filteredReports = reports.filter((report) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (report.site_name?.toLowerCase().includes(searchLower) ?? false) ||
      (report.notes?.toLowerCase().includes(searchLower) ?? false) ||
      (report.vehicle_reg?.toLowerCase().includes(searchLower) ?? false) ||
      (report.id.toLowerCase().includes(searchLower) ?? false);
    if (!matchesSearch) return false;
    if (unreconciledOnly && !needsReconciliation(report)) return false;
    return true;
  });

  const exportCSV = () => {
    const headers = ["Date", "Site", "Job Number", "Vehicle", "Waste Types", "Pallets", "Weight (KG)", "Status"];
    const rows = filteredReports.map((r) => [
      formatLoadReportDate(r.report_date, "dd/MM/yyyy"),
      r.site_name || "",
      r.notes || "",
      r.vehicle_reg || "",
      (r.waste_types || []).join("; "),
      r.total_pallets.toString(),
      getDisplayTotalKg(r, isStaci, defaultPalletWeight).toString(),
      r.status,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `load-reports-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkAutoReconcile = async (ids: string[]) => {
    if (ids.length === 0) return;
    setReconciling(true);
    let success = 0;
    let failed = 0;
    try {
      for (const id of ids) {
        const report = reports.find((r) => r.id === id);
        const targetKg = report ? getReconcileTargetKg(report) : null;
        if (!report || targetKg == null || targetKg <= 0) {
          failed += 1;
          continue;
        }
        const { data: items, error: itemsErr } = await supabase
          .from("load_line_items")
          .select("*")
          .eq("load_report_id", id)
          .order("display_order");
        if (itemsErr || !items) {
          failed += 1;
          continue;
        }
        const lineItems: LineItem[] = items.map((it: any) => ({
          waste_type: it.waste_type,
          pallet_count: it.pallet_count,
          avg_weight_kg: Number(it.avg_weight_kg) || 0,
          total_weight_kg: Number(it.total_weight_kg) || 0,
          display_order: it.display_order,
          pallet_weight_kg: Number(it.pallet_weight_kg) || 0,
          wet_charge_applied: it.wet_charge_applied,
        }));
        const { reconciled, reconciledTotalKg } = reconcileLineItemsToTargetKg(
          lineItems,
          targetKg,
        );
        let rowErr = false;
        for (let idx = 0; idx < reconciled.length; idx++) {
          const r = reconciled[idx];
          const rowId = items[idx].id;
          const { error: updErr } = await supabase
            .from("load_line_items")
            .update({
              avg_weight_kg: r.avg_weight_kg,
              total_weight_kg: r.total_weight_kg,
            })
            .eq("id", rowId);
          if (updErr) {
            rowErr = true;
            break;
          }
        }
        if (rowErr) {
          failed += 1;
          continue;
        }
        const { error: repErr } = await supabase
          .from("load_reports")
          .update({ total_weight_kg: reconciledTotalKg })
          .eq("id", id);
        if (repErr) {
          failed += 1;
          continue;
        }
        // Optimistically reflect the reconciled weight in the list right away
        setReports((prev) =>
          prev.map((r: any) =>
            r.id === id ? { ...r, total_weight_kg: reconciledTotalKg } : r,
          ),
        );
        success += 1;
      }

      toast({
        title: "Auto Reconcile complete",
        description: `${success} reconciled${failed > 0 ? `, ${failed} failed` : ""}.`,
        variant: failed > 0 ? "destructive" : "default",
      });
      await fetchReports();
    } finally {
      setReconciling(false);
    }
  };

  const normalizeSite = (s: string) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const runSiteCheck = async () => {
    setSiteCheckOpen(true);
    setSiteCheckLoading(true);
    setSiteCheckRows([]);
    try {
      const candidates = filteredReports.filter((r) => r.notes?.trim());
      const jobNumbers = [...new Set(candidates.map((r) => r.notes!.trim()))];
      const source = getWeighbridgeSource(customerType);

      let jobSiteMap: Record<string, string> = {};
      if (jobNumbers.length > 0) {
        const { data: jobs } = await supabase
          .from("data_hub_jobs")
          .select("job_number, site")
          .eq("source", source)
          .in("job_number", jobNumbers);
        (jobs || []).forEach((j: any) => {
          if (j.site) jobSiteMap[j.job_number] = j.site;
        });
      }

      // Aliases for each report site so mapped Data Hub names count as a match
      const siteIds = [...new Set(candidates.map((r: any) => r.site_id).filter(Boolean))] as string[];
      const aliasMap: Record<string, string[]> = {};
      if (siteIds.length > 0) {
        const { data: sites } = await supabase
          .from("customer_sites")
          .select("id, site_name, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5")
          .in("id", siteIds);
        (sites || []).forEach((s: any) => {
          aliasMap[s.id] = [
            s.site_name,
            s.data_hub_site,
            s.data_hub_site_2,
            s.data_hub_site_3,
            s.data_hub_site_4,
            s.data_hub_site_5,
          ]
            .filter(Boolean)
            .map((v: string) => normalizeSite(v));
        });
      }

      const rows = candidates.map((r: any) => {
        const job = r.notes.trim();
        const dhSite = jobSiteMap[job] || "";
        const aliases = aliasMap[r.site_id] || (r.site_name ? [normalizeSite(r.site_name)] : []);
        const status: "match" | "mismatch" | "not_found" = !dhSite
          ? "not_found"
          : aliases.some((a) => a === normalizeSite(dhSite) || a.includes(normalizeSite(dhSite)) || normalizeSite(dhSite).includes(a))
            ? "match"
            : "mismatch";
        return {
          id: r.id,
          date: formatLoadReportDate(r.report_date, "dd/MM/yyyy"),
          jobNumber: job,
          reportSite: r.site_name || "Unassigned",
          dataHubSite: dhSite || "—",
          status,
        };
      });

      // Problems first
      const order = { mismatch: 0, not_found: 1, match: 2 } as const;
      rows.sort((a, b) => order[a.status] - order[b.status]);
      setSiteCheckRows(rows);
    } catch (error: any) {
      toast({ title: "Site check failed", description: error.message, variant: "destructive" });
    } finally {
      setSiteCheckLoading(false);
    }
  };

  const getStatusBadge = (status: string, report: LoadReport) => {
    const showReconciliation = needsReconciliation(report);
    const palletsOut = report.pallets_out ?? 0;

    return (
      <div className="flex items-center gap-1.5 justify-center">
        {showReconciliation && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Weight mismatch - needs reconciliation</p>
                <p className="text-xs text-muted-foreground">
                  Report: {(getDisplayTotalKg(report, isStaci, defaultPalletWeight) / 1000).toFixed(2)}t, 
                  Weighbridge: {((report.weighbridge_weight_kg ?? 0) / 1000).toFixed(2)}t
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {palletsOut > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Package className="h-4 w-4 text-amber-600" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{palletsOut} pallet{palletsOut === 1 ? "" : "s"} out</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {status === "submitted" ? (
          <Badge className="bg-green-500">Submitted</Badge>
        ) : status === "draft" ? (
          <Badge variant="secondary">Draft</Badge>
        ) : (
          <Badge variant="outline">{status}</Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Settings Dialog */}
      <LoadReportSettings open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onNewReport} size="lg" className="gap-2 h-12">
          <Plus className="h-5 w-5" />
          New Load Report
        </Button>
        <Button variant="outline" onClick={exportCSV} className="gap-2 h-12">
          <Download className="h-5 w-5" />
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => setSettingsOpen(true)} className="gap-2 h-12">
          <Settings className="h-5 w-5" />
          Settings
        </Button>
      </div>

      {/* Missing Reports Alert */}
      <MissingReportsAlert customerType={customerType ?? null} />

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by site, job number, vehicle or report ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="unreconciledToggle"
              checked={unreconciledOnly}
              onChange={(e) => setUnreconciledOnly(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="unreconciledToggle" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
              Show only unreconciled reports
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dateFilterToggle"
              checked={dateFilterEnabled}
              onChange={(e) => {
                setDateFilterEnabled(e.target.checked);
                if (e.target.checked) setAllReports(false);
              }}
              className="rounded border-input"
            />
            <label htmlFor="dateFilterToggle" className="text-sm text-muted-foreground cursor-pointer">
              Filter by date range
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allReportsToggle"
              checked={allReports}
              onChange={(e) => {
                setAllReports(e.target.checked);
                if (e.target.checked) setDateFilterEnabled(false);
              }}
              className="rounded border-input"
            />
            <label htmlFor="allReportsToggle" className="text-sm text-muted-foreground cursor-pointer">
              All Reports (search entire history)
            </label>
          </div>
          {dateFilterEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          )}
          {!dateFilterEnabled && !allReports && (
            <p className="text-xs text-muted-foreground">Showing last 30 reports</p>
          )}
          {allReports && (
            <p className="text-xs text-muted-foreground">Searching all reports — use the search box above to filter</p>
          )}
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Loading reports...</p>
          </CardContent>
        ) : filteredReports.length === 0 ? (
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No load reports found</p>
            <Button onClick={onNewReport} variant="link" className="mt-2">
              Create your first report
            </Button>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="hidden sm:table-cell">Job Number</TableHead>
                  <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                  <TableHead className="hidden lg:table-cell">Waste Type</TableHead>
                  <TableHead className="text-center">Pallets</TableHead>
                  <TableHead className="text-right">Weight (KG)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {isEvri && (
                    <TableHead className="text-center">Auto Reconcile</TableHead>
                  )}
                  <TableHead className="hidden xl:table-cell">Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      <div>{formatLoadReportDate(report.report_date, "dd/MM/yyyy")}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(report.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5" title={report.id}>
                        {report.id.slice(0, 8)}
                      </div>
                    </TableCell>
                    <TableCell>{report.site_name || "-"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {report.notes || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {report.vehicle_reg || "-"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {report.waste_types && report.waste_types.length > 0
                        ? report.waste_types.join(", ")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {report.total_pallets}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <div>{getDisplayTotalKg(report, isStaci, defaultPalletWeight).toLocaleString()}</div>
                      {report.weighbridge_weight_kg != null && (
                        <div className="text-xs font-normal text-muted-foreground">
                          Net: {report.weighbridge_weight_kg.toLocaleString()} kg
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(report.status, report)}
                    </TableCell>
                    {isEvri && (
                      <TableCell className="text-center">
                        {needsReconciliation(report) ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 gap-1"
                            disabled={reconciling}
                            onClick={() => handleBulkAutoReconcile([report.id])}
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                            Reconcile
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {report.last_activity_job || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCodReport(report)}
                              className={`mr-1 ${codGeneratedIds.has(report.id) ? "text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700" : ""}`}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Certificate of Destruction</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditReport(report.id)}
                        className="mr-1"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewReport(report.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Certificate of Destruction Dialog */}
      <CertificateOfDestruction
        open={!!codReport}
        onOpenChange={(open) => !open && setCodReport(null)}
        reportDate={codReport?.report_date ?? ""}
        totalWeightKg={codReport?.total_weight_kg ?? 0}
        totalPallets={codReport?.total_pallets ?? 0}
        reportId={codReport?.id ?? ""}
        jobNumber={codReport?.notes ?? undefined}
        customerName={codReport?.site_name ?? undefined}
        onGenerated={() => {
          if (codReport) {
            setCodGeneratedIds(prev => new Set(prev).add(codReport.id));
          }
        }}
      />
    </div>
  );
};