import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM = "Clews Recycling <pods@noreply.clewsrecycling.co.uk>";
const CC = "orders@clewsrecycling.co.uk";
const MAX_ATTACHMENTS = 20;

const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

interface PodRow {
  id: string;
  file_name: string;
  storage_path: string;
  job_number: string | null;
  customer: string | null;
  site: string | null;
  delivery_date: string | null;
  created_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }
    const dryRun = body?.dryRun === true;
    const lookbackDays = Number(body?.lookbackDays) || 7;
    const testCustomerId: string | undefined = body?.customerId;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey && !dryRun) throw new Error("RESEND_API_KEY is not configured");

    const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();
    const digestDate = new Date().toISOString().slice(0, 10);

    // 1. Candidate PODs
    const { data: pods, error: podErr } = await supabase
      .from("pod_documents")
      .select("id,file_name,storage_path,job_number,customer,site,delivery_date,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true });
    if (podErr) throw podErr;

    // 2. Already-sent POD ids
    const { data: logs } = await supabase
      .from("pod_email_logs")
      .select("pod_ids")
      .eq("status", "sent")
      .gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString());
    const sent = new Set<string>();
    for (const l of logs ?? []) for (const id of (l as any).pod_ids ?? []) sent.add(id);

    const pending = ((pods ?? []) as PodRow[]).filter((p) => !sent.has(p.id));
    if (pending.length === 0) {
      return json({ ok: true, message: "No new PODs to send", sent: 0 });
    }

    // 3. Customers with auto POD emails on
    let custQuery = supabase
      .from("customers")
      .select("id,customer_name,data_hub_customer,pod_email,auto_pod_emails_enabled")
      .eq("auto_pod_emails_enabled", true);
    if (testCustomerId) custQuery = custQuery.eq("id", testCustomerId);
    const { data: customers, error: custErr } = await custQuery;
    if (custErr) throw custErr;
    if (!customers?.length) return json({ ok: true, message: "No customers enabled", sent: 0 });

    const custIds = customers.map((c: any) => c.id);
    const { data: sites } = await supabase
      .from("customer_sites")
      .select(
        "id,customer_id,site_name,pod_email,data_hub_customer,data_hub_site,data_hub_site_2,data_hub_site_3,data_hub_site_4,data_hub_site_5",
      )
      .in("customer_id", custIds);

    // Lookup maps
    const custByName = new Map<string, any>();
    for (const c of customers as any[]) {
      if (c.customer_name) custByName.set(norm(c.customer_name), c);
      if (c.data_hub_customer) custByName.set(norm(c.data_hub_customer), c);
    }
    for (const s of (sites ?? []) as any[]) {
      if (s.data_hub_customer) {
        const c = (customers as any[]).find((x) => x.id === s.customer_id);
        if (c) custByName.set(norm(s.data_hub_customer), c);
      }
    }

    const siteMatch = (customerId: string, podSite: string | null) => {
      const n = norm(podSite);
      if (!n) return null;
      return (
        ((sites ?? []) as any[]).find(
          (s) =>
            s.customer_id === customerId &&
            [s.site_name, s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5]
              .filter(Boolean)
              .some((v: string) => norm(v) === n),
        ) ?? null
      );
    };

    // 4. Group PODs by recipient
    type Group = { customer: any; site: any | null; email: string; pods: PodRow[] };
    const groups = new Map<string, Group>();
    for (const p of pending) {
      const c = custByName.get(norm(p.customer));
      if (!c) continue;
      const s = siteMatch(c.id, p.site);
      const email = (s?.pod_email || c.pod_email || "").trim();
      if (!email) continue;
      const key = `${c.id}|${s?.id ?? "all"}|${email.toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { customer: c, site: s, email, pods: [] });
      groups.get(key)!.pods.push(p);
    }

    if (groups.size === 0) return json({ ok: true, message: "No matching PODs for enabled customers", sent: 0 });

    const results: any[] = [];

    for (const g of groups.values()) {
      const batch = g.pods.slice(0, MAX_ATTACHMENTS);
      const attachments: { filename: string; content: string }[] = [];

      for (const p of batch) {
        const { data: file, error: dlErr } = await supabase.storage.from("pods").download(p.storage_path);
        if (dlErr || !file) continue;
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 8192) {
          bin += String.fromCharCode(...buf.subarray(i, i + 8192));
        }
        attachments.push({ filename: p.file_name, content: btoa(bin) });
      }

      const rows = batch
        .map(
          (p) =>
            `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${p.job_number ?? "—"}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.site ?? "—"}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.delivery_date ?? new Date(p.created_at).toISOString().slice(0, 10)}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.file_name}</td></tr>`,
        )
        .join("");

      const subject = `Proof of Delivery documents — ${g.site?.site_name ?? g.customer.customer_name} (${batch.length})`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
          <div style="background:#f4f4f4;padding:20px;border-bottom:3px solid #22c55e;">
            <h1 style="margin:0;font-size:20px;color:#333;">Proof of Delivery documents</h1>
          </div>
          <div style="padding:20px;background:#fff;color:#333;font-size:14px;line-height:1.6;">
            <p>Hello,</p>
            <p>Please find attached ${batch.length} proof of delivery document${batch.length === 1 ? "" : "s"} for
            <strong>${g.site?.site_name ?? g.customer.customer_name}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px;">
              <thead><tr style="background:#f5f5f5;">
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Job</th>
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Site</th>
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Date</th>
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">File</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="margin-top:16px;">If you have any questions, please reply to
            <a href="mailto:orders@clewsrecycling.co.uk">orders@clewsrecycling.co.uk</a>.</p>
          </div>
          <div style="background:#f4f4f4;padding:15px;text-align:center;font-size:12px;color:#666;">
            Clews Recycling Limited — automated proof of delivery digest
          </div>
        </div>`;

      if (dryRun) {
        results.push({ to: g.email, pods: batch.length, dryRun: true });
        continue;
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [g.email],
          cc: [CC],
          reply_to: CC,
          subject,
          html,
          attachments,
        }),
      });
      const out = await res.json().catch(() => ({}));

      await supabase.from("pod_email_logs").insert({
        customer_id: g.customer.id,
        customer_name: g.customer.customer_name,
        site: g.site?.site_name ?? null,
        recipient_email: g.email,
        pod_count: batch.length,
        pod_ids: res.ok ? batch.map((p) => p.id) : [],
        digest_date: digestDate,
        status: res.ok ? "sent" : "failed",
        error_message: res.ok ? null : JSON.stringify(out).slice(0, 500),
      });

      results.push({ to: g.email, pods: batch.length, ok: res.ok, error: res.ok ? null : out });
    }

    return json({ ok: true, groups: results.length, results });
  } catch (e: any) {
    console.error("send-pod-digest error", e);
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
