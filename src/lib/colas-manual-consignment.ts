/** Rules for staff filling in QuickConsign details the automatic reader couldn't read. */

export type ReaderResult = "found" | "unreadable" | "not_present" | string;

/** Tidies a typed consignment number: trims, upper-cases and removes stray spaces around the slash. */
export function normaliseConsignmentRef(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
}

/** True when the typed number looks like a QuickConsign reference (e.g. COLASR/00154). Anything else saves with a warning. */
export function looksLikeQuickConsign(ref: string): boolean {
  return /^[A-Z]{2,10}\/\d{3,8}$/.test(ref);
}

/**
 * A hazardous job needs staff input when it still has no consignment number and either
 * it is flagged as unreadable / page missing, or the reader's latest attempt didn't find a number.
 */
export function needsManualConsignment(job: { consignmentRef: string | null; consignmentIssue: string | null }, latestResult: ReaderResult | null | undefined): boolean {
  if (job.consignmentRef) return false;
  if (job.consignmentIssue) return true;
  return latestResult != null && latestResult !== "found";
}

/** Returns the other job already carrying this number, if any, so the same note is never saved on two jobs. */
export function duplicateConsignmentJob(ref: string, job: string, saved: Map<string, string | null>): string | null {
  const target = normaliseConsignmentRef(ref);
  for (const [other, value] of saved) if (other !== job && value && normaliseConsignmentRef(value) === target) return other;
  return null;
}
