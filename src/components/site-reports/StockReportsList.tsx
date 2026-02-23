import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Package, Settings, Calendar, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
}

export default function StockReportsList({ onNewReport, onSettings }: StockReportsListProps) {
  const [reports, setReports] = useState<StockReport[]>([]);
  const [loading, setLoading] = useState(true);

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
            <Card key={report.id} className="border border-border/60 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
