import { localCalendarKey } from "@/lib/ui-calendar";

export interface DiaryCard {
  id: string;
  user_id: string;
  day_of_week: number;
  week_start: string;
  content: string;
  color: string | null;
  display_order: number;
  category: string | null;
  notes: string | null;
  done: boolean;
  assignee: string | null;
  repeat: string | null;
}

export const DIARY_CATEGORIES = [
  { key: "general", label: "General" },
  { key: "drivers", label: "Drivers" },
  { key: "loads_in", label: "Loads In" },
  { key: "loads_out", label: "Loads Out" },
  { key: "maintenance", label: "Maintenance" },
] as const;

export type DiaryCategoryKey = (typeof DIARY_CATEGORIES)[number]["key"];

export const CATEGORY_DOT_CLASS: Record<DiaryCategoryKey, string> = {
  general: "bg-slate-400",
  drivers: "bg-blue-500",
  loads_in: "bg-emerald-500",
  loads_out: "bg-amber-500",
  maintenance: "bg-rose-500",
};

export function categoryKeyOf(card: Pick<DiaryCard, "category">): DiaryCategoryKey {
  const key = (card.category ?? "general") as DiaryCategoryKey;
  return key in CATEGORY_DOT_CLASS ? key : "general";
}

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDate(date: Date): string {
  return localCalendarKey(date);
}

/** ISO-8601 week number (Monday-based), e.g. 26 Oct 2026 -> 44. */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function filterByCategory(cards: DiaryCard[], filter: string): DiaryCard[] {
  if (filter === "all") return cards;
  return cards.filter((c) => categoryKeyOf(c) === filter);
}

export function entriesForDay(cards: DiaryCard[], dayIndex: number): DiaryCard[] {
  return cards
    .filter((c) => c.day_of_week === dayIndex)
    .sort((a, b) => a.display_order - b.display_order);
}

export function searchEntries(cards: DiaryCard[], query: string): DiaryCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return cards.filter(
    (c) =>
      c.content.toLowerCase().includes(q) ||
      (c.notes ?? "").toLowerCase().includes(q)
  );
}

export type DiaryRepeat = "daily" | "weekly" | "monthly";

/**
 * Future occurrences for a repeating entry. Weekly = next 8 weeks (same
 * weekday), monthly = next 4 four-week blocks, daily = every day for the
 * next 4 weeks. The original entry's own week is never duplicated.
 */
export function repeatOccurrences(
  card: Pick<DiaryCard, "week_start" | "day_of_week">,
  repeat: DiaryRepeat
): Array<{ week_start: string; day_of_week: number }> {
  const monday = getMonday(new Date(card.week_start + "T00:00:00"));
  const out: Array<{ week_start: string; day_of_week: number }> = [];

  if (repeat === "weekly") {
    for (let i = 1; i <= 8; i++) {
      out.push({ week_start: formatDate(addDays(monday, 7 * i)), day_of_week: card.day_of_week });
    }
  } else if (repeat === "monthly") {
    for (let i = 1; i <= 4; i++) {
      out.push({ week_start: formatDate(addDays(monday, 28 * i)), day_of_week: card.day_of_week });
    }
  } else if (repeat === "daily") {
    for (let i = 1; i <= 28; i++) {
      const d = addDays(monday, i);
      out.push({ week_start: formatDate(getMonday(d)), day_of_week: (d.getDay() + 6) % 7 });
    }
  }
  return out;
}
