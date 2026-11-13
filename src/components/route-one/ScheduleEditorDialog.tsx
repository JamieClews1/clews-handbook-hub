import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CONTAINER_GROUPS, containerGroup } from "@/lib/container-taxonomy";
import { importedBookingPrices } from "@/lib/route-booking-pricing";
import { importedSiteDetails } from "@/lib/route-booking-sites";
import { recordedContainerBooking } from "@/lib/recorded-container-booking";
import { standardBookingWaste } from "@/lib/waste-streams";
import { londonCalendarKey } from "@/lib/ui-calendar";
import { addDaysKey, scheduleFrequencyLabel, scheduleOccurrences, type ScheduleRow } from "@/lib/route-job-schedules";
import { WasteStreamPicker } from "./WasteStreamPicker";
import { useJobTypes } from "./jobTypes";

export type ScheduleDraft = Partial<ScheduleRow> & { customer_name: string };

const WEEKS = [1, 2, 3, 4, 6, 8, 12];
const AHEAD = [7, 14, 21, 28, 42];
const num = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const longDate = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Draft a schedule from a bin's last Skiptrak job: same site, container, waste and booking prices. */
export function scheduleDraftFromSkiptrak(job: { job_number: string; customer: string | null; site: string | null; container_type: string | null; waste_description: string | null; ewc: string | null; raw: unknown },
  site: { customer: string; site: string; address: string; postcode: string }, opts: { intervalWeeks: number | null; startDate: string }): ScheduleDraft {
  const raw = (job.raw ?? {}) as Record<string, unknown>;
  const recorded = recordedContainerBooking(job.container_type);
  const prices = importedBookingPrices(raw);
  const details = importedSiteDetails(raw);
  return {
    customer_name: site.customer || job.customer || "",
    site_name: site.site || job.site,
    site_address: site.address || details.address || null,
    site_postcode: site.postcode || null,
    match_site: job.site,
    match_container: job.container_type,
    job_type: "exchange",
    container_type: recorded.container_type || null,
    container_size: recorded.container_size || null,
    ...standardBookingWaste(job.waste_description, job.ewc, { source: "skiptrak" }),
    haulage_cost: num(prices.haulage_cost), charge_per_tonne: num(prices.charge_per_tonne),
    weight_included_t: num(prices.weight_included_t), min_weight_charge: num(prices.min_weight_charge),
    vat_rate: num(prices.vat_rate) ?? 20,
    interval_weeks: opts.intervalWeeks ?? 1,
    start_date: opts.startDate,
    book_ahead_days: 14,
    source_job_number: job.job_number,
  };
}

