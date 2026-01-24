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

type WasteType = {
  id: string;
  waste_type: string;
  display_order: number;
};

type PriceSetItem = {
  id: string;
  price_set_id: string;
  rebate_item_id: string; // Actually references load_waste_types.id now
  display_order: number;
  value_type: "lower" | "higher" | "set";
  set_value: number | null;
};

type Props = {
  priceSetId: string;
  priceSetName: string;
  loadReportType: string;
};

export function SiteRebateItemsEditor({ priceSetId, priceSetName, loadReportType }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allMaterials, setAllMaterials] = useState<WasteType[]>([]);
  const [priceSetItems, setPriceSetItems] = useState<PriceSetItem[]>([]);

  const [selectedMaterialId, setSelectedMaterialId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load waste types from load_waste_types (materials for the load report)
      const [{ data: materials, error: materialsError }, { data: psItems, error: psItemsError }] = await Promise.all([
        supabase
          .from("load_waste_types")
          .select("id, waste_type, display_order")
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
        supabase
          .from("rebate_price_set_items")
          .select("id, price_set_id, rebate_item_id, display_order, value_type, set_value")
          .eq("price_set_id", priceSetId)
          .order("display_order", { ascending: true }),
      ]);

      if (materialsError) throw materialsError;
      if (psItemsError) throw psItemsError;

      setAllMaterials((materials ?? []) as WasteType[]);
      setPriceSetItems((psItems ?? []) as PriceSetItem[]);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load materials.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [priceSetId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const usedMaterialIds = new Set(priceSetItems.map((p) => p.rebate_item_id));
  const availableMaterials = allMaterials.filter((m) => !usedMaterialIds.has(m.id));

  const addMaterial = async () => {
    if (!selectedMaterialId) return;
    setSaving(true);
    try {
      const maxOrder = priceSetItems.reduce((max, p) => Math.max(max, p.display_order), 0);
      const { data, error } = await supabase
        .from("rebate_price_set_items")
        .insert({
          price_set_id: priceSetId,
          rebate_item_id: selectedMaterialId,
          display_order: maxOrder + 10,
          value_type: "lower",
          set_value: null,
        })
        .select("id, price_set_id, rebate_item_id, display_order, value_type, set_value")
        .single();

      if (error) throw error;
      setPriceSetItems((prev) => [...prev, data as PriceSetItem]);
      setSelectedMaterialId("");
      toast({ title: "Added", description: "Material added to rebate set." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to add material.", variant: "destructive" });
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
      toast({ title: "Error", description: e?.message ?? "Failed to update material.", variant: "destructive" });
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

  const removeMaterial = async (itemId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("rebate_price_set_items").delete().eq("id", itemId);

      if (error) throw error;

      setPriceSetItems((prev) => prev.filter((p) => p.id !== itemId));
      toast({ title: "Removed", description: "Material removed from rebate set." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to remove material.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getMaterialName = (materialId: string) => {
    return allMaterials.find((m) => m.id === materialId)?.waste_type ?? "Unknown";
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">Loading materials...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Rebate Values for "{priceSetName}"</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Materials from {loadReportType.toUpperCase()} report type
          </p>
        </div>
      </div>

      {priceSetItems.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Value Type</TableHead>
                <TableHead>Set Value (£/tonne)</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceSetItems.map((psi) => (
                <TableRow key={psi.id}>
                  <TableCell className="font-medium">{getMaterialName(psi.rebate_item_id)}</TableCell>
                  <TableCell>
                    <Select
                      value={psi.value_type}
                      onValueChange={(val) => updateItemValueType(psi.id, val as "lower" | "higher" | "set")}
                      disabled={saving}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lower">
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Lower</Badge>
                            Range
                          </span>
                        </SelectItem>
                        <SelectItem value="higher">
                          <span className="flex items-center gap-2">
                            <Badge variant="default" className="text-xs">Higher</Badge>
                            Range
                          </span>
                        </SelectItem>
                        <SelectItem value="set">
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Fixed</Badge>
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
                        className="w-28"
                        value={psi.set_value ?? ""}
                        onChange={(e) => updateSetValue(psi.id, e.target.value)}
                        placeholder="e.g. -74"
                        disabled={saving}
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm italic">
                        Uses {psi.value_type === "lower" ? "lower" : "higher"} range from Rebate Values
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMaterial(psi.id)}
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
        <p className="text-sm text-muted-foreground py-2">No materials configured for this rebate set yet.</p>
      )}

      {availableMaterials.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-sm">Add material</Label>
            <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder="Select a material to add" />
              </SelectTrigger>
              <SelectContent>
                {availableMaterials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.waste_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addMaterial} disabled={!selectedMaterialId || saving} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}

      {availableMaterials.length === 0 && priceSetItems.length > 0 && (
        <p className="text-xs text-muted-foreground">All available materials have been added.</p>
      )}
    </div>
  );
}
