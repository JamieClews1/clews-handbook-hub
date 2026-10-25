export type PricingSize = { size_code: string; display_name: string; is_active: boolean };
export function pricingContainerOptions(sizes: PricingSize[], type: string) {
  const active = sizes.filter(s => s.is_active);
  if (type === "Enclosed Skip") return active.filter(s => /enclosed/i.test(s.display_name));
  if (type === "Ro Ro") return active.filter(s => /roro|ro ro|35yd|40yd/i.test(`${s.size_code} ${s.display_name}`));
  if (type === "Skip") return active.filter(s => !/enclosed|roro|ro ro|35yd|40yd/i.test(`${s.size_code} ${s.display_name}`));
  return active;
}
export function bookingRentalFields(form: Record<string, any>) {
  const own = Boolean(form.own_container);
  return { own_container: own, rental_enabled: !own && Boolean(form.rental_enabled), rental_free_days: form.rental_free_days === "" || form.rental_free_days == null ? null : Number(form.rental_free_days), rental_weekly_rate: form.rental_weekly_rate === "" || form.rental_weekly_rate == null ? null : Number(form.rental_weekly_rate), rental_start_date: form.rental_start_date || null };
}
export function bookingRentalText(job: Record<string, any>) {
  if (job.own_container) return "Own container — no rental applies.";
  if (!job.rental_enabled) return "";
  return `Rental: ${job.rental_free_days ?? 0} free days from ${job.rental_start_date || job.scheduled_date || "booking date"}; £${Number(job.rental_weekly_rate || 0).toFixed(2)} per week + VAT thereafter.`;
}