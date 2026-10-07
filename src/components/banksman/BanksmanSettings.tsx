import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

type S = {
  midweigh_enabled: boolean;
  midweigh_directions: string[];
  midweigh_job_types: string[];
  midweigh_excluded_products: string[];
  midweigh_excluded_accounts: string[];
  midweigh_max_age_hours: number;
};
const toList = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

/** Controls which Midweigh tickets become incoming Banksman jobs. */
export function BanksmanSettings() {
  const [s, setS] = useState<S | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("banksman_settings" as any).select("*").maybeSingle().then(({ data }) => {
      const d = (data ?? {}) as any as S;
      setS(d);
      setText({
        midweigh_directions: (d.midweigh_directions ?? []).join(", "),
        midweigh_job_types: (d.midweigh_job_types ?? []).join(", "),
        midweigh_excluded_products: (d.midweigh_excluded_products ?? []).join(", "),
        midweigh_excluded_accounts: (d.midweigh_excluded_accounts ?? []).join(", "),
      });
    });
  }, []);

  if (!s) return <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin" />;

  const save = async () => {
    setSaving(true);
    const row = {
      id: true,
      midweigh_enabled: s.midweigh_enabled,
      midweigh_max_age_hours: s.midweigh_max_age_hours,
      midweigh_directions: toList(text.midweigh_directions),
      midweigh_job_types: toList(text.midweigh_job_types),
      midweigh_excluded_products: toList(text.midweigh_excluded_products),
      midweigh_excluded_accounts: toList(text.midweigh_excluded_accounts),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("banksman_settings" as any).upsert(row as any);
    setSaving(false);
    if (error) toast.error("Couldn't save settings"); else toast.success("Banksman settings saved");
  };

  const field = (key: string, label: string, help: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={text[key] ?? ""} onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))} />
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );

  return (
    <Card className="border-border/50">
      <CardHeader><CardTitle className="text-lg">Midweigh incoming jobs</CardTitle>
        <p className="text-sm text-muted-foreground">New Midweigh tickets that match these rules appear as incoming Banksman jobs, alongside WeighOne first weighs.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div><Label>Count Midweigh as incoming</Label><p className="text-xs text-muted-foreground">Turn off to only use WeighOne first weighs.</p></div>
          <Switch checked={s.midweigh_enabled} onCheckedChange={(v) => setS({ ...s, midweigh_enabled: v })} />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {field("midweigh_directions", "Directions (In / Out)", "Comma separated, e.g. INWARD. Leave empty for all.")}
          {field("midweigh_job_types", "Job types", "Comma separated, e.g. WASTEIN, SKIP. Leave empty for all.")}
          {field("midweigh_excluded_products", "Exclude products", "Midweigh product codes to ignore, e.g. MIX MUN.")}
          {field("midweigh_excluded_accounts", "Exclude accounts", "Customer account codes to ignore, e.g. ZZSHA004.")}
          <div className="space-y-1.5">
            <Label>Only tickets from the last (hours)</Label>
            <Input type="number" min={0} value={s.midweigh_max_age_hours}
              onChange={(e) => setS({ ...s, midweigh_max_age_hours: parseInt(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground">Stops old tickets in a late upload becoming jobs. 0 = no limit.</p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}
