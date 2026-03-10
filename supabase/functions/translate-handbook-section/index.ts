import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslateResponse {
  translations: Array<{ text: string }>;
}

async function translateText(texts: string[], targetLang: string, deeplApiKey: string): Promise<string[]> {
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepL API error: ${response.status} - ${error}`);
  }

  const data: TranslateResponse = await response.json();
  await new Promise(resolve => setTimeout(resolve, 500));
  return data.translations.map(t => t.text);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const deeplApiKey = Deno.env.get('DEEPL_API_KEY');
    if (!deeplApiKey) throw new Error('DEEPL_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase credentials not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { section_ids, subsection_ids, mode } = await req.json();

    // mode: "all" = translate everything, "selective" = only specified ids
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Determine what to translate
          let sectionsToTranslate: any[] = [];
          let subsectionsToTranslate: any[] = [];

          if (mode === 'all') {
            const { data: s } = await supabase.from('handbook_sections').select('*').order('display_order');
            const { data: sub } = await supabase.from('handbook_subsections').select('*').order('display_order');
            sectionsToTranslate = s || [];
            subsectionsToTranslate = sub || [];
          } else {
            if (section_ids?.length) {
              const { data: s } = await supabase.from('handbook_sections').select('*').in('id', section_ids);
              sectionsToTranslate = s || [];
            }
            if (subsection_ids?.length) {
              const { data: sub } = await supabase.from('handbook_subsections').select('*').in('id', subsection_ids);
              subsectionsToTranslate = sub || [];
            }
          }

          const totalItems = sectionsToTranslate.length + subsectionsToTranslate.length;
          let completed = 0;

          send('status', { message: `Starting translation of ${totalItems} items...`, total: totalItems, completed: 0 });

          // Translate sections
          for (const section of sectionsToTranslate) {
            if (!section.title_en) { completed++; continue; }

            send('progress', { message: `Translating section: ${section.title_en}`, item: section.title_en, type: 'section', completed, total: totalItems });

            try {
              const plTitle = (await translateText([section.title_en], 'PL', deeplApiKey))[0];
              const ukTitle = (await translateText([section.title_en], 'UK', deeplApiKey))[0];
              const roTitle = (await translateText([section.title_en], 'RO', deeplApiKey))[0];

              await supabase.from('handbook_sections').update({
                title_pl: plTitle,
                title_uk: ukTitle,
                title_ro: roTitle,
              }).eq('id', section.id);

              completed++;
              send('progress', { message: `✓ Section "${section.title_en}" translated`, item: section.title_en, type: 'section', completed, total: totalItems, success: true });
            } catch (err) {
              completed++;
              send('error', { message: `✗ Failed to translate section "${section.title_en}": ${err.message}`, item: section.title_en });
            }
          }

          // Translate subsections
          for (const subsection of subsectionsToTranslate) {
            if (!subsection.title_en || !subsection.content_en) { completed++; continue; }

            send('progress', { message: `Translating subsection: ${subsection.title_en}`, item: subsection.title_en, type: 'subsection', completed, total: totalItems });

            try {
              const plTranslations = await translateText([subsection.title_en, subsection.content_en], 'PL', deeplApiKey);
              const ukTranslations = await translateText([subsection.title_en, subsection.content_en], 'UK', deeplApiKey);
              const roTranslations = await translateText([subsection.title_en, subsection.content_en], 'RO', deeplApiKey);

              await supabase.from('handbook_subsections').update({
                title_pl: plTranslations[0],
                content_pl: plTranslations[1],
                title_uk: ukTranslations[0],
                content_uk: ukTranslations[1],
                title_ro: roTranslations[0],
                content_ro: roTranslations[1],
              }).eq('id', subsection.id);

              completed++;
              send('progress', { message: `✓ Subsection "${subsection.title_en}" translated`, item: subsection.title_en, type: 'subsection', completed, total: totalItems, success: true });
            } catch (err) {
              completed++;
              send('error', { message: `✗ Failed to translate subsection "${subsection.title_en}": ${err.message}`, item: subsection.title_en });
            }
          }

          send('complete', { message: `Translation complete! ${completed}/${totalItems} items processed.`, completed, total: totalItems });
        } catch (err) {
          send('error', { message: `Fatal error: ${err.message}` });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
