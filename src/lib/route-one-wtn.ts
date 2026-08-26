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

export const DEFAULT_TERMS =
  "I acknowledge that in signing this waste transfer note, I am confirming that the waste is as described above, and that we accept responsibility for any non-conforming waste subsequently found in the container; I have read or will read the terms and conditions and agree to accept them in their entirety. By signing above, I confirm that I have fulfilled my duty to apply the Waste Hierarchy as required by Regulation 12 of the Waste (England & Wales) Regulations 2011.";

export const DEFAULT_HIRE_NOTE =
  "Skip hire period is for 2 weeks from the date of hire. Roll on Roll off Hire period is for 30 days from the date of hire";

export const DEFAULT_BROKER_NOTE =
  "All Skips booked through a Third party broker, Must contact the Broker directly for all service requirements";

/** Plain-English ticket builder options (no coding required). */
export type WtnOptions = {
  title: string;
  subtitle: string;
  accent: string; // hex
  showLogo: boolean;
  logoSize: number; // mm width
  customerCopyLabel: string;
  officeCopyLabel: string;
  twoCopies: boolean;
  showSiteContact: boolean;
  showInvoiceAddress: boolean;
  showComments: boolean;
  showDirections: boolean;
  showDisposalSite: boolean;
  showSignatures: boolean;
  showBrokerNote: boolean;
  showHireNote: boolean;
  showFooter: boolean;
  terms: string;
  hireNote: string;
  brokerNote: string;
  footerText: string;
};

export const DEFAULT_WTN_OPTIONS: WtnOptions = {
  title: "CONTROLLED WASTE TRANSFER NOTE",
  subtitle: "Delivery / Collection Ticket",
  accent: "#166534",
  showLogo: true,
  logoSize: 30,
  customerCopyLabel: "CUSTOMER COPY",
  officeCopyLabel: "OFFICE COPY",
  twoCopies: true,
  showSiteContact: true,
  showInvoiceAddress: true,
  showComments: true,
  showDirections: true,
  showDisposalSite: true,
  showSignatures: true,
  showBrokerNote: true,
  showHireNote: true,
  showFooter: true,
  terms: DEFAULT_TERMS,
  hireNote: DEFAULT_HIRE_NOTE,
  brokerNote: DEFAULT_BROKER_NOTE,
  footerText: `${COMPANY.footer1}  ·  ${COMPANY.footer2}  ·  ${COMPANY.web}`,
};

const OPTIONS_KEY = "route_one_wtn_options";

export function getWtnOptions(): WtnOptions {
  if (typeof localStorage === "undefined") return DEFAULT_WTN_OPTIONS;
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    return raw ? { ...DEFAULT_WTN_OPTIONS, ...JSON.parse(raw) } : DEFAULT_WTN_OPTIONS;
  } catch {
    return DEFAULT_WTN_OPTIONS;
  }
}

export function setWtnOptions(opts: WtnOptions) {
  localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts));
}

export function resetWtnOptions() {
  localStorage.removeItem(OPTIONS_KEY);
}

