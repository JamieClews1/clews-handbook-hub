export type PaymentMethod = "card" | "cash" | "cheque" | "account";

export interface PaymentInput {
  method: PaymentMethod | "";
  paid: boolean;
  reference: string;
}

export interface StoredPayment {
  payment_method?: string | null;
  payment_paid?: boolean | null;
  payment_reference?: string | null;
  payment_paid_at?: string | null;
}

export const paymentNeedsReference = (method: string | null | undefined) => method === "card" || method === "cheque";

export const paymentFromStored = (t: StoredPayment | null | undefined): PaymentInput => ({
  method: ((t?.payment_method as PaymentMethod) ?? "") as PaymentInput["method"],
  paid: !!t?.payment_paid,
  reference: t?.payment_reference ?? "",
});

/** Returns a message when the payment can't be saved as entered, otherwise null. */
export function paymentProblem(p: PaymentInput): string | null {
  if (p.paid && !p.method) return "Choose how it was paid";
  if (p.paid && paymentNeedsReference(p.method) && !p.reference.trim()) return "Enter the card / cheque number";
  return null;
}

/** Database fields for a payment; the original paid time is kept when a paid ticket is saved again. */
export function paymentPatch(p: PaymentInput, previous?: StoredPayment | null, now = new Date()) {
  return {
    payment_method: p.method || null,
    payment_paid: p.paid,
    payment_reference: paymentNeedsReference(p.method) ? p.reference.trim() || null : null,
    payment_paid_at: p.paid ? (previous?.payment_paid && previous.payment_paid_at ? previous.payment_paid_at : now.toISOString()) : null,
  };
}

const money = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Payment line printed on the ticket, including the amount paid or due (inc VAT). */
export function ticketPaymentLabel(t: StoredPayment & { total_price?: number | null }): string {
  const incVat = t.total_price != null && Number(t.total_price) > 0 ? Math.round(Number(t.total_price) * 120) / 100 : null;
  if (t.payment_paid) {
    const how = t.payment_method ? ` – ${String(t.payment_method).toUpperCase()}` : "";
    const ref = t.payment_reference ? ` ${t.payment_reference}` : "";
    return `PAID${incVat != null ? ` ${money(incVat)}` : ""}${how}${ref}`;
  }
  if (t.payment_method === "account") return "ON ACCOUNT – invoice to follow";
  return incVat != null ? `NOT PAID – ${money(incVat)} due` : "NOT PAID";
}
