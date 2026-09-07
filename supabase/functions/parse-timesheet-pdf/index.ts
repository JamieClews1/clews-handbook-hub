import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM_PROMPT = `You extract weekly clocking / hours data from a UK "InTime" Clockings and Hours Report for a waste company.

The report contains one block per employee. Each block has:
- the employee's full name, "Employee No:" and optionally "Payroll No:"
- "Week Setup:" or "Rotating Shift:" text
- a 7 day grid (Saturday -> Friday) with rows: Rounded Clockings, Booked abs, Anomalies, Paid breaks, Adjustment, Hours, Rates
- "Rates totals:" letters with hh:mm values (e.g. A 32:00 B 07:00)
- "For period:" totals (Total hours, Basic time, Paid hours, Non-Basic Time)

Rules:
- Convert every hh:mm value to decimal hours (08:39 -> 8.65), rounded to 2 decimals.
- normal_hours = the "A" rate total (basic time). higher_rate_hours = the sum of ALL other rate letters (B, E, F, H, ...).
- saturday_hours = the Hours value recorded in the Saturday column.
- holiday_hours = total hours of "HOL" entries in Booked abs; holiday_days = number of days with a HOL entry.
- Ignore "ABS", "BH", "FORG", "EARLY" when computing holiday.
- If a value is missing use 0. Never invent employees.
Return every employee found in the document.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const base64: string = String(body?.pdfBase64 ?? "");
    if (!base64) return json({ error: "pdfBase64 is required" }, 400);

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
    const doc = await getDocumentProxy(bytes);
    const { text } = await extractText(doc, { mergePages: true });
    const raw = Array.isArray(text) ? text.join("\n") : String(text ?? "");
    if (!raw.trim()) return json({ error: "Could not read any text from that PDF" }, 400);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: raw.slice(0, 180000) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_timesheet",
              description: "Return the parsed weekly clocking data",
              parameters: {
                type: "object",
                properties: {
                  week_start: { type: "string", description: "Reference date / first day (YYYY-MM-DD)" },
                  week_end: { type: "string", description: "Last day of the week (YYYY-MM-DD)" },
                  employees: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        employee_name: { type: "string" },
                        employee_no: { type: "number" },
                        payroll_no: { type: "string" },
                        week_setup: { type: "string" },
                        normal_hours: { type: "number" },
                        higher_rate_hours: { type: "number" },
                        saturday_hours: { type: "number" },
                        holiday_hours: { type: "number" },
                        holiday_days: { type: "number" },
                        total_hours: { type: "number" },
                        paid_hours: { type: "number" },
                        rate_totals: {
                          type: "object",
                          additionalProperties: { type: "number" },
                          description: "Rate letter -> decimal hours",
                        },
                        days: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              date: { type: "string" },
                              weekday: { type: "string" },
                              clockings: { type: "string" },
                              booked_absence: { type: "string" },
                              anomalies: { type: "string" },
                              hours: { type: "number" },
                            },
                            required: ["date", "hours"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["employee_name", "normal_hours", "higher_rate_hours", "total_hours"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["week_start", "week_end", "employees"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_timesheet" } },
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error("AI gateway error", res.status, details);
      if (res.status === 429) return json({ error: "AI rate limit reached, please try again shortly." }, 429);
      if (res.status === 402) return json({ error: "AI credits exhausted. Please top up in Settings." }, 402);
      return json({ error: "Failed to read the timesheet", details }, 502);
    }

    const data = await res.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json({ error: "The timesheet could not be interpreted" }, 422);

    const parsed = JSON.parse(call.function.arguments || "{}");
    return json({ ...parsed, page_count: doc.numPages ?? null });
  } catch (err) {
    console.error("parse-timesheet-pdf error", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
