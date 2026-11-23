/**
 * Keeps a stuck sign-in from freezing the whole portal on tablets and phones.
 *
 * The sign-in library guards the saved session with a browser lock that every page load and every
 * data request waits on, with no time limit. When another window of the portal on the same device
 * (a browser tab, or an installed app such as the Office App) is paused by the operating system
 * while holding that lock, or a session refresh hangs on a weak signal, the foreground window
 * waits forever and nothing loads. This guard notices a lock that is no longer moving and frees it.
 */

/** The sign-in library names its lock lock:sb-<project>-auth-token. */
export const AUTH_LOCK_NAME = /^lock:sb-.+-auth-token$/;
/** How long a contested lock may stay unavailable before it counts as stuck. */
export const PROBE_TIMEOUT_MS = 6000;
/** A hung session refresh is abandoned after this, before the portal's 12s sign-in wait gives up. */
export const AUTH_REFRESH_TIMEOUT_MS = 10000;
/** Password sign-ins may take longer on a weak signal; the sign-in screens allow up to 20s. */
export const AUTH_TOKEN_TIMEOUT_MS = 20000;

type LockEntry = { name?: string };
type Snapshot = { held?: LockEntry[]; pending?: LockEntry[] };
type LockOptions = { signal?: AbortSignal; steal?: boolean };
export type LockApi = {
  query: () => Promise<Snapshot>;
  request: (name: string, options: LockOptions, callback: () => Promise<void> | void) => Promise<unknown>;
};

/** Sign-in locks that are held while something else is waiting for them. */
export function contestedAuthLocks(snapshot: Snapshot): string[] {
  const waiting = new Set((snapshot.pending ?? []).map((l) => l.name));
  const names = (snapshot.held ?? [])
    .map((l) => l.name)
    .filter((n): n is string => !!n && AUTH_LOCK_NAME.test(n) && waiting.has(n));
  return [...new Set(names)];
}

/** Joins the queue briefly: if the lock reaches us in time, it is still moving. */
async function lockIsMoving(locks: LockApi, name: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await locks.request(name, { signal: controller.signal }, () => {});
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Frees sign-in locks that have stopped moving. Returns the names it freed. */
export async function releaseStuckAuthLocks(locks: LockApi, timeoutMs = PROBE_TIMEOUT_MS): Promise<string[]> {
  const freed: string[] = [];
  for (const name of contestedAuthLocks(await locks.query())) {
    if (await lockIsMoving(locks, name, timeoutMs)) continue;
    // Take the lock from whoever is stuck on it and hand it straight on to the waiting requests.
    await locks.request(name, { steal: true }, () => {});
    freed.push(name);
  }
  return freed;
}

/** True for the sign-in service's session refresh / password sign-in address. */
export function isAuthTokenRequest(url: string): boolean {
  return /\/auth\/v1\/token(\?|$)/.test(url);
}

/** Session refreshes get the shorter limit so a stuck one ends before the portal stops waiting. */
export function authTokenTimeout(url: string): number {
  return /grant_type=refresh_token/.test(url) ? AUTH_REFRESH_TIMEOUT_MS : AUTH_TOKEN_TIMEOUT_MS;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Wraps fetch so a hung session refresh fails after a time limit instead of blocking forever. */
export function withAuthTokenTimeout(baseFetch: typeof fetch, timeoutMs?: number): typeof fetch {
  return (input, init) => {
    const url = requestUrl(input);
    if (init?.signal || !isAuthTokenRequest(url)) return baseFetch(input, init);
    const limit = timeoutMs ?? authTokenTimeout(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limit);
    return baseFetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

let started = false;

/** Must run before the sign-in client is created, because it captures fetch when it starts. */
export function startAuthLockGuard() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.fetch = withAuthTokenTimeout(window.fetch.bind(window));

  const locks = (navigator as Navigator & { locks?: LockApi }).locks;
  if (!locks || typeof locks.query !== "function") return;
  let checking = false;
  const check = async () => {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const freed = await releaseStuckAuthLocks(locks);
      if (freed.length) console.warn("Freed a stuck sign-in lock so the portal can keep loading", freed);
    } catch {
      /* never let the guard itself break the page */
    } finally {
      checking = false;
    }
  };
  window.setInterval(check, 2000);
  document.addEventListener("visibilitychange", check);
}
