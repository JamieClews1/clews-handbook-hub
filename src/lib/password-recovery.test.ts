import { it } from "node:test";
import assert from "node:assert/strict";
import { isRecoveryHash, recoveryRedirectUrl, validateRecoveryPassword } from "./password-recovery";

it("customer reset returns to the public reset page on the requesting site", () => {
  assert.equal(recoveryRedirectUrl("https://portal.clewsrecycling.co.uk"), "https://portal.clewsrecycling.co.uk/reset-password");
});
it("only recovery links qualify, not ordinary sign-in or signup links", () => {
  assert.equal(isRecoveryHash("#access_token=example&type=recovery"), true);
  assert.equal(isRecoveryHash("#type=signup"), false);
  assert.equal(isRecoveryHash(""), false);
});
it("short passwords cannot be submitted", () => {
  assert.notEqual(validateRecoveryPassword("12345", "12345"), null);
  assert.equal(validateRecoveryPassword("123456", "123456"), null);
});
it("different confirmation cannot be submitted", () => {
  assert.notEqual(validateRecoveryPassword("123456", "654321"), null);
});