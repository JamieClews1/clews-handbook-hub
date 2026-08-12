import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, X } from "lucide-react";
import { InventorySizesSettings } from "./InventorySizesSettings";
import { InventoryValueSettings } from "./InventoryValueSettings";


interface ContainerType {
  id: string;
  name: string;
  category: string;
  display_order: number;
  is_active: boolean;
  data_hub_keywords: string[];
  default_runner: number;
}

interface ExcludedSite {
  id: string;
  site_name: string;
  reason: string | null;
}

export const StockCheckSettings = () => {
  const { toast } = useToast();
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [excludedSites, setExcludedSites] = useState<ExcludedSite[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeCategory, setNewTypeCategory] = useState("skip");
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteReason, setNewSiteReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const [{ data: types }, { data: sites }] = await Promise.all([
      supabase
        .from("stock_check_container_types")
        .select("*")
        .order("display_order"),
      supabase
        .from("stock_check_excluded_sites")
        .select("*")
        .order("site_name"),
    ]);

    if (types) setContainerTypes(types as ContainerType[]);
    if (sites) setExcludedSites(sites);
    setLoading(false);
  };

  const toggleTypeActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("stock_check_container_types")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setContainerTypes((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: isActive } : t))
      );
    }
  };

  const addContainerType = async () => {
    if (!newTypeName.trim()) return;

    const maxOrder = Math.max(...containerTypes.map((t) => t.display_order), 0);
    const { data, error } = await supabase
      .from("stock_check_container_types")
      .insert({
        name: newTypeName.trim(),
        category: newTypeCategory,
        display_order: maxOrder + 1,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      setContainerTypes((prev) => [...prev, data as ContainerType]);
      setNewTypeName("");
      toast({ title: "Added", description: `${newTypeName} added.` });
    }
  };

  const updateKeywords = async (id: string, keywords: string) => {
    const keywordArray = keywords.split(",").map((k) => k.trim()).filter(Boolean);
    const { error } = await supabase
      .from("stock_check_container_types")
      .update({ data_hub_keywords: keywordArray })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setContainerTypes((prev) =>
        prev.map((t) => (t.id === id ? { ...t, data_hub_keywords: keywordArray } : t))
      );
      toast({ title: "Updated", description: "Keywords saved." });
    }
  };

  const updateDefaultRunner = async (id: string, value: number) => {
    setContainerTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, default_runner: value } : t))
    );
    const { error } = await supabase
      .from("stock_check_container_types")
      .update({ default_runner: value } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const addExcludedSite = async () => {
    if (!newSiteName.trim()) return;

    const { data, error } = await supabase
      .from("stock_check_excluded_sites")
      .insert({ site_name: newSiteName.trim(), reason: newSiteReason.trim() || null })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      setExcludedSites((prev) => [...prev, data]);
      setNewSiteName("");
      setNewSiteReason("");
      toast({ title: "Site excluded", description: `${newSiteName} will be excluded from projections.` });
    }
  };

  const removeExcludedSite = async (id: string) => {
    const { error } = await supabase
      .from("stock_check_excluded_sites")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setExcludedSites((prev) => prev.filter((s) => s.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Container Types */}
      <Card>
        <CardHeader>
          <CardTitle>Container Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {containerTypes.map((type) => (
            <div key={type.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <Switch
                checked={type.is_active}
                onCheckedChange={(checked) => toggleTypeActive(type.id, checked)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{type.name}</span>
                  <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded">
                    {type.category}
                  </span>
                </div>
                <KeywordEditor
                  keywords={type.data_hub_keywords}
                  onSave={(kw) => updateKeywords(type.id, kw)}
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Default Runner</Label>
                <Input
                  type="number"
                  min={0}
                  className="w-16 h-8 text-center text-sm"
                  value={type.default_runner}
                  onChange={(e) => updateDefaultRunner(type.id, parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          ))}

          {/* Add new type */}
          <div className="flex items-end gap-2 pt-4 border-t border-border">
            <div className="flex-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g., 18yd"
              />
            </div>
            <div className="w-28">
              <Label className="text-xs">Category</Label>
              <Select value={newTypeCategory} onValueChange={setNewTypeCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="roro">RoRo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addContainerType} size="icon" className="h-10 w-10">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Excluded Sites */}
      <Card>
        <CardHeader>
          <CardTitle>Excluded Sites</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sites with their own skips/RoRos — their movements won't affect stock projections.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {excludedSites.map((site) => (
            <div key={site.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <span className="font-medium text-foreground">{site.site_name}</span>
                {site.reason && (
                  <p className="text-xs text-muted-foreground">{site.reason}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => removeExcludedSite(site.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-end gap-2 pt-4 border-t border-border">
            <div className="flex-1">
              <Label className="text-xs">Site Name</Label>
              <Input
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="e.g., Customer X Depot"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Reason (optional)</Label>
              <Input
                value={newSiteReason}
                onChange={(e) => setNewSiteReason(e.target.value)}
                placeholder="Has own containers"
              />
            </div>
            <Button onClick={addExcludedSite} size="icon" className="h-10 w-10">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <InventorySizesSettings />

      <InventoryValueSettings />
    </div>

  );
};

const KeywordEditor = ({ keywords, onSave }: { keywords: string[]; onSave: (kw: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(keywords.join(", "));

  if (!editing) {
    return (
      <p
        className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={() => setEditing(true)}
      >
        Keywords: {keywords.length > 0 ? keywords.join(", ") : "Click to set"}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs h-7"
        placeholder="Comma-separated keywords"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(value);
            setEditing(false);
          }
        }}
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => {
          onSave(value);
          setEditing(false);
        }}
      >
        <Save className="h-3 w-3" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => setEditing(false)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};
