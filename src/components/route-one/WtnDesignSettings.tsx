import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { renderPdfFirstPage } from "@/lib/pdf-preview";
import { Check, Eye, FileDown, RotateCcw, Save } from "lucide-react";
import {
  DEFAULT_WTN_OPTIONS,
  buildWtnDoc,
  downloadWtnPdf,
  getWtnDesign,
  getWtnOptions,
  resetWtnOptions,
  setWtnDesign,
  setWtnOptions,
  type WtnDesign,
  type WtnJob,
  type WtnOptions,
} from "@/lib/route-one-wtn";

/** Sample job used for the design previews. */
const SAMPLE: WtnJob = {
  job_number: "50385",
  scheduled_date: new Date().toISOString(),
  customer_name: "Britvic Soft Drinks Ltd",
  site_name: "Britvic Rugby",
  site_address: "Unit 4, Central Park",
  site_address_2: "Hunters Lane",
  site_area: "Warwickshire",
  site_postcode: "CV21 1EA",
  sic_code: "11.07",
  site_contact_name: "Site Manager",
  site_contact_phone: "01788 541 549",
  account_code: "BRIT001",
  po_number: "PO-99213",
  job_type: "exchange",
  container_type: "RoRo",
  container_size: "40 CU YD",
  waste_type: "Mixed dry recyclables",
  ewc_code: "20 03 01",
  notes: "Please call 30 minutes before arrival.",
  directions: "Enter via goods gate on Hunters Lane, report to security.",
  disposal_site: "Clews Recycling Ltd\nUnit 17 Hunters Lane\nRugby CV21 1EA",
  invoice_address: "Accounts Payable\nBritvic Soft Drinks Ltd\nBreakspear Park\nHemel Hempstead HP2 4TZ",
  vehicle_reg: "CR21 CLW",
  vehicle_type: "RoRo hook",
  carrier_name: "Clews Recycling Ltd",
  waste_code: "W220000",
  quantity: 1,
  service_code: "R40EXW",
  nett_price: 245,
  vat_amount: 49,
  total_price: 294,
  customer_signoff_name: "J. Smith",
  customer_signoff_at: new Date().toISOString(),
  driver_name: "A. Driver",
  disposer_name: "Yard Operative",
};


const OPTIONS: { id: WtnDesign; title: string; description: string; points: string[] }[] = [
  {
    id: "classic",
    title: "Design A — Classic carbon copy",
    description: "Matches the existing pre-printed Clews ticket book.",
    points: ["Boxed grid layout", "Clews logo centred in the header", "Familiar to drivers and customers"],
  },
  {
    id: "modern",
    title: "Design B — Modern branded note",
    description: "Coloured header band with the Clews logo and panelled sections.",
    points: ["Logo in a coloured header band", "Key facts strip: O/N, transaction, container, account, reg", "Rounded panels for producer, contact, invoice, waste, signatures"],
  },
  {
    id: "field",
    title: "Design C — Field ticket (recommended)",
    description: "Our suggested layout: big, high-contrast type built for yard and roadside signing.",
    points: [
      "Large ticket number badge and logo top-left",
      "Six headline facts in one tinted strip",
      "Full-width signature strip — easy to sign on paper or phone",
    ],
  },
];

const PALETTE = ["#166534", "#0f766e", "#1d4ed8", "#7c2d12", "#111827", "#b91c1c"];

