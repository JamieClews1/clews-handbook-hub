import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  computeLine,
  missingFinanceFields,
  money,
  totalsForLines,
  type InvoiceLine,
} from "@/lib/finance";
import { fetchFinanceSettings } from "@/lib/invoice-service";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (invoiceId: string) => void;
  /** Optionally pre-fill from a job. */
  presetJobNumber?: string;
}

interface JobRow {
  job_number: string;
  source: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  waste_description: string | null;
  weight_t: number | null;
  container_type: string | null;
  order_number_override: string | null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) =>
  new Date(new Date(`${iso}T00:00:00`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/** Raise an invoice — optionally generated from a completed job. */
export function InvoiceCreateDialog({ open, onOpenChange, onCreated, presetJobNumber }: Props) {
  const [customers, setCustomers] = useState<{ id: string; customer_name: string }[]>([]);
  const [sites, setSites] = useState<{ id: string; site_name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState<string>("");
  const [finance, setFinance] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [jobSearch, setJobSearch] = useState(presetJobNumber ?? "");
  const [jobResults, setJobResults] = useState<JobRow[]>([]);
  const [job, setJob] = useState<JobRow | null>(null);
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 30));
  const [po, setPo] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([
    computeLine({ description: "", quantity: 1, unit_price: 0, vat_rate: 20, sort_order: 0 }),
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: cust }, s] = await Promise.all([
        supabase.from("customers").select("id, customer_name").eq("is_active", true).order("customer_name"),
        fetchFinanceSettings(),
      ]);
      setCustomers((cust ?? []) as any);
      setSettings(s);
      if (s?.default_payment_terms_days) setDueDate(addDays(todayISO(), s.default_payment_terms_days));
    })();
  }, [open]);

  useEffect(() => {
    if (!customerId) {
      setSites([]);
      setFinance(null);
      return;
    }
    (async () => {
      const [{ data: st }, { data: fin }] = await Promise.all([
        supabase.from("customer_sites").select("id, site_name").eq("customer_id", customerId).order("site_name"),
        supabase.from("customer_finance_details").select("*").eq("customer_id", customerId).maybeSingle(),
      ]);
      setSites((st ?? []) as any);
      setFinance(fin);
      const terms = (fin as any)?.payment_terms_days ?? settings.default_payment_terms_days ?? 30;
      setDueDate(addDays(issueDate, terms));
    })();
  }, [customerId]);

  // Job lookup
  useEffect(() => {
    const q = jobSearch.trim();
    if (q.length < 3) {
      setJobResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("data_hub_jobs")
        .select(
          "job_number, source, job_date, customer, site, waste_description, weight_t, container_type, order_number_override",
        )
        .ilike("job_number", `%${q}%`)
        .order("job_date", { ascending: false })
        .limit(15);
      setJobResults((data ?? []) as any);
    }, 300);
    return () => clearTimeout(t);
  }, [jobSearch]);

  const applyJob = (j: JobRow) => {
    setJob(j);
    setJobResults([]);
    setJobSearch(j.job_number);
    if (j.order_number_override) setPo(j.order_number_override);
    if (j.job_date) {
      setIssueDate(j.job_date);
      const terms = finance?.payment_terms_days ?? settings.default_payment_terms_days ?? 30;
      setDueDate(addDays(j.job_date, terms));
    }
    const vat = Number(settings.default_vat_rate ?? 20);
    const desc = [j.container_type, j.waste_description].filter(Boolean).join(" – ");
    setLines([
      computeLine({
        description: `${desc || "Waste collection"} (Job ${j.job_number}${j.site ? `, ${j.site}` : ""})`,
        quantity: Number(j.weight_t ?? 1) || 1,
        unit: j.weight_t ? "t" : null,
        unit_price: 0,
        vat_rate: vat,
        sort_order: 0,
      }),
    ]);
    // Try to match the customer by name.
    const match = customers.find(
      (c) => j.customer && c.customer_name.toLowerCase() === j.customer.toLowerCase(),
    );
    if (match) setCustomerId(match.id);
  };

  const totals = useMemo(() => totalsForLines(lines), [lines]);
  const missing = missingFinanceFields(finance);
  const customerName = customers.find((c) => c.id === customerId)?.customer_name ?? "";

  const updateLine = (i: number, patch: Partial<InvoiceLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? computeLine({ ...l, ...patch }) : l)));

  const create = async () => {
    if (!customerId) return toast.error("Select a customer");
    if (missing.length) return toast.error("Finance details incomplete", { description: missing.join(", ") });
    if (finance?.po_required && !po.trim())
      return toast.error("This customer requires a purchase order number");
    if (!lines.some((l) => l.description.trim())) return toast.error("Add at least one line item");

    setSaving(true);
    try {
      const { data: numData, error: numErr } = await supabase.rpc("next_invoice_number" as any);
      if (numErr) throw numErr;

      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          invoice_number: String(numData),
          customer_id: customerId,
          site_id: siteId || null,
          job_number: job?.job_number ?? null,
          job_source: job?.source ?? null,
          status: "draft",
          issue_date: issueDate,
          due_date: dueDate,
          purchase_order: po.trim() || null,
          notes: notes.trim() || null,
          net_total: totals.net,
          vat_total: totals.vat,
          gross_total: totals.gross,
          bill_to: {
            customer_name: customerName,
            finance_contact_name: finance?.finance_contact_name,
            finance_contact_email: finance?.finance_contact_email,
            billing_address_line1: finance?.billing_address_line1,
            billing_address_line2: finance?.billing_address_line2,
            billing_city: finance?.billing_city,
            billing_county: finance?.billing_county,
            billing_postcode: finance?.billing_postcode,
            billing_country: finance?.billing_country,
            vat_number: finance?.vat_number,
          },
          accounting_provider: settings.accounting_provider ?? "sage50",
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      const payload = lines
        .filter((l) => l.description.trim())
        .map((l, i) => ({
          invoice_id: (inv as any).id,
          sort_order: i,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_price: l.unit_price,
          net_amount: l.net_amount,
          vat_rate: l.vat_rate,
          vat_amount: l.vat_amount,
          nominal_code: l.nominal_code,
        }));
      const { error: lineErr } = await supabase.from("invoice_line_items").insert(payload as any);
      if (lineErr) throw lineErr;

      toast.success("Invoice created");
      onOpenChange(false);
      onCreated((inv as any).id);
      // reset
      setJob(null);
      setJobSearch("");
      setPo("");
      setNotes("");
      setLines([computeLine({ description: "", quantity: 1, unit_price: 0, vat_rate: 20, sort_order: 0 })]);
    } catch (e: any) {
      toast.error("Could not create invoice", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>Raise an invoice from a completed job or from scratch.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Generate from job (optional)</Label>
            <Input
              placeholder="Search job number…"
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
            />
            {jobResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                {jobResults.map((j) => (
                  <button
                    key={`${j.job_number}-${j.source}`}
                    type="button"
                    onClick={() => applyJob(j)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{j.job_number}</span>
                    <span className="text-muted-foreground">
                      {j.customer} · {j.site} · {j.waste_description} · {j.job_date}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Site</Label>
              <Select value={siteId} onValueChange={setSiteId} disabled={!sites.length}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.site_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {customerId && missing.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Finance details incomplete for this customer: <strong>{missing.join(", ")}</strong>. Complete
                them in Customer Setup → Finance Details before invoicing.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Issue date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>PO number {finance?.po_required ? "*" : ""}</Label>
              <Input value={po} onChange={(e) => setPo(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Description</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-20">Unit</TableHead>
                  <TableHead className="w-28">Unit price</TableHead>
                  <TableHead className="w-20">VAT %</TableHead>
                  <TableHead className="w-24">Nominal</TableHead>
                  <TableHead className="w-28 text-right">Net</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={l.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={l.quantity}
                        onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={l.unit ?? ""}
                        onChange={(e) => updateLine(i, { unit: e.target.value || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={l.unit_price}
                        onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="1"
                        value={l.vat_rate}
                        onChange={(e) => updateLine(i, { vat_rate: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={l.nominal_code ?? ""}
                        placeholder="4000"
                        onChange={(e) => updateLine(i, { nominal_code: e.target.value || null })}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">{money(l.net_amount)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-start justify-between gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((ls) => [
                  ...ls,
                  computeLine({
                    description: "",
                    quantity: 1,
                    unit_price: 0,
                    vat_rate: Number(settings.default_vat_rate ?? 20),
                    sort_order: ls.length,
                  }),
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Add line
            </Button>
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net</span>
                <span>{money(totals.net)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT</span>
                <span>{money(totals.vat)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-semibold">
                <span>Total</span>
                <span>{money(totals.gross)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (shown on the invoice)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InvoiceCreateDialog;
