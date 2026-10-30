import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { parsePlSheet, periodTotals, monthlyForecast, type PlYear } from "./pl-analysis.ts";

export function previousMonth(now = new Date()) {
  const london = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(london.find(p => p.type === "year")?.value);
  const month = Number(london.find(p => p.type === "month")?.value);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
}
export type WasteMonth = { yr: number; mo: number; direction: string; tonnes: number; jobs: number };
export function buildSnapshot(workbooks: { sheets: Record<string, string[][]>; file_name: string; imported_at: string }[], period: string, waste: WasteMonth[]) {
  const year = Number(period.slice(0, 4)), month = Number(period.slice(5, 7));
  const years = new Map<number, PlYear>();
  for (const book of workbooks) {
    const parsed = parsePlSheet(book.sheets["Full set"] ?? []);
    if (parsed && !years.has(parsed.year)) years.set(parsed.year, parsed);
  }
  const current = years.get(year), previous = years.get(year - 1);
  if (!current || !current.reportedMonths) throw new Error(`Upload the ${year} Full set P&L before generating this report.`);
  current.reportedMonths = Math.min(current.reportedMonths, month);
  const completeTotals = (y: PlYear, count: number) => {
    const keys = ["sales", "gross profit", "overheads"];
    const net = y.lines.get("net profit") ?? y.lines.get("net profit/loss") ?? y.lines.get("net profit/(loss)");
    if (!net || [...keys.map(k => y.lines.get(k)), net].some(v => !v || v.slice(0, count).length !== count || v.slice(0, count).some(n => n === null))) return null;
    return periodTotals(y, count);
  };
  const actual = completeTotals(current, current.reportedMonths);
  if (!actual) throw new Error("The P&L has missing or error values in summary rows. Correct the upload before reporting.");
  const before = previous && previous.reportedMonths >= current.reportedMonths ? completeTotals(previous, current.reportedMonths) : null;
  const forecasts = monthlyForecast(current, previous ?? current, "seasonal");
  const wasteTotal = (yr: number, direction: string) => {
    const rows = waste.filter(w => w.yr === yr && w.direction === direction && w.mo <= month);
    if (!Array.from({ length: month }, (_, i) => i + 1).every(m => rows.some(r => r.mo === m))) return null;
    return rows.reduce((s, r) => s + Number(r.tonnes), 0);
  };
  const streams = ["waste income", "recyclables", "rfs till sales", "other sales", "disposal of waste", "plant repairs"];
  const streamValues = streams.map(name => ({ name, current: current.lines.has(name) ? current.lines.get(name)?.slice(0, current.reportedMonths) : null, previous: previous?.lines.get(name)?.slice(0, current.reportedMonths) ?? null }));
  return { year, month, period, accountingMonths: current.reportedMonths, actual, previous: before, forecasts, waste, wasteTotals: { in: wasteTotal(year, "INWARD"), out: wasteTotal(year, "OUTWARD"), previousIn: wasteTotal(year - 1, "INWARD"), previousOut: wasteTotal(year - 1, "OUTWARD") }, streams: streamValues, sources: workbooks.map(b => ({ name: b.file_name, imported: b.imported_at })), warnings: [current.reportedMonths < month ? `P&L uploaded through month ${current.reportedMonths}; later months are forecasts, not actuals.` : "", !before ? "Prior-year financial comparison unavailable or incomplete." : "", "Waste is Midweigh measured inward/outward only (kg converted to tonnes); not added to Skiptrak weights. Missing waste months remain unknown.", "Forecast uses prior-year seasonality scaled by YTD sales, overhead and profit patterns, or YTD averages where prior year is incomplete. Includes one-offs; not a commitment. Volume and income periods can differ; they cannot establish a pricing cause."] .filter(Boolean) };
}
export type Snapshot = ReturnType<typeof buildSnapshot>;

