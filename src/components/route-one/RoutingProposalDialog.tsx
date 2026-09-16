import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowRight, Loader2, Truck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { planDay, type PlannerDriver, type PlannerJob } from "@/lib/route-planner";
import { useRoutingRules } from "@/hooks/useRoutingRules";
import { usePostcodeCoords } from "@/hooks/usePostcodeCoords";
import { usePostcodeZoneLookup } from "@/hooks/usePostcodeZoneLookup";


type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: PlannerJob[];
  drivers: PlannerDriver[];
  dateLabel: string;
  onApplied: () => void;
};

export const RoutingProposalDialog = ({ open, onOpenChange, jobs, drivers, dateLabel, onApplied }: Props) => {
  const { rules } = useRoutingRules();
  const [applying, setApplying] = useState(false);
  const { zoneFor } = usePostcodeZoneLookup();

  const postcodes = useMemo(
    () => [rules.yard_postcode, ...jobs.map(j => j.postcode)],
    [jobs, rules.yard_postcode],
  );
  const { coords, loading: coordsLoading } = usePostcodeCoords(postcodes, open && rules.travel_model === "distance");

  // Drivers can swap vehicles — their set-up vehicle is only the default for the day.
  const { data: vehicles = [] } = useQuery({
    queryKey: ["route-one-vehicles-all"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_vehicles")
        .select("id, registration, vehicle_type")
        .eq("is_active", true)
        .order("registration");
      if (error) throw error;
      return data as { id: string; registration: string; vehicle_type: string }[];
    },
  });

  // driverId -> vehicle registration chosen for today ("" = no vehicle)
  const [vehicleChoice, setVehicleChoice] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) setVehicleChoice({});
  }, [open]);

  const hasWorkToday = useMemo(() => {
    const n = (v: string | null) => (v ?? "").toLowerCase().trim();
    return (d: PlannerDriver) =>
      jobs.some(j => j.currentDriverId === d.id || (j.currentDriverName && n(j.currentDriverName) === n(d.name)));
  }, [jobs]);

  const effectiveDrivers = useMemo(
    () =>
      drivers.map(d => {
        const reg = vehicleChoice[d.id];
        if (reg === undefined) return d;
        const v = vehicles.find(x => x.registration === reg);
        return { ...d, registration: v?.registration ?? null, vehicleType: v?.vehicle_type ?? null };
      }),
    [drivers, vehicleChoice, vehicles],
  );

  const plan = useMemo(
    () => planDay(jobs, effectiveDrivers, rules, { coords, zoneFor }),
    [jobs, effectiveDrivers, rules, coords, zoneFor],
  );


  const currentByDriver = useMemo(() => {
    const map = new Map<string, PlannerJob[]>();
    for (const j of jobs) {
      const key = j.currentDriverId || (j.currentDriverName ? `name:${j.currentDriverName.toLowerCase().trim()}` : "unassigned");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    }
    return map;
  }, [jobs]);

  const currentCountFor = (d: PlannerDriver) =>
    (currentByDriver.get(d.id)?.length ?? 0) + (currentByDriver.get(`name:${d.name.toLowerCase().trim()}`)?.length ?? 0);

  const movedCount = plan.drivers.reduce((n, p) => n + p.jobs.filter(j => j.movedFrom !== null).length, 0);

  const apply = async () => {
    setApplying(true);
    try {
      for (const p of plan.drivers) {
        for (let i = 0; i < p.jobs.length; i++) {
          const j = p.jobs[i].job;
          if (j.source === "route_one") {
            const { error } = await supabase
              .from("route_one_jobs")
              .update({ assigned_driver_id: p.driver.id, status: "assigned", display_order: i })
              .eq("id", j.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("data_hub_jobs")
              .update({ driver: p.driver.name })
              .eq("id", j.id);
            if (error) throw error;
          }
        }
      }
      toast.success("Day reorganised");
      onApplied();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Could not apply the new plan");
    }
    setApplying(false);
  };

  const laneLabel = (lane: string) => (lane === "roro" ? "Ro-Ro" : lane === "artic" ? "Artic" : "Skip");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proposed day — {dateLabel}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{plan.drivers.length} drivers working</Badge>
          <Badge variant="outline">{jobs.length} jobs</Badge>
          <Badge variant="outline">{movedCount} changes</Badge>
          {plan.unplanned.length > 0 && <Badge variant="destructive">{plan.unplanned.length} unplaced</Badge>}
          <Badge variant="outline">
            {rules.travel_model === "distance"
              ? coordsLoading ? "Working out distances…" : "Travel by postcode distance"
              : rules.travel_model === "zone"
              ? "Travel by zone average"
              : "Flat travel allowance"}
          </Badge>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-3 space-y-2">
            <div>
              <p className="text-sm font-semibold">Which truck is each driver on today?</p>
              <p className="text-xs text-muted-foreground">
                Their usual truck is picked by default — change it here if they have swapped.
              </p>
            </div>
            <Separator />
            <div className="grid gap-2 sm:grid-cols-2">
              {drivers.filter(hasWorkToday).map(d => {
                const chosen = vehicleChoice[d.id] ?? d.registration ?? "";
                return (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="text-xs font-medium flex-1 truncate">{d.name}</span>
                    <Select
                      value={chosen || "none"}
                      onValueChange={v => setVehicleChoice(prev => ({ ...prev, [d.id]: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger className="h-8 w-[190px] text-xs">
                        <SelectValue placeholder="No vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No vehicle</SelectItem>
                        {vehicles.map(v => (
                          <SelectItem key={v.id} value={v.registration}>
                            {v.registration} ({v.vehicle_type})
                            {d.registration === v.registration ? " · usual" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
              {drivers.filter(hasWorkToday).length === 0 && (
                <p className="text-xs text-muted-foreground">No drivers have jobs booked today.</p>
              )}
            </div>
          </CardContent>
        </Card>



        {plan.warnings.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-3 space-y-1.5">
              {plan.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {plan.drivers.map(p => (
            <Card key={p.driver.id} className="border-border/60">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">{p.driver.name}</span>
                    {p.driver.registration && <Badge variant="outline" className="font-mono text-[10px]">{p.driver.registration}</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{laneLabel(p.lane)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span>{currentCountFor(p.driver)} now</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-medium text-foreground">{p.jobs.length} proposed</span>
                    <span>· ~{Math.round(p.totalMinutes / 60)}h</span>
                  </div>
                </div>
                <Separator />
                {p.jobs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No work allocated.</p>
                ) : (
                  <div className="space-y-1.5">
                    {p.jobs.map((pj, i) => (
                      <div key={pj.job.id} className="flex gap-3 text-xs">
                        <span className="font-mono text-muted-foreground w-24 shrink-0">{pj.start}–{pj.end}</span>
                        <span className="font-mono w-16 shrink-0">{pj.job.jobNumber}</span>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{pj.job.movement || "job"}</span>
                            <span className="text-muted-foreground">{pj.job.containerType}</span>
                            <span>{pj.job.customer}{pj.job.site ? ` — ${pj.job.site}` : ""}</span>
                            {pj.job.postcode && <Badge variant="outline" className="text-[10px] font-mono">{pj.job.postcode}</Badge>}
                            {pj.movedFrom !== null && <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/40" variant="outline">changed</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{pj.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {plan.unplanned.length > 0 && (
          <Card className="border-destructive/40">
            <CardContent className="p-3 space-y-1.5">
              <p className="text-sm font-semibold">Could not be placed</p>
              {plan.unplanned.map(u => (
                <div key={u.job.id} className="text-xs">
                  <span className="font-mono mr-2">{u.job.jobNumber}</span>
                  {u.job.customer} — <span className="text-muted-foreground">{u.reason}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {plan.notWorking.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <UserX className="h-3.5 w-3.5 mt-0.5" />
            <span>Treated as not working today (no jobs booked): {plan.notWorking.map(d => d.name).join(", ")}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={applying || plan.drivers.every(p => p.jobs.length === 0)}>
            {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply new plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
