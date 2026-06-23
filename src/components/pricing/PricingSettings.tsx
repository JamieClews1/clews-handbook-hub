import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Fuel, ExternalLink, FileText, Save, Paperclip, Upload, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePricingSettings, type PricingSettings as PricingSettingsType } from "@/hooks/usePricingSettings";

const ATTACHMENT_BUCKET = "pricing-attachments";

export function PricingSettings() {
  const { toast } = useToast();
  const { settings, loading, updateSetting } = usePricingSettings();

  const toggleFuel = async (value: boolean) => {
    try {
      await updateSetting("auto_add_fuel_surcharge", value);
      toast({
        title: value ? "Fuel surcharges enabled" : "Fuel surcharges disabled",
        description: value
          ? "Quotes will automatically include the applicable fuel surcharge."
          : "Quotes will no longer add a fuel surcharge automatically.",
      });
    } catch {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fuel className="h-4 w-4 text-primary" /> Fuel surcharges
          </CardTitle>
          <CardDescription>
            Automatically add the applicable fuel surcharge to quotes built in the Price Builder.
            Surcharge rates are managed in the Fuel Surcharges section and are matched by vehicle
            type (Skip, RoRo, Artic) and delivery zone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="auto-fuel" className="text-sm font-medium">
                Auto-add fuel surcharges to rates
              </Label>
              <p className="text-sm text-muted-foreground">
                When on, the Price Builder adds a fuel surcharge line to every priced item it
                can match, and includes it in the quote total.
              </p>
            </div>
            <Switch
              id="auto-fuel"
              checked={settings.auto_add_fuel_surcharge}
              onCheckedChange={toggleFuel}
              disabled={loading}
            />
          </div>

          <Link to="/performance-hub/fuel-surcharges">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" /> Manage fuel surcharge rates
            </Button>
          </Link>
        </CardContent>
      </Card>

      <QuoteAttachmentCard settings={settings} loading={loading} updateSetting={updateSetting} toast={toast} />

      <QuoteTermsCard settings={settings} loading={loading} updateSetting={updateSetting} toast={toast} />
    </div>
  );
}

function QuoteAttachmentCard({
  settings,
  loading,
  updateSetting,
  toast,
}: {
  settings: PricingSettingsType;
  loading: boolean;
  updateSetting: (key: keyof PricingSettingsType, value: any) => Promise<void>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const toggle = async (value: boolean) => {
    try {
      await updateSetting("quote_attachment_enabled", value);
      toast({ title: value ? "Attachment enabled" : "Attachment disabled" });
    } catch {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
    }
  };

  const onPick = () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const path = `attachments/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, {
        upsert: true,
        contentType: "application/pdf",
      });
      if (error) throw error;
      await updateSetting("quote_attachment_path", path);
      await updateSetting("quote_attachment_name", file.name);
      toast({ title: "Attachment updated", description: file.name });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const preview = async () => {
    if (!settings.quote_attachment_path) return;
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(settings.quote_attachment_path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not open file", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4 text-primary" /> Quote email attachment
        </CardTitle>
        <CardDescription>
          This PDF is attached to every rate proposal emailed from the Price Builder. Replace it here
          whenever the permitted-waste list changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5 pr-4">
            <Label className="text-sm font-medium">Attach PDF to quote emails</Label>
            <p className="text-sm text-muted-foreground">
              When on, customers receive the document below with their quote.
            </p>
          </div>
          <Switch checked={settings.quote_attachment_enabled} onCheckedChange={toggle} disabled={loading} />
        </div>

        <div className="flex items-center gap-3 rounded-lg border p-3">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {settings.quote_attachment_name || "No file selected"}
            </p>
            <p className="text-xs text-muted-foreground">Current attachment</p>
          </div>
          {settings.quote_attachment_path && (
            <Button variant="ghost" size="sm" onClick={preview} disabled={loading}>
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
          )}
        </div>

        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={onFile} />
        <Button variant="outline" size="sm" onClick={onPick} disabled={uploading || loading}>
          <Upload className="h-4 w-4 mr-1" /> {uploading ? "Uploading…" : "Replace PDF"}
        </Button>
      </CardContent>
    </Card>
  );
}

function QuoteTermsCard({
  settings,
  loading,
  updateSetting,
  toast,
}: {
  settings: PricingSettingsType;
  loading: boolean;
  updateSetting: (key: keyof PricingSettingsType, value: any) => Promise<void>;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [form, setForm] = useState({
    free_rental_weeks_residential: String(settings.free_rental_weeks_residential),
    free_rental_weeks_trade: String(settings.free_rental_weeks_trade),
    rental_cost_skip: String(settings.rental_cost_skip),
    rental_cost_roro: String(settings.rental_cost_roro),
    bespoke_rules: settings.bespoke_rules,
    terms_url: settings.terms_url,
  });
  const [saving, setSaving] = useState(false);

  // keep local form in sync once settings load
  useEffect(() => {
    setForm({
      free_rental_weeks_residential: String(settings.free_rental_weeks_residential),
      free_rental_weeks_trade: String(settings.free_rental_weeks_trade),
      rental_cost_skip: String(settings.rental_cost_skip),
      rental_cost_roro: String(settings.rental_cost_roro),
      bespoke_rules: settings.bespoke_rules,
      terms_url: settings.terms_url,
    });
  }, [settings]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSetting("free_rental_weeks_residential", Number(form.free_rental_weeks_residential) || 0),
        updateSetting("free_rental_weeks_trade", Number(form.free_rental_weeks_trade) || 0),
        updateSetting("rental_cost_skip", Number(form.rental_cost_skip) || 0),
        updateSetting("rental_cost_roro", Number(form.rental_cost_roro) || 0),
        updateSetting("bespoke_rules", form.bespoke_rules),
        updateSetting("terms_url", form.terms_url),
      ]);
      toast({ title: "Saved", description: "Quote terms updated." });
    } catch {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" /> Quote terms &amp; rentals
        </CardTitle>
        <CardDescription>
          These details are included automatically in the proposal email sent from the Price Builder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <h4 className="text-sm font-medium mb-2">Free rental period (weeks)</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Residential</Label>
              <Input
                type="number"
                min={0}
                value={form.free_rental_weeks_residential}
                onChange={(e) => set("free_rental_weeks_residential", e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Trade</Label>
              <Input
                type="number"
                min={0}
                value={form.free_rental_weeks_trade}
                onChange={(e) => set("free_rental_weeks_trade", e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Rental cost after free period (£ + VAT per week)</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Skip</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.rental_cost_skip}
                onChange={(e) => set("rental_cost_skip", e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">RoRo</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.rental_cost_roro}
                onChange={(e) => set("rental_cost_roro", e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Bespoke rules</Label>
          <Textarea
            value={form.bespoke_rules}
            onChange={(e) => set("bespoke_rules", e.target.value)}
            rows={2}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">Shown as a highlighted waste-acceptance note in the proposal.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Terms &amp; conditions link</Label>
          <Input
            type="url"
            value={form.terms_url}
            onChange={(e) => set("terms_url", e.target.value)}
            placeholder="https://…"
            disabled={loading}
          />
        </div>

        <Button onClick={save} disabled={saving || loading}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save quote terms"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default PricingSettings;
