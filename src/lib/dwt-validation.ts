// Checks that DEFRA rejects but that look "filled in" on the DWT page.
const CARRIER_PATTERNS = [
  /^CBD[UL]\d{3,}$/i, // England / Wales (EA, NRW)
  /^WCR\/R\/\d+$/i, // Scotland (SEPA)
  /^ROC[UL]T?\d+$/i, // Northern Ireland
];

export function isValidCarrierReg(reg: string | null | undefined) {
  const r = (reg ?? "").replace(/\s+/g, "");
  return CARRIER_PATTERNS.some((p) => p.test(r));
}

export function dwtRowIssues(m: { carrierReg?: string | null; weightT?: number | null }): string[] {
  const issues: string[] = [];
  if (m.weightT != null && !(m.weightT > 0)) issues.push("Weight is 0 — DEFRA needs a weight above zero");
  if (m.carrierReg && !isValidCarrierReg(m.carrierReg))
    issues.push(`Carrier number "${m.carrierReg}" is not a current format (e.g. CBDU123456)`);
  return issues;
}
