import { classifyVehicle, findRate, type FuelSurchargeRate, type SurchargeZone } from "./fuel-surcharge";

const price = (value: unknown): number | "" => {
  if (value == null || value === "") return "";
  const number = Number(String(value).replace(/[£,\s]/g, ""));
  return Number.isFinite(number) ? number : "";
};

/** Copy explicit booking prices only: a completed total is not a per-tonne rate. */
export function importedBookingPrices(raw: Record<string, unknown>) {
  const first = (keys: string[]) => {
    for (const key of keys) if (raw[key] != null && raw[key] !== "") return price(raw[key]);
    return "";
  };
  return {
    haulage_cost: first(["Haulage Cost", "Skip Price"]),
    charge_per_tonne: first(["Charge per Tonne", "Price per Tonne", "Per Tonne Rate"]),
    weight_included_t: first(["Weight Included", "Included Tonnes"]),
    min_weight_charge: first(["Min Weight Charge"]),
    vat_rate: first(["VAT Rate"]) === "" ? 20 : first(["VAT Rate"]),
    cost_items: [],
  };
}

export const isBookingFuelItem = (item: { name: string }) => /^fuel surcharge(?:\s*\(net\))?$/i.test(item.name.trim());

export function bookingFuelRate(form: Record<string, any>, zoneLabel: string | null, rates: FuelSurchargeRate[]) {
  const vehicle = classifyVehicle({ id: "", job_number: null, source: "routeone", job_date: form.scheduled_date, customer: form.customer_name, site: form.site_name, movement_type: form.job_type, job_type: form.job_type, container_type: `${form.container_type || ""} ${form.container_size || ""}`, vehicle_registration: null, raw: null });
  const zone: SurchargeZone | null = /^zone\s*1/i.test(zoneLabel || "") ? "Zone 1" : /^zone\s*2/i.test(zoneLabel || "") ? "Zone 2" : /^zone\s*[34]/i.test(zoneLabel || "") ? "Zone 3" : null;
  if (!vehicle || !zone || !form.scheduled_date) return null;
  return findRate(rates, vehicle, zone, form.scheduled_date, form.customer_name);
}

export function setBookingFuel(items: { name: string; charge: number; qty: number }[], amount: number | null) {
  const others = items.filter(item => !isBookingFuelItem(item));
  return amount == null ? others : [...others, { name: "Fuel surcharge", charge: amount, qty: 1 }];
}