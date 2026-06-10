import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";
import * as XLSX from "xlsx";
import { ReportingPeriodQuickSelect } from "./ReportingPeriodQuickSelect";

interface POChangeRecord {
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  order_number_override: string | null;
  raw: unknown;
  container_type: string | null;
  waste_description: string | null;
  weight_t: number | null;
}

export const POCheckReport = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<POChangeRecord[]>([]);
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hasSearched, setHasSearched] = useState(false);

  const getOriginalOrderNumber = (job: POChangeRecord): string | null => {
    const rawObj = job.raw && typeof job.raw === "object" && !Array.isArray(job.raw)
      ? (job.raw as Record<string, unknown>)
      : null;
    if (!rawObj) return null;
    const orderNo = rawObj["Order No."] ?? rawObj["Order No"] ?? rawObj["order_no"] ?? rawObj["OrderNo"] ?? rawObj["PO Number"] ?? rawObj["PO"];
    return orderNo ? String(orderNo).trim() : null;
  };

  const fetchPOChanges = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const allRecords: POChangeRecord[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_number, job_date, customer, site, order_number_override, raw, container_type, waste_description, weight_t")
          .not("order_number_override", "is", null)
          .gte("job_date", startDate)
          .lte("job_date", endDate)
          .order("job_date", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (data) allRecords.push(...data);
        hasMore = (data?.length || 0) === pageSize;
        from += pageSize;
      }

      // Filter to only those where override actually differs from original
      const changed = allRecords.filter((job) => {
        const original = getOriginalOrderNumber(job);
        const override = job.order_number_override?.trim();
        return override && override !== (original || "");
      });

      setRecords(changed);
      if (changed.length === 0) {
        toast.info("No PO changes found in the selected period");
      } else {
        toast.success(`Found ${changed.length} PO change(s)`);
      }
    } catch (err: any) {
      console.error("Error fetching PO changes:", err);
      toast.error("Failed to fetch PO changes");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (records.length === 0) return;

    const rows = records.map((job) => ({
      "Job Date": job.job_date || "",
      "Job Number": job.job_number,
      "Customer": job.customer || "",
      "Site": job.site || "",
      "Original PO": getOriginalOrderNumber(job) || "",
      "Updated PO": job.order_number_override?.trim() || "",
      "Container Type": job.container_type || "",
      "Waste Description": job.waste_description || "",
      "Weight (t)": job.weight_t ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PO Changes");
    XLSX.writeFile(wb, `PO_Changes_${startDate}_to_${endDate}.xlsx`);
    toast.success("Excel exported");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PO Change Check</CardTitle>
        <CardDescription>
          View all jobs where a customer has updated the PO/Order Number via the portal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          <ReportingPeriodQuickSelect
            allCustomers
            label="Reporting Period"
            onSelect={(from, to) => {
              setStartDate(format(from, "yyyy-MM-dd"));
              setEndDate(format(to, "yyyy-MM-dd"));
            }}
          />
          <Button onClick={fetchPOChanges} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            Check PO Changes
          </Button>
          {records.length > 0 && (
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          )}
        </div>

        {hasSearched && (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Date</TableHead>
                  <TableHead>Job Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Original PO</TableHead>
                  <TableHead>Updated PO</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Waste</TableHead>
                  <TableHead className="text-right">Weight (t)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No PO changes found
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((job, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="whitespace-nowrap">{job.job_date || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{job.job_number}</TableCell>
                      <TableCell>{job.customer || "—"}</TableCell>
                      <TableCell>{job.site || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {getOriginalOrderNumber(job) || <em>Not set</em>}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-green-700">
                        {job.order_number_override?.trim() || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{job.container_type || "—"}</TableCell>
                      <TableCell className="text-xs">{job.waste_description || "—"}</TableCell>
                      <TableCell className="text-right">{job.weight_t?.toFixed(2) ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
