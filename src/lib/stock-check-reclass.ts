// Stock Check EWC reclassification rules.
// Allows e.g. "count any 20yd job carrying EWC 17 09 04 or 20 03 01 as 25/30yd".

export interface EwcReclassRule {
  id: string;
  from_type_id: string;
  to_type_id: string;
  ewc_codes: string[];
  is_active: boolean;
}

/** Strip spaces/punctuation so "17 09 04", "170904" and "17-09-04" all match. */
export const normaliseEwc = (value: string | null | undefined): string =>
  (value || "").replace(/[^0-9]/g, "");

/**
 * Given the container type a job matched to, return the type it should actually
 * be counted under once EWC reclassification rules are applied.
 */
export const applyEwcReclass = (
  typeId: string,
  ewc: string | null | undefined,
  rules: EwcReclassRule[],
): string => {
  const code = normaliseEwc(ewc);
  if (!code) return typeId;
  for (const rule of rules) {
    if (!rule.is_active) continue;
    if (rule.from_type_id !== typeId) continue;
    if ((rule.ewc_codes || []).some((c) => normaliseEwc(c) === code)) {
      return rule.to_type_id;
    }
  }
  return typeId;
};
