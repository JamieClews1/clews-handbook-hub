import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, X, Plus, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LiveJobsSettings as SettingsType } from "@/hooks/useLiveJobsSettings";

type Props = {
  settings: SettingsType;
  onSave: (key: keyof SettingsType, value: any) => Promise<void>;
};

function TagEditor({ label, description, values, onChange }: { label: string; description: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...values, trimmed]);
      setInput("");
    }
  };

  const remove = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <Label className="font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {v}
            <button onClick={() => remove(i)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Type and press Enter..."
          className="flex-1"
        />
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={!input.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function LiveJobsSettings({ settings, onSave }: Props) {
  const [local, setLocal] = useState<SettingsType>({ ...settings });
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(local) !== JSON.stringify(settings);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const keys = Object.keys(local) as (keyof SettingsType)[];
      for (const key of keys) {
        if (JSON.stringify(local[key]) !== JSON.stringify(settings[key])) {
          await onSave(key, local[key]);
        }
      }
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" /> Live Jobs Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure how Live Jobs categorises and tracks container movements.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Numeric settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="rental_free_days" className="font-medium">Rental Free Days</Label>
            <p className="text-xs text-muted-foreground">Days before a site is flagged as over rental</p>
            <Input
              id="rental_free_days"
              type="number"
              min={1}
              value={local.rental_free_days}
              onChange={e => setLocal(p => ({ ...p, rental_free_days: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waste_truck_months" className="font-medium">Waste Truck Lookback (months)</Label>
            <p className="text-xs text-muted-foreground">How far back to show waste truck site visits</p>
            <Input
              id="waste_truck_months"
              type="number"
              min={1}
              value={local.waste_truck_months}
              onChange={e => setLocal(p => ({ ...p, waste_truck_months: parseInt(e.target.value) || 1 }))}
            />
          </div>
        </div>

        <Separator />

        {/* Vehicle regs */}
        <TagEditor
          label="Waste Truck Vehicle Registrations"
          description="Vehicle registrations that always identify a movement as a waste truck (artic)"
          values={local.artic_vehicle_regs}
          onChange={v => setLocal(p => ({ ...p, artic_vehicle_regs: v }))}
        />

        <Separator />

        {/* Container keywords */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TagEditor
            label="Skip Keywords"
            description="Container type keywords that identify Skip movements"
            values={local.skip_container_keywords}
            onChange={v => setLocal(p => ({ ...p, skip_container_keywords: v }))}
          />
          <TagEditor
            label="RoRo Keywords"
            description="Container type keywords that identify RoRo movements"
            values={local.roro_container_keywords}
            onChange={v => setLocal(p => ({ ...p, roro_container_keywords: v }))}
          />
          <TagEditor
            label="Waste Truck Keywords"
            description="Container type keywords that identify waste truck (artic) movements"
            values={local.artic_container_keywords}
            onChange={v => setLocal(p => ({ ...p, artic_container_keywords: v }))}
          />
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={handleSaveAll} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
