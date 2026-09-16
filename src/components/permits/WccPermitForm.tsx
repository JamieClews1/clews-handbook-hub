import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { renderPdfPages } from "@/lib/pdf-preview";
import { buildWccPermitPdf, WCC_SKIP_SIZES, type WccFormValues } from "@/lib/wcc-permit";

export function WccPermitForm({
  values,
  onChange,
}: {
  values: WccFormValues;
  onChange: (v: WccFormValues) => void;
}) {
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof WccFormValues>(key: K, value: WccFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const makeBlob = async () =>
    new Blob([await buildWccPermitPdf(values)], { type: "application/pdf" });

  const preview = async () => {
    setBusy(true);
    try {
      const imgs = await renderPdfPages(await makeBlob(), 900);
      setPages(imgs);
      setPreviewOpen(true);
    } catch (e: any) {
      toast({ title: "Could not build the form", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const url = URL.createObjectURL(await makeBlob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "WCC-skip-licence-application.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Warwickshire application form</p>
          <p className="text-xs text-muted-foreground">
            This completed form is attached to the application email.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={preview} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={download} className="gap-1.5">
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Text label="Company name" value={values.company_name} onChange={(v) => set("company_name", v)} />
        <Text label="Contact name" value={values.contact_name} onChange={(v) => set("contact_name", v)} />
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs">Registered address</Label>
          <Textarea rows={3} value={values.registered_address} onChange={(e) => set("registered_address", e.target.value)} />
        </div>
        <Text label="Email address" value={values.email_address} onChange={(v) => set("email_address", v)} />
        <Text label="Telephone" value={values.telephone} onChange={(v) => set("telephone", v)} />

        <div className="space-y-1.5">
          <Label className="text-xs">Type of application</Label>
          <Select value={values.application_type} onValueChange={(v) => set("application_type", v as "new" | "renewal")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New skip licence</SelectItem>
              <SelectItem value="renewal">Renewal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Text
          label="Previous licence reference"
          value={values.previous_reference}
          onChange={(v) => set("previous_reference", v)}
        />

        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs">Location of skip</Label>
          <Textarea rows={2} value={values.skip_location} onChange={(e) => set("skip_location", e.target.value)} />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs">Address of works</Label>
          <Textarea rows={2} value={values.works_address} onChange={(e) => set("works_address", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Text
            label="Reason skip cannot be placed off the highway"
            value={values.reason_off_highway}
            onChange={(v) => set("reason_off_highway", v)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Skip size</Label>
          <Select value={values.skip_size} onValueChange={(v) => set("skip_size", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {WCC_SKIP_SIZES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div />
        <DateField label="Licence start date" value={values.start_date} onChange={(v) => set("start_date", v)} />
        <DateField label="Licence end date (max 1 month)" value={values.end_date} onChange={(v) => set("end_date", v)} />
        <Text label="Declaration name" value={values.declaration_name} onChange={(v) => set("declaration_name", v)} />
        <DateField label="Declaration date" value={values.declaration_date} onChange={(v) => set("declaration_date", v)} />
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Completed application form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pages.map((src, i) => (
              <img key={i} src={src} alt={`Application form page ${i + 1}`} className="w-full rounded border" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
