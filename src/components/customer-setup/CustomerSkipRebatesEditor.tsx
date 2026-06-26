import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

function ThresholdInput({
  value,
  onSave,
  disabled,
}: {
  value: number | null;
  onSave: (value: string) => void;
  disabled?: boolean;
}) {
  const [localValue, setLocalValue] = useState(String(value ?? 0));
  useEffect(() => {
    setLocalValue(String(value ?? 0));
  }, [value]);
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step="0.1"
        min="0"
        className="w-16"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onSave(localValue)}
        placeholder="0"
        disabled={disabled}
      />
      <span className="text-muted-foreground text-xs">T</span>
    </div>
  );
}

type RebateItem = {
  id: string;
  name: string;
  sort_order: number;
};

type CustomerSkipRebate = {
  id: string;
  customer_id: string;
  material_type: string;
  value_type: "lower" | "higher" | "set" | "bespoke";
  value_type_item_id: string | null;
  set_value: number | null;
  adjustment: number | null;
  threshold_tonnes: number | null;
  rebate_enabled: boolean;
  container_type_filter: string[] | null;
};

type Props = {
  customerId: string;
  customerName: string;
};

const MATERIAL_OPTIONS = [
  { value: "card_loose", label: "Card Loose" },
  { value: "scrap_metal", label: "Scrap Metal" },
];

