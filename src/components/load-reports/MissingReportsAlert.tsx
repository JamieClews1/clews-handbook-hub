import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWeighbridgeSource } from "@/lib/weighbridge-source";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Plus, EyeOff, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatLoadReportDate } from "@/lib/load-report-dates";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MissingJob {
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  container_type: string | null;
  waste_description: string | null;
  weight_t: number | null;
  vehicle_registration: string | null;
  source: string;
}

interface MissingReportsAlertProps {
  customerType: "britvic" | "staci" | "vantiva" | "amazon" | "evri" | "other" | null;
}

export const MissingReportsAlert = ({ customerType }: MissingReportsAlertProps) => {
  const [, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const dateFrom = format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");
  const [missingJobs, setMissingJobs] = useState<MissingJob[]>([]);
  const [excludedJobs, setExcludedJobs] = useState<MissingJob[]>([]);
  const [showExcluded, setShowExcluded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const handleCreateReport = (job: MissingJob) => {
    const params: Record<string, string> = { job: job.job_number };
    if (job.job_date) params.date = job.job_date;
    if (job.vehicle_registration) params.vehicle = job.vehicle_registration;
    setSearchParams(params);
  };

  const handleExclude = async (job: MissingJob) => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("load_report_exclusions" as any)
      .upsert(
        {
          job_number: job.job_number,
          source: job.source,
          excluded_by: userData?.user?.id ?? null,
        },
        { onConflict: "job_number,source" }
      );

    if (error) {
      toast({ title: "Could not exclude job", description: error.message, variant: "destructive" });
      return;
    }

    setMissingJobs((prev) => prev.filter((j) => !(j.job_number === job.job_number && j.source === job.source)));
    setExcludedJobs((prev) => [job, ...prev]);
    toast({
      title: `Job ${job.job_number} excluded`,
      description: "It no longer requires a load report.",
    });
  };

  const handleRestore = async (job: MissingJob) => {
    const { error } = await supabase
      .from("load_report_exclusions" as any)
      .delete()
      .eq("job_number", job.job_number)
      .eq("source", job.source);

    if (error) {
      toast({ title: "Could not restore job", description: error.message, variant: "destructive" });
      return;
    }

    setExcludedJobs((prev) => prev.filter((j) => !(j.job_number === job.job_number && j.source === job.source)));
    setMissingJobs((prev) =>
      [...prev, job].sort((a, b) => {
        if (!a.job_date) return 1;
        if (!b.job_date) return -1;
        return b.job_date.localeCompare(a.job_date);
      })
    );
    toast({ title: `Job ${job.job_number} restored`, description: "It requires a load report again." });
  };

  useEffect(() => {
    fetchMissingJobs();
  }, [customerType]);

  const fetchMissingJobs = async () => {
    if (!customerType) {
      setMissingJobs([]);
      setExcludedJobs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Get sites that match this customer type AND have rebate setup —
      // either a price set or skip/RoRo rebate lines. Restrict to those sites
      // first — otherwise the "other" branch can match >1000 sites and get
      // truncated by the default row cap, silently dropping valid sites.
      const [{ data: priceSetSites }, { data: skipRebateSites }] = await Promise.all([
        supabase.from("customer_site_price_sets").select("site_id"),
        supabase.from("customer_site_skip_rebates").select("site_id"),
      ]);
      const rebateSiteIds = [
        ...new Set(
          [
            ...(priceSetSites || []).map((p: any) => p.site_id),
            ...(skipRebateSites || []).map((p: any) => p.site_id),
          ].filter(Boolean)
        ),
      ];

      if (rebateSiteIds.length === 0) {
        setMissingJobs([]);
        setExcludedJobs([]);
        setLoading(false);
        return;
      }

      let siteQuery = supabase
        .from("customer_sites")
        .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5, load_report_type")
        .in("id", rebateSiteIds);

      if (customerType !== "other") {
        siteQuery = siteQuery.eq("load_report_type", customerType);
      } else {
        siteQuery = siteQuery.or("load_report_type.is.null,load_report_type.eq.,load_report_type.eq.other");
      }

      const { data: sites } = await siteQuery;
      if (!sites || sites.length === 0) {
        setMissingJobs([]);
        setExcludedJobs([]);
        setLoading(false);
        return;
      }

      const sitesWithRebate = sites;


      if (sitesWithRebate.length === 0) {
        setMissingJobs([]);
        setExcludedJobs([]);
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
        setExcludedJobs([]);
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
          .select("job_number, job_date, customer, site, container_type, category, source, ewc, waste_description, weight_t, vehicle_registration")
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
        setExcludedJobs([]);
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

      // 6b. Get manually excluded jobs
      const { data: exclusions } = await supabase
        .from("load_report_exclusions" as any)
        .select("job_number, source");
      const excludedKeys = new Set(
        (exclusions || []).map((e: any) => `${e.job_number}|${e.source}`)
      );

      // 7. Find jobs with no matching report
      const withoutReport = matchedJobs.filter(j => !reportedJobNumbers.has(j.job_number));

      const missing = withoutReport.filter(j => !excludedKeys.has(`${j.job_number}|${j.source}`));
      const excluded = withoutReport.filter(j => excludedKeys.has(`${j.job_number}|${j.source}`));

      const sortByDate = (a: MissingJob, b: MissingJob) => {
        if (!a.job_date) return 1;
        if (!b.job_date) return -1;
        return b.job_date.localeCompare(a.job_date);
      };
      missing.sort(sortByDate);
      excluded.sort(sortByDate);

      setMissingJobs(missing);
      setExcludedJobs(excluded);
    } catch (error) {
      console.error("Error fetching missing jobs:", error);
      setMissingJobs([]);
      setExcludedJobs([]);
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
      "Waste Type": job.waste_description || "",
      "Vehicle Reg": job.vehicle_registration || "",
      "Weight (t)": job.weight_t != null ? (job.source === "midweigh" ? (job.weight_t / 1000).toFixed(3) : job.weight_t.toFixed(3)) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Missing Reports");
    XLSX.writeFile(wb, `missing-reports-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const formatWeight = (job: MissingJob) =>
    job.weight_t != null
      ? (job.source === "midweigh" ? job.weight_t / 1000 : job.weight_t).toFixed(3)
      : "-";

  if (loading) return null;
  if (missingJobs.length === 0 && excludedJobs.length === 0) return null;

  return (
    <TooltipProvider>
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  These jobs have no load report but belong to customers with rebate setups.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {excludedJobs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowExcluded((v) => !v)}
                      className="gap-1.5"
                    >
                      <EyeOff className="h-4 w-4" />
                      {showExcluded ? "Hide" : "Show"} excluded ({excludedJobs.length})
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={exportMissingToExcel} className="gap-1.5">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>

              {missingJobs.length > 0 ? (
                <div className="overflow-x-auto rounded-md border border-orange-200 dark:border-orange-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-orange-200 dark:border-orange-800 bg-orange-100/40 dark:bg-orange-900/20">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Job #</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Customer</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Site</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Container</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Waste Type</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vehicle</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                        <th className="py-2 px-3 text-right font-medium text-muted-foreground w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingJobs.map((job) => (
                        <tr key={`${job.job_number}-${job.source}`} className="border-b border-orange-100 dark:border-orange-900/50 last:border-0 hover:bg-orange-100/30 dark:hover:bg-orange-900/10">
                          <td className="py-2 px-3 font-semibold whitespace-nowrap">{job.job_number}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {job.job_date ? formatLoadReportDate(job.job_date, "dd/MM/yyyy") : "-"}
                          </td>
                          <td className="py-2 px-3">{job.customer || "-"}</td>
                          <td className="py-2 px-3">{job.site || "-"}</td>
                          <td className="py-2 px-3">{job.container_type || "-"}</td>
                          <td className="py-2 px-3">{job.waste_description || "-"}</td>
                          <td className="py-2 px-3 whitespace-nowrap">{job.vehicle_registration || "-"}</td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">{formatWeight(job)}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleCreateReport(job)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Create load report</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleExclude(job)}
                                  >
                                    <EyeOff className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Exclude from load reports</TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No outstanding load reports — all matching jobs are reported or excluded.
                </p>
              )}

              {showExcluded && excludedJobs.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <EyeOff className="h-3.5 w-3.5" /> Excluded from load reports
                  </p>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Job #</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Customer</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Site</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Container</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Waste Type</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vehicle</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Weight (t)</th>
                          <th className="py-2 px-3 text-right font-medium text-muted-foreground w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excludedJobs.map((job) => (
                          <tr key={`excl-${job.job_number}-${job.source}`} className="border-b last:border-0 text-muted-foreground">
                            <td className="py-2 px-3 font-semibold whitespace-nowrap">{job.job_number}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {job.job_date ? formatLoadReportDate(job.job_date, "dd/MM/yyyy") : "-"}
                            </td>
                            <td className="py-2 px-3">{job.customer || "-"}</td>
                            <td className="py-2 px-3">{job.site || "-"}</td>
                            <td className="py-2 px-3">{job.container_type || "-"}</td>
                            <td className="py-2 px-3">{job.waste_description || "-"}</td>
                            <td className="py-2 px-3 whitespace-nowrap">{job.vehicle_registration || "-"}</td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">{formatWeight(job)}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-end">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleRestore(job)}
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Restore to missing reports</TooltipContent>
                                </Tooltip>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </TooltipProvider>
  );
};
