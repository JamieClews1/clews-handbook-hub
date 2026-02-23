import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Package, Settings, Calendar, User, Trash2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StockReport {
  id: string;
  report_date: string;
  operator_name: string;
  total_on_stock: number;
  total_out: number;
  created_at: string;
}

interface StockReportsListProps {
  onNewReport: () => void;
  onSettings: () => void;
  onViewReport: (reportId: string) => void;
}

export default function StockReportsList({ onNewReport, onSettings, onViewReport }: StockReportsListProps) {
  const [reports, setReports] = useState<StockReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stock_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setReports((data as StockReport[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      // Delete items first, then the report
      await supabase.from("stock_report_items").delete().eq("stock_report_id", deleteId);
      const { error } = await supabase.from("stock_reports").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Report deleted");
      setReports((prev) => prev.filter((r) => r.id !== deleteId));
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete report");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Stock Reports</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSettings} className="gap-1.5">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button size="sm" onClick={onNewReport} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Report
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No stock reports yet</p>
          <p className="text-sm">Tap "New Report" to start your first stock tally</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card
              key={report.id}
              className="border border-border/60 shadow-sm cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => onViewReport(report.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {format(new Date(report.report_date), "EEEE, d MMM yyyy")}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {report.operator_name}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-lg font-bold tabular-nums text-foreground">{report.total_on_stock}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Stock</div>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div>
                      <div className="text-lg font-bold tabular-nums text-amber-600">{report.total_out}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">Out</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(report.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Report?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this stock report and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
