import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Public read-and-sign endpoint for Toolbox Talk share links.
// Guests sign into toolbox_talk_guest_signatures only; staff sign-offs stay user-only.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TOKEN_RE = /^[a-zA-Z0-9_-]{8,128}$/;
const LANGS = new Set(["EN", "PL", "UK", "RO"]);
const str = (v: unknown, max = 500) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token") ?? "";
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      body = await req.json().catch(() => ({}));
      if (!token && typeof body?.token === "string") token = body.token;
    }
    if (!TOKEN_RE.test(token)) return json({ error: "Invalid link" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkError } = await supabase
      .from("toolbox_talk_share_links")
      .select("id, toolbox_talk_id, label, is_active, view_count")
      .eq("token", token)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link || !link.is_active) return json({ error: "This link is no longer available" }, 404);

    const { data: talk, error: talkError } = await supabase
      .from("toolbox_talks")
      .select("id, reference_code, title, title_pl, title_uk, title_ro, content, content_pl, content_uk, content_ro, user_types, is_mandatory, is_published, created_date")
      .eq("id", link.toolbox_talk_id)
      .maybeSingle();
    if (talkError) throw talkError;
    if (!talk || !talk.is_published) return json({ error: "This Toolbox Talk is not available" }, 404);

    if (req.method === "POST") {
      const name = str(body.name, 200);
      const signatureImage = typeof body.signature_image === "string" ? body.signature_image.slice(0, 500000) : "";
      const language = str(body.language, 4)?.toUpperCase() || "EN";
      if (!name) return json({ error: "Enter your full name" }, 400);
      if (!signatureImage.startsWith("data:image/")) return json({ error: "Signature is required" }, 400);

      const { error: insertError } = await supabase.from("toolbox_talk_guest_signatures").insert({
        toolbox_talk_id: talk.id,
        share_link_id: link.id,
        signer_name: name,
        company_name: str(body.company_name, 200),
        job_title: str(body.job_title, 200),
        language: LANGS.has(language) ? language : "EN",
        signature_image: signatureImage,
      });
      if (insertError) throw insertError;
      return json({ success: true });
    }

    await supabase
      .from("toolbox_talk_share_links")
      .update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq("id", link.id);

    const { is_published: _p, ...publicTalk } = talk;
    return json({ talk: publicTalk, label: link.label });
  } catch (e) {
    console.error("public-toolbox-talk", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
