import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { afterSignInPath, detectInstallBrowser, launchScope, loadReportsAppAllows } from "./load-reports-app";

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

describe("Load Reports phone install", () => {
  it("sign-in from a Load Reports link returns to Load Reports", () => {
    assert.equal(afterSignInPath("?app=load-reports"), "/load-reports?app=load-reports");
    assert.equal(afterSignInPath(""), "/portal");
  });

  it("the sign-in page reached from Load Reports keeps the Load Reports app details", () => {
    assert.equal(launchScope("/auth", "?app=load-reports"), "load-reports");
    assert.equal(launchScope("/auth", ""), "none");
  });

  it("recognises Samsung Internet separately from Chrome", () => {
    const samsung = "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
    const chrome = "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
    assert.equal(detectInstallBrowser(samsung), "samsung");
    assert.equal(detectInstallBrowser(chrome), "chrome");
  });
});
