export const WASTE_OUT_JOB_TYPE = "waste_out_skip";
export const WASTE_OUT_PRODUCER = "Clews Recycling";

export const isWasteOutJob = (jobType?: string | null) => jobType === WASTE_OUT_JOB_TYPE;

/** Switch a booking form between a customer job and a Waste Out load, clearing customer pricing for Waste Out. */
export function applyBookingKind(form: any, kind: "customer" | "waste_out") {
  if (kind === "waste_out") {
    return {
      ...form, job_type: WASTE_OUT_JOB_TYPE, customer_name: WASTE_OUT_PRODUCER,
      site_name: form.destination_name || "", site_address: form.destination_address || "", site_postcode: form.destination_postcode || "",
      haulage_cost: "", charge_per_tonne: "", min_weight_charge: "", cost_items: [], contamination_charge: "",
      own_container: false, rental_enabled: false, po_number: "",
    };
  }
  return {
    ...form, job_type: "delivery", customer_name: form.customer_name === WASTE_OUT_PRODUCER ? "" : form.customer_name,
    site_name: "", site_address: "", site_postcode: "", waste_out_estimate_type: "", waste_out_estimate_per_tonne: "", weight_included_t: "",
  };
}

/** Indicative gate fee or rebate for a Waste Out load: rate × estimated tonnes. */
export function wasteOutEstimate(form: { waste_out_estimate_type?: string | null; waste_out_estimate_per_tonne?: any; weight_included_t?: any }) {
  const type = form.waste_out_estimate_type;
  const rate = Number(form.waste_out_estimate_per_tonne);
  const t = Number(form.weight_included_t);
  if ((type !== "gate_fee" && type !== "rebate") || !Number.isFinite(rate) || !Number.isFinite(t) || rate <= 0 || t <= 0) return null;
  return { type, total: Math.round(rate * t * 100) / 100 };
}
