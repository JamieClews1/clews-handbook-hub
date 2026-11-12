/**
 * Installed Load Reports app lock.
 *
 * Every installed WasteOne app shares the same site, so the device remembers which app this
 * window was launched as (per window, in sessionStorage). A window launched as the Load Reports
 * app may only show Load Reports screens and sign-in; anything else sends it back to Load Reports.
 * The same person can still use the full portal in a normal browser tab.
 */
export const LOAD_REPORTS_APP_PATH = "/load-reports";
export const LOAD_REPORTS_APP_QUERY = "app=load-reports";
const SCOPE_KEY = "w1-installed-app-scope";

export type AppScope = "load-reports" | "none";

/** Which app a fresh installed window is, judged from the address it opened on. */
export function launchScope(pathname: string, search: string): AppScope {
  if (new URLSearchParams(search).get("app") === "load-reports") return "load-reports";
  if (pathname === LOAD_REPORTS_APP_PATH || pathname.startsWith(`${LOAD_REPORTS_APP_PATH}/`)) return "load-reports";
  return "none";
}

/** Screens the Load Reports app may open. */
export function loadReportsAppAllows(pathname: string): boolean {
  return ["/load-reports", "/container-loads", "/auth", "/reset-password"].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

let scope: AppScope = "none";

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Call once at start-up, before any redirects change the address. */
export function initLoadReportsAppScope(): void {
  if (typeof window === "undefined" || !isStandalone()) return;
  try {
    const stored = sessionStorage.getItem(SCOPE_KEY) as AppScope | null;
    scope = stored === "load-reports" || stored === "none"
      ? stored
      : launchScope(window.location.pathname, window.location.search);
    sessionStorage.setItem(SCOPE_KEY, scope);
  } catch {
    scope = launchScope(window.location.pathname, window.location.search);
  }
}

export function isLoadReportsAppMode(): boolean {
  return scope === "load-reports";
}
