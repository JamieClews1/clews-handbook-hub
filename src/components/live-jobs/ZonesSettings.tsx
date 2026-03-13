import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, X, Plus, Save, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PostcodeZone } from "@/hooks/usePostcodeZones";

type Props = {
  zones: PostcodeZone[];
  onUpdate: (id: string, updates: Partial<Pick<PostcodeZone, "zone_name" | "postcodes">>) => Promise<void>;
  onAdd: (name: string, postcodes: string[], order: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function ZonesSettings({ zones, onUpdate, onAdd, onDelete }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editInputs, setEditInputs] = useState<Record<string, string>>({});

  const handleAddPostcode = async (zone: PostcodeZone) => {
    const input = (editInputs[zone.id] || "").trim().toUpperCase();
    if (!input) return;
    if (zone.postcodes.some(p => p.toUpperCase() === input)) {
      toast.error("Postcode already exists in this zone");
      return;
    }
    setSaving(zone.id);
    try {
      await onUpdate(zone.id, { postcodes: [...zone.postcodes, input] });
      setEditInputs(prev => ({ ...prev, [zone.id]: "" }));
      toast.success(`Added ${input} to ${zone.zone_name}`);
    } catch {
      toast.error("Failed to add postcode");
    }
    setSaving(null);
  };

  const handleRemovePostcode = async (zone: PostcodeZone, idx: number) => {
    setSaving(zone.id);
    try {
      await onUpdate(zone.id, { postcodes: zone.postcodes.filter((_, i) => i !== idx) });
    } catch {
      toast.error("Failed to remove postcode");
    }
    setSaving(null);
  };

  const handleAddZone = async () => {
    if (!newZoneName.trim()) return;
    setAdding(true);
    try {
      await onAdd(newZoneName.trim(), [], (zones.length + 1) * 10);
      setNewZoneName("");
      toast.success("Zone created");
    } catch {
      toast.error("Failed to create zone");
    }
    setAdding(false);
  };

  const handleDeleteZone = async (zone: PostcodeZone) => {
    if (!confirm(`Delete "${zone.zone_name}" and all its postcodes?`)) return;
    setSaving(zone.id);
    try {
      await onDelete(zone.id);
      toast.success("Zone deleted");
    } catch {
      toast.error("Failed to delete zone");
    }
    setSaving(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" /> Postcode Zones
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Define geographic zones by postcode prefix. Jobs are matched to zones using the site postcode from Skiptrak data.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {zones.map(zone => (
          <div key={zone.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-base">{zone.zone_name}</Label>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteZone(zone)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {zone.postcodes.map((pc, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pr-1">
                  {pc}
                  <button onClick={() => handleRemovePostcode(zone, i)} className="ml-1 hover:text-destructive" disabled={saving === zone.id}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {zone.postcodes.length === 0 && <span className="text-xs text-muted-foreground italic">No postcodes added</span>}
            </div>
            <div className="flex gap-2">
              <Input
                value={editInputs[zone.id] || ""}
                onChange={e => setEditInputs(prev => ({ ...prev, [zone.id]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddPostcode(zone))}
                placeholder="Add postcode (e.g. CV21 1)..."
                className="flex-1 max-w-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={() => handleAddPostcode(zone)} disabled={saving === zone.id || !(editInputs[zone.id] || "").trim()}>
                {saving === zone.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
            <Separator />
          </div>
        ))}

        {/* Add new zone */}
        <div className="space-y-2 pt-2">
          <Label className="font-medium">Add New Zone</Label>
          <div className="flex gap-2">
            <Input
              value={newZoneName}
              onChange={e => setNewZoneName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddZone())}
              placeholder="Zone name..."
              className="flex-1 max-w-xs"
            />
            <Button onClick={handleAddZone} disabled={adding || !newZoneName.trim()}>
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Zone
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
