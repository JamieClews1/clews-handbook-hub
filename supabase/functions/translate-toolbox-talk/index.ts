import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranslateRequest {
  texts: string[];
  target_lang: string;
}

async function translateText(
  texts: string[],
  targetLang: string,
  deeplApiKey: string
): Promise<string[]> {
  const nonEmptyTexts = texts.filter((t) => t.trim() !== "");
  if (nonEmptyTexts.length === 0) return texts;

  const response = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${deeplApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: nonEmptyTexts,
      target_lang: targetLang,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("DeepL API error:", error);
    throw new Error(`DeepL API error: ${response.status}`);
  }

  const data = await response.json();
  const translatedMap = new Map<string, string>();
  
  nonEmptyTexts.forEach((original, index) => {
    translatedMap.set(original, data.translations[index].text);
  });

  return texts.map((t) => (t.trim() === "" ? t : translatedMap.get(t) || t));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const deeplApiKey = Deno.env.get("DEEPL_API_KEY");
    if (!deeplApiKey) {
      throw new Error("DEEPL_API_KEY not configured");
    }

    const { texts, target_lang }: TranslateRequest = await req.json();

    if (!texts || !Array.isArray(texts) || !target_lang) {
      throw new Error("Invalid request: texts array and target_lang required");
    }

    console.log(`Translating ${texts.length} texts to ${target_lang}`);

    const translations = await translateText(texts, target_lang, deeplApiKey);

    return new Response(
      JSON.stringify({ success: true, translations }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Translation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
