import { cleanEmail } from "@/lib/email-clean";

export type ChaseContactSource = "contact" | "po" | "pod";

export interface ChaseContact {
  customerId: string;
  customerName: string;
  name: string;
  email: string;
  source: ChaseContactSource;
}

interface CustomerRow {
  id: string;
  customer_name: string | null;
  po_notification_email?: string | null;
  pod_email?: string | null;
}

interface ContactRow {
  customer_id: string | null;
  full_name?: string | null;
  email: string | null;
  created_at?: string | null;
}

export const CHASE_CONTACT_SOURCE_LABEL: Record<ChaseContactSource, string> = {
  contact: "Contact",
  po: "PO emails",
  pod: "POD emails",
};

/**
 * Every saved email address that can receive a rental chase, one entry per
 * customer + address. Named contacts come first (newest first), then the
 * customer's PO and POD notification addresses.
 */
export function buildChaseContacts(customers: CustomerRow[], contacts: ContactRow[]): ChaseContact[] {
  const nameById = new Map<string, string>();
  for (const c of customers) nameById.set(c.id, c.customer_name || "");

  const out: ChaseContact[] = [];
  const seen = new Set<string>();
  const push = (customerId: string, name: string, raw: string | null | undefined, source: ChaseContactSource) => {
    const email = cleanEmail(raw);
    if (!email || !nameById.has(customerId)) return;
    const key = `${customerId}|${email}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ customerId, customerName: nameById.get(customerId) || "", name, email, source });
  };

  const sorted = [...contacts].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  for (const ct of sorted) {
    if (ct.customer_id) push(ct.customer_id, (ct.full_name || "").trim(), ct.email, "contact");
  }
  for (const c of customers) {
    push(c.id, "", c.po_notification_email, "po");
    push(c.id, "", c.pod_email, "pod");
  }
  return out;
}

/** This customer's addresses (in saved order) and everyone else's, sorted by customer then name. */
export function splitChaseContacts(all: ChaseContact[], customerId?: string) {
  const forCustomer = customerId ? all.filter((c) => c.customerId === customerId) : [];
  const others = all
    .filter((c) => c.customerId !== customerId)
    .sort((a, b) => a.customerName.localeCompare(b.customerName) || (a.name || a.email).localeCompare(b.name || b.email));
  return { forCustomer, others };
}