export function WtnDesignSettings() {
  const { toast } = useToast();
  const [design, setDesign] = useState<WtnDesign>("classic");
  const [opts, setOpts] = useState<WtnOptions>(DEFAULT_WTN_OPTIONS);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewFiles, setPreviewFiles] = useState<Record<string, string>>({});
  const [livePreview, setLivePreview] = useState<string>("");
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    setDesign(getWtnDesign());
    setOpts(getWtnOptions());
  }, []);

  const set = useCallback(<K extends keyof WtnOptions>(key: K, value: WtnOptions[K]) => {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* Design cards previews (rebuilt whenever the builder settings change). */
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      const files: Record<string, string> = {};
      for (const opt of OPTIONS) {
        const doc = await buildWtnDoc(SAMPLE, opt.id, opts);
        const blob = doc.output("blob") as Blob;
        const url = URL.createObjectURL(blob);
        files[opt.id] = url;
        created.push(url);
        try {
          next[opt.id] = await renderPdfFirstPage(blob, 700);
        } catch {
          next[opt.id] = "";
        }
      }
      if (cancelled) {
        created.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      setPreviews(next);
      setPreviewFiles(files);
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [opts]);

  /* Big live preview of the selected design. */
  useEffect(() => {
    let cancelled = false;
    let url = "";
    const t = setTimeout(async () => {
      const doc = await buildWtnDoc(SAMPLE, design, opts);
      const blob = doc.output("blob") as Blob;
      let png = "";
      try {
        png = await renderPdfFirstPage(blob, 1000);
      } catch {
        png = "";
      }
      if (cancelled) return;
      setLivePreview(png);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (url) URL.revokeObjectURL(url);
    };
  }, [design, opts]);

  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const choose = (id: WtnDesign) => {
    setWtnDesign(id);
    setDesign(id);
    toast({ title: "Ticket design updated", description: `${OPTIONS.find((o) => o.id === id)?.title} will be used for every waste transfer note.` });
  };

  const save = () => {
    setWtnOptions(opts);
    toast({ title: "Ticket builder saved", description: "Your changes now apply to every printed and downloaded ticket." });
  };

  const reset = () => {
    resetWtnOptions();
    setOpts(DEFAULT_WTN_OPTIONS);
    toast({ title: "Ticket reset", description: "The ticket is back to the standard Clews layout." });
  };

  const toggles: { key: keyof WtnOptions; label: string; hint: string }[] = useMemo(
    () => [
      { key: "showLogo", label: "Clews Recycling branding", hint: "Shows the logo (or company name) at the top of the ticket." },
      { key: "twoCopies", label: "Two copies per page", hint: "Customer copy on top, office copy underneath." },
      { key: "showSiteContact", label: "Site contact box", hint: "Name, phone and SIC code for the collection site." },
      { key: "showInvoiceAddress", label: "Invoice address box", hint: "Where the invoice should be sent." },
      { key: "showComments", label: "Comments", hint: "Free-text notes added to the job." },
      { key: "showDirections", label: "Directions", hint: "Access notes for the driver." },
      { key: "showDisposalSite", label: "Disposal site", hint: "Where the waste is taken." },
      { key: "showSignatures", label: "Signature boxes", hint: "Customer, driver and disposal site signatures, including phone signatures." },
      { key: "showDisposerSignature", label: "Disposal site signature", hint: "Third signature box signed by the yard/disposal site operative." },
      { key: "showProducerCert", label: "Producer's certificate", hint: "Waste hierarchy / Regulation 12 & 13 wording above the signatures." },
      { key: "showWasteCodes", label: "Waste code, quantity & service", hint: "Waste code, SIC code, quantity and service code (as on Suez tickets)." },
      { key: "showPricing", label: "Nett / VAT / Total prices", hint: "Adds a price row at the bottom of the ticket." },

      { key: "showHireNote", label: "Hire period wording", hint: "Skip and RoRo hire period sentence." },
      { key: "showBrokerNote", label: "Broker wording", hint: "Note for skips booked via a third-party broker." },
      { key: "showFooter", label: "Footer / licence line", hint: "Carrier licence, company and VAT numbers." },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">Ticket builder</h3>
        <p className="text-xs text-muted-foreground">
          Design your waste transfer note without any coding. Pick a layout, switch sections on or off, change the
          wording and colour, then save — every printed or downloaded ticket updates instantly.
        </p>
      </div>

      {/* ── Step 1: pick a layout ── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Step 1 — Pick a layout</p>
        <div className="grid gap-4 md:grid-cols-3">
          {OPTIONS.map((opt) => (
            <Card key={opt.id} className={design === opt.id ? "border-primary ring-1 ring-primary" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{opt.title}</CardTitle>
                    <CardDescription className="text-xs">{opt.description}</CardDescription>
                  </div>
                  {design === opt.id && (
                    <Badge className="gap-1">
                      <Check className="h-3 w-3" /> In use
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border overflow-hidden bg-muted/30">
                  {previews[opt.id] ? (
                    <img
                      alt={`${opt.title} waste transfer note preview`}
                      src={previews[opt.id]}
                      className="w-full h-[280px] object-contain object-top bg-white"
                    />
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                      Building preview…
                    </div>
                  )}
                </div>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  {opt.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={design === opt.id ? "secondary" : "default"}
                    onClick={() => choose(opt.id)}
                    disabled={design === opt.id}
                  >
                    <Check className="h-3 w-3 mr-1.5" />
                    {design === opt.id ? "Selected" : "Use this design"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(previewFiles[opt.id], "_blank")}>
                    <Eye className="h-3 w-3 mr-1.5" /> Full size
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadWtnPdf(SAMPLE, opt.id, opts)}>
                    <FileDown className="h-3 w-3 mr-1.5" /> Sample
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Step 2: customise ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Step 2 — Customise your ticket</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="h-3 w-3 mr-1.5" /> Reset to standard
            </Button>
            <Button size="sm" onClick={save}>
              <Save className="h-3 w-3 mr-1.5" /> Save ticket design
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="pt-4">
              <Accordion type="multiple" defaultValue={["headings", "sections"]} className="w-full">
                <AccordionItem value="headings">
                  <AccordionTrigger className="text-sm">Headings &amp; branding</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Main title</Label>
                      <Input value={opts.title} onChange={(e) => set("title", e.target.value)} />
                      <p className="text-[11px] text-muted-foreground">Big heading at the top of the ticket.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sub-heading</Label>
                      <Input value={opts.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Top copy label</Label>
                        <Input value={opts.customerCopyLabel} onChange={(e) => set("customerCopyLabel", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bottom copy label</Label>
                        <Input value={opts.officeCopyLabel} onChange={(e) => set("officeCopyLabel", e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Ticket colour</Label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Use colour ${c}`}
                            onClick={() => set("accent", c)}
                            className={`h-7 w-7 rounded-full border-2 ${opts.accent.toLowerCase() === c ? "border-foreground" : "border-transparent"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <Input
                          type="color"
                          value={opts.accent}
                          onChange={(e) => set("accent", e.target.value)}
                          className="h-8 w-14 p-1"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">Used for header bands and headings on Designs B and C.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Header shows</Label>
                      <div className="flex gap-2">
                        {([
                          { v: "logo", l: "Logo" },
                          { v: "name", l: "Company name" },
                        ] as const).map((o) => (
                          <Button
                            key={o.v}
                            type="button"
                            size="sm"
                            variant={(opts.brandStyle ?? "logo") === o.v ? "default" : "outline"}
                            onClick={() => set("brandStyle", o.v)}
                          >
                            {o.l}
                          </Button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Choose the Clews Recycling logo image or plain company name text in the ticket header.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Logo size ({opts.logoSize} mm wide)</Label>
                      <Slider
                        value={[opts.logoSize]}
                        min={18}
                        max={50}
                        step={1}
                        onValueChange={([v]) => set("logoSize", v)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sections">
                  <AccordionTrigger className="text-sm">Show or hide sections</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {toggles.map((t) => (
                      <div key={String(t.key)} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium">{t.label}</p>
                          <p className="text-[11px] text-muted-foreground">{t.hint}</p>
                        </div>
                        <Switch
                          checked={Boolean(opts[t.key])}
                          onCheckedChange={(v) => set(t.key, v as WtnOptions[typeof t.key])}
                        />
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="wording">
                  <AccordionTrigger className="text-sm">Wording &amp; small print</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Producer's certificate wording</Label>
                      <Textarea rows={4} value={opts.producerCert} onChange={(e) => set("producerCert", e.target.value)} />
                      <p className="text-[11px] text-muted-foreground">Shown just above the three signature boxes.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Terms / duty of care wording</Label>
                      <Textarea rows={5} value={opts.terms} onChange={(e) => set("terms", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Hire period wording</Label>
                      <Textarea rows={2} value={opts.hireNote} onChange={(e) => set("hireNote", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Broker wording</Label>
                      <Textarea rows={2} value={opts.brokerNote} onChange={(e) => set("brokerNote", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Footer line</Label>
                      <Textarea rows={2} value={opts.footerText} onChange={(e) => set("footerText", e.target.value)} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Live preview</CardTitle>
              <CardDescription className="text-xs">
                Sample ticket using your current settings. Press “Save ticket design” to make it live.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden bg-muted/30">
                {livePreview ? (
                  <img
                    alt="Live waste transfer note preview"
                    src={livePreview}
                    className="w-full h-[620px] object-contain object-top bg-white"
                  />
                ) : (
                  <div className="h-[620px] flex items-center justify-center text-xs text-muted-foreground">
                    Building preview…
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
