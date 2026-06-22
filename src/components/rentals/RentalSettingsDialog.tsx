import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { SlidersHorizontal, Save, CalendarClock, PoundSterling, Mail } from "lucide-react";
import { DEFAULT_CHASE_EMAIL_TEMPLATE, type LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

type Props = {
  settings: LiveJobsSettings;
  updateSetting: (key: keyof LiveJobsSettings, value: any) => Promise<void>;
};

const PLACEHOLDERS = ["{customer}", "{site}", "{containerType}", "{days}", "{freeDays}", "{rate}"];

export default function RentalSettingsDialog({ settings, updateSetting }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [freeDays, setFreeDays] = useState(String(settings.rental_free_days));
  const [skipRate, setSkipRate] = useState(String(settings.rental_skip_rate));
  const [roroRate, setRoroRate] = useState(String(settings.rental_roro_rate));
  const [template, setTemplate] = useState(settings.rental_chase_email_template || DEFAULT_CHASE_EMAIL_TEMPLATE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFreeDays(String(settings.rental_free_days));
    setSkipRate(String(settings.rental_skip_rate));
    setRoroRate(String(settings.rental_roro_rate));
    setTemplate(settings.rental_chase_email_template || DEFAULT_CHASE_EMAIL_TEMPLATE);
  }, [settings]);

  const dirty =
    Number(freeDays) !== settings.rental_free_days ||
    Number(skipRate) !== settings.rental_skip_rate ||
    Number(roroRate) !== settings.rental_roro_rate ||
    template !== (settings.rental_chase_email_template || DEFAULT_CHASE_EMAIL_TEMPLATE);

  const saveAll = async () => {
    const days = Number(freeDays);
    const skip = Number(skipRate);
    const roro = Number(roroRate);
    if (!Number.isFinite(days) || days <= 0) {
      toast({ title: "Invalid free rental period", description: "Enter a positive number of days.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(skip) || skip < 0 || !Number.isFinite(roro) || roro < 0) {
      toast({ title: "Invalid rate", description: "Enter valid rental costs.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        days !== settings.rental_free_days ? updateSetting("rental_free_days", days) : null,
        skip !== settings.rental_skip_rate ? updateSetting("rental_skip_rate", skip) : null,
        roro !== settings.rental_roro_rate ? updateSetting("rental_roro_rate", roro) : null,
        template !== settings.rental_chase_email_template ? updateSetting("rental_chase_email_template", template) : null,
      ]);
      toast({ title: "Rental settings saved" });
      setOpen(false);
    } catch (e) {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4 mr-1" /> Rental Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" /> Rental Settings
          </DialogTitle>
          <DialogDescription>
            Configure the free rental period, rental costs, and the chase email customers receive.
          </DialogDescription>
        </DialogHeader>

        {/* Free rental period */}
        <div className="rounded-lg border p-4 space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Free rental period
          </Label>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} value={freeDays} onChange={(e) => setFreeDays(e.target.value)} className="w-28" />
            <span className="text-sm text-muted-foreground">days before a bin counts as over rental</span>
          </div>
        </div>

        {/* Rental costs */}
        <div className="rounded-lg border p-4 space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <PoundSterling className="h-4 w-4" /> Rental costs (per week, excluding VAT)
          </Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Skip hire (£/week)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">£</span>
                <Input type="number" step="0.01" min={0} value={skipRate} onChange={(e) => setSkipRate(e.target.value)} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">+ VAT</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">RoRo (£/week)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">£</span>
                <Input type="number" step="0.01" min={0} value={roroRate} onChange={(e) => setRoroRate(e.target.value)} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">+ VAT</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Chase email template */}
        <div className="rounded-lg border p-4 space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" /> Chase email template
          </Label>
          <p className="text-xs text-muted-foreground">
            Used as the default draft when chasing a customer. Insert any of these placeholders — they are filled in automatically:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map((p) => (
              <Badge key={p} variant="secondary" className="font-mono font-normal">{p}</Badge>
            ))}
          </div>
          <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={12} className="font-mono text-xs" />
          <Button variant="ghost" size="sm" onClick={() => setTemplate(DEFAULT_CHASE_EMAIL_TEMPLATE)}>
            Reset to default
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={saveAll} disabled={!dirty || saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