export function CustomerSkipRebatesEditor({ customerId, customerName }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allRebateItems, setAllRebateItems] = useState<RebateItem[]>([]);
  const [rebates, setRebates] = useState<CustomerSkipRebate[]>([]);
  const [selectedMaterialType, setSelectedMaterialType] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: rebateItems, error: rebateItemsError },
        { data: customerRebates, error: customerRebatesError },
      ] = await Promise.all([
        supabase
          .from("rebate_items")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true }),
        supabase
          .from("customer_skip_rebates")
          .select("*")
          .eq("customer_id", customerId),
      ]);

      if (rebateItemsError) throw rebateItemsError;
      if (customerRebatesError) throw customerRebatesError;

      setAllRebateItems((rebateItems ?? []) as RebateItem[]);
      setRebates((customerRebates ?? []).map((r: any) => ({
        ...r,
        value_type: r.value_type as "lower" | "higher" | "set" | "bespoke",
        rebate_enabled: r.rebate_enabled ?? true,
      })));
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to load data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const usedMaterials = new Set(rebates.map((r) => r.material_type));
  const availableMaterials = [
    ...MATERIAL_OPTIONS,
    ...allRebateItems.map((ri) => ({ value: ri.name, label: ri.name })),
  ].filter((m) => !usedMaterials.has(m.value));

  const addMaterial = async () => {
    if (!selectedMaterialType) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("customer_skip_rebates")
        .insert({
          customer_id: customerId,
          material_type: selectedMaterialType,
          value_type: "lower",
          rebate_enabled: true,
        })
        .select("*")
        .single();

      if (error) throw error;

      setRebates((prev) => [...prev, {
        ...data,
        value_type: data.value_type as "lower" | "higher" | "set" | "bespoke",
        rebate_enabled: data.rebate_enabled ?? true,
      }]);
      setSelectedMaterialType("");
      toast({ title: "Added", description: "Material added to rebate configuration." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to add material.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleRebateEnabled = async (id: string, enabled: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_skip_rebates")
        .update({ rebate_enabled: enabled })
        .eq("id", id);

      if (error) throw error;

      setRebates((prev) =>
        prev.map((r) => (r.id === id ? { ...r, rebate_enabled: enabled } : r))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateValueTypeItem = async (id: string, value: string) => {
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
        .from("customer_skip_rebates")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      setRebates((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                value_type_item_id: isCustom || isBespoke ? null : (value || null),
                value_type: isCustom ? "set" : isBespoke ? "bespoke" : "lower",
                set_value: null,
              }
            : r
        )
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateRange = async (id: string, range: "lower" | "higher") => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_skip_rebates")
        .update({ value_type: range })
        .eq("id", id);

      if (error) throw error;

      setRebates((prev) =>
        prev.map((r) => (r.id === id ? { ...r, value_type: range } : r))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateCustomValue = async (id: string, value: string) => {
    const numValue = value.trim() === "" ? null : parseFloat(value);
    if (value.trim() !== "" && isNaN(numValue!)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_skip_rebates")
        .update({ set_value: numValue })
        .eq("id", id);

      if (error) throw error;

      setRebates((prev) =>
        prev.map((r) => (r.id === id ? { ...r, set_value: numValue } : r))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateThreshold = async (id: string, value: string) => {
    const numValue = value.trim() === "" ? 0 : parseFloat(value);
    if (value.trim() !== "" && isNaN(numValue)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_skip_rebates")
        .update({ threshold_tonnes: numValue })
        .eq("id", id);

      if (error) throw error;

      setRebates((prev) =>
        prev.map((r) => (r.id === id ? { ...r, threshold_tonnes: numValue } : r))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateAdjustment = async (id: string, value: string) => {
    const numValue = value.trim() === "" ? 0 : parseFloat(value);
    if (value.trim() !== "" && isNaN(numValue)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_skip_rebates")
        .update({ adjustment: numValue })
        .eq("id", id);

      if (error) throw error;

      setRebates((prev) =>
        prev.map((r) => (r.id === id ? { ...r, adjustment: numValue } : r))
      );
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeMaterial = async (id: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_skip_rebates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRebates((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Removed", description: "Material removed." });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to remove.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getMaterialLabel = (materialType: string) => {
    return MATERIAL_OPTIONS.find((m) => m.value === materialType)?.label ?? materialType;
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Midweigh Rebates for "{customerName}"</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Customer-level rebates for Midweigh data (where site is always blank)
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          No site required
        </Badge>
      </div>

      {rebates.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Value Type</TableHead>
                <TableHead>Range</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Adjustment</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rebates.map((item) => {
                const isCustom = item.value_type === "set" && !item.value_type_item_id;
                const isBespoke = item.value_type === "bespoke";
                const currentValueTypeItemId = isBespoke
                  ? "__bespoke__"
                  : isCustom
                  ? "__custom__"
                  : item.value_type_item_id || "__none__";

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {getMaterialLabel(item.material_type)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={item.rebate_enabled}
                          onCheckedChange={(checked) => toggleRebateEnabled(item.id, checked === true)}
                          disabled={saving}
                        />
                        <span className="text-xs text-muted-foreground">
                          {item.rebate_enabled ? "Yes" : "No rebate"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={currentValueTypeItemId}
                        onValueChange={(val) => updateValueTypeItem(item.id, val === "__none__" ? "" : val)}
                        disabled={saving}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select value type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">Select...</span>
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
                          <span className="text-muted-foreground">£</span>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-20"
                            value={item.set_value ?? ""}
                            onChange={(e) => updateCustomValue(item.id, e.target.value)}
                            placeholder="0.00"
                            disabled={saving}
                          />
                          <span className="text-muted-foreground text-xs">/t</span>
                        </div>
                      ) : isBespoke ? (
                        <span className="text-sm text-muted-foreground italic">Set at report time</span>
                      ) : (
                        <Select
                          value={item.value_type === "set" ? "lower" : item.value_type}
                          onValueChange={(val) => updateRange(item.id, val as "lower" | "higher")}
                          disabled={saving || !item.value_type_item_id}
                        >
                          <SelectTrigger className="w-[100px]">
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
                      {item.rebate_enabled && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            className="w-16"
                            value={item.threshold_tonnes ?? 0}
                            onChange={(e) => updateThreshold(item.id, e.target.value)}
                            placeholder="0"
                            disabled={saving}
                          />
                          <span className="text-muted-foreground text-xs">T</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {!isCustom && item.value_type_item_id && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="1"
                            className="w-16"
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

      {rebates.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">
          No Midweigh rebates configured for this customer yet.
        </p>
      )}

      {availableMaterials.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-sm">Add material</Label>
            <Select value={selectedMaterialType} onValueChange={setSelectedMaterialType} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder="Select a material to add" />
              </SelectTrigger>
              <SelectContent>
                {availableMaterials.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
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

      {availableMaterials.length === 0 && rebates.length > 0 && (
        <p className="text-xs text-muted-foreground">All available materials have been added.</p>
      )}
    </div>
  );
}
