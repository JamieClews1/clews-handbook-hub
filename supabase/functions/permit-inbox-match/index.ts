import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const compact = (s: unknown) => String(s ?? "").toUpperCase().replace(/\s+/g, "");

/** Link council replies in the orders inbox to permit records. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supabase
      .from("permit_settings").select("*").order("created_at").limit(1).maybeSingle();

    const { data: councils = [] } = await supabase.from("permit_councils").select("*");
    const councilAddresses = new Set(
      (councils as any[]).flatMap((c) => [...(c.application_emails ?? []), ...(c.cc_emails ?? [])])
        .map((e: string) => e.toLowerCase().trim())
        .filter(Boolean),
    );
    if (councilAddresses.size === 0) return json({ ok: true, matched: 0, note: "No council emails configured" });

    // Permits awaiting a council reply
    const { data: permits = [] } = await supabase
      .from("permit_applications")
      .select("*")
      .in("status", ["applied", "needed"])
      .order("applied_at", { ascending: false })
      .limit(200);
    if (permits.length === 0) return json({ ok: true, matched: 0 });

    // Recent inbox messages
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const { data: tickets = [] } = await supabase
      .from("crm_tickets")
      .select("id, subject, snippet, sender_email, last_message_at")
      .gte("last_message_at", since)
      .limit(500);

    const unmatched: any[] = [];
    let matched = 0;

    for (const t of tickets as any[]) {
      const sender = String(t.sender_email ?? "").toLowerCase().trim();
      if (!councilAddresses.has(sender)) continue;

      const haystack = `${t.subject ?? ""} ${t.snippet ?? ""}`;
      const hay = haystack.toUpperCase();
      const hayCompact = compact(haystack);

      const hit = (permits as any[]).find((p) => {
        if (p.permit_reference && hay.includes(String(p.permit_reference).toUpperCase())) return true;
        if (p.site_postcode && hayCompact.includes(compact(p.site_postcode))) return true;
        if (p.job_number && hay.includes(String(p.job_number).toUpperCase())) return true;
        return false;
      });

      if (!hit) {
        unmatched.push({ ticket_id: t.id, subject: t.subject, from: sender });
        continue;
      }

      const updates: Record<string, unknown> = { crm_ticket_id: t.id };

      if (settings?.auto_confirm_from_replies && hit.status === "applied") {
        const looksConfirmed = /approv|grant|confirm|issued|licence|license/i.test(haystack);
        if (looksConfirmed) {
          updates.status = "active";
          updates.confirmed_at = new Date().toISOString();
          // capture a permit reference if the reply quotes one
          const ref = haystack.match(/\b(?:permit|licence|license|ref(?:erence)?)\s*(?:no\.?|number|#|:)?\s*([A-Z0-9][A-Z0-9\/-]{4,})/i);
          if (ref && !hit.permit_reference) updates.permit_reference = ref[1];
        }
      }

      await supabase.from("permit_applications").update(updates).eq("id", hit.id);
      matched++;
    }

    return json({ ok: true, matched, unmatched });
  } catch (e) {
    console.error("permit-inbox-match error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
