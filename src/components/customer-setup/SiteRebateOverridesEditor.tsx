import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, AlertTriangle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RebateItem = { id: string; name: string };

type Override = {
  id: string;
  rebate_item_id: string;
  start_date: string;
  end_date: string;
  set_value: number;
  notes: string | null;
};

type Props = {
  siteId: string;
  siteName: string;
};

export function SiteRebateOverridesEditor({ siteId, siteName }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebateItems, setRebateItems] = useState<RebateItem[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);

  // Form state for new override
  const [newItemId, setNewItemId] = useState("");
  const [newStart, setNewStart] = useState<Date | undefined>();
  const [newEnd, setNewEnd] = useState<Date | undefined>();
  const [newValue, setNewValue] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: items }, { data: ovs }] = await Promise.all([
        supabase.from("rebate_items").select("id, name").order("sort_order"),
        supabase
          .from("customer_site_rebate_overrides")
          .select("id, rebate_item_id, start_date, end_date, set_value, notes")
          .eq("site_id", siteId)
          .order("start_date", { ascending: false }),
      ]);
      setRebateItems((items ?? []) as RebateItem[]);
      setOverrides((ovs ?? []) as Override[]);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load overrides.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [siteId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const addOverride = async () => {
    if (!newItemId || !newStart || !newEnd || newValue.trim() === "") {
      toast({ title: "Missing fields", description: "Material, both dates, and value are required.", variant: "destructive" });
      return;
    }
    const num = parseFloat(newValue);
    if (isNaN(num)) {
      toast({ title: "Invalid value", description: "Value must be a number.", variant: "destructive" });
      return;
    }
    if (newEnd < newStart) {
      toast({ title: "Invalid dates", description: "End date must be on or after start date.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("customer_site_rebate_overrides")
        .insert({
          site_id: siteId,
          rebate_item_id: newItemId,
          start_date: format(newStart, "yyyy-MM-dd"),
          end_date: format(newEnd, "yyyy-MM-dd"),
          set_value: num,
          notes: newNotes.trim() || null,
        })
        .select("id, rebate_item_id, start_date, end_date, set_value, notes")
        .single();

      if (error) throw error;
      setOverrides((prev) => [data as Override, ...prev]);
      setNewItemId("");
      setNewStart(undefined);
      setNewEnd(undefined);
      setNewValue("");
      setNewNotes("");
      toast({ title: "Override added", description: "Rate override saved." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to add override.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("customer_site_rebate_overrides").delete().eq("id", id);
      if (error) throw error;
      setOverrides((prev) => prev.filter((o) => o.id !== id));
      toast({ title: "Removed", description: "Override deleted." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to remove override.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const itemName = (id: string) => rebateItems.find((i) => i.id === id)?.name ?? "Unknown";

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">Loading overrides...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <Label className="text-base font-medium">Rate Overrides</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Temporarily override the £/tonne rate for a specific material at <span className="font-medium">{siteName}</span> within
        a date window. When a load report's date falls inside the window, the override rate is used instead of the normal
        monthly rebate value.
      </p>

      {overrides.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{itemName(o.rebate_item_id)}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(o.start_date + "T00:00:00"), "d MMM yyyy")} →{" "}
                    {format(new Date(o.end_date + "T00:00:00"), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-sm">£{Number(o.set_value).toFixed(2)}/t</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.notes ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOverride(o.id)}
                      disabled={saving}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No rate overrides configured.</p>
      )}

      {/* Add new override */}
      <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
        <Label className="text-sm font-medium">Add Override</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Material</Label>
            <Select value={newItemId} onValueChange={setNewItemId} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                {rebateItems.map((ri) => (
                  <SelectItem key={ri.id} value={ri.id}>
                    {ri.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Start date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !newStart && "text-muted-foreground")}
                  disabled={saving}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newStart ? format(newStart, "d MMM yyyy") : "Pick"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={newStart} onSelect={setNewStart} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">End date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !newEnd && "text-muted-foreground")}
                  disabled={saving}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newEnd ? format(newEnd, "d MMM yyyy") : "Pick"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={newEnd} onSelect={setNewEnd} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rate (£/t)</Label>
            <Input
              type="number"
              step="0.01"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="35.00"
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="e.g. Q2 promo"
              disabled={saving}
            />
          </div>
        </div>
        <Button onClick={addOverride} disabled={saving} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Override
        </Button>
      </div>
    </div>
  );
}
