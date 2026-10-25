import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pricingContainerOptions, type PricingSize } from "@/lib/booking-container-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EwcCodePicker } from "@/components/codes/CodePicker";
import { CONTAINER_GROUPS, containerGroup } from "@/lib/container-taxonomy";
import { wasteOutEstimate } from "@/lib/waste-out-job";
import { useOutgoingSites } from "@/hooks/useOutgoingSites";

const money = (n: number) => n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });

/** Simplified Waste Out ticket: tipping site, vehicle type, waste, schedule and an indicative gate fee or rebate. */
export function WasteOutBookingFields({ form, setForm, drivers }: { form: any; setForm: (f: any) => void; drivers: any[] }) {
  const setTip = (patch: Record<string, string>) => {
    const next = { ...form, ...patch };
    // Mirror the tipping site into the site fields so the board, routing and sheets show where the load goes.
    setForm({ ...next, site_name: next.destination_name, site_address: next.destination_address, site_postcode: next.destination_postcode ?? next.site_postcode });
  };
  const est = wasteOutEstimate(form);
  const { data: outgoing = [] } = useOutgoingSites();
  const [sizes, setSizes] = useState<PricingSize[]>([]);
  useEffect(() => {
    supabase.from("pricing_skip_sizes").select("size_code,display_name,is_active").eq("is_active", true).order("display_order")
      .then(({ data }) => setSizes((data ?? []) as PricingSize[]));
  }, []);
  const sizeOptions = form.container_type && !["Pickup", "7.5 Tonne"].includes(form.container_type) ? pricingContainerOptions(sizes, form.container_type) : [];
  return (
    <div className="grid gap-0">
      <section className="booking-section space-y-3">
        <h4 className="booking-step"><span>1</span>Tipping site</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label className="text-xs" htmlFor="tip-name">Tipping site *</Label><Input id="tip-name" autoFocus value={form.destination_name || ""} onChange={e => setTip({ destination_name: e.target.value })} placeholder="Search outgoing sites…" list="outgoing-sites" autoComplete="off" /><datalist id="outgoing-sites">{outgoing.map(o => <option key={o.site_name} value={o.site_name}>{`${o.loads} loads`}</option>)}</datalist></div>
          <div><Label className="text-xs" htmlFor="tip-address">Address</Label><Input id="tip-address" value={form.destination_address || ""} onChange={e => setTip({ destination_address: e.target.value })} /></div>
          <div><Label className="text-xs" htmlFor="tip-postcode">Postcode</Label><Input id="tip-postcode" value={form.destination_postcode ?? form.site_postcode ?? ""} onChange={e => setTip({ destination_postcode: e.target.value.toUpperCase() })} /></div>
        </div>
      </section>
      <section className="booking-section space-y-2">
        <h4 className="booking-step"><span>2</span>Vehicle and container</h4>
        <div className="flex flex-wrap gap-1.5">{CONTAINER_GROUPS.map(g => <Button type="button" key={g.value} size="sm" variant="outline" aria-pressed={containerGroup(form.container_type || "")?.value === g.value} className="booking-container-choice" onClick={() => setForm({ ...form, container_type: g.value, container_size: "" })}>{g.label}</Button>)}</div>
        {sizeOptions.length > 0 && <div className="space-y-1.5 pt-1"><Label className="text-xs">{form.container_type === "Artic" ? "Trailer type" : "Container type"}</Label><div className="flex flex-wrap gap-1.5">{sizeOptions.map(o => <Button type="button" key={o.size_code} size="sm" variant="outline" aria-pressed={form.container_size === o.size_code} className="booking-container-choice" onClick={() => setForm({ ...form, container_size: o.size_code })}>{o.display_name}</Button>)}</div></div>}
      </section>
      <section className="booking-section space-y-3">
        <h4 className="booking-step"><span>3</span>Waste</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label className="text-xs">EWC code</Label><EwcCodePicker value={form.ewc_code || ""} onChange={v => setForm({ ...form, ewc_code: v })} /></div><div><Label className="text-xs">Waste type</Label><Input aria-label="Waste type" value={form.waste_type || ""} onChange={e => setForm({ ...form, waste_type: e.target.value })} placeholder="Mixed waste" /></div></div>
      </section>
      <section className="booking-section space-y-3">
        <h4 className="booking-step"><span>4</span>Schedule</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs" htmlFor="wo-date">Date</Label><Input id="wo-date" type="date" value={form.scheduled_date || ""} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} /></div>
          <div><Label className="text-xs">Driver</Label><Select value={form.assigned_driver_id || "unassigned"} onValueChange={v => setForm({ ...form, assigned_driver_id: v === "unassigned" ? "" : v })}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.driver_name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Load cost estimate (optional)</Label>
          <div className="flex flex-wrap items-center gap-2">
            {([["", "None"], ["gate_fee", "Gate fee"], ["rebate", "Rebate"]] as const).map(([v, l]) => <Button key={l} type="button" size="sm" variant="outline" aria-pressed={(form.waste_out_estimate_type || "") === v} className="booking-container-choice" onClick={() => setForm({ ...form, waste_out_estimate_type: v, waste_out_estimate_per_tonne: v ? form.waste_out_estimate_per_tonne : "" })}>{l}</Button>)}
            {form.waste_out_estimate_type && <><Input aria-label="Rate per tonne" type="number" step="0.01" className="w-28" value={form.waste_out_estimate_per_tonne ?? ""} onChange={e => setForm({ ...form, waste_out_estimate_per_tonne: e.target.value })} placeholder="£ / tonne" /><Input aria-label="Estimated tonnes" type="number" step="0.01" className="w-28" value={form.weight_included_t ?? ""} onChange={e => setForm({ ...form, weight_included_t: e.target.value })} placeholder="Est. tonnes" /></>}
          </div>
          {est && <p className="text-sm">{est.type === "gate_fee" ? "Estimated cost" : "Estimated rebate"}: <strong>{money(est.total)}</strong> <span className="text-muted-foreground">— a guide only, never invoiced.</span></p>}
        </div>
        <div><Label className="text-xs">Notes (optional)</Label><Textarea aria-label="Booking notes" value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      </section>
    </div>
  );
}
