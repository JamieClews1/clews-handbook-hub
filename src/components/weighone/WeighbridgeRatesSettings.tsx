import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, PoundSterling, Package, Building2, RotateCcw } from "lucide-react";

export interface RateGroup {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
}

export interface RateGroupPrice {
  id: string;
  rate_group_id: string;
  waste_type_id: string;
  price_per_tonne: number;
  min_charge: number;
}

export interface WasteTypeRow {
  id: string;
  waste_type: string;
  ewc_code: string | null;
  price_per_tonne: number;
  min_charge: number;
  is_active: boolean;
  display_order: number;
}

export interface ItemTemplate {
  id: string;
  name: string;
  ewc_code: string | null;
  cost: number;
  is_active: boolean;
  display_order: number;
}

export function useWeighbridgeRates() {
  const { data: rateGroups = [] } = useQuery({
    queryKey: ["weighbridge-rate-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_rate_groups")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as RateGroup[];
    },
  });

  const { data: ratePrices = [] } = useQuery({
    queryKey: ["weighbridge-rate-group-prices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("weighbridge_rate_group_prices").select("*");
      if (error) throw error;
      return data as RateGroupPrice[];
    },
  });

  const { data: itemTemplates = [] } = useQuery({
    queryKey: ["weighbridge-item-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_item_templates")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as ItemTemplate[];
    },
  });

  return { rateGroups, ratePrices, itemTemplates };
}

/** Resolves the effective price/min charge for a waste type under a rate group. */
export function resolveRate(
  wasteType: { price_per_tonne: number; min_charge?: number | null } | undefined,
  ratePrices: RateGroupPrice[],
  wasteTypeId: string | null | undefined,
  rateGroupId: string | null | undefined,
): { price_per_tonne: number; min_charge: number } {
  const override =
    wasteTypeId && rateGroupId
      ? ratePrices.find((p) => p.waste_type_id === wasteTypeId && p.rate_group_id === rateGroupId)
      : undefined;
  return {
    price_per_tonne: override?.price_per_tonne ?? wasteType?.price_per_tonne ?? 0,
    min_charge: override?.min_charge ?? wasteType?.min_charge ?? 0,
  };
}

