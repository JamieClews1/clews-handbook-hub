import { standardBookingWaste } from "@/lib/waste-streams";

/** Copy booking inputs only; operational evidence and financial settlement stay on the original. */
export function newExchangeForm<T extends Record<string, any>>(blank: T, job: Record<string, any>, date: string): T & Record<string, any> {
  const fields = ["customer_name", "site_name", "site_address", "site_address_2", "site_area", "site_postcode", "sic_code", "site_contact_name", "site_contact_phone", "account_code", "invoice_address", "directions", "disposal_site", "carrier_name", "ewc_code", "container_type", "container_size", "waste_type", "po_number", "haulage_cost", "charge_per_tonne", "min_weight_charge", "weight_included_t", "vat_rate", "own_container"];
  const copied: Record<string, any> = {};
  for (const field of fields) if (job[field] != null) copied[field] = job[field];
  // The new booking uses the agreed standard waste name and EWC; the original keeps its recorded wording.
  if (job.waste_type) Object.assign(copied, standardBookingWaste(job.waste_type, job.ewc_code, { source: "route_one" }));
  return { ...blank, ...copied, job_type: "exchange", scheduled_date: date, assigned_driver_id: "", vehicle_reg: "", waste_classification: structuredClone(job.waste_classification ?? {}), cost_items: structuredClone(job.cost_items ?? []), notes: [job.notes, `Exchange from RouteOne job ${job.job_number ?? ""}`].filter(Boolean).join("\n") };
}