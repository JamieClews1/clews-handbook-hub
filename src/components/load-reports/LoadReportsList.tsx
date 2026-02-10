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
import { Plus, Search, Eye, Pencil, Download, Truck, Filter, Settings, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LoadReportSettings } from "./LoadReportSettings";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getWeighbridgeSource, convertWeightToTonnes } from "@/lib/weighbridge-source";

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
  weighbridge_weight_kg?: number | null;
  customer_name?: string | null;
}

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
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo, customerType]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // First, get site IDs that match the customer type
      let siteIds: string[] = [];
      
      if (customerType) {
        let siteQuery = supabase
          .from("customer_sites")
          .select("id, load_report_type");

        if (customerType !== "other") {
          siteQuery = siteQuery.eq("load_report_type", customerType);
        } else {
          // Standard reports: sites with null/empty load_report_type or explicitly "other"
          siteQuery = siteQuery.or("load_report_type.is.null,load_report_type.eq.,load_report_type.eq.other");
        }

        const { data: siteData } = await siteQuery;
        siteIds = siteData?.map(s => s.id) || [];
      }

      // Build the reports query
      let query = supabase
        .from("load_reports")
        .select("*, customer_sites(site_name, customers(customer_name))")
        .gte("report_date", dateFrom)
        .lte("report_date", dateTo)
        .order("report_date", { ascending: false });

      // Filter by site_ids if we have a customer type selected
      if (customerType && siteIds.length > 0) {
        query = query.in("site_id", siteIds);
      } else if (customerType && siteIds.length === 0) {
        // No sites match this customer type, return empty
        setReports([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch weighbridge data for reports with job numbers in notes
      const jobNumbers = (data || [])
        .map((r) => r.notes?.trim())
        .filter((n): n is string => !!n);

      let weighbridgeMap: Record<string, number> = {};
      if (jobNumbers.length > 0) {
        // Determine the source based on customer type
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
              acc[job.job_number] = weightInTonnes * 1000; // Convert tonnes to kg for display
            }
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Attach weighbridge weights to reports
      const reportsWithWeighbridge = (data || []).map((report: any) => ({
        ...report,
        weighbridge_weight_kg: report.notes?.trim() ? weighbridgeMap[report.notes.trim()] ?? null : null,
        customer_name: report.customer_sites?.customers?.customer_name ?? null,
      }));

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

  const needsReconciliation = (report: LoadReport) => {
    if (report.weighbridge_weight_kg == null) return false;
    const difference = Math.abs(report.total_weight_kg - report.weighbridge_weight_kg);
    return difference > 50; // 50kg tolerance
  };

  const filteredReports = reports.filter((report) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (report.customer_name?.toLowerCase().includes(searchLower) ?? false) ||
      (report.notes?.toLowerCase().includes(searchLower) ?? false) ||
      (report.vehicle_reg?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  const exportCSV = () => {
    const headers = ["Date", "Customer", "Job Number", "Vehicle", "Pallets", "Weight (KG)", "Status"];
    const rows = filteredReports.map((r) => [
      format(new Date(r.report_date), "dd/MM/yyyy"),
      r.customer_name || "",
      r.notes || "",
      r.vehicle_reg || "",
      r.total_pallets.toString(),
      r.total_weight_kg.toString(),
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

  const getStatusBadge = (status: string, report: LoadReport) => {
    const showReconciliation = needsReconciliation(report);
    
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
                  Report: {(report.total_weight_kg / 1000).toFixed(2)}t, 
                  Weighbridge: {((report.weighbridge_weight_kg ?? 0) / 1000).toFixed(2)}t
                </p>
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
              placeholder="Search by customer, job number or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
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
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden sm:table-cell">Job Number</TableHead>
                  <TableHead className="hidden md:table-cell">Vehicle</TableHead>
                  <TableHead className="text-center">Pallets</TableHead>
                  <TableHead className="text-right">Weight (KG)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {format(new Date(report.report_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{report.customer_name || "-"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {report.notes || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {report.vehicle_reg || "-"}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {report.total_pallets}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {report.total_weight_kg.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(report.status, report)}
                    </TableCell>
                    <TableCell className="text-right">
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
    </div>
  );
};
