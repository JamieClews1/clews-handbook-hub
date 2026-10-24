/**
 * Builds invoice lines for a completed RouteOne job from its booked prices and
 * every weigh ticket linked to it. Pure function so the pricing rules are tested.
 *
 * Rules (agreed for go-live):
 * - Haulage line = booked haulage price.
 * - Tonnage line = (total tonnes across all tickets − included tonnes) × booked £/t,
 *   never below the booked minimum weight charge. Included tonnes = "Weight Included (t)".
 * - Weighbridge extras on each ticket and booked cost items become their own lines.
 * - Approved contamination charge on the job is its own line.
 */
export interface JobForInvoice {
  job_number: string | null;
  container_size?: string | null;
  container_type?: string | null;
  waste_type?: string | null;
  site_name?: string | null;
  haulage_cost?: number | null;
  charge_per_tonne?: number | null;
  weight_included_t?: number | null;
  min_weight_charge?: number | null;
  cost_items?: { name?: string; charge?: number; qty?: number }[] | null;
  contamination_charge?: number | null;
  vat_rate?: number | null;
}
export interface TicketForInvoice {
  id: string;
  ticket_number: string | null;
  net_weight_kg: number | null;
  extras?: { description: string; cost: number | null }[];
}
export interface DraftLine {
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  source_transaction_id?: string | null;
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function line(description: string, quantity: number, unit: string | null, unitPrice: number, vatRate: number, sourceTx?: string | null): DraftLine {
  const net = r2(quantity * unitPrice);
  return { description, quantity, unit, unit_price: r2(unitPrice), net_amount: net, vat_rate: vatRate, vat_amount: r2(net * vatRate / 100), source_transaction_id: sourceTx ?? null };
}

/** WeighOne native tickets store kilograms. */
export const ticketTonnes = (t: TicketForInvoice) => r3(n(t.net_weight_kg) / 1000);

export function buildJobInvoiceLines(job: JobForInvoice, tickets: TicketForInvoice[]): { lines: DraftLine[]; totalTonnes: number; chargeableTonnes: number } {
  const vat = job.vat_rate == null ? 20 : n(job.vat_rate);
  const what = [job.container_size, job.container_type, job.waste_type].filter(Boolean).join(" ") || "Waste collection";
  const ref = `Job ${job.job_number ?? ""}${job.site_name ? `, ${job.site_name}` : ""}`.trim();
  const lines: DraftLine[] = [];

  if (n(job.haulage_cost) > 0) lines.push(line(`${what} – haulage (${ref})`, 1, null, n(job.haulage_cost), vat));

  const totalTonnes = r3(tickets.reduce((s, t) => s + ticketTonnes(t), 0));
  const included = Math.max(0, n(job.weight_included_t));
  const chargeableTonnes = r3(Math.max(0, totalTonnes - included));
  const rate = n(job.charge_per_tonne);
  if (rate > 0 && tickets.length) {
    const tickets_ = tickets.map(t => t.ticket_number).filter(Boolean).join(", ");
    const incl = included > 0 ? `, first ${included} t included` : "";
    const desc = `Disposal ${totalTonnes} t${incl}${tickets_ ? ` (ticket ${tickets_})` : ""}`;
    const byWeight = r2(chargeableTonnes * rate);
    const min = n(job.min_weight_charge);
    if (min > byWeight) lines.push(line(`${desc} – minimum charge`, 1, null, min, vat));
    else if (chargeableTonnes > 0) lines.push(line(desc, chargeableTonnes, "t", rate, vat));
  }

  for (const t of tickets) for (const x of t.extras ?? []) {
    if (n(x.cost) !== 0) lines.push(line(`${x.description}${t.ticket_number ? ` (ticket ${t.ticket_number})` : ""}`, 1, null, n(x.cost), vat));
  }
  for (const c of job.cost_items ?? []) {
    if (n(c.charge) !== 0) lines.push(line(c.name || "Additional charge", n(c.qty) || 1, null, n(c.charge), vat));
  }
  if (n(job.contamination_charge) > 0) lines.push(line("Contamination charge", 1, null, n(job.contamination_charge), vat));

  return { lines, totalTonnes, chargeableTonnes };
}

/** Reasons a job is not ready to invoice yet; empty means ready. */
export function invoiceBlockers(opts: { jobCompleted: boolean; hasCustomer: boolean; financeMissing: string[]; poRequired: boolean; po: string | null; lines: DraftLine[]; pendingContamination: boolean }) {
  const out: string[] = [];
  if (!opts.jobCompleted) out.push("Driver hasn't completed the job");
  if (!opts.hasCustomer) out.push("Customer not set up for invoicing");
  if (opts.hasCustomer && opts.financeMissing.length) out.push(opts.financeMissing[0].startsWith("Finance details have not") ? "Customer finance details not set up" : `Finance details missing: ${opts.financeMissing.join(", ")}`);
  if (opts.poRequired && !opts.po?.trim()) out.push("Customer needs a PO number");
  if (opts.pendingContamination) out.push("Contamination awaiting decision");
  if (!opts.lines.some(l => l.net_amount > 0)) out.push("No price on the job");
  return out;
}
