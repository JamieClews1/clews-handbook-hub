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

test("copied booking waste takes the standard name and EWC", async () => {
  const { standardBookingWaste } = await import("./waste-streams");
  assert.deepEqual(standardBookingWaste("Mixed Municipal Waste", "20 03 01", { source: "skiptrak" }), { waste_type: "General Waste", ewc_code: "20 03 01" });
  assert.deepEqual(standardBookingWaste("Empty Skip", "00 00 00", { source: "skiptrak" }), { waste_type: "Haulage Only", ewc_code: "" });
  assert.deepEqual(standardBookingWaste("Something new", "99 99 99"), { waste_type: "Something new", ewc_code: "99 99 99" });
});

test("rate card per-tonne lines price their standard stream", async () => {
  const { rateCardTonnageStream } = await import("./waste-streams");
  assert.equal(rateCardTonnageStream("Grade A Wood Waste")?.name, "Wood – Packaging / Pallets");
  assert.equal(rateCardTonnageStream("Grade C Wood Waste")?.name, "Wood – Construction");
  assert.equal(rateCardTonnageStream("LANDFILL: Non Recyclable")?.name, "General Waste – Non-Recoverable (Landfill)");
  assert.equal(rateCardTonnageStream("Dry Mixed Recyclables")?.ewc, "15 01 06");
  assert.equal(rateCardTonnageStream("Mixed Inert  (soils & hardcore)"), null);
  assert.equal(rateCardTonnageStream("Rental"), null);
});

test("recorded Waste Out product names show the agreed name only on their own code", () => {
  assert.equal(standardWasteName("Plastic Packaging Out", "15 01 02", { source: "midweigh", direction: "outgoing" }), "Plastic Packaging");
  assert.equal(standardWasteName("Ferrous Metals", "19 12 02", { source: "midweigh", direction: "outgoing" }), "Ferrous Metal – Out");
  assert.equal(standardWasteName("Ferrous Metals", "20 01 40", { source: "midweigh" }), "Ferrous Metals");
});

test("Haulage Only is a job type: it clears the waste and EWC, and switching away clears it again", async () => {
  const { haulageWasteFor, pickableWasteStreams } = await import("./waste-streams");
  assert.deepEqual(haulageWasteFor("haulage_only", "General Waste"), { waste_type: "Haulage Only", ewc_code: "" });
  assert.deepEqual(haulageWasteFor("delivery", "Haulage Only"), { waste_type: "", ewc_code: "" });
  assert.deepEqual(haulageWasteFor("delivery", "General Waste"), {});
  assert.ok(!pickableWasteStreams("incoming", false).some((s) => s.name === "Haulage Only"));
});
