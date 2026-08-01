import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type CostItemRow = {
  id: string;
  name: string;
  default_charge: number;
  notes: string | null;
  is_active: boolean;
  display_order: number;
};

export function CostItemsSettings() {
  const { toast } = useToast();
  const [items, setItems] = useState<CostItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: "", default_charge: "" });

  const load = async () => {
    const { data, error } = await supabase
      .from("route_one_cost_items")
      .select("*")
      .order("display_order");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setItems((data ?? []) as CostItemRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newItem.name.trim()) return;
    const { error } = await supabase.from("route_one_cost_items").insert({
      name: newItem.name.trim(),
      default_charge: parseFloat(newItem.default_charge) || 0,
      display_order: items.length + 1,
    });
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setNewItem({ name: "", default_charge: "" });
    load();
  };

  const update = async (id: string, patch: Partial<CostItemRow>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } as CostItemRow : i)));
    const { error } = await supabase.from("route_one_cost_items").update(patch).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("route_one_cost_items").delete().eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Cost Items</h3>
        <p className="text-xs text-muted-foreground">
          Chargeable extras staff can add to a job (wait time, permits, overweight, etc.).
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Item name</Label>
          <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Permit" />
        </div>
        <div className="w-32">
          <Label className="text-xs">Default £</Label>
          <Input type="number" step="0.01" value={newItem.default_charge} onChange={(e) => setNewItem({ ...newItem, default_charge: e.target.value })} />
        </div>
        <Button size="sm" className="gap-1.5" onClick={add} disabled={!newItem.name.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cost items yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-md border border-border p-2">
              <Input
                className="flex-1 h-8 text-sm"
                value={item.name}
                onChange={(e) => setItems((p) => p.map((i) => (i.id === item.id ? { ...i, name: e.target.value } : i)))}
                onBlur={(e) => update(item.id, { name: e.target.value })}
              />
              <Input
                type="number"
                step="0.01"
                className="w-28 h-8 text-sm"
                value={item.default_charge}
                onChange={(e) => setItems((p) => p.map((i) => (i.id === item.id ? { ...i, default_charge: parseFloat(e.target.value) || 0 } : i)))}
                onBlur={(e) => update(item.id, { default_charge: parseFloat(e.target.value) || 0 })}
              />
              <div className="flex items-center gap-1.5">
                <Switch checked={item.is_active} onCheckedChange={(v) => update(item.id, { is_active: v })} />
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(item.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CostItemsSettings;
