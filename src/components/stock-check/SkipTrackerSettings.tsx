import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, Wand2 } from "lucide-react";

interface SkipTrackerSettingsRow {
  id: string;
  auto_clear_photo_tag: boolean;
  photos_required: number;
}

export const SkipTrackerSettings = () => {
  const { toast } = useToast();
  const [row, setRow] = useState<SkipTrackerSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("skip_tracker_settings")
      .select("id, auto_clear_photo_tag, photos_required")
      .limit(1)
      .maybeSingle();
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRow((data as SkipTrackerSettingsRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (patch: Partial<SkipTrackerSettingsRow>) => {
    if (!row) return;
    setSaving(true);
    const next = { ...row, ...patch };
    setRow(next);
    const { error } = await supabase
      .from("skip_tracker_settings")
      .update({
        auto_clear_photo_tag: next.auto_clear_photo_tag,
        photos_required: next.photos_required,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) toast({ title: "Could not save", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
  };

  /** Clear photo tags from bins that already meet the required photo count. */
  const cleanUpNow = async () => {
    if (!row) return;
    setCleaning(true);
    const { data, error } = await supabase
      .from("skip_inventory")
      .select("id, tags, photos");
    if (error) {
      setCleaning(false);
      toast({ title: "Clean-up failed", description: error.message, variant: "destructive" });
      return;
    }
    const targets = (data ?? []).filter((b: any) => {
      const tags: string[] = Array.isArray(b.tags) ? b.tags : [];
      const photos = Array.isArray(b.photos) ? b.photos : [];
      return (
        tags.some((t) => String(t).toLowerCase().includes("photo")) &&
        photos.length >= row.photos_required
      );
    });
    for (const b of targets as any[]) {
      const tags = (b.tags as string[]).filter((t) => !String(t).toLowerCase().includes("photo"));
      await supabase.from("skip_inventory").update({ tags }).eq("id", b.id);
    }
    setCleaning(false);
    toast({
      title: "Clean-up complete",
      description: `${targets.length} bin${targets.length === 1 ? "" : "s"} had the photo tag removed.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" /> Skip Tracker photo tags
        </CardTitle>
        <CardDescription>
          Controls when the "More photos needed" tag is automatically removed from a bin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5 pr-4">
            <Label className="text-sm font-medium">Auto-remove the photo tag</Label>
            <p className="text-sm text-muted-foreground">
              When on, the tag clears as soon as new photos are added to a tagged bin.
            </p>
          </div>
          <Switch
            checked={row?.auto_clear_photo_tag ?? true}
            onCheckedChange={(v) => save({ auto_clear_photo_tag: v })}
            disabled={loading || saving || !row}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Photos required for a complete bin</Label>
          <Input
            type="number"
            min={1}
            className="max-w-[140px]"
            value={row?.photos_required ?? 4}
            onChange={(e) =>
              setRow((p) => (p ? { ...p, photos_required: Number(e.target.value) || 1 } : p))
            }
            disabled={loading || !row}
          />
          <p className="text-xs text-muted-foreground">
            Bins with at least this many photos are treated as fully catalogued.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => row && save({ photos_required: row.photos_required })}
            disabled={saving || loading || !row}
          >
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" onClick={cleanUpNow} disabled={cleaning || loading || !row}>
            <Wand2 className="h-4 w-4 mr-1" />
            {cleaning ? "Cleaning…" : "Clear tags on bins with enough photos"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SkipTrackerSettings;
