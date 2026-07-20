import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, FileDown, Loader2, FileSpreadsheet, Filter, Columns, Database } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";
import { ReportingPeriodQuickSelect } from "./ReportingPeriodQuickSelect";
import { ReportDateRangePicker } from "./ReportDateRangePicker";

type Customer = {
  id: string;
  customer_name: string;
  customer_code: string;
};

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
  source: string;
};

type DataSourceFilter = "all" | "skiptrak" | "midweigh";

type ColumnKey = 
  | "date" | "jobNo" | "orderNo" | "site" | "haulier" | "jobType" | "inOut" | "domComm" 
  | "movement" | "container" | "ewc" | "wasteType" | "vehicle" | "weighbridge" 
  | "weight" | "cost" | "totalPrice";

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "jobNo", label: "Job No." },
  { key: "orderNo", label: "Order No." },
  { key: "site", label: "Site" },
  { key: "haulier", label: "Haulier" },
  { key: "jobType", label: "Job Type" },
  { key: "inOut", label: "In/Out" },
  { key: "domComm", label: "Dom/Comm" },
  { key: "movement", label: "Movement" },
  { key: "container", label: "Container" },
  { key: "ewc", label: "EWC" },
  { key: "wasteType", label: "Waste Type" },
  { key: "vehicle", label: "Vehicle" },
  { key: "weighbridge", label: "Weighbridge" },
  { key: "weight", label: "Weight (t)" },
  { key: "cost", label: "Cost (£)" },
  { key: "totalPrice", label: "Total Price (£)" },
];

