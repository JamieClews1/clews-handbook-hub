import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { missingFinanceFields } from "@/lib/finance";
import { buildJobInvoiceLines, invoiceBlockers, line, ticketTonnes, type DraftLine, type TicketForInvoice } from "@/lib/job-invoice";

export interface ReadyItem {
  key: string;
  kind: "job" | "ticket";
  id: string;
  reference: string;
  date: string;
  customerLabel: string;
  customerId: string | null;
  siteLabel: string | null;
  po: string | null;
  tickets: string[];
  tonnes: number;
  lines: DraftLine[];
  net: number;
  blockers: string[];
  finance: any;
}

const sb = supabase as any;
const keyOf = (v: unknown) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

async function customerLookup() {
  const [{ data: customers }, { data: finance }] = await Promise.all([
    sb.from("customers").select("id, customer_name, customer_code, data_hub_customer").eq("is_active", true),
    sb.from("customer_finance_details").select("*"),
  ]);
  const fin = new Map<string, any>((finance ?? []).map((f: any) => [f.customer_id, f]));
  const byCode = new Map<string, any>(), byName = new Map<string, any>();
  for (const c of customers ?? []) {
    if (c.customer_code) byCode.set(keyOf(c.customer_code), c);
    byName.set(keyOf(c.customer_name), c);
    if (c.data_hub_customer) byName.set(keyOf(c.data_hub_customer), c);
  }
  return (name: string | null, code?: string | null) => {
    const c = (code && byCode.get(keyOf(code))) || byName.get(keyOf(name));
    return c ? { customer: c, finance: fin.get(c.id) ?? null } : null;
  };
}

const ticketOf = (t: any): TicketForInvoice => ({
  id: t.id, ticket_number: t.ticket_number, net_weight_kg: t.net_weight_kg,
  extras: (t.weighbridge_additional_items ?? []).map((x: any) => ({ description: x.description, cost: x.cost })),
});

