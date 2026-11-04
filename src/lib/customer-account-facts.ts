export type DutyOfCareState = "ok" | "missing" | "expired" | "no-expiry";

export type AccountFacts = {
  loads: number;
  tonnes: number;
  range: string;
  topStreams: string[];
  dutyOfCare: { state: DutyOfCareState; licence: string | null };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Read-only summary of an account's loads this year and its carrier licence status. */
export function summariseAccountFacts(
  rows: { job_date: string | null; weight_t: number | null; waste_description: string | null }[],
  doc: { waste_carrier_licence?: string | null; waste_carrier_licence_expiry?: string | null } | null,
  today: Date = new Date(),
): AccountFacts {
  let tonnes = 0;
  let minM = 12, maxM = -1;
  const streams = new Map<string, number>();
  for (const r of rows) {
    tonnes += Number(r.weight_t) || 0;
    const m = r.job_date ? Number(r.job_date.slice(5, 7)) - 1 : -1;
    if (m >= 0 && m < 12) { minM = Math.min(minM, m); maxM = Math.max(maxM, m); }
    const w = (r.waste_description ?? "").trim();
    if (w) streams.set(w, (streams.get(w) ?? 0) + 1);
  }
  const range = maxM < 0 ? "this year" : minM === maxM ? MONTHS[minM] : `${MONTHS[minM]}–${MONTHS[maxM]}`;
  const topStreams = [...streams.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const licence = doc?.waste_carrier_licence?.trim() || null;
  const expiry = doc?.waste_carrier_licence_expiry ?? null;
  const todayKey = today.toISOString().slice(0, 10);
  const state: DutyOfCareState = !licence ? "missing" : !expiry ? "no-expiry" : expiry < todayKey ? "expired" : "ok";
  return { loads: rows.length, tonnes: Math.round(tonnes * 10) / 10, range, topStreams, dutyOfCare: { state, licence } };
}
