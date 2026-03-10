import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslateRequest {
  text: string[];
  target_lang: string;
}

interface TranslateResponse {
  translations: Array<{ text: string }>;
}

async function translateText(texts: string[], targetLang: string, deeplApiKey: string, retries = 3): Promise<string[]> {
  const isFreeKey = deeplApiKey.endsWith(':fx');
  const apiUrl = isFreeKey ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: texts,
        target_lang: targetLang,
      }),
    });

    if (response.status === 429) {
      const backoff = Math.pow(2, attempt + 1) * 2000;
      console.log(`Rate limited (attempt ${attempt + 1}/${retries}), waiting ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      continue;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepL API error: ${response.status} - ${error}`);
    }

    const data: TranslateResponse = await response.json();
    await new Promise(resolve => setTimeout(resolve, 1500));
    return data.translations.map(t => t.text);
  }
  throw new Error(`DeepL rate limit exceeded after ${retries} retries`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const deeplApiKey = Deno.env.get('DEEPL_API_KEY');
    if (!deeplApiKey) {
      throw new Error('DEEPL_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching handbook sections...');
    const { data: sections, error: sectionsError } = await supabase
      .from('handbook_sections')
      .select('*')
      .order('display_order');

    if (sectionsError) throw sectionsError;

    console.log(`Found ${sections?.length || 0} sections`);

    // Translate sections one language at a time to avoid rate limits
    for (const section of sections || []) {
      if (!section.title_en) continue;

      console.log(`Translating section: ${section.title_en}`);

      // Translate sequentially instead of parallel to avoid rate limits
      const plTitle = (await translateText([section.title_en], 'PL', deeplApiKey))[0];
      const ukTitle = (await translateText([section.title_en], 'UK', deeplApiKey))[0];
      const roTitle = (await translateText([section.title_en], 'RO', deeplApiKey))[0];

      const { error: updateError } = await supabase
        .from('handbook_sections')
        .update({
          title_pl: plTitle,
          title_uk: ukTitle,
          title_ro: roTitle,
        })
        .eq('id', section.id);

      if (updateError) {
        console.error(`Error updating section ${section.id}:`, updateError);
      }
    }

    console.log('Fetching handbook subsections...');
    const { data: subsections, error: subsectionsError } = await supabase
      .from('handbook_subsections')
      .select('*')
      .order('display_order');

    if (subsectionsError) throw subsectionsError;

    console.log(`Found ${subsections?.length || 0} subsections`);

    // Translate subsections one at a time to avoid rate limits
    for (const subsection of subsections || []) {
      if (!subsection.title_en || !subsection.content_en) continue;

      console.log(`Translating subsection: ${subsection.title_en}`);

      try {
        // Translate one language at a time (sequential, not parallel)
        const plTranslations = await translateText([subsection.title_en, subsection.content_en], 'PL', deeplApiKey);
        const ukTranslations = await translateText([subsection.title_en, subsection.content_en], 'UK', deeplApiKey);
        const roTranslations = await translateText([subsection.title_en, subsection.content_en], 'RO', deeplApiKey);

        const { error: updateError } = await supabase
          .from('handbook_subsections')
          .update({
            title_pl: plTranslations[0],
            content_pl: plTranslations[1],
            title_uk: ukTranslations[0],
            content_uk: ukTranslations[1],
            title_ro: roTranslations[0],
            content_ro: roTranslations[1],
          })
          .eq('id', subsection.id);

        if (updateError) {
          console.error(`Error updating subsection ${subsection.id}:`, updateError);
        }
      } catch (error) {
        console.error(`Error translating subsection ${subsection.id}:`, error);
      }
    }

    console.log('Translation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All content translated successfully',
        sections: sections?.length || 0,
        subsections: subsections?.length || 0,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});