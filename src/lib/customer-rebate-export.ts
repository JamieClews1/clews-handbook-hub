import ExcelJS from "exceljs";
import { format } from "date-fns";
import clewsLogo from "@/assets/clews-logo.png";

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

export type CustomerRebateExportInput = {
  customerName: string;
  siteName: string;
  periodLabel: string;
  rebateSetName?: string;
  consolidatedData: CustomerExportCategory[];
  totalWeight: number;
  totalRebate: number;
};

// Brand colours (Clews / WasteOne fresh green)
const BRAND_GREEN = "FF2E7D32";
const BRAND_GREEN_LIGHT = "FFE8F3E9";
const HEADER_GREY = "FF1B3A2A";
const CHARGE_RED = "FFC62828";
const ZEBRA = "FFF4F7F4";

const round2 = (n: number) => Math.round(n * 100) / 100;

async function fetchLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(clewsLogo);
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Builds the polished, customer-facing rebate statement workbook (ExcelJS),
 * branded with the Clews Recycling logo. Returns the workbook + suggested filename.
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
  } = input;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Clews Recycling";
  wb.created = new Date();

  const ws = wb.addWorksheet("Rebate Statement", {
    views: [{ showGridLines: false }],
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "portrait", margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });

  // Column widths (A..E)
  ws.columns = [
    { width: 6 },
    { width: 34 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];

  // ---- Logo header ----
  const logoBuffer = await fetchLogoBuffer();
  if (logoBuffer) {
    const imageId = wb.addImage({ buffer: logoBuffer as ArrayBuffer, extension: "png" });
    // 1000x300 native; render ~230x69px from top-left
    ws.addImage(imageId, {
      tl: { col: 1, row: 0.3 },
      ext: { width: 230, height: 69 },
      editAs: "oneCell",
    });
  }
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 22;

  // Title (right aligned)
  ws.mergeCells("D2:E2");
  const titleCell = ws.getCell("D2");
  titleCell.value = "REBATE STATEMENT";
  titleCell.font = { name: "Calibri", size: 18, bold: true, color: { argb: BRAND_GREEN } };
  titleCell.alignment = { horizontal: "right", vertical: "middle" };

  ws.mergeCells("D3:E3");
  const subCell = ws.getCell("D3");
  subCell.value = "Clews Recycling Ltd";
  subCell.font = { name: "Calibri", size: 10, color: { argb: "FF666666" } };
  subCell.alignment = { horizontal: "right", vertical: "middle" };

  // ---- Info block ----
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
    ws.mergeCells(`C${r}:E${r}`);
    valueCell.value = value;
    valueCell.font = { name: "Calibri", size: 10, color: { argb: "FF333333" } };
    valueCell.alignment = { horizontal: "left" };
    r++;
  }

  r += 1;

  // ---- Summary table header ----
  const headerRowIdx = r;
  const headers = ["", "Category", "Weight (t)", "Rate Detail", "Value (£)"];
  const headerRow = ws.getRow(headerRowIdx);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GREEN } };
    cell.alignment = { horizontal: i >= 2 ? "right" : "left", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: BRAND_GREEN } } };
  });
  // Category col header alignment
  headerRow.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
  headerRow.height = 20;
  r++;

  const rebateCats = consolidatedData.filter((c) => c.rebate >= 0);
  const chargeCats = consolidatedData.filter((c) => c.rebate < 0);

  const writeSectionLabel = (label: string) => {
    ws.mergeCells(`B${r}:E${r}`);
    const cell = ws.getCell(`B${r}`);
    cell.value = label;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: HEADER_GREY } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GREEN_LIGHT } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    r++;
  };

  const writeCategory = (cat: CustomerExportCategory, zebra: boolean) => {
    const isCharge = cat.rebate < 0;
    const row = ws.getRow(r);
    const fill = zebra ? ZEBRA : "FFFFFFFF";
    // Category name
    const nameCell = row.getCell(2);
    nameCell.value = cat.category;
    nameCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF222222" } };
    // Weight
    const wCell = row.getCell(3);
    wCell.value = round2(cat.weight);
    wCell.numFmt = "#,##0.00";
    wCell.alignment = { horizontal: "right" };
    // Rate detail (materials inside)
    const detail = cat.sources
      .map((s) => s.name)
      .join(", ");
    const dCell = row.getCell(4);
    dCell.value = detail;
    dCell.font = { name: "Calibri", size: 8, color: { argb: "FF777777" } };
    dCell.alignment = { horizontal: "left", wrapText: false };
    // Value
    const vCell = row.getCell(5);
    vCell.value = round2(cat.rebate);
    vCell.numFmt = '£#,##0.00;[Red]-£#,##0.00';
    vCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: isCharge ? CHARGE_RED : BRAND_GREEN } };
    vCell.alignment = { horizontal: "right" };

    [2, 3, 4, 5].forEach((c) => {
      const cell = row.getCell(c);
      if (!cell.font) cell.font = { name: "Calibri", size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.border = { bottom: { style: "hair", color: { argb: "FFDDDDDD" } } };
    });
    r++;
  };

  // Subtotal row writer (e.g. Rebates Total, Charges Total)
  const writeSubtotal = (label: string, weight: number, value: number, isCharge: boolean) => {
    const color = isCharge ? CHARGE_RED : BRAND_GREEN;
    const fill = isCharge ? "FFFBEAEA" : BRAND_GREEN_LIGHT;
    const row = ws.getRow(r);
    row.getCell(2).value = label;
    row.getCell(3).value = round2(weight);
    row.getCell(3).numFmt = "#,##0.00";
    row.getCell(5).value = round2(value);
    row.getCell(5).numFmt = '£#,##0.00;[Red]-£#,##0.00';
    [2, 3, 4, 5].forEach((c) => {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: color } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.alignment = { horizontal: c >= 3 ? "right" : "left", vertical: "middle" };
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
    writeSectionLabel("Rebates");
    rebateCats.forEach((c, i) => writeCategory(c, i % 2 === 1));
    writeSubtotal("Full Rebatable Value", rebatesWeight, rebatesValue, false);
  }
  if (chargeCats.length > 0) {
    writeSectionLabel("Charges");
    chargeCats.forEach((c, i) => writeCategory(c, i % 2 === 1));
    writeSubtotal("Charges Total", chargesWeight, chargesValue, true);
  }

  // ---- Net Total row ----
  const totalRow = ws.getRow(r);
  totalRow.getCell(2).value = "NET TOTAL";
  totalRow.getCell(3).value = round2(totalWeight);
  totalRow.getCell(3).numFmt = "#,##0.00";
  totalRow.getCell(5).value = round2(totalRebate);
  totalRow.getCell(5).numFmt = '£#,##0.00;[Red]-£#,##0.00';
  [2, 3, 4, 5].forEach((c) => {
    const cell = totalRow.getCell(c);
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_GREY } };
    cell.alignment = { horizontal: c >= 3 ? "right" : "left", vertical: "middle" };
  });
  totalRow.height = 22;
  r += 2;

  // ---- Footer note ----
  ws.mergeCells(`B${r}:E${r}`);
  const noteCell = ws.getCell(`B${r}`);
  noteCell.value =
    "This statement is provided by Clews Recycling Ltd for your records. Values are inclusive of any applicable charges. Please contact your account manager with any queries.";
  noteCell.font = { name: "Calibri", size: 8, italic: true, color: { argb: "FF999999" } };
  noteCell.alignment = { horizontal: "left", wrapText: true };
  ws.getRow(r).height = 28;

  // ---- Download ----
  const safeCustomer = customerName.replace(/[^a-zA-Z0-9]/g, "_");
  const safeSite = siteName.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `Rebate_Statement_${safeCustomer}_${safeSite}_${format(new Date(), "yyyyMMdd")}.xlsx`;

  return { workbook: wb, fileName };
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
