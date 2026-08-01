// Shared finance types + helpers.
// The data model is deliberately provider-agnostic (`accounting_provider`) so that
// Sage 50 can later be swapped for / joined by Xero, QuickBooks, Sage Accounting, etc.

export type InvoiceStatus =
  | "draft"
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export type SyncStatus = "not_synced" | "pending" | "synced" | "error";

export interface FinanceDetails {
  id?: string;
  customer_id: string;
  finance_contact_name: string | null;
  finance_contact_email: string | null;
  finance_contact_phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_county: string | null;
  billing_postcode: string | null;
  billing_country: string | null;
  vat_number: string | null;
  po_required: boolean;
  payment_terms_days: number | null;
  accounting_provider: string;
  accounting_customer_ref: string | null;
  notes: string | null;
}

export interface InvoiceLine {
  id?: string;
  invoice_id?: string;
  sort_order: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  nominal_code: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  site_id: string | null;
  job_number: string | null;
  job_source: string | null;
  load_report_id: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  purchase_order: string | null;
  net_total: number;
  vat_total: number;
  gross_total: number;
  amount_paid: number;
  notes: string | null;
  bill_to: Record<string, any>;
  pdf_path: string | null;
  sent_at: string | null;
  sent_to: string | null;
  send_count: number;
  accounting_provider: string;
  accounting_ref: string | null;
  accounting_synced_at: string | null;
  accounting_sync_status: SyncStatus;
  status_override: boolean;
  created_at: string;
}

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

/** Badge variant per status — uses semantic tokens only. */
export function statusBadgeClass(status: InvoiceStatus): string {
  switch (status) {
    case "paid":
      return "bg-primary/15 text-primary border-primary/30";
    case "overdue":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "partially_paid":
      return "bg-accent text-accent-foreground border-border";
    case "cancelled":
      return "bg-muted text-muted-foreground border-border line-through";
    case "draft":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

export const money = (n: number | null | undefined, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(Number(n ?? 0));

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB") : "—";

export function daysOverdue(inv: { due_date: string; status: InvoiceStatus }): number {
  if (inv.status === "paid" || inv.status === "cancelled" || inv.status === "draft") return 0;
  const due = new Date(`${inv.due_date}T00:00:00`).getTime();
  const diff = Math.floor((Date.now() - due) / 86_400_000);
  return diff > 0 ? diff : 0;
}

/** Finance details a customer must have before an invoice can be raised. */
export function missingFinanceFields(d: Partial<FinanceDetails> | null | undefined): string[] {
  const missing: string[] = [];
  if (!d) return ["Finance details have not been set up"];
  if (!d.finance_contact_name?.trim()) missing.push("Finance contact name");
  if (!d.finance_contact_email?.trim()) missing.push("Finance contact email");
  if (!d.billing_address_line1?.trim()) missing.push("Billing address line 1");
  if (!d.billing_city?.trim()) missing.push("City");
  if (!d.billing_postcode?.trim()) missing.push("Postcode");
  return missing;
}

export function formatBillingAddress(d: Partial<FinanceDetails> | null | undefined): string[] {
  if (!d) return [];
  return [
    d.billing_address_line1,
    d.billing_address_line2,
    d.billing_city,
    d.billing_county,
    d.billing_postcode,
    d.billing_country,
  ].filter((x): x is string => !!x && !!x.trim());
}

/** Recalculates net/vat totals for a set of lines. */
export function totalsForLines(lines: InvoiceLine[]) {
  const net = lines.reduce((s, l) => s + Number(l.net_amount || 0), 0);
  const vat = lines.reduce((s, l) => s + Number(l.vat_amount || 0), 0);
  return { net: round2(net), vat: round2(vat), gross: round2(net + vat) };
}

export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function computeLine(line: Partial<InvoiceLine>): InvoiceLine {
  const quantity = Number(line.quantity ?? 1);
  const unit_price = Number(line.unit_price ?? 0);
  const vat_rate = Number(line.vat_rate ?? 20);
  const net_amount = round2(quantity * unit_price);
  return {
    sort_order: line.sort_order ?? 0,
    description: line.description ?? "",
    quantity,
    unit: line.unit ?? null,
    unit_price,
    net_amount,
    vat_rate,
    vat_amount: round2((net_amount * vat_rate) / 100),
    nominal_code: line.nominal_code ?? null,
    id: line.id,
    invoice_id: line.invoice_id,
  };
}

/** Simple {{token}} substitution for email templates. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}
