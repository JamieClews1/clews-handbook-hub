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
  { label: "PICKUP", value: "Pickup", sizes: [{ code: "7_5_tonne", label: "7.5 TONNE" }] },
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