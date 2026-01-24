import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

type WasteType = {
  id: string;
  waste_type: string;
  display_order: number;
};

type RebateItem = {
  id: string;
  name: string;
  sort_order: number;
};

type PriceSetItem = {
  id: string;
  price_set_id: string;
  material_id: string; // references load_waste_types.id (stored in rebate_item_id column)
  value_type_item_id: string; // references rebate_items.id, or "__custom__" for custom values
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
  const [allRebateItems, setAllRebateItems] = useState<RebateItem[]>([]);
  const [priceSetItems, setPriceSetItems] = useState<PriceSetItem[]>([]);

  const [selectedMaterialId, setSelectedMaterialId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: materials, error: materialsError },
        { data: rebateItems, error: rebateItemsError },
        { data: psItems, error: psItemsError }
      ] = await Promise.all([
        supabase
          .from("load_waste_types")
          .select("id, waste_type, display_order")
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
        supabase
          .from("rebate_items")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true }),
        supabase
          .from("rebate_price_set_items")
          .select("id, price_set_id, rebate_item_id, display_order, value_type, set_value")
          .eq("price_set_id", priceSetId)
          .order("display_order", { ascending: true }),
      ]);

      if (materialsError) throw materialsError;
      if (rebateItemsError) throw rebateItemsError;
      if (psItemsError) throw psItemsError;

      setAllMaterials((materials ?? []) as WasteType[]);
      setAllRebateItems((rebateItems ?? []) as RebateItem[]);
      
      // Fetch the value_type_item_id separately since types haven't regenerated
      let valueTypeItemMap: Record<string, string | null> = {};
      
      for (const item of psItems ?? []) {
        const { data: rawItem } = await supabase
          .from("rebate_price_set_items")
          .select("*")
          .eq("id", (item as any).id)
          .single();
        if (rawItem) {
          valueTypeItemMap[(item as any).id] = (rawItem as any).value_type_item_id || null;
        }
      }
      
      // Map DB structure to our local type
      const mappedItems = (psItems ?? []).map((item: any) => {
        const valueTypeItemId = valueTypeItemMap[item.id];
        // If value_type is "set" and no value_type_item_id, it's a custom value
        const isCustom = item.value_type === "set" && !valueTypeItemId;
        
        return {
          id: item.id,
          price_set_id: item.price_set_id,
          material_id: item.rebate_item_id,
          value_type_item_id: isCustom ? "__custom__" : (valueTypeItemId || ""),
          display_order: item.display_order,
          value_type: item.value_type as "lower" | "higher" | "set",
          set_value: item.set_value,
        };
      });
      
      setPriceSetItems(mappedItems);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [priceSetId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const usedMaterialIds = new Set(priceSetItems.map((p) => p.material_id));
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
        } as any)
        .select("id, price_set_id, rebate_item_id, display_order, value_type, set_value")
        .single();

      if (error) throw error;
      
      const newItem: PriceSetItem = {
        id: (data as any).id,
        price_set_id: (data as any).price_set_id,
        material_id: (data as any).rebate_item_id,
        value_type_item_id: "",
        display_order: (data as any).display_order,
        value_type: (data as any).value_type as "lower" | "higher" | "set",
        set_value: (data as any).set_value,
      };
      
      setPriceSetItems((prev) => [...prev, newItem]);
      setSelectedMaterialId("");
      toast({ title: "Added", description: "Material added to rebate set." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to add material.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateValueTypeItem = async (itemId: string, value: string) => {
    setSaving(true);
    try {
      const isCustom = value === "__custom__";
      
      // If custom, clear value_type_item_id and set value_type to "set"
      // If selecting a rebate item, set value_type_item_id and reset to "lower"
      const updateData: any = isCustom
        ? { value_type_item_id: null, value_type: "set", set_value: null }
        : { value_type_item_id: value || null, value_type: "lower", set_value: null };
      
      const { error } = await supabase
        .from("rebate_price_set_items")
        .update(updateData)
        .eq("id", itemId);

      if (error) throw error;

      setPriceSetItems((prev) =>
        prev.map((p) => (p.id === itemId 
          ? { 
              ...p, 
              value_type_item_id: value,
              value_type: isCustom ? "set" : "lower",
              set_value: null,
            } 
          : p
        ))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update value type.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateRange = async (itemId: string, range: "lower" | "higher") => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("rebate_price_set_items")
        .update({ value_type: range, set_value: null })
        .eq("id", itemId);

      if (error) throw error;

      setPriceSetItems((prev) =>
        prev.map((p) => (p.id === itemId ? { ...p, value_type: range, set_value: null } : p))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update range.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateCustomValue = async (itemId: string, value: string) => {
    const numValue = value.trim() === "" ? null : parseFloat(value);
    if (value.trim() !== "" && isNaN(numValue!)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("rebate_price_set_items")
        .update({ set_value: numValue })
        .eq("id", itemId);

      if (error) throw error;

      setPriceSetItems((prev) => 
        prev.map((p) => (p.id === itemId ? { ...p, set_value: numValue } : p))
      );
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
          <Label className="text-base font-medium">Rebate Configuration for "{priceSetName}"</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Configure value types and ranges for {loadReportType.toUpperCase()} materials
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
                <TableHead>Range</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceSetItems.map((psi) => {
                const isCustom = psi.value_type_item_id === "__custom__";
                
                return (
                  <TableRow key={psi.id}>
                    <TableCell className="font-medium">{getMaterialName(psi.material_id)}</TableCell>
                    <TableCell>
                      <Select
                        value={psi.value_type_item_id || "__none__"}
                        onValueChange={(val) => updateValueTypeItem(psi.id, val === "__none__" ? "" : val)}
                        disabled={saving}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Select value type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Select value type...</span>
                          </SelectItem>
                          <SelectItem value="__custom__">
                            <span className="font-medium">Custom</span>
                          </SelectItem>
                          {allRebateItems.map((ri) => (
                            <SelectItem key={ri.id} value={ri.id}>
                              {ri.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {isCustom ? (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">£</span>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-24"
                            value={psi.set_value ?? ""}
                            onChange={(e) => updateCustomValue(psi.id, e.target.value)}
                            placeholder="0.00"
                            disabled={saving}
                          />
                          <span className="text-muted-foreground text-sm">/tonne</span>
                        </div>
                      ) : (
                        <Select
                          value={psi.value_type === "set" ? "lower" : psi.value_type}
                          onValueChange={(val) => updateRange(psi.id, val as "lower" | "higher")}
                          disabled={saving || !psi.value_type_item_id}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lower">lower</SelectItem>
                            <SelectItem value="higher">higher</SelectItem>
                          </SelectContent>
                        </Select>
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
                );
              })}
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
