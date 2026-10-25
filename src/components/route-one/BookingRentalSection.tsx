import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLiveJobsSettings } from "@/hooks/useLiveJobsSettings";
export function BookingRentalSection({ form, setForm }: { form: any; setForm: (form: any) => void }) {
  const { settings } = useLiveJobsSettings();
  return <section className="booking-section space-y-3">
    <div className="flex items-center justify-between"><h4 className="booking-step">Rental</h4><div className="flex items-center gap-2"><Label htmlFor="booking-rental">Apply rental</Label><Switch id="booking-rental" disabled={form.own_container} checked={!form.own_container && !!form.rental_enabled} onCheckedChange={enabled => setForm({ ...form, rental_enabled: enabled, rental_free_days: form.rental_free_days ?? settings.rental_free_days, rental_weekly_rate: form.rental_weekly_rate ?? (/ro\s*ro/i.test(form.container_type || "") ? settings.rental_roro_rate : settings.rental_skip_rate), rental_start_date: form.rental_start_date || form.scheduled_date })} /></div></div>
    {form.own_container ? <p className="text-sm text-muted-foreground">Own container — no rental applies.</p> : form.rental_enabled && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div><Label htmlFor="rental-start">Rental start date</Label><Input id="rental-start" type="date" value={form.rental_start_date || ""} onChange={e => setForm({ ...form, rental_start_date: e.target.value })} /></div>
      <div><Label htmlFor="rental-free">Free days</Label><Input id="rental-free" type="number" min="0" value={form.rental_free_days ?? ""} onChange={e => setForm({ ...form, rental_free_days: e.target.value })} /></div>
      <div><Label htmlFor="rental-rate">Weekly rental (£ + VAT)</Label><Input id="rental-rate" type="number" min="0" step="0.01" value={form.rental_weekly_rate ?? ""} onChange={e => setForm({ ...form, rental_weekly_rate: e.target.value })} /></div>
    </div>}
  </section>;
}