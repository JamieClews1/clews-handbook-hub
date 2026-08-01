import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Trash2, Search } from "lucide-react";

type ContainerType = {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
};

export function ContainerTypesSettings() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ContainerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("route_one_container_types")
      .select("id, name, display_order, is_active")
      .order("display_order")
      .order("name");
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows((data ?? []) as ContainerType[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /** Pull any container types present in the Data Hub that aren't listed yet. */
  const syncFromDataHub = async () => {
    setSyncing(true);
    const { data, error } = await supabase
      .from("data_hub_jobs")
      .select("container_type")
      .not("container_type", "is", null)
      .limit(20000);
    if (error) {
      setSyncing(false);
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
      return;
    }
    const existing = new Set(rows.map((r) => r.name.toLowerCase()));
    const found = new Map<string, string>();
    for (const r of (data ?? []) as any[]) {
      const n = (r.container_type ?? "").trim();
      if (!n) continue;
      if (["WASTEIN", "WASTEOUT"].includes(n.toUpperCase())) continue;
      if (existing.has(n.toLowerCase())) continue;
      if (!found.has(n.toLowerCase())) found.set(n.toLowerCase(), n);
    }
    const toInsert = [...found.values()].map((name, i) => ({
      name,
      display_order: rows.length + i + 1,
    }));
    if (toInsert.length === 0) {
      setSyncing(false);
      toast({ title: "Already up to date", description: "No new container types found." });
      return;
    }
    const { error: insErr } = await supabase.from("route_one_container_types").insert(toInsert);
    setSyncing(false);
    if (insErr) {
      toast({ title: "Sync failed", description: insErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Synced", description: `${toInsert.length} container type(s) added.` });
    load();
  };

  const add = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase
      .from("route_one_container_types")
      .insert({ name: newName.trim(), display_order: rows.length + 1 });
    if (error) {
      toast({ title: "Could not add", description: error.message, variant: "destructive" });
      return;
    }
    setNewName("");
    load();
  };

  const update = async (r: ContainerType, patch: Partial<ContainerType>) => {
    const { error } = await supabase.from("route_one_container_types").update(patch).eq("id", r.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    load();
  };

  const remove = async (r: ContainerType) => {
    const { error } = await supabase.from("route_one_container_types").delete().eq("id", r.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    load();
  };

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Container types ({rows.length})
          </Label>
          <Button variant="outline" size="sm" onClick={syncFromDataHub} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sync from Data Hub
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="flex-1 min-w-[180px]"
            placeholder="Add container type manually"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button onClick={add} disabled={!newName.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search container types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <Input
                className="flex-1"
                defaultValue={r.name}
                onBlur={(e) => e.target.value !== r.name && update(r, { name: e.target.value })}
              />
              <Input
                type="number"
                className="w-20"
                defaultValue={r.display_order}
                onBlur={(e) => update(r, { display_order: Number(e.target.value) || 0 })}
              />
              <div className="flex items-center gap-1">
                <Switch checked={r.is_active} onCheckedChange={(v) => update(r, { is_active: v })} />
                <span className="text-xs text-muted-foreground w-12">{r.is_active ? "Active" : "Off"}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(r)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No container types match.</p>
          )}
        </div>
      )}
    </div>
  );
}
