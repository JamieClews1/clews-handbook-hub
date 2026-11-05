/** Detect a newer published build so open tabs can move onto it automatically. */

/** Dev-server injected scripts change with the tooling, not with the app build. */
const DEV_ONLY_SCRIPT = /^\/@oj\//;

function scriptSrcs(html: string): string[] {
  const out: string[] = [];
  const re = /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const src = match[1].trim();
    if (src && !DEV_ONLY_SCRIPT.test(src)) out.push(src);
  }
  return out.sort();
}

/**
 * Identity of the app shell: the module scripts the page serves.
 * Production builds hash their bundle, so a new build changes this string.
 */
export function moduleSignature(html: string): string {
  return scriptSrcs(html).join("|");
}

/**
 * Reload only when the server clearly serves different app scripts than this tab
 * is running, and only once per build so a flapping server cannot loop.
 */
export function shouldReloadForNewerBuild(
  live: string,
  fresh: string,
  reloadedFor: string | null,
): boolean {
  if (!live || !fresh) return false;
  if (live === fresh) return false;
  if (reloadedFor === fresh) return false;
  return true;
}
