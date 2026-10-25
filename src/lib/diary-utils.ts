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

export interface DiaryCategory {
  key: string;
  label: string;
  color: string;
}

/** Named colour palette for category dots. */
export const DIARY_COLOR_DOT: Record<string, string> = {
  grey: "bg-slate-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-rose-500",
  purple: "bg-violet-500",
  yellow: "bg-yellow-400",
  teal: "bg-teal-500",
};

export const DIARY_COLOR_NAMES = Object.keys(DIARY_COLOR_DOT);

export const DEFAULT_DIARY_CATEGORIES: DiaryCategory[] = [
  { key: "general", label: "General", color: "grey" },
  { key: "drivers", label: "Drivers", color: "blue" },
  { key: "loads_in", label: "Loads In", color: "green" },
  { key: "loads_out", label: "Loads Out", color: "orange" },
  { key: "maintenance", label: "Maintenance", color: "red" },
];

export function categoryKeyOf(card: Pick<DiaryCard, "category">): string {
  return card.category ?? "general";
}

export function dotClassFor(categoryKey: string, categories: DiaryCategory[]): string {
  const color = categories.find((c) => c.key === categoryKey)?.color ?? "grey";
  return DIARY_COLOR_DOT[color] ?? DIARY_COLOR_DOT.grey;
}

export function slugifyCategoryKey(label: string, existingKeys: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "category";
  if (!existingKeys.includes(base)) return base;
  let i = 2;
  while (existingKeys.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
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
    // Start the day after the entry's own date so the original is never duplicated.
    const startDate = addDays(monday, card.day_of_week + 1);
    for (let i = 0; i < 28; i++) {
      const d = addDays(startDate, i);
      out.push({ week_start: formatDate(getMonday(d)), day_of_week: (d.getDay() + 6) % 7 });
    }
  }
  return out;
}
