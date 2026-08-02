import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Job = {
  id: string;
  job_number: string;
  source: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  movement_type: string | null;
  container_type: string | null;
  ewc: string | null;
  waste_description: string | null;
  weight_t: number | null;
  vehicle_registration: string | null;
  driver: string | null;
  tipping_location: string | null;
  raw: any;
};

type Position = {
  key: string;
  containerType: string;
  ewc: string;
  wasteDescription: string;
  jobs: Job[];
  delivered: number;
  collected: number;
  exchanges: number;
  tipReturns: number;
  onSite: number;
  lastMovement: Job | null;
};

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

const movementVariant = (m: string | null) => {
  const v = (m || "").toLowerCase();
  if (v.includes("deliver")) return "default" as const;
  if (v.includes("collect")) return "secondary" as const;
  return "outline" as const;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteName: string;
  customerName: string;
  dataHubCustomer: string | null;
  dataHubSites: string[];
}

export function SiteHistoryDialog({
  open,
  onOpenChange,
  siteName,
  customerName,
  dataHubCustomer,
  dataHubSites,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const siteNames = Array.from(
        new Set([siteName, ...dataHubSites].map((s) => (s || "").trim()).filter(Boolean)),
      );

      const cols =
        "id,job_number,source,job_date,customer,site,movement_type,container_type,ewc,waste_description,weight_t,vehicle_registration,driver,tipping_location,raw";

      let query = supabase.from("data_hub_jobs").select(cols).limit(2000);
      if (siteNames.length > 0) {
        query = query.in("site", siteNames);
      } else if (dataHubCustomer) {
        query = query.eq("customer", dataHubCustomer).is("site", null);
      }
      if (dataHubCustomer) query = query.eq("customer", dataHubCustomer);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        console.error("[SiteHistory] load failed", error);
        setJobs([]);
      } else {
        const rows = (data ?? []) as unknown as Job[];
        rows.sort((a, b) => (b.job_date ?? "").localeCompare(a.job_date ?? ""));
        setJobs(rows);
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, siteName, dataHubCustomer, JSON.stringify(dataHubSites)]);

  const positions = useMemo<Position[]>(() => {
    const map = new Map<string, Position>();
    for (const j of jobs) {
      const containerType = (j.container_type || "Unspecified").trim();
      const ewc = (j.ewc || "").trim();
      const key = `${containerType}::${ewc}`;
      let p = map.get(key);
      if (!p) {
        p = {
          key,
          containerType,
          ewc,
          wasteDescription: j.waste_description || "",
          jobs: [],
          delivered: 0,
          collected: 0,
          exchanges: 0,
          tipReturns: 0,
          onSite: 0,
          lastMovement: null,
        };
        map.set(key, p);
      }
      p.jobs.push(j);
      if (!p.wasteDescription && j.waste_description) p.wasteDescription = j.waste_description;
      const m = (j.movement_type || "").toLowerCase();
      if (m.includes("deliver")) p.delivered += 1;
      else if (m.includes("collect")) p.collected += 1;
      else if (m.includes("exchange")) p.exchanges += 1;
      else if (m.includes("tip")) p.tipReturns += 1;
    }

    const list = Array.from(map.values());
    for (const p of list) {
      p.jobs.sort((a, b) => (b.job_date ?? "").localeCompare(a.job_date ?? ""));
      p.lastMovement = p.jobs[0] ?? null;
      p.onSite = Math.max(0, p.delivered - p.collected);
    }
    list.sort((a, b) => {
      if (a.onSite !== b.onSite) return b.onSite - a.onSite;
      return (b.lastMovement?.job_date ?? "").localeCompare(a.lastMovement?.job_date ?? "");
    });
    return list;
  }, [jobs]);

  const totalLive = positions.reduce((sum, p) => sum + p.onSite, 0);
  const totalExchanges = positions.reduce((sum, p) => sum + p.exchanges + p.tipReturns, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Site history — {siteName}</DialogTitle>
            <DialogDescription>
              {customerName}
              {dataHubCustomer && dataHubCustomer !== customerName ? ` (Data Hub: ${dataHubCustomer})` : ""}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading site history…</p>
          ) : jobs.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No Data Hub jobs found for this site. Check the Data Hub customer/site mapping.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Live on site now</p>
                  <p className="text-2xl font-semibold">{totalLive}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Exchanges / tip &amp; returns</p>
                  <p className="text-2xl font-semibold">{totalExchanges}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total jobs</p>
                  <p className="text-2xl font-semibold">{jobs.length}</p>
                </div>
              </div>

              <Accordion type="multiple" className="w-full">
                {positions.map((p) => (
                  <AccordionItem key={p.key} value={p.key}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 flex-wrap items-center gap-2 pr-3 text-left">
                        <span className="font-medium">{p.containerType}</span>
                        {p.ewc && <Badge variant="outline">EWC {p.ewc}</Badge>}
                        {p.wasteDescription && (
                          <span className="text-sm text-muted-foreground">{p.wasteDescription}</span>
                        )}
                        <span className="ml-auto flex items-center gap-2">
                          {p.onSite > 0 ? (
                            <Badge>{p.onSite} on site</Badge>
                          ) : (
                            <Badge variant="secondary">Cleared</Badge>
                          )}
                          <Badge variant="outline">{p.exchanges + p.tipReturns} exchanges</Badge>
                          <span className="text-xs text-muted-foreground">
                            Last {fmtDate(p.lastMovement?.job_date ?? null)}
                          </span>
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Job no.</TableHead>
                              <TableHead>Movement</TableHead>
                              <TableHead>Weight (t)</TableHead>
                              <TableHead>Vehicle</TableHead>
                              <TableHead className="w-[90px]">Details</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {p.jobs.map((j) => (
                              <TableRow
                                key={j.id}
                                className="cursor-pointer"
                                onClick={() => setSelectedJob(j)}
                              >
                                <TableCell>{fmtDate(j.job_date)}</TableCell>
                                <TableCell className="font-medium">{j.job_number}</TableCell>
                                <TableCell>
                                  <Badge variant={movementVariant(j.movement_type)}>
                                    {j.movement_type || "—"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{j.weight_t != null ? j.weight_t.toFixed(2) : "—"}</TableCell>
                                <TableCell>{j.vehicle_registration || "—"}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedJob(j);
                                    }}
                                  >
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedJob} onOpenChange={(o) => !o && setSelectedJob(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job {selectedJob?.job_number}</DialogTitle>
            <DialogDescription>
              {selectedJob?.source} · {fmtDate(selectedJob?.job_date ?? null)}
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Customer", selectedJob.customer],
                  ["Site", selectedJob.site],
                  ["Movement", selectedJob.movement_type],
                  ["Container", selectedJob.container_type],
                  ["EWC", selectedJob.ewc],
                  ["Waste", selectedJob.waste_description],
                  ["Weight (t)", selectedJob.weight_t != null ? selectedJob.weight_t.toFixed(2) : null],
                  ["Vehicle", selectedJob.vehicle_registration],
                  ["Driver", selectedJob.driver],
                  ["Tipping location", selectedJob.tipping_location],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{(value as string) || "—"}</dd>
                  </div>
                ))}
              </dl>
              {selectedJob.raw && typeof selectedJob.raw === "object" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Raw record</p>
                  <div className="rounded-md border border-border p-3 max-h-64 overflow-auto">
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(selectedJob.raw as Record<string, unknown>).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="font-medium break-words">{v == null || v === "" ? "—" : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
