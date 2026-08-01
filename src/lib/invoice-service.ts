import { supabase } from "@/integrations/supabase/client";
import { invoicePdfBlob, type CompanyBranding } from "./invoice-pdf";
import {
  money,
  fmtDate,
  renderTemplate,
  type Invoice,
  type InvoiceLine,
} from "./finance";

export async function fetchCompanyBranding(): Promise<CompanyBranding> {
  const { data } = await supabase.from("company_profile").select("*").limit(1).maybeSingle();
  return (data ?? {}) as CompanyBranding;
}

export async function fetchFinanceSettings(): Promise<any> {
  const { data } = await supabase.from("finance_settings").select("*").limit(1).maybeSingle();
  return data ?? {};
}

export async function fetchInvoiceWithLines(invoiceId: string) {
  const [{ data: invoice }, { data: lines }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle(),
    supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true }),
  ]);
  return { invoice: invoice as unknown as Invoice | null, lines: (lines ?? []) as unknown as InvoiceLine[] };
}

/** Renders the branded PDF, uploads it to the private `invoices` bucket and records the path. */
export async function generateAndStoreInvoicePdf(
  invoice: Invoice,
  lines: InvoiceLine[],
  customerName: string,
): Promise<{ path: string; blob: Blob }> {
  const company = await fetchCompanyBranding();
  const blob = invoicePdfBlob(invoice, lines, company, customerName);
  const path = `${invoice.customer_id}/${invoice.invoice_number}.pdf`;
  const { error } = await supabase.storage
    .from("invoices")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  await supabase.from("invoices").update({ pdf_path: path }).eq("id", invoice.id);
  return { path, blob };
}

export async function downloadInvoicePdf(invoice: Invoice, customerName: string) {
  const { lines } = await fetchInvoiceWithLines(invoice.id);
  const company = await fetchCompanyBranding();
  const blob = invoicePdfBlob(invoice, lines, company, customerName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.invoice_number}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function invoiceTemplateVars(
  invoice: Invoice,
  customerName: string,
  companyName: string,
  contactName?: string | null,
) {
  return {
    invoice_number: invoice.invoice_number,
    customer_name: customerName,
    finance_contact_name: contactName || "Sir/Madam",
    company_name: companyName,
    issue_date: fmtDate(invoice.issue_date),
    due_date: fmtDate(invoice.due_date),
    total: money(invoice.gross_total, invoice.currency),
    net_total: money(invoice.net_total, invoice.currency),
    vat_total: money(invoice.vat_total, invoice.currency),
    purchase_order: invoice.purchase_order || "",
    job_number: invoice.job_number || "",
    days_overdue: String(
      Math.max(
        0,
        Math.floor((Date.now() - new Date(`${invoice.due_date}T00:00:00`).getTime()) / 86_400_000),
      ),
    ),
  };
}

/** Builds subject/body from the stored templates. */
export async function buildInvoiceEmail(
  invoice: Invoice,
  customerName: string,
  contactName?: string | null,
) {
  const [settings, company] = await Promise.all([fetchFinanceSettings(), fetchCompanyBranding()]);
  const vars = invoiceTemplateVars(
    invoice,
    customerName,
    company.company_name || "Clews Recycling",
    contactName,
  );
  return {
    subject: renderTemplate(settings.invoice_email_subject || "Invoice {{invoice_number}}", vars),
    body: renderTemplate(settings.invoice_email_body || "", vars),
  };
}

/** Sends (or re-sends) an invoice to a finance contact with the PDF attached. */
export async function sendInvoiceEmail(params: {
  invoiceId: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  pdfPath: string;
  fileName: string;
}) {
  const { data, error } = await supabase.functions.invoke("send-invoice-email", {
    body: params,
  });
  if (error) throw error;
  if (data && (data as any).error) throw new Error((data as any).error);
  return data;
}

/** CSV in Sage 50 "Audit Trail Transactions" import shape (SI = sales invoice). */
export function sage50CsvForInvoices(
  rows: { invoice: Invoice; lines: InvoiceLine[]; sageRef: string | null; customerName: string }[],
): string {
  const header = [
    "Type",
    "Account Reference",
    "Nominal A/C Ref",
    "Department Code",
    "Date",
    "Reference",
    "Details",
    "Net Amount",
    "Tax Code",
    "Tax Amount",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const out: string[] = [header.map(esc).join(",")];
  rows.forEach(({ invoice, lines, sageRef, customerName }) => {
    lines.forEach((l) => {
      out.push(
        [
          "SI",
          sageRef || customerName.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, ""),
          l.nominal_code || "4000",
          "0",
          new Date(`${invoice.issue_date}T00:00:00`).toLocaleDateString("en-GB"),
          invoice.invoice_number,
          l.description,
          Number(l.net_amount).toFixed(2),
          Number(l.vat_rate) === 20 ? "T1" : Number(l.vat_rate) === 0 ? "T0" : "T1",
          Number(l.vat_amount).toFixed(2),
        ]
          .map(esc)
          .join(","),
      );
    });
  });
  return out.join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Records a queued sync attempt so the admin sync log always reflects reality. */
export async function logSyncAttempt(params: {
  invoiceId: string;
  provider: string;
  direction: "push" | "pull";
  status: "pending" | "success" | "error";
  message?: string;
  payload?: any;
}) {
  await supabase.from("accounting_sync_log").insert({
    invoice_id: params.invoiceId,
    provider: params.provider,
    direction: params.direction,
    entity_type: "invoice",
    entity_id: params.invoiceId,
    status: params.status,
    message: params.message ?? null,
    payload: params.payload ?? null,
  } as any);
}
