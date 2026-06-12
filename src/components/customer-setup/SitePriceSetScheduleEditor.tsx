import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PriceSet = { id: string; name: string };

type ScheduleRow = {
  id: string;
  price_set_id: string;
  effective_from: string;
  effective_to: string | null;
};

interface SitePriceSetScheduleEditorProps {
  siteId: string;
  priceSets: PriceSet[];
  /** Called after changes so parent can refresh its "current" price-set state. */
  onChanged?: () => void;
}

/**
 * Manages the effective-dated rebate charging models for a site.
 * Each row assigns a price set for a date window so old and new models apply
 * automatically based on the reporting period — no manual report locking needed.
 */
export const SitePriceSetScheduleEditor = ({ siteId, priceSets, onChanged }: SitePriceSetScheduleEditorProps) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("customer_site_price_sets")
      .select("id, price_set_id, effective_from, effective_to")
      .eq("site_id", siteId)
      .order("effective_from", { ascending: true });
    setRows((data ?? []) as ScheduleRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const nameFor = (id: string) => priceSets.find((p) => p.id === id)?.name ?? "Unknown";

  const updateRow = async (id: string, patch: Partial<ScheduleRow>) => {
    const { error } = await supabase.from("customer_site_price_sets").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await load();
    onChanged?.();
  };

  const addRow = async () => {
    if (priceSets.length === 0) {
      toast({ title: "No rebate sets", description: "Create a rebate set first.", variant: "destructive" });
      return;
    }
    // Default new period to start the day after the latest existing period, or today.
    const today = new Date().toISOString().slice(0, 10);
    const latest = rows[rows.length - 1];
    let from = today;
    if (latest) {
      const base = latest.effective_to ?? latest.effective_from;
      const d = new Date(base);
      d.setDate(d.getDate() + 1);
      from = d.toISOString().slice(0, 10);
    }
    const { error } = await supabase
      .from("customer_site_price_sets")
      .insert({ site_id: siteId, price_set_id: priceSets[0].id, effective_from: from, effective_to: null });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await load();
    onChanged?.();
  };

  const deleteRow = async (id: string) => {
    const { error } = await supabase.from("customer_site_price_sets").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await load();
    onChanged?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <Label className="text-base font-medium">Rebate Charging Periods</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Assign different rebate sets over time. The report period decides which model applies, so historical
        reports keep the old model automatically. Leave “To” blank for the current, ongoing model.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
          No dated periods yet. Add one to switch charging models on a specific date.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end rounded-md border p-3">
              <div className="grid gap-1">
                <Label className="text-xs">Rebate Set</Label>
                <Select value={row.price_set_id} onValueChange={(v) => updateRow(row.id, { price_set_id: v })}>
                  <SelectTrigger><SelectValue>{nameFor(row.price_set_id)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {priceSets.map((ps) => (
                      <SelectItem key={ps.id} value={ps.id}>{ps.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={row.effective_from}
                  onChange={(e) => updateRow(row.id, { effective_from: e.target.value })}
                  className="w-[150px]"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">To (optional)</Label>
                <Input
                  type="date"
                  value={row.effective_to ?? ""}
                  onChange={(e) => updateRow(row.id, { effective_to: e.target.value || null })}
                  className="w-[150px]"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => deleteRow(row.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
        <Plus className="h-4 w-4" /> Add period
      </Button>
    </div>
  );
};
