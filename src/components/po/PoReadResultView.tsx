import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CircleAlert } from "lucide-react";
import type { PoReadResult } from "@/lib/po-job-prefill";

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

/** How the PO reader interpreted a purchase order, with its price/date flags. Read-only. */
export function PoReadResultView({ result }: { result: PoReadResult }) {
  const po = result.po;
  return (
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
              {f.level === "red" ? <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
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
        <Row label="Account" value={result.account ? `${result.account.customer_name}${result.account.customer_code ? ` · ${result.account.customer_code}` : ""}` : "Not matched — choose the customer"} />
        <Row label="Customer" value={po.end_customer} />
        <Row label="Site" value={po.site_name} />
        <Row label="Address" value={po.site_address} />
        <Row label="Postcode" value={po.postcode} />
        <Row label="Site contact" value={[po.site_contact_name, po.site_contact_phone].filter(Boolean).join(" · ")} />
        <Row label="Container" value={po.container} />
        <Row label="Waste" value={po.waste_type} />
        <Row label="EWC" value={po.ewc_code} />
        <Row
          label="Date"
          value={
            po.requested_date
              ? new Date(`${po.requested_date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
              : null
          }
        />
        <Row label="PO price" value={po.price_net != null ? `£${po.price_net.toFixed(2)} net` : null} />
        {result.expected && (
          <Row
            label="Rate card"
            value={`£${result.expected.price.toFixed(2)} — ${result.expected.label}${result.expected.included_tonnes ? ` (inc ${result.expected.included_tonnes}t)` : ""}`}
          />
        )}
        {po.extras && <Row label="Extras" value={po.extras} />}
        {po.order_notes && <Row label="Order notes" value={po.order_notes} />}
        {po.time_preference && <Row label="Time" value={po.time_preference} />}
        {po.notes && <Row label="Other notes" value={po.notes} />}
      </div>
    </div>
  );
}
