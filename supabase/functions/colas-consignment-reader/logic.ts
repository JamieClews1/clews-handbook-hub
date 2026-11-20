// Pure rules for the Colas Rail consignment reader (no I/O), shared with tests.

export const COLAS_CUSTOMER_PATTERN = "colas rail%";
export const CONSIGNMENT_RE = /^COLASR\/\d{5}$/;
/** Jobs read per run; keeps each run short and bounded. */
export const BATCH_SIZE = 12;
/** Scheduled runs fire at 16:00 and 17:00 UTC; only the one landing on 17:00 London time proceeds. */
export const LONDON_RUN_HOUR = 17;

export type ReadResult = "found" | "unreadable" | "not_present";
export interface AiReading { status: ReadResult; consignment_code: string | null; confidence: "high" | "medium" | "low"; evidence: string }
export interface ExistingConsignment { job_number: string; consignment_ref: string | null; read_issue: string | null }
export interface Decision {
  result: ReadResult;
  ref: string | null;
  applied: "saved" | "flagged" | "kept_existing";
  /** Row values to write to colas_consignments, or null to leave it alone. */
  write: { consignment_ref: string | null; read_issue: "unreadable" | "page_missing" | null } | null;
  evidence: string;
}

export function londonHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(now)) % 24;
}

export function normaliseEwc(code: string | null | undefined): string {
  const digits = String(code ?? "").replace(/[^0-9]/g, "");
  if (digits.length !== 6) return String(code ?? "").replace(/\*/g, "").trim();
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)}`;
}
export function isHazardousEwc(code: string | null | undefined, hazardous: Set<string>): boolean {
  if (!code) return false;
  if (String(code).includes("*")) return true;
  return hazardous.has(normaliseEwc(code));
}

/**
 * Tidies the model's answer: upper-case, no spaces, "COLASR 00185" → "COLASR/00185".
 * Colas QuickConsign codes always use the COLASR/ prefix, so a faint or smudged R read as
 * "COLAS/00187" becomes "COLASR/00187"; the five digits must still be read exactly.
 */
export function cleanCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/\s+/g, "").replace(/^COLASR?[\/\\|-]?(\d{5})$/, "COLASR/$1");
  return s || null;
}

/**
 * Decides what to save. Never overwrites a number already saved, never replaces a reading
 * problem staff chose, never saves a code that isn't exactly COLASR/ + five digits, and never
 * saves a number already recorded against another job.
 */
export function decide(reading: AiReading, existing: ExistingConsignment | undefined, refsOnOtherJobs: Map<string, string>, jobNumber: string): Decision {
  const evidence = (reading.evidence ?? "").slice(0, 500);
  if (existing?.consignment_ref) return { result: reading.status, ref: cleanCode(reading.consignment_code), applied: "kept_existing", write: null, evidence };
  let result: ReadResult = reading.status;
  let ref = cleanCode(reading.consignment_code);
  let note = evidence;
  if (result === "found") {
    if (!ref || !CONSIGNMENT_RE.test(ref) || reading.confidence !== "high") {
      note = `Not saved: reading was not certain (${ref ?? "no code"}, ${reading.confidence}). ${evidence}`;
      result = "unreadable"; ref = null;
    } else {
      const other = refsOnOtherJobs.get(ref);
      if (other && other !== jobNumber) {
        note = `Not saved: ${ref} is already recorded on job ${other}. ${evidence}`;
        result = "unreadable"; ref = null;
      }
    }
  } else ref = null;
  if (result === "found") return { result, ref, applied: "saved", write: { consignment_ref: ref, read_issue: null }, evidence: note };
  if (existing?.read_issue) return { result, ref: null, applied: "kept_existing", write: null, evidence: note };
  return { result, ref: null, applied: "flagged", write: { consignment_ref: null, read_issue: result === "not_present" ? "page_missing" : "unreadable" }, evidence: note };
}

export interface CandidateJob { job_number: string; job_date: string | null; ewc: string | null }
export interface DocRow { id: string; job_number: string; file_name: string | null; storage_path?: string | null; parse_status: string | null; created_at: string }

/** Hazardous jobs with no saved number whose newest parsed scan has not been read yet, newest first. */
export function pickCandidates(jobs: CandidateJob[], hazardous: Set<string>, existing: Map<string, ExistingConsignment>, docs: DocRow[], attempted: Set<string>, limit = BATCH_SIZE) {
  const newest = new Map<string, DocRow>();
  for (const d of docs) {
    const cur = newest.get(d.job_number);
    if (!cur || d.created_at > cur.created_at) newest.set(d.job_number, d);
  }
  const seen = new Set<string>();
  const out: { job: CandidateJob; doc: DocRow }[] = [];
  for (const j of [...jobs].sort((a, b) => String(b.job_date ?? "").localeCompare(String(a.job_date ?? "")))) {
    if (seen.has(j.job_number)) continue; seen.add(j.job_number);
    if (!isHazardousEwc(j.ewc, hazardous)) continue;
    if (existing.get(j.job_number)?.consignment_ref) continue;
    const doc = newest.get(j.job_number);
    if (!doc || doc.parse_status !== "parsed") continue;
    if (attempted.has(`${j.job_number}|${doc.id}`)) continue;
    out.push({ job: j, doc });
  }
  return { batch: out.slice(0, limit), remaining: Math.max(0, out.length - limit) };
}