/** #rrggbb → jsPDF rgb triple. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [22, 101, 52];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const tintOf = (rgb: [number, number, number]): [number, number, number] => [
  Math.round(255 - (255 - rgb[0]) * 0.12),
  Math.round(255 - (255 - rgb[1]) * 0.12),
  Math.round(255 - (255 - rgb[2]) * 0.12),
];

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
function drawCopy(
  doc: jsPDF,
  job: WtnJob,
  top: number,
  copyLabel: string,
  opts: WtnOptions = DEFAULT_WTN_OPTIONS,
  logo?: string | null,
) {
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
  const titleWords = doc.splitTextToSize(opts.title, 58) as string[];
  titleWords.slice(0, 2).forEach((t, i) => doc.text(t, R, y + 4 + i * 4, { align: "right" }));
  doc.setFontSize(8);
  doc.text(opts.subtitle.toUpperCase(), R, y + 12, { align: "right" });
  doc.text(copyLabel, R, y + 16, { align: "right" });

  if (opts.showLogo && logo) {
    try {
      doc.addImage(logo, imgFormat(logo), L + W / 2 - opts.logoSize / 2, y, opts.logoSize, opts.logoSize * 0.36);
    } catch {
      /* ignore bad logo data */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(COMPANY.name, L + W / 2, y + (opts.showLogo && logo ? opts.logoSize * 0.36 + 4 : 6), { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${COMPANY.web}   ·   ${COMPANY.phone}`, L + W / 2, y + 16, { align: "center" });
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
      opts.showBrokerNote ? opts.brokerNote : "",
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
      opts.showHireNote ? opts.hireNote : "",
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
      opts.terms,
      rightW - 4,
    ),
    L + leftW + 2,
    y + 3,
  );
  y += drvH;

  /* ── Footer ── */
  if (opts.showFooter) {
    doc.setFontSize(6.5);
    doc.text(doc.splitTextToSize(opts.footerText, W), L + W / 2, y + 4, { align: "center" });
  }
}

/* ────────────────────────────────────────────────────────────
   Design B — "Modern" single-column note with the Clews logo.
   Carries exactly the same information as the classic ticket.
   ──────────────────────────────────────────────────────────── */

function drawModernCopy(
  doc: jsPDF,
  job: WtnJob,
  top: number,
  copyLabel: string,
  logo?: string | null,
  opts: WtnOptions = DEFAULT_WTN_OPTIONS,
) {
  const L = 10;
  const R = 200;
  const W = R - L;
  let y = top;
  const GREEN = hexToRgb(opts.accent);
  const LIGHT = tintOf(GREEN);

  const heading = (text: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...GREEN);
    doc.text(text.toUpperCase(), x, yy);
    doc.setTextColor(0, 0, 0);
  };
  const value = (text: string, x: number, yy: number, size = 8, bold = false, maxWidth?: number) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text || "", x, yy, maxWidth ? { maxWidth } : undefined);
  };
  const panel = (x: number, yy: number, w: number, h: number, tint = false) => {
    if (tint) {
      doc.setFillColor(...LIGHT);
      doc.roundedRect(x, yy, w, h, 1.2, 1.2, "F");
    }
    doc.setDrawColor(190);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, yy, w, h, 1.2, 1.2);
  };

  /* ── Header band ── */
  doc.setFillColor(...GREEN);
  doc.rect(L, y, W, 16, "F");
  const textX = opts.showLogo && logo ? L + opts.logoSize + 5 : L + 3;
  if (opts.showLogo && logo) {
    try {
      doc.addImage(logo, imgFormat(logo), L + 2, y + 2, opts.logoSize, opts.logoSize * 0.4);
    } catch {
      /* ignore bad logo data */
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(opts.title, textX, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${opts.subtitle}  ·  ${COMPANY.carrier}`, textX, y + 11.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(copyLabel, R - 2, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Ticket ${job.job_number || "—"}`, R - 2, y + 10, { align: "right" });
  doc.text(fmtDate(job.completed_at || job.scheduled_date), R - 2, y + 13.5, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 18;


  /* ── Key facts strip ── */
  const facts = [
    ["Customer O/N", job.po_number || "TBC"],
    ["Transaction", TYPE_LABELS[String(job.job_type)] || String(job.job_type || "")],
    ["Container", [job.container_size, job.container_type].filter(Boolean).join(" ")],
    ["Account", job.account_code || ""],
    ["Vehicle Reg", job.vehicle_reg || ""],
  ];
  const fw = W / facts.length;
  facts.forEach(([t, v], i) => {
    panel(L + i * fw, y, fw - 1.5, 11, true);
    heading(t, L + i * fw + 2, y + 4);
    value(String(v).slice(0, 26), L + i * fw + 2, y + 9, 8, true, fw - 5);
  });
  y += 13;

  /* ── Producer / contact / invoice ── */
  const rowH = 27;
  const boxes = [true, opts.showSiteContact, opts.showInvoiceAddress].filter(Boolean).length;
  const cw = (W - (boxes - 1) * 1.5) / boxes;
  let bx = L;
  panel(bx, y, cw, rowH);
  heading("Waste Producer / Site", bx + 2, y + 4);
  [job.customer_name || "", ...addressLines(job)].slice(0, 6).forEach((line, i) =>
    value(String(line).slice(0, 42), bx + 2, y + 8.5 + i * 3.2, 7.5),
  );
  bx += cw + 1.5;

  if (opts.showSiteContact) {
    panel(bx, y, cw, rowH);
    heading("Site Contact", bx + 2, y + 4);
    value(job.site_contact_name || "—", bx + 2, y + 9, 7.5);
    value(job.site_contact_phone || "", bx + 2, y + 13, 7.5);
    value(job.sic_code ? `SIC: ${job.sic_code}` : "SIC: —", bx + 2, y + 17, 7.5);
    value(`Office: ${COMPANY.phone}`, bx + 2, y + 21, 7.5);
    value(COMPANY.orders, bx + 2, y + 25, 6);
    bx += cw + 1.5;
  }

  if (opts.showInvoiceAddress) {
    panel(bx, y, cw, rowH);
    heading("Invoice Address", bx + 2, y + 4);
    (job.invoice_address || "")
      .split("\n")
      .slice(0, 5)
      .forEach((line, i) => value(line.trim(), bx + 2, y + 9 + i * 3.2, 7.5));
  }
  y += rowH + 2;

  /* ── Waste description ── */
  const wasteH = 16;
  const wasteW = opts.showDisposalSite ? W * 0.62 - 1.5 : W;
  panel(L, y, wasteW, wasteH, true);
  heading("EWC Code & Waste Description", L + 2, y + 4);
  value([job.ewc_code, job.waste_type].filter(Boolean).join("  —  ") || "—", L + 2, y + 9, 8.5, true, wasteW - 4);
  value(`Carrier: ${job.carrier_name || COMPANY.name}`, L + 2, y + 13.5, 7);

  if (opts.showDisposalSite) {
    panel(L + W * 0.62, y, W * 0.38, wasteH);
    heading("Disposal Site", L + W * 0.62 + 2, y + 4);
    (job.disposal_site || "Clews Recycling Ltd\nUnit 17 Hunters Lane\nRugby CV21 1EA")
      .split("\n")
      .slice(0, 3)
      .forEach((line, i) => value(line.trim(), L + W * 0.62 + 2, y + 8.5 + i * 3.2, 7.5));
  }
  y += wasteH + 2;

  /* ── Comments / directions ── */
  if (opts.showComments || opts.showDirections) {
    const cmtH = 14;
    const both = opts.showComments && opts.showDirections;
    const cWidth = both ? W / 2 - 1 : W;
    let cx = L;
    doc.setFont("helvetica", "normal");
    if (opts.showComments) {
      panel(cx, y, cWidth, cmtH);
      heading("Comments", cx + 2, y + 4);
      doc.setFontSize(7);
      doc.text(doc.splitTextToSize(job.notes || "—", cWidth - 4), cx + 2, y + 8);
      cx += cWidth + 2;
    }
    if (opts.showDirections) {
      panel(cx, y, cWidth, cmtH);
      heading("Directions", cx + 2, y + 4);
      doc.setFontSize(7);
      doc.text(doc.splitTextToSize(job.directions || "—", cWidth - 4), cx + 2, y + 8);
    }
    y += cmtH + 2;
  }

  /* ── Signatures ── */
  if (opts.showSignatures) {
    const sigH = 22;
    panel(L, y, W / 2 - 1, sigH);
    heading("Waste Producer Signature", L + 2, y + 4);
    if (job.customer_signature) {
      try {
        doc.addImage(job.customer_signature, imgFormat(job.customer_signature), L + 2, y + 5, 40, 11);
      } catch {
        /* ignore */
      }
    }
    value(`Print: ${job.customer_signoff_name || ""}`, L + 2, y + 19, 7.5);
    value(job.customer_signoff_at ? `Signed ${fmtDate(job.customer_signoff_at)}` : "", W / 2 - 4, y + 19, 6.5);

    panel(L + W / 2 + 1, y, W / 2 - 1, sigH);
    heading("Driver Signature", L + W / 2 + 3, y + 4);
    if (job.driver_signature) {
      try {
        doc.addImage(job.driver_signature, imgFormat(job.driver_signature), L + W / 2 + 3, y + 5, 40, 11);
      } catch {
        /* ignore */
      }
    }
    value(`Print: ${job.driver_signoff_name || job.driver_name || ""}`, L + W / 2 + 3, y + 19, 7.5);
    y += sigH + 1.5;
  }

  /* ── Terms & footer ── */
  doc.setFontSize(5.6);
  doc.setTextColor(90);
  const termsText = [opts.terms, opts.showHireNote ? opts.hireNote : "", opts.showBrokerNote ? opts.brokerNote : ""]
    .filter(Boolean)
    .join(" ");
  doc.text(doc.splitTextToSize(termsText, W), L, y + 3);
  if (opts.showFooter) {
    doc.setFontSize(5.8);
    doc.text(opts.footerText, L + W / 2, y + 20, { align: "center" });
  }
  doc.setTextColor(0, 0, 0);
}

/* ────────────────────────────────────────────────────────────
   Design C — "Field ticket". Recommended layout: one large,
   high-contrast ticket per copy, big type for yard/driver use,
   signature strip along the bottom, logo top-left.
   ──────────────────────────────────────────────────────────── */

function drawFieldCopy(
  doc: jsPDF,
  job: WtnJob,
  top: number,
  copyLabel: string,
  logo?: string | null,
  opts: WtnOptions = DEFAULT_WTN_OPTIONS,
) {
  const L = 10;
  const R = 200;
  const W = R - L;
  let y = top;
  const ACCENT = hexToRgb(opts.accent);
  const TINT = tintOf(ACCENT);

  const label = (t: string, x: number, yy: number, size = 6) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(110);
    doc.text(t.toUpperCase(), x, yy);
    doc.setTextColor(0);
  };
  const val = (t: string, x: number, yy: number, size = 9, bold = true, maxWidth?: number) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(t || "—", x, yy, maxWidth ? { maxWidth } : undefined);
  };
  const rule = (yy: number) => {
    doc.setDrawColor(215);
    doc.setLineWidth(0.2);
    doc.line(L, yy, R, yy);
  };

  /* Header: logo left, big ticket number right */
  if (opts.showLogo && logo) {
    try {
      doc.addImage(logo, imgFormat(logo), L, y, opts.logoSize, opts.logoSize * 0.4);
    } catch {
      /* ignore */
    }
  }
  const hx = opts.showLogo && logo ? L + opts.logoSize + 5 : L;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...ACCENT);
  doc.text(opts.title, hx, y + 5);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${opts.subtitle}  ·  ${COMPANY.name}  ·  ${COMPANY.carrier}`, hx, y + 9.5);
  doc.text(`${COMPANY.phone}  ·  ${COMPANY.web}`, hx, y + 13);

  doc.setFillColor(...ACCENT);
  doc.roundedRect(R - 46, y, 46, 15, 1.5, 1.5, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(copyLabel, R - 44, y + 4.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(job.job_number || "—", R - 44, y + 12);
  doc.setTextColor(0);
  y += 18;
  rule(y);
  y += 1;

  /* Big facts row */
  const facts: [string, string][] = [
    ["Date", fmtDate(job.completed_at || job.scheduled_date)],
    ["Transaction", TYPE_LABELS[String(job.job_type)] || String(job.job_type || "")],
    ["Container", [job.container_size, job.container_type].filter(Boolean).join(" ")],
    ["Vehicle Reg", job.vehicle_reg || ""],
    ["Customer O/N", job.po_number || "TBC"],
    ["Account", job.account_code || ""],
  ];
  const fw = W / facts.length;
  doc.setFillColor(...TINT);
  doc.roundedRect(L, y + 1, W, 13, 1.5, 1.5, "F");
  facts.forEach(([t, v], i) => {
    label(t, L + 2 + i * fw, y + 5.5);
    val(String(v).slice(0, 22), L + 2 + i * fw, y + 11, 9, true, fw - 3);
  });
  y += 17;

  /* Producer + waste */
  label("Waste Producer / Collection Site", L, y);
  const prod = [job.customer_name || "", ...addressLines(job)];
  prod.slice(0, 6).forEach((line, i) => val(String(line), L, y + 5 + i * 4, 9, i === 0, W / 2 - 6));
  const rx = L + W / 2 + 4;
  label("EWC Code & Waste Description", rx, y);
  val([job.ewc_code, job.waste_type].filter(Boolean).join("  —  "), rx, y + 5, 10, true, W / 2 - 6);
  if (opts.showDisposalSite) {
    label("Disposal Site", rx, y + 12);
    (job.disposal_site || "Clews Recycling Ltd, Unit 17 Hunters Lane, Rugby CV21 1EA")
      .split("\n")
      .slice(0, 3)
      .forEach((line, i) => val(line.trim(), rx, y + 17 + i * 4, 8, false, W / 2 - 6));
  }
  y += 30;
  rule(y);
  y += 5;

  /* Contact / invoice / comments row */
  const colW = W / 3;
  if (opts.showSiteContact) {
    label("Site Contact", L, y);
    val(job.site_contact_name || "", L, y + 5, 8);
    val(job.site_contact_phone || "", L, y + 9, 8, false);
    val(job.sic_code ? `SIC ${job.sic_code}` : "", L, y + 13, 8, false);
  }
  if (opts.showInvoiceAddress) {
    label("Invoice Address", L + colW, y);
    (job.invoice_address || "")
      .split("\n")
      .slice(0, 3)
      .forEach((line, i) => val(line.trim(), L + colW, y + 5 + i * 4, 8, false, colW - 4));
  }
  if (opts.showComments || opts.showDirections) {
    label("Comments / Directions", L + colW * 2, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(
      doc.splitTextToSize(
        [opts.showComments ? job.notes : "", opts.showDirections ? job.directions : ""].filter(Boolean).join(" — ") || "—",
        colW - 4,
      ),
      L + colW * 2,
      y + 5,
    );
  }
  y += 20;

  /* Signature strip */
  if (opts.showSignatures) {
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.4);
    doc.roundedRect(L, y, W, 24, 1.5, 1.5);
    doc.setLineWidth(0.2);
    doc.setDrawColor(215);
    doc.line(L + W / 2, y + 2, L + W / 2, y + 22);
    label("Waste Producer Signature", L + 2, y + 4.5);
    if (job.customer_signature) {
      try {
        doc.addImage(job.customer_signature, imgFormat(job.customer_signature), L + 2, y + 5.5, 45, 12);
      } catch {
        /* ignore */
      }
    }
    val(`${job.customer_signoff_name || ""}  ${job.customer_signoff_at ? fmtDate(job.customer_signoff_at) : ""}`, L + 2, y + 22, 8, false);
    label("Driver Signature", L + W / 2 + 2, y + 4.5);
    if (job.driver_signature) {
      try {
        doc.addImage(job.driver_signature, imgFormat(job.driver_signature), L + W / 2 + 2, y + 5.5, 45, 12);
      } catch {
        /* ignore */
      }
    }
    val(job.driver_signoff_name || job.driver_name || "", L + W / 2 + 2, y + 22, 8, false);
    y += 26;
  }

  /* Terms + footer */
  doc.setTextColor(110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  const terms = [opts.terms, opts.showHireNote ? opts.hireNote : "", opts.showBrokerNote ? opts.brokerNote : ""]
    .filter(Boolean)
    .join(" ");
  doc.text(doc.splitTextToSize(terms, W), L, y);
  if (opts.showFooter) {
    doc.setFontSize(5.8);
    doc.text(opts.footerText, L + W / 2, y + 16, { align: "center" });
  }
  doc.setTextColor(0);
}


export type WtnDesign = "classic" | "modern" | "field";

const DESIGN_KEY = "route_one_wtn_design";

export function getWtnDesign(): WtnDesign {
  if (typeof localStorage === "undefined") return "classic";
  const v = localStorage.getItem(DESIGN_KEY);
  return v === "modern" || v === "field" ? v : "classic";
}

export function setWtnDesign(design: WtnDesign) {
  localStorage.setItem(DESIGN_KEY, design);
}


/** Loads the Clews logo as a data URL so jsPDF can embed it. */
let logoCache: string | null | undefined;
export async function loadLogoDataUrl(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const src = (await import("@/assets/clews-logo.png")).default as string;
    const res = await fetch(src);
    const blob = await res.blob();
    logoCache = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export function buildWtnPdf(
  job: WtnJob,
  design: WtnDesign = "classic",
  logo?: string | null,
  options?: WtnOptions,
): jsPDF {
  const opts = options ?? getWtnOptions();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const draw = (top: number, label: string) => {
    if (design === "modern") drawModernCopy(doc, job, top, label, logo, opts);
    else if (design === "field") drawFieldCopy(doc, job, top, label, logo, opts);
    else drawCopy(doc, job, top, label, opts, logo);
  };

  draw(8, opts.customerCopyLabel);
  if (opts.twoCopies) {
    const split = design === "classic" ? 152 : 150;
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(10, split, 200, split);
    doc.setLineDashPattern([], 0);
    draw(156, opts.officeCopyLabel);
  }
  return doc;
}

/** Builds the note using the design + builder options chosen in RouteOne setup. */
export async function buildWtnDoc(job: WtnJob, design?: WtnDesign, options?: WtnOptions): Promise<jsPDF> {
  const chosen = design ?? getWtnDesign();
  const opts = options ?? getWtnOptions();
  const logo = opts.showLogo ? await loadLogoDataUrl() : null;
  return buildWtnPdf(job, chosen, logo, opts);
}


export const wtnFileName = (job: WtnJob) =>
  `WTN-${(job.job_number || "job").replace(/[^\w-]+/g, "")}.pdf`;

export async function downloadWtnPdf(job: WtnJob, design?: WtnDesign) {
  (await buildWtnDoc(job, design)).save(wtnFileName(job));
}

/** Opens the note in a new tab and triggers the browser print dialog. */
export async function printWtnPdf(job: WtnJob, design?: WtnDesign) {
  const doc = await buildWtnDoc(job, design);
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

