import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, CalendarClock, Pencil, CheckCircle2, Copy, AlertTriangle } from "lucide-react";
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
  onSelectPeriod?: (priceSetId: string, label?: string) => void;
  /** Called after price sets change so the parent can reload its rebate-set list. */
  onPriceSetsChanged?: () => void | Promise<void>;
  /** Called after schedule rows change so parent can refresh its "current" state. */
  onChanged?: () => void;
}

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const windowLabel = (from: string, to: string | null) =>
  `${formatDate(from) ?? "—"} → ${formatDate(to) ?? "ongoing"}`;

/**
 * Manages the effective-dated rebate charging models for a site.
 *
 * Each period gets its OWN dedicated rebate set so editing one period's values
 * never affects another period (or historical reporting). When you add a period
 * we duplicate the most recent period's values into a brand-new rebate set, then
 * you edit that copy independently.
 */
export const SitePriceSetScheduleEditor = ({
  siteId,
  priceSets,
  selectedPriceSetId,
  onSelectPeriod,
  onPriceSetsChanged,
  onChanged,
}: SitePriceSetScheduleEditorProps) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

  /**
   * Create a brand-new rebate set that is an exact copy of `sourceId`'s values.
   * Returns the new price set id. If `sourceId` is empty an empty set is created.
   */
  const duplicatePriceSet = async (sourceId: string | undefined, fromDate: string): Promise<string | null> => {
    const baseName = sourceId ? nameFor(sourceId) : "Rebate Set";
    const cleanBase = baseName.replace(/\s*\(from \d{2}\/\d{2}\/\d{4}\)\s*$/i, "");
    const newName = `${cleanBase} (from ${formatDate(fromDate)})`;

    const { data: created, error } = await supabase
      .from("rebate_price_sets")
      .insert({ name: newName })
      .select("id")
      .single();
    if (error || !created) {
      toast({ title: "Error", description: error?.message ?? "Failed to create rebate set.", variant: "destructive" });
      return null;
    }

    if (sourceId) {
      const { data: items } = await supabase
        .from("rebate_price_set_items")
        .select("rebate_item_id, value_type_item_id, display_order, value_type, set_value, adjustment")
        .eq("price_set_id", sourceId);
      if (items && items.length > 0) {
        const copies = items.map((it: any) => ({ ...it, price_set_id: created.id }));
        const { error: itemsError } = await supabase.from("rebate_price_set_items").insert(copies);
        if (itemsError) {
          toast({ title: "Error", description: itemsError.message, variant: "destructive" });
        }
      }
    }
    return created.id;
  };

  const addRow = async () => {
    setBusy(true);
    try {
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

      // Always give the new period its OWN dedicated rebate set so its values are
      // unique. Duplicate the latest period's values (or the currently selected set)
      // as a convenient starting point.
      const sourceId = latest?.price_set_id ?? selectedPriceSetId ?? priceSets[0]?.id;
      const newSetId = await duplicatePriceSet(sourceId, from);
      if (!newSetId) return;

      const { error } = await supabase
        .from("customer_site_price_sets")
        .insert({ site_id: siteId, price_set_id: newSetId, effective_from: from, effective_to: null });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }

      await onPriceSetsChanged?.();
      await load();
      onChanged?.();
      onSelectPeriod?.(newSetId, windowLabel(from, null));
      toast({ title: "Period added", description: "A new dedicated rebate set was created for this period." });
    } finally {
      setBusy(false);
    }
  };

  /** Give a shared period its own copy of the values so edits no longer affect siblings. */
  const splitToOwnSet = async (row: ScheduleRow) => {
    setBusy(true);
    try {
      const newSetId = await duplicatePriceSet(row.price_set_id, row.effective_from);
      if (!newSetId) return;
      const { error } = await supabase
        .from("customer_site_price_sets")
        .update({ price_set_id: newSetId })
        .eq("id", row.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      await onPriceSetsChanged?.();
      await load();
      onChanged?.();
      onSelectPeriod?.(newSetId, windowLabel(row.effective_from, row.effective_to));
      toast({ title: "Period split", description: "This period now has its own rebate values." });
    } finally {
      setBusy(false);
    }
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
        Assign a charging model to each date range. The report period decides which model applies, so historical
        reports keep their old values automatically. Leave “To” blank for the current, ongoing model.{" "}
        <span className="font-medium text-foreground">Each period has its own rebate set</span> — click
        “Edit values” on a period to change just that period’s amounts below.
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
            return (
              <div
                key={row.id}
                className={cn(
                  "rounded-md border p-3 transition-colors",
                  isSelected ? "border-primary ring-2 ring-primary bg-primary/5" : "border-border"
                )}
              >
                {/* Period header: which window this row covers + selected state */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-xs text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span>{windowLabel(row.effective_from, row.effective_to)}</span>
                    <span className="text-xs font-normal text-muted-foreground">· {nameFor(row.price_set_id)}</span>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Editing below
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteRow(row.id)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <div className="grid gap-1">
                    <Label className="text-xs">Rebate Set</Label>
                    <Select
                      value={row.price_set_id}
                      onValueChange={(v) => updateRow(row.id, { price_set_id: v })}
                      disabled={busy}
                    >
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
                      disabled={busy}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">To (optional)</Label>
                    <Input
                      type="date"
                      value={row.effective_to ?? ""}
                      onChange={(e) => updateRow(row.id, { effective_to: e.target.value || null })}
                      className="w-[150px]"
                      disabled={busy}
                    />
                  </div>
                </div>

                {shared && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      This period shares the same rebate set as another period, so editing values changes both
                      (including past reporting).{" "}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-[11px] text-amber-800 font-semibold underline"
                        onClick={() => splitToOwnSet(row)}
                        disabled={busy}
                      >
                        Give this period its own copy
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 mt-2">
                  <Button
                    type="button"
                    variant={isSelected ? "secondary" : "outline"}
                    size="sm"
                    className="gap-2 shrink-0"
                    onClick={() => onSelectPeriod?.(row.price_set_id, windowLabel(row.effective_from, row.effective_to))}
                    disabled={busy}
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

      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-2" disabled={busy}>
        <Plus className="h-4 w-4" /> Add period
      </Button>
    </div>
  );
};
