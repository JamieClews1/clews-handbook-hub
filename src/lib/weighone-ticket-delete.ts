/**
 * Rules for deleting a WeighOne weighbridge ticket.
 *
 * A ticket can be referenced by other records: a Route One job, a Banksman
 * report and invoices. The database refuses the delete while an invoice points
 * at the ticket, so the confirmation prompt has to say so up front instead of
 * letting the operator hit a raw error.
 */

export type TicketDeletionLinks = {
  /** Route One job number the ticket was raised against, when linked. */
  routeOneJobNumber?: string | null;
  /** Banksman job number whose report is attached to this ticket. */
  banksmanJobNumber?: string | null;
  /** Invoice numbers that already carry this ticket. */
  invoiceNumbers?: string[];
};

export type TicketDeletionPlan = {
  /** Why the ticket cannot be deleted, or null when it can. */
  blocked: string | null;
  /** What deleting will remove or unlink, shown to the operator before they confirm. */
  consequences: string[];
};

/** Tickets on an invoice are financial evidence and must be removed from the invoice first. */
export function planTicketDeletion(links: TicketDeletionLinks): TicketDeletionPlan {
  const invoices = (links.invoiceNumbers ?? []).filter(Boolean);
  if (invoices.length > 0) {
    return {
      blocked: `This ticket is already on invoice ${invoices.join(", ")}. Delete it from the invoice before deleting the ticket.`,
      consequences: [],
    };
  }

  const consequences: string[] = [];
  if (links.routeOneJobNumber) {
    consequences.push(`Route One job ${links.routeOneJobNumber} keeps its records, but the ticket link is removed.`);
  }
  if (links.banksmanJobNumber) {
    consequences.push(`Banksman report ${links.banksmanJobNumber} keeps its records, but is detached from this ticket.`);
  }
  consequences.push("The ticket, its weights, extra charges and photos are deleted permanently.");

  return { blocked: null, consequences };
}

/** Linked records that have to be detached before the ticket row can go. */
export function ticketDeletionUnlinks(links: TicketDeletionLinks): {
  routeOneJob: boolean;
  banksmanJob: boolean;
} {
  return {
    routeOneJob: Boolean(links.routeOneJobNumber),
    banksmanJob: Boolean(links.banksmanJobNumber),
  };
}
