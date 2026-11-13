/**
 * Inbox tab counts.
 *
 * The Inbox tab badge shows how many email threads are sitting in the inbox, so
 * it mirrors the Orders portal tab badge (conversations not done). Filed threads
 * are archived and never counted. Unread numbers go in the badge's tooltip.
 */

export type InboxCountable = {
  is_read?: boolean | null;
  is_filed?: boolean | null;
};

/** Email threads that are unread and not filed away. */
export function countUnreadInboxTickets(tickets: InboxCountable[]): number {
  return tickets.filter((t) => !t.is_filed && !t.is_read).length;
}

/** Email threads sitting in the inbox (filed threads are archived, so not counted). */
export function countInboxThreads(tickets: InboxCountable[]): number {
  return tickets.filter((t) => !t.is_filed).length;
}

/** Tab badge text: nothing for zero, exact under 1000, then shortened (2.9k) so the tab never stretches. */
export function tabCountLabel(count: number): string | null {
  if (!count || count <= 0) return null;
  if (count < 1000) return String(count);
  const k = count / 1000;
  const text = k < 10 ? k.toFixed(1).replace(/\.0$/, "") : String(Math.round(k));
  return `${text}k`;
}
