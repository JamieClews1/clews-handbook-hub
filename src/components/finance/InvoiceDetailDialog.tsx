import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Mail, Plus, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  fmtDate,
  money,
  STATUS_LABEL,
  statusBadgeClass,
  type Invoice,
  type InvoiceLine,
  type InvoiceStatus,
} from "@/lib/finance";
import {
  buildInvoiceEmail,
  downloadCsv,
  downloadInvoicePdf,
  fetchInvoiceWithLines,
  generateAndStoreInvoicePdf,
  logSyncAttempt,
  sage50CsvForInvoices,
  sendInvoiceEmail,
} from "@/lib/invoice-service";

interface Props {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

export function InvoiceDetailDialog({ invoiceId, open, onOpenChange, onChanged }: Props) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [customer, setCustomer] = useState<{ customer_name: string } | null>(null);
  const [finance, setFinance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // email composer
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // payment entry
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState("");

  const load = async () => {
    if (!invoiceId) return;
    setLoading(true);
    const { invoice: inv, lines: ls } = await fetchInvoiceWithLines(invoiceId);
    setInvoice(inv);
    setLines(ls);
    if (inv) {
      const [{ data: cust }, { data: fin }, { data: pays }] = await Promise.all([
        supabase.from("customers").select("customer_name").eq("id", inv.customer_id).maybeSingle(),
        supabase.from("customer_finance_details").select("*").eq("customer_id", inv.customer_id).maybeSingle(),
        supabase
          .from("invoice_payments")
          .select("*")
          .eq("invoice_id", inv.id)
          .order("payment_date", { ascending: false }),
      ]);
      setCustomer(cust as any);
      setFinance(fin);
      setPayments(pays ?? []);
      const email = await buildInvoiceEmail(
        inv,
        (cust as any)?.customer_name ?? "",
        (fin as any)?.finance_contact_name,
      );
      setEmailTo((fin as any)?.finance_contact_email ?? "");
      setEmailSubject(email.subject);
      setEmailBody(email.body);
      setPayAmount(String(Math.max(0, Number(inv.gross_total) - Number(inv.amount_paid)).toFixed(2)));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [invoiceId, open]);

  if (!open) return null;

  const customerName = customer?.customer_name ?? "";

  const doSend = async () => {
    if (!invoice) return;
    if (!emailTo.trim()) return toast.error("A finance contact email is required");
    setBusy("send");
    try {
      const { path } = await generateAndStoreInvoicePdf(invoice, lines, customerName);
      await sendInvoiceEmail({
        invoiceId: invoice.id,
        to: emailTo.trim(),
        subject: emailSubject,
        body: emailBody,
        pdfPath: path,
        fileName: `${invoice.invoice_number}.pdf`,
      });
      toast.success(`Invoice emailed to ${emailTo}`);
      await load();
      onChanged();
    } catch (e: any) {
      toast.error("Could not send invoice", { description: e.message });
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (status: InvoiceStatus) => {
    if (!invoice) return;
    setBusy("status");
    const { error } = await supabase
      .from("invoices")
      .update({ status, status_override: true } as any)
      .eq("id", invoice.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${STATUS_LABEL[status]}`);
    await load();
    onChanged();
  };

  const addPayment = async () => {
    if (!invoice) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return toast.error("Enter a payment amount");
    setBusy("pay");
    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: invoice.id,
      amount,
      payment_date: payDate,
      reference: payRef || null,
      source: "manual",
    } as any);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    setPayRef("");
    await load();
    onChanged();
  };

  const pushToSage = async () => {
    if (!invoice) return;
    setBusy("sage");
    try {
      const csv = sage50CsvForInvoices([
        { invoice, lines, sageRef: finance?.accounting_customer_ref ?? null, customerName },
      ]);
      downloadCsv(`sage50-${invoice.invoice_number}.csv`, csv);
      await supabase
        .from("invoices")
        .update({
          accounting_sync_status: "pending",
          accounting_synced_at: new Date().toISOString(),
        } as any)
        .eq("id", invoice.id);
      await logSyncAttempt({
        invoiceId: invoice.id,
        provider: invoice.accounting_provider,
        direction: "push",
        status: "pending",
        message: `Sage 50 import file generated for ${invoice.invoice_number}. Awaiting import confirmation.`,
        payload: { customer_ref: finance?.accounting_customer_ref, lines: lines.length },
      });
      toast.success("Sage 50 import file downloaded");
      await load();
      onChanged();
    } catch (e: any) {
      toast.error("Sage export failed", { description: e.message });
      await logSyncAttempt({
        invoiceId: invoice.id,
        provider: invoice.accounting_provider,
        direction: "push",
        status: "error",
        message: e.message,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {loading || !invoice ? (
          <div className="flex items-center gap-2 p-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading invoice…
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {invoice.invoice_number}
                <Badge variant="outline" className={statusBadgeClass(invoice.status)}>
                  {STATUS_LABEL[invoice.status]}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {customerName} · Issued {fmtDate(invoice.issue_date)} · Due {fmtDate(invoice.due_date)}
                {invoice.job_number ? ` · Job ${invoice.job_number}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadInvoicePdf(invoice, customerName)}
              >
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={pushToSage} disabled={busy === "sage"}>
                {busy === "sage" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Push to Sage 50
              </Button>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Override status</Label>
                <Select value={invoice.status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as InvoiceStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.description}</TableCell>
                      <TableCell className="text-right">
                        {l.quantity}
                        {l.unit ? ` ${l.unit}` : ""}
                      </TableCell>
                      <TableCell className="text-right">{money(l.unit_price, invoice.currency)}</TableCell>
                      <TableCell className="text-right">{Number(l.vat_rate)}%</TableCell>
                      <TableCell className="text-right">{money(l.net_amount, invoice.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="ml-auto w-72 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net</span>
                <span>{money(invoice.net_total, invoice.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT</span>
                <span>{money(invoice.vat_total, invoice.currency)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{money(invoice.gross_total, invoice.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span>{money(invoice.amount_paid, invoice.currency)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <span>Balance</span>
                <span>
                  {money(Number(invoice.gross_total) - Number(invoice.amount_paid), invoice.currency)}
                </span>
              </div>
            </div>

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">
                  {invoice.sent_at ? "Re-send invoice" : "Send invoice"}
                </h4>
                {invoice.sent_at && (
                  <p className="text-xs text-muted-foreground">
                    Last sent {new Date(invoice.sent_at).toLocaleString("en-GB")} to {invoice.sent_to} (
                    {invoice.send_count}×)
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Message</Label>
                  <Textarea rows={7} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
                </div>
                <Button onClick={doSend} disabled={busy === "send"}>
                  {busy === "send" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  {invoice.sent_at ? "Re-send with PDF" : "Send with PDF"}
                </Button>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Payments</h4>
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                            No payments recorded
                          </TableCell>
                        </TableRow>
                      )}
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{fmtDate(p.payment_date)}</TableCell>
                          <TableCell>{p.reference || "—"}</TableCell>
                          <TableCell className="capitalize">{p.source}</TableCell>
                          <TableCell className="text-right">{money(p.amount, invoice.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Amount"
                  />
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Ref" />
                </div>
                <Button variant="outline" onClick={addPayment} disabled={busy === "pay"}>
                  {busy === "pay" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Record payment
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default InvoiceDetailDialog;
