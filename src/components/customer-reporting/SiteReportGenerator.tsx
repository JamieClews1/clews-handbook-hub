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
import { CalendarIcon, FileDown, Loader2, FileSpreadsheet, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";

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
};

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
      .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4")
      .eq("customer_id", customerId)
      .order("site_name");
    setSites(data ?? []);
  };

  const generateReport = async () => {
    if (!selectedSiteId || !dateRange?.from || !dateRange?.to) return;

    setLoading(true);
    setReportGenerated(false);

    try {
      const site = sites.find((s) => s.id === selectedSiteId);
      if (!site) return;

      const siteNames = [
        site.data_hub_site,
        site.data_hub_site_2,
        site.data_hub_site_3,
        site.data_hub_site_4,
      ].filter(Boolean) as string[];

      const dataHubCustomer = site.data_hub_customer;

      if (siteNames.length === 0 && !dataHubCustomer) {
        setJobRecords([]);
        setReportGenerated(true);
        return;
      }

      const startDate = format(dateRange.from, "yyyy-MM-dd");
      const endDate = format(dateRange.to, "yyyy-MM-dd");

      // Build query - filter by customer AND site names from Data Hub mappings
      let query = supabase
        .from("data_hub_jobs")
        .select("job_date, job_number, container_type, ewc, waste_description, weight_t, vehicle_registration, category, movement_type, site, raw")
        .gte("job_date", startDate)
        .lte("job_date", endDate)
        .order("job_date", { ascending: true });

      // Filter by Data Hub customer if set
      if (dataHubCustomer) {
        query = query.eq("customer", dataHubCustomer);
      }

      // Filter by any of the configured Data Hub site names (exact match on site field)
      if (siteNames.length > 0) {
        query = query.in("site", siteNames);
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

  // Filter job records by selected waste types
  const filteredJobRecords = useMemo(() => {
    if (selectedWasteTypes.length === 0) return jobRecords;
    return jobRecords.filter((job) => 
      job.waste_description && selectedWasteTypes.includes(job.waste_description)
    );
  }, [jobRecords, selectedWasteTypes]);

  const totalWeight = filteredJobRecords.reduce((sum, r) => sum + (r.weight_t || 0), 0);
  const totalCost = filteredJobRecords.reduce((sum, r) => {
    const rawObj = r.raw && typeof r.raw === "object" && !Array.isArray(r.raw) ? (r.raw as Record<string, unknown>) : null;
    const cost = rawObj?.Cost;
    return sum + (typeof cost === "number" ? cost : typeof cost === "string" ? parseFloat(cost) || 0 : 0);
  }, 0);
  const selectedSite = sites.find((s) => s.id === selectedSiteId);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Helper to extract cost from raw JSON
  const getJobCost = (job: JobRecord): number | null => {
    const rawObj = job.raw && typeof job.raw === "object" && !Array.isArray(job.raw) ? (job.raw as Record<string, unknown>) : null;
    const cost = rawObj?.Cost;
    if (typeof cost === "number") return cost;
    if (typeof cost === "string") {
      const parsed = parseFloat(cost);
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

  // Export to Excel
  const exportToExcel = () => {
    if (!selectedCustomer || !selectedSite || !dateRange?.from || !dateRange?.to) return;

    const wb = XLSX.utils.book_new();

    // Header rows
    const headerData = [
      ["Site Recycling Report"],
      [],
      ["Customer:", selectedCustomer.customer_name],
      ["Site:", selectedSite.site_name],
      ["Date Range:", `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`],
      ["Generated:", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Total Jobs:", filteredJobRecords.length.toString()],
      ["Total Weight (t):", totalWeight.toFixed(2)],
      ["Total Cost (£):", totalCost.toFixed(2)],
      [],
      [],
    ];

    // Detailed records header and data
    const detailHeaders = ["Date", "Job No.", "Movement", "Container", "EWC", "Waste Type", "Vehicle", "Weight (t)", "Cost (£)"];
    const detailData = filteredJobRecords.map((job) => [
      job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "",
      job.job_number || "",
      job.movement_type || "",
      job.container_type || "",
      job.ewc || "",
      job.waste_description || "",
      job.vehicle_registration || "",
      job.weight_t ?? "",
      getJobCost(job) ?? "",
    ]);

    // Combine all data
    const wsData = [...headerData, detailHeaders, ...detailData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = [
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 12 },
      { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Site Report");

    // Generate filename
    const fileName = `${selectedCustomer.customer_name}_${selectedSite.site_name}_${format(dateRange.from, "yyyyMMdd")}-${format(dateRange.to, "yyyyMMdd")}.xlsx`;
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
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.site_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date Range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd MMM yyyy")} - {format(dateRange.to, "dd MMM yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd MMM yyyy")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
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
                      <TableHead>Date</TableHead>
                      <TableHead>Job No.</TableHead>
                      <TableHead>Movement</TableHead>
                      <TableHead>Container</TableHead>
                      <TableHead>EWC</TableHead>
                      <TableHead>Waste Type</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="text-right">Weight (t)</TableHead>
                      <TableHead className="text-right">Cost (£)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJobRecords.map((job, idx) => {
                      const cost = getJobCost(job);
                      return (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap">
                            {job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell className="font-medium">{job.job_number || "-"}</TableCell>
                          <TableCell>{job.movement_type || "-"}</TableCell>
                          <TableCell>{job.container_type || "-"}</TableCell>
                          <TableCell>{job.ewc || "-"}</TableCell>
                          <TableCell>{job.waste_description || "-"}</TableCell>
                          <TableCell>{job.vehicle_registration || "-"}</TableCell>
                          <TableCell className="text-right">
                            {job.weight_t != null ? job.weight_t.toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {cost != null ? cost.toFixed(2) : "-"}
                          </TableCell>
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
