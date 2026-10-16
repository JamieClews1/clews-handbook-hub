import { supabase } from "@/integrations/supabase/client";

export type DealStage = "new" | "quoted" | "won" | "completed" | "lost";

export interface Deal {
  id: string;
  ticket_id: string | null;
  customer_id: string | null;
  title: string | null;
  stage: DealStage;
  value_net: number | null;
  postcode: string | null;
  container: string | null;
  waste_type: string | null;
  assigned_to: string | null;
  quoted_at: string | null;
  won_at: string | null;
  closed_at: string | null;
  lost_reason: string | null;
  route_one_job_number: string | null;
  notes: string | null;
  created_at: string;
}

export const DEAL_STAGES: Array<{ value: DealStage; label: string; className: string }> = [
  { value: "new", label: "New enquiry", className: "border-sky-500/40 text-sky-700 bg-sky-500/10" },
  { value: "quoted", label: "Quoted", className: "border-amber-500/40 text-amber-700 bg-amber-500/10" },
  { value: "won", label: "Won", className: "border-primary/40 text-primary bg-primary/10" },
  { value: "completed", label: "Completed", className: "border-emerald-600/40 text-emerald-700 bg-emerald-600/10" },
  { value: "lost", label: "Lost", className: "border-destructive/40 text-destructive bg-destructive/10" },
];

export const LOST_REASONS = ["Price", "Timing", "Went elsewhere", "No reply", "Other"];

/** Days after quoting with no win/loss before a deal needs a follow-up. */
export const FOLLOW_UP_DAYS = 2;

export function needsFollowUp(d: Pick<Deal, "stage" | "quoted_at">, now = Date.now()): boolean {
  if (d.stage !== "quoted" || !d.quoted_at) return false;
  return now - new Date(d.quoted_at).getTime() >= FOLLOW_UP_DAYS * 86400000;
}

export function stageMeta(stage: DealStage) {
  return DEAL_STAGES.find((s) => s.value === stage) ?? DEAL_STAGES[0];
}

/** First "£123.45" in a reply, treated as the net quoted value. */
export function extractQuotedValue(text: string): number | null {
  const m = text.match(/£\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export function formatMoney(v: number | null | undefined) {
  return v == null ? "" : `£${Number(v).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export async function loadDeals(): Promise<Deal[]> {
  const { data } = await supabase.from("crm_deals").select("*").order("created_at", { ascending: false }).limit(1000);
  return (data as Deal[]) ?? [];
}

/** Won deals whose linked Route One job is completed move to Completed. */
export async function syncCompletedDeals(deals: Deal[]): Promise<Deal[]> {
  const won = deals.filter((d) => d.stage === "won" && d.route_one_job_number);
  if (!won.length) return deals;
  const { data } = await supabase
    .from("route_one_jobs")
    .select("job_number, status")
    .in("job_number", won.map((d) => d.route_one_job_number!))
    .eq("status", "completed");
  const done = new Set((data ?? []).map((r: any) => String(r.job_number)));
  const ids = won.filter((d) => done.has(d.route_one_job_number!)).map((d) => d.id);
  if (!ids.length) return deals;
  const now = new Date().toISOString();
  await supabase.from("crm_deals").update({ stage: "completed", closed_at: now }).in("id", ids);
  return deals.map((d) => (ids.includes(d.id) ? { ...d, stage: "completed", closed_at: now } : d));
}

/** Every distinct £ amount in a conversation (newest first), skipping small surcharge-sized figures under £20. */
export function extractAllValues(texts: string[], max = 6): number[] {
  const out: number[] = [];
  for (const t of texts) {
    const re = /£\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const v = Number(m[1].replace(/,/g, ""));
      if (v >= 20 && !out.includes(v)) out.push(v);
      if (out.length >= max) return out;
    }
  }
  return out;
}
