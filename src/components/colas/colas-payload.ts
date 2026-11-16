import { MONTH_NAMES, buildArisings, monthKey, reportingYearLabel } from "@/lib/colas-report";
import type { ColasReportPayload } from "@/lib/colas-report-export";
import type { ColasYearData } from "./useColasData";

export function buildPayload(data: ColasYearData, index: number): ColasReportPayload {
  const m = data.months[index];
  const period = data.periods.get(monthKey(m.year, m.month));
  return {
    month: m,
    ytd: data.ytd[index],
    arisings: buildArisings(m.lines, data.treatments),
    ytdArisings: buildArisings(data.months.slice(0, index + 1).flatMap(x => x.lines), data.treatments),
    yearMonths: data.months.map(x => ({ label: MONTH_NAMES[x.month - 1].slice(0, 3), hazardous_t: x.hazardous_t, non_hazardous_t: x.non_hazardous_t, total_t: x.total_t, cost: x.costs.total })),
    opening: data.opening,
    reportingYearLabel: reportingYearLabel(data.year, data.startMonth),
    approval: {
      status: period?.status ?? "open",
      approvedAt: period?.approved_at ?? null,
      approvedBy: period?.approved_by ?? null,
      outstandingReason: period?.outstanding_reason ?? null,
      comments: period?.comments ?? null,
    },
    generatedAt: new Date(),
  };
}

/** Restores an approved month's frozen figures so its report can be reproduced exactly. */
export function payloadFromSnapshot(snapshot: any): ColasReportPayload | null {
  if (!snapshot?.month || !snapshot?.ytd) return null;
  // Months approved before the waste-arisings table existed: rebuild it from the frozen collection lines.
  const arisings = snapshot.arisings ?? buildArisings(snapshot.month.lines ?? []);
  return { ...snapshot, arisings, ytdArisings: snapshot.ytdArisings ?? null, generatedAt: new Date() } as ColasReportPayload;
}

export function snapshotOf(p: ColasReportPayload) {
  const { generatedAt, ...rest } = p;
  return JSON.parse(JSON.stringify({ ...rest, frozenAt: generatedAt.toISOString() }));
}
