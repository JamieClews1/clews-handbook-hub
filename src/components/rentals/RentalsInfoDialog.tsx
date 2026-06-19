import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Settings2, CalendarClock, Boxes, Truck, History, PackageCheck, Save, Sparkles,
} from "lucide-react";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

type Props = {
  settings: LiveJobsSettings;
  binCount: number;
  updateSetting: (key: keyof LiveJobsSettings, value: any) => Promise<void>;
};

function KeywordList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.length === 0 ? (
        <span className="text-xs text-muted-foreground">None configured</span>
      ) : (
        items.map((k) => (
          <Badge key={k} variant="secondary" className="font-normal">{k}</Badge>
        ))
      )}
    </div>
  );
}

function RuleRow({
  icon: Icon, title, children,
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0 rounded-md bg-muted p-2 text-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export default function RentalsInfoDialog({ settings, binCount, updateSetting }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [freeDays, setFreeDays] = useState(String(settings.rental_free_days));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFreeDays(String(settings.rental_free_days));
  }, [settings.rental_free_days]);

  const dirty = Number(freeDays) !== settings.rental_free_days && freeDays.trim() !== "";

  const saveFreeDays = async () => {
    const val = Number(freeDays);
    if (!Number.isFinite(val) || val <= 0) {
      toast({ title: "Invalid value", description: "Enter a positive number of days.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateSetting("rental_free_days", val);
      toast({ title: "Saved", description: `Free rental period set to ${val} days.` });
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
          <Settings2 className="h-4 w-4 mr-1" /> How it works
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Over Rental — Behind the Scenes
          </DialogTitle>
          <DialogDescription>
            How bins are detected and the settings that drive this view. Currently flagging{" "}
            <span className="font-medium text-foreground">{binCount}</span> over-rental bins.
          </DialogDescription>
        </DialogHeader>

        {/* Editable setting */}
        <div className="rounded-lg border p-4 space-y-2">
          <Label htmlFor="freeDays" className="text-sm font-medium">Free rental period</Label>
          <div className="flex items-center gap-2">
            <Input
              id="freeDays"
              type="number"
              min={1}
              value={freeDays}
              onChange={(e) => setFreeDays(e.target.value)}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">days before a bin counts as over rental</span>
            <Button size="sm" onClick={saveFreeDays} disabled={!dirty || saving} className="ml-auto">
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>

        <Separator />

        {/* The logic */}
        <div className="space-y-4">
          <p className="text-sm font-semibold">The logic, step by step</p>

          <RuleRow icon={History} title="12-month rolling history">
            We read the last 12 months of Skiptrak movements and net off deliveries against
            collections per site &amp; container. This is the single source of truth shared with
            the <span className="font-medium text-foreground">Live Jobs / Over Rental</span> view,
            so both screens always match.
          </RuleRow>

          <RuleRow icon={Boxes} title="Net on-site per position">
            A bin is on-site when deliveries, exchanges and tip/returns outnumber collections.
            Movements are tracked per EWC position so a part-cleared site is counted accurately.
          </RuleRow>

          <RuleRow icon={CalendarClock} title="Activity window gate (ghost guard)">
            Positions whose most recent activity predates the rolling window are ignored, so an
            ancient uncollected delivery can't be resurrected by newer activity at the same site.
          </RuleRow>

          <RuleRow icon={Truck} title="Container categorisation">
            <div className="space-y-2">
              <p>Each container is classified by keyword (RoRo first, then Skip, then Artic):</p>
              <div className="space-y-2 pt-1">
                <div>
                  <span className="text-xs font-medium text-foreground">RoRo keywords</span>
                  <KeywordList items={settings.roro_container_keywords} />
                </div>
                <div>
                  <span className="text-xs font-medium text-foreground">Skip keywords</span>
                  <KeywordList items={settings.skip_container_keywords} />
                </div>
                <div>
                  <span className="text-xs font-medium text-foreground">Artic keywords</span>
                  <KeywordList items={settings.artic_container_keywords} />
                </div>
                <div>
                  <span className="text-xs font-medium text-foreground">Artic vehicle regs</span>
                  <KeywordList items={settings.artic_vehicle_regs} />
                </div>
              </div>
            </div>
          </RuleRow>

          <RuleRow icon={PackageCheck} title="Manual collection overrides">
            Bins you mark as collected (with a Skiptrak ticket) are hidden from this list, even if
            the raw movement data hasn't caught up yet — keeping the count clean.
          </RuleRow>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
