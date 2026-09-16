import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Loader2, X, Plus, Route } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoutingRules, type RoutingRules } from "@/hooks/useRoutingRules";
import { usePostcodeZones } from "@/hooks/usePostcodeZones";

const NumField = ({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium">{label}</Label>
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    <Input type="number" min={0} value={value} onChange={e => onChange(Number(e.target.value) || 0)} />
  </div>
);

const ToggleRow = ({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export const RoutingRulesSettings = () => {
  const { rules, isLoading, saveRule } = useRoutingRules();
  const { zones } = usePostcodeZones();
  const [local, setLocal] = useState<RoutingRules>(rules);
  const [regInput, setRegInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(rules); }, [rules]);

  const set = <K extends keyof RoutingRules>(k: K, v: RoutingRules[K]) => setLocal(p => ({ ...p, [k]: v }));
  const hasChanges = JSON.stringify(local) !== JSON.stringify(rules);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const key of Object.keys(local) as (keyof RoutingRules)[]) {
        if (JSON.stringify(local[key]) !== JSON.stringify(rules[key])) {
          await saveRule.mutateAsync({ key, value: local[key] });
        }
      }
      toast.success("Routing rules saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save routing rules");
    }
    setSaving(false);
  };

  const addReg = () => {
    const v = regInput.trim().toUpperCase();
    if (v && !local.artic_regs.some(r => r.toUpperCase() === v)) {
      set("artic_regs", [...local.artic_regs, v]);
      setRegInput("");
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading routing rules...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Route className="h-4 w-4" /> Loading limits</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumField label="Max skips per load" hint="Empty skips leaving together" value={local.max_skips_per_load} onChange={v => set("max_skips_per_load", v)} />
          <NumField label="Max 8yd per load" value={local.max_8yd_per_load} onChange={v => set("max_8yd_per_load", v)} />
          <NumField label="Max 12yd per load" value={local.max_12yd_per_load} onChange={v => set("max_12yd_per_load", v)} />
          <NumField label="Max skips on an empty vehicle" value={local.max_skips_on_empty_vehicle} onChange={v => set("max_skips_on_empty_vehicle", v)} />
          <NumField label="Ro-Ro containers per trip" value={local.roro_containers_per_trip} onChange={v => set("roro_containers_per_trip", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Time assumptions</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NumField label="Delivery (mins)" value={local.mins_delivery} onChange={v => set("mins_delivery", v)} />
          <NumField label="Collection (mins)" value={local.mins_collection} onChange={v => set("mins_collection", v)} />
          <NumField label="Exchange (mins)" value={local.mins_exchange} onChange={v => set("mins_exchange", v)} />
          <NumField label="Tipping (mins)" value={local.mins_tipping} onChange={v => set("mins_tipping", v)} />
          <NumField label="Travel between jobs (mins)" value={local.mins_travel} onChange={v => set("mins_travel", v)} />
          <NumField label="Break (mins)" value={local.mins_break} onChange={v => set("mins_break", v)} />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Day start</Label>
            <Input type="time" value={local.day_start} onChange={e => set("day_start", e.target.value)} />
          </div>
          <NumField label="Day length (hours)" value={local.day_length_hours} onChange={v => set("day_length_hours", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Travel times</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">How travel time is worked out</Label>
            <Select value={local.travel_model} onValueChange={(v: any) => set("travel_model", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">Postcode to postcode distance</SelectItem>
                <SelectItem value="zone">Average time per zone</SelectItem>
                <SelectItem value="fixed">One flat allowance between jobs</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {local.travel_model === "distance"
                ? "Real miles between each postcode, converted at the average speed below. Falls back to zone times, then the flat allowance, when a postcode can't be found."
                : local.travel_model === "zone"
                ? "Each zone has an average time from the yard; jobs in the same zone use the local hop time."
                : "Every leg uses the same flat travel allowance."}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Yard postcode</Label>
              <Input value={local.yard_postcode} onChange={e => set("yard_postcode", e.target.value.toUpperCase())} placeholder="CV21 1EA" className="uppercase" />
            </div>
            <NumField label="Average speed (mph)" hint="Used when speed bands are off" value={local.avg_speed_mph} onChange={v => set("avg_speed_mph", v)} />
            <NumField label="Road distance factor" hint="Straight line miles × this" value={local.road_distance_factor} onChange={v => set("road_distance_factor", v)} />
            <NumField label="Shortest travel leg (mins)" value={local.mins_travel_min} onChange={v => set("mins_travel_min", v)} />
            <NumField label="Within the same zone (mins)" value={local.mins_travel_within_zone} onChange={v => set("mins_travel_within_zone", v)} />
            <NumField label="Flat allowance (mins)" hint="Used when nothing else is known" value={local.mins_travel} onChange={v => set("mins_travel", v)} />
          </div>

          {local.travel_model === "distance" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-xs font-medium">Different speeds for short and long journeys</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Town work crawls; longer runs are mostly A-road and motorway, so they average a higher speed.
                  </p>
                </div>
                <Switch
                  checked={local.speed_bands_enabled}
                  onCheckedChange={v => set("speed_bands_enabled", v)}
                />
              </div>
              {local.speed_bands_enabled && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <NumField label="Short up to (miles)" value={local.speed_band_short_miles} onChange={v => set("speed_band_short_miles", v)} />
                  <NumField label="Local speed (mph)" value={local.avg_speed_short_mph} onChange={v => set("avg_speed_short_mph", v)} />
                  <NumField label="Mixed roads speed (mph)" value={local.avg_speed_mid_mph} onChange={v => set("avg_speed_mid_mph", v)} />
                  <NumField label="Long from (miles)" value={local.speed_band_long_miles} onChange={v => set("speed_band_long_miles", v)} />
                  <NumField label="Long run speed (mph)" value={local.avg_speed_long_mph} onChange={v => set("avg_speed_long_mph", v)} />
                </div>
              )}
            </div>
          )}

          {local.travel_model !== "fixed" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">Average minutes from the yard to each zone</Label>
              {zones.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No postcode zones set up yet.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {zones.map(z => (
                    <div key={z.id} className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{z.zone_name}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={local.zone_travel_minutes?.[z.zone_name] ?? ""}
                        placeholder="—"
                        onChange={e => {
                          const next = { ...(local.zone_travel_minutes || {}) };
                          if (e.target.value === "") delete next[z.zone_name];
                          else next[z.zone_name] = Number(e.target.value) || 0;
                          set("zone_travel_minutes", next);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Artic vehicle registrations</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Drivers on these registrations get the artic / curtain side work.</p>
          <div className="flex flex-wrap gap-1.5 min-h-[32px]">
            {local.artic_regs.map((r, i) => (
              <Badge key={i} variant="secondary" className="gap-1 pr-1 font-mono">
                {r}
                <button onClick={() => set("artic_regs", local.artic_regs.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={regInput} onChange={e => setRegInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addReg())} placeholder="e.g. FG61 SYV" className="flex-1 uppercase" />
            <Button type="button" size="sm" variant="outline" onClick={addReg} disabled={!regInput.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Rules</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border">
          <ToggleRow label="Skip drivers never get Ro-Ro work" hint="Work is only given to a vehicle that can carry it." checked={local.skip_drivers_no_roro} onChange={v => set("skip_drivers_no_roro", v)} />
          <ToggleRow label="Drivers with no jobs are not working" hint="A driver with nothing booked that day is left out of the plan." checked={local.idle_drivers_not_working} onChange={v => set("idle_drivers_not_working", v)} />
          <ToggleRow label="Loaded skips return one at a time" hint="Full skips come back singly for tipping." checked={local.loaded_skips_one_at_a_time} onChange={v => set("loaded_skips_one_at_a_time", v)} />
        </CardContent>
      </Card>

      <Separator />
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Routing Rules
        </Button>
      </div>
    </div>
  );
};
