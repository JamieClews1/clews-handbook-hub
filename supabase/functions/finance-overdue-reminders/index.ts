import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "Clews Recycling Accounts <accounts@noreply.clewsrecycling.co.uk>";

const money = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(n || 0));
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB");
const render = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");

/** Daily job: marks invoices overdue and emails reminders on the configured days. */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Flag anything past its due date that still owes money.
    await admin
      .from("invoices")
      .update({ status: "overdue" })
      .lt("due_date", today)
      .eq("status_override", false)
      .in("status", ["unpaid", "partially_paid"]);

    const { data: settings } = await admin.from("finance_settings").select("*").limit(1).maybeSingle();
    const { data: company } = await admin
      .from("company_profile")
      .select("company_name")
      .limit(1)
      .maybeSingle();

    if (!settings?.reminders_enabled || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ success: true, remindersSent: 0, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reminderDays: number[] = (settings.reminder_days ?? [7, 14, 30]).slice().sort(
      (a: number, b: number) => a - b,
    );

    const { data: overdue } = await admin
      .from("invoices")
      .select("*")
      .lt("due_date", today)
      .in("status", ["unpaid", "partially_paid", "overdue"]);

    let sent = 0;
    for (const inv of overdue ?? []) {
      const days = Math.floor(
        (Date.now() - new Date(`${inv.due_date}T00:00:00`).getTime()) / 86_400_000,
      );
      const dueMilestone = [...reminderDays].reverse().find((d) => days >= d);
      if (!dueMilestone) continue;
      if (inv.last_reminder_day && inv.last_reminder_day >= dueMilestone) continue;

      const { data: fin } = await admin
        .from("customer_finance_details")
        .select("finance_contact_name, finance_contact_email")
        .eq("customer_id", inv.customer_id)
        .maybeSingle();
      if (!fin?.finance_contact_email) continue;

      const { data: cust } = await admin
        .from("customers")
        .select("customer_name")
        .eq("id", inv.customer_id)
        .maybeSingle();

      const vars = {
        invoice_number: inv.invoice_number,
        customer_name: cust?.customer_name ?? "",
        finance_contact_name: fin.finance_contact_name ?? "Sir/Madam",
        company_name: company?.company_name ?? "Clews Recycling",
        issue_date: fmtDate(inv.issue_date),
        due_date: fmtDate(inv.due_date),
        total: money(Number(inv.gross_total) - Number(inv.amount_paid)),
        days_overdue: String(days),
      };

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [fin.finance_contact_email],
          reply_to: "accounts@clewsrecycling.co.uk",
          subject: render(settings.reminder_email_subject, vars),
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${render(
            settings.reminder_email_body,
            vars,
          )}</div>`,
        }),
      });

      if (res.ok) {
        sent++;
        await admin
          .from("invoices")
          .update({ last_reminder_at: new Date().toISOString(), last_reminder_day: dueMilestone })
          .eq("id", inv.id);
      } else {
        console.error("Reminder failed", inv.invoice_number, await res.text());
      }
    }

    return new Response(JSON.stringify({ success: true, remindersSent: sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("finance-overdue-reminders error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
