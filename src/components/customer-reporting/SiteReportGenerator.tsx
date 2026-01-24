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
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

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

type ReportData = {
  waste_description: string;
  total_weight_t: number;
  job_count: number;
};

export function SiteReportGenerator() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadSites(selectedCustomerId);
      setSelectedSiteId("");
      setReportData([]);
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
    if (!selectedSiteId) return;

    setLoading(true);
    setReportGenerated(false);

    try {
      // Get the site's Data Hub mappings
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
        setReportData([]);
        setReportGenerated(true);
        return;
      }

      const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

      // Query Data Hub for this site's jobs in the selected month
      let query = supabase
        .from("data_hub_jobs")
        .select("waste_description, weight_t")
        .gte("job_date", monthStart)
        .lte("job_date", monthEnd);

      // If we have a data hub customer, filter by it first
      if (dataHubCustomer) {
        query = query.eq("customer", dataHubCustomer);
      }

      // If we have specific site names, filter by them
      if (siteNames.length > 0) {
        const orConditions = siteNames.map((name) => `site.ilike.%${name}%`).join(",");
        query = query.or(orConditions);
      }

      const { data: jobs, error } = await query;

      if (error) throw error;

      // Aggregate by waste description
      const aggregated: Record<string, { total_weight_t: number; job_count: number }> = {};

      for (const job of jobs ?? []) {
        const desc = job.waste_description || "Unknown";
        if (!aggregated[desc]) {
          aggregated[desc] = { total_weight_t: 0, job_count: 0 };
        }
        aggregated[desc].total_weight_t += job.weight_t || 0;
        aggregated[desc].job_count += 1;
      }

      const result: ReportData[] = Object.entries(aggregated)
        .map(([waste_description, data]) => ({
          waste_description,
          total_weight_t: data.total_weight_t,
          job_count: data.job_count,
        }))
        .sort((a, b) => b.total_weight_t - a.total_weight_t);

      setReportData(result);
      setReportGenerated(true);
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalWeight = reportData.reduce((sum, r) => sum + r.total_weight_t, 0);
  const totalJobs = reportData.reduce((sum, r) => sum + r.job_count, 0);

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

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
          <Label>Month</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedMonth && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedMonth, "MMMM yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={(date) => date && setSelectedMonth(startOfMonth(date))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Button
        onClick={generateReport}
        disabled={!selectedSiteId || loading}
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {selectedSite?.site_name} - {format(selectedMonth, "MMMM yyyy")}
            </h3>
            <div className="flex gap-4">
              <Badge variant="secondary" className="text-sm">
                {totalJobs} jobs
              </Badge>
              <Badge variant="default" className="text-sm">
                {totalWeight.toFixed(2)} tonnes
              </Badge>
            </div>
          </div>

          {reportData.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waste Description</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-right">Weight (t)</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.waste_description}</TableCell>
                      <TableCell className="text-right">{row.job_count}</TableCell>
                      <TableCell className="text-right">{row.total_weight_t.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {totalWeight > 0 ? ((row.total_weight_t / totalWeight) * 100).toFixed(1) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totalJobs}</TableCell>
                    <TableCell className="text-right">{totalWeight.toFixed(2)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No data found for this site in the selected month.
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
