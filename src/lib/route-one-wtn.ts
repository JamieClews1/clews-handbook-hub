import jsPDF from "jspdf";

/**
 * Waste Transfer Note / Delivery & Collection ticket for RouteOne jobs.
 * One A4 sheet holds two identical copies: CUSTOMER COPY (top) and OFFICE COPY (bottom).
 * Signatures captured on a phone (driver app) are drawn into the sign-off box.
 */

export type WtnJob = {
  job_number?: string | null;
  scheduled_date?: string | null;
  completed_at?: string | null;
  customer_name?: string | null;
  site_name?: string | null;
  site_address?: string | null;
  site_address_2?: string | null;
  site_area?: string | null;
  site_postcode?: string | null;
  sic_code?: string | null;
  site_contact_name?: string | null;
  site_contact_phone?: string | null;
  account_code?: string | null;
  po_number?: string | null;
  job_type?: string | null;
  container_type?: string | null;
  container_size?: string | null;
  waste_type?: string | null;
  ewc_code?: string | null;
  notes?: string | null;
  directions?: string | null;
  disposal_site?: string | null;
  invoice_address?: string | null;
  vehicle_reg?: string | null;
  carrier_name?: string | null;
  customer_signature?: string | null;
  customer_signoff_name?: string | null;
  customer_signoff_at?: string | null;
  driver_signature?: string | null;
  driver_signoff_name?: string | null;
  driver_name?: string | null;
};

const COMPANY = {
  name: "Clews Recycling Ltd",
  carrier: "Waste Carrier - CBDU203180",
  address: ["Unit 17 Hunters Lane,", "Rugby,", "Warwickshire,", "CV21 1EA"],
  phone: "01788 541 549",
  web: "www.clewsrecycling.co.uk",
  orders: "Service Request Email: Orders@clewsrecycling.co.uk",
  footer1:
    "Registered Waste Carrier Clews Recycling Ltd No. CBDU203180, Waste Management License No. EAWML 48106",
  footer2: "Company Reg. No. 3856771. VAT Registration Number 747 3166 19",
};

const TYPE_LABELS: Record<string, string> = {
  delivery: "Deliver",
  exchange: "Exchange",
  collection: "Collect",
  waste_truck: "Waste Truck",
  wasted_journey: "Wasted Journey",
};

const fmtDate = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB");
};

