import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CLEWS_PHONE, orderFileProblem, safeFileName, isValidEmail } from "./orders-portal";

describe("orders portal attachments", () => {
  it("accepts a PDF order up to 20 MB", () => {
    assert.equal(orderFileProblem({ name: "PO 12345.PDF", size: 20 * 1024 * 1024 }), null);
  });
  it("rejects files over 20 MB", () => {
    assert.match(orderFileProblem({ name: "order.pdf", size: 20 * 1024 * 1024 + 1 }) ?? "", /20 MB/);
  });
  it("rejects programs and unknown types", () => {
    assert.notEqual(orderFileProblem({ name: "setup.exe", size: 100 }), null);
  });
  it("makes storage-safe names that keep the extension", () => {
    assert.equal(safeFileName("PO #12/34 (final).pdf"), "PO_12_34_final_.pdf");
  });
  it("checks email addresses", () => {
    assert.equal(isValidEmail("orders@biffa.co.uk"), true);
    assert.equal(isValidEmail("not an email"), false);
  });
});

describe("orders portal phone prompt", () => {
  it("shows the Clews office number customers can call", () => {
    assert.equal(CLEWS_PHONE.display, "01788 541549");
    assert.equal(CLEWS_PHONE.dial, "01788541549");
  });
});
