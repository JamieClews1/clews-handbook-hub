/** Design options for the invoice PDF, editable in Finance → Settings → Invoice designer. */
export interface InvoiceTemplate {
  invoice_logo_url?: string | null; // data URL or https URL
  invoice_logo_width_mm?: number | null;
  invoice_show_logo?: boolean | null;
  invoice_show_company_address?: boolean | null;
  invoice_show_bank_details?: boolean | null;
  invoice_show_vat_breakdown?: boolean | null;
  invoice_accent_color?: string | null;
  invoice_header_style?: string | null; // classic | banner | minimal
  invoice_table_style?: string | null; // striped | lines | plain
  invoice_font?: string | null; // helvetica | times | courier
  invoice_document_title?: string | null;
  invoice_footer_text?: string | null;
  invoice_terms_text?: string | null;
}

export const DEFAULT_INVOICE_TEMPLATE: Required<
  Omit<InvoiceTemplate, "invoice_logo_url" | "invoice_footer_text" | "invoice_terms_text">
> & {
  invoice_logo_url: string | null;
  invoice_footer_text: string;
  invoice_terms_text: string;
} = {
  invoice_logo_url: null,
  invoice_logo_width_mm: 40,
  invoice_show_logo: true,
  invoice_show_company_address: true,
  invoice_show_bank_details: true,
  invoice_show_vat_breakdown: true,
  invoice_accent_color: "#16a34a",
  invoice_header_style: "classic",
  invoice_table_style: "striped",
  invoice_font: "helvetica",
  invoice_document_title: "INVOICE",
  invoice_footer_text: "Please quote invoice {{invoice_number}} with your remittance.",
  invoice_terms_text: "",
};

export function resolveTemplate(t?: InvoiceTemplate | null) {
  const merged = { ...DEFAULT_INVOICE_TEMPLATE };
  if (t) {
    (Object.keys(DEFAULT_INVOICE_TEMPLATE) as (keyof typeof DEFAULT_INVOICE_TEMPLATE)[]).forEach((k) => {
      const v = (t as any)[k];
      if (v !== null && v !== undefined && v !== "") (merged as any)[k] = v;
    });
  }
  return merged;
}

export const HEADER_STYLES = [
  { value: "classic", label: "Classic — logo left, details right" },
  { value: "banner", label: "Banner — coloured header bar" },
  { value: "minimal", label: "Minimal — no rules, lots of space" },
] as const;

export const TABLE_STYLES = [
  { value: "striped", label: "Striped rows" },
  { value: "lines", label: "Ruled lines" },
  { value: "plain", label: "Plain" },
] as const;

export const PDF_FONTS = [
  { value: "helvetica", label: "Helvetica (sans)" },
  { value: "times", label: "Times (serif)" },
  { value: "courier", label: "Courier (mono)" },
] as const;

/** #rrggbb → [r,g,b] */
export function hexToRgb(hex?: string | null): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return [22, 163, 74];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
