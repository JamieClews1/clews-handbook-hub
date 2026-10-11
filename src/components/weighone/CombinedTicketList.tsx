import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RefreshCw, Search } from "lucide-react";
import { fetchAllRows } from "@/lib/fetch-all";
import { combineTickets, ticketWeightTonnes, type CombinedTicket } from "@/lib/weighone-ticket-list";
import { parseLoadReportDate } from "@/lib/load-report-dates";
import { JobPhotosSection } from "@/components/route-one/JobPhotosSection";
import { WeighbridgeAttachments } from "./WeighbridgeAttachments";
import type { Database } from "@/integrations/supabase/types";

type RouteJob = Database["public"]["Tables"]["route_one_jobs"]["Row"];
type HubJob = Database["public"]["Tables"]["data_hub_jobs"]["Row"];

const dateLabel = (date: string | null) => parseLoadReportDate(date)?.toLocaleDateString("en-GB", { timeZone: "UTC" }) ?? "—";

export function CombinedTicketList() {
  const now = new Date();
  const [start, setStart] = useState(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`);
  const [end, setEnd] = useState(now.toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const client = useQueryClient();
  const invalidDates = !start || !end || start > end;
  const { data: tickets = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["weighone-combined-tickets", start, end],
    enabled: !invalidDates,
    queryFn: async () => {
      const [routeJobs, hubJobs] = await Promise.all([
        fetchAllRows<RouteJob>("route_one_jobs", "*", "id", q => q.gte("scheduled_date", start).lte("scheduled_date", end)),
        fetchAllRows<HubJob>("data_hub_jobs", "id, source, job_number, job_date, customer, site, vehicle_registration, driver, waste_description, ewc, movement_type, weight_t, raw", "id", q => q.in("source", ["midweigh", "skiptrak"]).gte("job_date", start).lte("job_date", end)),
      ]);
      const nativeNumbers = new Set(routeJobs.map(job => job.job_number.trim().toUpperCase()));
      return combineTickets(
        routeJobs.map((job): CombinedTicket => ({
          id: job.id, source: "routeone", ticket: job.weighbridge_ticket_number || job.job_number,
          date: job.scheduled_date, customer: job.customer_name, site: job.site_name || job.site_address,
          vehicle: job.vehicle_reg, driver: job.driver_signoff_name, waste: job.waste_type,
          ewc: job.ewc_code, movement: job.job_type, status: job.status,
          weightTonnes: ticketWeightTonnes(job.outbound_weight_t, "routeone"), transactionId: job.weighbridge_transaction_id,
        })),
        hubJobs.filter(job => job.source !== "skiptrak" || !nativeNumbers.has(job.job_number.trim().toUpperCase())).map((job): CombinedTicket => ({
          id: job.id, source: job.source === "midweigh" ? "midweigh" : "skiptrak", ticket: job.job_number, date: job.job_date,
          customer: job.customer, site: job.site, vehicle: job.vehicle_registration,
          driver: job.driver, waste: job.waste_description, ewc: job.ewc,
          movement: job.movement_type, status: null,
          weightTonnes: ticketWeightTonnes(job.weight_t, job.source === "midweigh" ? "midweigh" : "skiptrak"), raw: job.raw,
        })),
      );
    },
    refetchInterval: 60000,
  });

  useEffect(() => {
    const channel = supabase.channel("weighone-combined-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "route_one_jobs" }, () => client.invalidateQueries({ queryKey: ["weighone-combined-tickets"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "data_hub_jobs" }, () => client.invalidateQueries({ queryKey: ["weighone-combined-tickets"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client]);

  const filtered = useMemo(() => tickets.filter(ticket => {
    const term = search.trim().toLowerCase();
    return (source === "all" || (source === "routeone" ? ticket.source !== "midweigh" : ticket.source === source)) && (!term || [ticket.ticket, ticket.customer, ticket.vehicle, ticket.site, ticket.waste, ticket.driver, ticket.ewc].some(value => value?.toLowerCase().includes(term)));
  }), [tickets, search, source]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search combined tickets" placeholder="Search ticket, customer, vehicle, waste…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <label className="space-y-1 text-xs text-muted-foreground">From<Input aria-label="Tickets from date" type="date" value={start} onChange={e => setStart(e.target.value)} className="w-40" /></label>
        <label className="space-y-1 text-xs text-muted-foreground">To<Input aria-label="Tickets to date" type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-40" /></label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger aria-label="Ticket source" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All sources</SelectItem><SelectItem value="routeone">RouteOne</SelectItem><SelectItem value="midweigh">Midweigh</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" size="icon" aria-label="Refresh tickets" title="Refresh tickets" onClick={() => refetch()} disabled={isFetching || invalidDates}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button>
      </div>
      <p className="text-sm text-muted-foreground">{filtered.length.toLocaleString()} tickets · {tickets.filter(t => t.source !== "midweigh").length.toLocaleString()} RouteOne · {tickets.filter(t => t.source === "midweigh").length.toLocaleString()} Midweigh</p>
      {invalidDates ? <p role="alert" className="text-destructive">Choose a valid date range.</p> : error ? <div role="alert" className="text-destructive">Tickets could not be loaded. <Button variant="outline" onClick={() => refetch()}>Retry</Button></div> : isLoading ? <p className="py-10 text-center text-muted-foreground">Loading tickets…</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Source</TableHead><TableHead>Date</TableHead><TableHead>Customer / Site</TableHead><TableHead>Vehicle</TableHead><TableHead>Waste</TableHead><TableHead>Movement / Status</TableHead><TableHead className="text-right">Net (t)</TableHead><TableHead className="w-12">Details</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map(ticket => {
              const key = `${ticket.source}:${ticket.id}`;
              const open = expanded === key;
              return <Fragment key={key}>
                <TableRow>
                  <TableCell className="font-mono font-semibold">{ticket.ticket}</TableCell>
                  <TableCell><Badge variant={ticket.source !== "midweigh" ? "secondary" : "outline"}>{ticket.source === "midweigh" ? "Midweigh" : ticket.source === "skiptrak" ? "RouteOne · Skiptrak" : "RouteOne"}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateLabel(ticket.date)}</TableCell>
                  <TableCell className="min-w-44"><p>{ticket.customer || "—"}</p><p className="text-xs text-muted-foreground">{ticket.site}</p></TableCell>
                  <TableCell className="whitespace-nowrap font-mono">{ticket.vehicle || "—"}</TableCell>
                  <TableCell className="min-w-40">{ticket.waste || "—"}<p className="text-xs text-muted-foreground">{ticket.ewc}</p></TableCell>
                  <TableCell className="text-xs"><p>{ticket.movement?.replace(/_/g, " ") || "—"}</p><p className="text-muted-foreground">{ticket.status?.replace(/_/g, " ")}</p></TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{ticket.weightTonnes?.toFixed(3) ?? "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" aria-label={`${open ? "Hide" : "View"} ${ticket.source !== "midweigh" ? "RouteOne" : "Midweigh"} ticket ${ticket.ticket}`} aria-expanded={open} onClick={() => setExpanded(open ? null : key)}>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></TableCell>
                </TableRow>
                {open && <TableRow><TableCell colSpan={9} className="bg-muted/30">
                  <div className="space-y-3 p-2"><p><span className="text-muted-foreground">Driver: </span>{ticket.driver || "—"}</p>
                    {ticket.source === "routeone" && <JobPhotosSection jobId={ticket.id} />}
                    {ticket.transactionId && <WeighbridgeAttachments transactionId={ticket.transactionId} />}
                    {ticket.raw && typeof ticket.raw === "object" && !Array.isArray(ticket.raw) ? <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(ticket.raw).filter(([, value]) => value != null && value !== "").map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl> : null}
                  </div>
                </TableCell></TableRow>}
              </Fragment>;
            })}
            {!filtered.length && <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">No tickets found for this period.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </div>
  );
}