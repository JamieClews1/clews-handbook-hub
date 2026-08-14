import ExcelJS from "exceljs";
import { format, parseISO } from "date-fns";
import clewsLogo from "@/assets/clews-logo.png";
import { supabase } from "@/integrations/supabase/client";


export type CustomerExportSource = {
  name: string;
  weight: number;
  rate: number;
  rebate: number;
  source: string;
};

export type CustomerExportCategory = {
  category: string;
  weight: number;
  rebate: number;
  sources: CustomerExportSource[];
};

export type CustomerExportSiteBreakdown = {
  siteName: string;
  totalWeight: number;
  totalRebate: number;
  materials: CustomerExportSource[];
};

export type CustomerRebateExportInput = {
  customerName: string;
  siteName: string;
  periodLabel: string;
  rebateSetName?: string;
  consolidatedData: CustomerExportCategory[];
  totalWeight: number;
  totalRebate: number;
  siteBreakdowns?: CustomerExportSiteBreakdown[];
  /**
   * When provided, a separate worksheet tab is created for each individual
   * load report in the given site(s) and date range. Load report data is
   * fetched directly from Supabase (load_reports + load_line_items).
   */
  loadReportsScope?: {
    siteIds: string[];
    periodStart: string; // yyyy-MM-dd
    periodEnd: string;   // yyyy-MM-dd
    /** Weight per pallet in kg (default 20). */
    palletWeightKg?: number;
    /** £/tonne rate for the pallet weight charge (typically negative). */
    palletChargeRate?: number;
  };
};


// Brand colours (Clews / WasteOne fresh green)
const BRAND_GREEN = "FF2E7D32";
const BRAND_GREEN_LIGHT = "FFE8F3E9";
const HEADER_GREY = "FF1B3A2A";
const CHARGE_RED = "FFC62828";
const CHARGE_RED_LIGHT = "FFFBEAEA";
const ZEBRA = "FFF4F7F4";
const MUTED = "FF777777";
const BORDER_GREY = "FFE0E0E0";

const round2 = (n: number) => Math.round(n * 100) / 100;

