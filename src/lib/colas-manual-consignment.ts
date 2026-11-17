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

export type RestoreIssue = "unreadable" | "page_missing" | null;

export type ConsignmentMovePlan =
  | { error: string }
  | {
      /** The job the number was typed on by mistake: number removed, reading flag restored so it stays an open issue. */
      clearFrom: { job_number: string; source: "skiptrak"; consignment_ref: null; read_issue: RestoreIssue; auto_read_at: null; auto_evidence: null };
      /** The job the number really belongs to. Its own note is kept. */
      setTo: { job_number: string; source: "skiptrak"; consignment_ref: string; read_issue: null; auto_read_at: null; auto_evidence: null };
    };

/**
 * Moves a consignment number saved on the wrong job to the right one.
 * Refuses unknown target jobs, a target that already has a different number,
 * and a number already used on some third job, so a correction can never create a duplicate.
 */
export function planConsignmentMove(input: {
  fromJob: string; toJob: string; ref: string | null; restoreIssue: RestoreIssue;
  saved: Map<string, string | null>; knownJobs: Set<string>;
}): ConsignmentMovePlan {
  const from = input.fromJob.trim();
  const to = input.toJob.trim();
  const ref = input.ref ? normaliseConsignmentRef(input.ref) : "";
  if (!ref) return { error: `Job ${from} has no consignment number to move.` };
  if (!to) return { error: "Type the job number it should be on." };
  if (to === from) return { error: "That is the same job." };
  if (!input.knownJobs.has(to)) return { error: `Job ${to} isn't a hazardous Colas Rail job. Check the job number.` };
  const existing = input.saved.get(to);
  if (existing && normaliseConsignmentRef(existing) !== ref) return { error: `Job ${to} already has ${existing}. Correct that job first.` };
  for (const [job, value] of input.saved) {
    if (job !== from && job !== to && value && normaliseConsignmentRef(value) === ref) return { error: `${ref} is also saved on job ${job}. Check the number before moving it.` };
  }
  return {
    clearFrom: { job_number: from, source: "skiptrak", consignment_ref: null, read_issue: input.restoreIssue, auto_read_at: null, auto_evidence: null },
    setTo: { job_number: to, source: "skiptrak", consignment_ref: ref, read_issue: null, auto_read_at: null, auto_evidence: null },
  };
}
