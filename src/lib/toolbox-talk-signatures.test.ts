import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jsPDF from "jspdf";
import { appendToolboxTalkSignatures } from "./toolbox-talk-signatures";

describe("Toolbox Talk recorded signatures", () => {
  it("includes all recorded sign-offs across pages, including those without a saved image", () => {
    const pdf = new jsPDF();
    const signatures = Array.from({ length: 45 }, (_, i) => ({
      id: String(i), user_id: String(i), name: `Signer ${i}`, signed_at: "2026-10-29T14:00:00Z", signature_image: null,
    }));
    appendToolboxTalkSignatures(pdf, "Safety talk", signatures, "helvetica");
    const output = pdf.output();
    for (let i = 0; i < 45; i++) assert.ok(output.includes(`(Signer ${i})`));
    assert.ok(pdf.getNumberOfPages() > 2);
    assert.ok(output.includes("no signature image saved"));
  });
  it("does not invent signatures when nobody has signed", () => {
    const pdf = new jsPDF();
    appendToolboxTalkSignatures(pdf, "Safety talk", [], "helvetica");
    assert.ok(pdf.output().includes("No signatures have been recorded"));
    assert.ok(pdf.output().includes("0 recorded sign-offs"));
  });
});