import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import {
  useJobTypes,
  JOB_TYPE_COLOR_OPTIONS,
  colorSolidClass,
  type JobTypeDef,
} from "./jobTypes";

const slugify = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "job_type";

export function JobTypesSettings() {
  const { types, loading, refetch } = useJobTypes(true);
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("slate");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!label.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("route_one_job_types").insert({
      key: slugify(label),
      label: label.trim(),
      color,
      display_order: (types.length || 0) + 1,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not add job type", description: error.message, variant: "destructive" });
      return;
    }
    setLabel("");
    setColor("slate");
    refetch();
  };

  const update = async (t: JobTypeDef, patch: Partial<JobTypeDef>) => {
    const { error } = await supabase.from("route_one_job_types").update(patch).eq("id", t.id!);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    refetch();
  };

  const remove = async (t: JobTypeDef) => {
    const { error } = await supabase.from("route_one_job_types").delete().eq("id", t.id!);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 space-y-3">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Add job type</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            className="flex-1 min-w-[180px]"
            placeholder="e.g. Tip & Return"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {JOB_TYPE_COLOR_OPTIONS.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={saving || !label.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-2">
          {types.map((t) => (
            <div key={t.id ?? t.key} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <span className={`h-6 w-6 rounded ${colorSolidClass(t.color)}`} />
              <Input
                className="flex-1"
                defaultValue={t.label}
                onBlur={(e) => e.target.value !== t.label && update(t, { label: e.target.value })}
              />
              <Select value={t.color} onValueChange={(v) => update(t, { color: v })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOB_TYPE_COLOR_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="w-20"
                defaultValue={t.display_order}
                onBlur={(e) => update(t, { display_order: Number(e.target.value) || 0 })}
              />
              <div className="flex items-center gap-1">
                <Switch checked={t.is_active} onCheckedChange={(v) => update(t, { is_active: v })} />
                <span className="text-xs text-muted-foreground w-12">{t.is_active ? "Active" : "Off"}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(t)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {types.length === 0 && (
            <p className="text-sm text-muted-foreground">No job types configured.</p>
          )}
        </div>
      )}
    </div>
  );
}
