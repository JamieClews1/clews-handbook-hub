import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, rebateItems } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const itemsList = (rebateItems || [])
      .map((i: { id: string; name: string }) => `- "${i.name}" (id: ${i.id})`)
      .join("\n");

    const systemPrompt = `You are a data extraction assistant. You will be given a screenshot of a rebate/price schedule table. Extract all the data you can see.

The table typically has:
- Row headers: material/commodity names
- Column headers: months (January, February, etc.)
- Cell values: price ranges like "10 - 20" meaning lower=10, higher=20, or single values, or "-" meaning no data

You must match extracted material names to the following known rebate items:
${itemsList}

Return data using the extract_rebate_data tool. Match materials to the closest rebate item by name. If no match exists, use the exact name from the image as "unmatchedName".

For each cell with data (not "-" or empty), extract:
- The matched item id (or null if unmatched)
- The month (1-12)  
- The year (look for it in the table header, e.g. "2025" or "2026")
- lower and higher values from the range (e.g. "10 - 20" → lower=10, higher=20)
- If only one value, set both lower and higher to that value`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all rebate/price data from this screenshot. Match materials to the known rebate items where possible.",
                },
                {
                  type: "image_url",
                  image_url: { url: imageBase64 },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_rebate_data",
                description:
                  "Extract rebate price data from a schedule screenshot",
                parameters: {
                  type: "object",
                  properties: {
                    year: {
                      type: "number",
                      description: "The year from the table header",
                    },
                    tableTitle: {
                      type: "string",
                      description: "The title/header of the table if visible",
                    },
                    entries: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          itemId: {
                            type: "string",
                            description:
                              "The matched rebate item id, or null if unmatched",
                          },
                          itemName: {
                            type: "string",
                            description: "The matched rebate item name",
                          },
                          unmatchedName: {
                            type: "string",
                            description:
                              "Original name from image if no match found",
                          },
                          month: {
                            type: "number",
                            description: "Month number 1-12",
                          },
                          lower: {
                            type: "number",
                            description: "Lower range value",
                          },
                          higher: {
                            type: "number",
                            description: "Higher range value",
                          },
                        },
                        required: ["month", "lower", "higher"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["year", "entries"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_rebate_data" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log("Extracted rebate data:", JSON.stringify(extracted));

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in parse-rebate-screenshot:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
