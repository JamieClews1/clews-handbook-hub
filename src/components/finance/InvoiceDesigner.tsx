import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ImageUp, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { invoicePdfBlob, type CompanyBranding } from "@/lib/invoice-pdf";
import {
  DEFAULT_INVOICE_TEMPLATE,
  HEADER_STYLES,
  PDF_FONTS,
  TABLE_STYLES,
} from "@/lib/invoice-template";
import type { Invoice, InvoiceLine } from "@/lib/finance";

const SAMPLE_INVOICE = {
  id: "sample",
  invoice_number: "INV-00042",
  customer_id: "sample",
  site_id: null,
  job_number: null,
  job_source: null,
  load_report_id: null,
  status: "unpaid",
  issue_date: "2026-07-31",
  due_date: "2026-08-30",
  currency: "GBP",
  purchase_order: "PO-88213",
  net_total: 1593.75,
  vat_total: 318.75,
  gross_total: 1912.5,
  amount_paid: 0,
  notes: "Work completed 31 July 2026",
  bill_to: {
    finance_contact_name: "Accounts Payable",
    billing_address_line1: "Unit 4, Example Business Park",
    billing_city: "Coventry",
    billing_postcode: "CV1 2AB",
    vat_number: "GB123456789",
  },
} as unknown as Invoice;

const SAMPLE_LINES = [
  { description: "Job 49041 — WasteTruck Curtain side Trailer — Cardboard & Paper Packaging", quantity: 1, unit: "load", unit_price: 220.57, net_amount: 220.57, vat_rate: 20, vat_amount: 44.11 },
  { description: "Job 49046 — Exchange 40 yd Ro Ro — Plastic Packaging", quantity: 1, unit: "load", unit_price: 135.95, net_amount: 135.95, vat_rate: 20, vat_amount: 27.19 },
  { description: "Job 49056 — Exchange 40 yd Ro Ro — Mixed Municipal Waste", quantity: 1, unit: "load", unit_price: 475.95, net_amount: 475.95, vat_rate: 20, vat_amount: 95.19 },
  { description: "Job 49384 — Exchange 40 yd Ro Ro — Cardboard & Paper Packaging", quantity: 1, unit: "load", unit_price: 761.28, net_amount: 761.28, vat_rate: 20, vat_amount: 152.26 },
] as unknown as InvoiceLine[];

interface Props {
  settings: any;
  set: (key: string, value: any) => void;
  company: CompanyBranding;
}

export function InvoiceDesigner({ settings, set, company }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const templateKey = useMemo(
    () =>
      JSON.stringify(
        Object.keys(DEFAULT_INVOICE_TEMPLATE).reduce((acc: any, k) => {
          acc[k] = settings?.[k];
          return acc;
        }, {}),
      ),
    [settings],
  );

  useEffect(() => {
    let url = "";
    try {
      const blob = invoicePdfBlob(SAMPLE_INVOICE, SAMPLE_LINES, company, "Biffa Waste", settings);
      url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (e: any) {
      toast.error("Preview failed", { description: e?.message });
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey, company]);

  const onLogo = async (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
      return toast.error("Use a PNG or JPG logo");
    }
    if (file.size > 1_500_000) return toast.error("Logo must be under 1.5 MB");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    set("invoice_logo_url", dataUrl);
    toast.success("Logo added — remember to save");
  };

  const resetDesign = () => {
    Object.entries(DEFAULT_INVOICE_TEMPLATE).forEach(([k, v]) => set(k, v));
    toast.success("Design reset to defaults — remember to save");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Invoice designer</CardTitle>
          <CardDescription>
            Redesign the invoice PDF — logo, colours, layout and footer. The preview updates live.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={resetDesign}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset design
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          {/* Logo */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Company logo</Label>
              <Switch
                checked={settings.invoice_show_logo !== false}
                onCheckedChange={(v) => set("invoice_show_logo", v)}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-muted/30">
                {settings.invoice_logo_url ? (
                  <img
                    src={settings.invoice_logo_url}
                    alt="Invoice logo preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => onLogo(e.target.files?.[0])}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImageUp className="mr-2 h-4 w-4" /> Upload logo
                </Button>
                {settings.invoice_logo_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => set("invoice_logo_url", null)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG or JPG, under 1.5 MB.</p>
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">
                Logo width — {Number(settings.invoice_logo_width_mm ?? 40)} mm
              </Label>
              <Slider
                min={15}
                max={80}
                step={1}
                value={[Number(settings.invoice_logo_width_mm ?? 40)]}
                onValueChange={([v]) => set("invoice_logo_width_mm", v)}
              />
            </div>
          </div>

          {/* Layout */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Header style</Label>
              <Select
                value={settings.invoice_header_style ?? "classic"}
                onValueChange={(v) => set("invoice_header_style", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HEADER_STYLES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Table style</Label>
              <Select
                value={settings.invoice_table_style ?? "striped"}
                onValueChange={(v) => set("invoice_table_style", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TABLE_STYLES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Font</Label>
              <Select value={settings.invoice_font ?? "helvetica"} onValueChange={(v) => set("invoice_font", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PDF_FONTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Accent colour</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  className="h-10 w-14 p-1"
                  value={settings.invoice_accent_color ?? "#16a34a"}
                  onChange={(e) => set("invoice_accent_color", e.target.value)}
                />
                <Input
                  value={settings.invoice_accent_color ?? "#16a34a"}
                  onChange={(e) => set("invoice_accent_color", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Document title</Label>
              <Input
                value={settings.invoice_document_title ?? "INVOICE"}
                onChange={(e) => set("invoice_document_title", e.target.value)}
              />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-2">
            {[
              ["invoice_show_company_address", "Show company address block"],
              ["invoice_show_bank_details", "Show bank / payment details"],
              ["invoice_show_vat_breakdown", "Show VAT breakdown by rate"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label className="text-sm font-normal">{label}</Label>
                <Switch
                  checked={settings[key] !== false}
                  onCheckedChange={(v) => set(key, v)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Terms text (printed above the footer)</Label>
            <Textarea
              rows={3}
              placeholder="Payment due within 30 days. Late payment interest may be charged…"
              value={settings.invoice_terms_text ?? ""}
              onChange={(e) => set("invoice_terms_text", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Footer line</Label>
            <Input
              value={settings.invoice_footer_text ?? DEFAULT_INVOICE_TEMPLATE.invoice_footer_text}
              onChange={(e) => set("invoice_footer_text", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Tokens: {"{{invoice_number}} {{customer_name}} {{company_name}} {{due_date}} {{total}}"}
            </p>
          </div>
        </div>

        {/* Live preview */}
        <div className="space-y-2">
          <Label>Live preview</Label>
          <div className="h-[720px] overflow-hidden rounded-md border border-border bg-muted/20">
            {previewUrl ? (
              <iframe title="Invoice preview" src={previewUrl} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Building preview…
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Sample data — your saved design applies to every invoice PDF and emailed attachment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default InvoiceDesigner;
