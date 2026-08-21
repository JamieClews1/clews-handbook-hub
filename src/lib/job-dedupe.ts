type MaybeLinkedJob = {
  source?: string | null;
  linked_skip_job?: string | null;
};

/**
 * Weighbridge (Midweigh) tickets that are linked to a Skiptrak job are the same
 * physical movement recorded twice. Customers should only ever see the Skiptrak
 * movement, so drop the linked weighbridge duplicates from any customer-facing
 * report.
 */
export function dropLinkedMidweighTickets<T extends MaybeLinkedJob>(jobs: T[]): T[] {
  return jobs.filter((j) => {
    const source = String(j.source ?? "").toLowerCase();
    if (source !== "midweigh") return true;
    return !String(j.linked_skip_job ?? "").trim();
  });
}
