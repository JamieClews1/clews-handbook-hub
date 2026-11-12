/** Shared rules for the third-party (visitor / haulier) site induction. */

export const VISITOR_INDUCTION_CATEGORY = "visitor_induction";

/** A visitor induction signature stays valid for this many months. */
export const VISITOR_INDUCTION_VALID_MONTHS = 12;

export const VISIT_REASONS = [
  { value: "tipping", label: "Tipping over the weighbridge" },
  { value: "collecting", label: "Collecting material" },
  { value: "delivery", label: "Delivery" },
  { value: "contractor", label: "Contractor / maintenance work" },
  { value: "visitor", label: "Visitor / meeting" },
] as const;

export const visitReasonLabel = (value: string | null | undefined) =>
  VISIT_REASONS.find((r) => r.value === value)?.label || value || "—";

/** Date the induction needs signing again (same calendar day, 12 months later). */
export function inductionValidUntil(signedAt: string | Date): Date {
  const d = new Date(signedAt);
  const out = new Date(d);
  out.setMonth(out.getMonth() + VISITOR_INDUCTION_VALID_MONTHS);
  // Guard month overflow (e.g. 29 Feb -> 1 Mar): clamp back to last day of the target month.
  if (out.getDate() !== d.getDate()) out.setDate(0);
  return out;
}

export function isInductionCurrent(signedAt: string | Date, now: Date = new Date()): boolean {
  return inductionValidUntil(signedAt).getTime() > now.getTime();
}

/** Normalise a company name for matching ("Biffa Waste Services Ltd." -> "biffa waste services"). */
export function normaliseCompanyName(name: string | null | undefined): string {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(limited|ltd|plc|llp|uk|the|co|company|group)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pick the single customer account whose name matches the typed company.
 * Returns null when nothing or more than one account matches, so staff confirm it instead of guessing.
 */
export function matchCompanyAccount<T extends { id: string; customer_name: string | null; data_hub_customer?: string | null }>(
  typed: string,
  accounts: T[],
): T | null {
  const key = normaliseCompanyName(typed);
  if (!key) return null;
  const hits = accounts.filter(
    (a) => normaliseCompanyName(a.customer_name) === key || (a.data_hub_customer && normaliseCompanyName(a.data_hub_customer) === key),
  );
  const unique = new Map(hits.map((h) => [h.id, h]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}

/** UK registration tidy-up: upper case, single spaces. */
export const tidyRegistration = (reg: string) => reg.toUpperCase().replace(/\s+/g, " ").trim();
