import { it } from "node:test";
import assert from "node:assert/strict";
import { cleanEmail } from "./email-clean";

it("strips a stray closing bracket pasted from Outlook", () => {
  assert.equal(cleanEmail("magda.kedzierska@yardlink.com>"), "magda.kedzierska@yardlink.com");
});

it("extracts the address from 'Name <email>'", () => {
  assert.equal(cleanEmail("Magda Kedzierska <Magda.Kedzierska@yardlink.com>"), "magda.kedzierska@yardlink.com");
});

it("returns null when there is no address", () => {
  assert.equal(cleanEmail("magda at yardlink"), null);
});
