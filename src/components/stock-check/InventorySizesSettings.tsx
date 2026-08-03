import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export interface InventorySize {
  id: string;
  name: string;
  asset_type: string;
  display_order: number;
  is_active: boolean;
}

export const InventorySizesSettings = () => {
  const { toast } = useToast();
  const [sizes, setSizes] = useState<InventorySize[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("skip");

  const load = async () => {
    const { data, error } = await supabase
      .from("skip_inventory_sizes")
      .select("id, name, asset_type, display_order, is_active")
      .order("asset_type")
      .order("display_order");
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setSizes((data ?? []) as InventorySize[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!newName.trim()) return;
    const maxOrder = Math.max(
      0,
      ...sizes.filter((s) => s.asset_type === newType).map((s) => s.display_order),
    );
    const { error } = await supabase.from("skip_inventory_sizes").insert({
      name: newName.trim().toUpperCase(),
      asset_type: newType,
      display_order: maxOrder + 1,
    });
    if (error) {
      toast({ title: "Could not add", description: error.message, variant: "destructive" });
      return;
    }
    setNewName("");
    load();
  };

  const update = async (s: InventorySize, patch: Partial<InventorySize>) => {
    const { error } = await supabase.from("skip_inventory_sizes").update(patch).eq("id", s.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    load();
  };

  const remove = async (s: InventorySize) => {
    const { error } = await supabase.from("skip_inventory_sizes").delete().eq("id", s.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    load();
  };

  const group = (t: string) => sizes.filter((s) => s.asset_type === t);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Sizes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          (["skip", "roro"] as const).map((t) => (
            <div key={t} className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t === "roro" ? "RoRo sizes" : "Skip sizes"} ({group(t).length})
              </Label>
              {group(t).map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <Input
                    className="flex-1"
                    defaultValue={s.name}
                    onBlur={(e) =>
                      e.target.value.trim() &&
                      e.target.value !== s.name &&
                      update(s, { name: e.target.value.trim().toUpperCase() })
                    }
                  />
                  <Input
                    type="number"
                    className="w-20"
                    defaultValue={s.display_order}
                    onBlur={(e) => update(s, { display_order: Number(e.target.value) || 0 })}
                  />
                  <div className="flex items-center gap-1">
                    <Switch checked={s.is_active} onCheckedChange={(v) => update(s, { is_active: v })} />
                    <span className="text-xs text-muted-foreground w-12">
                      {s.is_active ? "Active" : "Off"}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {group(t).length === 0 && (
                <p className="text-sm text-muted-foreground">No sizes configured.</p>
              )}
            </div>
          ))
        )}

        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">New size</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. 12 CU YD"
            />
          </div>
          <div className="w-40">
            <Label className="text-xs">Applies to</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip</SelectItem>
                <SelectItem value="roro">RoRo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={!newName.trim()} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
