import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerRow {
  id: string;
  customer_name: string;
  is_container_load_customer: boolean;
}

export const ContainerLoadSettingsDialog = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("customers")
        .select("id, customer_name, is_container_load_customer")
        .order("customer_name");
      const list = (data || []) as CustomerRow[];
      setRows(list);
      setSelected(new Set(list.filter((c) => c.is_container_load_customer).map((c) => c.id)));
      setLoading(false);
    })();
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.customer_name.toLowerCase().includes(q));
  }, [rows, search]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const enable = rows.filter((r) => selected.has(r.id) && !r.is_container_load_customer).map((r) => r.id);
      const disable = rows.filter((r) => !selected.has(r.id) && r.is_container_load_customer).map((r) => r.id);
      if (enable.length)
        await supabase.from("customers").update({ is_container_load_customer: true }).in("id", enable);
      if (disable.length)
        await supabase.from("customers").update({ is_container_load_customer: false }).in("id", disable);
      toast({ title: "Settings saved", description: `${selected.size} customer(s) enabled.` });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Container load customers</DialogTitle>
          <DialogDescription>
            Select which customers do container loads. Only these will appear in the customer
            picker on a container load.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers…"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No customers.</p>
          ) : (
            filtered.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/40"
              >
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                <span className="text-sm">{c.customer_name}</span>
              </label>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">{selected.size} selected</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
