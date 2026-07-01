import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, FileDown, Loader2, FileSpreadsheet, Filter, Pencil, Save, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { ReportingPeriodSelector } from "./ReportingPeriodSelector";

type Site = {
  id: string;
  site_name: string;
  data_hub_customer: string | null;
  data_hub_site: string | null;
  data_hub_site_2: string | null;
  data_hub_site_3: string | null;
  data_hub_site_4: string | null;
  data_hub_site_5: string | null;
};

type JobRecord = {
  id: string;
  job_date: string;
  job_number: string;
  container_type: string | null;
  ewc: string | null;
  waste_description: string | null;
  weight_t: number | null;
  vehicle_registration: string | null;
  category: string | null;
  movement_type: string | null;
  site: string | null;
  raw: unknown;
  order_number_override: string | null;
};

interface CustomerPortalSiteReportProps {
  customerId: string;
  customerName: string;
  accessibleSiteIds?: string[];
  isBroker?: boolean;
}

export function CustomerPortalSiteReport({ customerId, customerName, accessibleSiteIds, isBroker = false }: CustomerPortalSiteReportProps) {
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [brokerCustomerAliases, setBrokerCustomerAliases] = useState<string[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState(() => sessionStorage.getItem("portal-site-report-siteId") || "");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const saved = sessionStorage.getItem("portal-site-report-dateRange");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          from: parsed.from ? new Date(parsed.from) : undefined,
          to: parsed.to ? new Date(parsed.to) : undefined,
        };
      } catch { /* fall through */ }
    }
    // Default to last 30 days
    const now = new Date();
    return {
      from: subDays(now, 30),
      to: now,
    };
  });

  // Persist selections to sessionStorage
  useEffect(() => {
    if (selectedSiteId) sessionStorage.setItem("portal-site-report-siteId", selectedSiteId);
  }, [selectedSiteId]);

  useEffect(() => {
    if (dateRange?.from || dateRange?.to) {
      sessionStorage.setItem("portal-site-report-dateRange", JSON.stringify({
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      }));
    }
  }, [dateRange]);
  const [loading, setLoading] = useState(false);
  const [jobRecords, setJobRecords] = useState<JobRecord[]>([]);
  const [palletData, setPalletData] = useState<Record<string, { pet: number; cans: number }>>({});
  const [totalPalletsData, setTotalPalletsData] = useState<Record<string, number>>({});
  const [reportGenerated, setReportGenerated] = useState(false);
  const [selectedWasteTypes, setSelectedWasteTypes] = useState<string[]>([]);
  const [autoLoaded, setAutoLoaded] = useState(false);
  
  // PO editing state
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingPOValue, setEditingPOValue] = useState("");
  const [savingPO, setSavingPO] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState<string>("orders@clewsrecycling.co.uk");
  // Batched PO changes awaiting notification
  const [pendingPOChanges, setPendingPOChanges] = useState<
    { jobId: string; siteName: string; jobNumber: string; jobDate: string; oldPONumber: string | null; newPONumber: string }[]
  >([]);
  const [notifyingPO, setNotifyingPO] = useState(false);

  useEffect(() => {
    loadSites();
    loadNotificationEmail();
  }, [customerId, customerName, accessibleSiteIds, isBroker]);

  // Auto-select most active site and generate report on first load
  useEffect(() => {
    if (autoLoaded || sites.length === 0) return;
    // If user already has a saved site selection, use that
    const savedSiteId = sessionStorage.getItem("portal-site-report-siteId");
    if (savedSiteId && sites.some(s => s.id === savedSiteId)) {
      setSelectedSiteId(savedSiteId);
      setAutoLoaded(true);
      return;
    }
    // Otherwise find the most active site by querying recent job counts
    const findMostActiveSite = async () => {
      const now = new Date();
      const thirtyDaysAgo = format(subDays(now, 30), "yyyy-MM-dd");
      const today = format(now, "yyyy-MM-dd");
      
      let bestSiteId = sites[0].id;
      let bestCount = 0;
      
      for (const site of sites) {
        const siteNames = [
          site.data_hub_site,
          site.data_hub_site_2,
          site.data_hub_site_3,
          site.data_hub_site_4,
          site.data_hub_site_5,
        ].filter(Boolean) as string[];

        const customerFilters = site.data_hub_customer
          ? [site.data_hub_customer]
          : [];

        if (siteNames.length === 0 && customerFilters.length === 0) continue;
        
        let query = supabase
          .from("data_hub_jobs")
          .select("id", { count: "exact", head: true })
          .gte("job_date", thirtyDaysAgo)
          .lte("job_date", today);

        if (customerFilters.length > 0) query = query.in("customer", customerFilters);
        if (siteNames.length > 0) query = query.in("site", siteNames);
        
        const { count } = await query;
        if ((count ?? 0) > bestCount) {
          bestCount = count ?? 0;
          bestSiteId = site.id;
        }
      }
      
      setSelectedSiteId(bestSiteId);
      setAutoLoaded(true);
    };
    
    findMostActiveSite();
  }, [sites, autoLoaded, isBroker, brokerCustomerAliases]);

  // Auto-generate report once site is auto-selected
  useEffect(() => {
    if (autoLoaded && selectedSiteId && !reportGenerated && dateRange?.from && dateRange?.to) {
      generateReport();
    }
  }, [autoLoaded, selectedSiteId]);

  const loadSites = async () => {
    if (accessibleSiteIds) {
      if (accessibleSiteIds.length > 0) {
        const { data } = await supabase
          .from("customer_sites")
          .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5")
          .in("id", accessibleSiteIds)
          .order("site_name");

        setBrokerCustomerAliases([]);
        setSites(data ?? []);
        return;
      }

      setBrokerCustomerAliases([]);
      setSites([]);
      return;
    }

    const { data } = await supabase
      .from("customer_sites")
      .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5")
      .eq("customer_id", customerId)
      .order("site_name");

    setBrokerCustomerAliases([]);
    setSites(data ?? []);
  };

  const loadNotificationEmail = async () => {
    const { data } = await supabase
      .from("customers")
      .select("po_notification_email")
      .eq("id", customerId)
      .maybeSingle();
    if (data?.po_notification_email) {
      setNotificationEmail(data.po_notification_email);
    }
  };

  const fetchPalletData = async (jobs: JobRecord[]) => {
    if (!jobs.length) {
      setPalletData({});
      setTotalPalletsData({});
      return;
    }
    const jobNumbers = jobs.map(j => j.job_number).filter(Boolean);
    if (!jobNumbers.length) {
      setPalletData({});
      setTotalPalletsData({});
      return;
    }

    // Load reports store job numbers in the 'notes' field
    const { data: reports } = await supabase
      .from("load_reports")
      .select("id, notes, total_pallets")
      .in("notes", jobNumbers);

    if (!reports || reports.length === 0) {
      setPalletData({});
      setTotalPalletsData({});
      return;
    }

    // Build total pallets map from load reports
    const totalPalletsMap: Record<string, number> = {};
    for (const r of reports) {
      const jobNum = r.notes?.trim();
      if (jobNum && r.total_pallets > 0) {
        totalPalletsMap[jobNum] = (totalPalletsMap[jobNum] || 0) + r.total_pallets;
      }
    }
    setTotalPalletsData(totalPalletsMap);

    const reportIds = reports.map(r => r.id);
    const noteToReportId = new Map(reports.map(r => [r.notes?.trim(), r.id]));

    const { data: lineItems } = await supabase
      .from("load_line_items")
      .select("load_report_id, waste_type, pallet_count")
      .in("load_report_id", reportIds)
      .in("waste_type", ["Pallets of PET", "Pallets of Cans"]);

    const reportIdToJobNumber = new Map<string, string>();
    for (const [note, reportId] of noteToReportId) {
      if (note && reportId) reportIdToJobNumber.set(reportId, note);
    }

    const result: Record<string, { pet: number; cans: number }> = {};
    for (const li of lineItems ?? []) {
      const jobNum = reportIdToJobNumber.get(li.load_report_id);
      if (!jobNum) continue;
      if (!result[jobNum]) result[jobNum] = { pet: 0, cans: 0 };
      if (li.waste_type === "Pallets of PET") result[jobNum].pet += li.pallet_count;
      if (li.waste_type === "Pallets of Cans") result[jobNum].cans += li.pallet_count;
    }
    setPalletData(result);
  };

  const generateReport = async () => {
    if (!selectedSiteId || !dateRange?.from || !dateRange?.to) return;

    setLoading(true);
    setReportGenerated(false);
    setSelectedWasteTypes([]);

    try {
      const site = sites.find((s) => s.id === selectedSiteId);
      if (!site) return;

      const siteNames = [
        site.data_hub_site,
        site.data_hub_site_2,
        site.data_hub_site_3,
        site.data_hub_site_4,
        site.data_hub_site_5,
      ].filter(Boolean) as string[];

      const customerFilters = site.data_hub_customer
        ? [site.data_hub_customer]
        : [];

      if (siteNames.length === 0 && customerFilters.length === 0) {
        setJobRecords([]);
        setReportGenerated(true);
        return;
      }

      const startDate = format(dateRange.from, "yyyy-MM-dd");
      const endDate = format(dateRange.to, "yyyy-MM-dd");

      let query = supabase
        .from("data_hub_jobs")
        .select("id, job_date, job_number, container_type, ewc, waste_description, weight_t, vehicle_registration, category, movement_type, site, raw, order_number_override")
        .gte("job_date", startDate)
        .lte("job_date", endDate)
        .order("job_date", { ascending: true });

      if (customerFilters.length > 0) query = query.in("customer", customerFilters);

      if (siteNames.length > 0) {
        query = query.in("site", siteNames);
      }

      const { data: jobs, error } = await query;

      if (error) throw error;

      setJobRecords(jobs ?? []);
      setReportGenerated(true);

      // Fetch PET/Cans pallet counts from load reports
      await fetchPalletData(jobs ?? []);
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setLoading(false);
    }
  };

  const uniqueWasteTypes = useMemo(() => {
    const types = new Set<string>();
    jobRecords.forEach((job) => {
      if (job.waste_description) types.add(job.waste_description);
    });
    return Array.from(types).sort();
  }, [jobRecords]);

  const filteredJobRecords = useMemo(() => {
    if (selectedWasteTypes.length === 0) return jobRecords;
    return jobRecords.filter((job) => 
      job.waste_description && selectedWasteTypes.includes(job.waste_description)
    );
  }, [jobRecords, selectedWasteTypes]);

  const getRawNumber = (job: JobRecord, key: string): number | null => {
    const rawObj = job.raw && typeof job.raw === "object" && !Array.isArray(job.raw) ? (job.raw as Record<string, unknown>) : null;
    const val = rawObj?.[key];
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const getJobCost = (job: JobRecord): number | null => getRawNumber(job, "Cost");
  const getHaulageCost = (job: JobRecord): number | null => getRawNumber(job, "Haulage Cost");

  const totalWeight = filteredJobRecords.reduce((sum, r) => sum + (r.weight_t || 0), 0);
  const totalCost = filteredJobRecords.reduce((sum, r) => sum + (getJobCost(r) || 0), 0);
  const totalHaulageCost = filteredJobRecords.reduce((sum, r) => sum + (getHaulageCost(r) || 0), 0);
  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  const getOrderNumber = (job: JobRecord): string | null => {
    // Prefer override value if set
    if (job.order_number_override && job.order_number_override.trim()) {
      return job.order_number_override.trim();
    }
    const rawObj = job.raw && typeof job.raw === "object" && !Array.isArray(job.raw) ? (job.raw as Record<string, unknown>) : null;
    const orderNo = rawObj?.["Order No"];
    if (typeof orderNo === "string" && orderNo.trim()) return orderNo.trim();
    if (typeof orderNo === "number") return String(orderNo);
    return null;
  };

  const getOriginalOrderNumber = (job: JobRecord): string | null => {
    const rawObj = job.raw && typeof job.raw === "object" && !Array.isArray(job.raw) ? (job.raw as Record<string, unknown>) : null;
    const orderNo = rawObj?.["Order No"];
    if (typeof orderNo === "string" && orderNo.trim()) return orderNo.trim();
    if (typeof orderNo === "number") return String(orderNo);
    return null;
  };

  const startEditingPO = (job: JobRecord) => {
    setEditingJobId(job.id);
    setEditingPOValue(getOrderNumber(job) || "");
  };

  const cancelEditingPO = () => {
    setEditingJobId(null);
    setEditingPOValue("");
  };

  const savePONumber = async (job: JobRecord) => {
    if (!editingPOValue.trim()) {
      toast({ title: "Error", description: "Please enter a PO number.", variant: "destructive" });
      return;
    }

    setSavingPO(true);
    try {
      const oldPO = getOrderNumber(job);
      const newPO = editingPOValue.trim();

      // Update the database
      const { error: updateError } = await supabase
        .from("data_hub_jobs")
        .update({ order_number_override: newPO })
        .eq("id", job.id);

      if (updateError) throw updateError;

      // Send notification email
      const { error: notifyError } = await supabase.functions.invoke("po-change-notification", {
        body: {
          notificationEmail,
          customerName,
          siteName: selectedSite?.site_name || "",
          jobNumber: job.job_number,
          jobDate: job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "",
          oldPONumber: oldPO,
          newPONumber: newPO,
          changedBy: (await supabase.auth.getUser()).data.user?.email || "Unknown",
        },
      });

      if (notifyError) {
        console.error("Failed to send notification:", notifyError);
        // Don't fail the save if notification fails
      }

      // Update local state
      setJobRecords((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, order_number_override: newPO } : j
        )
      );

      toast({ title: "Saved", description: "PO number updated successfully." });
      setEditingJobId(null);
      setEditingPOValue("");
    } catch (error: any) {
      console.error("Error saving PO number:", error);
      toast({ title: "Error", description: error?.message || "Failed to save PO number.", variant: "destructive" });
    } finally {
      setSavingPO(false);
    }
  };

  const toggleWasteType = (wasteType: string) => {
    setSelectedWasteTypes((prev) =>
      prev.includes(wasteType)
        ? prev.filter((t) => t !== wasteType)
        : [...prev, wasteType]
    );
  };

  const exportToExcel = () => {
    if (!selectedSite || !dateRange?.from || !dateRange?.to) return;

    // Helper to round numbers for Excel (keeps as number type)
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const wb = XLSX.utils.book_new();

    const headerData = [
      ["Site Recycling Report"],
      [],
      ["Customer:", customerName],
      ["Site:", selectedSite.site_name],
      ["Date Range:", `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`],
      ["Generated:", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Total Jobs:", filteredJobRecords.length],
      ["Total Weight (t):", round2(totalWeight)],
      ["Total Cost (£):", round2(totalCost)],
      ["Total Haulage (£):", round2(totalHaulageCost)],
      [],
      [],
    ];

    const hasPallet = Object.keys(palletData).length > 0;
    const hasTotalPallets = Object.keys(totalPalletsData).length > 0;
    const detailHeaders = ["Date", "Order No.", "Job No.", "Movement", "Container", "EWC", "Waste Type", "Vehicle", "Weight (t)", "Cost (£)", "Haulage (£)", ...(hasTotalPallets ? ["Pallets"] : []), ...(hasPallet ? ["PET Pallets", "Can Pallets"] : [])];
    const detailData = filteredJobRecords.map((job) => [
      job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "",
      getOrderNumber(job) || "",
      job.job_number || "",
      job.movement_type || "",
      job.container_type || "",
      job.ewc || "",
      job.waste_description || "",
      job.vehicle_registration || "",
      job.weight_t != null ? round2(job.weight_t) : "",
      getJobCost(job) != null ? round2(getJobCost(job)!) : "",
      getHaulageCost(job) != null ? round2(getHaulageCost(job)!) : "",
      ...(hasTotalPallets ? [totalPalletsData[job.job_number] || ""] : []),
      ...(hasPallet ? [palletData[job.job_number]?.pet || "", palletData[job.job_number]?.cans || ""] : []),
    ]);

    const wsData = [...headerData, detailHeaders, ...detailData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 12 },
      { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      ...(hasTotalPallets ? [{ wch: 10 }] : []),
      ...(hasPallet ? [{ wch: 12 }, { wch: 12 }] : []),
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Site Report");

    const fileName = `${customerName}_${selectedSite.site_name}_${format(dateRange.from, "yyyyMMdd")}-${format(dateRange.to, "yyyyMMdd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const wasteSummary = filteredJobRecords.reduce((acc, job) => {
    const desc = job.waste_description || "Unknown";
    if (!acc[desc]) {
      acc[desc] = { count: 0, weight: 0 };
    }
    acc[desc].count += 1;
    acc[desc].weight += job.weight_t || 0;
    return acc;
  }, {} as Record<string, { count: number; weight: number }>);

  const sortedSummary = Object.entries(wasteSummary)
    .map(([desc, data]) => ({ desc, count: data.count, weight: data.weight }))
    .sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Site</Label>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger>
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.site_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <ReportingPeriodSelector
            customerId={customerId}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={generateReport}
          disabled={!selectedSiteId || !dateRange?.from || !dateRange?.to || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" />
              Generate Report
            </>
          )}
        </Button>

        {reportGenerated && filteredJobRecords.length > 0 && (
          <Button variant="outline" onClick={exportToExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        )}
      </div>

      {reportGenerated && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold">
              {selectedSite?.site_name} - {dateRange?.from && dateRange?.to && (
                <>
                  {format(dateRange.from, "dd MMM yyyy")} to {format(dateRange.to, "dd MMM yyyy")}
                </>
              )}
            </h3>
            <div className="flex gap-4 flex-wrap">
              <Badge variant="secondary" className="text-sm">
                {filteredJobRecords.length} jobs
              </Badge>
              <Badge variant="default" className="text-sm">
                {totalWeight.toFixed(2)} tonnes
              </Badge>
              <Badge variant="outline" className="text-sm">
                £{totalCost.toFixed(2)} total
              </Badge>
            </div>
          </div>

          {uniqueWasteTypes.length > 0 && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Filter by Waste Type</span>
                {selectedWasteTypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedWasteTypes([])}
                    className="h-6 px-2 text-xs"
                  >
                    Clear ({selectedWasteTypes.length})
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {uniqueWasteTypes.map((wasteType) => (
                  <label
                    key={wasteType}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={selectedWasteTypes.includes(wasteType)}
                      onCheckedChange={() => toggleWasteType(wasteType)}
                    />
                    <span>{wasteType}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {sortedSummary.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 font-medium">Summary by Waste Type</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waste Type</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-right">Weight (t)</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSummary.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.desc}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right">{row.weight.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {totalWeight > 0 ? ((row.weight / totalWeight) * 100).toFixed(1) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{filteredJobRecords.length}</TableCell>
                    <TableCell className="text-right">{totalWeight.toFixed(2)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {(() => {
            const hasPalletData = Object.keys(palletData).length > 0;
            const hasTotalPallets = Object.keys(totalPalletsData).length > 0;
            return filteredJobRecords.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 font-medium">Detailed Job Records</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order No.</TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Job No.</TableHead>
                      <TableHead>Movement</TableHead>
                      <TableHead>Container</TableHead>
                      <TableHead>EWC</TableHead>
                      <TableHead>Waste Type</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="text-right">Weight (t)</TableHead>
                      <TableHead className="text-right">Cost (£)</TableHead>
                      <TableHead className="text-right">Haulage (£)</TableHead>
                      {hasTotalPallets && <TableHead className="text-right">Pallets</TableHead>}
                      {hasPalletData && <TableHead className="text-right">PET Pallets</TableHead>}
                      {hasPalletData && <TableHead className="text-right">Can Pallets</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJobRecords.map((job, idx) => {
                      const cost = getJobCost(job);
                      const orderNo = getOrderNumber(job);
                      const originalOrderNo = getOriginalOrderNumber(job);
                      const isEditing = editingJobId === job.id;
                      // PO is considered changed if override exists and differs from original
                      const isPOChanged = job.order_number_override && 
                        job.order_number_override.trim() !== (originalOrderNo || "");
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            {job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {isEditing ? (
                              <Input
                                value={editingPOValue}
                                onChange={(e) => setEditingPOValue(e.target.value)}
                                className="h-8 w-28"
                                placeholder="Enter PO"
                                disabled={savingPO}
                              />
                            ) : (
                              <span className={isPOChanged ? "text-green-600 font-semibold" : ""}>
                                {orderNo || "-"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => savePONumber(job)}
                                  disabled={savingPO}
                                >
                                  {savingPO ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-green-600" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={cancelEditingPO}
                                  disabled={savingPO}
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => startEditingPO(job)}
                                title="Edit PO Number"
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{job.job_number || "-"}</TableCell>
                          <TableCell>{job.movement_type || "-"}</TableCell>
                          <TableCell>{job.container_type || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{job.ewc || "-"}</TableCell>
                          <TableCell>{job.waste_description || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{job.vehicle_registration || "-"}</TableCell>
                          <TableCell className="text-right">
                            {job.weight_t !== null ? job.weight_t.toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {cost !== null ? `£${cost.toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {(() => { const hc = getHaulageCost(job); return hc !== null ? `£${hc.toFixed(2)}` : "-"; })()}
                          </TableCell>
                          {hasTotalPallets && (
                            <TableCell className="text-right font-medium">
                              {totalPalletsData[job.job_number] || "-"}
                            </TableCell>
                          )}
                          {hasPalletData && (
                            <TableCell className="text-right">
                              {palletData[job.job_number]?.pet || "-"}
                            </TableCell>
                          )}
                          {hasPalletData && (
                            <TableCell className="text-right">
                              {palletData[job.job_number]?.cans || "-"}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No job records found for this site and date range.
            </p>
          );
          })()}
        </div>
      )}
    </div>
  );
}
