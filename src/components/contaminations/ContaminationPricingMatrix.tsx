import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Settings, Award, Save } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { PricingTier, WasteType, ChargeItem } from "@/lib/contamination-pricing";

const ContaminationPricingMatrix = () => {
  const queryClient = useQueryClient();
  const [newWasteType, setNewWasteType] = useState("");
  const [pointsValue, setPointsValue] = useState<string>("");

  const { data: wasteTypes = [], refetch: refetchTypes } = useQuery({
    queryKey: ["contamination-waste-types-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contamination_waste_types")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as WasteType[];
    },
  });

  const { data: tiers = [], refetch: refetchTiers } = useQuery({
    queryKey: ["contamination-pricing-tiers-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contamination_pricing_tiers")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as PricingTier[];
    },
  });

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["contamination-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("contamination_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const refreshAll = () => {
    refetchTypes();
    refetchTiers();
    queryClient.invalidateQueries({ queryKey: ["contamination-waste-types"] });
    queryClient.invalidateQueries({ queryKey: ["contamination-pricing-tiers"] });
  };

  const handleAddWasteType = async () => {
    if (!newWasteType.trim()) return;
    const { error } = await supabase.from("contamination_waste_types").insert({
      name: newWasteType.trim(),
      display_order: wasteTypes.length + 1,
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setNewWasteType("");
    toast({ title: "Waste type added" });
    refreshAll();
  };

  const handleUpdateWasteType = async (id: string, field: string, value: any) => {
    await supabase.from("contamination_waste_types").update({ [field]: value }).eq("id", id);
    refreshAll();
  };

  const handleDeleteWasteType = async (id: string) => {
    await supabase.from("contamination_waste_types").delete().eq("id", id);
    toast({ title: "Waste type removed" });
    refreshAll();
  };

  const handleAddTier = async (wasteTypeId: string, count: number) => {
    const { error } = await supabase.from("contamination_pricing_tiers").insert({
      waste_type_id: wasteTypeId,
      tier_name: `Tier ${count + 1}`,
      flat_fee: 0,
      display_order: count + 1,
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    refreshAll();
  };

  const handleUpdateTier = async (id: string, field: string, value: any) => {
    await supabase.from("contamination_pricing_tiers").update({ [field]: value }).eq("id", id);
    refreshAll();
  };

  const handleDeleteTier = async (id: string) => {
    await supabase.from("contamination_pricing_tiers").delete().eq("id", id);
    refreshAll();
  };

  const handleSavePoints = async () => {
    const val = parseInt(pointsValue);
    if (isNaN(val) || val < 0) return toast({ title: "Enter a valid number", variant: "destructive" });
    if (settings) {
      await supabase.from("contamination_settings").update({ points_per_report: val }).eq("id", settings.id);
    } else {
      await supabase.from("contamination_settings").insert({ points_per_report: val });
    }
    toast({ title: "Points setting saved" });
    refetchSettings();
  };

  const numOrNull = (v: string) => (v === "" ? null : parseFloat(v));

  return (
    <div className="space-y-6">
      {/* Points config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-primary" />
            Reward Points
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <Label>Points per contamination report</Label>
            <Input
              type="number"
              className="w-40"
              value={pointsValue !== "" ? pointsValue : settings?.points_per_report ?? ""}
              onChange={(e) => setPointsValue(e.target.value)}
              placeholder="10"
            />
          </div>
          <Button onClick={handleSavePoints} className="gap-2">
            <Save className="h-4 w-4" /> Save
          </Button>
          <p className="text-sm text-muted-foreground">
            Drivers & yard staff earn these points for each contamination they report, totalled monthly for bonuses.
          </p>
        </CardContent>
      </Card>

      {/* Pricing matrix */}
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Contamination Charge Matrix</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Charges are based on % of load OR sorting time required. Per-tonne tiers bill at the rate × the load weight
        (min charge tonnes applied where set).
      </p>

      {wasteTypes.map((wt) => {
        const wtTiers = tiers.filter((t) => t.waste_type_id === wt.id);
        return (
          <Card key={wt.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-[260px]">
                  <Input
                    className="font-semibold max-w-[220px]"
                    defaultValue={wt.name}
                    onBlur={(e) => e.target.value !== wt.name && handleUpdateWasteType(wt.id, "name", e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={wt.zero_tolerance}
                      onCheckedChange={(c) => handleUpdateWasteType(wt.id, "zero_tolerance", c)}
                    />
                    <span className="text-xs text-muted-foreground">Zero tolerance</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={wt.is_active}
                    onCheckedChange={(c) => handleUpdateWasteType(wt.id, "is_active", c)}
                  />
                  <span className="text-xs text-muted-foreground">Active</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{wt.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>This removes the waste type and all its pricing tiers.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteWasteType(wt.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <Input
                className="text-sm mt-2"
                defaultValue={wt.typical_contamination || ""}
                placeholder="Typical contamination to be sorted…"
                onBlur={(e) => handleUpdateWasteType(wt.id, "typical_contamination", e.target.value || null)}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-2 font-medium">Tier</th>
                      <th className="py-1 px-1 font-medium">% min</th>
                      <th className="py-1 px-1 font-medium">% max</th>
                      <th className="py-1 px-1 font-medium">mins min</th>
                      <th className="py-1 px-1 font-medium">mins max</th>
                      <th className="py-1 px-1 font-medium">Flat £</th>
                      <th className="py-1 px-1 font-medium">£/tonne</th>
                      <th className="py-1 px-1 font-medium">Min T</th>
                      <th className="py-1 px-1 font-medium">Notes</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {wtTiers.map((t) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="py-1 pr-2"><Input className="h-8 w-28" defaultValue={t.tier_name} onBlur={(e) => handleUpdateTier(t.id, "tier_name", e.target.value)} /></td>
                        <td className="px-1"><Input className="h-8 w-16" type="number" defaultValue={t.pct_min ?? ""} onBlur={(e) => handleUpdateTier(t.id, "pct_min", numOrNull(e.target.value))} /></td>
                        <td className="px-1"><Input className="h-8 w-16" type="number" defaultValue={t.pct_max ?? ""} onBlur={(e) => handleUpdateTier(t.id, "pct_max", numOrNull(e.target.value))} /></td>
                        <td className="px-1"><Input className="h-8 w-16" type="number" defaultValue={t.mins_min ?? ""} onBlur={(e) => handleUpdateTier(t.id, "mins_min", numOrNull(e.target.value))} /></td>
                        <td className="px-1"><Input className="h-8 w-16" type="number" defaultValue={t.mins_max ?? ""} onBlur={(e) => handleUpdateTier(t.id, "mins_max", numOrNull(e.target.value))} /></td>
                        <td className="px-1"><Input className="h-8 w-20" type="number" step="0.01" defaultValue={t.flat_fee ?? 0} onBlur={(e) => handleUpdateTier(t.id, "flat_fee", parseFloat(e.target.value) || 0)} /></td>
                        <td className="px-1"><Input className="h-8 w-20" type="number" step="0.01" defaultValue={t.per_tonne_fee ?? ""} onBlur={(e) => handleUpdateTier(t.id, "per_tonne_fee", numOrNull(e.target.value))} /></td>
                        <td className="px-1"><Input className="h-8 w-16" type="number" step="0.1" defaultValue={t.min_charge_tonnes ?? ""} onBlur={(e) => handleUpdateTier(t.id, "min_charge_tonnes", numOrNull(e.target.value))} /></td>
                        <td className="px-1"><Input className="h-8 min-w-[160px]" defaultValue={t.notes ?? ""} onBlur={(e) => handleUpdateTier(t.id, "notes", e.target.value || null)} /></td>
                        <td className="py-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteTier(t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => handleAddTier(wt.id, wtTiers.length)}>
                <Plus className="h-4 w-4" /> Add tier
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* Add waste type */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Add Waste Type</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label>Waste type name</Label>
            <Input value={newWasteType} onChange={(e) => setNewWasteType(e.target.value)} placeholder="e.g. Hardcore" />
          </div>
          <Button onClick={handleAddWasteType} className="gap-2"><Plus className="h-4 w-4" /> Add</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContaminationPricingMatrix;
