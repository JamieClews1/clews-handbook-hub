import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Loader2, Plus, Search } from "lucide-react";
import {
  daysOverdue,
  fmtDate,
  money,
  STATUS_LABEL,
  statusBadgeClass,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/finance";
import InvoiceCreateDialog from "./InvoiceCreateDialog";
import InvoiceDetailDialog from "./InvoiceDetailDialog";
import { downloadCsv, fetchInvoiceWithLines, sage50CsvForInvoices } from "@/lib/invoice-service";

export function InvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: inv }, { data: cust }] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("customers").select("id, customer_name"),
    ]);
    setInvoices((inv ?? []) as unknown as Invoice[]);
    setNames(Object.fromEntries((cust ?? []).map((c: any) => [c.id, c.customer_name])));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (!q) return true;
      return (
        i.invoice_number.toLowerCase().includes(q) ||
        (names[i.customer_id] ?? "").toLowerCase().includes(q) ||
        (i.job_number ?? "").toLowerCase().includes(q) ||
        (i.purchase_order ?? "").toLowerCase().includes(q)
      );
    });
  }, [invoices, search, status, names]);

  const exportSage = async () => {
    const rows = [];
    for (const inv of filtered) {
      const { lines } = await fetchInvoiceWithLines(inv.id);
      const { data: fin } = await supabase
        .from("customer_finance_details")
        .select("accounting_customer_ref")
        .eq("customer_id", inv.customer_id)
        .maybeSingle();
      rows.push({
        invoice: inv,
        lines,
        sageRef: (fin as any)?.accounting_customer_ref ?? null,
        customerName: names[inv.customer_id] ?? "",
      });
    }
    downloadCsv(`sage50-invoices-${new Date().toISOString().slice(0, 10)}.csv`, sage50CsvForInvoices(rows));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">Invoices</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-56 pl-8"
                placeholder="Invoice, customer, job, PO…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(STATUS_LABEL) as InvoiceStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportSage} disabled={!filtered.length}>
              <Download className="mr-2 h-4 w-4" /> Sage 50 CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading invoices…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
              <FileText className="h-6 w-6" />
              <p className="text-sm">No invoices yet — raise one from a completed job.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => {
                  const od = daysOverdue(i);
                  return (
                    <TableRow
                      key={i.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(i.id)}
                    >
                      <TableCell className="font-medium">{i.invoice_number}</TableCell>
                      <TableCell>{names[i.customer_id] ?? "—"}</TableCell>
                      <TableCell>{i.job_number ?? "—"}</TableCell>
                      <TableCell>{fmtDate(i.issue_date)}</TableCell>
                      <TableCell>
                        {fmtDate(i.due_date)}
                        {od > 0 && (
                          <span className="ml-2 text-xs text-destructive">{od}d overdue</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{money(i.gross_total, i.currency)}</TableCell>
                      <TableCell className="text-right">
                        {money(Number(i.gross_total) - Number(i.amount_paid), i.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass(i.status)}>
                          {STATUS_LABEL[i.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">
                        {i.accounting_sync_status.replace("_", " ")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InvoiceCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          load();
          setSelected(id);
        }}
      />
      <InvoiceDetailDialog
        invoiceId={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        onChanged={load}
      />
    </div>
  );
}

export default InvoicesTab;
