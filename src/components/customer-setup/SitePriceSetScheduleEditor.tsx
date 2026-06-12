import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, CalendarClock, Pencil, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  /** The price set whose rebate values are currently being configured below. */
  selectedPriceSetId?: string;
  /** Select a period to edit its rebate values in the configuration section below. */
  onSelectPeriod?: (priceSetId: string) => void;
  /** Called after changes so parent can refresh its "current" price-set state. */
  onChanged?: () => void;
}

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

/**
 * Manages the effective-dated rebate charging models for a site.
 * Each row assigns a price set for a date window so old and new models apply
 * automatically based on the reporting period — no manual report locking needed.
 */
export const SitePriceSetScheduleEditor = ({
  siteId,
  priceSets,
  selectedPriceSetId,
  onSelectPeriod,
  onChanged,
}: SitePriceSetScheduleEditorProps) => {
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
    if (patch.price_set_id) onSelectPeriod?.(patch.price_set_id);
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

  // How many periods use each price set — used to warn about shared configuration.
  const usageCount = (priceSetId: string) => rows.filter((r) => r.price_set_id === priceSetId).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <Label className="text-base font-medium">Rebate Charging Periods</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Assign different rebate sets over time. The report period decides which model applies, so historical
        reports keep the old model automatically. Leave “To” blank for the current, ongoing model.{" "}
        <span className="font-medium text-foreground">Click “Edit values” on a period</span> to configure its
        rebate amounts below.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
          No dated periods yet. Add one to switch charging models on a specific date.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => {
            const isSelected = selectedPriceSetId === row.price_set_id;
            const shared = usageCount(row.price_set_id) > 1;
            const fromLabel = formatDate(row.effective_from) ?? "—";
            const toLabel = formatDate(row.effective_to) ?? "ongoing";
            return (
              <div
                key={row.id}
                className={cn(
                  "rounded-md border p-3 transition-colors",
                  isSelected ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border"
                )}
              >
                {/* Period header: which window this row covers + selected state */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-xs text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span>
                      {fromLabel} → {toLabel}
                    </span>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Editing values below
                      </span>
                    )}
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

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <div className="grid gap-1">
                    <Label className="text-xs">Rebate Set</Label>
                    <Select value={row.price_set_id} onValueChange={(v) => updateRow(row.id, { price_set_id: v })}>
                      <SelectTrigger>
                        <SelectValue>{nameFor(row.price_set_id)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {priceSets.map((ps) => (
                          <SelectItem key={ps.id} value={ps.id}>
                            {ps.name}
                          </SelectItem>
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
                </div>

                <div className="flex items-center justify-between gap-2 mt-2">
                  {shared ? (
                    <p className="text-[11px] text-amber-600">
                      Shares the same rebate set as another period — editing values affects both. Use a different
                      rebate set to give this period its own values.
                    </p>
                  ) : (
                    <span />
                  )}
                  <Button
                    type="button"
                    variant={isSelected ? "secondary" : "outline"}
                    size="sm"
                    className="gap-2 shrink-0"
                    onClick={() => onSelectPeriod?.(row.price_set_id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {isSelected ? "Editing values" : "Edit values"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2">
        <Plus className="h-4 w-4" /> Add period
      </Button>
    </div>
  );
};
