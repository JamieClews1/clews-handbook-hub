import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOKING_DAY_CODES,
  bookingDayDate,
  bookingDayFull,
  bookingDayLabel,
} from "./booking-day-date";

// Friday 16 October 2026 — the day the date-in-bookings rule was asked for.
const FRI_16_OCT_2026 = new Date(2026, 9, 16);

test("MON from Friday 16 Oct 2026 is Monday 19 Oct", () => {
  assert.equal(bookingDayDate("MON", FRI_16_OCT_2026)?.getDate(), 19);
  assert.equal(bookingDayLabel("MON", FRI_16_OCT_2026), "MON 19");
});

test("day codes count today as an occurrence", () => {
  const MON_19_OCT = new Date(2026, 9, 19);
  assert.equal(bookingDayLabel("MON", MON_19_OCT), "MON 19");
  assert.equal(bookingDayLabel("TUE", MON_19_OCT), "TUE 20");
  assert.equal(bookingDayLabel("SUN", MON_19_OCT), "SUN 25");
});

test("crossing into a new month adds the month", () => {
  const WED_28_OCT = new Date(2026, 9, 28);
  assert.equal(bookingDayDate("MON", WED_28_OCT)?.getMonth(), 10); // November
  assert.equal(bookingDayLabel("MON", WED_28_OCT), "MON 2 Nov");
});

test("crossing into a new year adds the year", () => {
  const THU_31_DEC = new Date(2026, 11, 31);
  assert.equal(bookingDayDate("MON", THU_31_DEC)?.getFullYear(), 2027);
  assert.equal(bookingDayLabel("MON", THU_31_DEC), "MON 4 Jan 27");
});

test("TBC and blank carry no date", () => {
  assert.equal(bookingDayDate("TBC", FRI_16_OCT_2026), null);
  assert.equal(bookingDayDate("", FRI_16_OCT_2026), null);
  assert.equal(bookingDayDate(null, FRI_16_OCT_2026), null);
  assert.equal(bookingDayLabel("TBC", FRI_16_OCT_2026), "TBC");
  assert.equal(bookingDayLabel(null, FRI_16_OCT_2026), "TBC");
});

test("every day code in the board resolves to a date except TBC", () => {
  const dated = BOOKING_DAY_CODES.filter(d => d !== "TBC");
  assert.equal(dated.length, 7);
  for (const code of dated) {
    assert.ok(bookingDayDate(code, FRI_16_OCT_2026) instanceof Date, code);
    assert.match(bookingDayLabel(code, FRI_16_OCT_2026), new RegExp(`^${code} \\d{1,2}`));
  }
});

test("tooltip spells the day out in full", () => {
  assert.equal(bookingDayFull("MON", FRI_16_OCT_2026), "Monday 19 October 2026");
  assert.equal(bookingDayFull("TBC", FRI_16_OCT_2026), undefined);
});
