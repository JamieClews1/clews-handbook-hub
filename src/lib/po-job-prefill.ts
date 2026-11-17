// Turns a purchase order read by the PO reader into New Job form values.
// It only fills the form — nothing is saved, priced or dispatched until staff
// review the job and press Save or Book.
import { recordedContainerBooking } from "./recorded-container-booking";

export interface PoInterpretation {
  po_number: string | null;
  broker: string | null;
  end_customer: string | null;
  site_name: string | null;
  site_address: string | null;
  postcode: string | null;
  container: string | null;
  waste_type: string | null;
  ewc_code: string | null;
  service: "delivery" | "exchange" | "collection" | "wait_and_load" | null;
  requested_date: string | null;
  price_net: number | null;
  extras: string | null;
  notes: string | null;
}

export interface PoReadResult {
  attachment: { id: string | null; file_name: string };
  po: PoInterpretation;
  zone: string | null;
  expected: { price: number; label: string; card: string; included_tonnes: number | null } | null;
  flags: { level: "red" | "amber"; message: string }[];
}

/** Plain text values for the New Job form, also used as /route-one?newjob=1 URL parameters. */
export interface JobPrefill {
  customer: string;
  site: string;
  address: string;
  postcode: string;
  po: string;
  container: string;
  waste: string;
  ewc: string;
  date: string;
  type: string;
  notes: string;
}

const clean = (v: string | null | undefined) => (v ?? "").trim();

export function poToJobPrefill(po: PoInterpretation): JobPrefill {
  return {
    customer: clean(po.end_customer) || clean(po.broker),
    site: clean(po.site_name),
    address: clean(po.site_address),
    postcode: clean(po.postcode).toUpperCase(),
    po: clean(po.po_number),
    container: clean(po.container),
    waste: clean(po.waste_type),
    ewc: clean(po.ewc_code),
    date: /^\d{4}-\d{2}-\d{2}$/.test(clean(po.requested_date)) ? clean(po.requested_date) : "",
    type: po.service === "exchange" || po.service === "collection" ? po.service : "delivery",
    notes: [
      po.broker ? `Broker: ${clean(po.broker)}` : "",
      po.price_net != null ? `PO price: £${po.price_net.toFixed(2)} net` : "",
      po.extras ? `Extras: ${clean(po.extras)}` : "",
      po.service === "wait_and_load" ? "PO asks for wait & load" : "",
      clean(po.notes),
    ].filter(Boolean).join("\n"),
  };
}

export function jobPrefillToParams(p: JobPrefill): URLSearchParams {
  const params = new URLSearchParams({ newjob: "1" });
  for (const [k, v] of Object.entries(p)) if (v) params.set(k, v);
  return params;
}

/**
 * Form fields from a prefill. Only values the PO actually gives are returned,
 * so anything staff have already chosen stays put when the PO is silent on it.
 * Container wording ("8 yard skip", "40yd RoRo") resolves to the booking
 * container choice; wording that has no booking choice is kept as written.
 */
export function prefillFormFields(p: Partial<JobPrefill>) {
  const out: Record<string, string> = {};
  if (p.customer) out.customer_name = p.customer;
  if (p.site) out.site_name = p.site;
  if (p.address) out.site_address = p.address;
  if (p.postcode) out.site_postcode = p.postcode;
  if (p.po) out.po_number = p.po;
  if (p.date) out.scheduled_date = p.date;
  if (p.type && ["delivery", "exchange", "collection"].includes(p.type)) out.job_type = p.type;
  if (p.notes) out.notes = p.notes;
  if (p.container) {
    const booking = recordedContainerBooking(p.container);
    if (booking.container_type) out.container_type = booking.container_type;
    out.container_size = booking.container_size || (booking.container_type ? "" : p.container);
  }
  return out;
}
