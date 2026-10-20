import { it } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { canonicalPlSheetName, readPlWorkbook } from "./company-pl";

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

it("rejects files with no permitted populated tabs", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Secret", 99]]), "Payroll");
  assert.throws(() => readPlWorkbook(XLSX.write(workbook, { type: "array", bookType: "xlsx" })), /No populated/);
});