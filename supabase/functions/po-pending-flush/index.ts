import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minutes to wait after the last PO change before auto-sending the notification.
const AUTO_SEND_AFTER_MINUTES = 20;

interface PendingRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  user_id: string;
  changed_by: string | null;
  notification_email: string | null;
  job_id: string;
  site_name: string | null;
  job_number: string;
  job_date: string | null;
  old_po_number: string | null;
  new_po_number: string;
  created_at: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Pull all unsent pending changes
    const { data: rows, error } = await supabase
      .from("po_pending_changes")
      .select("*")
      .eq("sent", false)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const pending = (rows ?? []) as PendingRow[];
    if (pending.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Group by user + customer session
    const groups = new Map<string, PendingRow[]>();
    for (const row of pending) {
      const key = `${row.user_id}::${row.customer_id ?? row.customer_name}`;
      const arr = groups.get(key) ?? [];
      arr.push(row);
      groups.set(key, arr);
    }

    const now = Date.now();
    const cutoffMs = AUTO_SEND_AFTER_MINUTES * 60 * 1000;
    let sentGroups = 0;
    let sentRows = 0;

    for (const [, groupRows] of groups) {
      // Only fire once the MOST RECENT change in the group is older than the cutoff.
      const latest = Math.max(...groupRows.map((r) => new Date(r.created_at).getTime()));
      if (now - latest < cutoffMs) continue;

      const first = groupRows[0];
      const changes = groupRows.map((r) => ({
        siteName: r.site_name ?? "",
        jobNumber: r.job_number,
        jobDate: r.job_date ?? "",
        oldPONumber: r.old_po_number,
        newPONumber: r.new_po_number,
      }));

      // Reuse the existing notification function so the email format stays consistent.
      const resp = await fetch(`${supabaseUrl}/functions/v1/po-change-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          notificationEmail: first.notification_email ?? undefined,
          customerName: first.customer_name,
          changedBy: `${first.changed_by ?? "Unknown"} (auto-sent after ${AUTO_SEND_AFTER_MINUTES} min)`,
          changes,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error(`Auto-send failed for group (${changes.length} change(s)):`, text);
        continue;
      }

      const ids = groupRows.map((r) => r.id);
      const { error: markError } = await supabase
        .from("po_pending_changes")
        .update({ sent: true, sent_at: new Date().toISOString() })
        .in("id", ids);

      if (markError) {
        console.error("Failed to mark rows as sent:", markError.message);
        continue;
      }

      sentGroups += 1;
      sentRows += ids.length;
      console.log(`Auto-sent ${ids.length} PO change(s) for ${first.customer_name}`);
    }

    return new Response(
      JSON.stringify({ success: true, groups: sentGroups, changes: sentRows }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err: any) {
    console.error("Error in po-pending-flush:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
