import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Printer, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { buildDaySheet, type DaySheetJob } from "@/lib/route-day-sheet";
import { buildWtnBatch, type WtnJob } from "@/lib/route-one-wtn";
import { skiptrakWtnJob } from "@/lib/imported-ticket-print";
import { toast } from "sonner";

type Driver = { id: string; driver_name: string };
type Vehicle = { registration: string; vehicle_type: string };
interface DayJob { sheet: DaySheetJob; ticket: WtnJob; nativeId?: string }

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");

export function FinaliseDayDialog({ date: initialDate, drivers, vehicles, externalOpen, onExternalOpenChange, hideTrigger }: { date: string; drivers: Driver[]; vehicles: Vehicle[]; externalOpen?: boolean; onExternalOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const qc = useQueryClient();
  const [localOpen, setLocalOpen] = useState(false);
  const open = externalOpen || localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onExternalOpenChange?.(value); };
  const [date, setDate] = useState(initialDate);
  const [regs, setRegs] = useState<Record<string, string>>({});
  const [sheets, setSheets] = useState<Set<string>>(new Set());
  const [tickets, setTickets] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setDate(initialDate); }, [open, initialDate]);

  const { data, isLoading } = useQuery({
    queryKey: ["route-finalise-day", date], enabled: open && !!date,
    queryFn: async (): Promise<DayJob[]> => {
      const [native, imported] = await Promise.all([
        fetchAllRows<any>("route_one_jobs", "*", "display_order", q => q.eq("scheduled_date", date).order("id")),
        fetchAllRows<any>("data_hub_jobs", "*", "id", q => q.eq("source", "skiptrak").eq("job_date", date)),
      ]);
      const numbers = new Set(native.map(j => String(j.job_number).trim().toUpperCase()));
      return [
        ...native.map(j => {
          const driver = drivers.find(d => d.id === j.assigned_driver_id)?.driver_name ?? "Unassigned";
          return { nativeId: j.id, ticket: { ...j, driver_name: driver }, sheet: { source: "routeone", id: j.id, number: j.job_number, driver, vehicle: j.vehicle_reg ?? "", customer: j.customer_name, address: [j.site_name, j.site_address, j.site_address_2, j.site_area, j.site_postcode].filter(Boolean).join(", "), type: j.job_type, container: [j.container_size, j.container_type].filter(Boolean).join(" "), waste: j.waste_type ?? "", po: j.po_number ?? "", notes: [j.notes, j.directions, j.site_contact_name, j.site_contact_phone].filter(Boolean).join(" | ") } };
        }),
        ...imported.filter(j => !numbers.has(String(j.job_number).trim().toUpperCase())).map(j => {
          const driver = drivers.find(d => norm(d.driver_name) === norm(j.driver))?.driver_name ?? j.driver ?? "Unassigned";
          return { ticket: skiptrakWtnJob(j), sheet: { source: "skiptrak", id: j.id, number: j.job_number, driver, vehicle: j.vehicle_registration ?? "", customer: j.customer ?? "", address: [j.site, j.postcode].filter(Boolean).join(", "), type: j.movement_type ?? "", container: j.container_type ?? "", waste: j.waste_description ?? "", po: j.order_number_override ?? "", notes: j.tipping_location ? `Tip: ${j.tipping_location}` : "" } };
        }),
      ];
    },
  });

  const jobs = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => {
    const map = new Map<string, DayJob[]>();
    for (const j of jobs) map.set(j.sheet.driver, [...(map.get(j.sheet.driver) ?? []), j]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([driver, list]) => {
      const counts = new Map<string, number>();
      list.forEach(j => j.sheet.vehicle && counts.set(j.sheet.vehicle, (counts.get(j.sheet.vehicle) ?? 0) + 1));
      return { driver, list, vehicle: [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "" };
    });
  }, [jobs]);

  useEffect(() => {
    setRegs({}); setNotes({});
    const all = new Set(rows.map(r => r.driver));
    setSheets(all); setTickets(new Set(all));
  }, [rows]);

  const applied = (driver: string, vehicle: string) => regs[driver] ?? vehicle;
  const withVehicles = (list: DayJob[], driver: string, vehicle: string) => list.map(j => {
    const reg = applied(driver, vehicle);
    return { sheet: { ...j.sheet, vehicle: reg || j.sheet.vehicle }, ticket: { ...j.ticket, vehicle_reg: reg || j.ticket.vehicle_reg } };
  });
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => { const n = new Set(set); n.has(key) ? n.delete(key) : n.add(key); setter(n); };

  const finalise = async () => {
    setBusy(true);
    try {
      // 1. Save vehicle changes on RouteOne jobs only (imported Skiptrak jobs stay as uploaded).
      for (const r of rows) {
        const reg = regs[r.driver];
        if (!reg || reg === r.vehicle) continue;
        const ids = r.list.map(j => j.nativeId).filter(Boolean) as string[];
        if (ids.length) {
          const { error } = await supabase.from("route_one_jobs").update({ vehicle_reg: reg }).in("id", ids);
          if (error) throw error;
        }
      }
      qc.invalidateQueries({ queryKey: ["route-one-jobs"] });
      // 2 + 3. Print selections.
      const open = (blob: Blob) => { const w = window.open(URL.createObjectURL(blob), "_blank"); if (!w) toast.error("Allow pop-ups to print."); };
      const sheetJobs = rows.filter(r => sheets.has(r.driver)).flatMap(r => withVehicles(r.list, r.driver, r.vehicle).map(j => j.sheet));
      if (sheetJobs.length) { const doc = buildDaySheet(date, sheetJobs, notes); doc.autoPrint(); open(doc.output("blob")); }
      const ticketJobs = rows.filter(r => tickets.has(r.driver)).flatMap(r => withVehicles(r.list, r.driver, r.vehicle).map(j => j.ticket));
      const doc = await buildWtnBatch(ticketJobs);
      if (doc) { doc.autoPrint(); open(doc.output("blob")); }
      toast.success(`Day finalised for ${date}`);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Could not finalise the day");
    } finally { setBusy(false); }
  };

  const section = "rounded-lg border p-3 space-y-2";
  return <Dialog open={open} onOpenChange={setOpen}>
    {!hideTrigger && <DialogTrigger asChild><Button size="sm" variant="secondary" className="h-9 gap-1.5"><CheckCircle2 className="h-4 w-4" />Finalise Day</Button></DialogTrigger>}
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Finalise day</DialogTitle></DialogHeader>
      <div className="flex items-center gap-2"><span className="text-sm font-medium">Day being finalised</span><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" /></div>
      {isLoading ? <p className="text-sm">Loading jobs…</p> : !rows.length ? <p className="text-sm">No jobs on this day.</p> : <>
        <div className={section}>
          <h3 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-primary" />1. Are the vehicles correct?</h3>
          {rows.map(r => <div key={r.driver} className="flex items-center gap-3">
            <span className="w-48 truncate text-sm font-medium">{r.driver}</span>
            <span className="text-xs w-16">{r.list.length} jobs</span>
            <Select value={applied(r.driver, r.vehicle) || "none"} onValueChange={v => setRegs({ ...regs, [r.driver]: v === "none" ? "" : v })}>
              <SelectTrigger className="w-56 h-8" aria-label={`Vehicle for ${r.driver}`}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">No vehicle</SelectItem>{[...new Set([r.vehicle, ...vehicles.map(v => v.registration)].filter(Boolean))].sort().map(reg => <SelectItem key={reg} value={reg}>{reg}{vehicles.find(v => v.registration === reg) ? ` · ${vehicles.find(v => v.registration === reg)!.vehicle_type}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>)}
          <p className="text-xs">Changes are saved to RouteOne jobs; uploaded Skiptrak jobs only change on the printed paperwork.</p>
        </div>
        {([["2. What job sheets to print?", sheets, setSheets], ["3. What tickets do you want to print?", tickets, setTickets]] as const).map(([title, set, setter]) => <div key={title} className={section}>
          <div className="flex items-center justify-between"><h3 className="font-semibold">{title}</h3>
            <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setter(new Set(rows.map(r => r.driver)))}>All</Button><Button size="sm" variant="ghost" onClick={() => setter(new Set())}>None</Button></div></div>
          <div className="grid sm:grid-cols-2 gap-2">{rows.map(r => <label key={r.driver} className="flex items-center gap-2 text-sm"><Checkbox checked={set.has(r.driver)} onCheckedChange={() => toggle(set, setter, r.driver)} />{r.driver} ({r.list.length})</label>)}</div>
        </div>)}
        <div className={section}>
          <h3 className="font-semibold">Special notes to drivers</h3>
          <Textarea placeholder="Note for every driver's job sheet" value={notes["*"] ?? ""} onChange={e => setNotes({ ...notes, "*": e.target.value })} />
          {rows.filter(r => sheets.has(r.driver)).map(r => <Input key={r.driver} placeholder={`Note for ${r.driver}`} value={notes[r.driver] ?? ""} onChange={e => setNotes({ ...notes, [r.driver]: e.target.value })} />)}
        </div>
        <Button onClick={finalise} disabled={busy} className="w-full gap-2"><Printer className="h-4 w-4" />{busy ? "Finalising…" : "Save vehicles & print"}</Button>
      </>}
    </DialogContent>
  </Dialog>;
}
