import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

type RebateItem = {
  id: string;
  name: string;
  sort_order: number;
};

type PriceSetItem = {
  id: string;
  price_set_id: string;
  rebate_item_id: string;
  display_order: number;
  value_type: "lower" | "higher" | "set";
  set_value: number | null;
};

type Props = {
  priceSetId: string;
  priceSetName: string;
};

export function SiteRebateItemsEditor({ priceSetId, priceSetName }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allItems, setAllItems] = useState<RebateItem[]>([]);
  const [priceSetItems, setPriceSetItems] = useState<PriceSetItem[]>([]);

  const [selectedItemId, setSelectedItemId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: items, error: itemsError }, { data: psItems, error: psItemsError }] = await Promise.all([
        supabase.from("rebate_items").select("id, name, sort_order").order("sort_order", { ascending: true }),
        supabase
          .from("rebate_price_set_items")
          .select("id, price_set_id, rebate_item_id, display_order, value_type, set_value")
          .eq("price_set_id", priceSetId)
          .order("display_order", { ascending: true }),
      ]);

      if (itemsError) throw itemsError;
      if (psItemsError) throw psItemsError;

      setAllItems((items ?? []) as RebateItem[]);
      setPriceSetItems((psItems ?? []) as PriceSetItem[]);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load rebate items.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [priceSetId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const usedItemIds = new Set(priceSetItems.map((p) => p.rebate_item_id));
  const availableItems = allItems.filter((item) => !usedItemIds.has(item.id));

  const addItem = async () => {
    if (!selectedItemId) return;
    setSaving(true);
    try {
      const maxOrder = priceSetItems.reduce((max, p) => Math.max(max, p.display_order), 0);
      const { data, error } = await supabase
        .from("rebate_price_set_items")
        .insert({
          price_set_id: priceSetId,
          rebate_item_id: selectedItemId,
          display_order: maxOrder + 10,
          value_type: "lower",
          set_value: null,
        })
        .select("id, price_set_id, rebate_item_id, display_order, value_type, set_value")
        .single();

      if (error) throw error;
      setPriceSetItems((prev) => [...prev, data as PriceSetItem]);
      setSelectedItemId("");
      toast({ title: "Added", description: "Rebate item added to this set." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to add item.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateItemValueType = async (itemId: string, valueType: "lower" | "higher" | "set", setValue?: number | null) => {
    setSaving(true);
    try {
      const updatePayload: Partial<PriceSetItem> = { value_type: valueType };
      if (valueType === "set" && setValue !== undefined) {
        updatePayload.set_value = setValue;
      } else if (valueType !== "set") {
        updatePayload.set_value = null;
      }

      const { error } = await supabase.from("rebate_price_set_items").update(updatePayload).eq("id", itemId);

      if (error) throw error;

      setPriceSetItems((prev) =>
        prev.map((p) =>
          p.id === itemId
            ? { ...p, value_type: valueType, set_value: valueType === "set" ? (setValue ?? p.set_value) : null }
            : p
        )
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update item.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateSetValue = async (itemId: string, value: string) => {
    const numValue = value.trim() === "" ? null : parseFloat(value);
    if (value.trim() !== "" && isNaN(numValue!)) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("rebate_price_set_items").update({ set_value: numValue }).eq("id", itemId);

      if (error) throw error;

      setPriceSetItems((prev) => prev.map((p) => (p.id === itemId ? { ...p, set_value: numValue } : p)));
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update value.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("rebate_price_set_items").delete().eq("id", itemId);

      if (error) throw error;

      setPriceSetItems((prev) => prev.filter((p) => p.id !== itemId));
      toast({ title: "Removed", description: "Rebate item removed from this set." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to remove item.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getItemName = (rebateItemId: string) => {
    return allItems.find((i) => i.id === rebateItemId)?.name ?? "Unknown";
  };

  const getValueTypeLabel = (valueType: string) => {
    switch (valueType) {
      case "lower":
        return "Lower Amount";
      case "higher":
        return "Upper Amount";
      case "set":
        return "Set Value";
      default:
        return valueType;
    }
  };

  const getValueTypeBadgeVariant = (valueType: string): "default" | "secondary" | "outline" => {
    switch (valueType) {
      case "lower":
        return "secondary";
      case "higher":
        return "default";
      case "set":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">Loading rebate items...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Rebate Items for "{priceSetName}"</Label>
      </div>

      {priceSetItems.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Value Type</TableHead>
                <TableHead>Set Value (£)</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceSetItems.map((psi) => (
                <TableRow key={psi.id}>
                  <TableCell className="font-medium">{getItemName(psi.rebate_item_id)}</TableCell>
                  <TableCell>
                    <Select
                      value={psi.value_type}
                      onValueChange={(val) => updateItemValueType(psi.id, val as "lower" | "higher" | "set")}
                      disabled={saving}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lower">
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Lower</Badge>
                            Amount
                          </span>
                        </SelectItem>
                        <SelectItem value="higher">
                          <span className="flex items-center gap-2">
                            <Badge variant="default" className="text-xs">Upper</Badge>
                            Amount
                          </span>
                        </SelectItem>
                        <SelectItem value="set">
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Set</Badge>
                            Value
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {psi.value_type === "set" ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24"
                        value={psi.set_value ?? ""}
                        onChange={(e) => updateSetValue(psi.id, e.target.value)}
                        placeholder="0.00"
                        disabled={saving}
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(psi.id)}
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
      )}

      {priceSetItems.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No rebate items configured for this set yet.</p>
      )}

      {availableItems.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-sm">Add material</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder="Select a material to add" />
              </SelectTrigger>
              <SelectContent>
                {availableItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addItem} disabled={!selectedItemId || saving} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}

      {availableItems.length === 0 && priceSetItems.length > 0 && (
        <p className="text-xs text-muted-foreground">All available materials have been added.</p>
      )}
    </div>
  );
}
