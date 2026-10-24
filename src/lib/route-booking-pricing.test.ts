import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { importedBookingPrices, bookingFuelRate, setBookingFuel } from "./route-booking-pricing";
describe("exchange pricing", () => {
  it("copies previous explicit booking prices", () => {
    const result = importedBookingPrices({ "Haulage Cost": 110, "Charge per Tonne": 195, "Weight Included": 1 });
    assert.equal(result.haulage_cost, 110); assert.equal(result.charge_per_tonne, 195); assert.equal(result.weight_included_t, 1);
  });
  it("does not mistake total or weighed charges for a per-tonne rate", () => {
    const result = importedBookingPrices({ "Haulage Cost": 110, Cost: 305, "Nett Weight": 2 });
    assert.equal(result.haulage_cost, 110); assert.equal(result.charge_per_tonne, "");
  });
  it("applies fuel optionally once and removes it without changing other prices", () => {
    const initial = [{ name: "Permit", charge: 20, qty: 1 }];
    const applied = setBookingFuel(setBookingFuel(initial, 11.58), 11.58);
    assert.deepEqual(applied, [...initial, { name: "Fuel surcharge", charge: 11.58, qty: 1 }]);
    assert.deepEqual(setBookingFuel(applied, null), initial);
  });
  it("uses the effective customer rate and refuses an unknown zone", () => {
    const rates = [{ id: "generic", active: true, vehicle_category: "RoRo" as const, zone: "Zone 1" as const, effective_from_date: "2026-04-01", surcharge_amount: 11.58 }, { id: "customer", active: true, vehicle_category: "RoRo" as const, zone: "Zone 1" as const, effective_from_date: "2026-04-01", surcharge_amount: 7, customer_match: "SUEZ" }];
    const form = { container_type: "35 yd Ro Ro", customer_name: "SUEZ", scheduled_date: "2026-10-26" };
    assert.equal(bookingFuelRate(form, "Zone 1", rates)?.surcharge_amount, 7);
    assert.equal(bookingFuelRate(form, null, rates), null);
  });
});