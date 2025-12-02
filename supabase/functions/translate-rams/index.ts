import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranslateRequest {
  texts: string[];
  target_lang: string;
}

async function translateText(texts: string[], targetLang: string, deeplApiKey: string): Promise<string[]> {
  // Filter out empty strings
  const nonEmptyTexts = texts.filter(t => t && t.trim());
  if (nonEmptyTexts.length === 0) return texts.map(() => '');

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
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

    const { texts, target_lang }: TranslateRequest = await req.json();

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
