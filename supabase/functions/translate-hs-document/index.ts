import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function translateText(texts: string[], targetLang: string, key: string): Promise<string[]> {
  const nonEmpty = texts.filter((t) => t.trim() !== "");
  if (nonEmpty.length === 0) return texts;

  const isFreeKey = key.endsWith(":fx");
  const apiUrl = isFreeKey
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: nonEmpty, target_lang: targetLang, tag_handling: "html" }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("DeepL API error:", error);
    throw new Error(`DeepL API error: ${response.status}`);
  }

  const data = await response.json();
  const map = new Map<string, string>();
  nonEmpty.forEach((original, i) => map.set(original, data.translations[i].text));
  return texts.map((t) => (t.trim() === "" ? t : map.get(t) || t));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const deeplApiKey = Deno.env.get("DEEPL_API_KEY");
    if (!deeplApiKey) throw new Error("DEEPL_API_KEY not configured");

    const { document_id } = await req.json();
    if (!document_id) throw new Error("document_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: doc, error } = await supabase
      .from("hs_documents")
      .select("*")
      .eq("id", document_id)
      .single();
    if (error) throw new Error(`Failed to fetch document: ${error.message}`);

    const acks: string[] = Array.isArray(doc.acknowledgements) ? doc.acknowledgements : [];

    for (const lang of ["PL", "UK", "RO"]) {
      console.log(`Translating H&S document ${document_id} to ${lang}`);
      const translated = await translateText(
        [doc.title || "", doc.content || "", ...acks],
        lang,
        deeplApiKey,
      );
      const suffix = lang.toLowerCase();
      const update: Record<string, unknown> = {};
      update[`title_${suffix}`] = translated[0];
      update[`content_${suffix}`] = translated[1];
      update[`acknowledgements_${suffix}`] = translated.slice(2);

      const { error: updErr } = await supabase
        .from("hs_documents")
        .update(update)
        .eq("id", document_id);
      if (updErr) console.error(`Update error for ${lang}:`, updErr);

      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ success: true, message: "Translated to Polish, Ukrainian and Romanian" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("translate-hs-document error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
