/** Compact ticket-type codes shown beside ticket numbers in WeighOne lists. */
export type TicketTypeCode = { code: string; className: string };

const TICKET_TYPE_CODES: Record<string, TicketTypeCode> = {
  waste_in: { code: "IN", className: "border-success/30 bg-success/15 text-success" },
  waste_out: { code: "OUT", className: "border-info/30 bg-info/15 text-info" },
  skip: { code: "SKIP", className: "border-warning/40 bg-warning/15 text-warning" },
};

/** Returns the IN / OUT / SKIP code for a weighbridge job type, or undefined when unknown. */
export const ticketTypeCode = (v: string | null | undefined): TicketTypeCode | undefined =>
  (v ? TICKET_TYPE_CODES[v] : undefined);
