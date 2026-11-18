export interface TalkListItem {
  id: string;
  reference_code: string;
  user_types: string[] | null;
  assigned_users?: string[] | null;
  is_mandatory: boolean;
  created_date: string;
}

export type TalkSort = "newest" | "oldest" | "to-sign";

/** Number from a reference like "TBT-12" (0 when there is none). */
export const talkNumber = (ref: string | null | undefined): number => {
  const m = String(ref ?? "").match(/(\d+)\s*$/);
  return m ? Number(m[1]) : 0;
};

/** A talk applies to someone when their user type is targeted or they are assigned by name. */
export const talkAppliesTo = (talk: TalkListItem, userId: string, userTypes: string[]): boolean =>
  (talk.user_types ?? []).some((t) => userTypes.includes(t)) ||
  (talk.assigned_users ?? []).includes(userId);

export const sortTalks = <T extends TalkListItem>(talks: T[], sort: TalkSort, signed: Set<string>): T[] => {
  const byNewest = (a: T, b: T) =>
    talkNumber(b.reference_code) - talkNumber(a.reference_code) ||
    String(b.created_date).localeCompare(String(a.created_date));
  const list = [...talks];
  if (sort === "oldest") return list.sort((a, b) => byNewest(b, a));
  if (sort === "to-sign") {
    const rank = (t: T) => (signed.has(t.id) ? 2 : t.is_mandatory ? 0 : 1);
    return list.sort((a, b) => rank(a) - rank(b) || byNewest(a, b));
  }
  return list.sort(byNewest);
};

export const AUDIENCE_LABELS: Record<string, string> = {
  driver: "Drivers",
  yard: "Yard",
  office: "Office",
  management: "Management",
};

/** Plain-text preview of a talk's HTML content. */
export const talkPreview = (html: string, max = 220): string => {
  const text = String(html ?? "")
    .replace(/<(br|\/p|\/li|\/h\d)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};
