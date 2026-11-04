import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  binWasteTypeLabel,
  renderChaseTemplate,
  rentalRateLabel,
  siteWithPostcode,
  type OverRentalBin,
} from "./rental-chase-email";

const bin = (extra: Partial<OverRentalBin> = {}): OverRentalBin => ({
  binKey: "site|||.8 yd skip",
  customer: "Acme Solutions Ltd",
  site: "Unit 5, Kings Road",
  postcode: "NN11 7HJ",
  category: "skip",
  containerType: ".8 yd Skip",
  netOnSite: 1,
  daysSinceActivity: 47,
  lastActivityDate: "2026-09-12",
  lastJobNumber: "48120",
  wasteTypes: ["Mixed general waste"],
  ...extra,
});

describe("Rental chase email wording", () => {
  it("names the waste type the container holds", () => {
    const body = renderChaseTemplate(
      "A {containerType} holding {wasteType} at {site}.",
      bin(),
      30,
      "£18.00 + VAT per week",
    );
    assert.equal(body, "A .8 yd Skip holding Mixed general waste at Unit 5, Kings Road, NN11 7HJ.");
  });

  it("says plainly when no waste type was recorded instead of guessing", () => {
    const body = renderChaseTemplate("Holding {wasteType}.", bin({ wasteTypes: [] }), 30, "£18.00 + VAT per week");
    assert.equal(body, "Holding waste (type not recorded).");
  });

  it("lists every waste type behind a bin holding more than one", () => {
    assert.equal(
      binWasteTypeLabel(bin({ wasteTypes: ["EWC 20 03 01", "Plasterboard"] })),
      "EWC 20 03 01 / Plasterboard",
    );
  });

  it("keeps the site and postcode once and the rate as worded", () => {
    const body = renderChaseTemplate(
      "{site} — {rate} — {days} days over {freeDays}.",
      bin({ site: "Kings Road NN11 7HJ", postcode: "NN11 7HJ" }),
      30,
      "£42.00 + VAT per week",
    );
    assert.equal(body, "Kings Road NN11 7HJ — £42.00 + VAT per week — 47 days over 30.");
  });
});

describe("Rental chase email helpers", () => {
  it("appends the postcode once to the site name", () => {
    assert.equal(siteWithPostcode(bin()), "Unit 5, Kings Road, NN11 7HJ");
    assert.equal(siteWithPostcode(bin({ site: "Kings Road NN11 7HJ" })), "Kings Road NN11 7HJ");
    assert.equal(siteWithPostcode(bin({ postcode: null })), "Unit 5, Kings Road");
  });

  it("prices RoRo at the RoRo rate and skips at the skip rate", () => {
    assert.equal(rentalRateLabel(bin({ category: "skip" }), 18, 42), "£18.00 + VAT per week");
    assert.equal(rentalRateLabel(bin({ category: "roro" }), 18, 42), "£42.00 + VAT per week");
  });
});
