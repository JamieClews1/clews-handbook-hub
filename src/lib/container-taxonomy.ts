/** Presentation taxonomy. Codes stay stable so saved pricing and jobs retain their identity. */
export const CONTAINER_GROUPS = [
  { label: "SKIP", value: "Skip", sizes: [
    { code: "6yd", label: "6 yd" }, { code: "8yd", label: "8 yd" },
    { code: "12yd", label: "12 yd" }, { code: "14_16yd", label: "14 / 16 yd" },
    { code: "12yd_enclosed", label: "12 yd enclosed" },
  ] },
  { label: "RORO", value: "Ro Ro", sizes: [
    { code: "20yd_roro", label: "20 yd" }, { code: "25yd_roro", label: "25 yd" },
    { code: "40yd", label: "35 / 40 yd" }, { code: "35yd_compactor", label: "35 yd Compactor" },
    { code: "35yd_enclosed", label: "35 yd Enclosed" },
  ] },
  { label: "ARTIC", value: "Artic", sizes: [
    { code: "curtain", label: "Curtain" }, { code: "walking_floor", label: "Walking Floor" },
    { code: "ejector", label: "Ejector" },
  ] },
  { label: "PICKUP", value: "Pickup", sizes: [] },
  { label: "7.5 TONNE", value: "7.5 Tonne", sizes: [{ code: "7_5_tonne", label: "7.5 TONNE" }] },
] as const;

export function containerGroup(value: string) {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return CONTAINER_GROUPS.find(g => [g.label, g.value].some(v => v.toLowerCase().replace(/[^a-z0-9]/g, "") === key))
    ?? (/enclosedskip|chainlift/.test(key) ? CONTAINER_GROUPS[0] : undefined);
}
export function containerSize(code: string) {
  return CONTAINER_GROUPS.flatMap(g => [...g.sizes]).find(s => s.code === code);
}
export function pricingSizeLabel(code: string, fallback: string) {
  const group = CONTAINER_GROUPS.find(g => g.sizes.some(s => s.code === code));
  const size = containerSize(code);
  return group && size ? `${group.label} · ${size.label}` : fallback;
}

/** Format native jobs without changing the stored code or legacy text. */
export function bookingContainerLabel(type?: string | null, code?: string | null) {
  const size = code ? containerSize(code) : undefined;
  if (size && code) return pricingSizeLabel(code, size.label);
  return [code, type].filter(Boolean).join(" ");
}

/** Display only: keep material restrictions, included tonnes and bespoke wording intact. */
export function rateContainerLabel(label: string) {
  return label
    .replace(/\b35\s*(?:yd|yard)\s+compactor\b/gi, "35 yd Compactor")
    .replace(/\b35\s*(?:yd|yard)\s+enclosed\b/gi, "35 yd Enclosed")
    .replace(/\b14\s*\/\s*16\s*YD\s*open\b/gi, "14 / 16 yd")
    .replace(/\b(6|8|12)\s*YD\s*open\b/gi, "$1 yd")
    .replace(/\b12\s*YD\s*enclosed\b/gi, "12 yd enclosed")
    .replace(/\b(6|8|12|20|25|35|40)\s*(?:cubic\s*yard|cu\s*yd|yd|yard)\b/gi, "$1 yd");
}
export function rateContainerSection(section: string) {
  return section.replace(/^Skip Hire\b/i, "SKIP").replace(/^RoRo\b/i, "RORO").replace(/^Artic\b/i, "ARTIC");
}