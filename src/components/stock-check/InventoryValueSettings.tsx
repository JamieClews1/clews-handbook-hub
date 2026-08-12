import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Copy, ExternalLink } from "lucide-react";

const CONDITIONS = ["Good", "Fair", "Poor", "Damaged", "Scrapped", "Yard Use"];

interface ConditionValue {
  id: string;
  asset_type: string;
  condition: string;
  value: number;
  size_group: string | null;
  sizes: string[] | null;
}

interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  show_values: boolean;
  show_photos: boolean;
  view_count: number;
  last_viewed_at: string | null;
}

export const InventoryValueSettings = () => {
  const { toast } = useToast();
  const [values, setValues] = useState<ConditionValue[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: v }, { data: l }] = await Promise.all([
      supabase
        .from("skip_inventory_condition_values")
        .select("id, asset_type, condition, value"),
      supabase
        .from("inventory_share_links")
        .select("id, token, label, is_active, show_values, show_photos, view_count, last_viewed_at")
        .order("created_at", { ascending: false }),
    ]);
    setValues((v ?? []) as ConditionValue[]);
    setLinks((l ?? []) as ShareLink[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveValue = async (assetType: string, condition: string, raw: string) => {
    const value = Number(raw) || 0;
    const existing = values.find((v) => v.asset_type === assetType && v.condition === condition);
    const { error } = existing
      ? await supabase.from("skip_inventory_condition_values").update({ value }).eq("id", existing.id)
      : await supabase
          .from("skip_inventory_condition_values")
          .insert({ asset_type: assetType, condition, value });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const getValue = (assetType: string, condition: string) =>
    values.find((v) => v.asset_type === assetType && v.condition === condition)?.value ?? 0;

  const addLink = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("inventory_share_links").insert({
      label: newLabel.trim() || "External inventory view",
      created_by: auth.user?.id ?? null,
    });
    if (error) {
      toast({ title: "Could not create link", description: error.message, variant: "destructive" });
      return;
    }
    setNewLabel("");
    load();
  };

  const updateLink = async (id: string, patch: Partial<ShareLink>) => {
    const { error } = await supabase.from("inventory_share_links").update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    load();
  };

  const removeLink = async (id: string) => {
    const { error } = await supabase.from("inventory_share_links").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    load();
  };

  const urlFor = (token: string) => `${window.location.origin}/inventory/${token}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inventory Values by Condition</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set the value (£) of a skip or RoRo for each condition. Totals are shown on the inventory list.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            (["skip", "roro"] as const).map((t) => (
              <div key={t} className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t === "roro" ? "RoRo values" : "Skip values"}
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {CONDITIONS.map((c) => (
                    <div key={c} className="rounded-lg border border-border p-3 space-y-1">
                      <p className="text-xs font-medium">{c}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground text-sm">£</span>
                        <Input
                          type="number"
                          step="1"
                          defaultValue={getValue(t, c)}
                          onBlur={(e) => saveValue(t, c, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>External Inventory Links</CardTitle>
          <p className="text-sm text-muted-foreground">
            Share a read-only inventory view with a third party — no login needed.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {links.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">No links created yet.</p>
          )}
          {links.map((l) => (
            <div key={l.id} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="flex-1 min-w-[180px]"
                  defaultValue={l.label ?? ""}
                  placeholder="Label"
                  onBlur={(e) =>
                    e.target.value !== (l.label ?? "") && updateLink(l.id, { label: e.target.value })
                  }
                />
                <Badge variant="secondary">{l.view_count} views</Badge>
                <Button variant="ghost" size="icon" onClick={() => removeLink(l.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={l.is_active}
                    onCheckedChange={(v) => updateLink(l.id, { is_active: v })}
                  />
                  {l.is_active ? "Active" : "Disabled"}
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={l.show_values}
                    onCheckedChange={(v) => updateLink(l.id, { show_values: v })}
                  />
                  Show values
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={l.show_photos}
                    onCheckedChange={(v) => updateLink(l.id, { show_photos: v })}
                  />
                  Show photos
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={urlFor(l.token)} className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(urlFor(l.token));
                    toast({ title: "Link copied" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={urlFor(l.token)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">New link label</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Auditor access"
              />
            </div>
            <Button onClick={addLink} className="gap-1">
              <Plus className="h-4 w-4" /> Create link
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