const fmtCurrency = (n: number) => {
  const v = round2(n);
  const sign = v < 0 ? "-£" : "£";
  return `${sign}${Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtWeight = (n: number) =>
  round2(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtCalc = (s: CustomerExportSource) =>
  `${fmtWeight(s.weight)}t @ ${fmtCurrency(s.rate)} = ${fmtCurrency(s.rebate)}`;

async function fetchLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(clewsLogo);
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// Tracks the widest displayed string per column so columns can be justified to text.
class ColumnSizer {
  private widths: Record<number, number> = {};
  constructor(private min: Record<number, number> = {}) {}
  measure(col: number, text: string | number | null | undefined) {
    const len = text == null ? 0 : String(text).length;
    const current = this.widths[col] ?? this.min[col] ?? 0;
    if (len > current) this.widths[col] = len;
    else if (this.widths[col] == null) this.widths[col] = this.min[col] ?? 0;
  }
  apply(ws: ExcelJS.Worksheet, maxWidth = 60, padding = 2) {
    Object.entries(this.widths).forEach(([col, w]) => {
      ws.getColumn(Number(col)).width = Math.min(maxWidth, Math.max(this.min[Number(col)] ?? 0, w) + padding);
    });
  }
}

function addLogoHeader(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  logoBuffer: ArrayBuffer | null,
  title: string,
  subtitle: string,
  lastCol: string,
) {
  if (logoBuffer) {
    const imageId = wb.addImage({ buffer: logoBuffer, extension: "png" });
    ws.addImage(imageId, {
      tl: { col: 1, row: 0.3 },
      ext: { width: 230, height: 69 },
      editAs: "oneCell",
    });
  }
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 22;

  ws.mergeCells(`D2:${lastCol}2`);
  const titleCell = ws.getCell("D2");
  titleCell.value = title;
  titleCell.font = { name: "Calibri", size: 18, bold: true, color: { argb: BRAND_GREEN } };
  titleCell.alignment = { horizontal: "right", vertical: "middle" };

  ws.mergeCells(`D3:${lastCol}3`);
  const subCell = ws.getCell("D3");
  subCell.value = subtitle;
  subCell.font = { name: "Calibri", size: 10, color: { argb: "FF666666" } };
  subCell.alignment = { horizontal: "right", vertical: "middle" };
}

/**
 * Builds the polished, customer-facing rebate statement workbook (ExcelJS),
 * branded with the Clews Recycling logo. Returns the workbook + suggested filename.
 *
 * Sheet 1 "Total" mirrors the customer portal Total tab (Rebates / Charges split,
 * per-source breakdown, net total). Additional sheets break each load source down
 * with branded presentation.
 */
export async function buildCustomerRebateWorkbook(
  input: CustomerRebateExportInput
): Promise<{ workbook: ExcelJS.Workbook; fileName: string }> {
  const {
    customerName,
    siteName,
    periodLabel,
    rebateSetName,
    consolidatedData,
    totalWeight,
    totalRebate,
    siteBreakdowns,
  } = input;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Clews Recycling";
  wb.created = new Date();

  const logoBuffer = await fetchLogoBuffer();

  // =========================================================================
  // SHEET 1 — TOTAL (mirrors the portal Total tab)
  // =========================================================================
  const ws = wb.addWorksheet("Total", {
    views: [{ showGridLines: false }],
    pageSetup: {
      fitToPage: true,
      fitToWidth: 1,
      orientation: "landscape",
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  // Columns: A spacer | B Category | C Weight | D Sources | E Calculation | F Value
  const sizer = new ColumnSizer({ 1: 2, 2: 14, 3: 11, 4: 26, 5: 22, 6: 12 });
  ws.getColumn(1).width = 2;

  addLogoHeader(wb, ws, logoBuffer, "REBATE STATEMENT", "Clews Recycling Ltd", "F");

  // Info block
  let r = 5;
  const infoRows: [string, string][] = [
    ["Customer", customerName],
    ["Site", siteName],
    ["Period", periodLabel],
  ];
  if (rebateSetName) infoRows.push(["Rebate Set", rebateSetName]);
  infoRows.push(["Generated", format(new Date(), "d MMM yyyy")]);

  for (const [label, value] of infoRows) {
    const labelCell = ws.getCell(`B${r}`);
    labelCell.value = label;
    labelCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_GREY } };
    const valueCell = ws.getCell(`C${r}`);
    ws.mergeCells(`C${r}:F${r}`);
    valueCell.value = value;
    valueCell.font = { name: "Calibri", size: 10, color: { argb: "FF333333" } };
    valueCell.alignment = { horizontal: "left" };
    r++;
  }

  r += 1;

  // Table header
  const headers = ["", "Category", "Weight (t)", "Sources", "", "Value (£)"];
  const headerRow = ws.getRow(r);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GREEN } };
    cell.alignment = { horizontal: i === 2 || i === 5 ? "right" : "left", vertical: "middle" };
    sizer.measure(i + 1, h);
  });
  headerRow.height = 20;
  r++;

  const rebateCats = consolidatedData.filter((c) => c.rebate >= 0);
  const chargeCats = consolidatedData.filter((c) => c.rebate < 0);

  const writeSectionLabel = (label: string, isCharge: boolean) => {
    ws.mergeCells(`B${r}:F${r}`);
    const cell = ws.getCell(`B${r}`);
    cell.value = label;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: isCharge ? CHARGE_RED : BRAND_GREEN } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isCharge ? CHARGE_RED_LIGHT : BRAND_GREEN_LIGHT } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(r).height = 18;
    r++;
  };

  const writeCategoryBlock = (cat: CustomerExportCategory, zebra: boolean) => {
    const isCharge = cat.rebate < 0;
    const fill = zebra ? ZEBRA : "FFFFFFFF";
    const sources = cat.sources.length > 0 ? cat.sources : [{ name: "—", weight: cat.weight, rate: 0, rebate: cat.rebate, source: "" }];
    const startRow = r;

    sources.forEach((s, idx) => {
      const row = ws.getRow(r);

      if (idx === 0) {
        const nameCell = row.getCell(2);
        nameCell.value = cat.category;
        nameCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF222222" } };
        sizer.measure(2, cat.category);

        const wCell = row.getCell(3);
        wCell.value = round2(cat.weight);
        wCell.numFmt = "#,##0.00";
        wCell.font = { name: "Calibri", size: 10, color: { argb: "FF222222" } };
        wCell.alignment = { horizontal: "right" };
        sizer.measure(3, fmtWeight(cat.weight));

        const vCell = row.getCell(6);
        vCell.value = round2(cat.rebate);
        vCell.numFmt = '£#,##0.00;[Red]-£#,##0.00';
        vCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: isCharge ? CHARGE_RED : BRAND_GREEN } };
        vCell.alignment = { horizontal: "right" };
        sizer.measure(6, fmtCurrency(cat.rebate));
      }

      const srcCell = row.getCell(4);
      srcCell.value = s.name;
      srcCell.font = { name: "Calibri", size: 9, color: { argb: "FF555555" } };
      srcCell.alignment = { horizontal: "left" };
      sizer.measure(4, s.name);

      const calcCell = row.getCell(5);
      const calc = fmtCalc(s);
      calcCell.value = calc;
      calcCell.font = { name: "Calibri", size: 9, color: { argb: MUTED } };
      calcCell.alignment = { horizontal: "left" };
      sizer.measure(5, calc);

      [2, 3, 4, 5, 6].forEach((c) => {
        const cell = row.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      });
      r++;
    });

    // Bottom border on the last row of the block
    [2, 3, 4, 5, 6].forEach((c) => {
      ws.getRow(r - 1).getCell(c).border = { bottom: { style: "hair", color: { argb: BORDER_GREY } } };
    });
    return startRow;
  };

  const writeSubtotal = (label: string, weight: number, value: number, isCharge: boolean) => {
    const color = isCharge ? CHARGE_RED : BRAND_GREEN;
    const fill = isCharge ? CHARGE_RED_LIGHT : BRAND_GREEN_LIGHT;
    const row = ws.getRow(r);
    row.getCell(2).value = label;
    sizer.measure(2, label);
    row.getCell(3).value = round2(weight);
    row.getCell(3).numFmt = "#,##0.00";
    sizer.measure(3, fmtWeight(weight));
    row.getCell(6).value = round2(value);
    row.getCell(6).numFmt = '£#,##0.00;[Red]-£#,##0.00';
    sizer.measure(6, fmtCurrency(value));
    [2, 3, 4, 5, 6].forEach((c) => {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: color } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.alignment = { horizontal: c === 3 || c === 6 ? "right" : "left", vertical: "middle" };
      cell.border = { top: { style: "thin", color: { argb: color } } };
    });
    row.height = 18;
    r++;
  };

  const rebatesValue = rebateCats.reduce((sum, c) => sum + c.rebate, 0);
  const rebatesWeight = rebateCats.reduce((sum, c) => sum + c.weight, 0);
  const chargesValue = chargeCats.reduce((sum, c) => sum + c.rebate, 0);
  const chargesWeight = chargeCats.reduce((sum, c) => sum + c.weight, 0);

  if (rebateCats.length > 0) {
    writeSectionLabel("Rebates", false);
    rebateCats.forEach((c, i) => writeCategoryBlock(c, i % 2 === 1));
    writeSubtotal("REBATES TOTAL", rebatesWeight, rebatesValue, false);
  }
  if (chargeCats.length > 0) {
    writeSectionLabel("Charges", true);
    chargeCats.forEach((c, i) => writeCategoryBlock(c, i % 2 === 1));
    writeSubtotal("CHARGES TOTAL", chargesWeight, chargesValue, true);
  }

  // Net total
  const totalRow = ws.getRow(r);
  totalRow.getCell(2).value = "TOTAL";
  sizer.measure(2, "TOTAL");
  totalRow.getCell(3).value = round2(totalWeight);
  totalRow.getCell(3).numFmt = "#,##0.00";
  sizer.measure(3, fmtWeight(totalWeight));
  totalRow.getCell(6).value = round2(totalRebate);
  totalRow.getCell(6).numFmt = '£#,##0.00;[Red]-£#,##0.00';
  sizer.measure(6, fmtCurrency(totalRebate));
  [2, 3, 4, 5, 6].forEach((c) => {
    const cell = totalRow.getCell(c);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_GREY } };
    cell.alignment = { horizontal: c === 3 || c === 6 ? "right" : "left", vertical: "middle" };
  });
  totalRow.height = 22;
  r += 2;

  // Footer note
  ws.mergeCells(`B${r}:F${r}`);
  const noteCell = ws.getCell(`B${r}`);
  noteCell.value =
    "This statement is provided by Clews Recycling Ltd for your records. Values are inclusive of any applicable charges. Please contact your account manager with any queries.";
  noteCell.font = { name: "Calibri", size: 8, italic: true, color: { argb: "FF999999" } };
  noteCell.alignment = { horizontal: "left", wrapText: true };
  ws.getRow(r).height = 28;

  sizer.apply(ws);

  // =========================================================================
  // SHEET 2 — LOAD BREAKDOWN (per site, per material)
  // =========================================================================
  if (siteBreakdowns && siteBreakdowns.length > 0) {
    const ds = wb.addWorksheet("Load Breakdown", {
      views: [{ showGridLines: false }],
      pageSetup: {
        fitToPage: true,
        fitToWidth: 1,
        orientation: "landscape",
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      },
    });

    // Columns: A spacer | B Site | C Material | D Source/Notes | E Weight | F Rate | G Value
    const dsizer = new ColumnSizer({ 1: 2, 2: 16, 3: 24, 4: 22, 5: 11, 6: 11, 7: 12 });
    ds.getColumn(1).width = 2;

    addLogoHeader(wb, ds, logoBuffer, "LOAD BREAKDOWN", periodLabel, "G");

    let dr = 5;
    const subTitle = ds.getCell(`B${dr}`);
    ds.mergeCells(`B${dr}:G${dr}`);
    subTitle.value = `${customerName} — detailed material breakdown by site`;
    subTitle.font = { name: "Calibri", size: 11, bold: true, color: { argb: HEADER_GREY } };
    dr += 2;

    const colHeaders = ["", "Site", "Material", "Source / Notes", "Weight (t)", "Rate (£/t)", "Value (£)"];
    const dHeaderRow = ds.getRow(dr);
    colHeaders.forEach((h, i) => {
      const cell = dHeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GREEN } };
      cell.alignment = { horizontal: i >= 4 ? "right" : "left", vertical: "middle" };
      dsizer.measure(i + 1, h);
    });
    dHeaderRow.height = 20;
    dr++;

    let zebra = false;
    for (const sb of siteBreakdowns) {
      const blockStart = dr;
      const mats = sb.materials.length > 0 ? sb.materials : [];

      mats.forEach((m, idx) => {
        const row = ds.getRow(dr);
        const fill = zebra ? ZEBRA : "FFFFFFFF";
        const isCharge = m.rebate < 0;

        if (idx === 0) {
          const siteCell = row.getCell(2);
          siteCell.value = sb.siteName;
          siteCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_GREY } };
          dsizer.measure(2, sb.siteName);
        }

        const matCell = row.getCell(3);
        matCell.value = m.name;
        matCell.font = { name: "Calibri", size: 10, color: { argb: "FF222222" } };
        dsizer.measure(3, m.name);

        const srcCell = row.getCell(4);
        srcCell.value = m.source;
        srcCell.font = { name: "Calibri", size: 9, color: { argb: MUTED } };
        dsizer.measure(4, m.source);

        const wCell = row.getCell(5);
        wCell.value = round2(m.weight);
        wCell.numFmt = "#,##0.00";
        wCell.alignment = { horizontal: "right" };
        dsizer.measure(5, fmtWeight(m.weight));

        const rateCell = row.getCell(6);
        rateCell.value = round2(m.rate);
        rateCell.numFmt = '£#,##0.00;[Red]-£#,##0.00';
        rateCell.alignment = { horizontal: "right" };
        dsizer.measure(6, fmtCurrency(m.rate));

        const vCell = row.getCell(7);
        vCell.value = round2(m.rebate);
        vCell.numFmt = '£#,##0.00;[Red]-£#,##0.00';
        vCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: isCharge ? CHARGE_RED : BRAND_GREEN } };
        vCell.alignment = { horizontal: "right" };
        dsizer.measure(7, fmtCurrency(m.rebate));

        [2, 3, 4, 5, 6, 7].forEach((c) => {
          const cell = row.getCell(c);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
          cell.border = { bottom: { style: "hair", color: { argb: BORDER_GREY } } };
        });
        dr++;
        zebra = !zebra;
      });

      // Site total row
      const totRow = ds.getRow(dr);
      totRow.getCell(3).value = `${sb.siteName} Total`;
      totRow.getCell(3).font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_GREY } };
      dsizer.measure(3, `${sb.siteName} Total`);
      totRow.getCell(5).value = round2(sb.totalWeight);
      totRow.getCell(5).numFmt = "#,##0.00";
      totRow.getCell(5).alignment = { horizontal: "right" };
      dsizer.measure(5, fmtWeight(sb.totalWeight));
      totRow.getCell(7).value = round2(sb.totalRebate);
      totRow.getCell(7).numFmt = '£#,##0.00;[Red]-£#,##0.00';
      totRow.getCell(7).alignment = { horizontal: "right" };
      dsizer.measure(7, fmtCurrency(sb.totalRebate));
      [2, 3, 4, 5, 6, 7].forEach((c) => {
        const cell = totRow.getCell(c);
        cell.font = cell.font ?? { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_GREY } };
        cell.font = { ...cell.font, bold: true, color: { argb: HEADER_GREY } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GREEN_LIGHT } };
        cell.border = { top: { style: "thin", color: { argb: BRAND_GREEN } } };
      });
      totRow.height = 18;
      dr += 2;
      zebra = false;
      void blockStart;
    }

    // Grand total
    const grandRow = ds.getRow(dr);
    grandRow.getCell(2).value = "GRAND TOTAL";
    dsizer.measure(2, "GRAND TOTAL");
    grandRow.getCell(5).value = round2(totalWeight);
    grandRow.getCell(5).numFmt = "#,##0.00";
    grandRow.getCell(5).alignment = { horizontal: "right" };
    grandRow.getCell(7).value = round2(totalRebate);
    grandRow.getCell(7).numFmt = '£#,##0.00;[Red]-£#,##0.00';
    grandRow.getCell(7).alignment = { horizontal: "right" };
    [2, 3, 4, 5, 6, 7].forEach((c) => {
      const cell = grandRow.getCell(c);
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_GREY } };
      if (c === 5 || c === 7) cell.alignment = { horizontal: "right", vertical: "middle" };
    });
    grandRow.height = 22;

    dsizer.apply(ds);
  }

  // =========================================================================
  // SHEETS 3+ — INDIVIDUAL LOAD REPORT TABS
  // =========================================================================
  if (input.loadReportsScope && input.loadReportsScope.siteIds.length > 0) {
    await addIndividualLoadReportSheets(wb, input.loadReportsScope, logoBuffer);
  }

  // ---- Filename ----
  const safeCustomer = customerName.replace(/[^a-zA-Z0-9]/g, "_");
  const safeSite = siteName.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `Rebate_Statement_${safeCustomer}_${safeSite}_${format(new Date(), "yyyyMMdd")}.xlsx`;

  return { workbook: wb, fileName };
}

// -------------------------------------------------------------------------
// Individual load report sheet builder
// -------------------------------------------------------------------------
function safeSheetName(base: string, used: Set<string>): string {
  // Excel: 31 char limit, no : \ / ? * [ ]
  let name = base.replace(/[:\\/?*\[\]]/g, " ").trim().slice(0, 31) || "Load Report";
  let candidate = name;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i++})`;
    candidate = (name.slice(0, 31 - suffix.length) + suffix);
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

async function addIndividualLoadReportSheets(
  wb: ExcelJS.Workbook,
  scope: { siteIds: string[]; periodStart: string; periodEnd: string; palletWeightKg?: number; palletChargeRate?: number },
  logoBuffer: ArrayBuffer | null,
) {
  const palletWeightKg = scope.palletWeightKg ?? 20;
  const palletChargeRate = scope.palletChargeRate ?? 0;
  const { data: reports } = await supabase
    .from("load_reports")
    .select(
      "id, report_date, vehicle_reg, operator_name, notes, total_weight_kg, total_pallets, pallets_out, no_pallets_on_load, site_id"
    )
    .in("site_id", scope.siteIds)
    .gte("report_date", scope.periodStart)
    .lte("report_date", scope.periodEnd)
    .eq("status", "submitted")
    .eq("exclude_from_rebate", false)
    .order("report_date", { ascending: true });

  if (!reports || reports.length === 0) return;

  const reportIds = reports.map((r) => r.id);
  const { data: lineItems } = await supabase
    .from("load_line_items")
    .select("load_report_id, waste_type, total_weight_kg, pallet_count")
    .in("load_report_id", reportIds);

  // Load site names for header context
  const { data: siteRows } = await supabase
    .from("customer_sites")
    .select("id, site_name")
    .in("id", scope.siteIds);
  const siteNameById = new Map<string, string>((siteRows ?? []).map((s: any) => [s.id, s.site_name]));

  const itemsByReport = new Map<string, Array<{ waste_type: string; total_weight_kg: number; pallet_count: number }>>();
  for (const li of lineItems ?? []) {
    const arr = itemsByReport.get(li.load_report_id) ?? [];
    arr.push({
      waste_type: li.waste_type,
      total_weight_kg: Number(li.total_weight_kg) || 0,
      pallet_count: Number(li.pallet_count) || 0,
    });
    itemsByReport.set(li.load_report_id, arr);
  }

  const usedNames = new Set<string>(wb.worksheets.map((w) => w.name.toLowerCase()));

  for (const rep of reports) {
    const dateStr = rep.report_date ? format(parseISO(rep.report_date as unknown as string), "yyyy-MM-dd") : "";
    const veh = (rep.vehicle_reg ?? "").toString().replace(/\s+/g, "").toUpperCase();
    const baseName = `LR ${dateStr}${veh ? ` ${veh}` : ""}`.trim();
    const sheetName = safeSheetName(baseName || `LR ${rep.id.slice(0, 8)}`, usedNames);

    const ws = wb.addWorksheet(sheetName, {
      views: [{ showGridLines: false }],
      pageSetup: {
        fitToPage: true,
        fitToWidth: 1,
        orientation: "portrait",
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      },
    });

    const sizer = new ColumnSizer({ 1: 2, 2: 24, 3: 13, 4: 10, 5: 15, 6: 15 });
    ws.getColumn(1).width = 2;

    addLogoHeader(
      wb,
      ws,
      logoBuffer,
      "LOAD REPORT",
      format(new Date(), "d MMM yyyy"),
      "E",
    );

    let r = 5;
    const siteName = siteNameById.get(rep.site_id as string) ?? "";
    const infoRows: [string, string][] = [
      ["Site", siteName],
      ["Report Date", dateStr ? format(parseISO(rep.report_date as unknown as string), "d MMM yyyy") : ""],
      ["Vehicle Reg", (rep.vehicle_reg ?? "").toString()],
      ["Operator", (rep.operator_name ?? "").toString()],
      ["Total Weight (kg)", (Number(rep.total_weight_kg) || 0).toLocaleString("en-GB")],
      ["Pallets on Load", String(rep.total_pallets ?? 0)],
      ["Pallets Out", String(rep.pallets_out ?? 0)],
    ];
    for (const [label, value] of infoRows) {
      const l = ws.getCell(`B${r}`);
      l.value = label;
      l.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_GREY } };
      ws.mergeCells(`C${r}:E${r}`);
      const v = ws.getCell(`C${r}`);
      v.value = value;
      v.font = { name: "Calibri", size: 10, color: { argb: "FF333333" } };
      sizer.measure(2, label);
      sizer.measure(3, value);
      r++;
    }
    r += 1;

    // Line items table
    const headers = ["", "Waste Type", "Notes", "Weight (kg)", "Pallets"];
    const headerRow = ws.getRow(r);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GREEN } };
      cell.alignment = { horizontal: i >= 3 ? "right" : "left", vertical: "middle" };
      sizer.measure(i + 1, h);
    });
    headerRow.height = 20;
    r++;

    const items = itemsByReport.get(rep.id) ?? [];
    let totalKg = 0;
    let totalPallets = 0;
    items.forEach((item, idx) => {
      const row = ws.getRow(r);
      const fill = idx % 2 === 1 ? ZEBRA : "FFFFFFFF";
      row.getCell(2).value = item.waste_type;
      sizer.measure(2, item.waste_type);
      row.getCell(3).value = "";
      const w = row.getCell(4);
      w.value = item.total_weight_kg;
      w.numFmt = "#,##0";
      w.alignment = { horizontal: "right" };
      sizer.measure(4, item.total_weight_kg.toLocaleString("en-GB"));
      const p = row.getCell(5);
      p.value = item.pallet_count;
      p.numFmt = "#,##0";
      p.alignment = { horizontal: "right" };
      sizer.measure(5, String(item.pallet_count));
      [2, 3, 4, 5].forEach((c) => {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        row.getCell(c).border = { bottom: { style: "hair", color: { argb: BORDER_GREY } } };
      });
      totalKg += item.total_weight_kg;
      totalPallets += item.pallet_count;
      r++;
    });

    // Totals row
    if (items.length > 0) {
      const totRow = ws.getRow(r);
      totRow.getCell(2).value = "TOTAL";
      totRow.getCell(4).value = totalKg;
      totRow.getCell(4).numFmt = "#,##0";
      totRow.getCell(4).alignment = { horizontal: "right" };
      totRow.getCell(5).value = totalPallets;
      totRow.getCell(5).numFmt = "#,##0";
      totRow.getCell(5).alignment = { horizontal: "right" };
      [2, 3, 4, 5].forEach((c) => {
        const cell = totRow.getCell(c);
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_GREY } };
      });
      totRow.height = 20;
      r++;
    } else {
      const cell = ws.getCell(`B${r}`);
      cell.value = "No line items recorded on this load.";
      cell.font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
      r++;
    }

    // Pallet Weight Charge line (if pallets on load and a rate configured)
    const noPallets = Boolean((rep as any).no_pallets_on_load);
    const palletsOnLoad = noPallets ? 0 : totalPallets;
    if (palletsOnLoad > 0 && palletChargeRate !== 0) {
      const palletWeightKgTotal = palletsOnLoad * palletWeightKg;
      const palletWeightT = palletWeightKgTotal / 1000;
      const palletCharge = -Math.abs(palletWeightT * palletChargeRate);
      const pwRow = ws.getRow(r);
      pwRow.getCell(2).value = "Pallet Weight Charge";
      pwRow.getCell(3).value = `${palletsOnLoad} pallets × ${palletWeightKg}kg @ ${fmtCurrency(-Math.abs(palletChargeRate))}/t`;
      pwRow.getCell(4).value = palletWeightKgTotal;
      pwRow.getCell(4).numFmt = "#,##0";
      pwRow.getCell(4).alignment = { horizontal: "right" };
      pwRow.getCell(5).value = fmtCurrency(palletCharge);
      pwRow.getCell(5).alignment = { horizontal: "right" };
      [2, 3, 4, 5].forEach((c) => {
        const cell = pwRow.getCell(c);
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: CHARGE_RED } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CHARGE_RED_LIGHT } };
        cell.border = { top: { style: "thin", color: { argb: BORDER_GREY } }, bottom: { style: "thin", color: { argb: BORDER_GREY } } };
      });
      sizer.measure(3, `${palletsOnLoad} pallets × ${palletWeightKg}kg @ ${fmtCurrency(-Math.abs(palletChargeRate))}/t`);
      sizer.measure(5, fmtCurrency(palletCharge));
      r++;
    }

    if (rep.notes) {
      r += 1;
      const nl = ws.getCell(`B${r}`);
      nl.value = "Notes";
      nl.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_GREY } };
      r++;
      ws.mergeCells(`B${r}:E${r + 2}`);
      const nv = ws.getCell(`B${r}`);
      nv.value = rep.notes;
      nv.alignment = { wrapText: true, vertical: "top" };
      nv.font = { name: "Calibri", size: 10, color: { argb: "FF333333" } };
    }

    sizer.apply(ws);
  }
}


/**
 * Generates a polished, customer-facing rebate statement in Excel format,
 * branded with the Clews Recycling logo, and triggers a download.
 */
export async function exportCustomerRebateReport(input: CustomerRebateExportInput) {
  const { workbook, fileName } = await buildCustomerRebateWorkbook(input);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates the same customer-facing rebate statement and returns it as
 * base64 (for use as an email attachment) along with the filename.
 */
export async function getCustomerRebateExportBase64(
  input: CustomerRebateExportInput
): Promise<{ base64: string; filename: string }> {
  const { workbook, fileName } = await buildCustomerRebateWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();

  // Convert ArrayBuffer to base64 in browser
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  const base64 = btoa(binary);

  return { base64, filename: fileName };
}
