import { it } from "node:test";
import assert from "node:assert/strict";
import { nextExchangeBookingDate } from "./route-exchange-date";
const zones = [{ zone_name: "Zone 1", postcodes: ["CV23"] }, { zone_name: "Zone 2", postcodes: ["NN6"] }];
const windows = [{ zone_label: "Zone 1", skip_day: "MON", roro_day: "TUE" }, { zone_label: "Zone 2 + 3", skip_day: "WED", roro_day: "THU" }];
it("defaults skips to the next booking day for their zone", () => assert.equal(nextExchangeBookingDate({ container_type: "8yd Skip", site_postcode: "CV23 0XE" }, windows, zones, "2026-10-24"), "2026-10-26"));
it("defaults RoRos to their separate zone day including combined zones", () => assert.equal(nextExchangeBookingDate({ container_type: "35 yd Ro Ro", site_postcode: "NN6 7XY" }, windows, zones, "2026-10-24"), "2026-10-29"));
it("counts today as available, matching the booking board", () => assert.equal(nextExchangeBookingDate({ container_type: "Skip", site_postcode: "CV23 0XE" }, windows, zones, "2026-10-26"), "2026-10-26"));
it("never guesses dates for unknown zones, vehicles or TBC", () => {
  assert.equal(nextExchangeBookingDate({ container_type: "Skip", site_postcode: "XX1" }, windows, zones, "2026-10-24"), null);
  assert.equal(nextExchangeBookingDate({ container_type: "Curtain trailer", site_postcode: "CV23 0XE" }, windows, zones, "2026-10-24"), null);
  assert.equal(nextExchangeBookingDate({ container_type: "Skip", site_postcode: "CV23 0XE" }, [{ zone_label: "Zone 1", skip_day: "TBC", roro_day: "MON" }], zones, "2026-10-24"), null);
});