/** Create or edit a repeating job. Saving books every job inside the look-ahead window straight away. */
export function ScheduleEditorDialog({ draft, onOpenChange, onSaved }: { draft: ScheduleDraft | null; onOpenChange: (open: boolean) => void; onSaved?: () => void }) {
  const { types: jobTypes } = useJobTypes();
  const [form, setForm] = useState<ScheduleDraft | null>(draft);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeUpcoming, setRemoveUpcoming] = useState(true);
  useEffect(() => { setForm(draft); }, [draft]);
  const today = londonCalendarKey();
  const set = (patch: Partial<ScheduleDraft>) => setForm(f => (f ? { ...f, ...patch } : f));

  const preview = useMemo(() => {
    if (!form?.start_date) return [];
    return scheduleOccurrences({ start_date: form.start_date, interval_weeks: form.interval_weeks ?? 1, end_date: form.end_date }, today, addDaysKey(today, 7 * 26)).slice(0, 5);
  }, [form?.start_date, form?.interval_weeks, form?.end_date, today]);
  const group = form?.container_type ? containerGroup(form.container_type) : undefined;

  const save = async () => {
    if (!form) return;
    if (!form.customer_name.trim() || !form.start_date) { toast.error("Add the customer and the first job date."); return; }
    if (form.end_date && form.end_date < form.start_date) { toast.error("The end date must be after the first job date."); return; }
    setSaving(true);
    const row = {
      customer_name: form.customer_name.trim(), site_name: form.site_name || null, site_address: form.site_address || null, site_address_2: form.site_address_2 || null,
      site_postcode: form.site_postcode || null, site_contact_name: form.site_contact_name || null, site_contact_phone: form.site_contact_phone || null,
      match_site: form.match_site || null, match_container: form.match_container || null,
      job_type: (form.job_type || "exchange") as Database["public"]["Enums"]["route_one_job_type"], container_type: form.container_type || null, container_size: form.container_size || null,
      waste_type: form.waste_type || null, ewc_code: form.ewc_code || null, po_number: form.po_number || null, notes: form.notes || null,
      haulage_cost: num(form.haulage_cost), charge_per_tonne: num(form.charge_per_tonne), min_weight_charge: num(form.min_weight_charge), weight_included_t: num(form.weight_included_t),
      vat_rate: num(form.vat_rate) ?? 20, own_container: Boolean(form.own_container), interval_weeks: form.interval_weeks ?? 1, start_date: form.start_date,
      end_date: form.end_date || null, book_ahead_days: form.book_ahead_days ?? 14, active: form.active ?? true, source_job_number: form.source_job_number || null,
    };
    try {
      let id = form.id;
      if (id) {
        // A changed pattern is re-read from today; dates already booked nearby are still skipped.
        const patternChanged = draft?.start_date !== row.start_date || draft?.interval_weeks !== row.interval_weeks;
        const { error } = await supabase.from("route_one_job_schedules").update(patternChanged ? { ...row, booked_until: null } : row).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("route_one_job_schedules").insert(row).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      const { data: made, error: genError } = await supabase.rpc("generate_route_one_scheduled_jobs", { p_schedule_id: id });
      if (genError) toast.error("Schedule saved, but the next jobs could not be booked yet. They will be booked automatically tomorrow morning.");
      else toast.success(made ? `Schedule saved · ${made} job${made === 1 ? "" : "s"} booked` : "Schedule saved · no new jobs needed yet");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Schedule could not be saved.");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form?.id) return;
    setSaving(true);
    try {
      if (removeUpcoming) {
        const { error } = await supabase.from("route_one_jobs").delete().eq("schedule_id", form.id).eq("status", "unassigned").gte("scheduled_date", today);
        if (error) throw error;
      }
      const { error } = await supabase.from("route_one_job_schedules").delete().eq("id", form.id);
      if (error) throw error;
      toast.success("Schedule removed");
      onSaved?.();
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Schedule could not be removed.");
    } finally { setSaving(false); }
  };

  return <>
    <Dialog open={Boolean(draft)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Repeat className="h-5 w-5 text-primary" />{form?.id ? "Edit scheduled job" : "New scheduled job"}</DialogTitle>
          <DialogDescription>{[form?.customer_name, form?.site_name].filter(Boolean).join(" · ")}{form?.site_postcode ? ` · ${form.site_postcode}` : ""}</DialogDescription>
        </DialogHeader>
        {form && <div className="space-y-5">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Job</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs">Job type</Label>
                <Select value={form.job_type || "exchange"} onValueChange={v => set({ job_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{jobTypes.filter(t => !["waste_out_skip", "wasted_journey"].includes(t.key)).map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Waste</Label>
                <WasteStreamPicker value={form.waste_type || ""} ewc={form.ewc_code} onChange={s => set({ waste_type: s.name, ewc_code: s.ewc ?? "" })} />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Container</Label>
                <Select value={group?.value ?? ""} onValueChange={v => set({ container_type: v, container_size: CONTAINER_GROUPS.find(g => g.value === v)?.sizes[0]?.code ?? "" })}>
                  <SelectTrigger><SelectValue placeholder={form.container_type || "Choose"} /></SelectTrigger>
                  <SelectContent>{CONTAINER_GROUPS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Size</Label>
                <Select value={form.container_size || ""} onValueChange={v => set({ container_size: v })} disabled={!group}>
                  <SelectTrigger><SelectValue placeholder={form.container_size || "Choose"} /></SelectTrigger>
                  <SelectContent>{(group?.sizes ?? []).map(s => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Repeat</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs">How often</Label>
                <Select value={String(form.interval_weeks ?? 1)} onValueChange={v => set({ interval_weeks: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[...new Set([...WEEKS, form.interval_weeks ?? 1])].sort((a, b) => a - b).map(w => <SelectItem key={w} value={String(w)}>{scheduleFrequencyLabel(w)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs" htmlFor="schedule-start">First job date</Label>
                <Input id="schedule-start" type="date" value={form.start_date || ""} onChange={e => set({ start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label className="text-xs" htmlFor="schedule-end">Ends (optional)</Label>
                <Input id="schedule-end" type="date" value={form.end_date || ""} onChange={e => set({ end_date: e.target.value || null })} />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Book ahead</Label>
                <Select value={String(form.book_ahead_days ?? 14)} onValueChange={v => set({ book_ahead_days: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[...new Set([...AHEAD, form.book_ahead_days ?? 14])].sort((a, b) => a - b).map(d => <SelectItem key={d} value={String(d)}>{d % 7 === 0 ? `${d / 7} week${d === 7 ? "" : "s"}` : `${d} days`} ahead</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="flex items-center gap-1.5 font-medium"><CalendarClock className="h-4 w-4 text-muted-foreground" />Next jobs</p>
              {preview.length ? <p className="mt-1 tabular-nums">{preview.map(longDate).join(" · ")}</p> : <p className="mt-1 text-muted-foreground">No upcoming dates.</p>}
              <p className="mt-1 text-xs text-muted-foreground">Jobs inside the book-ahead window are booked when you save and topped up every morning as unassigned jobs. A date already booked for this bin in Skiptrak or Route One (within a few days) is skipped.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Prices</h4>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
              {([["haulage_cost", "Haulage £"], ["charge_per_tonne", "£ per tonne"], ["weight_included_t", "Tonnes included"], ["min_weight_charge", "Min charge £"], ["vat_rate", "VAT %"]] as const).map(([k, l]) =>
                <div key={k} className="space-y-1.5"><Label className="text-xs" htmlFor={`schedule-${k}`}>{l}</Label><Input id={`schedule-${k}`} type="number" inputMode="decimal" value={form[k] ?? ""} onChange={e => set({ [k]: e.target.value === "" ? null : Number(e.target.value) })} /></div>)}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className="text-xs" htmlFor="schedule-po">PO number</Label><Input id="schedule-po" value={form.po_number || ""} onChange={e => set({ po_number: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs" htmlFor="schedule-notes">Notes for each job</Label><Textarea id="schedule-notes" rows={2} value={form.notes || ""} onChange={e => set({ notes: e.target.value })} /></div>
          </section>

          {form.id && <label className="flex items-center gap-3 text-sm"><Switch checked={form.active ?? true} onCheckedChange={v => set({ active: v })} />Schedule is running{!(form.active ?? true) && <span className="text-muted-foreground">(paused: no new jobs are booked)</span>}</label>}
        </div>}
        <DialogFooter className="gap-2">
          {form?.id && <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={() => setConfirmDelete(true)} disabled={saving}><Trash2 className="h-4 w-4" />Remove</Button>}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{form?.id ? "Save schedule" : "Create schedule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this schedule?</AlertDialogTitle>
          <AlertDialogDescription>No more jobs will be booked from it. Assigned, started and completed jobs always stay on the board.</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={removeUpcoming} onCheckedChange={v => setRemoveUpcoming(v === true)} />Also remove its upcoming unassigned jobs</label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Keep schedule</AlertDialogCancel>
          <AlertDialogAction onClick={e => { e.preventDefault(); void remove(); }} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove schedule</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
