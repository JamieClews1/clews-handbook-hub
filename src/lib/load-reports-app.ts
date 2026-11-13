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

export const LOAD_REPORTS_MANIFEST = "/manifest-load-reports.webmanifest";
export const LOAD_REPORTS_APP_URL = `${LOAD_REPORTS_APP_PATH}?${LOAD_REPORTS_APP_QUERY}`;
export const LOAD_REPORTS_SIGN_IN_PATH = `/auth?${LOAD_REPORTS_APP_QUERY}`;

/** Where sign-in should go next: back into Load Reports when it was opened from there. */
export function afterSignInPath(search: string): string {
  return new URLSearchParams(search).get("app") === "load-reports" ? LOAD_REPORTS_APP_URL : "/portal";
}

/**
 * Point the page at the Load Reports app details before the browser looks for them, so phone
 * browsers (Samsung Internet especially) offer "Load Reports" rather than the whole portal,
 * including on the sign-in page reached from a Load Reports link.
 */
export function applyLoadReportsManifest(): void {
  if (typeof document === "undefined") return;
  if (launchScope(window.location.pathname, window.location.search) !== "load-reports") return;
  document.querySelector('link[rel="manifest"]')?.setAttribute("href", LOAD_REPORTS_MANIFEST);
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", "Load Reports");
}

export type InstallBrowser = "samsung" | "chrome" | "other-android" | "ios" | "desktop";

/** Which browser's add-to-home-screen steps to show. */
export function detectInstallBrowser(ua: string, maxTouchPoints = 0, platform = ""): InstallBrowser {
  if (/iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) {
    if (/SamsungBrowser/i.test(ua)) return "samsung";
    if (/Chrome\//i.test(ua) && !/(EdgA|OPR|Firefox|FxiOS|; wv\))/i.test(ua)) return "chrome";
    return "other-android";
  }
  return "desktop";
}

/** Opens an app link (Load Reports by default) in Chrome from another Android browser. */
export function chromeIntentUrl(host: string, path: string = LOAD_REPORTS_APP_URL): string {
  return `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
}

/**
 * Links opened from Outlook, Gmail, WhatsApp, Teams etc. load inside that app's built-in viewer,
 * which has no menu and cannot add anything to the home screen.
 */
export function isInAppBrowser(ua: string): boolean {
  return /; wv\)|FBAN|FBAV|Instagram|WhatsApp|Line\/|GSA\/|Teams|Outlook|LinkedInApp|Snapchat/i.test(ua);
}
