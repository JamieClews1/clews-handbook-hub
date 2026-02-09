import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileSpreadsheet, Download, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import * as XLSX from "xlsx";

interface WasteBreakdown {
  wasteDescription: string;
  ewc: string | null;
  totalWeightT: number;
  jobCount: number;
}

export const DataHubCustomerReport = () => {
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(startOfMonth(new Date()), "yyyy-MM")
  );

  // Fetch unique customer names from data_hub_jobs
  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ["data-hub-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("customer")
        .not("customer", "is", null)
        .order("customer");

      if (error) throw error;

      // Get unique customer names
      const uniqueCustomers = [...new Set(data.map((d) => d.customer).filter(Boolean))] as string[];
      return uniqueCustomers.sort();
    },
  });

  // Parse selected month
  const { periodStart, periodEnd } = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return {
      periodStart: startOfMonth(date),
      periodEnd: endOfMonth(date),
    };
  }, [selectedMonth]);

  // Fetch jobs for selected customer and period
  const { data: jobsData, isLoading: loadingJobs, refetch } = useQuery({
    queryKey: ["data-hub-customer-report", selectedCustomer, selectedMonth],
    queryFn: async () => {
      if (!selectedCustomer) return null;

      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("*")
        .eq("customer", selectedCustomer)
        .gte("job_date", format(periodStart, "yyyy-MM-dd"))
        .lte("job_date", format(periodEnd, "yyyy-MM-dd"))
        .order("job_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomer,
  });

  // Calculate waste breakdown
  const wasteBreakdown = useMemo<WasteBreakdown[]>(() => {
    if (!jobsData || jobsData.length === 0) return [];

    const breakdownMap = new Map<string, WasteBreakdown>();

    for (const job of jobsData) {
      const desc = job.waste_description || "Unknown";
      const existing = breakdownMap.get(desc) || {
        wasteDescription: desc,
        ewc: job.ewc,
        totalWeightT: 0,
        jobCount: 0,
      };

      existing.totalWeightT += job.weight_t || 0;
      existing.jobCount += 1;
      breakdownMap.set(desc, existing);
    }

    return Array.from(breakdownMap.values()).sort(
      (a, b) => b.totalWeightT - a.totalWeightT
    );
  }, [jobsData]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!wasteBreakdown.length) return { totalWeightT: 0, totalJobs: 0 };
    return {
      totalWeightT: wasteBreakdown.reduce((sum, w) => sum + w.totalWeightT, 0),
      totalJobs: wasteBreakdown.reduce((sum, w) => sum + w.jobCount, 0),
    };
  }, [wasteBreakdown]);

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      options.push({
        value: format(startOfMonth(date), "yyyy-MM"),
        label: format(date, "MMMM yyyy"),
      });
    }
    return options;
  }, []);

  // Export to Excel
  const handleExport = () => {
    if (!wasteBreakdown.length || !selectedCustomer) return;

    const exportData = wasteBreakdown.map((w) => ({
      "Waste Description": w.wasteDescription,
      "EWC Code": w.ewc || "",
      "Weight (t)": Number(w.totalWeightT.toFixed(3)),
      "Job Count": w.jobCount,
    }));

    // Add totals row
    exportData.push({
      "Waste Description": "TOTAL",
      "EWC Code": "",
      "Weight (t)": Number(totals.totalWeightT.toFixed(3)),
      "Job Count": totals.totalJobs,
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Waste Breakdown");

    // Add summary sheet
    const summaryData = [
      { Field: "Customer", Value: selectedCustomer },
      { Field: "Period", Value: format(periodStart, "MMMM yyyy") },
      { Field: "Total Weight (t)", Value: totals.totalWeightT.toFixed(3) },
      { Field: "Total Jobs", Value: totals.totalJobs },
      { Field: "Generated", Value: format(new Date(), "dd/MM/yyyy HH:mm") },
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    const fileName = `DataHub_${selectedCustomer.replace(/[^a-zA-Z0-9]/g, "_")}_${format(periodStart, "yyyy-MM")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      {/* Selection Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data Hub Customer</Label>
          <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
            <SelectTrigger>
              <SelectValue placeholder="Select a customer from Data Hub..." />
            </SelectTrigger>
            <SelectContent>
              {loadingCustomers ? (
                <div className="p-2 text-center text-muted-foreground">
                  Loading customers...
                </div>
              ) : (
                customers?.map((customer) => (
                  <SelectItem key={customer} value={customer}>
                    {customer}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Lists all unique customer names found in Data Hub records
          </p>
        </div>

        <div className="space-y-2">
          <Label>Reporting Period</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {selectedCustomer && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {selectedCustomer} - {format(periodStart, "MMMM yyyy")}
              </CardTitle>
              <CardDescription>
                Waste breakdown from Data Hub records
              </CardDescription>
            </div>
            {wasteBreakdown.length > 0 && (
              <Button onClick={handleExport} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loadingJobs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : wasteBreakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>No records found for this customer in the selected period</p>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Weight</p>
                    <p className="text-2xl font-bold">{totals.totalWeightT.toFixed(2)}t</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Jobs</p>
                    <p className="text-2xl font-bold">{totals.totalJobs}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Waste Types</p>
                    <p className="text-2xl font-bold">{wasteBreakdown.length}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Avg Weight/Job</p>
                    <p className="text-2xl font-bold">
                      {totals.totalJobs > 0
                        ? (totals.totalWeightT / totals.totalJobs).toFixed(3)
                        : "0"}
                      t
                    </p>
                  </div>
                </div>

                {/* Breakdown Table */}
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waste Description</TableHead>
                        <TableHead>EWC Code</TableHead>
                        <TableHead className="text-right">Weight (t)</TableHead>
                        <TableHead className="text-right">Jobs</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wasteBreakdown.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {item.wasteDescription}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.ewc || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.totalWeightT.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.jobCount}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {totals.totalWeightT > 0
                              ? ((item.totalWeightT / totals.totalWeightT) * 100).toFixed(1)
                              : "0"}
                            %
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-mono">
                          {totals.totalWeightT.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right">
                          {totals.totalJobs}
                        </TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedCustomer && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Select a customer from Data Hub to generate a report
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This allows reporting on customers that haven't been set up in the system yet
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