export const WeighbridgeRatesSettings = () => {
  const queryClient = useQueryClient();
  const { rateGroups, ratePrices, itemTemplates } = useWeighbridgeRates();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newItem, setNewItem] = useState({ name: "", ewc_code: "", cost: "" });

  const { data: wasteTypes = [] } = useQuery({
    queryKey: ["weighbridge-waste-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_waste_types")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as WasteTypeRow[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["weighbridge-customers-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weighbridge_customers")
        .select("id, customer_name, is_active, rate_group_id, carrier_name, carrier_registration")
        .order("customer_name");
      if (error) throw error;
      return data as {
        id: string;
        customer_name: string;
        is_active: boolean;
        rate_group_id: string | null;
        carrier_name: string | null;
        carrier_registration: string | null;
      }[];
    },
  });

  const defaultGroup = rateGroups.find((g) => g.is_default) ?? rateGroups[0];
  const activeGroupId = selectedGroupId || defaultGroup?.id || "";
  const activeGroup = rateGroups.find((g) => g.id === activeGroupId);
  const isDefaultGroup = !!activeGroup?.is_default;

  const pricedWasteTypes = useMemo(
    () => wasteTypes.filter((wt) => wt.is_active),
    [wasteTypes],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["weighbridge-rate-groups"] });
    queryClient.invalidateQueries({ queryKey: ["weighbridge-rate-group-prices"] });
    queryClient.invalidateQueries({ queryKey: ["weighbridge-waste-types"] });
  };

  const saveBase = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<WasteTypeRow> }) => {
      const { error } = await supabase.from("weighbridge_waste_types").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const saveOverride = useMutation({
    mutationFn: async ({
      waste_type_id,
      price_per_tonne,
      min_charge,
    }: { waste_type_id: string; price_per_tonne: number; min_charge: number }) => {
      const { error } = await supabase
        .from("weighbridge_rate_group_prices")
        .upsert(
          { rate_group_id: activeGroupId, waste_type_id, price_per_tonne, min_charge },
          { onConflict: "rate_group_id,waste_type_id" },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const clearOverride = useMutation({
    mutationFn: async (waste_type_id: string) => {
      const { error } = await supabase
        .from("weighbridge_rate_group_prices")
        .delete()
        .eq("rate_group_id", activeGroupId)
        .eq("waste_type_id", waste_type_id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Reverted to trade rate");
    },
  });

  const addGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("weighbridge_rate_groups")
        .insert({ name: newGroupName.trim(), display_order: rateGroups.length });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewGroupName("");
      invalidate();
      toast.success("Rate group added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weighbridge_rate_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedGroupId("");
      invalidate();
      toast.success("Rate group removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const itemsInvalidate = () => queryClient.invalidateQueries({ queryKey: ["weighbridge-item-templates"] });

  const addTemplate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("weighbridge_item_templates").insert({
        name: newItem.name.trim(),
        ewc_code: newItem.ewc_code.trim() || null,
        cost: parseFloat(newItem.cost) || 0,
        display_order: itemTemplates.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewItem({ name: "", ewc_code: "", cost: "" });
      itemsInvalidate();
      toast.success("Item template added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ItemTemplate> }) => {
      const { error } = await supabase.from("weighbridge_item_templates").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: itemsInvalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("weighbridge_item_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      itemsInvalidate();
      toast.success("Item template removed");
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from("weighbridge_customers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers-rates"] });
      queryClient.invalidateQueries({ queryKey: ["weighbridge-customers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Tabs defaultValue="rates" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rates" className="gap-2"><PoundSterling className="h-4 w-4" /> Prices & Rates</TabsTrigger>
        <TabsTrigger value="items" className="gap-2"><Package className="h-4 w-4" /> Additional Items</TabsTrigger>
        <TabsTrigger value="customers" className="gap-2"><Building2 className="h-4 w-4" /> Customer Rates</TabsTrigger>
      </TabsList>

      {/* Prices & Rates */}
      <TabsContent value="rates" className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Rate group</Label>
            <Select value={activeGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select group" /></SelectTrigger>
              <SelectContent>
                {rateGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}{g.is_default ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 ml-auto">
            <div className="space-y-1">
              <Label className="text-xs">New rate group</Label>
              <Input className="w-44" placeholder="e.g. Element" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            </div>
            <Button size="sm" className="h-10 gap-1" disabled={!newGroupName.trim()} onClick={() => addGroup.mutate()}>
              <Plus className="h-4 w-4" /> Add
            </Button>
            {activeGroup && !activeGroup.is_default && (
              <Button size="sm" variant="ghost" className="h-10 text-destructive" onClick={() => deleteGroup.mutate(activeGroup.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {isDefaultGroup
            ? "Trade rates apply to every customer unless they are assigned to another group."
            : "Blank rows use the trade rate. Enter a value to override it for this group only."}
        </p>

        <div className="border border-border/50 rounded-lg overflow-hidden">
          <div className="max-h-[55vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waste type</TableHead>
                  <TableHead className="w-24">EWC</TableHead>
                  <TableHead className="w-32 text-right">£ / tonne</TableHead>
                  <TableHead className="w-32 text-right">Min charge £</TableHead>
                  {!isDefaultGroup && <TableHead className="w-24 text-right">Trade</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricedWasteTypes.map((wt) => {
                  const override = ratePrices.find(
                    (p) => p.waste_type_id === wt.id && p.rate_group_id === activeGroupId,
                  );
                  const priceValue = isDefaultGroup ? wt.price_per_tonne : override?.price_per_tonne ?? "";
                  const minValue = isDefaultGroup ? wt.min_charge : override?.min_charge ?? "";
                  return (
                    <TableRow key={wt.id}>
                      <TableCell className="font-medium text-sm">{wt.waste_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{wt.ewc_code ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 w-28 text-right text-sm ml-auto"
                          placeholder={isDefaultGroup ? "0.00" : wt.price_per_tonne.toFixed(2)}
                          defaultValue={priceValue === "" ? "" : Number(priceValue).toFixed(2)}
                          key={`p-${activeGroupId}-${wt.id}-${override?.price_per_tonne ?? wt.price_per_tonne}`}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (isDefaultGroup) {
                              saveBase.mutate({ id: wt.id, patch: { price_per_tonne: parseFloat(val) || 0 } });
                            } else if (val === "") {
                              if (override) clearOverride.mutate(wt.id);
                            } else {
                              saveOverride.mutate({
                                waste_type_id: wt.id,
                                price_per_tonne: parseFloat(val) || 0,
                                min_charge: override?.min_charge ?? wt.min_charge ?? 0,
                              });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 w-28 text-right text-sm ml-auto"
                          placeholder={isDefaultGroup ? "0.00" : (wt.min_charge ?? 0).toFixed(2)}
                          defaultValue={minValue === "" ? "" : Number(minValue).toFixed(2)}
                          key={`m-${activeGroupId}-${wt.id}-${override?.min_charge ?? wt.min_charge}`}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (isDefaultGroup) {
                              saveBase.mutate({ id: wt.id, patch: { min_charge: parseFloat(val) || 0 } });
                            } else {
                              saveOverride.mutate({
                                waste_type_id: wt.id,
                                price_per_tonne: override?.price_per_tonne ?? wt.price_per_tonne,
                                min_charge: parseFloat(val) || 0,
                              });
                            }
                          }}
                        />
                      </TableCell>
                      {!isDefaultGroup && (
                        <TableCell className="text-right">
                          {override ? (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Revert to trade rate" onClick={() => clearOverride.mutate(wt.id)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">£{wt.price_per_tonne.toFixed(2)}</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>

      {/* Additional item templates */}
      <TabsContent value="items" className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Reusable per-item charges that staff can add to a weigh-in (fridges, tyres, mattresses, POPS items).
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label className="text-xs">Item name</Label>
            <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Domestic Fridge (each)" />
          </div>
          <div className="w-32 space-y-1">
            <Label className="text-xs">EWC</Label>
            <Input value={newItem.ewc_code} onChange={(e) => setNewItem({ ...newItem, ewc_code: e.target.value })} placeholder="16 02 13" />
          </div>
          <div className="w-28 space-y-1">
            <Label className="text-xs">Cost £</Label>
            <Input type="number" step="0.01" value={newItem.cost} onChange={(e) => setNewItem({ ...newItem, cost: e.target.value })} />
          </div>
          <Button size="sm" className="h-10 gap-1" disabled={!newItem.name.trim()} onClick={() => addTemplate.mutate()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        <div className="space-y-2">
          {itemTemplates.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-md border border-border p-2">
              <Input
                className="flex-1 h-8 text-sm"
                defaultValue={it.name}
                onBlur={(e) => e.target.value !== it.name && updateTemplate.mutate({ id: it.id, patch: { name: e.target.value } })}
              />
              <Input
                className="w-28 h-8 text-sm"
                defaultValue={it.ewc_code ?? ""}
                placeholder="EWC"
                onBlur={(e) => updateTemplate.mutate({ id: it.id, patch: { ewc_code: e.target.value || null } })}
              />
              <Input
                type="number"
                step="0.01"
                className="w-24 h-8 text-sm text-right"
                defaultValue={it.cost}
                onBlur={(e) => updateTemplate.mutate({ id: it.id, patch: { cost: parseFloat(e.target.value) || 0 } })}
              />
              <div className="flex items-center gap-1.5">
                <Switch checked={it.is_active} onCheckedChange={(v) => updateTemplate.mutate({ id: it.id, patch: { is_active: v } })} />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteTemplate.mutate(it.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {itemTemplates.length === 0 && <p className="text-sm text-muted-foreground">No item templates yet.</p>}
        </div>
      </TabsContent>

      {/* Customer rate assignment */}
      <TabsContent value="customers" className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Assign customers to a rate group and store their waste carrier details so they auto-fill on new weigh-ins.
        </p>
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <div className="max-h-[55vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-44">Rate group</TableHead>
                  <TableHead className="w-48">Carrier name</TableHead>
                  <TableHead className="w-40">Carrier licence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} className={c.is_active ? "" : "opacity-50"}>
                    <TableCell className="font-medium text-sm">
                      {c.customer_name}
                      {!c.is_active && <Badge variant="outline" className="ml-2 text-[10px]">Inactive</Badge>}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={c.rate_group_id ?? "default"}
                        onValueChange={(v) => updateCustomer.mutate({ id: c.id, patch: { rate_group_id: v === "default" ? null : v } })}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Trade (default)</SelectItem>
                          {rateGroups.filter((g) => !g.is_default).map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs"
                        defaultValue={c.carrier_name ?? ""}
                        onBlur={(e) => updateCustomer.mutate({ id: c.id, patch: { carrier_name: e.target.value || null } })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs font-mono"
                        defaultValue={c.carrier_registration ?? ""}
                        placeholder="CBDU..."
                        onBlur={(e) => updateCustomer.mutate({ id: c.id, patch: { carrier_registration: e.target.value.toUpperCase() || null } })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default WeighbridgeRatesSettings;
