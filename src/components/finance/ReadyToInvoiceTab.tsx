import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createInvoiceFromItem, fetchReadyToInvoice, type ReadyItem } from "@/lib/ready-to-invoice";

const money = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const NO_PRICE = "No price on the job";

/** Create an invoice for one job/ticket, asking for a reason only when it has no value. */
export async function createInvoiceInteractive(item: ReadyItem) {
  let zeroReason: string | null = null;
  if (item.net <= 0) {
    zeroReason = window.prompt("This job has no price. Why is it being invoiced at £0?")?.trim() || null;
    if (!zeroReason) throw new Error("Add a price to the job, or give a reason for £0");
  }
  return createInvoiceFromItem(item, { zeroReason });
}

export default function ReadyToInvoiceTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showBlocked, setShowBlocked] = useState(true);
  const { data = [], isLoading, refetch, isFetching } = useQuery({ queryKey: ["ready-to-invoice"], queryFn: () => fetchReadyToInvoice() });

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return data.filter(r => (showBlocked || !r.blockers.some(b => b !== NO_PRICE)) &&
      (!f || [r.reference, r.customerLabel, r.siteLabel, r.tickets.join(" ")].join(" ").toLowerCase().includes(f)));
  }, [data, filter, showBlocked]);
  const ready = data.filter(r => r.blockers.length === 0);

  const create = async (item: ReadyItem) => {
    setBusy(item.key);
    try {
      await createInvoiceInteractive(item);
      toast.success(`Draft invoice created for ${item.reference}`, { description: "Review and send it from the Invoices tab." });
      qc.invalidateQueries({ queryKey: ["ready-to-invoice"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not create the invoice");
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ready to invoice</h2>
          <p className="text-sm text-muted-foreground">Completed RouteOne jobs (with all their weigh tickets) and account weighbridge tickets from the last 60 days. Cash and card tickets are paid on the day and never appear here.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Input className="w-64" placeholder="Search customer, job or ticket" value={filter} onChange={e => setFilter(e.target.value)} />
          <Button variant="outline" onClick={() => setShowBlocked(s => !s)}>{showBlocked ? "Hide items needing attention" : "Show all"}</Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button>
        </div>
      </div>
      <div className="flex gap-3 text-sm">
        <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />{ready.length} ready · {money(ready.reduce((s, r) => s + r.net, 0))} net</Badge>
        <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3.5 w-3.5 text-warning" />{data.length - ready.length} need attention</Badge>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Job / ticket</TableHead><TableHead>Customer</TableHead><TableHead>Weigh tickets</TableHead>
              <TableHead className="text-right">Tonnes</TableHead><TableHead className="text-right">Net</TableHead><TableHead>Status</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nothing waiting to be invoiced.</TableCell></TableRow>}
            {rows.map(r => {
              const hard = r.blockers.filter(b => b !== NO_PRICE);
              return (
                <TableRow key={r.key}>
                  <TableCell className="whitespace-nowrap">{r.date ? new Date(`${r.date}T00:00:00`).toLocaleDateString("en-GB") : "—"}</TableCell>
                  <TableCell className="font-medium">{r.reference}<div className="text-xs text-muted-foreground">{r.kind === "job" ? "RouteOne" : "WeighOne"}</div></TableCell>
                  <TableCell>{r.customerLabel}{r.siteLabel && <div className="text-xs text-muted-foreground">{r.siteLabel}</div>}</TableCell>
                  <TableCell className="text-sm">{r.tickets.join(", ") || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.tonnes ? r.tonnes.toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{money(r.net)}</TableCell>
                  <TableCell className="max-w-xs">
                    {r.blockers.length === 0
                      ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Ready</Badge>
                      : <ul className="text-xs text-destructive space-y-0.5">{r.blockers.map(b => <li key={b}>• {b}</li>)}</ul>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" className="gap-1.5" disabled={hard.length > 0 || busy === r.key} onClick={() => create(r)}>
                      {busy === r.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}Create invoice
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
