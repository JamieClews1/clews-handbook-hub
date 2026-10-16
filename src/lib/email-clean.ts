/**
 * Pull a clean email address out of pasted text such as
 * "Magda <magda@yardlink.com>", "magda@yardlink.com>" or " mailto:magda@yardlink.com ".
 * Returns null when no valid address is present.
 */
export function cleanEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}
