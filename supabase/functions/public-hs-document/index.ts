import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TOKEN_RE = /^[a-zA-Z0-9_-]{8,128}$/;
const str = (v: unknown, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : null;

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
      .from("hs_document_share_links")
      .select("id, document_id, label, is_active, view_count")
      .eq("token", token)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link || !link.is_active) return json({ error: "This link is no longer available" }, 404);

    if (req.method === "POST") {
      const name = str(body.name, 200);
      const signatureImage = str(body.signature_image, 500000);
      const language = str(body.language, 10) || "EN";
      if (!name) return json({ error: "Name is required" }, 400);
      if (!signatureImage || !signatureImage.startsWith("data:image/")) {
        return json({ error: "Signature is required" }, 400);
      }
      const acknowledgements = Array.isArray(body.acknowledgements)
        ? body.acknowledgements.filter((a) => typeof a === "string").slice(0, 100)
        : [];

      const { data: doc } = await supabase
        .from("hs_documents")
        .select("id, site")
        .eq("id", link.document_id)
        .maybeSingle();
      if (!doc) return json({ error: "Document not found" }, 404);

      const { error: insertError } = await supabase
        .from("hs_document_guest_signatures")
        .insert({
          document_id: doc.id,
          share_link_id: link.id,
          signature_image: signatureImage,
          employee_name: name,
          date_of_birth: str(body.date_of_birth, 10),
          job_title: str(body.job_title, 200),
          inducted_by: str(body.inducted_by, 200),
          site: doc.site,
          language,
          acknowledgements,
        });
      if (insertError) throw insertError;
      return json({ success: true });
    }

    // GET: return the document for the public signing page
    const { data: doc, error: docError } = await supabase
      .from("hs_documents")
      .select(
        "id, category, reference_code, title, title_pl, title_uk, title_ro, content, content_pl, content_uk, content_ro, acknowledgements, acknowledgements_pl, acknowledgements_uk, acknowledgements_ro, site, version, requires_signature, is_published",
      )
      .eq("id", link.document_id)
      .maybeSingle();
    if (docError) throw docError;
    if (!doc || !doc.is_published) return json({ error: "Document not available" }, 404);

    await supabase
      .from("hs_document_share_links")
      .update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq("id", link.id);

    return json({ document: doc, label: link.label });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
