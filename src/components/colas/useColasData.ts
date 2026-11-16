import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { londonCalendarKey } from "@/lib/ui-calendar";
import {
  buildColasMonth, cumulative, reportingPeriods, normaliseEwc, monthKey,
  type ColasSkiptrakJob, type ColasMidweighTicket, type ColasManualEntryRow, type ColasCostRow, type ColasMonth, type ColasYtd, type ColasOpening, type SourceKey, type SourceOverride, type ColasTreatments, type ConsignmentIssue,
} from "@/lib/colas-report";

export const COLAS_CUSTOMER_PATTERN = "colas rail%";

export interface ColasPeriodRow {
  id: string; year: number; month: number; source_status: Record<string, SourceOverride>; comments: string | null;
  status: "open" | "approved"; approved_by: string | null; approved_at: string | null; outstanding_reason: string | null;
  snapshot: any; last_generated_at: string | null; last_generated_by: string | null;
}
export interface ColasSettingsRow { year_start_month: number; customer_access_enabled: boolean; stream_treatments: ColasTreatments }
export interface ColasHazDoc { job_number: string; storage_path: string; file_name: string }

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[£,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function useColasSettings() {
  return useQuery({
    queryKey: ["colas", "settings"],
    queryFn: async (): Promise<ColasSettingsRow> => {
      const { data, error } = await supabase.from("colas_report_settings").select("year_start_month, customer_access_enabled, stream_treatments").eq("id", 1).maybeSingle();
      if (error) throw error;
      return (data as unknown as ColasSettingsRow) ?? { year_start_month: 1, customer_access_enabled: false, stream_treatments: {} };
    },
  });
}

export interface ColasYearData {
  year: number;
  startMonth: number;
  months: ColasMonth[];
  ytd: ColasYtd[];
  periods: Map<string, ColasPeriodRow>;
  opening: ColasOpening | null;
  jobs: ColasSkiptrakJob[];
  manual: (ColasManualEntryRow & Record<string, any>)[];
  costs: (ColasCostRow & Record<string, any>)[];
  consignments: Map<string, string | null>;
  consignmentIssues: Map<string, ConsignmentIssue>;
  hazDocs: Map<string, ColasHazDoc>;
  /** Saved share recycled / energy recovery / landfill per stream (defaults apply where unset). */
  treatments: ColasTreatments;
  today: string;
}

export function useColasYear(year: number, startMonth: number | undefined) {
  return useQuery({
    queryKey: ["colas", "year", year, startMonth],
    enabled: startMonth != null,
    staleTime: 60_000,
    queryFn: async (): Promise<ColasYearData> => {
      const sm = startMonth ?? 1;
      const periodsList = reportingPeriods(year, sm);
      const first = periodsList[0], last = periodsList[11];
      const from = `${monthKey(first.year, first.month)}-01`;
      const toDate = new Date(Date.UTC(last.year, last.month, 0));
      const to = toDate.toISOString().slice(0, 10);

      const [jobsRaw, midRaw, ewc, manual, costs, cons, periods, opening, settingsRow] = await Promise.all([
        pageAll<any>((a, b) => supabase.from("data_hub_jobs").select("job_number, job_date, ewc, waste_description, weight_t, tipping_location, site, container_type, raw")
          .eq("source", "skiptrak").ilike("customer", COLAS_CUSTOMER_PATTERN).gte("job_date", from).lte("job_date", to).order("job_date").range(a, b)),
        pageAll<any>((a, b) => supabase.from("data_hub_jobs").select("job_number, job_date, ewc, waste_description, weight_t, linked_skip_job")
          .eq("source", "midweigh").ilike("customer", COLAS_CUSTOMER_PATTERN).gte("job_date", from).lte("job_date", to).order("job_date").range(a, b)),
        supabase.from("ewc_codes").select("code, hazardous").eq("hazardous", true),
        supabase.from("colas_manual_entries").select("*").gte("collection_date", from).lte("collection_date", to).order("collection_date"),
        supabase.from("colas_costs").select("*").gte("year", first.year).lte("year", last.year).order("created_at"),
        supabase.from("colas_consignments").select("job_number, consignment_ref, read_issue").eq("source", "skiptrak"),
        supabase.from("colas_report_periods").select("*").gte("year", first.year).lte("year", last.year),
        supabase.from("colas_opening_balances").select("*").eq("year", year).maybeSingle(),
        supabase.from("colas_report_settings").select("stream_treatments").eq("id", 1).maybeSingle(),
      ]);
      for (const r of [ewc, manual, costs, cons, periods, opening, settingsRow]) if (r.error) throw r.error;

      const jobs: ColasSkiptrakJob[] = jobsRaw.map((j: any) => ({
        job_number: String(j.job_number), job_date: j.job_date, ewc: j.ewc, waste_description: j.waste_description,
        weight_t: num(j.weight_t), cost: num(j.raw?.Cost), movement: j.raw?.["Movement Type"] ?? null, status: j.raw?.Status ?? null,
        tipping_location: j.tipping_location, site: j.site, container_type: j.container_type, weighbridge_ref: j.raw?.Weighbridge ? String(j.raw.Weighbridge) : null,
      }));
      const midweigh: ColasMidweighTicket[] = midRaw.map((t: any) => ({
        job_number: String(t.job_number), job_date: t.job_date, ewc: t.ewc, waste_description: t.waste_description, weight_kg: num(t.weight_t), linked_skip_job: t.linked_skip_job,
      }));
      const hazardousCodes = new Set((ewc.data ?? []).map((r: any) => normaliseEwc(r.code)));
      const consignments = new Map<string, string | null>((cons.data ?? []).map((c: any) => [String(c.job_number), c.consignment_ref]));
      const consignmentIssues = new Map<string, ConsignmentIssue>((cons.data ?? []).filter((c: any) => !c.consignment_ref && (c.read_issue === "unreadable" || c.read_issue === "page_missing")).map((c: any) => [String(c.job_number), c.read_issue as ConsignmentIssue]));
      const periodMap = new Map<string, ColasPeriodRow>((periods.data ?? []).map((p: any) => [monthKey(p.year, p.month), p as ColasPeriodRow]));
      const today = londonCalendarKey();

      const months = periodsList.map(p => buildColasMonth({
        year: p.year, month: p.month, today, jobs, midweigh,
        manual: (manual.data ?? []) as any, costs: (costs.data ?? []) as any, consignments, consignmentIssues, hazardousCodes,
        overrides: (periodMap.get(monthKey(p.year, p.month))?.source_status ?? {}) as Partial<Record<SourceKey, SourceOverride>>,
      }));
      const op = opening.data ? {
        hazardous_t: Number(opening.data.hazardous_t), non_hazardous_t: Number(opening.data.non_hazardous_t),
        hazardous_cost: Number(opening.data.hazardous_cost), non_hazardous_cost: Number(opening.data.non_hazardous_cost),
      } : null;

      // Scanned paperwork (QuickConsign / Robert Hopkins) attached to hazardous Skiptrak jobs.
      const hazNumbers = [...new Set(months.flatMap(m => m.lines.filter(l => l.hazardous && l.id.startsWith("skiptrak:")).map(l => l.reference)))];
      const hazDocs = new Map<string, ColasHazDoc>();
      for (let i = 0; i < hazNumbers.length; i += 200) {
        const { data, error } = await supabase.from("wtn_documents").select("job_number, storage_path, file_name, created_at").in("job_number", hazNumbers.slice(i, i + 200)).order("created_at", { ascending: false });
        if (error) throw error;
        for (const d of data ?? []) if (d.job_number && !hazDocs.has(d.job_number)) hazDocs.set(d.job_number, d as ColasHazDoc);
      }

      return { year, startMonth: sm, months, ytd: cumulative(months, op), periods: periodMap, opening: op, jobs, manual: (manual.data ?? []) as any, costs: (costs.data ?? []) as any, consignments, consignmentIssues, hazDocs, treatments: ((settingsRow.data?.stream_treatments ?? {}) as ColasTreatments), today };
    },
  });
}

export function useInvalidateColas() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["colas"] });
}

export async function ensurePeriod(year: number, month: number): Promise<ColasPeriodRow> {
  const { data } = await supabase.from("colas_report_periods").select("*").eq("year", year).eq("month", month).maybeSingle();
  if (data) return data as any;
  const { data: created, error } = await supabase.from("colas_report_periods").insert({ year, month }).select("*").single();
  if (error) throw error;
  return created as any;
}

export const fmtT = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("en-GB", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const fmtGBP = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
