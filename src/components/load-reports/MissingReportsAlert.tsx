import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWeighbridgeSource } from "@/lib/weighbridge-source";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Plus } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatLoadReportDate } from "@/lib/load-report-dates";

interface MissingJob {
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  container_type: string | null;
  weight_t: number | null;
  vehicle_registration: string | null;
  source: string;
}

interface MissingReportsAlertProps {
  customerType: "britvic" | "staci" | "vantiva" | "amazon" | "evri" | "other" | null;
}

export const MissingReportsAlert = ({ customerType }: MissingReportsAlertProps) => {
  const [, setSearchParams] = useSearchParams();
  const dateFrom = format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");
  const [missingJobs, setMissingJobs] = useState<MissingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const handleCreateReport = (job: MissingJob) => {
    const params: Record<string, string> = { job: job.job_number };
    if (job.job_date) params.date = job.job_date;
    if (job.vehicle_registration) params.vehicle = job.vehicle_registration;
    setSearchParams(params);
  };

  useEffect(() => {
    fetchMissingJobs();
  }, [customerType]);

  const fetchMissingJobs = async () => {
    if (!customerType) {
      setMissingJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Get sites that match this customer type AND have a rebate price set
      let siteQuery = supabase
        .from("customer_sites")
        .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5, load_report_type, customer_site_price_sets(id)");

      if (customerType !== "other") {
        siteQuery = siteQuery.eq("load_report_type", customerType);
      } else {
        siteQuery = siteQuery.or("load_report_type.is.null,load_report_type.eq.,load_report_type.eq.other");
      }

      const { data: sites } = await siteQuery;
      if (!sites || sites.length === 0) {
        setMissingJobs([]);
        setLoading(false);
        return;
      }

      // Filter to sites that actually have a rebate price set
      const sitesWithRebate = sites.filter(
        (s: any) => s.customer_site_price_sets && (Array.isArray(s.customer_site_price_sets) ? s.customer_site_price_sets.length > 0 : s.customer_site_price_sets.id)
      );

      if (sitesWithRebate.length === 0) {
        setMissingJobs([]);
        setLoading(false);
        return;
      }

      // 2. Build lookup of data_hub_customer+site combos
      const siteMatchers: Array<{ customer: string; sites: string[] }> = [];
      for (const s of sitesWithRebate) {
        if (!s.data_hub_customer) continue;
        const dhSites = [s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5]
          .filter((v): v is string => !!v);
        // Allow customer-only matching when no sites are configured (e.g. midweigh customers)
        siteMatchers.push({ customer: s.data_hub_customer, sites: dhSites });
      }

      if (siteMatchers.length === 0) {
        setMissingJobs([]);
        setLoading(false);
        return;
      }

      // 3. Determine source based on customer type
      const source = getWeighbridgeSource(customerType);

      // 4. Get all data_hub_jobs for these customers in the date range
      const uniqueCustomers = [...new Set(siteMatchers.map(m => m.customer))];
      
      // Fetch in pages to handle large datasets
      let allJobs: any[] = [];
      for (const cust of uniqueCustomers) {
        const { data: jobs } = await supabase
          .from("data_hub_jobs")
          .select("job_number, job_date, customer, site, container_type, source, ewc, weight_t, vehicle_registration")
          .eq("source", source)
          .eq("customer", cust)
          .gte("job_date", dateFrom)
          .lte("job_date", dateTo)
          .order("job_date", { ascending: false })
          .limit(1000);

        if (jobs) allJobs = [...allJobs, ...jobs];
      }

      // 5. Filter jobs to only those matching a site in our rebate list
      const isMidweighSource = source === "midweigh";
      const matchedJobs = allJobs.filter(job => {
        // For midweigh customers (Evri, Vantiva), ALL jobs need load reports
        if (!isMidweighSource) {
          const container = (job.container_type ?? "").toLowerCase();
          const category = ((job as any).category ?? "").toLowerCase();
          const ewc = ((job as any).ewc ?? "").trim();

          // Curtain side loads always need load reports (by container or category)
          const isCurtain = container.includes("curtain") || category.includes("artic curtain side");
          // Britvic: EWC 02 07 99 jobs also need load reports
          const isBritvicEwcMatch = customerType === "britvic" && ewc === "02 07 99";

          if (!isCurtain && !isBritvicEwcMatch) return false;
        }

        return siteMatchers.some(m => {
          if (m.customer.toLowerCase() !== (job.customer ?? "").toLowerCase()) return false;
          // If no sites configured, match on customer name only
          if (m.sites.length === 0) return true;
          return m.sites.some(s => s.toLowerCase() === (job.site ?? "").toLowerCase());
        });
      });

      if (matchedJobs.length === 0) {
        setMissingJobs([]);
        setLoading(false);
        return;
      }

      // 6. Get all load report job numbers (from notes field) in the date range
      const { data: reports } = await supabase
        .from("load_reports")
        .select("notes")
        .gte("report_date", dateFrom)
        .lte("report_date", dateTo)
        .not("notes", "is", null);

      const reportedJobNumbers = new Set(
        (reports || []).map(r => (r.notes ?? "").trim()).filter(n => n !== "")
      );

      // 7. Find jobs with no matching report
      const missing = matchedJobs.filter(j => !reportedJobNumbers.has(j.job_number));

      setMissingJobs(missing);
    } catch (error) {
      console.error("Error fetching missing jobs:", error);
      setMissingJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const exportMissingToExcel = () => {
    const rows = missingJobs.map((job) => ({
      "Job Number": job.job_number,
      "Date": job.job_date ? formatLoadReportDate(job.job_date, "dd/MM/yyyy") : "",
      "Customer": job.customer || "",
      "Site": job.site || "",
      "Container Type": job.container_type || "",
      "Vehicle Reg": job.vehicle_registration || "",
      "Weight (t)": job.weight_t != null ? (job.source === "midweigh" ? (job.weight_t / 1000).toFixed(3) : job.weight_t.toFixed(3)) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Missing Reports");
    XLSX.writeFile(wb, `missing-reports-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  if (loading || missingJobs.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors rounded-t-lg">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
                Missing Reports
                <Badge variant="destructive" className="ml-1">
                  {missingJobs.length}
                </Badge>
              </div>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-orange-600 dark:text-orange-400">
                These jobs have no load report but belong to customers with rebate setups.
              </p>
              <Button variant="outline" size="sm" onClick={exportMissingToExcel} className="gap-1.5 shrink-0 ml-3">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-orange-200 dark:border-orange-800">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Job #</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">Customer</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden md:table-cell">Site</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden md:table-cell">Container</th>
                    <th className="py-2 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {missingJobs.map((job) => (
                    <tr key={`${job.job_number}-${job.source}`} className="border-b border-orange-100 dark:border-orange-900/50">
                      <td className="py-2 px-3 font-semibold">{job.job_number}</td>
                      <td className="py-2 px-3">
                        {job.job_date ? formatLoadReportDate(job.job_date, "dd/MM/yyyy") : "-"}
                      </td>
                      <td className="py-2 px-3 hidden sm:table-cell">{job.customer || "-"}</td>
                      <td className="py-2 px-3 hidden md:table-cell">{job.site || "-"}</td>
                      <td className="py-2 px-3 hidden md:table-cell">{job.container_type || "-"}</td>
                      <td className="py-2 px-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Create load report"
                          onClick={() => handleCreateReport(job)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
