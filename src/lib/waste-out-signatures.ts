type Signatures = {
  operator_signature?: string | null;
  operator_name?: string | null;
  first_weigh_at?: string | null;
  disposer_signature?: string | null;
  disposer_name?: string | null;
  disposer_signoff_at?: string | null;
};

/** The weighbridge operator signs for Clews, never for the receiving site. */
export function wasteOutProducerSignature(ticket: Signatures) {
  return {
    customer_signature: ticket.operator_signature ?? null,
    customer_signoff_name: ticket.operator_name ?? null,
    customer_signoff_at: ticket.operator_signature ? ticket.first_weigh_at ?? null : null,
  };
}