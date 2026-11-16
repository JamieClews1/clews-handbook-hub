import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import clewsLogo from "@/assets/clews-logo.png";
import { loadBrandLogo, toDataUrl } from "@/lib/brand-logo";
import { COLAS_STREAMS, MONTH_NAMES, PROVIDER_LABELS, SOURCE_STATUS_LABELS, type ColasMonth, type ColasYtd, type ColasOpening } from "@/lib/colas-report";

export interface ColasReportPayload {
  month: ColasMonth;
  ytd: ColasYtd;
  yearMonths: { label: string; hazardous_t: number; non_hazardous_t: number; total_t: number; cost: number }[];
  opening: ColasOpening | null;
  reportingYearLabel: string;
  approval: { status: "open" | "approved"; approvedAt: string | null; approvedBy: string | null; outstandingReason: string | null; comments: string | null };
  generatedAt: Date;
}

const GREEN: [number, number, number] = [23, 98, 57];
const DARK: [number, number, number] = [28, 36, 33];
const MUTED: [number, number, number] = [70, 82, 78];
const LINE: [number, number, number] = [214, 221, 218];
const RED: [number, number, number] = [176, 42, 42];
const t3 = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("en-GB", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const gbp = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
const ukDate = (d: string) => { const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; };
const stamp = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const colasReportFileName = (m: ColasMonth, ext: "pdf" | "xlsx") => `Colas_Rail_Waste_Report_${m.year}-${String(m.month).padStart(2, "0")}_${MONTH_NAMES[m.month - 1]}.${ext}`;

async function logoData(): Promise<string | null> {
  const isImage = (d: string | null) => (d && /^data:image\/(png|jpe?g)/i.test(d) ? d : null);
  const brand = await loadBrandLogo().catch(() => null);
  return (brand && isImage(await toDataUrl(brand))) || isImage(await toDataUrl(clewsLogo));
}

type Col = { header: string; width: number; align?: "left" | "right" };

export async function buildColasPdf(p: ColasReportPayload): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 16;
  const logo = await logoData();
  const m = p.month;
  let y = 0;

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE); doc.line(M, H - 14, W - M, H - 14);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text(`Colas Rail – Waste report ${m.label} · Prepared by Clews Recycling Ltd`, M, H - 9);
      doc.text(`Page ${i} of ${pages}`, W - M, H - 9, { align: "right" });
    }
  };
  const newPage = () => { doc.addPage(); y = M + 4; };
  const ensure = (h: number) => { if (y + h > H - 20) newPage(); };
  const heading = (text: string) => {
    ensure(16);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...GREEN);
    doc.text(text, M, y); y += 2.5;
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.6); doc.line(M, y, M + 24, y); doc.setLineWidth(0.2);
    y += 6;
  };
  const table = (cols: Col[], rows: (string | { text: string; bold?: boolean; color?: [number, number, number] })[][], opts: { totalRows?: number[] } = {}) => {
    const total = cols.reduce((a, c) => a + c.width, 0);
    const scale = (W - 2 * M) / total;
    const xs: number[] = []; let x = M; for (const c of cols) { xs.push(x); x += c.width * scale; }
    const drawHeader = () => {
      doc.setFillColor(237, 243, 240); doc.rect(M, y - 4.6, W - 2 * M, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...DARK);
      cols.forEach((c, i) => doc.text(c.header, c.align === "right" ? xs[i] + c.width * scale - 2 : xs[i] + 2, y, { align: c.align === "right" ? "right" : "left" }));
      y += 6;
    };
    ensure(14); drawHeader();
    rows.forEach((row, ri) => {
      const cells = row.map(c => typeof c === "string" ? { text: c } : c);
      const wrapped = cells.map((c, i) => doc.splitTextToSize(c.text, cols[i].width * scale - 4) as string[]);
      const h = Math.max(...wrapped.map(w => w.length)) * 4 + 2;
      if (y + h > H - 20) { newPage(); drawHeader(); }
      const isTotal = opts.totalRows?.includes(ri);
      if (isTotal) { doc.setFillColor(246, 248, 247); doc.rect(M, y - 4, W - 2 * M, h, "F"); }
      cells.forEach((c, i) => {
        doc.setFont("helvetica", c.bold || isTotal ? "bold" : "normal"); doc.setFontSize(8.5); doc.setTextColor(...(c.color ?? DARK));
        const right = cols[i].align === "right";
        doc.text(wrapped[i], right ? xs[i] + cols[i].width * scale - 2 : xs[i] + 2, y, { align: right ? "right" : "left" });
      });
      y += h - 2;
      doc.setDrawColor(...LINE); doc.line(M, y - 2.2, W - M, y - 2.2);
      y += 2;
    });
    y += 4;
  };

  // ---------- Front page ----------
  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 6, "F");
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const lw = 60, lh = (props.height / props.width) * lw;
      doc.addImage(logo, /^data:image\/png/i.test(logo) ? "PNG" : "JPEG", M, 22, lw, Math.min(lh, 30));
    } catch { /* logo optional */ }
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...DARK);
  doc.text("Colas Rail", M, 90);
  doc.setFontSize(18); doc.setTextColor(...GREEN);
  doc.text("Monthly waste & cost report", M, 102);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(...DARK);
  const fp: [string, string][] = [
    ["Reporting month", MONTH_NAMES[m.month - 1]],
    ["Reporting year", p.reportingYearLabel],
    ["Report generated", stamp(p.generatedAt)],
    ["Status", p.approval.status === "approved" ? `Approved${p.approval.approvedAt ? ` ${stamp(new Date(p.approval.approvedAt))}` : ""}` : m.inProgress ? "Month in progress – draft" : "Draft – awaiting approval"],
    ["Prepared by", "Clews Recycling Ltd, Unit 17 Hunters Lane, Rugby CV21 1EA"],
  ];
  let fy = 122;
  for (const [k, v] of fp) {
    doc.setTextColor(...MUTED); doc.setFontSize(10); doc.text(k, M, fy);
    doc.setTextColor(...DARK); doc.setFontSize(12); doc.text(v, M + 48, fy); fy += 9;
  }
  // headline boxes
  const boxes: [string, string][] = [["Total waste", `${t3(m.total_t)} t`], ["Hazardous", `${t3(m.hazardous_t)} t`], ["Non-hazardous", `${t3(m.non_hazardous_t)} t`], ["Year to date", `${t3(p.ytd.total_t)} t`]];
  const bw = (W - 2 * M - 9) / 4;
  boxes.forEach(([k, v], i) => {
    const bx = M + i * (bw + 3);
    doc.setDrawColor(...LINE); doc.setFillColor(246, 248, 247); doc.roundedRect(bx, 182, bw, 26, 2, 2, "FD");
    doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(k, bx + 4, 190);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...DARK); doc.text(v, bx + 4, 201);
    doc.setFont("helvetica", "normal");
  });
  if (m.outstanding.length) {
    doc.setFontSize(10); doc.setTextColor(...RED);
    doc.text(doc.splitTextToSize(`Outstanding information: ${m.outstanding.length} item${m.outstanding.length === 1 ? "" : "s"} – see "Data completeness".`, W - 2 * M), M, 222);
  }

  // ---------- Monthly summary ----------
  newPage();
  heading(`Monthly waste summary – ${m.label}`);
  table([{ header: "Category", width: 70 }, { header: "Weight (tonnes)", width: 40, align: "right" }, { header: "Share", width: 30, align: "right" }], [
    ["Hazardous waste", t3(m.hazardous_t), m.total_t ? `${((m.hazardous_t / m.total_t) * 100).toFixed(1)}%` : "—"],
    ["Non-hazardous waste", t3(m.non_hazardous_t), m.total_t ? `${((m.non_hazardous_t / m.total_t) * 100).toFixed(1)}%` : "—"],
    ["Total waste", t3(m.total_t), m.total_t ? "100.0%" : "—"],
  ], { totalRows: [2] });
  if (m.missingWeights) {
    doc.setFontSize(9); doc.setTextColor(...RED);
    doc.text(`${m.missingWeights} collection${m.missingWeights === 1 ? " has" : "s have"} no recorded weight yet and ${m.missingWeights === 1 ? "is" : "are"} not included in these totals.`, M, y); y += 7;
  }

  heading("Waste breakdown by stream");
  const streamRows: any[] = []; const totals: number[] = [];
  for (const group of [false, true]) {
    streamRows.push([{ text: group ? "Hazardous" : "Non-hazardous", bold: true, color: GREEN }, "", "", "", ""]);
    for (const s of m.streams.filter(s => s.hazardous === group)) {
      if (!s.lines) continue;
      const provs = [...new Set(m.lines.filter(l => l.stream === s.key).map(l => PROVIDER_LABELS[l.provider].replace(/ \(.*\)$/, "")))].join(", ");
      streamRows.push([s.label, provs, String(s.lines), t3(s.tonnes), s.missingWeights ? { text: `${s.missingWeights} missing`, color: RED } : ""]);
    }
    totals.push(streamRows.length);
    streamRows.push([`Total ${group ? "hazardous" : "non-hazardous"}`, "", String(m.lines.filter(l => l.hazardous === group).length), t3(group ? m.hazardous_t : m.non_hazardous_t), ""]);
  }
  table([{ header: "Waste stream", width: 58 }, { header: "Collection provider", width: 52 }, { header: "Collections", width: 22, align: "right" }, { header: "Tonnes", width: 24, align: "right" }, { header: "Weights", width: 22, align: "right" }], streamRows, { totalRows: totals });

  heading("Financial summary (excluding VAT)");
  table([{ header: "Category", width: 70 }, { header: "This month", width: 40, align: "right" }, { header: "Year to date", width: 40, align: "right" }], [
    ["Hazardous waste costs", gbp(m.costs.hazardous), gbp(p.ytd.hazardous_cost)],
    ["Non-hazardous waste costs", gbp(m.costs.non_hazardous), gbp(p.ytd.non_hazardous_cost)],
    ["Total waste costs", gbp(m.costs.total), gbp(p.ytd.total_cost)],
  ], { totalRows: [2] });
  doc.setFontSize(8.5); doc.setTextColor(...MUTED);
  const costNote = m.costs.source === "sage"
    ? `Costs from Sage (ex VAT)${m.costs.adjustmentsHazardous || m.costs.adjustmentsNonHazardous ? `, including authorised adjustments of ${gbp(m.costs.adjustmentsHazardous + m.costs.adjustmentsNonHazardous)}` : ""}.`
    : "Provisional: Sage figures not yet imported – costs shown are the charges recorded on Skiptrak jobs (ex VAT).";
  doc.text(doc.splitTextToSize(costNote, W - 2 * M), M, y); y += 9;

  // ---------- YTD ----------
  heading(`Year-to-date summary – ${p.reportingYearLabel}`);
  table([{ header: "Measure", width: 80 }, { header: "Year to date", width: 50, align: "right" }], [
    ["Cumulative hazardous waste (t)", t3(p.ytd.hazardous_t)],
    ["Cumulative non-hazardous waste (t)", t3(p.ytd.non_hazardous_t)],
    ["Cumulative total waste (t)", t3(p.ytd.total_t)],
    ["Cumulative hazardous costs", gbp(p.ytd.hazardous_cost)],
    ["Cumulative non-hazardous costs", gbp(p.ytd.non_hazardous_cost)],
    ["Cumulative total costs", gbp(p.ytd.total_cost)],
  ], { totalRows: [2, 5] });
  if (p.opening && (p.opening.hazardous_t || p.opening.non_hazardous_t || p.opening.hazardous_cost || p.opening.non_hazardous_cost)) {
    doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    doc.text(`Includes opening balance: ${t3(p.opening.hazardous_t + p.opening.non_hazardous_t)} t, ${gbp(p.opening.hazardous_cost + p.opening.non_hazardous_cost)}.`, M, y); y += 7;
  }

  // chart: monthly tonnes (stacked)
  ensure(80);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...DARK);
  doc.text("Monthly waste (tonnes)", M, y); y += 4;
  const cx = M + 10, cw = W - 2 * M - 12, ch = 55, cy = y + ch;
  const maxT = Math.max(1, ...p.yearMonths.map(v => v.total_t));
  doc.setDrawColor(...LINE);
  for (let g = 0; g <= 4; g++) {
    const gy = cy - (ch * g) / 4; doc.line(cx, gy, cx + cw, gy);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(((maxT * g) / 4).toFixed(1), cx - 2, gy + 1, { align: "right" });
  }
  const bwid = cw / p.yearMonths.length;
  p.yearMonths.forEach((v, i) => {
    const bx = cx + i * bwid + bwid * 0.18, bW = bwid * 0.64;
    const hN = (v.non_hazardous_t / maxT) * ch, hH = (v.hazardous_t / maxT) * ch;
    doc.setFillColor(77, 210, 137); if (hN > 0) doc.rect(bx, cy - hN, bW, hN, "F");
    doc.setFillColor(...GREEN); if (hH > 0) doc.rect(bx, cy - hN - hH, bW, hH, "F");
    doc.setFontSize(7); doc.setTextColor(...(v.label.startsWith(MONTH_NAMES[m.month - 1].slice(0, 3)) ? GREEN : MUTED));
    doc.text(v.label, bx + bW / 2, cy + 4, { align: "center" });
  });
  y = cy + 9;
  doc.setFillColor(77, 210, 137); doc.rect(M + 10, y - 2.5, 3, 3, "F"); doc.setFontSize(8); doc.setTextColor(...DARK); doc.text("Non-hazardous", M + 15, y);
  doc.setFillColor(...GREEN); doc.rect(M + 45, y - 2.5, 3, 3, "F"); doc.text("Hazardous", M + 50, y); y += 8;

  // ---------- Completeness ----------
  heading("Data completeness");
  table([{ header: "Source", width: 52 }, { header: "Status", width: 34 }, { header: "Detail", width: 94 }], m.sources.map(s => [
    s.label, { text: SOURCE_STATUS_LABELS[s.status], color: s.status === "awaiting" || s.status === "requires_verification" ? RED : GREEN, bold: true }, [s.detail, s.note ? `Note: ${s.note}` : ""].filter(Boolean).join(" — "),
  ]));
  if (p.approval.outstandingReason || p.approval.comments) {
    doc.setFontSize(9); doc.setTextColor(...DARK);
    const txt = [p.approval.outstandingReason ? `Approved with outstanding information: ${p.approval.outstandingReason}` : "", p.approval.comments ? `Comments: ${p.approval.comments}` : ""].filter(Boolean).join("\n");
    const wr = doc.splitTextToSize(txt, W - 2 * M); ensure(wr.length * 4.5); doc.text(wr, M, y); y += wr.length * 4.5 + 4;
  }

  // ---------- Collections detail ----------
  heading("Collections in the month");
  table([{ header: "Date", width: 20 }, { header: "Ref", width: 22 }, { header: "Waste", width: 58 }, { header: "Provider", width: 36 }, { header: "Class", width: 18 }, { header: "Tonnes", width: 20, align: "right" }],
    m.lines.map(l => [ukDate(l.date), [l.reference, l.consignmentRef && l.consignmentRef !== l.reference ? l.consignmentRef : ""].filter(Boolean).join("\n"), l.description, PROVIDER_LABELS[l.provider].replace(/ \(.*\)$/, ""), l.hazardous ? "Haz" : "Non-haz",
      l.weight_t == null ? (l.needsWeight ? { text: "Missing", color: RED } : "—") as any : t3(l.weight_t)]));

  footer();
  return doc.output("blob");
}

