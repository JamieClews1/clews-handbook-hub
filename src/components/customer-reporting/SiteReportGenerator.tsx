import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileDown, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

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

      let query = supabase
        .from("data_hub_jobs")
        .select("job_date, job_number, container_type, ewc, waste_description, weight_t, vehicle_registration, category, movement_type, site")
        .gte("job_date", startDate)
        .lte("job_date", endDate)
        .order("job_date", { ascending: true });

      if (dataHubCustomer) {
        query = query.eq("customer", dataHubCustomer);
      }

      if (siteNames.length > 0) {
        const orConditions = siteNames.map((name) => `site.ilike.%${name}%`).join(",");
        query = query.or(orConditions);
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

  const totalWeight = jobRecords.reduce((sum, r) => sum + (r.weight_t || 0), 0);
  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  // Aggregate summary by waste type
  const wasteSummary = jobRecords.reduce((acc, job) => {
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

      <Button
        onClick={generateReport}
        disabled={!selectedSiteId || !dateRange?.from || !dateRange?.to || loading}
        className="w-full md:w-auto"
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
            <div className="flex gap-4">
              <Badge variant="secondary" className="text-sm">
                {jobRecords.length} jobs
              </Badge>
              <Badge variant="default" className="text-sm">
                {totalWeight.toFixed(2)} tonnes
              </Badge>
            </div>
          </div>

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
                    <TableCell className="text-right">{jobRecords.length}</TableCell>
                    <TableCell className="text-right">{totalWeight.toFixed(2)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {/* Detailed Job Records */}
          {jobRecords.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 font-medium">Detailed Job Records</div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Job No.</TableHead>
                      <TableHead>Job Type</TableHead>
                      <TableHead>EWC</TableHead>
                      <TableHead>Waste Type</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="text-right">Weight (t)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobRecords.map((job, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="whitespace-nowrap">
                          {job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "-"}
                        </TableCell>
                        <TableCell className="font-medium">{job.job_number || "-"}</TableCell>
                        <TableCell>{job.container_type || "-"}</TableCell>
                        <TableCell>{job.ewc || "-"}</TableCell>
                        <TableCell>{job.waste_description || "-"}</TableCell>
                        <TableCell>{job.vehicle_registration || "-"}</TableCell>
                        <TableCell className="text-right">
                          {job.weight_t != null ? job.weight_t.toFixed(2) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
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
