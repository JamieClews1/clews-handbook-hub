import { containerGroup, containerSize } from "./container-taxonomy";
export type PricingSize = { size_code: string; display_name: string; is_active: boolean };
export type BookingSizeOption = PricingSize & { bespoke?: boolean };
/** Priced sizes need an active price-list size; bespoke sizes (no price line) are always offered. */
export function pricingContainerOptions(sizes: PricingSize[], type: string): BookingSizeOption[] {
  const group = containerGroup(type);
  if (!group) return [];
  return group.sizes.flatMap((option): BookingSizeOption[] => {
    if (type === "Enclosed Skip" && option.code !== "12yd_enclosed") return [];
    if (option.bespoke) return [{ size_code: option.code, display_name: option.label, is_active: true, bespoke: true }];
    const size = sizes.find(s => s.is_active && s.size_code === option.code);
    if (!size) return [];
    return [{ ...size, display_name: option.label }];
  });
}
/** True when the saved size code is one the booking form can show (priced or bespoke). */
export function isKnownBookingSize(sizes: PricingSize[], code: string | null | undefined) {
  if (!code) return false;
  return sizes.some(s => s.size_code === code) || Boolean(containerSize(code)?.bespoke);
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