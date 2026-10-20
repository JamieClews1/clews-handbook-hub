import * as XLSX from "xlsx";

export const PL_SHEET_NAMES = ["Full set", "Clews EBITDA", "RFS EBITDA"] as const;
export type PlSheetName = (typeof PL_SHEET_NAMES)[number];
export type PlSheets = Partial<Record<PlSheetName, string[][]>>;

/**
 * Storage keys stay the workbook tab names (the imported files literally say
 * "Clews EBITDA" / "RFS EBITDA"), but staff-facing wording never calls a
 * division "EBITDA" — the reported net profit still includes depreciation and
 * bank charges, so the honest name is the division itself.
 */
export const PL_SHEET_LABELS: Record<PlSheetName, string> = {
  "Full set": "Full set",
  "Clews EBITDA": "Clews Only",
  "RFS EBITDA": "RFS Only",
};

export function plSheetLabel(name: PlSheetName): string {
  return PL_SHEET_LABELS[name];
}

/** Workbooks renamed to the staff-facing wording still import correctly. */
const PL_SHEET_ALIASES: Record<string, PlSheetName> = {
  "clews only": "Clews EBITDA",
  "rfs only": "RFS EBITDA",
};

export function canonicalPlSheetName(name: string): PlSheetName | undefined {
  const key = name.trim().toLowerCase();
  return PL_SHEET_NAMES.find((allowed) => allowed.toLowerCase() === key) ?? PL_SHEET_ALIASES[key];
}


export function readPlWorkbook(bytes: ArrayBuffer) {
  const workbook = XLSX.read(bytes, { type: "array", cellFormula: true });
  const sheets: PlSheets = {};
  let uncachedFormulas = 0;
  for (const name of workbook.SheetNames) {
    const canonical = canonicalPlSheetName(name);
    if (!canonical) continue;
    if (sheets[canonical]) throw new Error(`Duplicate ${plSheetLabel(canonical)} tabs. Rename or remove the duplicate before importing.`);
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    for (const [address, cell] of Object.entries(sheet)) {
      if (!address.startsWith("!") && cell.f && cell.v === undefined) uncachedFormulas++;
    }
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "", blankrows: true });
    // SheetJS omits error cells in JSON; preserve them so missing results
    // cannot be mistaken for zero or a genuinely empty source cell.
    const start = XLSX.utils.decode_range(sheet["!ref"] ?? "A1").s.r;
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith("!") || cell.t !== "e") continue;
      const position = XLSX.utils.decode_cell(address);
      const rowIndex = position.r - start;
      if (rowIndex < 0) continue;
      const row = rows[rowIndex] ?? [];
      row[position.c] = cell.w || "#ERROR!";
      rows[rowIndex] = row;
    }
    while (rows.length && rows[rows.length - 1]?.every((value) => !String(value).trim())) rows.pop();
    if (!rows.some((row) => row.some((value) => String(value).trim()))) continue;
    sheets[canonical] = rows.map((row) => row.map((value) => String(value)));
  }
  if (!Object.keys(sheets).length) throw new Error(`No populated ${PL_SHEET_NAMES.map(plSheetLabel).join(", ")} tabs were found.`);
  if (uncachedFormulas) throw new Error("Some formulas have no saved results. Open the workbook in Excel, recalculate and save it, then import again.");
  return { sheets, ignored: workbook.SheetNames.filter((name) => !canonicalPlSheetName(name)) };
}