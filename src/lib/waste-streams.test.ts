import { test } from "node:test";
import assert from "node:assert/strict";
import { formatEwc, resolveWasteStream, standardWasteName, wasteStreamByRef, HAULAGE_ONLY_REF } from "./waste-streams";

test("General Waste is 20 03 01 and Construction & Demolition is 17 09 04", () => {
  assert.equal(wasteStreamByRef("GEN")?.ewc, "20 03 01");
  assert.equal(wasteStreamByRef("CD")?.ewc, "17 09 04");
  assert.equal(standardWasteName("Mixed Municipal Waste", "20 03 01", { source: "skiptrak" }), "General Waste");
  assert.equal(standardWasteName("GENERAL WASTE: Min 60% Recoverable", "17 09 04"), "Construction & Demolition");
});

test("Tyres – Out uses 19 12 04 as agreed", () => {
  assert.equal(wasteStreamByRef("O-TYRE")?.ewc, "19 12 04");
});

test("Empty Skip is shown as Haulage Only", () => {
  assert.equal(resolveWasteStream({ name: "Empty Skip", ewc: "00 00 00", source: "skiptrak" })?.ref, HAULAGE_ONLY_REF);
});

test("same name on different EWCs maps to different streams", () => {
  assert.equal(standardWasteName("Plastics", "17 02 03", { source: "skiptrak" }), "Plastics (construction)");
  assert.equal(standardWasteName("Plastics", "20 01 39", { source: "skiptrak" }), "Plastics (household)");
});

test("unknown wording is shown as recorded", () => {
  assert.equal(standardWasteName("Something new", "99 99 99"), "Something new");
});

test("hazardous codes always show the *", () => {
  assert.equal(formatEwc("15 02 02"), "15 02 02*");
  assert.equal(formatEwc("150202"), "15 02 02*");
  assert.equal(formatEwc("15 02 02*"), "15 02 02*");
  assert.equal(formatEwc("17 02 01"), "17 02 01");
  assert.equal(formatEwc("Varied"), "Varied");
});

test("a booking's old wording finds the renamed price line", async () => {
  const { findSameWasteStream } = await import("./waste-streams");
  const lines = [{ id: "a", waste_type: "General Waste", ewc_code: "20 03 01" }, { id: "b", waste_type: "Construction & Demolition", ewc_code: "17 09 04" }];
  const hit = findSameWasteStream(lines, (l) => ({ name: l.waste_type, ewc: l.ewc_code }), "Mixed Municipal Waste", "20 03 01", { source: "skiptrak" });
  assert.equal(hit?.id, "a");
});

test("searching old wording finds the standard stream", async () => {
  const { pickableWasteStreams, searchWasteStreams } = await import("./waste-streams");
  const hits = searchWasteStreams(pickableWasteStreams("incoming"), "mixed municipal").map((s) => s.name);
  assert.ok(hits.includes("General Waste"));
});
