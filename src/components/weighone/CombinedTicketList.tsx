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
import { MidweighPrintButton } from "./MidweighPrintButton";
import { SkiptrakPrintButton } from "./SkiptrakPrintButton";
import type { Database } from "@/integrations/supabase/types";

type RouteJob = Database["public"]["Tables"]["route_one_jobs"]["Row"];
type HubJob = Database["public"]["Tables"]["data_hub_jobs"]["Row"];

const dateLabel = (date: string | null) => parseLoadReportDate(date)?.toLocaleDateString("en-GB", { timeZone: "UTC" }) ?? "—";

/** First non-empty string among raw spreadsheet columns (used for postcode/address search). */
const rawStr = (raw: unknown, ...keys: string[]) => {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

export function CombinedTicketList({ tablet = false }: { tablet?: boolean }) {
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
          siteAddress: [job.site_address, job.site_address_2].filter(Boolean).join(", ") || null,
          postcode: job.site_postcode,
          vehicle: job.vehicle_reg, driver: job.driver_signoff_name, waste: job.waste_type,
          ewc: job.ewc_code, movement: job.job_type, status: job.status,
          weightTonnes: ticketWeightTonnes(job.outbound_weight_t, "routeone"), transactionId: job.weighbridge_transaction_id,
        })),
        hubJobs.filter(job => job.source !== "skiptrak" || !nativeNumbers.has(job.job_number.trim().toUpperCase())).map((job): CombinedTicket => ({
          id: job.id, source: job.source === "midweigh" ? "midweigh" : "skiptrak", ticket: job.job_number, date: job.job_date,
          customer: job.customer, site: job.site, vehicle: job.vehicle_registration,
          siteAddress: rawStr(job.raw, "Address 1", "Address 2", "Address 3", "Address 4", "Address 5", "Address 2nd LIne"),
          postcode: rawStr(job.raw, "Location Postc", "Location Postc_1", "Postcode"),
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
    return (source === "all" || (source === "routeone" ? ticket.source !== "midweigh" : ticket.source === source)) && (!term || [ticket.ticket, ticket.customer, ticket.vehicle, ticket.site, ticket.siteAddress, ticket.postcode, ticket.waste, ticket.driver, ticket.ewc].some(value => value?.toLowerCase().includes(term)));
  }), [tickets, search, source]);

  const shiftDays = (days: number) => {
    if (invalidDates) return;
    const move = (value: string) => {
      const d = new Date(`${value}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    setStart(move(start));
    setEnd(move(end));
  };

  return (
    <div className={`space-y-4 ${tablet ? "[&_input]:h-12 [&_button]:min-h-12 [&_[role=combobox]]:min-h-12" : ""}`}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search combined tickets" placeholder="Search ticket, customer, site, postcode, vehicle, waste…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" aria-label="Show previous day" title="Previous day" onClick={() => shiftDays(-1)} disabled={invalidDates}><ChevronLeft className="h-4 w-4" />Previous</Button>
        <label className="space-y-1 text-xs text-muted-foreground">From<Input aria-label="Tickets from date" type="date" value={start} onChange={e => setStart(e.target.value)} className="w-40" /></label>
        <label className="space-y-1 text-xs text-muted-foreground">To<Input aria-label="Tickets to date" type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-40" /></label>
        <Button variant="outline" size="sm" aria-label="Show next day" title="Next day" onClick={() => shiftDays(1)} disabled={invalidDates}>Next<ChevronRight className="h-4 w-4" /></Button>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger aria-label="Ticket source" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All sources</SelectItem><SelectItem value="routeone">RouteOne</SelectItem><SelectItem value="midweigh">Midweigh</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" size="icon" aria-label="Refresh tickets" title="Refresh tickets" onClick={() => refetch()} disabled={isFetching || invalidDates}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button>
      </div>
      <p className="text-sm text-muted-foreground">{filtered.length.toLocaleString()} tickets · {tickets.filter(t => t.source !== "midweigh").length.toLocaleString()} RouteOne · {tickets.filter(t => t.source === "midweigh").length.toLocaleString()} Midweigh</p>
      {invalidDates ? <p role="alert" className="text-destructive">Choose a valid date range.</p> : error ? <div role="alert" className="text-destructive">Tickets could not be loaded. <Button variant="outline" onClick={() => refetch()}>Retry</Button></div> : isLoading ? <p className="py-10 text-center text-muted-foreground">Loading tickets…</p> : (
        <>
        {tablet && <div className="divide-y divide-border border-y border-border">
          {filtered.map(ticket => {
            const key = `${ticket.source}:${ticket.id}`;
            const open = expanded === key;
            return <div key={key}>
              <Button variant="ghost" aria-expanded={open} aria-label={`View ticket ${ticket.ticket}`} onClick={() => setExpanded(open ? null : key)} className="h-auto min-h-24 w-full justify-start gap-3 rounded-none p-3 text-left whitespace-normal">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><span className="font-mono text-lg font-bold">#{ticket.ticket}</span><span className="font-mono">{ticket.vehicle || "—"}</span><span className="ml-auto tabular-nums">{ticket.weightTonnes?.toFixed(3) ?? "—"} t</span></div>
                  <p className="break-words text-base">{ticket.customer || "—"}</p>
                  <p className="break-words text-sm text-muted-foreground">{ticket.site} · {ticket.waste} · {dateLabel(ticket.date)}</p>
                </div>
                {open ? <ChevronUp /> : <ChevronDown />}
              </Button>
              {open && <div className="space-y-3 bg-muted/30 p-3"><p>Driver: {ticket.driver || "—"}</p>
                {ticket.source === "routeone" && <JobPhotosSection jobId={ticket.id} />}
                {ticket.source === "midweigh" && <MidweighPrintButton id={ticket.id} />}
                {ticket.source === "skiptrak" && <SkiptrakPrintButton id={ticket.id} />}
                {ticket.transactionId && <WeighbridgeAttachments transactionId={ticket.transactionId} />}
                {ticket.raw && typeof ticket.raw === "object" && !Array.isArray(ticket.raw) && <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(ticket.raw).filter(([, value]) => value != null && value !== "").map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>}
              </div>}
            </div>;
          })}
          {!filtered.length && <p className="py-12 text-center text-muted-foreground">No tickets found for this period.</p>}
        </div>}
        {!tablet && <Table>
          <TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Source</TableHead><TableHead>Date</TableHead><TableHead>Customer / Site</TableHead><TableHead>Vehicle</TableHead><TableHead>Waste</TableHead><TableHead>Movement / Status</TableHead><TableHead className="text-right">Net (t)</TableHead><TableHead className="w-12">Details</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map(ticket => {
              const key = `${ticket.source}:${ticket.id}`;
              const open = expanded === key;
              return <Fragment key={key}>
                <TableRow className="cursor-pointer select-none hover:bg-muted/40" onClick={() => setExpanded(open ? null : key)}>
                  <TableCell className="font-mono font-semibold">{ticket.ticket}</TableCell>
                  <TableCell><Badge variant={ticket.source !== "midweigh" ? "secondary" : "outline"}>{ticket.source === "midweigh" ? "Midweigh" : ticket.source === "skiptrak" ? "RouteOne · Skiptrak" : "RouteOne"}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dateLabel(ticket.date)}</TableCell>
                  <TableCell className="min-w-44"><p>{ticket.customer || "—"}</p><p className="text-xs text-muted-foreground">{ticket.site}</p></TableCell>
                  <TableCell className="whitespace-nowrap font-mono">{ticket.vehicle || "—"}</TableCell>
                  <TableCell className="min-w-40">{ticket.waste || "—"}<p className="text-xs text-muted-foreground">{ticket.ewc}</p></TableCell>
                  <TableCell className="text-xs"><p>{ticket.movement?.replace(/_/g, " ") || "—"}</p><p className="text-muted-foreground">{ticket.status?.replace(/_/g, " ")}</p></TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{ticket.weightTonnes?.toFixed(3) ?? "—"}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}><Button variant="ghost" size="icon" aria-label={`${open ? "Hide" : "View"} ${ticket.source !== "midweigh" ? "RouteOne" : "Midweigh"} ticket ${ticket.ticket}`} aria-expanded={open} onClick={() => setExpanded(open ? null : key)}>{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></TableCell>
                </TableRow>
                {open && <TableRow><TableCell colSpan={9} className="bg-muted/30">
                  <div className="space-y-3 p-2"><p><span className="text-muted-foreground">Driver: </span>{ticket.driver || "—"}</p>
                    {ticket.source === "routeone" && <JobPhotosSection jobId={ticket.id} />}
                    {ticket.source === "midweigh" && <MidweighPrintButton id={ticket.id} />}
                    {ticket.source === "skiptrak" && <SkiptrakPrintButton id={ticket.id} />}
                    {ticket.transactionId && <WeighbridgeAttachments transactionId={ticket.transactionId} />}
                    {ticket.raw && typeof ticket.raw === "object" && !Array.isArray(ticket.raw) ? <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(ticket.raw).filter(([, value]) => value != null && value !== "").map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl> : null}
                  </div>
                </TableCell></TableRow>}
              </Fragment>;
            })}
            {!filtered.length && <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">No tickets found for this period.</TableCell></TableRow>}
          </TableBody>
        </Table>}
        </>
      )}
    </div>
  );
}