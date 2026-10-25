import { it } from "node:test";
import assert from "node:assert/strict";
import { pricingContainerOptions, bookingRentalFields, bookingRentalText } from "./booking-container-options";
const sizes = [{ size_code: "8yd", display_name: "8yd Skip", is_active: true }, { size_code: "12yd_enclosed", display_name: "12yd Enclosed", is_active: true }, { size_code: "20yd_roro", display_name: "20yd RoRo", is_active: true }];
it("sizes come only from pricing, with no invented 4YD", () => assert.deepEqual(pricingContainerOptions(sizes, "Skip").map(s => s.size_code), ["8yd"]));
it("enclosed skips offer only enclosed pricing sizes", () => assert.deepEqual(pricingContainerOptions(sizes, "Enclosed Skip").map(s => s.size_code), ["12yd_enclosed"]));
it("own container cannot enable rental", () => assert.equal(bookingRentalFields({ own_container: true, rental_enabled: true }).rental_enabled, false));
it("rental ticket retains free period and weekly charge", () => assert.equal(bookingRentalText({ rental_enabled: true, rental_free_days: 30, rental_weekly_rate: 18, rental_start_date: "2026-10-25" }), "Rental: 30 free days from 2026-10-25; £18.00 per week + VAT thereafter."));