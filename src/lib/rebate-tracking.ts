import { supabase } from "@/integrations/supabase/client";

export type RebateTrackingStatus = "not_generated" | "generated" | "sent";

export type RebateTrackingRow = {
  id: string;
  customer_id: string;
  site_id: string | null;
  period_start: string;
  period_end: string;
  status: RebateTrackingStatus;
  rebate_amount: number | null;
  generated_by: string | null;
  generated_at: string | null;
  sent_by: string | null;
  sent_at: string | null;
  recipient_email: string | null;
  notes: string | null;
};

export const STATUS_META: Record<
  RebateTrackingStatus,
  { label: string; dot: string; badge: string; border: string }
> = {
  not_generated: {
    label: "Not generated",
    dot: "bg-muted-foreground",
    badge:
      "bg-muted text-muted-foreground border-border",
    border: "border-l-muted-foreground/40",
  },
  generated: {
    label: "Generated",
    dot: "bg-amber-500",
    badge:
      "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    border: "border-l-amber-500",
  },
  sent: {
    label: "Sent",
    dot: "bg-green-600",
    badge:
      "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
    border: "border-l-green-600",
  },
};

export function trackingKey(customerId: string, siteId: string | null) {
  return `${customerId}|${siteId ?? "__customer__"}`;
}

export async function fetchTrackingForPeriod(
  periodStart: string,
  periodEnd: string,
): Promise<Map<string, RebateTrackingRow>> {
  const { data, error } = await supabase
    .from("rebate_report_tracking")
    .select(
      "id, customer_id, site_id, period_start, period_end, status, rebate_amount, generated_by, generated_at, sent_by, sent_at, recipient_email, notes",
    )
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);

  if (error) throw error;

  const map = new Map<string, RebateTrackingRow>();
  for (const row of (data ?? []) as RebateTrackingRow[]) {
    map.set(trackingKey(row.customer_id, row.site_id), row);
  }
  return map;
}

type UpsertArgs = {
  customerId: string;
  siteId: string | null;
  periodStart: string;
  periodEnd: string;
  status: RebateTrackingStatus;
  rebateAmount?: number | null;
  userId?: string | null;
  recipientEmail?: string | null;
};

/**
 * Upsert a tracking record. Uses a select-then-write strategy because the
 * uniqueness is enforced by partial indexes (site_id NULL vs NOT NULL).
 */
export async function upsertTracking(args: UpsertArgs): Promise<void> {
  const {
    customerId,
    siteId,
    periodStart,
    periodEnd,
    status,
    rebateAmount = null,
    userId = null,
    recipientEmail = null,
  } = args;

  let query = supabase
    .from("rebate_report_tracking")
    .select("id, status, generated_at, generated_by")
    .eq("customer_id", customerId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);

  query = siteId === null ? query.is("site_id", null) : query.eq("site_id", siteId);

  const { data: existing } = await query.maybeSingle();

  const nowIso = new Date().toISOString();

  if (existing) {
    const patch: Record<string, unknown> = {
      status,
      rebate_amount: rebateAmount,
    };
    if (status === "generated" || status === "sent") {
      patch.generated_at = existing.generated_at ?? nowIso;
      patch.generated_by = existing.generated_by ?? userId;
    }
    if (status === "sent") {
      patch.sent_at = nowIso;
      patch.sent_by = userId;
      patch.recipient_email = recipientEmail;
    }
    await supabase.from("rebate_report_tracking").update(patch as never).eq("id", existing.id);
    return;
  }

  const insert: Record<string, unknown> = {
    customer_id: customerId,
    site_id: siteId,
    period_start: periodStart,
    period_end: periodEnd,
    status,
    rebate_amount: rebateAmount,
    generated_at: status === "generated" || status === "sent" ? nowIso : null,
    generated_by: status === "generated" || status === "sent" ? userId : null,
    sent_at: status === "sent" ? nowIso : null,
    sent_by: status === "sent" ? userId : null,
    recipient_email: status === "sent" ? recipientEmail : null,
  };

  await supabase.from("rebate_report_tracking").insert(insert as never);
}
