import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Save, Package, Scale, Plus, Trash2 } from "lucide-react";

interface WasteType {
  id: string;
  waste_type: string;
  default_avg_weight_kg: number;
  pallet_weight_kg: number;
  display_order: number;
  is_active: boolean;
  isNew?: boolean;
}

interface LoadReportSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LoadReportSettings = ({ open, onOpenChange }: LoadReportSettingsProps) => {
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [defaultPalletWeight, setDefaultPalletWeight] = useState("20");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newWasteTypeName, setNewWasteTypeName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Fetch waste types
      const { data: wasteData, error: wasteError } = await supabase
        .from("load_waste_types")
        .select("*")
        .order("display_order");

      if (wasteError) throw wasteError;

      // Fetch default pallet weight setting
      const { data: settingsData, error: settingsError } = await supabase
        .from("load_report_settings")
        .select("*")
        .eq("setting_key", "default_pallet_weight_kg")
        .single();

      if (settingsError && settingsError.code !== "PGRST116") {
        throw settingsError;
      }

      setWasteTypes((wasteData || []) as WasteType[]);
      if (settingsData) {
        setDefaultPalletWeight(settingsData.setting_value);
      }
    } catch (error: any) {
      toast({
        title: "Error loading settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddWasteType = () => {
    if (!newWasteTypeName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the waste type.",
        variant: "destructive",
      });
      return;
    }

    const maxOrder = wasteTypes.reduce((max, wt) => Math.max(max, wt.display_order), 0);
    const newType: WasteType = {
      id: `new-${Date.now()}`,
      waste_type: newWasteTypeName.trim(),
      default_avg_weight_kg: 300,
      pallet_weight_kg: Number(defaultPalletWeight),
      display_order: maxOrder + 1,
      is_active: true,
      isNew: true,
    };

    setWasteTypes((prev) => [...prev, newType]);
    setNewWasteTypeName("");
    setShowAddForm(false);
  };

  const handleDeleteWasteType = (id: string) => {
    setWasteTypes((prev) => prev.filter((wt) => wt.id !== id));
  };

  const handleWasteTypeChange = (id: string, field: keyof WasteType, value: number | string) => {
    setWasteTypes((prev) =>
      prev.map((wt) => (wt.id === id ? { ...wt, [field]: value } : wt))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Handle new waste types (insert)
      const newTypes = wasteTypes.filter((wt) => wt.isNew);
      for (const wt of newTypes) {
        const { error } = await supabase.from("load_waste_types").insert({
          waste_type: wt.waste_type,
          default_avg_weight_kg: wt.default_avg_weight_kg,
          pallet_weight_kg: wt.pallet_weight_kg,
          display_order: wt.display_order,
          is_active: true,
        });
        if (error) throw error;
      }

      // Update existing waste types
      const existingTypes = wasteTypes.filter((wt) => !wt.isNew);
      for (const wt of existingTypes) {
        const { error } = await supabase
          .from("load_waste_types")
          .update({
            waste_type: wt.waste_type,
            default_avg_weight_kg: wt.default_avg_weight_kg,
            pallet_weight_kg: wt.pallet_weight_kg,
          })
          .eq("id", wt.id);

        if (error) throw error;
      }

      // Update default pallet weight setting
      const { error: settingsError } = await supabase
        .from("load_report_settings")
        .update({ setting_value: defaultPalletWeight })
        .eq("setting_key", "default_pallet_weight_kg");

      if (settingsError) throw settingsError;

      toast({
        title: "Settings saved",
        description: "Your load report settings have been updated.",
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Load Report Settings
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global Pallet Weight */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Pallet Weight Deduction
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  This weight is subtracted from each pallet to account for the wooden pallet weight.
                </p>
                <div className="flex items-center gap-3">
                  <Label htmlFor="pallet-weight" className="whitespace-nowrap">
                    Default Pallet Weight (KG):
                  </Label>
                  <Input
                    id="pallet-weight"
                    type="number"
                    min="0"
                    step="0.5"
                    value={defaultPalletWeight}
                    onChange={(e) => setDefaultPalletWeight(e.target.value)}
                    className="w-32"
                  />
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Waste Types */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Waste Types & Default Weights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure the default average weight for each waste type. This will be used as the starting value when creating new reports.
                </p>
                
                <div className="space-y-3">
                  {wasteTypes.map((wt) => (
                    <div
                      key={wt.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <Input
                          value={wt.waste_type}
                          onChange={(e) =>
                            handleWasteTypeChange(wt.id, "waste_type", e.target.value)
                          }
                          className="font-medium"
                          placeholder="Waste type name"
                        />
                        {wt.isNew && (
                          <span className="ml-2 text-xs text-primary">(new)</span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            Avg Weight (KG):
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="10"
                            value={wt.default_avg_weight_kg}
                            onChange={(e) =>
                              handleWasteTypeChange(wt.id, "default_avg_weight_kg", Number(e.target.value))
                            }
                            className="w-24 h-9"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            Pallet Deduct (KG):
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={wt.pallet_weight_kg}
                            onChange={(e) =>
                              handleWasteTypeChange(wt.id, "pallet_weight_kg", Number(e.target.value))
                            }
                            className="w-24 h-9"
                          />
                        </div>
                        {wt.isNew && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteWasteType(wt.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add new waste type */}
                {showAddForm ? (
                  <div className="flex items-center gap-3 p-3 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
                    <Input
                      placeholder="Enter waste type name..."
                      value={newWasteTypeName}
                      onChange={(e) => setNewWasteTypeName(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddWasteType();
                        if (e.key === "Escape") {
                          setShowAddForm(false);
                          setNewWasteTypeName("");
                        }
                      }}
                    />
                    <Button onClick={handleAddWasteType} size="sm">
                      Add
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewWasteTypeName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowAddForm(true)}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add waste type
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
