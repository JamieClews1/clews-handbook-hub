import { it } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { canonicalPlSheetName, plSheetLabel, readPlWorkbook } from "./company-pl";

it("imports only Full set, Clews EBITDA and RFS EBITDA", () => {
  const workbook = XLSX.utils.book_new();
  for (const name of ["Full set", "Clews EBITDA", "RFS EBITDA", "Payroll", "Full set backup"]) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Income", 1234.5]]), name);
  }
  const result = readPlWorkbook(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
  assert.deepEqual(Object.keys(result.sheets), ["Full set", "Clews EBITDA", "RFS EBITDA"]);
  assert.equal(result.sheets["Full set"]?.[0]?.[1], "1234.5");
  assert.deepEqual(result.ignored, ["Payroll", "Full set backup"]);
});

it("does not accept partial matches for restricted tabs", () => {
  assert.equal(canonicalPlSheetName("Full set backup"), undefined);
  assert.equal(canonicalPlSheetName("RFS EBITDA workings"), undefined);
  assert.equal(canonicalPlSheetName(" clews ebitda "), "Clews EBITDA");
});

it("calls the division tabs Clews Only and RFS Only", () => {
  assert.equal(plSheetLabel("Clews EBITDA"), "Clews Only");
  assert.equal(plSheetLabel("RFS EBITDA"), "RFS Only");
  assert.equal(plSheetLabel("Full set"), "Full set");
  assert.equal(canonicalPlSheetName("Clews Only"), "Clews EBITDA");
  assert.equal(canonicalPlSheetName("rfs only"), "RFS EBITDA");
});

it("rejects files with no permitted populated tabs", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Secret", 99]]), "Payroll");
  assert.throws(() => readPlWorkbook(XLSX.write(workbook, { type: "array", bookType: "xlsx" })), /No populated/);
});

it("preserves source formula errors rather than importing blank values", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Margin", 1]]);
  sheet.B1 = { t: "e", v: 7, w: "#DIV/0!", f: "1/0" };
  XLSX.utils.book_append_sheet(workbook, sheet, "Full set");
  assert.equal(readPlWorkbook(XLSX.write(workbook, { type: "array", bookType: "xlsx" })).sheets["Full set"]?.[0]?.[1], "#DIV/0!");
});

it("imports workbooks whose tabs use the Clews Only and RFS Only wording", () => {
  const workbook = XLSX.utils.book_new();
  for (const name of ["Full set", "Clews Only", "RFS Only"]) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Income", 10]]), name);
  }
  const result = readPlWorkbook(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
  assert.deepEqual(Object.keys(result.sheets), ["Full set", "Clews EBITDA", "RFS EBITDA"]);
  assert.deepEqual(result.ignored, []);
});