import { test } from "node:test";
import assert from "node:assert/strict";
import { chaseBelongsToRental, currentRentalChase, noteBelongsToRental, rentalRefFor } from "./rental-episode";

// Rental restarted by exchange ticket 52100 on 20 Oct 2026.
const bin = { binKey: "site a|||8yd skip", lastJobNumber: "52100", lastActivityDate: "2026-10-20" };

test("a rental is identified by the ticket that started its clock", () => {
  assert.equal(rentalRefFor(bin), "job:52100");
  assert.equal(rentalRefFor({ ...bin, lastJobNumber: null }), "date:2026-10-20");
});

test("a chase from the previous rental does not carry over to the new one", () => {
  const previous = { bin_key: bin.binKey, rental_ref: "job:51900", updated_at: "2026-11-01T10:00:00Z", chase_status: "chased" };
  assert.equal(chaseBelongsToRental(previous, bin), false);
  assert.equal(currentRentalChase([previous], bin), undefined);
});

test("the chase for the current rental is found", () => {
  const previous = { bin_key: bin.binKey, rental_ref: "job:51900", updated_at: "2026-09-01T10:00:00Z" };
  const current = { bin_key: bin.binKey, rental_ref: "job:52100", updated_at: "2026-11-10T10:00:00Z" };
  assert.equal(currentRentalChase([previous, current], bin), current);
});

test("older chases count only if worked on after the current rental started", () => {
  assert.equal(chaseBelongsToRental({ rental_ref: "legacy:2026-10-05" }, bin), false);
  assert.equal(chaseBelongsToRental({ rental_ref: "legacy:2026-10-20" }, bin), true);
});

test("notes from the previous rental are not shown on the new one", () => {
  assert.equal(noteBelongsToRental({ rental_ref: "job:51900", created_at: "2026-11-15T09:00:00Z" }, bin), false);
  assert.equal(noteBelongsToRental({ rental_ref: "job:52100", created_at: "2026-11-15T09:00:00Z" }, bin), true);
  // Notes written before per-rental tracking: matched by date.
  assert.equal(noteBelongsToRental({ rental_ref: null, created_at: "2026-10-10T09:00:00Z" }, bin), false);
  assert.equal(noteBelongsToRental({ rental_ref: null, created_at: "2026-10-21T09:00:00Z" }, bin), true);
});
