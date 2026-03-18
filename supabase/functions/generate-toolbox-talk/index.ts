import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, userTypes } = await req.json();

    if (!topic) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const audienceDesc = userTypes && userTypes.length > 0
      ? `The audience is: ${userTypes.join(", ")} staff at a waste recycling company (Clews Recycling).`
      : "The audience is all staff at a waste recycling company (Clews Recycling).";

    const systemPrompt = `You are a health & safety expert who writes Toolbox Talk briefings for a UK waste recycling company. 
Write concise, practical safety briefings that workers can read in 5-10 minutes.

Rules:
- Return a JSON object with "title" (string) and "content" (HTML string).
- The content should use proper HTML: <h3> for sub-headings, <p> for paragraphs, <ul>/<li> for bullet points, <strong> for emphasis.
- Include sections like: Introduction, Key Hazards, Safe Working Practices, Key Points to Remember.
- Keep language simple and direct. Use UK English.
- Do NOT wrap the JSON in markdown code fences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write a Toolbox Talk about: "${topic}". ${audienceDesc}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_toolbox_talk",
              description: "Create a toolbox talk with a title and HTML content",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "The title of the toolbox talk" },
                  content: { type: "string", description: "The HTML content of the toolbox talk" },
                },
                required: ["title", "content"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_toolbox_talk" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      // Fallback: try parsing content directly
      const rawContent = data.choices?.[0]?.message?.content || "";
      try {
        const parsed = JSON.parse(rawContent.replace(/```json\n?|\n?```/g, "").trim());
        return new Response(JSON.stringify({ title: parsed.title, content: parsed.content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        throw new Error("Failed to parse AI response");
      }
    }

    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ title: args.title, content: args.content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating toolbox talk:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
