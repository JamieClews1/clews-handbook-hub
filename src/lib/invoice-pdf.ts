import jsPDF from "jspdf";
import { money, fmtDate, formatBillingAddress, type Invoice, type InvoiceLine } from "./finance";

export interface CompanyBranding {
  company_name?: string | null;
  registered_address?: string | null;
  operational_address?: string | null;
  telephone?: string | null;
  email?: string | null;
  website?: string | null;
  vat_number?: string | null;
  company_registration_number?: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_sort_code?: string | null;
  bank_account_number?: string | null;
}

const M = 14; // page margin

/** Builds a branded A4 sales-invoice PDF. Returns the jsPDF doc. */
export function buildInvoicePdf(
  invoice: Invoice,
  lines: InvoiceLine[],
  company: CompanyBranding,
  customerName: string,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 18;

  // Header — company block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(company.company_name || "Invoice", M, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("INVOICE", pageW - M, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const compLines = [
    ...(company.registered_address || "").split("\n").filter(Boolean),
    company.telephone ? `Tel: ${company.telephone}` : "",
    company.email || "",
    company.website || "",
    company.vat_number ? `VAT No: ${company.vat_number}` : "",
    company.company_registration_number ? `Company No: ${company.company_registration_number}` : "",
  ].filter(Boolean);
  compLines.forEach((l) => {
    doc.text(String(l), M, y);
    y += 4;
  });

  // Invoice meta (right)
  let metaY = 26;
  const meta: [string, string][] = [
    ["Invoice No", invoice.invoice_number],
    ["Issue date", fmtDate(invoice.issue_date)],
    ["Due date", fmtDate(invoice.due_date)],
  ];
  if (invoice.purchase_order) meta.push(["PO number", invoice.purchase_order]);
  if (invoice.job_number) meta.push(["Job number", invoice.job_number]);
  doc.setFontSize(9);
  meta.forEach(([k, v]) => {
    doc.setFont("helvetica", "normal");
    doc.text(`${k}:`, pageW - M - 42, metaY);
    doc.setFont("helvetica", "bold");
    doc.text(String(v), pageW - M, metaY, { align: "right" });
    metaY += 5;
  });

  y = Math.max(y, metaY) + 6;

  // Bill to
  doc.setDrawColor(210);
  doc.line(M, y, pageW - M, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Invoice to", M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const bt = invoice.bill_to || {};
  const billLines = [
    customerName,
    bt.finance_contact_name || "",
    ...formatBillingAddress(bt as any),
    bt.vat_number ? `VAT No: ${bt.vat_number}` : "",
  ].filter(Boolean);
  billLines.forEach((l) => {
    doc.text(String(l), M, y);
    y += 4.5;
  });

  y += 6;

  // Table header
  const colX = { desc: M, qty: 108, unit: 130, vat: 152, net: pageW - M };
  doc.setFillColor(243, 244, 246);
  doc.rect(M - 2, y - 4.5, pageW - 2 * M + 4, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Description", colX.desc, y);
  doc.text("Qty", colX.qty, y, { align: "right" });
  doc.text("Unit price", colX.unit, y, { align: "right" });
  doc.text("VAT %", colX.vat, y, { align: "right" });
  doc.text("Net", colX.net, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  lines.forEach((l) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    const wrapped = doc.splitTextToSize(l.description || "", 88) as string[];
    doc.text(wrapped, colX.desc, y);
    const qtyLabel = l.unit ? `${l.quantity} ${l.unit}` : String(l.quantity);
    doc.text(qtyLabel, colX.qty, y, { align: "right" });
    doc.text(money(l.unit_price, invoice.currency), colX.unit, y, { align: "right" });
    doc.text(`${Number(l.vat_rate)}%`, colX.vat, y, { align: "right" });
    doc.text(money(l.net_amount, invoice.currency), colX.net, y, { align: "right" });
    y += Math.max(5.5, wrapped.length * 4.5 + 1.5);
  });

  y += 2;
  doc.setDrawColor(210);
  doc.line(colX.qty - 12, y, pageW - M, y);
  y += 6;

  // VAT breakdown by rate
  const byRate = new Map<number, { net: number; vat: number }>();
  lines.forEach((l) => {
    const r = Number(l.vat_rate || 0);
    const cur = byRate.get(r) || { net: 0, vat: 0 };
    cur.net += Number(l.net_amount || 0);
    cur.vat += Number(l.vat_amount || 0);
    byRate.set(r, cur);
  });

  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10.5 : 9);
    doc.text(label, pageW - M - 42, y, { align: "right" });
    doc.text(value, pageW - M, y, { align: "right" });
    y += bold ? 7 : 5.5;
  };

  totalRow("Subtotal (net)", money(invoice.net_total, invoice.currency));
  Array.from(byRate.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([rate, v]) =>
      totalRow(`VAT @ ${rate}% on ${money(v.net, invoice.currency)}`, money(v.vat, invoice.currency)),
    );
  totalRow("Total VAT", money(invoice.vat_total, invoice.currency));
  totalRow("Total due", money(invoice.gross_total, invoice.currency), true);
  if (Number(invoice.amount_paid) > 0) {
    totalRow("Paid to date", money(invoice.amount_paid, invoice.currency));
    totalRow(
      "Balance outstanding",
      money(Number(invoice.gross_total) - Number(invoice.amount_paid), invoice.currency),
      true,
    );
  }

  // Footer — payment details / notes
  y += 6;
  if (invoice.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Notes", M, y);
    doc.setFont("helvetica", "normal");
    y += 4.5;
    (doc.splitTextToSize(invoice.notes, pageW - 2 * M) as string[]).forEach((l) => {
      doc.text(l, M, y);
      y += 4.2;
    });
    y += 3;
  }

  const bank = [
    company.bank_name ? `Bank: ${company.bank_name}` : "",
    company.bank_account_name ? `Account name: ${company.bank_account_name}` : "",
    company.bank_sort_code ? `Sort code: ${company.bank_sort_code}` : "",
    company.bank_account_number ? `Account number: ${company.bank_account_number}` : "",
  ].filter(Boolean);
  if (bank.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Payment details", M, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    bank.forEach((l) => {
      doc.text(String(l), M, y);
      y += 4.2;
    });
  }

  doc.setFontSize(7.5);
  doc.setTextColor(130);
  doc.text(
    `Please quote invoice ${invoice.invoice_number} with your remittance.`,
    M,
    doc.internal.pageSize.getHeight() - 10,
  );

  return doc;
}

export function invoicePdfBlob(...args: Parameters<typeof buildInvoicePdf>): Blob {
  return buildInvoicePdf(...args).output("blob");
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}
