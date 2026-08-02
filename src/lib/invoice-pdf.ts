import jsPDF from "jspdf";
import { money, fmtDate, formatBillingAddress, renderTemplate, type Invoice, type InvoiceLine } from "./finance";
import { hexToRgb, resolveTemplate, type InvoiceTemplate } from "./invoice-template";

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

function imageFormat(src: string): "PNG" | "JPEG" {
  return /^data:image\/jpe?g|\.jpe?g($|\?)/i.test(src) ? "JPEG" : "PNG";
}

/** Builds a branded A4 sales-invoice PDF. Returns the jsPDF doc. */
export function buildInvoicePdf(
  invoice: Invoice,
  lines: InvoiceLine[],
  company: CompanyBranding,
  customerName: string,
  template?: InvoiceTemplate | null,
): jsPDF {
  const t = resolveTemplate(template);
  const accent = hexToRgb(t.invoice_accent_color);
  const font = ["helvetica", "times", "courier"].includes(String(t.invoice_font))
    ? String(t.invoice_font)
    : "helvetica";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const banner = t.invoice_header_style === "banner";
  const minimal = t.invoice_header_style === "minimal";

  let y = 18;
  let logoBottom = 0;

  if (banner) {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, 0, pageW, 26, "F");
  }

  // Logo
  const logo = t.invoice_show_logo ? t.invoice_logo_url : null;
  if (logo) {
    try {
      const w = Number(t.invoice_logo_width_mm) || 40;
      const props = doc.getImageProperties(logo);
      const h = (props.height / props.width) * w;
      const top = banner ? 4 : 12;
      doc.addImage(logo, imageFormat(logo), M, top, w, h);
      logoBottom = top + h;
    } catch {
      /* ignore unreadable logo */
    }
  }

  // Company name / title
  doc.setFont(font, "bold");
  if (!logo) {
    doc.setFontSize(18);
    if (banner) doc.setTextColor(255, 255, 255);
    doc.text(company.company_name || "Invoice", M, banner ? 16 : y);
    doc.setTextColor(0, 0, 0);
  }

  doc.setFont(font, "bold");
  doc.setFontSize(20);
  if (banner) doc.setTextColor(255, 255, 255);
  else doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text(String(t.invoice_document_title || "INVOICE"), pageW - M, banner ? 17 : y, { align: "right" });
  doc.setTextColor(0, 0, 0);

  y = Math.max(banner ? 32 : 24, logoBottom + 6);

  if (t.invoice_show_company_address) {
    doc.setFont(font, "normal");
    doc.setFontSize(8.5);
    const compLines = [
      logo ? company.company_name || "" : "",
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
  }

  // Invoice meta (right)
  let metaY = banner ? 34 : 30;
  const meta: [string, string][] = [
    ["Invoice No", invoice.invoice_number],
    ["Issue date", fmtDate(invoice.issue_date)],
    ["Due date", fmtDate(invoice.due_date)],
  ];
  if (invoice.purchase_order) meta.push(["PO number", invoice.purchase_order]);
  if (invoice.job_number) meta.push(["Job number", invoice.job_number]);
  doc.setFontSize(9);
  meta.forEach(([k, v]) => {
    doc.setFont(font, "normal");
    doc.text(`${k}:`, pageW - M - 42, metaY);
    doc.setFont(font, "bold");
    doc.text(String(v), pageW - M, metaY, { align: "right" });
    metaY += 5;
  });

  y = Math.max(y, metaY) + 6;

  // Bill to
  if (!minimal) {
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(0.5);
    doc.line(M, y, pageW - M, y);
    doc.setLineWidth(0.2);
    doc.setDrawColor(210);
  }
  y += 7;
  doc.setFont(font, "bold");
  doc.setFontSize(9);
  doc.text("Invoice to", M, y);
  y += 5;
  doc.setFont(font, "normal");
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
  if (t.invoice_table_style === "plain") {
    doc.setDrawColor(210);
    doc.line(M - 2, y + 2.5, pageW - M + 2, y + 2.5);
  } else {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(M - 2, y - 4.5, pageW - 2 * M + 4, 7, "F");
    doc.setTextColor(255, 255, 255);
  }
  doc.setFont(font, "bold");
  doc.setFontSize(8.5);
  doc.text("Description", colX.desc, y);
  doc.text("Qty", colX.qty, y, { align: "right" });
  doc.text("Unit price", colX.unit, y, { align: "right" });
  doc.text("VAT %", colX.vat, y, { align: "right" });
  doc.text("Net", colX.net, y, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 7;

  doc.setFont(font, "normal");
  lines.forEach((l, i) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    const wrapped = doc.splitTextToSize(l.description || "", 88) as string[];
    const rowH = Math.max(5.5, wrapped.length * 4.5 + 1.5);
    if (t.invoice_table_style === "striped" && i % 2 === 1) {
      doc.setFillColor(246, 247, 249);
      doc.rect(M - 2, y - 4, pageW - 2 * M + 4, rowH, "F");
    }
    doc.text(wrapped, colX.desc, y);
    const qtyLabel = l.unit ? `${l.quantity} ${l.unit}` : String(l.quantity);
    doc.text(qtyLabel, colX.qty, y, { align: "right" });
    doc.text(money(l.unit_price, invoice.currency), colX.unit, y, { align: "right" });
    doc.text(`${Number(l.vat_rate)}%`, colX.vat, y, { align: "right" });
    doc.text(money(l.net_amount, invoice.currency), colX.net, y, { align: "right" });
    y += rowH;
    if (t.invoice_table_style === "lines") {
      doc.setDrawColor(225);
      doc.line(M - 2, y - 3.5, pageW - M + 2, y - 3.5);
    }
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
    doc.setFont(font, bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10.5 : 9);
    if (bold) doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(label, pageW - M - 42, y, { align: "right" });
    doc.text(value, pageW - M, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += bold ? 7 : 5.5;
  };

  totalRow("Subtotal (net)", money(invoice.net_total, invoice.currency));
  if (t.invoice_show_vat_breakdown) {
    Array.from(byRate.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([rate, v]) =>
        totalRow(`VAT @ ${rate}% on ${money(v.net, invoice.currency)}`, money(v.vat, invoice.currency)),
      );
  }
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

  // Footer — notes / terms / payment details
  y += 6;
  const block = (title: string, body: string[]) => {
    if (!body.length) return;
    doc.setFont(font, "bold");
    doc.setFontSize(8.5);
    doc.text(title, M, y);
    y += 4.5;
    doc.setFont(font, "normal");
    body.forEach((l) => {
      doc.text(String(l), M, y);
      y += 4.2;
    });
    y += 3;
  };

  if (invoice.notes) block("Notes", doc.splitTextToSize(invoice.notes, pageW - 2 * M) as string[]);

  if (t.invoice_show_bank_details) {
    block(
      "Payment details",
      [
        company.bank_name ? `Bank: ${company.bank_name}` : "",
        company.bank_account_name ? `Account name: ${company.bank_account_name}` : "",
        company.bank_sort_code ? `Sort code: ${company.bank_sort_code}` : "",
        company.bank_account_number ? `Account number: ${company.bank_account_number}` : "",
      ].filter(Boolean),
    );
  }

  if (t.invoice_terms_text) {
    block("Terms", doc.splitTextToSize(String(t.invoice_terms_text), pageW - 2 * M) as string[]);
  }

  const footer = renderTemplate(String(t.invoice_footer_text || ""), {
    invoice_number: invoice.invoice_number,
    customer_name: customerName,
    company_name: company.company_name || "",
    due_date: fmtDate(invoice.due_date),
    total: money(invoice.gross_total, invoice.currency),
  });
  if (footer.trim()) {
    doc.setFont(font, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130);
    doc.text(footer, M, pageH - 10);
    doc.setTextColor(0, 0, 0);
  }

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