export async function buildColasExcel(p: ColasReportPayload): Promise<Blob> {
  const m = p.month;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Clews Recycling Ltd";
  const head = (ws: ExcelJS.Worksheet, row: number) => { const r = ws.getRow(row); r.font = { bold: true }; r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDF3F0" } }; };
  const tFmt = "#,##0.000", gFmt = "£#,##0.00";

  const s = wb.addWorksheet("Summary");
  s.columns = [{ width: 42 }, { width: 18 }, { width: 18 }];
  s.addRow(["Colas Rail – Monthly waste & cost report"]).font = { bold: true, size: 14 };
  s.addRow(["Reporting month", MONTH_NAMES[m.month - 1]]);
  s.addRow(["Reporting year", p.reportingYearLabel]);
  s.addRow(["Generated", stamp(p.generatedAt)]);
  s.addRow(["Status", p.approval.status === "approved" ? "Approved" : "Draft"]);
  s.addRow([]);
  s.addRow(["Measure", "This month", "Year to date"]); head(s, s.rowCount);
  const rows: [string, number, number, string][] = [
    ["Hazardous waste (t)", m.hazardous_t, p.ytd.hazardous_t, tFmt],
    ["Non-hazardous waste (t)", m.non_hazardous_t, p.ytd.non_hazardous_t, tFmt],
    ["Total waste (t)", m.total_t, p.ytd.total_t, tFmt],
    ["Hazardous costs (ex VAT)", m.costs.hazardous, p.ytd.hazardous_cost, gFmt],
    ["Non-hazardous costs (ex VAT)", m.costs.non_hazardous, p.ytd.non_hazardous_cost, gFmt],
    ["Total costs (ex VAT)", m.costs.total, p.ytd.total_cost, gFmt],
  ];
  for (const [k, a, b, f] of rows) { const r = s.addRow([k, a, b]); r.getCell(2).numFmt = f; r.getCell(3).numFmt = f; }
  s.addRow([]);
  s.addRow([m.costs.source === "sage" ? "Costs from Sage (ex VAT), including any authorised adjustments." : "Provisional costs: Sage not yet imported – Skiptrak job charges (ex VAT)."]);
  if (m.missingWeights) s.addRow([`${m.missingWeights} collection(s) without a recorded weight are not included.`]);

  const b = wb.addWorksheet("Waste breakdown");
  b.columns = [{ header: "Classification", width: 16 }, { header: "Waste stream", width: 40 }, { header: "Collections", width: 12 }, { header: "Tonnes", width: 12 }, { header: "Missing weights", width: 16 }, { header: "Recorded charges (ex VAT)", width: 22 }];
  head(b, 1);
  for (const st of COLAS_STREAMS) {
    const x = m.streams.find(v => v.key === st.key)!;
    const r = b.addRow([st.hazardous ? "Hazardous" : "Non-hazardous", st.label, x.lines, x.tonnes, x.missingWeights, x.charges]);
    r.getCell(4).numFmt = tFmt; r.getCell(6).numFmt = gFmt;
  }

  const c = wb.addWorksheet("Collections");
  c.columns = [{ header: "Date", width: 12 }, { header: "Reference", width: 14 }, { header: "Consignment ref", width: 18 }, { header: "Provider", width: 34 }, { header: "Waste description", width: 40 }, { header: "EWC", width: 12 }, { header: "Stream", width: 32 }, { header: "Classification", width: 15 }, { header: "Tonnes", width: 10 }, { header: "Weight source", width: 14 }, { header: "Charge (ex VAT)", width: 14 }, { header: "Flags", width: 28 }];
  head(c, 1);
  for (const l of m.lines) {
    const r = c.addRow([ukDate(l.date), l.reference, l.consignmentRef ?? "", PROVIDER_LABELS[l.provider], l.description, l.ewc ?? "", COLAS_STREAMS.find(s2 => s2.key === l.stream)?.label, l.hazardous ? "Hazardous" : "Non-hazardous", l.weight_t, l.weightSource ?? "", l.charge, [l.needsWeight ? "Weight missing" : "", l.awaitingPaperwork ? "Awaiting paperwork" : ""].filter(Boolean).join(", ")]);
    r.getCell(9).numFmt = tFmt; r.getCell(11).numFmt = gFmt;
  }

  const y = wb.addWorksheet("Year to date");
  y.columns = [{ header: "Month", width: 14 }, { header: "Hazardous (t)", width: 14 }, { header: "Non-hazardous (t)", width: 18 }, { header: "Total (t)", width: 12 }, { header: "Cost (ex VAT)", width: 16 }, { header: "Cumulative total (t)", width: 20 }];
  head(y, 1);
  let cum = (p.opening?.hazardous_t ?? 0) + (p.opening?.non_hazardous_t ?? 0);
  if (cum) y.addRow(["Opening balance", p.opening?.hazardous_t, p.opening?.non_hazardous_t, cum, (p.opening?.hazardous_cost ?? 0) + (p.opening?.non_hazardous_cost ?? 0), cum]);
  for (const v of p.yearMonths) { cum += v.total_t; const r = y.addRow([v.label, v.hazardous_t, v.non_hazardous_t, v.total_t, v.cost, Math.round(cum * 1000) / 1000]); [2, 3, 4, 6].forEach(i => (r.getCell(i).numFmt = tFmt)); r.getCell(5).numFmt = gFmt; }

  const q = wb.addWorksheet("Data completeness");
  q.columns = [{ header: "Source", width: 32 }, { header: "Status", width: 22 }, { header: "Detail", width: 70 }];
  head(q, 1);
  for (const src of m.sources) q.addRow([src.label, SOURCE_STATUS_LABELS[src.status], [src.detail, src.note ? `Note: ${src.note}` : ""].filter(Boolean).join(" — ")]);
  if (p.approval.outstandingReason) q.addRow(["Approved with outstanding information", "", p.approval.outstandingReason]);
  if (p.approval.comments) q.addRow(["Comments", "", p.approval.comments]);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
