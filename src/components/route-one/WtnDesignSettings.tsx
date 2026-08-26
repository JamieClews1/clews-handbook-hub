import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, Eye, FileDown } from "lucide-react";
import {
  buildWtnDoc,
  downloadWtnPdf,
  getWtnDesign,
  setWtnDesign,
  type WtnDesign,
  type WtnJob,
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
  carrier_name: "Clews Recycling Ltd",
  customer_signoff_name: "J. Smith",
  customer_signoff_at: new Date().toISOString(),
  driver_name: "A. Driver",
};

const OPTIONS: { id: WtnDesign; title: string; description: string; points: string[] }[] = [
  {
    id: "classic",
    title: "Design A — Classic carbon copy",
    description: "Matches the existing pre-printed Clews ticket book.",
    points: ["Boxed grid layout", "Two copies per A4 sheet", "Familiar to drivers and customers"],
  },
  {
    id: "modern",
    title: "Design B — Modern branded note",
    description: "Clews logo header, colour-coded panels, same information.",
    points: ["Clews Recycling logo in a green header band", "Key facts strip: O/N, transaction, container, account, reg", "Rounded panels for producer, contact, invoice, waste, signatures"],
  },
];

export function WtnDesignSettings() {
  const { toast } = useToast();
  const [design, setDesign] = useState<WtnDesign>("classic");
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    setDesign(getWtnDesign());
  }, []);

  useEffect(() => {
    let urls: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const opt of OPTIONS) {
        const doc = await buildWtnDoc(SAMPLE, opt.id);
        const url = URL.createObjectURL(doc.output("blob"));
        next[opt.id] = url;
        urls.push(url);
      }
      setPreviews(next);
    })();
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const choose = (id: WtnDesign) => {
    setWtnDesign(id);
    setDesign(id);
    toast({ title: "Ticket design updated", description: `${id === "modern" ? "Design B" : "Design A"} will be used for all waste transfer notes.` });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Waste Transfer Note design</h3>
        <p className="text-xs text-muted-foreground">
          Choose the ticket layout used when printing or downloading a WTN from RouteOne. Both designs carry the
          same legally required information.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
                  <iframe
                    title={`${opt.title} preview`}
                    src={`${previews[opt.id]}#toolbar=0&navpanes=0&view=FitH`}
                    className="w-full h-[320px]"
                  />
                ) : (
                  <div className="h-[320px] flex items-center justify-center text-xs text-muted-foreground">
                    Building preview…
                  </div>
                )}
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                {opt.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={design === opt.id ? "secondary" : "default"}
                  onClick={() => choose(opt.id)}
                  disabled={design === opt.id}
                >
                  <Check className="h-3 w-3 mr-1.5" />
                  {design === opt.id ? "Selected" : "Use this design"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(previews[opt.id], "_blank")}>
                  <Eye className="h-3 w-3 mr-1.5" /> Full size
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadWtnPdf(SAMPLE, opt.id)}>
                  <FileDown className="h-3 w-3 mr-1.5" /> Sample
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