/** Completed RouteOne jobs and account weigh tickets that have not been invoiced yet. */
export async function fetchReadyToInvoice(opts: { days?: number; jobId?: string; transactionId?: string } = {}): Promise<ReadyItem[]> {
  const since = format(addDays(new Date(), -(opts.days ?? 60)), "yyyy-MM-dd");
  const find = await customerLookup();
  const { data: invoiced } = await sb.from("invoices").select("source_job_id, source_transaction_id").neq("status", "cancelled")
    .or("source_job_id.not.is.null,source_transaction_id.not.is.null");
  const invoicedJobs = new Set((invoiced ?? []).map((i: any) => i.source_job_id).filter(Boolean));
  const invoicedTx = new Set((invoiced ?? []).map((i: any) => i.source_transaction_id).filter(Boolean));

  let jq = sb.from("route_one_jobs")
    .select("*, route_one_job_weighings(weighbridge_transactions(id, ticket_number, net_weight_kg, status, weighbridge_additional_items(description, cost)))")
    .eq("status", "completed").neq("job_type", "waste_out_skip");
  jq = opts.jobId ? jq.eq("id", opts.jobId) : jq.gte("scheduled_date", since);
  const { data: jobs, error } = opts.transactionId ? { data: [], error: null } : await jq.order("scheduled_date", { ascending: false }).limit(500);
  if (error) throw error;

  const cqIds = (jobs ?? []).map((j: any) => j.contamination_query_id).filter(Boolean);
  const { data: cqs } = cqIds.length ? await sb.from("contamination_queries").select("id, status").in("id", cqIds) : { data: [] };
  const cqStatus = new Map<string, string>((cqs ?? []).map((c: any) => [c.id, c.status]));

  const items: ReadyItem[] = [];
  const linkedTx = new Set<string>();
  for (const j of jobs ?? []) {
    const txs = (j.route_one_job_weighings ?? []).map((w: any) => w.weighbridge_transactions).filter(Boolean);
    txs.forEach((t: any) => linkedTx.add(t.id));
    if (invoicedJobs.has(j.id)) continue;
    const done = txs.filter((t: any) => t.status === "completed");
    const { lines, totalTonnes } = buildJobInvoiceLines(j, done.map(ticketOf));
    const match = find(j.customer_name, j.account_code);
    const blockers = invoiceBlockers({
      jobCompleted: true, hasCustomer: !!match, financeMissing: missingFinanceFields(match?.finance),
      poRequired: !!match?.finance?.po_required, po: j.po_number, lines,
      pendingContamination: cqStatus.get(j.contamination_query_id) === "query",
    });
    if (txs.some((t: any) => t.status === "first_weigh")) blockers.push("Vehicle still on site (second weigh missing)");
    if (Number(j.charge_per_tonne) > 0 && done.length === 0) blockers.push("No weigh ticket linked yet");
    items.push({
      key: `job:${j.id}`, kind: "job", id: j.id, reference: `Job ${j.job_number ?? "—"}`, date: j.scheduled_date,
      customerLabel: j.customer_name, customerId: match?.customer.id ?? null, siteLabel: j.site_name, po: j.po_number,
      tickets: done.map((t: any) => t.ticket_number).filter(Boolean), tonnes: totalTonnes, lines,
      net: lines.reduce((s, l) => s + l.net_amount, 0), blockers, finance: match?.finance ?? null,
    });
  }

  if (!opts.jobId) {
    let tq = sb.from("weighbridge_transactions")
      .select("id, ticket_number, customer, site, net_weight_kg, price_per_tonne, weight_charge, second_weigh_at, payment_paid, payment_method, waste_description, weighbridge_additional_items(description, cost), route_one_job_weighings(id)")
      .eq("status", "completed");
    tq = opts.transactionId ? tq.eq("id", opts.transactionId) : tq.gte("second_weigh_at", since).or("payment_paid.is.null,payment_paid.eq.false");
    const { data: txs, error: txErr } = await tq.order("second_weigh_at", { ascending: false }).limit(500);
    if (txErr) throw txErr;
    const vat = 20;
    for (const t of txs ?? []) {
      if (invoicedTx.has(t.id) || linkedTx.has(t.id) || (t.route_one_job_weighings ?? []).length) continue;
      if (!opts.transactionId && (t.payment_method === "cash" || t.payment_method === "card")) continue;
      const match = find(t.customer);
      if (!match && !opts.transactionId) continue; // walk-in tickets without an account are paid on the day
      const tonnes = ticketTonnes(t);
      const lines: DraftLine[] = [];
      const charge = Number(t.weight_charge ?? 0);
      if (charge > 0) {
        const ppt = Number(t.price_per_tonne ?? 0);
        lines.push(ppt > 0 && Math.abs(ppt * tonnes - charge) < 0.01
          ? line(`${t.waste_description ?? "Waste"} – ${tonnes} t (ticket ${t.ticket_number})`, tonnes, "t", ppt, vat)
          : line(`${t.waste_description ?? "Waste"} – ${tonnes} t (ticket ${t.ticket_number}, minimum charge)`, 1, null, charge, vat));
      }
      for (const x of t.weighbridge_additional_items ?? []) if (Number(x.cost)) lines.push(line(`${x.description} (ticket ${t.ticket_number})`, 1, null, Number(x.cost), vat));
      const blockers = invoiceBlockers({ jobCompleted: true, hasCustomer: !!match, financeMissing: missingFinanceFields(match?.finance), poRequired: !!match?.finance?.po_required, po: null, lines, pendingContamination: false });
      if (t.payment_paid) blockers.push("Already paid at the weighbridge");
      items.push({
        key: `tx:${t.id}`, kind: "ticket", id: t.id, reference: `Ticket ${t.ticket_number ?? "—"}`, date: (t.second_weigh_at ?? "").slice(0, 10),
        customerLabel: t.customer ?? "Unknown", customerId: match?.customer.id ?? null, siteLabel: t.site, po: null,
        tickets: [t.ticket_number].filter(Boolean), tonnes, lines, net: lines.reduce((s, l) => s + l.net_amount, 0), blockers, finance: match?.finance ?? null,
      });
    }
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

/** Creates one draft invoice (all lines saved together). Returns the existing invoice if already invoiced. */
export async function createInvoiceFromItem(item: ReadyItem, opts: { po?: string | null; zeroReason?: string | null } = {}) {
  if (!item.customerId) throw new Error("Customer not set up for invoicing");
  const { data: settings } = await sb.from("finance_settings").select("*").limit(1).maybeSingle();
  const f = item.finance ?? {};
  const issue = format(new Date(), "yyyy-MM-dd");
  const terms = f.payment_terms_days ?? settings?.default_payment_terms_days ?? 30;
  const { data: customer } = await sb.from("customers").select("customer_name").eq("id", item.customerId).maybeSingle();
  const { data, error } = await sb.rpc("create_invoice_with_lines", {
    _header: {
      customer_id: item.customerId,
      job_number: item.reference.replace(/^(Job|Ticket) /, ""),
      job_source: item.kind === "job" ? "routeone" : "weighone",
      source_job_id: item.kind === "job" ? item.id : null,
      source_transaction_id: item.kind === "ticket" ? item.id : null,
      issue_date: issue,
      due_date: format(addDays(new Date(), terms), "yyyy-MM-dd"),
      purchase_order: opts.po ?? item.po,
      zero_price_reason: opts.zeroReason ?? null,
      notes: item.tickets.length ? `Weigh ticket${item.tickets.length > 1 ? "s" : ""}: ${item.tickets.join(", ")}` : null,
      bill_to: {
        customer_name: customer?.customer_name ?? item.customerLabel,
        finance_contact_name: f.finance_contact_name, finance_contact_email: f.finance_contact_email,
        billing_address_line1: f.billing_address_line1, billing_address_line2: f.billing_address_line2,
        billing_city: f.billing_city, billing_county: f.billing_county, billing_postcode: f.billing_postcode,
        billing_country: f.billing_country, vat_number: f.vat_number,
      },
      accounting_provider: settings?.accounting_provider ?? "sage50",
    },
    _lines: item.lines,
  });
  if (error) throw error;
  return data as string;
}
