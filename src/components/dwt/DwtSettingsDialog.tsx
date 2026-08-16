import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type DwtSettings = {
  id: string;
  autofill_enabled: boolean;
  default_physical_form: string;
  default_container_type: string;
  default_means_of_transport: string;
  default_carrier_name: string;
  default_carrier_registration: string;
};

export const DWT_SETTINGS_KEY = ["dwt-settings"];

export const useDwtSettings = () =>
  useQuery({
    queryKey: DWT_SETTINGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dwt_settings")
        .select("id, autofill_enabled, default_physical_form, default_container_type, default_means_of_transport, default_carrier_name, default_carrier_registration")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as DwtSettings) ?? null;
    },
    staleTime: 60_000,
  });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DwtSettingsDialog = ({ open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const { data: settings } = useDwtSettings();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<DwtSettings, "id">>({
    autofill_enabled: true,
    default_physical_form: "Solid",
    default_container_type: "Van",
    default_means_of_transport: "Road",
    default_carrier_name: "",
    default_carrier_registration: "",
  });

  useEffect(() => {
    if (settings) {
      const { id, ...rest } = settings;
      setForm(rest);
    }
  }, [settings, open]);

  const save = async () => {
    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase.from("dwt_settings").update(form).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dwt_settings").insert(form);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: DWT_SETTINGS_KEY });
      toast.success("Settings saved");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Digital Waste Tracking settings</DialogTitle>
          <DialogDescription>
            Auto-fill values used when a field is missing from the Data Hub record. Manual edits always take priority.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Auto-fill missing information</p>
            <p className="text-xs text-muted-foreground">Apply the defaults below to blank fields</p>
          </div>
          <Switch
            checked={form.autofill_enabled}
            onCheckedChange={(v) => setForm({ ...form, autofill_enabled: v })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Physical form</Label>
            <Input
              value={form.default_physical_form}
              onChange={(e) => setForm({ ...form, default_physical_form: e.target.value })}
              placeholder="Solid"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Container</Label>
            <Input
              value={form.default_container_type}
              onChange={(e) => setForm({ ...form, default_container_type: e.target.value })}
              placeholder="Van"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Means of transport</Label>
            <Input
              value={form.default_means_of_transport}
              onChange={(e) => setForm({ ...form, default_means_of_transport: e.target.value })}
              placeholder="Road"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Carrier name</Label>
            <Input
              value={form.default_carrier_name}
              onChange={(e) => setForm({ ...form, default_carrier_name: e.target.value })}
              placeholder="Leave blank for none"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Carrier registration</Label>
            <Input
              value={form.default_carrier_registration}
              onChange={(e) => setForm({ ...form, default_carrier_registration: e.target.value })}
              placeholder="e.g. CBDU203180"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DwtSettingsDialog;