export function SiteReportGenerator() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(false);
  const [jobRecords, setJobRecords] = useState<JobRecord[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [selectedWasteTypes, setSelectedWasteTypes] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(ALL_COLUMNS.map((c) => c.key))
  );
  const [dataSourceFilter, setDataSourceFilter] = useState<DataSourceFilter>("all");

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadSites(selectedCustomerId);
      setSelectedSiteId("");
      setJobRecords([]);
      setReportGenerated(false);
    }
  }, [selectedCustomerId]);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, customer_name, customer_code")
      .order("customer_name");
    setCustomers(data ?? []);
  };

  const loadSites = async (customerId: string) => {
    const { data } = await supabase
      .from("customer_sites")
      .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5")
      .eq("customer_id", customerId)
      .order("site_name");
    setSites(data ?? []);
  };

  const generateReport = async () => {
    if (!selectedSiteId || !dateRange?.from || !dateRange?.to) return;

    setLoading(true);
    setReportGenerated(false);

    try {
      const isAllSites = selectedSiteId === "__ALL__";
      const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

      const startDate = format(dateRange.from, "yyyy-MM-dd");
      const endDate = format(dateRange.to, "yyyy-MM-dd");

      let query = supabase
        .from("data_hub_jobs")
        .select("job_date, job_number, container_type, ewc, waste_description, weight_t, vehicle_registration, category, movement_type, site, raw, order_number_override, source")
        .gte("job_date", startDate)
        .lte("job_date", endDate)
        .order("job_date", { ascending: true });

      if (isAllSites) {
        // Pull everything for this customer directly from Data Hub, ignoring site mappings.
        // Match against any known customer alias: the customer name itself plus any
        // data_hub_customer values configured on their sites.
        const customerAliases = Array.from(
          new Set(
            [
              selectedCustomer?.customer_name,
              ...sites.map((s) => s.data_hub_customer),
            ].filter(Boolean) as string[],
          ),
        );
        if (customerAliases.length === 0) {
          setJobRecords([]);
          setReportGenerated(true);
          return;
        }
        query = query.in("customer", customerAliases);
      } else {
        const targetSites = sites.filter((s) => s.id === selectedSiteId);
        if (targetSites.length === 0) return;

        const siteNames = Array.from(
          new Set(
            targetSites.flatMap((s) => [
              s.data_hub_site,
              s.data_hub_site_2,
              s.data_hub_site_3,
              s.data_hub_site_4,
              s.data_hub_site_5,
            ]),
          ),
        ).filter(Boolean) as string[];

        const customerFallbacks = Array.from(
          new Set(
            targetSites
              .filter((s) => ![s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5].some(Boolean))
              .map((s) => s.data_hub_customer)
              .filter(Boolean) as string[],
          ),
        );

        if (siteNames.length === 0 && customerFallbacks.length === 0) {
          setJobRecords([]);
          setReportGenerated(true);
          return;
        }

        const orParts: string[] = [];
        if (siteNames.length > 0) {
          orParts.push(`site.in.(${siteNames.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",")})`);
        }
        if (customerFallbacks.length > 0) {
          orParts.push(`customer.in.(${customerFallbacks.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",")})`);
        }
        if (orParts.length === 1 && siteNames.length > 0 && customerFallbacks.length === 0) {
          query = query.in("site", siteNames);
        } else if (orParts.length === 1 && customerFallbacks.length > 0 && siteNames.length === 0) {
          query = query.in("customer", customerFallbacks);
        } else {
          query = query.or(orParts.join(","));
        }
      }

      const { data: jobs, error } = await query;


      if (error) throw error;

      setJobRecords(jobs ?? []);
      setReportGenerated(true);
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique waste types for filter
  const uniqueWasteTypes = useMemo(() => {
    const types = new Set<string>();
    jobRecords.forEach((job) => {
      if (job.waste_description) types.add(job.waste_description);
    });
    return Array.from(types).sort();
  }, [jobRecords]);

  // Filter job records by selected waste types and data source
  const filteredJobRecords = useMemo(() => {
    let filtered = jobRecords;
    
    // Filter by data source
    if (dataSourceFilter !== "all") {
      filtered = filtered.filter((job) => 
        job.source?.toLowerCase() === dataSourceFilter
      );
    }
    
    // Filter by waste types
    if (selectedWasteTypes.length > 0) {
      filtered = filtered.filter((job) => 
        job.waste_description && selectedWasteTypes.includes(job.waste_description)
      );
    }
    
    return filtered;
  }, [jobRecords, selectedWasteTypes, dataSourceFilter]);

  const totalWeight = filteredJobRecords.reduce((sum, r) => sum + (r.weight_t || 0), 0);
  const totalCost = filteredJobRecords.reduce((sum, r) => {
    const rawObj = r.raw && typeof r.raw === "object" && !Array.isArray(r.raw) ? (r.raw as Record<string, unknown>) : null;
    const cost = rawObj?.Cost;
    return sum + (typeof cost === "number" ? cost : typeof cost === "string" ? parseFloat(cost) || 0 : 0);
  }, 0);
  const selectedSite = sites.find((s) => s.id === selectedSiteId);
  const isAllSites = selectedSiteId === "__ALL__";
  const selectedSiteLabel = isAllSites ? "All Sites" : selectedSite?.site_name ?? "";
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Helper to get raw object
  const getRawObj = (job: JobRecord): Record<string, unknown> | null => {
    return job.raw && typeof job.raw === "object" && !Array.isArray(job.raw) ? (job.raw as Record<string, unknown>) : null;
  };

  // Helper to extract cost from raw JSON
  const getJobCost = (job: JobRecord): number | null => {
    const rawObj = getRawObj(job);
    const cost = rawObj?.Cost ?? rawObj?.["Total Price"];
    if (typeof cost === "number") return cost;
    if (typeof cost === "string") {
      const parsed = parseFloat(cost);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Helper to extract original order number from raw JSON
  const getOriginalOrderNumber = (job: JobRecord): string | null => {
    const rawObj = getRawObj(job);
    if (!rawObj) return null;
    const orderNo = rawObj["Order No."] ?? rawObj["Order No"] ?? rawObj["order_no"] ?? rawObj["OrderNo"] ?? rawObj["PO Number"] ?? rawObj["PO"];
    return orderNo ? String(orderNo).trim() : null;
  };

  // Helper to get display order number (prefers override)
  const getOrderNumber = (job: JobRecord): string | null => {
    if (job.order_number_override && job.order_number_override.trim()) {
      return job.order_number_override.trim();
    }
    return getOriginalOrderNumber(job);
  };

  // Check if PO has been changed
  const isPOChanged = (job: JobRecord): boolean => {
    const originalOrderNo = getOriginalOrderNumber(job);
    return !!(job.order_number_override && 
      job.order_number_override.trim() !== (originalOrderNo || ""));
  };

  // Helper to extract additional raw fields
  const getHaulier = (job: JobRecord): string | null => {
    const rawObj = getRawObj(job);
    const val = rawObj?.Haulier ?? rawObj?.haulier;
    return val ? String(val).trim() : null;
  };

  const getJobType = (job: JobRecord): string | null => {
    const rawObj = getRawObj(job);
    const val = rawObj?.["Job Type"] ?? rawObj?.["job_type"] ?? rawObj?.JobType;
    return val ? String(val).trim() : null;
  };

  const getInOut = (job: JobRecord): string | null => {
    const rawObj = getRawObj(job);
    const val = rawObj?.["In / Out"] ?? rawObj?.["In/Out"] ?? rawObj?.InOut ?? rawObj?.Direction;
    return val ? String(val).trim() : null;
  };

  const getWeighbridge = (job: JobRecord): string | null => {
    const rawObj = getRawObj(job);
    const val = rawObj?.Weighbridge ?? rawObj?.weighbridge;
    return val ? String(val).trim() : null;
  };

  const getDomComm = (job: JobRecord): string | null => {
    const rawObj = getRawObj(job);
    const val = rawObj?.["Dom/ Comm"] ?? rawObj?.["Dom/Comm"] ?? rawObj?.DomComm ?? rawObj?.Type;
    return val ? String(val).trim() : null;
  };

  const getTotalPrice = (job: JobRecord): number | null => {
    const rawObj = getRawObj(job);
    const price = rawObj?.["Total Price"] ?? rawObj?.TotalPrice ?? rawObj?.Price;
    if (typeof price === "number") return price;
    if (typeof price === "string") {
      const parsed = parseFloat(price.replace(/[£,]/g, ""));
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  // Toggle waste type filter
  const toggleWasteType = (wasteType: string) => {
    setSelectedWasteTypes((prev) =>
      prev.includes(wasteType)
        ? prev.filter((t) => t !== wasteType)
        : [...prev, wasteType]
    );
  };

  // Toggle column visibility
  const toggleColumn = (columnKey: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  };

  const isColumnVisible = (columnKey: ColumnKey) => visibleColumns.has(columnKey);

  // Export to Excel
  const exportToExcel = () => {
    if (!selectedCustomer || !selectedSiteLabel || !dateRange?.from || !dateRange?.to) return;

    // Helper to round numbers for Excel (keeps as number type)
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const wb = XLSX.utils.book_new();

    // Header rows
    const headerData = [
      ["Site Recycling Report"],
      [],
      ["Customer:", selectedCustomer.customer_name],
      ["Site:", selectedSiteLabel],
      ["Date Range:", `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`],
      ["Generated:", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Total Jobs:", filteredJobRecords.length],
      ["Total Weight (t):", round2(totalWeight)],
      ["Total Cost (£):", round2(totalCost)],
      [],
      [],
    ];

    // Build headers and data based on visible columns
    const columnData: { key: ColumnKey; header: string; getValue: (job: JobRecord) => string | number }[] = [
      { key: "date", header: "Date", getValue: (job) => job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "" },
      { key: "jobNo", header: "Job No.", getValue: (job) => job.job_number || "" },
      { key: "orderNo", header: "Order No.", getValue: (job) => getOrderNumber(job) || "" },
      { key: "site", header: "Site", getValue: (job) => job.site || "" },
      { key: "haulier", header: "Haulier", getValue: (job) => getHaulier(job) || "" },
      { key: "jobType", header: "Job Type", getValue: (job) => getJobType(job) || "" },
      { key: "inOut", header: "In/Out", getValue: (job) => getInOut(job) || "" },
      { key: "domComm", header: "Dom/Comm", getValue: (job) => getDomComm(job) || "" },
      { key: "movement", header: "Movement", getValue: (job) => job.movement_type || "" },
      { key: "container", header: "Container", getValue: (job) => job.container_type || "" },
      { key: "ewc", header: "EWC", getValue: (job) => job.ewc || "" },
      { key: "wasteType", header: "Waste Type", getValue: (job) => job.waste_description || "" },
      { key: "vehicle", header: "Vehicle", getValue: (job) => job.vehicle_registration || "" },
      { key: "weighbridge", header: "Weighbridge", getValue: (job) => getWeighbridge(job) || "" },
      { key: "weight", header: "Weight (t)", getValue: (job) => job.weight_t != null ? round2(job.weight_t) : "" },
      { key: "cost", header: "Cost (£)", getValue: (job) => { const c = getJobCost(job); return c != null ? round2(c) : ""; } },
      { key: "totalPrice", header: "Total Price (£)", getValue: (job) => { const p = getTotalPrice(job); return p != null ? round2(p) : ""; } },
    ];

    const visibleColumnData = columnData.filter((col) => visibleColumns.has(col.key));
    const detailHeaders = visibleColumnData.map((col) => col.header);
    const detailData = filteredJobRecords.map((job) => 
      visibleColumnData.map((col) => col.getValue(job))
    );

    // Combine all data
    const wsData = [...headerData, detailHeaders, ...detailData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths dynamically based on visible columns
    const columnWidths: Record<ColumnKey, number> = {
      date: 12, jobNo: 15, orderNo: 15, site: 25, haulier: 15, jobType: 12, inOut: 10, domComm: 12,
      movement: 12, container: 25, ewc: 12, wasteType: 30, vehicle: 12, weighbridge: 15,
      weight: 12, cost: 12, totalPrice: 12,
    };
    ws["!cols"] = visibleColumnData.map((col) => ({ wch: columnWidths[col.key] }));

    XLSX.utils.book_append_sheet(wb, ws, "Site Report");

    // Totals tab: aggregate by waste type
    const totalsMap = filteredJobRecords.reduce((acc, job) => {
      const desc = job.waste_description || "Unknown";
      if (!acc[desc]) acc[desc] = { loads: 0, weight: 0, cost: 0 };
      acc[desc].loads += 1;
      acc[desc].weight += job.weight_t || 0;
      const c = getJobCost(job);
      acc[desc].cost += typeof c === "number" ? c : 0;
      return acc;
    }, {} as Record<string, { loads: number; weight: number; cost: number }>);

    const totalsRows = Object.entries(totalsMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([desc, v]) => [desc, v.loads, round2(v.weight), round2(v.cost)]);

    const grandLoads = totalsRows.reduce((s, r) => s + (r[1] as number), 0);
    const grandWeight = round2(totalsRows.reduce((s, r) => s + (r[2] as number), 0));
    const grandCost = round2(totalsRows.reduce((s, r) => s + (r[3] as number), 0));

    const totalsData: (string | number)[][] = [
      ["Totals by Waste Type"],
      [],
      ["Customer:", selectedCustomer.customer_name],
      ["Site:", selectedSiteLabel],
      ["Date Range:", `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`],
      [],
      ["Row Labels", "Loads", "Total Weight", "Total Cost"],
      ...totalsRows,
      ["Grand Total", grandLoads, grandWeight, grandCost],
    ];
    const totalsWs = XLSX.utils.aoa_to_sheet(totalsData);
    totalsWs["!cols"] = [{ wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, totalsWs, "Totals");


    // Generate filename
    const fileName = `${selectedCustomer.customer_name}_${selectedSiteLabel}_${format(dateRange.from, "yyyyMMdd")}-${format(dateRange.to, "yyyyMMdd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Aggregate summary by waste type (from filtered records)
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
    .map(([desc, data]) => ({ desc, ...data }))
    .sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Customer</Label>
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.customer_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Site</Label>
          <Select
            value={selectedSiteId}
            onValueChange={setSelectedSiteId}
            disabled={!selectedCustomerId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">All Sites</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.site_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ReportDateRangePicker
          value={dateRange}
          onChange={setDateRange}
          customerId={selectedCustomerId}
        />

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

        {reportGenerated && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Columns className="h-4 w-4 mr-2" />
                Columns ({visibleColumns.size}/{ALL_COLUMNS.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 bg-background border z-50" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="font-medium text-sm">Show Columns</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setVisibleColumns(new Set(ALL_COLUMNS.map((c) => c.key)))}
                  >
                    Select All
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {ALL_COLUMNS.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 cursor-pointer text-sm py-1 hover:bg-muted/50 px-1 rounded"
                    >
                      <Checkbox
                        checked={isColumnVisible(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {reportGenerated && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Database className="h-4 w-4 mr-2" />
                Source: {dataSourceFilter === "all" ? "All" : dataSourceFilter === "skiptrak" ? "Skiptrak" : "Midweigh"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-background border z-50" align="start">
              <div className="space-y-1">
                <span className="font-medium text-sm block pb-2 border-b mb-2">Data Source</span>
                {[
                  { value: "all" as DataSourceFilter, label: "All Sources" },
                  { value: "skiptrak" as DataSourceFilter, label: "Skiptrak" },
                  { value: "midweigh" as DataSourceFilter, label: "Midweigh" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer text-sm py-1.5 hover:bg-muted/50 px-2 rounded"
                  >
                    <input
                      type="radio"
                      name="dataSource"
                      checked={dataSourceFilter === option.value}
                      onChange={() => setDataSourceFilter(option.value)}
                      className="h-4 w-4"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {reportGenerated && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold">
              {selectedSiteLabel} - {dateRange?.from && dateRange?.to && (
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

          {/* Waste Type Filter */}
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

          {/* Summary by Waste Type */}
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

          {/* Detailed Job Records */}
          {filteredJobRecords.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 font-medium">Detailed Job Records</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isColumnVisible("date") && <TableHead>Date</TableHead>}
                      {isColumnVisible("jobNo") && <TableHead>Job No.</TableHead>}
                      {isColumnVisible("orderNo") && <TableHead>Order No.</TableHead>}
                      {isColumnVisible("site") && <TableHead>Site</TableHead>}
                      {isColumnVisible("haulier") && <TableHead>Haulier</TableHead>}
                      {isColumnVisible("jobType") && <TableHead>Job Type</TableHead>}
                      {isColumnVisible("inOut") && <TableHead>In/Out</TableHead>}
                      {isColumnVisible("domComm") && <TableHead>Dom/Comm</TableHead>}
                      {isColumnVisible("movement") && <TableHead>Movement</TableHead>}
                      {isColumnVisible("container") && <TableHead>Container</TableHead>}
                      {isColumnVisible("ewc") && <TableHead>EWC</TableHead>}
                      {isColumnVisible("wasteType") && <TableHead>Waste Type</TableHead>}
                      {isColumnVisible("vehicle") && <TableHead>Vehicle</TableHead>}
                      {isColumnVisible("weighbridge") && <TableHead>Weighbridge</TableHead>}
                      {isColumnVisible("weight") && <TableHead className="text-right">Weight (t)</TableHead>}
                      {isColumnVisible("cost") && <TableHead className="text-right">Cost (£)</TableHead>}
                      {isColumnVisible("totalPrice") && <TableHead className="text-right">Total Price (£)</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJobRecords.map((job, idx) => {
                      const cost = getJobCost(job);
                      const orderNo = getOrderNumber(job);
                      const poChanged = isPOChanged(job);
                      const haulier = getHaulier(job);
                      const jobType = getJobType(job);
                      const inOut = getInOut(job);
                      const domComm = getDomComm(job);
                      const weighbridge = getWeighbridge(job);
                      const totalPrice = getTotalPrice(job);
                      return (
                        <TableRow key={idx}>
                          {isColumnVisible("date") && (
                            <TableCell className="whitespace-nowrap">
                              {job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "-"}
                            </TableCell>
                          )}
                          {isColumnVisible("jobNo") && (
                            <TableCell className="font-medium">{job.job_number || "-"}</TableCell>
                          )}
                          {isColumnVisible("orderNo") && (
                            <TableCell className={poChanged ? "text-green-600 font-semibold" : ""}>
                              {orderNo || "-"}
                            </TableCell>
                          )}
                          {isColumnVisible("site") && <TableCell>{job.site || "-"}</TableCell>}
                          {isColumnVisible("haulier") && <TableCell>{haulier || "-"}</TableCell>}
                          {isColumnVisible("jobType") && <TableCell>{jobType || "-"}</TableCell>}
                          {isColumnVisible("inOut") && <TableCell>{inOut || "-"}</TableCell>}
                          {isColumnVisible("domComm") && <TableCell>{domComm || "-"}</TableCell>}
                          {isColumnVisible("movement") && <TableCell>{job.movement_type || "-"}</TableCell>}
                          {isColumnVisible("container") && <TableCell>{job.container_type || "-"}</TableCell>}
                          {isColumnVisible("ewc") && <TableCell>{job.ewc || "-"}</TableCell>}
                          {isColumnVisible("wasteType") && <TableCell>{job.waste_description || "-"}</TableCell>}
                          {isColumnVisible("vehicle") && <TableCell>{job.vehicle_registration || "-"}</TableCell>}
                          {isColumnVisible("weighbridge") && <TableCell>{weighbridge || "-"}</TableCell>}
                          {isColumnVisible("weight") && (
                            <TableCell className="text-right">
                              {job.weight_t != null ? job.weight_t.toFixed(2) : "-"}
                            </TableCell>
                          )}
                          {isColumnVisible("cost") && (
                            <TableCell className="text-right">
                              {cost != null ? cost.toFixed(2) : "-"}
                            </TableCell>
                          )}
                          {isColumnVisible("totalPrice") && (
                            <TableCell className="text-right">
                              {totalPrice != null ? totalPrice.toFixed(2) : "-"}
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
              No data found for this site in the selected date range.
              <br />
              <span className="text-sm">
                Make sure the site has Data Hub mappings configured in Customer Setup.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
