// Shared helpers for the EWC (waste) and SIC (industry) code registers.

export interface EwcCode {
  id: string;
  code: string;
  description: string;
  chapter: string;
  chapter_name: string;
  sub_chapter: string;
  sub_chapter_name: string;
  hazardous: boolean;
  is_common: boolean;
  is_active: boolean;
  notes: string | null;
}

export interface SicCode {
  id: string;
  code: string;
  description: string;
  section: string;
  section_name: string;
  is_common: boolean;
  is_active: boolean;
  notes: string | null;
}

/** EWC codes are six digits displayed in three pairs, e.g. "17 09 04". */
export const normaliseEwcCode = (value: string): string => {
  const digits = (value || "").replace(/[^0-9*]/g, "");
  const hazard = digits.includes("*");
  const nums = digits.replace(/\*/g, "").slice(0, 6);
  const grouped = nums.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return hazard ? `${grouped}*` : grouped;
};

/** SIC codes are five digits, e.g. "38320". */
export const normaliseSicCode = (value: string): string =>
  (value || "").replace(/\D/g, "").slice(0, 5);

export const codeMatches = (query: string, code: string, description: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const compactCode = code.replace(/\s/g, "").toLowerCase();
  const compactQ = q.replace(/\s/g, "");
  return compactCode.includes(compactQ) || description.toLowerCase().includes(q);
};
