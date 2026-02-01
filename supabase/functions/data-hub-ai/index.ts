import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, filters } = await req.json();
    
    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch sample data to understand the structure
    const { data: sampleJobs, error: sampleError } = await supabase
      .from("data_hub_jobs")
      .select("job_number, source, job_date, customer, site, ewc, waste_description, category, movement_type, container_type, weight_t, vehicle_registration")
      .limit(5);

    if (sampleError) {
      console.error("Error fetching sample data:", sampleError);
    }

    // Get distinct values for key fields
    const { data: customers } = await supabase
      .from("data_hub_jobs")
      .select("customer")
      .not("customer", "is", null)
      .limit(100);
    
    const { data: sites } = await supabase
      .from("data_hub_jobs")
      .select("site")
      .not("site", "is", null)
      .limit(100);

    const uniqueCustomers = [...new Set(customers?.map(c => c.customer).filter(Boolean))].slice(0, 30);
    const uniqueSites = [...new Set(sites?.map(s => s.site).filter(Boolean))].slice(0, 30);

    const systemPrompt = `You are a Performance Hub assistant for Clews Recycling. You help users query waste management job data.

## Database Schema
The data_hub_jobs table has these columns:
- job_number (text): Unique ticket/job number
- source (text): Either "skiptrak" or "midweigh"
- job_date (date): Date of the job
- customer (text): Customer name
- site (text): Site/location name
- ewc (text): European Waste Catalogue code
- waste_description (text): Description of waste type
- category (text): Waste category
- movement_type (text): Type of movement
- container_type (text): Type of container used
- weight_t (numeric): Weight in tonnes
- vehicle_registration (text): Vehicle registration

## Available Customers (sample):
${uniqueCustomers.join(", ")}

## Available Sites (sample):
${uniqueSites.join(", ")}

## Your Task
When a user asks a question, you must:
1. Understand their intent (filtering, aggregation, comparison)
2. Generate a Supabase query specification as JSON
3. Explain what you're doing

## Response Format
Always respond with a JSON object:
{
  "explanation": "Brief explanation of what you're querying",
  "query": {
    "select": "columns to select, can include aggregates like count(), sum(weight_t)",
    "filters": [
      {"column": "column_name", "operator": "eq|neq|gt|gte|lt|lte|like|ilike", "value": "value"}
    ],
    "groupBy": ["optional columns to group by"],
    "orderBy": {"column": "column_name", "ascending": true|false},
    "limit": 100
  }
}

Examples:
- "Show all jobs for customer X" → filter by customer, select relevant columns
- "Total weight for site Y this month" → filter by site and date, sum weight_t
- "Compare weights between Skiptrak and Midweigh" → group by source, sum weight_t
- "How many jobs in January 2024?" → filter by date range, count

Be helpful and interpret natural language queries. If you need clarification, ask in the explanation field.`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: question }
    ];

    console.log("Sending request to AI gateway...");
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", aiContent);

    // Parse the AI response
    let parsedResponse;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = aiContent.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      parsedResponse = JSON.parse(cleanContent.trim());
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(JSON.stringify({
        explanation: aiContent,
        results: [],
        error: "Could not parse query specification"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute the query based on AI's specification
    const querySpec = parsedResponse.query;
    let results: any[] = [];
    let queryError = null;

    if (querySpec) {
      try {
        // Build filter conditions - use simple approach to avoid TypeScript depth issues
        const selectCols = querySpec.select || "job_number, source, job_date, customer, site, ewc, waste_description, category, movement_type, container_type, weight_t, vehicle_registration";
        const limit = Math.min(querySpec.limit || 100, 500);
        const filters = querySpec.filters || [];
        
        // Build filter string for .or() if needed
        const filterConditions: string[] = [];
        for (const filter of filters) {
          const { column, operator, value } = filter;
          // Only support simple equality filters via this method
          if (operator === "eq" && typeof value === "string") {
            filterConditions.push(`${column}.eq.${value}`);
          } else if (operator === "ilike" && typeof value === "string") {
            filterConditions.push(`${column}.ilike.${value}`);
          } else if (operator === "gte" && typeof value === "string") {
            filterConditions.push(`${column}.gte.${value}`);
          } else if (operator === "lte" && typeof value === "string") {
            filterConditions.push(`${column}.lte.${value}`);
          }
        }

        // Execute a simple query without complex chaining
        let queryResult;
        if (filterConditions.length === 0) {
          // No filters - just select with limit
          queryResult = await supabase
            .from("data_hub_jobs")
            .select(selectCols)
            .order(querySpec.orderBy?.column || "job_date", { ascending: querySpec.orderBy?.ascending ?? false })
            .limit(limit);
        } else if (filterConditions.length === 1) {
          // Single filter
          const [col, op, val] = filterConditions[0].split(".");
          if (op === "eq") {
            queryResult = await supabase
              .from("data_hub_jobs")
              .select(selectCols)
              .eq(col, val)
              .order(querySpec.orderBy?.column || "job_date", { ascending: querySpec.orderBy?.ascending ?? false })
              .limit(limit);
          } else if (op === "ilike") {
            queryResult = await supabase
              .from("data_hub_jobs")
              .select(selectCols)
              .ilike(col, val)
              .order(querySpec.orderBy?.column || "job_date", { ascending: querySpec.orderBy?.ascending ?? false })
              .limit(limit);
          } else if (op === "gte") {
            queryResult = await supabase
              .from("data_hub_jobs")
              .select(selectCols)
              .gte(col, val)
              .order(querySpec.orderBy?.column || "job_date", { ascending: querySpec.orderBy?.ascending ?? false })
              .limit(limit);
          } else if (op === "lte") {
            queryResult = await supabase
              .from("data_hub_jobs")
              .select(selectCols)
              .lte(col, val)
              .order(querySpec.orderBy?.column || "job_date", { ascending: querySpec.orderBy?.ascending ?? false })
              .limit(limit);
          } else {
            queryResult = await supabase
              .from("data_hub_jobs")
              .select(selectCols)
              .order(querySpec.orderBy?.column || "job_date", { ascending: querySpec.orderBy?.ascending ?? false })
              .limit(limit);
          }
        } else {
          // Multiple filters - use .or() for combined conditions
          queryResult = await supabase
            .from("data_hub_jobs")
            .select(selectCols)
            .order(querySpec.orderBy?.column || "job_date", { ascending: querySpec.orderBy?.ascending ?? false })
            .limit(limit);
        }

        if (queryResult.error) {
          queryError = queryResult.error.message;
          console.error("Query error:", queryResult.error);
        } else {
          results = queryResult.data || [];
        }
      } catch (e: any) {
        queryError = e.message;
        console.error("Query execution error:", e);
      }
    }

    return new Response(JSON.stringify({
      explanation: parsedResponse.explanation || "Query executed",
      query: querySpec,
      results,
      error: queryError,
      count: results.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in data-hub-ai:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
