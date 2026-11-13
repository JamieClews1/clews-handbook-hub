import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { containerRef, standardContainer, standardContainerName, CONTAINER_STANDARDS } from "./container-standard";
import { pricingContainerOptions } from "./booking-container-options";
import { CONTAINER_GROUPS } from "./container-taxonomy";

const ref = (w: string) => standardContainer(w)?.ref ?? null;
const priced = CONTAINER_GROUPS.flatMap(g => g.sizes.filter(s => !s.bespoke).map(s => ({ size_code: s.code, display_name: s.label, is_active: true })));

describe("agreed container standard v2", () => {
  it("merges 35 and 40 yd open Ro Ros, and 14 and 16 yd skips", () => {
    assert.equal(ref("35 yd Ro Ro"), "RO40");
    assert.equal(ref("40 Yard Roll on Roll off"), "RO40");
    assert.equal(ref("14 Yard"), "SK1416");
    assert.equal(ref("16 Yard Skip"), "SK1416");
  });
  it("drops 'Inc 3t' and 'DOM' to the plain size", () => {
    assert.equal(ref("40yd Inc 3t Ro Ro"), "RO40");
    assert.equal(ref("20yd Inc 3T Ro Ro"), "RO20");
    assert.equal(ref(".8 yd Skip DOM"), "SK08");
    assert.equal(ref("12 yd Skip DOM"), "SK12");
  });
  it("keeps 10 yd skip and 30 yd Ro Ro for old records only, never as a booking choice", () => {
    assert.equal(standardContainer("10 Yard")?.status, "history");
    assert.equal(standardContainer("30 yd Ro Ro")?.status, "history");
    assert.equal(standardContainer("10 Yard")?.stock_type, null);
    assert.equal(standardContainer("30 yd Ro Ro")?.stock_type, "25/30yd");
    const codes = CONTAINER_GROUPS.flatMap(g => g.sizes.map(s => s.code));
    assert.ok(!codes.some(c => /10yd|30yd/.test(c)));
  });
  it("12 yd ENC Asbestos and 14 yd Walk-in are bespoke skips counted in Stock Check without a price line", () => {
    assert.equal(ref("Asbestos Skip"), "SK12A");
    assert.equal(ref("14 Enclosed Skip"), "SK12A");
    assert.equal(ref("14yd Walk-in"), "SK14W");
    assert.equal(standardContainer("Asbestos")?.stock_type, "12yd ENC Asbestos");
    assert.equal(standardContainer("Walk In")?.stock_type, "14yd Walk-in");
    const skip = pricingContainerOptions(priced, "Skip");
    assert.deepEqual(skip.filter(s => s.bespoke).map(s => s.display_name), ["12 yd ENC Asbestos", "14 yd Walk-in"]);
  });
  it("old trailer-owner wordings and palletised / loose collections read as Curtain-side Trailer", () => {
    for (const w of ["Staci Trailer", "Clews Trailer", "A- Curtainside(MDA)", "Palletised Material Service", "Loose Material Service"]) assert.equal(ref(w), "ARCS", w);
  });
  it("Bale Collection is the bespoke Artic curtain-side bale collection", () => {
    assert.equal(ref("Bale Collection"), "ARCSB");
    assert.equal(standardContainerName("Bale Collection"), "Artic – Curtain Side Bale Collection");
    assert.deepEqual(pricingContainerOptions(priced, "Artic").filter(s => s.bespoke).map(s => s.size_code), ["curtain_bale"]);
  });
  it("Portapak is kept for history and hidden from new bookings", () => {
    assert.equal(ref("Bp De Kit Portapak"), "ROPP");
    assert.equal(standardContainer("Portapack Ro Ro")?.status, "history");
  });
  it("Haulage only wordings resolve to the Haulage Only job type", () => {
    for (const w of ["Ro Ro Haulage only", "Artic Haulage only", "7.5 T Haulage only", "Chain lift haulage only"]) assert.equal(ref(w), "HAUL", w);
  });
  it("Bulk, blanks and job numbers read as Not recorded with no reference code", () => {
    for (const w of ["Bulk", "", "52420", "*"]) {
      assert.equal(ref(w), "NOTC", w);
      assert.equal(containerRef(w), null);
    }
  });
  it("shared booking labels resolve to the same code", () => {
    assert.equal(containerRef("SKIP · 8 yd"), "SK08");
    assert.equal(containerRef("RORO · 35 / 40 yd"), "RO40");
    assert.equal(containerRef("Skip 12yd_asbestos"), "SK12A");
  });
  it("every reference code is unique", () => {
    assert.equal(new Set(CONTAINER_STANDARDS.map(s => s.ref)).size, CONTAINER_STANDARDS.length);
  });
});
