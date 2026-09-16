/**
 * Warwickshire County Council skip licence application.
 *
 * The council's blank form is kept as an asset; the blue, editable parts of it
 * are FreeText annotations in the original PDF. We strip those annotations and
 * draw our own values in the same places, so the generated form looks exactly
 * like the one the office fills in by hand.
 */
import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite url import
import templateUrl from "@/assets/wcc-skip-permit-template.pdf?url";

export const WCC_AREAS = ["Rugby / Crick", "Warwick / Leamington"];

/** Does this permit area use the Warwickshire application form? */
export function isWccArea(area: string | null | undefined): boolean {
  const a = (area || "").toLowerCase();
  return a.includes("warwick") || a.includes("rugby") || a.includes("leamington");
}

export const WCC_SKIP_SIZES = ["Mini", "Small", "Medium", "Large", "Extra Large", "Maxi"];

export type WccFormValues = {
  company_name: string;
  registered_address: string;
  email_address: string;
  telephone: string;
  contact_name: string;
  application_type: "new" | "renewal";
  previous_reference: string;
  skip_location: string;
  works_address: string;
  reason_off_highway: string;
  skip_size: string;
  start_date: string; // yyyy-mm-dd
  end_date: string; // yyyy-mm-dd
  declaration_name: string;
  declaration_date: string; // yyyy-mm-dd
};

export const WCC_DEFAULTS: WccFormValues = {
  company_name: "Clews Recycling Limited",
  registered_address: "Unit 17, Hunters Lane\nRugby\nCV21 1EA",
  email_address: "orders@clewsrecycling.co.uk",
  telephone: "01788 541 549",
  contact_name: "Tara Rule/Sharon Coggrave",
  application_type: "new",
  previous_reference: "",
  skip_location: "",
  works_address: "",
  reason_off_highway: "No Drive/ Not own private Land",
  skip_size: "Medium",
  start_date: "",
  end_date: "",
  declaration_name: "Sharon Coggrave",
  declaration_date: "",
};

function ukDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

type Slot = { page: 0 | 1; x: number; y: number; size?: number; leading?: number };

const SLOTS: Record<string, Slot> = {
  company_name: { page: 0, x: 228, y: 485 },
  registered_address: { page: 0, x: 246, y: 459, leading: 12 },
  email_address: { page: 0, x: 203, y: 406 },
  telephone: { page: 0, x: 218, y: 387 },
  contact_name: { page: 0, x: 219, y: 360 },
  previous_reference: { page: 0, x: 330, y: 277 },
  skip_location: { page: 0, x: 190, y: 209, leading: 12 },
  works_address: { page: 0, x: 190, y: 140, leading: 12 },
  reason_off_highway: { page: 0, x: 224, y: 80, leading: 12 },
  skip_size: { page: 1, x: 437, y: 583 },
  start_date: { page: 1, x: 200, y: 557 },
  end_date: { page: 1, x: 429, y: 557 },
  declaration_name: { page: 1, x: 96, y: 224 },
  declaration_date: { page: 1, x: 488, y: 216 },
};

const BLUE = rgb(0.1, 0.2, 0.75);
const DROP_ANNOTS = ["/FreeText", "/Popup", "/Highlight"];

/** Split text so it fits the available width of its box. */
function wrap(text: string, font: any, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of String(text ?? "").split("\n")) {
    let line = "";
    for (const word of raw.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out.filter((l, i) => l !== "" || i === 0);
}

const MAX_WIDTH: Record<string, number> = {
  registered_address: 300,
  skip_location: 350,
  works_address: 350,
  reason_off_highway: 320,
  company_name: 300,
};

export async function buildWccPermitPdf(values: WccFormValues): Promise<Uint8Array> {
  const res = await fetch(templateAsset.url);
  if (!res.ok) throw new Error("Could not load the council form template");
  const pdf = await PDFDocument.load(await res.arrayBuffer(), { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  // Remove the blue placeholder text from the blank form, keep the ticks.
  for (const page of pages) {
    const annots = page.node.Annots();
    if (!annots) continue;
    const keep = annots.asArray().filter((ref) => {
      const dict: any = pdf.context.lookup(ref);
      const subtype = dict?.get?.(PDFName.of("Subtype"));
      return subtype ? !DROP_ANNOTS.includes(String(subtype)) : true;
    });
    page.node.set(PDFName.of("Annots"), pdf.context.obj(keep));
  }

  const text: Record<string, string> = {
    company_name: values.company_name,
    registered_address: values.registered_address,
    email_address: values.email_address,
    telephone: values.telephone,
    contact_name: values.contact_name,
    previous_reference: values.application_type === "renewal" ? values.previous_reference : "",
    skip_location: values.skip_location,
    works_address: values.works_address,
    reason_off_highway: values.reason_off_highway,
    skip_size: values.skip_size,
    start_date: ukDate(values.start_date),
    end_date: ukDate(values.end_date),
    declaration_name: values.declaration_name,
    declaration_date: ukDate(values.declaration_date),
  };

  for (const [key, slot] of Object.entries(SLOTS)) {
    const value = (text[key] ?? "").trim();
    if (!value) continue;
    const size = slot.size ?? 10;
    const lines = wrap(value, font, size, MAX_WIDTH[key] ?? 260);
    lines.forEach((line, i) => {
      pages[slot.page].drawText(line, {
        x: slot.x,
        y: slot.y - i * (slot.leading ?? 12),
        size,
        font,
        color: BLUE,
      });
    });
  }

  return pdf.save();
}

/** Sensible starting values for a permit application. */
export function wccValuesForPermit(permit: {
  site_address?: string | null;
  site_postcode?: string | null;
  start_date?: string | null;
  expiry_date?: string | null;
  form_data?: any;
}): WccFormValues {
  const address = [permit.site_address, permit.site_postcode].filter(Boolean).join(", ");
  return {
    ...WCC_DEFAULTS,
    skip_location: address,
    works_address: address,
    start_date: permit.start_date ?? "",
    end_date: permit.expiry_date ?? "",
    declaration_date: new Date().toISOString().slice(0, 10),
    ...(permit.form_data && typeof permit.form_data === "object" ? permit.form_data : {}),
  };
}

export function wccPdfFileName(permit: { job_number?: string | null; id?: string }): string {
  const ref = permit.job_number || permit.id?.slice(0, 8) || "application";
  return `WCC-skip-licence-${ref}.pdf`;
}
