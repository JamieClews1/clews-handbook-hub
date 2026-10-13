import { it } from "node:test";
import assert from "node:assert/strict";
import { usernameToEmail } from "./auth-utils";

it("staff username gets the company domain", () => {
  assert.equal(usernameToEmail("Ryan"), "ryan@clewsrecycling.co.uk");
});

it("full email address is used as typed (trimmed, lowercased)", () => {
  assert.equal(
    usernameToEmail(" Sean@PurelyWasteSolutions.com "),
    "sean@purelywastesolutions.com",
  );
});