/** Address lines for the waste producer block. */
function addressLines(job: WtnJob): string[] {
  const raw = [
    job.site_name,
    job.site_address,
    job.site_address_2,
    job.site_area,
    job.site_postcode,
  ]
    .filter(Boolean)
    .join("\n");
  const seen = new Set<string>();
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      const k = l.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

const imgFormat = (src: string): "PNG" | "JPEG" =>
  /^data:image\/jpe?g/i.test(src) ? "JPEG" : "PNG";

/** Draws one copy of the note into the given vertical band. */
function drawCopy(doc: jsPDF, job: WtnJob, top: number, copyLabel: string) {
  const L = 10;
  const R = 200;
  const W = R - L;
  let y = top;

  const box = (x: number, yy: number, w: number, h: number) => doc.rect(x, yy, w, h);
  const label = (text: string, x: number, yy: number, size = 6.5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.text(text, x, yy);
  };
  const val = (text: string, x: number, yy: number, size = 8, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text || "", x, yy);
  };

  doc.setDrawColor(0);
  doc.setLineWidth(0.2);

  /* ── Header ── */
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(COMPANY.carrier, L, y + 3);
  doc.text(COMPANY.name, L, y + 6);
  COMPANY.address.forEach((line, i) => doc.text(line, L, y + 9 + i * 3));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CONTROLLED WASTE", R, y + 4, { align: "right" });
  doc.text("TRANSFER NOTE", R, y + 8, { align: "right" });
  doc.setFontSize(8);
  doc.text("DELIVERY/COLLECTION TICKET", R, y + 12, { align: "right" });
  doc.text(copyLabel, R, y + 16, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(COMPANY.name, L + W / 2, y + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(COMPANY.web, L + W / 2, y + 10, { align: "center" });
  doc.text(COMPANY.phone, L + W / 2, y + 13.5, { align: "center" });
  doc.text(COMPANY.orders, L, y + 22);

  y += 24;

  /* ── Summary strip ── */
  const cols = [
    { t: "Customer O/N", v: job.po_number || "TBC", w: 32 },
    { t: "Date", v: fmtDate(job.completed_at || job.scheduled_date), w: 24 },
    { t: "Ticket No", v: job.job_number || "", w: 26 },
    { t: "Skip/Ro Ro/Trailer", v: [job.container_size, job.container_type].filter(Boolean).join(" ") || "", w: 48 },
    { t: "Transaction Type", v: TYPE_LABELS[String(job.job_type)] || String(job.job_type || ""), w: 32 },
    { t: "Account", v: job.account_code || "", w: W - 162 },
  ];
  let x = L;
  for (const c of cols) {
    box(x, y, c.w, 6);
    box(x, y + 6, c.w, 7);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(c.t, x + c.w / 2, y + 4, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(String(c.v).slice(0, 30), x + c.w / 2, y + 10.8, { align: "center", maxWidth: c.w - 2 });
    x += c.w;
  }
  y += 13;

  /* ── Producer / contact / invoice ── */
  const rowH = 26;
  const c1 = 86;
  const c2 = 40;
  const c3 = W - c1 - c2;
  box(L, y, c1, rowH);
  box(L + c1, y, c2, rowH);
  box(L + c1 + c2, y, c3, rowH);

  label("Waste", L + 1.5, y + 4, 7.5);
  label("Producer:", L + 1.5, y + 8, 7.5);
  const lines = [job.customer_name || "", ...addressLines(job)];
  lines.slice(0, 7).forEach((line, i) => val(String(line).slice(0, 40), L + 20, y + 4 + i * 3.2, 7.5));

  label("Site Contact", L + c1 + c2 / 2 - 9, y + 4, 7.5);
  val(job.site_contact_name || "", L + c1 + 3, y + 10, 7.5);
  val(job.site_contact_phone || "", L + c1 + 3, y + 15, 7.5);
  val(job.sic_code ? `SIC : ${job.sic_code}` : "", L + c1 + 3, y + 21, 7.5);

  label("Invoice Address:", L + c1 + c2 + 1.5, y + 4, 7.5);
  (job.invoice_address || "")
    .split("\n")
    .slice(0, 6)
    .forEach((line, i) => val(line.trim(), L + c1 + c2 + 26, y + 4 + i * 3.2, 7.5));
  val(`Office Contact No: ${COMPANY.phone}`, L + c1 + c2 + 1.5, y + rowH - 2, 7.5);
  y += rowH;

  /* ── Comments / directions ── */
  const commentH = 16;
  box(L, y, c1 + c2, commentH);
  box(L + c1 + c2, y, c3, commentH);
  label("Comments:", L + 1.5, y + 4, 7.5);
  doc.setFontSize(7.5);
  doc.text(doc.splitTextToSize(job.notes || "", c1 + c2 - 22), L + 19, y + 4);
  label("Directions:", L + c1 + c2 + 1.5, y + 4, 7.5);
  doc.text(doc.splitTextToSize(job.directions || "", c3 - 22), L + c1 + c2 + 19, y + 4);
  y += commentH;

  /* ── Vehicle / carrier / EWC / signatures ── */
  const bandH = 40;
  const leftW = 96;
  const rightW = W - leftW;
  const vehH = 14;
  box(L, y, leftW / 2, vehH);
  box(L + leftW / 2, y, leftW / 2, vehH);
  label("Vehicle Reg:", L + 1.5, y + 4, 7.5);
  val(job.vehicle_reg || "", L + 1.5, y + 10, 8, true);
  label("Waste Carrier:", L + leftW / 2 + 1.5, y + 4, 7.5);
  val(job.carrier_name || COMPANY.name, L + leftW / 2 + 1.5, y + 10, 8, true);

  // Broker / EWC blocks
  const lowerH = bandH - vehH;
  box(L, y + vehH, leftW / 2, lowerH);
  doc.setFontSize(6.5);
  doc.text(
    doc.splitTextToSize(
      "All Skips booked through a Third party broker, Must contact the Broker directly for all service requirements",
      leftW / 2 - 4,
    ),
    L + leftW / 4,
    y + vehH + 8,
    { align: "center" },
  );
  box(L + leftW / 2, y + vehH, leftW / 2, lowerH);
  val(`EWC/Description: ${[job.ewc_code, job.waste_type].filter(Boolean).join(" — ")}`, L + leftW / 2 + 1.5, y + vehH + 4, 7.5);
  doc.setFontSize(6.5);
  doc.text(
    doc.splitTextToSize(
      "Skip hire period is for 2 weeks from the date of hire. Roll on Roll off Hire period is for 30 days from the date of hire",
      leftW / 2 - 4,
    ),
    L + leftW / 2 + leftW / 4,
    y + vehH + 12,
    { align: "center" },
  );

  // Signature panel
  const sigH = 22;
  box(L + leftW, y, rightW, sigH);
  label("Waste Producer Sign:", L + leftW + 1.5, y + 4, 7.5);
  if (job.customer_signature) {
    try {
      doc.addImage(job.customer_signature, imgFormat(job.customer_signature), L + leftW + 34, y + 1.5, 40, 16);
    } catch {
      /* ignore malformed signature data */
    }
  }
  label("Waste Producer Print:", L + leftW + 1.5, y + sigH - 8, 7.5);
  val(job.customer_signoff_name || "", L + leftW + 36, y + sigH - 8, 8, true);
  val(job.customer_signoff_at ? `Signed ${fmtDate(job.customer_signoff_at)}` : "", L + leftW + 1.5, y + sigH - 2, 6.5);

  const dispH = bandH - sigH;
  box(L + leftW, y + sigH, rightW, dispH);
  label("Disposal Site:", L + leftW + 1.5, y + sigH + 4, 7.5);
  (job.disposal_site || "Clews Recycling Ltd\nUnit 17 Hunters Lane\nRugby CV21 1EA")
    .split("\n")
    .slice(0, 4)
    .forEach((line, i) => val(line.trim(), L + leftW + 25, y + sigH + 4 + i * 3.2, 7.5));
  y += bandH;

  /* ── Driver sign-off ── */
  const drvH = 16;
  box(L, y, leftW, drvH);
  label("Driver Sign:", L + 1.5, y + 4, 7.5);
  if (job.driver_signature) {
    try {
      doc.addImage(job.driver_signature, imgFormat(job.driver_signature), L + 22, y + 1, 38, 13);
    } catch {
      /* ignore */
    }
  }
  label("Driver Print:", L + 1.5, y + drvH - 2, 7.5);
  val(job.driver_signoff_name || job.driver_name || "", L + 22, y + drvH - 2, 8, true);

  box(L + leftW, y, rightW, drvH);
  doc.setFontSize(6);
  doc.text(
    doc.splitTextToSize(
      "I acknowledge that in signing this waste transfer note, I am confirming that the waste is as described above, and that we accept responsibility for any non-conforming waste subsequently found in the container; I have read or will read the terms and conditions and agree to accept them in their entirety. By signing above, I confirm that I have fulfilled my duty to apply the Waste Hierarchy as required by Regulation 12 of the Waste (England & Wales) Regulations 2011.",
      rightW - 4,
    ),
    L + leftW + 2,
    y + 3,
  );
  y += drvH;

  /* ── Footer ── */
  doc.setFontSize(6.5);
  doc.text(COMPANY.footer1, L + W / 2, y + 4, { align: "center" });
  doc.text(COMPANY.footer2, L + W / 2, y + 7.5, { align: "center" });
}

export function buildWtnPdf(job: WtnJob): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawCopy(doc, job, 8, "CUSTOMER COPY");
  doc.setLineWidth(0.1);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(10, 152, 200, 152);
  doc.setLineDashPattern([], 0);
  drawCopy(doc, job, 156, "OFFICE COPY");
  return doc;
}

export const wtnFileName = (job: WtnJob) =>
  `WTN-${(job.job_number || "job").replace(/[^\w-]+/g, "")}.pdf`;

export function downloadWtnPdf(job: WtnJob) {
  buildWtnPdf(job).save(wtnFileName(job));
}

/** Opens the note in a new tab and triggers the browser print dialog. */
export function printWtnPdf(job: WtnJob) {
  const doc = buildWtnPdf(job);
  const url = URL.createObjectURL(doc.output("blob"));
  const win = window.open(url, "_blank");
  if (win) {
    win.addEventListener("load", () => {
      try {
        win.focus();
        win.print();
      } catch {
        /* pop-up print blocked — the PDF is still open */
      }
    });
  }
}