export async function createReportPdf(s: Snapshot, commentary: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.086, 0.125, 0.106), green = rgb(0.12, 0.48, 0.29), muted = rgb(0.34, 0.41, 0.39);
  let page = pdf.addPage([595.28, 841.89]), y = 790;
  const safe = (t: string) => t.replace(/[–—]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E£]/g, "");
  const newPage = () => { page = pdf.addPage([595.28, 841.89]); y = 790; };
  const write = (t: string, size = 10, strong = false) => {
    const f = strong ? bold : font;
    const words = safe(t).split(/\s+/); let line = "";
    for (const word of words) {
      if (f.widthOfTextAtSize(`${line} ${word}`, size) > 499 && line) { if (y < 65) newPage(); page.drawText(line, { x: 48, y, size, font: f, color: ink }); y -= size + 5; line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (y < 65) newPage(); page.drawText(line, { x: 48, y, size, font: f, color: ink }); y -= size + 7;
  };
  const heading = (t: string) => { y -= 10; write(t, 15, true); y -= 4; };
  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const row = (cells: string[], header: boolean) => { if (y < 90) newPage(); let x = 48; cells.forEach((cell, i) => { page.drawText(safe(cell), { x, y, size: 9, font: header ? bold : font, color: header ? green : ink }); x += widths[i]; }); y -= 23; };
    row(headers, true); rows.forEach(r => row(r, false)); y -= 8;
  };
  const money = (n: number | null) => n === null ? "Unknown" : `${n < 0 ? "-" : ""}£${Math.round(Math.abs(n)).toLocaleString("en-GB")}`;
  const tonnes = (n: number | null) => n === null ? "Unknown" : `${Math.round(n).toLocaleString("en-GB")} t`;
  write(`CEO Report - ${s.period.slice(0, 7)}`, 23, true);
  write(`Clews Recycling Ltd | Full set | Confidential`, 10);
  write(`Accounting: Jan to month ${s.accountingMonths}, ${s.year}. Waste: Jan to month ${s.month}.`, 10);
  heading("Financial performance - matched year to date");
  table(["Measure", String(s.year - 1), String(s.year)], [
    ["Sales", money(s.previous?.sales ?? null), money(s.actual.sales)],
    ["Gross profit", money(s.previous?.grossProfit ?? null), money(s.actual.grossProfit)],
    ["Overheads", money(s.previous?.overheads ?? null), money(s.actual.overheads)],
    ["Net profit / loss", money(s.previous?.netProfit ?? null), money(s.actual.netProfit)],
    ["Gross margin", s.previous ? `${(s.previous.grossMargin * 100).toFixed(1)}%` : "Unknown", `${(s.actual.grossMargin * 100).toFixed(1)}%`],
  ], [215, 140, 140]);
  heading("Waste in versus waste out - measured tonnes");
  table(["Measure", String(s.year - 1), String(s.year)], [["Waste in", tonnes(s.wasteTotals.previousIn), tonnes(s.wasteTotals.in)], ["Waste out", tonnes(s.wasteTotals.previousOut), tonnes(s.wasteTotals.out)]], [215, 140, 140]);
  table(["Month", "In last year", "In this year", "Out last year", "Out this year"], Array.from({ length: s.month }, (_, i) => {
    const value = (yr: number, dir: string) => { const r = s.waste.find(w => w.yr === yr && w.mo === i + 1 && w.direction === dir); return tonnes(r ? Number(r.tonnes) : null); };
    return [new Date(Date.UTC(s.year, i, 1)).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }), value(s.year - 1, "INWARD"), value(s.year, "INWARD"), value(s.year - 1, "OUTWARD"), value(s.year, "OUTWARD")];
  }), [60, 108, 108, 108, 108]);
  newPage(); heading("Projection - every month not yet reported");
  table(["Month", "Sales", "Gross profit", "Overheads", "Net profit"], s.forecasts.map(f => [f.label, money(f.sales), money(f.grossProfit), money(f.overheads), money(f.netProfit)]), [60, 108, 108, 108, 108]);
  const projected = s.forecasts.reduce((a, f) => ({ sales: a.sales + f.sales, net: a.net + f.netProfit }), { sales: s.actual.sales, net: s.actual.netProfit });
  write(`Full-year estimate: sales ${money(projected.sales)}; net profit ${money(projected.net)}.`, 12, true);
  heading("Evidence and limitations"); s.warnings.forEach(w => write(w));
  heading("Source uploads"); s.sources.slice(0, 6).forEach(b => write(`${b.name} (imported ${b.imported.slice(0, 10)})`, 9));
  newPage(); heading("CEO commentary - Claude");
  commentary.split(/\n+/).filter(Boolean).forEach(p => write(p.replace(/^#+\s*/, ""), 11));
  for (const [i, p] of pdf.getPages().entries()) p.drawText(`Confidential | ${s.period.slice(0, 7)} | ${i + 1} / ${pdf.getPageCount()}`, { x: 48, y: 30, font, size: 8, color: muted });
  pdf.setTitle(`CEO monthly report ${s.period.slice(0, 7)}`); pdf.setAuthor("WasteOne");
  const bytes = await pdf.save(); let bin = ""; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(bin);
}