// Turns a purchase order read by the PO reader into New Job form values.
// It only fills the form — nothing is saved, priced or dispatched until staff
// review the job and press Save or Book.
import { recordedContainerBooking } from "./recorded-container-booking";
import { ewcKey, formatEwc, pickableWasteStreams, resolveWasteStream } from "./waste-streams";

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
  site_contact_name?: string | null;
  site_contact_phone?: string | null;
  order_notes?: string | null;
  time_preference?: string | null;
  end_customer_is_private?: boolean | null;
  notes: string | null;
}

export interface PoAccount { customer_name: string; customer_code: string | null; matched_from: string }

export interface PoReadResult {
  attachment: { id: string | null; file_name: string };
  po: PoInterpretation;
  account?: PoAccount | null;
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
  contact: string;
  phone: string;
  po: string;
  container: string;
  waste: string;
  ewc: string;
  date: string;
  type: string;
  notes: string;
}

const clean = (v: string | null | undefined) => (v ?? "").trim();
const companyKey = (v: string | null | undefined) =>
  clean(v).toLowerCase().replace(/&/g, " and ").replace(/\b(t\/a.*|ltd|limited|plc|llp|uk|the|co|company|group)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const NO_TIME = /^(no\s*preference|any\s*time|none|n\/?a|tbc)\.?$/i;

/**
 * PO waste wording to the agreed waste list. Wording that is not a known name
 * falls back to the EWC only when exactly one bookable stream uses that code
 * (17 09 04 is always Construction & Demolition); otherwise it is left for staff.
 */
export function poBookingWaste(name: string | null | undefined, ewc: string | null | undefined): { waste: string; ewc: string } {
  const dotted = clean(ewc).replace(/(\d{2})[.\-](\d{2})[.\-](\d{2})/, "$1 $2 $3");
  const code = ewcKey(dotted) ? formatEwc(dotted) : dotted;
  const named = resolveWasteStream({ name, ewc: code, source: "route_one" });
  if (named) return { waste: named.name, ewc: named.ewc ?? code };
  const byCode = ewcKey(code) ? pickableWasteStreams("incoming", false).filter((s) => ewcKey(s.ewc) === ewcKey(code)) : [];
  if (byCode.length === 1) return { waste: byCode[0].name, ewc: byCode[0].ewc ?? code };
  return { waste: clean(name), ewc: code };
}

/**
 * Broker POs are booked like Skiptrak: the broker's account is the customer and
 * the end customer is the site (a householder's site is their first address line).
 */
export function poToJobPrefill(po: PoInterpretation, account?: PoAccount | null): JobPrefill {
  const broker = clean(po.broker);
  const end = clean(po.end_customer);
  const brokered = !!end && (!!account || !!broker) && companyKey(end) !== companyKey(account?.customer_name ?? broker);
  const firstLine = clean(po.site_address).split(",")[0].trim();
  // Householders: the AI's flag, or a personal name (no company words) whose site is a street address.
  const companyWords = /\b(ltd|limited|plc|llp|services|construction|council|school|group|trust|contractors?|homes|developments?|sons|t\/a)\b/i;
  const streetSite = /^\s*\d|\b(road|rd|street|st|close|lane|ln|avenue|ave|drive|dr|way|crescent|court|grove|place|gardens)\b/i;
  const looksPrivate = po.end_customer_is_private === true || (!companyWords.test(end) && streetSite.test(clean(po.site_name) || firstLine));
  const site = brokered ? (looksPrivate ? firstLine || end : end) : clean(po.site_name) || end;
  const waste = poBookingWaste(po.waste_type, po.ewc_code);
  const time = clean(po.time_preference);
  const orderNotes = clean(po.order_notes);
  return {
    customer: account?.customer_name || (brokered ? broker : end || broker),
    site,
    address: clean(po.site_address),
    postcode: clean(po.postcode).toUpperCase(),
    contact: clean(po.site_contact_name),
    phone: clean(po.site_contact_phone),
    po: clean(po.po_number),
    container: clean(po.container),
    waste: waste.waste,
    ewc: waste.ewc,
    date: /^\d{4}-\d{2}-\d{2}$/.test(clean(po.requested_date)) ? clean(po.requested_date) : "",
    type: po.service === "exchange" || po.service === "collection" ? po.service : "delivery",
    notes: [
      orderNotes ? `Order notes: ${orderNotes}` : "",
      time && !NO_TIME.test(time) && !orderNotes.toLowerCase().includes(time.toLowerCase().replace(/\.$/, "")) ? `Time: ${time}` : "",
      clean(po.site_contact_name) || clean(po.site_contact_phone)
        ? `Site contact: ${[clean(po.site_contact_name), clean(po.site_contact_phone)].filter(Boolean).join(" ")}`
        : "",
      po.service === "wait_and_load" ? "PO asks for wait & load" : "",
      clean(po.notes),
      brokered && clean(po.site_name) && clean(po.site_name) !== site ? `PO site: ${clean(po.site_name)}` : "",
      clean(po.waste_type) && waste.waste !== clean(po.waste_type) ? `PO waste: ${clean(po.waste_type)}` : "",
      broker ? `Broker: ${broker}` : "",
      po.price_net != null && po.price_net > 0 ? `PO price: £${po.price_net.toFixed(2)} net` : "",
      po.extras ? `Extras: ${clean(po.extras)}` : "",
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
  if (p.contact) out.site_contact_name = p.contact;
  if (p.phone) out.site_contact_phone = p.phone;
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
