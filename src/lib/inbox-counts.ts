/**
 * Inbox tab counts.
 *
 * The Inbox tab badge shows how many of the signed-in person's email threads
 * are still unread, so it mirrors the Orders portal tab badge (unread
 * customer conversations). Filed threads are archived and never counted.
 */

export type InboxCountable = {
  is_read?: boolean | null;
  is_filed?: boolean | null;
};

/** Email threads that are unread and not filed away. */
export function countUnreadInboxTickets(tickets: InboxCountable[]): number {
  return tickets.filter((t) => !t.is_filed && !t.is_read).length;
}

/** Tab badge text: nothing for zero, "99+" past two digits so the tab never stretches. */
export function tabCountLabel(count: number): string | null {
  if (!count || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}
