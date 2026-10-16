// Rental notes are read per staff member: each person's "already read" point is
// kept on their own device, so the notes section can stay highlighted for anyone
// who has not seen a note yet. Nothing here talks to the database — the callers
// pass in the note timestamps they already loaded.

export type NoteStamp = { created_at: string };
export type SeenMap = Record<string, string>;

type Store = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const PREFIX = "rental-notes-seen";

function defaultStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

// One key per notes thread: bins are keyed by bin_key, agreements by their id.
export function notesKeyFor(thread: { binKey?: string | null; agreementId?: string | null }): string | null {
  if (thread.binKey) return `bin:${thread.binKey}`;
  if (thread.agreementId) return `agreement:${thread.agreementId}`;
  return null;
}

// The map of when this person last read each thread. Corrupt or missing storage
// simply means "nothing read yet", never a crash.
export function loadSeenMap(userId: string | null | undefined, from: Store | null = defaultStore()): SeenMap {
  if (!userId || !from) return {};
  try {
    const raw = from.getItem(`${PREFIX}:${userId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as SeenMap;
  } catch {
    // fall through
  }
  return {};
}

// Everything written up to `at` counts as read for this person on this thread.
export function markNotesSeen(
  userId: string | null | undefined,
  key: string | null,
  at: string = new Date().toISOString(),
  to: Store | null = defaultStore(),
): SeenMap {
  if (!userId || !key) return {};
  const next = { ...loadSeenMap(userId, to), [key]: at };
  try {
    to?.setItem(`${PREFIX}:${userId}`, JSON.stringify(next));
  } catch {
    // Storage blocked or full: the highlight stays on, which is the safe outcome.
  }
  return next;
}

// Notes newer than the reader's last visit still need reading. A thread that has
// never been opened shows everything it holds as waiting to be read.
export function unreadNotes<T extends NoteStamp>(notes: T[], seenAt: string | null | undefined): T[] {
  if (!seenAt) return [...notes];
  return notes.filter((n) => n.created_at > seenAt);
}

export function unreadNoteCount(notes: NoteStamp[], seenAt: string | null | undefined): number {
  return unreadNotes(notes, seenAt).length;
}

// Keep the count badge short — anything past nine just says "9+".
export function notesBadgeLabel(count: number): string {
  return count > 9 ? "9+" : String(count);
}
