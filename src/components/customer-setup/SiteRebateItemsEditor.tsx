import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

// Local input component to prevent stalling while typing
function AdjustmentInput({ 
  value, 
  onSave, 
  disabled 
}: { 
  value: number; 
  onSave: (value: string) => void; 
  disabled: boolean;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);
  
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step="1"
        className="w-20"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onSave(localValue)}
        placeholder="0"
        disabled={disabled}
      />
      <span className="text-muted-foreground text-xs">£/t</span>
    </div>
  );
}

type WasteType = {
  id: string;
  waste_type: string;
  display_order: number;
  rebate_category: string;
};

type RebateItem = {
  id: string;
  name: string;
  sort_order: number;
};

type PriceSetItem = {
  id: string;
  price_set_id: string;
  material_id: string;
  value_type_item_id: string;
  display_order: number;
  value_type: "lower" | "higher" | "set" | "bespoke";
  set_value: number | null;
  adjustment: number | null;
};

type RebateRule = {
  id: string;
  rule_key: string;
  rule_name: string;
  description: string;
  is_enabled: boolean;
  rule_value: number | null;
  display_order: number;
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
  const [rebateRules, setRebateRules] = useState<RebateRule[]>([]);

  const [selectedMaterialId, setSelectedMaterialId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: materials, error: materialsError },
        { data: rebateItems, error: rebateItemsError },
        { data: psItems, error: psItemsError },
        { data: rulesData, error: rulesError }
      ] = await Promise.all([
        supabase
          .from("load_waste_types")
          .select("id, waste_type, display_order, rebate_category")
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
        supabase
          .from("rebate_items")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true }),
        supabase
          .from("rebate_price_set_items")
          .select("id, price_set_id, rebate_item_id, display_order, value_type, set_value, adjustment")
          .eq("price_set_id", priceSetId)
          .order("display_order", { ascending: true }),
        supabase
          .from("rebate_rules")
          .select("id, rule_key, rule_name, description, is_enabled, rule_value, display_order")
          .order("display_order", { ascending: true }),
      ]);

      if (materialsError) throw materialsError;
      if (rebateItemsError) throw rebateItemsError;
      if (psItemsError) throw psItemsError;
      if (rulesError) throw rulesError;

      setAllMaterials((materials ?? []) as WasteType[]);
      setAllRebateItems((rebateItems ?? []) as RebateItem[]);
      setRebateRules((rulesData ?? []) as RebateRule[]);
      
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
      
      const mappedItems = (psItems ?? []).map((item: any) => {
        const valueTypeItemId = valueTypeItemMap[item.id];
        const isCustom = item.value_type === "set" && !valueTypeItemId;
        const isBespoke = item.value_type === "bespoke";
        
        return {
          id: item.id,
          price_set_id: item.price_set_id,
          material_id: item.rebate_item_id,
          value_type_item_id: isBespoke ? "__bespoke__" : (isCustom ? "__custom__" : (valueTypeItemId || "")),
          display_order: item.display_order,
          value_type: item.value_type as "lower" | "higher" | "set" | "bespoke",
          set_value: item.set_value,
          adjustment: item.adjustment ?? 0,
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

  const getMaterialCategory = (materialId: string): string => {
    return allMaterials.find((m) => m.id === materialId)?.rebate_category ?? "rebate";
  };

  const rebateItems = priceSetItems.filter((p) => getMaterialCategory(p.material_id) === "rebate");
  const costItems = priceSetItems.filter((p) => getMaterialCategory(p.material_id) === "cost");
  const availableRebateMaterials = availableMaterials.filter((m) => m.rebate_category === "rebate");
  const availableCostMaterials = availableMaterials.filter((m) => m.rebate_category === "cost");

  const addMaterial = async (materialId?: string) => {
    const matId = materialId || selectedMaterialId;
    if (!matId) return;
    setSaving(true);
    try {
      const maxOrder = priceSetItems.reduce((max, p) => Math.max(max, p.display_order), 0);
      const { data, error } = await supabase
        .from("rebate_price_set_items")
        .insert({
          price_set_id: priceSetId,
          rebate_item_id: matId,
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
        adjustment: 0,
      };
      
      setPriceSetItems((prev) => [...prev, newItem]);
      setSelectedMaterialId("");
      toast({ title: "Added", description: "Material added." });
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
      const isBespoke = value === "__bespoke__";
      
      let updateData: any;
      if (isCustom) {
        updateData = { value_type_item_id: null, value_type: "set", set_value: null };
      } else if (isBespoke) {
        updateData = { value_type_item_id: null, value_type: "bespoke", set_value: null };
      } else {
        updateData = { value_type_item_id: value || null, value_type: "lower", set_value: null };
      }
      
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
              value_type: isCustom ? "set" : (isBespoke ? "bespoke" : "lower"),
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

  const updateAdjustment = async (itemId: string, value: string) => {
    const numValue = value.trim() === "" ? 0 : parseFloat(value);
    if (value.trim() !== "" && isNaN(numValue)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("rebate_price_set_items")
        .update({ adjustment: numValue } as any)
        .eq("id", itemId);

      if (error) throw error;

      setPriceSetItems((prev) => 
        prev.map((p) => (p.id === itemId ? { ...p, adjustment: numValue } : p))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update adjustment.", variant: "destructive" });
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
      toast({ title: "Removed", description: "Material removed." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to remove material.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleRuleEnabled = async (ruleId: string, currentlyEnabled: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("rebate_rules")
        .update({ is_enabled: !currentlyEnabled } as any)
        .eq("id", ruleId);

      if (error) throw error;

      setRebateRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, is_enabled: !currentlyEnabled } : r))
      );
      toast({ title: "Updated", description: `Rule ${!currentlyEnabled ? "enabled" : "disabled"}.` });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update rule.", variant: "destructive" });
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

  const renderItemsTable = (items: PriceSetItem[], isCost: boolean) => {
    if (items.length === 0) return null;

    return (
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
            {items.map((psi) => {
              const isCustom = psi.value_type_item_id === "__custom__";
              const isBespoke = psi.value_type_item_id === "__bespoke__";
              
              return (
                <TableRow key={psi.id}>
                  <TableCell className="font-medium">
                    {getMaterialName(psi.material_id)}
                    {isCost && (
                      <span className="text-xs text-destructive ml-1">(cost)</span>
                    )}
                  </TableCell>
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
                        <SelectItem value="__bespoke__">
                          <span className="font-medium">Bespoke at time</span>
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
                        <span className="text-muted-foreground">{isCost ? "-£" : "£"}</span>
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
                    ) : isBespoke ? (
                      <span className="text-sm text-muted-foreground italic">Set at report time</span>
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
                    {!isCustom && psi.value_type_item_id && (
                      <AdjustmentInput
                        value={psi.adjustment ?? 0}
                        onSave={(value) => updateAdjustment(psi.id, value)}
                        disabled={saving}
                      />
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
    );
  };

  const renderAddMaterial = (materials: WasteType[], label: string) => {
    if (materials.length === 0) return null;

    return (
      <div className="space-y-1">
        <Label className="text-sm">Add {label}</Label>
        <Select
          value=""
          onValueChange={(val) => {
            if (val) addMaterial(val);
          }}
          disabled={saving}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select a ${label.toLowerCase()} material to add`} />
          </SelectTrigger>
          <SelectContent>
            {materials.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.waste_type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Selecting a material adds it to the table above — then set its Value Type and price.
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Rebate Configuration for "{priceSetName}"</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Configure value types and ranges for {loadReportType.toUpperCase()} materials
          </p>
        </div>
      </div>

      {/* Rebates Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <Label className="text-sm font-semibold text-green-700 dark:text-green-400">Rebates</Label>
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
            {rebateItems.length} items
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Revenue-generating materials — values applied as positive rebates to the customer
        </p>
        {renderItemsTable(rebateItems, false)}
        {rebateItems.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No rebate materials configured yet.</p>
        )}
        {renderAddMaterial(availableRebateMaterials, "rebate")}
      </div>

      <Separator />

      {/* Costs Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-destructive" />
          <Label className="text-sm font-semibold text-destructive">Costs</Label>
          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs">
            {costItems.length} items
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Cost-incurring materials (Wood, Waste, Pallet Weight) — values deducted as charges
        </p>
        {renderItemsTable(costItems, true)}
        {costItems.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No cost materials configured yet.</p>
        )}
        {renderAddMaterial(availableCostMaterials, "cost")}
      </div>

      {availableMaterials.length === 0 && priceSetItems.length > 0 && (
        <p className="text-xs text-muted-foreground">All available materials have been added.</p>
      )}

      {/* Rebate Rules Section */}
      <Separator className="my-4" />
      <div className="space-y-3">
        <div>
          <Label className="text-base font-medium">Rebate Rules</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Universal rules that apply when calculating rebates
          </p>
        </div>
        
        {rebateRules.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No rebate rules configured.</p>
        )}

        {rebateRules.map((rule) => (
          <div 
            key={rule.id} 
            className={`rounded-lg border p-3 transition-colors ${
              rule.is_enabled 
                ? "border-border bg-muted/50" 
                : "border-border/50 bg-muted/20 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${rule.is_enabled ? "text-primary" : "text-muted-foreground"}`} />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {rule.rule_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {rule.description}
                    {rule.rule_value !== null && (
                      <span className="font-semibold text-foreground"> {rule.rule_value} tonnes</span>
                    )}
                  </p>
                  {rule.rule_key === "min_weight_threshold" && (
                    <p className="text-xs text-muted-foreground">
                      Final card weight = Weighbridge weight − Pallet weight
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.is_enabled}
                  onCheckedChange={() => toggleRuleEnabled(rule.id, rule.is_enabled)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
