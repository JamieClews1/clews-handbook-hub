import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CircleAlert, FileSearch, Plus } from "lucide-react";
import { Link } from "react-router-dom";

interface PoInterpretation {
  po_number: string | null;
  broker: string | null;
  end_customer: string | null;
  site_name: string | null;
  site_address: string | null;
  postcode: string | null;
  container: string | null;
  waste_type: string | null;
  ewc_code: string | null;
  service: "delivery" | "exchange" | "collection" | "wait_and_load" | null;
  requested_date: string | null;
  price_net: number | null;
  extras: string | null;
  notes: string | null;
}

interface PoResult {
  attachment: { id: string; file_name: string };
  po: PoInterpretation;
  zone: string | null;
  expected: { price: number; label: string; card: string; included_tonnes: number | null } | null;
  flags: { level: "red" | "amber"; message: string }[];
}

const SERVICE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  exchange: "Exchange",
  collection: "Collection",
  wait_and_load: "Wait & load",
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value?.trim() ? value : "—"}</span>
    </div>
  );
}

/** Pop-up showing how the portal interpreted a purchase-order PDF, with flags. */
export function CrmPoReaderDialog({
  attachmentId,
  ticketId,
  open,
  onOpenChange,
}: {
  attachmentId: string | null;
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PoResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setResult(null);
    (async () => {
      const { data, error } = await supabase.functions.invoke("crm-read-po", {
        body: attachmentId ? { attachmentId } : { ticketId },
      });
      setLoading(false);
      if (error || data?.error) {
        setError(data?.error ?? error?.message ?? "Could not read that PO");
        return;
      }
      setResult(data as PoResult);
    })();
  }, [open, attachmentId, ticketId]);

  const po = result?.po;
  const createParams = po
    ? new URLSearchParams({
        newjob: "1",
        customer: po.end_customer || po.broker || "",
        site: po.site_name ?? "",
        address: po.site_address ?? "",
        postcode: po.postcode ?? "",
        po: po.po_number ?? "",
        container: po.container ?? "",
        waste: po.waste_type ?? "",
        date: po.requested_date ?? "",
        type: po.service === "exchange" || po.service === "collection" ? po.service : "delivery",
        notes: [
          po.broker ? `Broker: ${po.broker}` : "",
          po.price_net != null ? `PO price: £${po.price_net.toFixed(2)} net` : "",
          po.extras ? `Extras: ${po.extras}` : "",
          po.notes ?? "",
        ]
          .filter(Boolean)
          .join("\n"),
      }).toString()
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" /> Read PO
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm">Reading the purchase order…</p>
          </div>
        )}

        {error && <p className="text-sm text-destructive py-4">{error}</p>}

        {result && po && (
          <div className="space-y-4">
            {result.flags.length > 0 && (
              <div className="space-y-1.5">
                {result.flags.map((f, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                      f.level === "red"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {f.level === "red" ? (
                      <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <span>{f.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {po.broker && <Badge variant="secondary">{po.broker}</Badge>}
              {po.service && <Badge variant="outline">{SERVICE_LABELS[po.service] ?? po.service}</Badge>}
              {result.zone && <Badge variant="outline">{result.zone}</Badge>}
            </div>

            <div className="divide-y divide-border rounded-md border px-3">
              <Row label="PO number" value={po.po_number} />
              <Row label="Customer" value={po.end_customer} />
              <Row label="Site" value={po.site_name} />
              <Row label="Address" value={po.site_address} />
              <Row label="Postcode" value={po.postcode} />
              <Row label="Container" value={po.container} />
              <Row label="Waste" value={po.waste_type} />
              <Row label="EWC" value={po.ewc_code} />
              <Row
                label="Date"
                value={
                  po.requested_date
                    ? new Date(`${po.requested_date}T12:00:00Z`).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })
                    : null
                }
              />
              <Row label="PO price" value={po.price_net != null ? `£${po.price_net.toFixed(2)} net` : null} />
              {result.expected && (
                <Row
                  label="Rate card"
                  value={`£${result.expected.price.toFixed(2)} — ${result.expected.label}${
                    result.expected.included_tonnes ? ` (inc ${result.expected.included_tonnes}t)` : ""
                  }`}
                />
              )}
              {po.extras && <Row label="Extras" value={po.extras} />}
              {po.notes && <Row label="Notes" value={po.notes} />}
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground truncate">{result.attachment.file_name}</p>
              <Button asChild size="sm">
                <Link to={`/route-one?${createParams}`}>
                  <Plus className="h-4 w-4" /> Create job in Route One
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
