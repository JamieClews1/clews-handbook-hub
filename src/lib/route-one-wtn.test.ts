import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWtnPdf, getWtnDesign } from "./route-one-wtn";

const pdfText = (job: Record<string, unknown>) =>
  buildWtnPdf({ job_number: "RO-TEST", customer_name: "Test Co", ...job } as never, getWtnDesign()).output("arraybuffer");

const contains = (buf: ArrayBuffer, needle: string) =>
  Buffer.from(new Uint8Array(buf)).includes(needle, undefined, "latin1");

test("RouteOne WTN PDF: a test job is stamped on the note", () => {
  assert.ok(contains(pdfText({ is_test: true }), "NOT A REAL WASTE TRANSFER NOTE"));
});

test("RouteOne WTN PDF: a real job is not stamped", () => {
  assert.ok(!contains(pdfText({ is_test: false }), "NOT A REAL WASTE TRANSFER NOTE"));
});
