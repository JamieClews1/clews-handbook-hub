export type PermitPricingRow = {
  id: string;
  area: string;
  postcodes: string;
  permit_days: number;
  price_exc_vat: number;
  price_inc_vat: number;
  notice_required: string | null;
  sort_order: number;
  active: boolean;
};

export type PermitApplication = {
  id: string;
  route_one_job_id: string | null;
  job_number: string | null;
  customer_name: string | null;
  site_address: string | null;
  site_postcode: string | null;
  area: string | null;
  pricing_id: string | null;
  notice_required: string | null;
  permit_days: number | null;
  price_exc_vat: number | null;
  status: PermitStatus;
  permit_reference: string | null;
  start_date: string | null;
  expiry_date: string | null;
  applied_at: string | null;
  confirmed_at: string | null;
  council_emails: string[];
  last_chase_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PermitStatus =
  | "needed"
  | "applied"
  | "confirmed"
  | "active"
  | "rejected"
  | "expired"
  | "cancelled";

export const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  needed: "Permit needed",
  applied: "Applied",
  confirmed: "Confirmed",
  active: "Permit active",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

/** Uppercase, strip spaces, then re-insert a space before the final three characters. */
export function normalisePostcode(input: string | null | undefined): string {
  const compact = (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/**
 * A postcode matches a row when any comma-separated token matches:
 * - token without a space: the outward code equals the token exactly
 * - token with a space: the compact postcode starts with the compact token
 */
export function matchPermitRows(postcode: string, rows: PermitPricingRow[]): PermitPricingRow[] {
  const pc = normalisePostcode(postcode);
  if (!pc) return [];
  const outward = pc.split(/\s+/)[0];
  const compact = pc.replace(/\s+/g, "");
  const matches = (token: string) => {
    const t = token.trim().toUpperCase();
    if (!t) return false;
    if (/\s/.test(t)) return compact.startsWith(t.replace(/\s+/g, ""));
    return outward === t;
  };
  const tokens = (r: PermitPricingRow): string[] =>
    Array.isArray(r.postcodes) ? r.postcodes : String(r.postcodes ?? "").split(",");
  return rows
    .filter((r) => r.active)
    .filter((r) => tokens(r).some(matches))
    .sort((a, b) => Number(a.price_exc_vat) - Number(b.price_exc_vat));
}

export function permitAreaForPostcode(postcode: string, rows: PermitPricingRow[]): string | null {
  return matchPermitRows(postcode, rows)[0]?.area ?? null;
}

export function incVatFromExc(exc: number): number {
  return Math.round(exc * 1.2 * 100) / 100;
}

export function hoursUntil(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  // Permits run to the end of their expiry day.
  const end = new Date(`${dateIso.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - Date.now()) / 36e5);
}

export type PermitDisplayState = {
  key: "needed" | "applied" | "confirmed" | "active" | "expiring" | "expired" | "rejected" | "cancelled";
  label: string;
  /** Tailwind classes using semantic tokens. */
  className: string;
};

/** Derive the badge state from the stored status plus the expiry date. */
export function permitDisplayState(
  permit: Pick<PermitApplication, "status" | "expiry_date">,
  chaseLeadHours = 72,
): PermitDisplayState {
  const hrs = hoursUntil(permit.expiry_date);

  if (permit.status === "rejected")
    return { key: "rejected", label: "Permit rejected", className: "bg-destructive/10 text-destructive" };
  if (permit.status === "cancelled")
    return { key: "cancelled", label: "Permit cancelled", className: "bg-muted text-muted-foreground" };
  if (permit.status === "needed")
    return { key: "needed", label: "Permit needed", className: "bg-warning/15 text-warning" };
  if (permit.status === "applied")
    return { key: "applied", label: "Permit applied", className: "bg-info/10 text-info" };

  if (hrs !== null) {
    if (hrs <= 0)
      return { key: "expired", label: "Permit expired", className: "bg-destructive/15 text-destructive" };
    if (hrs <= chaseLeadHours)
      return {
        key: "expiring",
        label: `Expires in ${hrs}h`,
        className: "bg-destructive/10 text-destructive",
      };
  }
  if (permit.status === "expired")
    return { key: "expired", label: "Permit expired", className: "bg-destructive/15 text-destructive" };

  return { key: "active", label: "Permit active", className: "bg-success/15 text-success" };
}

/** Fill {{placeholders}} in a subject or body template. */
export function renderPermitTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return (template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v === null || v === undefined || v === "" ? "" : String(v);
  });
}

export function formatUkDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB");
}

/** Add whole days to an ISO date string (yyyy-mm-dd). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
