import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { talkCoverage } from "./toolbox-talk-coverage";

const driversTalk = {
  id: "tbt-11",
  reference_code: "TBT-11",
  user_types: ["driver"],
  assigned_users: null,
  is_mandatory: true,
  created_date: "2026-11-01",
};
const yardTalk = {
  id: "tbt-12",
  reference_code: "TBT-12",
  user_types: ["yard"],
  assigned_users: null,
  is_mandatory: true,
  created_date: "2026-11-01",
};
const optionalTalk = {
  id: "tbt-6",
  reference_code: "TBT-6",
  user_types: ["driver"],
  assigned_users: null,
  is_mandatory: false,
  created_date: "2026-11-01",
};

describe("toolbox talk signing coverage", () => {
  it("counts a person as up to date only when every applicable talk is signed", () => {
    const profiles = [
      { id: "a", user_types: ["driver"] },
      { id: "b", user_types: ["driver"] },
      { id: "c", user_types: ["driver"] },
    ];
    const signatures = [
      { user_id: "a", toolbox_talk_id: "tbt-11" },
      { user_id: "a", toolbox_talk_id: "tbt-6" },
      { user_id: "b", toolbox_talk_id: "tbt-11" },
    ];

    const [drivers] = talkCoverage([driversTalk, optionalTalk], profiles, signatures, ["driver"]);

    assert.equal(drivers.people, 3);
    assert.equal(drivers.peopleUpToDate, 1);
    assert.equal(drivers.percent, 33);
    assert.equal(drivers.completion, 50);
    assert.equal(drivers.expected, 6);
    assert.equal(drivers.signed, 3);
    assert.equal(drivers.pending, 3);
    assert.equal(drivers.pendingMandatory, 1);
    assert.equal(drivers.talks, 2);
  });

  it("keeps driver and yard figures separate", () => {
    const profiles = [
      { id: "d", user_types: ["driver"] },
      { id: "y", user_types: ["yard"] },
    ];
    const signatures = [{ user_id: "d", toolbox_talk_id: "tbt-11" }];

    const [drivers, yard] = talkCoverage(
      [driversTalk, yardTalk],
      profiles,
      signatures,
      ["driver", "yard"],
    );

    assert.equal(drivers.percent, 100);
    assert.equal(drivers.completion, 100);
    assert.equal(drivers.pending, 0);
    assert.equal(yard.percent, 0);
    assert.equal(yard.completion, 0);
    assert.equal(yard.pending, 1);
    assert.equal(yard.pendingMandatory, 1);
  });

  it("ignores archived staff and staff recorded as having left", () => {
    const profiles = [
      { id: "d", user_types: ["driver"] },
      { id: "left", user_types: ["driver"], left_at: "2026-11-01" },
      { id: "archived", user_types: ["driver"], is_archived: true },
    ];

    const [drivers] = talkCoverage([driversTalk], profiles, [], ["driver"]);

    assert.equal(drivers.people, 1);
    assert.equal(drivers.expected, 1);
    assert.equal(drivers.signed, 0);
  });

  it("counts a named assignment as a talk that person must sign", () => {
    const assigned = {
      id: "tbt-2",
      reference_code: "TBT-2",
      user_types: ["office"],
      assigned_users: ["y1"],
      is_mandatory: true,
      created_date: "2026-11-01",
    };
    const profiles = [{ id: "y1", user_types: ["yard"] }];

    const [yard] = talkCoverage([yardTalk, assigned], profiles, [], ["yard"]);

    assert.equal(yard.talks, 1);
    assert.equal(yard.expected, 2);
    assert.equal(yard.pendingMandatory, 2);
    assert.equal(yard.percent, 0);
  });

  it("reports staff with nothing to sign without counting them in the percentage", () => {
    const profiles = [
      { id: "d", user_types: ["driver"] },
      { id: "o", user_types: ["office"] },
    ];
    const signatures = [{ user_id: "d", toolbox_talk_id: "tbt-11" }];

    const [drivers] = talkCoverage([driversTalk], profiles, signatures, ["driver"]);

    assert.equal(drivers.people, 1);
    assert.equal(drivers.percent, 100);
    assert.equal(drivers.noTalks, 0);
  });

  it("returns zero, not NaN, when a group has nobody", () => {
    const [yard] = talkCoverage([yardTalk], [], [], ["yard"]);
    assert.equal(yard.people, 0);
    assert.equal(yard.percent, 0);
    assert.equal(yard.completion, 0);
    assert.equal(yard.pending, 0);
  });
});
