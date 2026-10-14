import { parseLoadReportDate } from "@/lib/load-report-dates";

export interface CombinedTicket {
  id: string;
  source: "routeone" | "skiptrak" | "midweigh";
  ticket: string;
  date: string | null;
  customer: string | null;
  site: string | null;
  siteAddress?: string | null;
  postcode?: string | null;
  vehicle: string | null;
  driver: string | null;
  waste: string | null;
  ewc: string | null;
  movement: string | null;
  status: string | null;
  weightTonnes: number | null;
  transactionId?: string | null;
  raw?: unknown;
}

export function ticketWeightTonnes(weight: number | null, source: CombinedTicket["source"]) {
  return weight == null ? null : source === "midweigh" ? weight / 1000 : weight;
}

export function combineTickets(routeone: CombinedTicket[], midweigh: CombinedTicket[]) {
  return [...routeone, ...midweigh].sort((a, b) => {
    const dateA = parseLoadReportDate(a.date)?.getTime() ?? 0;
    const dateB = parseLoadReportDate(b.date)?.getTime() ?? 0;
    return dateB - dateA || b.ticket.localeCompare(a.ticket, undefined, { numeric: true }) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id);
  });
}