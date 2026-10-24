import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Printer } from "lucide-react";
import { fetchAllRows } from "@/lib/fetch-all";
import { buildDaySheet, type DaySheetJob } from "@/lib/route-day-sheet";

export function DaySheetPrintDialog({ date, drivers, externalOpen, onExternalOpenChange, hideTrigger }: { date: string; drivers: { id: string; driver_name: string }[]; externalOpen?: boolean; onExternalOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = externalOpen || localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onExternalOpenChange?.(value); };
  const [driver, setDriver] = useState("all");
  const [error, setError] = useState("");
  const { data: jobs = [], isLoading, error: loadError } = useQuery({
    queryKey: ["route-day-print", date, drivers.map(d => d.id).join(",")], enabled: open,
    queryFn: async () => {
      const [native, imported] = await Promise.all([
        fetchAllRows<any>("route_one_jobs", "*", "display_order", q => q.eq("scheduled_date", date).order("id")),
        fetchAllRows<any>("data_hub_jobs", "*", "id", q => q.eq("source", "skiptrak").eq("job_date", date)),
      ]);
      const numbers = new Set(native.map(j => String(j.job_number).trim().toUpperCase()));
      return [
        ...native.map((j): DaySheetJob => ({ source: "routeone", id: j.id, number: j.job_number, driver: drivers.find(d => d.id === j.assigned_driver_id)?.driver_name ?? "Unassigned", vehicle: j.vehicle_reg ?? "", customer: j.customer_name, address: [j.site_name, j.site_address, j.site_address_2, j.site_area, j.site_postcode].filter(Boolean).join(", "), type: j.job_type, container: [j.container_size, j.container_type].filter(Boolean).join(" "), waste: j.waste_type ?? "", po: j.po_number ?? "", notes: [j.notes, j.directions, j.site_contact_name, j.site_contact_phone].filter(Boolean).join(" | ") })),
        ...imported.filter(j => !numbers.has(String(j.job_number).trim().toUpperCase())).map((j): DaySheetJob => {
          const normalized = String(j.driver ?? "").toLowerCase().replace(/[^a-z]/g, "");
          const match = drivers.find(d => d.driver_name.toLowerCase().replace(/[^a-z]/g, "") === normalized);
          return { source: "skiptrak", id: j.id, number: j.job_number, driver: match?.driver_name ?? j.driver ?? "Unassigned", vehicle: j.vehicle_registration ?? "", customer: j.customer ?? "", address: [j.site, j.postcode].filter(Boolean).join(", "), type: j.movement_type ?? "", container: j.container_type ?? "", waste: j.waste_description ?? "", po: j.order_number_override ?? "", notes: j.tipping_location ? `Tip: ${j.tipping_location}` : "" };
        }),
      ];
    },
  });
  const names = [...new Set(jobs.map(j => j.driver))].sort();
  const selected = driver === "all" ? jobs : jobs.filter(j => j.driver === driver);
  const print = () => {
    const win = window.open("", "_blank");
    if (!win) { setError("Allow pop-ups to print job sheets."); return; }
    const doc = buildDaySheet(date, selected);
    doc.autoPrint();
    win.location.href = URL.createObjectURL(doc.output("blob"));
  };
  return <Dialog open={open} onOpenChange={setOpen}>{!hideTrigger && <DialogTrigger asChild><Button variant="outline" size="sm" className="h-9 gap-1.5"><Printer className="h-4 w-4" />Job sheets</Button></DialogTrigger>}
    <DialogContent><DialogHeader><DialogTitle>Print daily job sheets — {date}</DialogTitle></DialogHeader>
      <Select value={driver} onValueChange={setDriver}><SelectTrigger aria-label="Job sheet driver"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All drivers</SelectItem>{names.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>
      <p className="text-sm text-foreground">{isLoading ? "Loading day's jobs…" : `${selected.length} jobs`}</p>
      {(error || loadError) && <p role="alert" className="text-destructive">{error || "Unable to load job sheets. Close and retry."}</p>}
      <Button onClick={print} disabled={isLoading || !!loadError || !selected.length} className="gap-2"><Printer className="h-4 w-4" />Print job sheets</Button>
    </DialogContent></Dialog>;
}