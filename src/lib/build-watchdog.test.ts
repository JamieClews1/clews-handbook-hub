import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleSignature, shouldReloadForNewerBuild } from "./build-watchdog.ts";

const DEV_HTML = `<!doctype html><html><head>
<script type="module" src="/@oj/refresh-preamble.js"></script>
<script type="module" src="/@oj/client.js"></script>
</head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`;

const PROD_OLD = `<html><head></head><body><div id="root"></div>
<script type="module" crossorigin src="/assets/index-abc123.js"></script></body></html>`;

const PROD_NEW = `<html><head></head><body><div id="root"></div>
<script type="module" crossorigin src="/assets/index-zyx789.js"></script></body></html>`;

test("dev preview signature ignores tooling scripts and stays stable", () => {
  const a = moduleSignature(DEV_HTML);
  const b = moduleSignature(DEV_HTML.replace("/@oj/client.js", "/@oj/client.js?v=2"));
  assert.equal(a, "/src/main.tsx");
  assert.equal(b, a);
  assert.equal(shouldReloadForNewerBuild(a, b, null), false);
});

test("a new hashed bundle triggers one reload", () => {
  const live = moduleSignature(PROD_OLD);
  const fresh = moduleSignature(PROD_NEW);
  assert.notEqual(live, fresh);
  assert.equal(shouldReloadForNewerBuild(live, fresh, null), true);
});

test("already reloaded for that build does not reload again", () => {
  const live = moduleSignature(PROD_OLD);
  const fresh = moduleSignature(PROD_NEW);
  assert.equal(shouldReloadForNewerBuild(live, fresh, fresh), false);
});

test("unchanged build never reloads", () => {
  const same = moduleSignature(PROD_NEW);
  assert.equal(shouldReloadForNewerBuild(same, same, null), false);
});

test("an unreadable page never reloads", () => {
  assert.equal(shouldReloadForNewerBuild("/assets/index-abc123.js", "", null), false);
  assert.equal(shouldReloadForNewerBuild("", "/assets/index-abc123.js", null), false);
});
