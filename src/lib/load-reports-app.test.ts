import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { launchScope, loadReportsAppAllows } from "./load-reports-app";

describe("Load Reports app lock", () => {
  it("a window opened on Load Reports is the Load Reports app", () => {
    assert.equal(launchScope("/load-reports", "?app=load-reports"), "load-reports");
    assert.equal(launchScope("/load-reports", ""), "load-reports");
  });

  it("other installed apps are not locked to Load Reports", () => {
    assert.equal(launchScope("/weigh-one", "?tablet=1"), "none");
    assert.equal(launchScope("/office", ""), "none");
    assert.equal(launchScope("/load-reports-archive", ""), "none");
  });

  it("only Load Reports screens and sign-in are allowed", () => {
    assert.equal(loadReportsAppAllows("/load-reports"), true);
    assert.equal(loadReportsAppAllows("/container-loads"), true);
    assert.equal(loadReportsAppAllows("/auth"), true);
    assert.equal(loadReportsAppAllows("/portal"), false);
    assert.equal(loadReportsAppAllows("/weigh-one"), false);
    assert.equal(loadReportsAppAllows("/admin/apps"), false);
    assert.equal(loadReportsAppAllows("/"), false);
  });
});
