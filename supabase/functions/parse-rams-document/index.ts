import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent } = await req.json();

    if (!documentContent) {
      return new Response(
        JSON.stringify({ error: 'No document content provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing RAMS document with AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a RAMS (Risk Assessment Method Statement) document parser. Extract structured data from RAMS documents and return JSON.

IMPORTANT EXTRACTION RULES:
- The reference_code is usually at the start of the document, like "RA01", "RA02", etc. Look for patterns like "RA01 EXAMPLE" or "RA01" followed by the title.
- The title is the main heading describing what the RAMS is about, e.g., "RORO (Roll on and Roll Off Skips)", "Manual Handling", etc.
- If you see "RA01 EXAMPLE - RORO (Roll on and Roll Off Skips)", the reference_code is "RA01" and the title is "RORO (Roll on and Roll Off Skips)"
- Extract the reference code from any text pattern like "RA##" where ## is numbers

Always return a valid JSON object with this exact structure:
{
  "reference_code": "string - the reference code like RA01 (REQUIRED - look for RA followed by numbers)",
  "title": "string - the descriptive title of the RAMS (REQUIRED - the main subject)",
  "applicable_to": ["array of strings - what the RAMS applies to"],
  "notice_to_drivers": "string - any notice to drivers text, or empty string",
  "hazards": [
    {
      "activity": "string - the activity/task",
      "potential_hazard": "string - the potential hazard",
      "who_at_risk": "string - who is at risk",
      "initial_likelihood": number (1-5),
      "initial_severity": number (1-5),
      "control_measures": "string - control measures",
      "residual_likelihood": number (1-5),
      "residual_severity": number (1-5),
      "notes": "string - any notes, or empty string"
    }
  ]
}

Parse the document carefully. For risk ratings, use the numbers provided in the document.`
          },
          {
            role: 'user',
            content: `Parse this RAMS document and extract structured data:\n\n${documentContent}`
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('AI Response:', content);

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Parse the JSON
    const parsedData = JSON.parse(jsonStr);

    console.log('Parsed RAMS data:', JSON.stringify(parsedData, null, 2));

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error parsing RAMS document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse document';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
