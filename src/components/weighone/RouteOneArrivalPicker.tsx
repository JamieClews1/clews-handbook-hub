import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { Search, Truck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ArrivingJob {
  id: string;
  job_number: string | null;
  scheduled_date: string;
  customer_name: string;
  site_name: string | null;
  site_postcode: string | null;
  vehicle_reg: string | null;
  container_type: string | null;
  container_size: string | null;
  waste_type: string | null;
  ewc_code: string | null;
  po_number: string | null;
  charge_per_tonne: number | null;
  status: string;
  driver_name: string | null;
  weigh_count: number;
  job_type: string | null;
  destination_name: string | null;
}

/** Search RouteOne jobs (today ± 2 days) arriving at the weighbridge, so nothing is retyped. */
export function RouteOneArrivalPicker({ selected, onPick, onClear, vehicleReg, compact = false }: {
  selected: ArrivingJob | null;
  onPick: (job: ArrivingJob) => void;
  onClear: () => void;
  vehicleReg?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ArrivingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const term = (q || vehicleReg || "").trim();

  useEffect(() => {
    if (selected) return;
    const t = setTimeout(async () => {
      setLoading(true);
      const from = format(addDays(new Date(), -2), "yyyy-MM-dd");
      const to = format(addDays(new Date(), 2), "yyyy-MM-dd");
      let query = supabase
        .from("route_one_jobs")
        .select("id, job_number, scheduled_date, customer_name, site_name, site_postcode, vehicle_reg, container_type, container_size, waste_type, ewc_code, po_number, charge_per_tonne, status, job_type, destination_name, route_one_drivers(driver_name), route_one_job_weighings(id)")
        .gte("scheduled_date", from).lte("scheduled_date", to)
        .neq("status", "unassigned")
        .order("scheduled_date", { ascending: false })
        .limit(12);
      if (term) {
        const s = term.replace(/[%,()]/g, " ");
        query = query.or(`job_number.ilike.%${s}%,customer_name.ilike.%${s}%,site_name.ilike.%${s}%,vehicle_reg.ilike.%${s.replace(/\s/g, "")}%,site_postcode.ilike.%${s}%`);
      }
      const { data } = await query;
      setResults(((data ?? []) as any[]).map(j => ({ ...j, driver_name: j.route_one_drivers?.driver_name ?? null, weigh_count: j.route_one_job_weighings?.length ?? 0 })));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [term, selected]);

  if (selected) {
    return (
      <div className="rounded-md border border-primary/40 bg-primary/5 p-2 text-sm flex items-center gap-2">
        <Truck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground"><KindBadge job={selected} /> RouteOne job {selected.job_number} · {selected.job_type === "waste_out_skip" ? `to ${selected.destination_name || "tipping site"}` : selected.customer_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {[selected.site_name, selected.waste_type, selected.driver_name, selected.vehicle_reg].filter(Boolean).join(" · ")}
            {selected.weigh_count > 0 && ` · ${selected.weigh_count} earlier ticket${selected.weigh_count > 1 ? "s" : ""} on this job`}
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClear} aria-label="Unlink RouteOne job"><X className="h-4 w-4" /></Button>
      </div>
    );
  }

  if (compact && !expanded) return <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}><Search className="h-4 w-4 mr-2" /> Find arriving job</Button>;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="h-9 pl-8" placeholder="RouteOne job arriving? Search job no., reg, customer…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="max-h-44 overflow-y-auto rounded-md border divide-y">
        {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
        {!loading && results.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No RouteOne jobs found for today ± 2 days</div>}
        {results.map(j => (
          <button key={j.id} type="button" onClick={() => onPick(j)} className="w-full text-left px-3 py-1.5 hover:bg-muted text-sm">
            <KindBadge job={j} /> <span className="font-semibold text-foreground">{j.job_number ?? "—"}</span> · {j.job_type === "waste_out_skip" ? `to ${j.destination_name || "tipping site"}` : j.customer_name}
            <span className="block text-xs text-muted-foreground truncate">
              {format(new Date(`${j.scheduled_date}T00:00:00`), "EEE d MMM")} · {[j.site_name, j.waste_type, j.driver_name, j.vehicle_reg].filter(Boolean).join(" · ")}
              {j.weigh_count > 0 && ` · ${j.weigh_count} ticket${j.weigh_count > 1 ? "s" : ""}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Distinguishes a customer ticket from a Waste Out load at the weighbridge. */
function KindBadge({ job }: { job: Pick<ArrivingJob, "job_type"> }) {
  const out = job.job_type === "waste_out_skip";
  return <Badge variant={out ? "secondary" : "outline"} className={out ? "bg-[hsl(var(--warning-subtle))] text-[hsl(var(--warning-text))] border-transparent" : ""}>{out ? "Waste Out" : "Customer"}</Badge>;
}
