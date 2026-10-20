import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { metalDispatchDestination, preferredMetalDestination } from "@/lib/metals";
import { getTodayLoadReportDate, parseLoadReportDate } from "@/lib/load-report-dates";
import { Loader2, Truck } from "lucide-react";

type Grade = { id: string; name: string; is_active: boolean; price_per_tonne: number; preferred_destination?: string | null };
type Buyer = { id: string; name: string; is_active: boolean };
type Price = { grade_id: string; buyer_id: string | null; price_per_tonne: number };

export function MetalDispatchForm({ data, initialGradeId = "", onSaved }: { data: { grades: Grade[]; buyers: Buyer[]; prices: Price[] }; initialGradeId?: string; onSaved: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [gradeId, setGradeId] = useState(initialGradeId);
  const [date, setDate] = useState(getTodayLoadReportDate);
  const [time, setTime] = useState("");
  const [destination, setDestination] = useState(() => preferredMetalDestination(data.grades, initialGradeId));
  const [remember, setRemember] = useState(true);
  const [weight, setWeight] = useState("");
  const [buyerId, setBuyerId] = useState("none");
  const [price, setPrice] = useState(String(data.grades.find(g => g.id === initialGradeId)?.price_per_tonne ?? 0));
  const [salesRef, setSalesRef] = useState("");
  const [ticket, setTicket] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const updatePrice = (grade: string, buyer: string) => setPrice(String(data.prices.find(p => p.grade_id === grade && p.buyer_id === buyer)?.price_per_tonne ?? data.grades.find(g => g.id === grade)?.price_per_tonne ?? 0));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !user || !gradeId || !destination.trim() || !parseLoadReportDate(date) || !Number.isFinite(Number(weight)) || Number(weight) <= 0 || !Number.isFinite(Number(price))) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("nf_dispatches").insert({
        grade_id: gradeId, dispatch_date: date, dispatch_time: time || null,
        ...metalDispatchDestination(destination, remember),
        weight_kg: Number(weight), buyer_id: buyerId === "none" ? null : buyerId,
        price_per_tonne: Number(price), sales_ref: salesRef.trim() || null,
        weighbridge_ticket: ticket.trim() || null, notes: notes.trim() || null, created_by: user.id,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["nf-all"] });
      toast({ title: "Dispatch recorded", description: remember ? "Preferred destination saved for this metal type." : undefined });
      onSaved();
    } catch (error) {
      toast({ title: "Dispatch not saved", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  };
  return <form onSubmit={save} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dispatch-grade">Metal type</Label><Select value={gradeId} onValueChange={id => { setGradeId(id); setDestination(preferredMetalDestination(data.grades, id)); updatePrice(id, buyerId); }}><SelectTrigger id="dispatch-grade"><SelectValue placeholder="Choose metal type" /></SelectTrigger><SelectContent>{data.grades.filter(g => g.is_active).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="dispatch-date">Date leaving site</Label><Input id="dispatch-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="dispatch-time">Time (optional)</Label><Input id="dispatch-time" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dispatch-destination">Destination site</Label><Input id="dispatch-destination" required list="metal-destinations" placeholder="Company / receiving site" value={destination} onChange={e => setDestination(e.target.value)} /><datalist id="metal-destinations">{[...new Set(data.grades.map(g => g.preferred_destination).filter(Boolean))].map(site => <option key={site} value={site ?? ""} />)}</datalist></div>
      <div className="flex items-center gap-2 sm:col-span-2"><Checkbox id="dispatch-remember" checked={remember} onCheckedChange={value => setRemember(value === true)} /><Label htmlFor="dispatch-remember">Preferred destination for this metal type</Label></div>
      <div className="space-y-1.5"><Label htmlFor="dispatch-weight">Weight (kg)</Label><Input id="dispatch-weight" type="number" min="0.001" step="any" required value={weight} onChange={e => setWeight(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="dispatch-price">Price (£ per tonne)</Label><Input id="dispatch-price" type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} /></div>
    </div>
    <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Sale details & notes (optional)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dispatch-buyer">Buyer</Label><Select value={buyerId} onValueChange={id => { setBuyerId(id); updatePrice(gradeId, id); }}><SelectTrigger id="dispatch-buyer"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No buyer recorded</SelectItem>{data.buyers.filter(b => b.is_active).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="dispatch-reference">Sales reference</Label><Input id="dispatch-reference" value={salesRef} onChange={e => setSalesRef(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="dispatch-ticket">Weighbridge ticket</Label><Input id="dispatch-ticket" value={ticket} onChange={e => setTicket(e.target.value)} /></div>
      <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dispatch-notes">Notes</Label><Input id="dispatch-notes" value={notes} onChange={e => setNotes(e.target.value)} /></div>
    </div></details>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="font-semibold">Sale value: £{((Number(weight) || 0) / 1000 * (Number(price) || 0)).toFixed(2)}</span><Button type="submit" disabled={saving || !user || !gradeId || !destination.trim() || !(Number(weight) > 0)} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}Save dispatch</Button></div>
  </form>;
}