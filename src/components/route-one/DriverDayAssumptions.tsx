import { useEffect, useState } from "react";
import { useRoutingRules, type RoutingRules } from "@/hooks/useRoutingRules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { toast } from "sonner";

const fields: { key: keyof RoutingRules; label: string; min: number; step?: number }[] = [
  { key: "day_length_hours", label: "Day length including break (hours)", min: 1, step: 0.25 },
  { key: "mins_break", label: "Break within the day (minutes)", min: 0 },
  { key: "mins_delivery", label: "Delivery handling (minutes)", min: 0 },
  { key: "mins_collection", label: "Collection handling (minutes)", min: 0 },
  { key: "mins_exchange", label: "Exchange handling (minutes)", min: 0 },
  { key: "mins_tipping", label: "Tipping per return (minutes)", min: 0 },
];
export function DriverDayAssumptions() {
  const { rules, isLoading, saveRule } = useRoutingRules();
  const [local, setLocal] = useState(rules);
  const [saving, setSaving] = useState(false);
  useEffect(() => setLocal(rules), [rules]);
  const save = async () => {
    if (local.mins_break >= local.day_length_hours * 60) { toast.error("The break must be shorter than the day."); return; }
    setSaving(true);
    try {
      for (const key of [...fields.map(f => f.key), "yard_postcode" as const]) {
        if (local[key] !== rules[key]) await saveRule.mutateAsync({ key, value: local[key] });
      }
      toast.success("Driver day assumptions saved");
    } catch { toast.error("Could not save assumptions. Try again."); }
    finally { setSaving(false); }
  };
  return <section className="border-b border-border pb-4 space-y-3" aria-label="Driver day assumptions">
    <h3 className="text-sm font-semibold">Driver day assumptions</h3>
    <p className="text-xs text-muted-foreground">Standard day: 10 hours including a 45-minute break — 9 hours 15 minutes for driving and job handling.</p>
    <div className="grid sm:grid-cols-2 gap-3">
      {fields.map(field => <div key={field.key} className="space-y-1"><Label htmlFor={`driver-${field.key}`} className="text-xs">{field.label}</Label><Input id={`driver-${field.key}`} type="number" min={field.min} step={field.step ?? 1} disabled={isLoading} value={String(local[field.key])} onChange={e => setLocal(p => ({ ...p, [field.key]: Number(e.target.value) }))} /></div>)}
      <div className="space-y-1"><Label htmlFor="driver-yard" className="text-xs">Start / finish yard postcode</Label><Input id="driver-yard" value={local.yard_postcode} onChange={e => setLocal(p => ({ ...p, yard_postcode: e.target.value.toUpperCase() }))} /></div>
    </div>
    <p className="text-xs text-muted-foreground">Estimated travel follows the displayed job order, starting and finishing at the yard. Collections, exchanges and tipping jobs return to the yard for unloading. Deliveries continue to the next site. Postcode distances are adjusted for roads, using {rules.avg_speed_short_mph} / {rules.avg_speed_mid_mph} / {rules.avg_speed_long_mph} mph for local / mixed / long journeys and a ×{rules.road_distance_factor} road factor. Missing postcodes use zone times, then {rules.mins_travel} minutes per leg. No live traffic or waiting-time allowance. Travel speeds and loading limits are in Routing Rules.</p>
    <Button variant="outline" size="sm" disabled={saving || isLoading || JSON.stringify(local) === JSON.stringify(rules)} onClick={save}><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save day assumptions"}</Button>
  </section>;
}