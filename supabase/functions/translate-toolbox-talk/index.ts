import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranslateAndStoreRequest {
  toolbox_talk_id: string;
}

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

  // DeepL Pro keys end with ":fx", free keys don't - use appropriate endpoint
  const isFreeKey = deeplApiKey.endsWith(':fx');
  const apiUrl = isFreeKey 
    ? 'https://api-free.deepl.com/v2/translate' 
    : 'https://api.deepl.com/v2/translate';

  console.log(`Using DeepL ${isFreeKey ? 'Free' : 'Pro'} API endpoint`);

  const response = await fetch(apiUrl, {
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

    const body = await req.json();

    // Check if this is a store request (new pattern) or legacy translate request
    if (body.toolbox_talk_id) {
      // New pattern: Translate and store in database
      const { toolbox_talk_id } = body as TranslateAndStoreRequest;
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase credentials not configured');
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Fetch the Toolbox Talk
      const { data: talk, error: talkError } = await supabase
        .from('toolbox_talks')
        .select('*')
        .eq('id', toolbox_talk_id)
        .single();
      
      if (talkError) throw new Error(`Failed to fetch Toolbox Talk: ${talkError.message}`);
      
      console.log(`Translating Toolbox Talk ${toolbox_talk_id}`);
      
      // Prepare texts to translate
      const textsToTranslate = [
        talk.title || '',
        talk.content || '',
      ];
      
      // Translate to each language
      const languages = ['PL', 'UK', 'RO'];
      
      for (const lang of languages) {
        console.log(`Translating to ${lang}...`);
        const translations = await translateText(textsToTranslate, lang, deeplApiKey);
        
        // Update Toolbox Talk with translations
        const langSuffix = lang.toLowerCase();
        const update: Record<string, string> = {};
        update[`title_${langSuffix}`] = translations[0];
        update[`content_${langSuffix}`] = translations[1];
        
        const { error: updateError } = await supabase
          .from('toolbox_talks')
          .update(update)
          .eq('id', toolbox_talk_id);
        
        if (updateError) {
          console.error(`Error updating Toolbox Talk translations for ${lang}:`, updateError);
        }
        
        // Add small delay between languages to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Translated Toolbox Talk to 3 languages',
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // Legacy pattern: Just translate texts and return (for PDF generation fallback)
      const { texts, target_lang }: TranslateRequest = body;

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
    }
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
