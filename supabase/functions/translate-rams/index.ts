import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslateAndStoreRequest {
  rams_id: string;
}

interface TranslateRequest {
  texts: string[];
  target_lang: string;
}

async function translateText(texts: string[], targetLang: string, deeplApiKey: string): Promise<string[]> {
  // Filter out empty strings
  const nonEmptyTexts = texts.filter(t => t && t.trim());
  if (nonEmptyTexts.length === 0) return texts.map(() => '');

  // DeepL Pro keys end with ":fx", free keys don't - use appropriate endpoint
  const isFreeKey = deeplApiKey.endsWith(':fx');
  const apiUrl = isFreeKey 
    ? 'https://api-free.deepl.com/v2/translate' 
    : 'https://api.deepl.com/v2/translate';

  console.log(`Using DeepL ${isFreeKey ? 'Free' : 'Pro'} API endpoint`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${deeplApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: nonEmptyTexts,
      target_lang: targetLang,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepL API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Map translations back to original positions
  let translationIndex = 0;
  return texts.map(originalText => {
    if (!originalText || !originalText.trim()) return '';
    return data.translations[translationIndex++]?.text || originalText;
  });
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

    const body = await req.json();
    
    // Check if this is a store request (new pattern) or legacy translate request
    if (body.rams_id) {
      // New pattern: Translate and store in database
      const { rams_id } = body as TranslateAndStoreRequest;
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase credentials not configured');
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Fetch the RAMS document
      const { data: rams, error: ramsError } = await supabase
        .from('rams')
        .select('*')
        .eq('id', rams_id)
        .single();
      
      if (ramsError) throw new Error(`Failed to fetch RAMS: ${ramsError.message}`);
      
      // Fetch hazards
      const { data: hazards, error: hazardsError } = await supabase
        .from('rams_hazards')
        .select('*')
        .eq('rams_id', rams_id)
        .order('display_order');
      
      if (hazardsError) throw new Error(`Failed to fetch hazards: ${hazardsError.message}`);
      
      console.log(`Translating RAMS ${rams_id} with ${hazards?.length || 0} hazards`);
      
      // Prepare texts to translate for RAMS
      const ramsTexts = [
        rams.title || '',
        rams.notice_to_drivers || '',
      ];
      
      // Prepare texts for each hazard
      const hazardTexts = (hazards || []).flatMap(h => [
        h.activity || '',
        h.potential_hazard || '',
        h.who_at_risk || '',
        h.control_measures || '',
        h.notes || '',
      ]);
      
      const allTexts = [...ramsTexts, ...hazardTexts];
      
      // Translate to each language
      const languages = ['PL', 'UK', 'RO'];
      
      for (const lang of languages) {
        console.log(`Translating to ${lang}...`);
        const translations = await translateText(allTexts, lang, deeplApiKey);
        
        // Update RAMS with translations
        const langSuffix = lang.toLowerCase();
        const ramsUpdate: Record<string, string> = {};
        ramsUpdate[`title_${langSuffix}`] = translations[0];
        ramsUpdate[`notice_to_drivers_${langSuffix}`] = translations[1];
        
        const { error: updateRamsError } = await supabase
          .from('rams')
          .update(ramsUpdate)
          .eq('id', rams_id);
        
        if (updateRamsError) {
          console.error(`Error updating RAMS translations for ${lang}:`, updateRamsError);
        }
        
        // Update each hazard with translations
        let textIndex = 2; // Start after RAMS texts
        for (const hazard of (hazards || [])) {
          const hazardUpdate: Record<string, string> = {};
          hazardUpdate[`activity_${langSuffix}`] = translations[textIndex++];
          hazardUpdate[`potential_hazard_${langSuffix}`] = translations[textIndex++];
          hazardUpdate[`who_at_risk_${langSuffix}`] = translations[textIndex++];
          hazardUpdate[`control_measures_${langSuffix}`] = translations[textIndex++];
          hazardUpdate[`notes_${langSuffix}`] = translations[textIndex++];
          
          const { error: updateHazardError } = await supabase
            .from('rams_hazards')
            .update(hazardUpdate)
            .eq('id', hazard.id);
          
          if (updateHazardError) {
            console.error(`Error updating hazard ${hazard.id} translations for ${lang}:`, updateHazardError);
          }
        }
        
        // Add small delay between languages to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Translated RAMS and ${hazards?.length || 0} hazards to 3 languages`,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      // Legacy pattern: Just translate texts and return (for PDF generation fallback)
      const { texts, target_lang } = body as TranslateRequest;

      if (!texts || !Array.isArray(texts)) {
        throw new Error('texts array is required');
      }

      if (!target_lang) {
        throw new Error('target_lang is required');
      }

      console.log(`Translating ${texts.length} texts to ${target_lang}`);

      const translations = await translateText(texts, target_lang, deeplApiKey);

      return new Response(
        JSON.stringify({ 
          success: true, 
          translations,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
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
