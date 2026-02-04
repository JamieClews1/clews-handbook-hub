import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

type RebateItem = {
  id: string;
  name: string;
  sort_order: number;
};

type SkipRebateItem = {
  id: string;
  site_id: string;
  material_type: "card_loose" | "scrap_metal";
  value_type_item_id: string | null;
  value_type: "lower" | "higher" | "set";
  set_value: number | null;
  adjustment: number | null;
};

const SKIP_MATERIALS: { id: "card_loose" | "scrap_metal"; name: string }[] = [
  { id: "card_loose", name: "Card Loose" },
  { id: "scrap_metal", name: "Scrap Metal" },
];

type Props = {
  siteId: string;
  siteName: string;
};

export function SiteSkipRebatesEditor({ siteId, siteName }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allRebateItems, setAllRebateItems] = useState<RebateItem[]>([]);
  const [skipRebates, setSkipRebates] = useState<SkipRebateItem[]>([]);

  const [selectedMaterialType, setSelectedMaterialType] = useState<"card_loose" | "scrap_metal" | "">("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: rebateItems, error: rebateItemsError }, { data: skipData, error: skipError }] = await Promise.all([
        supabase.from("rebate_items").select("id, name, sort_order").order("sort_order", { ascending: true }),
        supabase
          .from("customer_site_skip_rebates")
          .select("id, site_id, material_type, value_type_item_id, value_type, set_value, adjustment")
          .eq("site_id", siteId),
      ]);

      if (rebateItemsError) throw rebateItemsError;
      if (skipError) throw skipError;

      setAllRebateItems((rebateItems ?? []) as RebateItem[]);
      setSkipRebates((skipData ?? []) as SkipRebateItem[]);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load skip rebates.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [siteId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const usedMaterialTypes = new Set(skipRebates.map((r) => r.material_type));
  const availableMaterials = SKIP_MATERIALS.filter((m) => !usedMaterialTypes.has(m.id));

  const addMaterial = async () => {
    if (!selectedMaterialType) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("customer_site_skip_rebates")
        .insert({
          site_id: siteId,
          material_type: selectedMaterialType,
          value_type: "lower",
          set_value: null,
          adjustment: 0,
        })
        .select("id, site_id, material_type, value_type_item_id, value_type, set_value, adjustment")
        .single();

      if (error) throw error;

      setSkipRebates((prev) => [...prev, data as SkipRebateItem]);
      setSelectedMaterialType("");
      toast({ title: "Added", description: "Material added to skip rebates." });
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

      const updateData = isCustom
        ? { value_type_item_id: null, value_type: "set", set_value: null }
        : { value_type_item_id: value || null, value_type: "lower", set_value: null };

      const { error } = await supabase.from("customer_site_skip_rebates").update(updateData).eq("id", itemId);

      if (error) throw error;

      setSkipRebates((prev) =>
        prev.map((r) =>
          r.id === itemId
            ? {
                ...r,
                value_type_item_id: isCustom ? null : value || null,
                value_type: isCustom ? "set" : "lower",
                set_value: null,
              }
            : r
        )
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
        .from("customer_site_skip_rebates")
        .update({ value_type: range, set_value: null })
        .eq("id", itemId);

      if (error) throw error;

      setSkipRebates((prev) => prev.map((r) => (r.id === itemId ? { ...r, value_type: range, set_value: null } : r)));
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
      const { error } = await supabase.from("customer_site_skip_rebates").update({ set_value: numValue }).eq("id", itemId);

      if (error) throw error;

      setSkipRebates((prev) => prev.map((r) => (r.id === itemId ? { ...r, set_value: numValue } : r)));
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update value.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateAdjustment = async (itemId: string, value: string) => {
    const numValue = value.trim() === "" ? 0 : parseFloat(value);
    if (value.trim() !== "" && isNaN(numValue)) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("customer_site_skip_rebates").update({ adjustment: numValue }).eq("id", itemId);

      if (error) throw error;

      setSkipRebates((prev) => prev.map((r) => (r.id === itemId ? { ...r, adjustment: numValue } : r)));
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update adjustment.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeMaterial = async (itemId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("customer_site_skip_rebates").delete().eq("id", itemId);

      if (error) throw error;

      setSkipRebates((prev) => prev.filter((r) => r.id !== itemId));
      toast({ title: "Removed", description: "Material removed from skip rebates." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to remove material.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getMaterialName = (materialType: "card_loose" | "scrap_metal") => {
    return SKIP_MATERIALS.find((m) => m.id === materialType)?.name ?? "Unknown";
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">Loading skip/roro rebates...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Skip/RoRo Rebates for "{siteName}"</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Rebates applied to total weight on job tickets (not load report based)
          </p>
        </div>
      </div>

      {skipRebates.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Value Type</TableHead>
                <TableHead>Range</TableHead>
                <TableHead>Adjustment</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skipRebates.map((item) => {
                const isCustom = item.value_type === "set" && !item.value_type_item_id;
                const currentValueTypeItemId = isCustom ? "__custom__" : item.value_type_item_id || "__none__";

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{getMaterialName(item.material_type)}</TableCell>
                    <TableCell>
                      <Select
                        value={currentValueTypeItemId}
                        onValueChange={(val) => updateValueTypeItem(item.id, val === "__none__" ? "" : val)}
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
                            value={item.set_value ?? ""}
                            onChange={(e) => updateCustomValue(item.id, e.target.value)}
                            placeholder="0.00"
                            disabled={saving}
                          />
                          <span className="text-muted-foreground text-sm">/tonne</span>
                        </div>
                      ) : (
                        <Select
                          value={item.value_type === "set" ? "lower" : item.value_type}
                          onValueChange={(val) => updateRange(item.id, val as "lower" | "higher")}
                          disabled={saving || !item.value_type_item_id}
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
                      {!isCustom && item.value_type_item_id && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="1"
                            className="w-20"
                            value={item.adjustment ?? 0}
                            onChange={(e) => updateAdjustment(item.id, e.target.value)}
                            placeholder="0"
                            disabled={saving}
                          />
                          <span className="text-muted-foreground text-xs">£/t</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMaterial(item.id)}
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

      {skipRebates.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No skip/roro rebates configured for this site yet.</p>
      )}

      {availableMaterials.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-sm">Add material</Label>
            <Select
              value={selectedMaterialType}
              onValueChange={(v) => setSelectedMaterialType(v as "card_loose" | "scrap_metal" | "")}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a material to add" />
              </SelectTrigger>
              <SelectContent>
                {availableMaterials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addMaterial} disabled={!selectedMaterialType || saving} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}

      {availableMaterials.length === 0 && skipRebates.length > 0 && (
        <p className="text-xs text-muted-foreground">All available materials have been added.</p>
      )}
    </div>
  );
}
