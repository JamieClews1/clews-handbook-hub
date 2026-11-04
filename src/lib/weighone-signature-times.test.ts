import { test } from "node:test";
import assert from "node:assert/strict";
import { signaturePrintMarkup, signatureStamp, signoffAt } from "./weighone-signature-times";

const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min).toISOString();

test("A signature keeps its original capture time while the drawing is unchanged", () => {
  const saved = at(2026, 11, 4, 16, 43);
  assert.equal(signoffAt("data:image/png;base64,AAA", { image: "data:image/png;base64,AAA", at: saved }), saved);
});

test("Re-signing stamps a fresh time and clearing the signature clears the time", () => {
  const saved = at(2026, 11, 4, 16, 43);
  const next = signoffAt("data:image/png;base64,BBB", { image: "data:image/png;base64,AAA", at: saved });
  assert.ok(next);
  assert.notEqual(next, saved);
  assert.equal(signoffAt(null, { image: "data:image/png;base64,AAA", at: saved }), null);
});

test("A signature with no recorded time still prints", () => {
  assert.equal(signatureStamp(null), "");
  assert.equal(signatureStamp("not-a-date"), "");
});

test("The printed stamp shows the signing date and time", () => {
  assert.equal(signatureStamp(at(2026, 11, 4, 16, 43)), "Signed 04/11/2026 16:43");
});

test("Printed signature markup carries the image and its small date/time line", () => {
  const markup = signaturePrintMarkup("data:image/png;base64,AAA", at(2026, 11, 4, 16, 43), "Driver signature");
  assert.ok(markup.includes('<img class="sig" src="data:image/png;base64,AAA" alt="Driver signature" />'));
  assert.ok(markup.includes('<div class="when">Signed 04/11/2026 16:43</div>'));
});

test("An unsigned box prints nothing and an undated signature prints without a stamp", () => {
  assert.equal(signaturePrintMarkup(null, at(2026, 11, 4, 16, 43), "Driver signature"), "");
  assert.equal(signaturePrintMarkup("data:image/png;base64,AAA", null, "Driver signature"), '<img class="sig" src="data:image/png;base64,AAA" alt="Driver signature" />');
});
