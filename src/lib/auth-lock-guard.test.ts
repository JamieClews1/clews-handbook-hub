import { test } from "node:test";
import assert from "node:assert/strict";
import { contestedAuthLocks, isAuthTokenRequest, releaseStuckAuthLocks, withAuthTokenTimeout, type LockApi } from "./auth-lock-guard";

const AUTH = "lock:sb-atblyrrczwcmnyhcdkto-auth-token";

test("only a held sign-in lock with someone waiting counts as contested", () => {
  assert.deepEqual(contestedAuthLocks({ held: [{ name: AUTH }], pending: [{ name: AUTH }] }), [AUTH]);
  assert.deepEqual(contestedAuthLocks({ held: [{ name: AUTH }], pending: [] }), []);
  assert.deepEqual(contestedAuthLocks({ held: [{ name: "other" }], pending: [{ name: "other" }] }), []);
});

/** A fake lock manager whose sign-in lock is held by a paused window that never lets go. */
function stuckLocks() {
  const calls: string[] = [];
  const locks: LockApi = {
    query: async () => ({ held: [{ name: AUTH }], pending: [{ name: AUTH }] }),
    request: (_name, options, callback) => {
      if (options.steal) { calls.push("steal"); return Promise.resolve(callback()); }
      calls.push("probe");
      return new Promise((_resolve, reject) => options.signal?.addEventListener("abort", () => reject(new Error("AbortError"))));
    },
  };
  return { locks, calls };
}

test("a sign-in lock that never comes free is taken and handed on", async () => {
  const { locks, calls } = stuckLocks();
  assert.deepEqual(await releaseStuckAuthLocks(locks, 20), [AUTH]);
  assert.deepEqual(calls, ["probe", "steal"]);
});

test("a sign-in lock that is still moving is left alone", async () => {
  const calls: string[] = [];
  const locks: LockApi = {
    query: async () => ({ held: [{ name: AUTH }], pending: [{ name: AUTH }] }),
    request: async (_name, options, callback) => { calls.push(options.steal ? "steal" : "probe"); await callback(); },
  };
  assert.deepEqual(await releaseStuckAuthLocks(locks, 20), []);
  assert.deepEqual(calls, ["probe"]);
});

test("a hung session refresh is abandoned after the time limit", async () => {
  assert.equal(isAuthTokenRequest("https://x.supabase.co/auth/v1/token?grant_type=refresh_token"), true);
  assert.equal(isAuthTokenRequest("https://x.supabase.co/rest/v1/profiles"), false);
  const hanging: typeof fetch = (_i, init) =>
    new Promise<Response>((_r, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
  const wrapped = withAuthTokenTimeout(hanging, 20);
  await assert.rejects(wrapped("https://x.supabase.co/auth/v1/token?grant_type=refresh_token"), /aborted/);
});
