import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Loader2 } from "lucide-react";

type ReportingPeriod = {
  id: string;
  period_label: string;
  month_name: string;
  period_end_date: string;
  display_order: number;
};

interface CustomerReportingPeriodsEditorProps {
  customerId: string;
  customerName: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CustomerReportingPeriodsEditor({ customerId, customerName }: CustomerReportingPeriodsEditorProps) {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New period form
  const [newPeriodLabel, setNewPeriodLabel] = useState("");
  const [newMonthName, setNewMonthName] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const loadPeriods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_reporting_periods")
      .select("*")
      .eq("customer_id", customerId)
      .order("display_order");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPeriods(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPeriods();
  }, [customerId]);

  const addPeriod = async () => {
    if (!newPeriodLabel.trim() || !newMonthName.trim() || !newEndDate) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("customer_reporting_periods").insert({
        customer_id: customerId,
        period_label: newPeriodLabel.trim(),
        month_name: newMonthName.trim(),
        period_end_date: newEndDate,
        display_order: periods.length,
      });

      if (error) throw error;
      toast({ title: "Added", description: "Reporting period added." });
      setNewPeriodLabel("");
      setNewMonthName("");
      setNewEndDate("");
      await loadPeriods();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to add period.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deletePeriod = async (id: string) => {
    if (!confirm("Delete this reporting period?")) return;
    try {
      const { error } = await supabase.from("customer_reporting_periods").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Reporting period removed." });
      await loadPeriods();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to delete.", variant: "destructive" });
    }
  };

  const generateYearPeriods = async () => {
    const year = new Date().getFullYear();
    const entries = MONTH_NAMES.map((month, idx) => {
      const periodNum = String(idx + 1).padStart(2, "0");
      // Default end date: last day of the month
      const endDate = new Date(year, idx + 1, 0);
      return {
        customer_id: customerId,
        period_label: `${year}-${periodNum}`,
        month_name: month,
        period_end_date: endDate.toISOString().split("T")[0],
        display_order: idx,
      };
    });

    setSaving(true);
    try {
      const { error } = await supabase.from("customer_reporting_periods").insert(entries);
      if (error) throw error;
      toast({ title: "Generated", description: `12 periods created for ${year}. Edit end dates as needed.` });
      await loadPeriods();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to generate periods.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateEndDate = async (id: string, newDate: string) => {
    try {
      const { error } = await supabase
        .from("customer_reporting_periods")
        .update({ period_end_date: newDate })
        .eq("id", id);
      if (error) throw error;
      setPeriods((prev) =>
        prev.map((p) => (p.id === id ? { ...p, period_end_date: newDate } : p))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporting Periods</CardTitle>
          <CardDescription>
            Define custom reporting periods for {customerName}. Portal users will be able to search by these periods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {periods.length === 0 && (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">No reporting periods configured yet.</p>
              <Button variant="outline" onClick={generateYearPeriods} disabled={saving}>
                Generate {new Date().getFullYear()} Periods
              </Button>
            </div>
          )}

          {periods.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                 <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Period End Date</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.month_name}</TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={p.period_end_date}
                          onChange={(e) => updateEndDate(p.id, e.target.value)}
                          className="w-[160px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => deletePeriod(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Add new period */}
          <div className="flex flex-wrap gap-2 items-end border-t pt-4">
            <div className="space-y-1">
              <Label className="text-xs">Period Label</Label>
              <Input
                value={newPeriodLabel}
                onChange={(e) => setNewPeriodLabel(e.target.value)}
                placeholder="e.g. 2025-01"
                className="w-[120px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <Input
                value={newMonthName}
                onChange={(e) => setNewMonthName(e.target.value)}
                placeholder="e.g. April"
                className="w-[120px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <Button onClick={addPeriod} disabled={saving} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
