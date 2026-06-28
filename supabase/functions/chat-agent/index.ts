import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM_PROMPT = `You are an expert internal assistant for a professional services business. Your job is to help staff work faster and smarter.

You can help with:
- Drafting client emails, proposals, and reports
- Summarising documents or meeting notes
- Answering questions about processes, policies, or best practices
- Researching topics and providing structured summaries
- Generating checklists, agendas, or action plans
- Brainstorming ideas and solving problems

Guidelines:
- Be concise and direct. Staff are busy — get to the point.
- Use bullet points and clear formatting where it aids readability.
- If a task is ambiguous, ask one clarifying question before proceeding.
- Never make up facts. If you don't know something, say so clearly.
- Maintain a professional but friendly tone.
- When drafting documents, always offer to refine or adjust the output.`;

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;

type ChatMessage = { role: "user" | "assistant"; content: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        { error: "The Anthropic API key is not configured. An administrator needs to add it before the assistant can be used." },
        500,
      );
    }

    let body: { messages?: unknown; context?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    const rawMessages = body?.messages;
    const context = typeof body?.context === "string" ? body.context : "";

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return jsonResponse({ error: "A non-empty 'messages' array is required." }, 400);
    }

    // Validate + normalise the conversation history.
    const messages: ChatMessage[] = [];
    for (const m of rawMessages) {
      if (
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== ""
      ) {
        messages.push({ role: m.role, content: m.content });
      }
    }

    if (messages.length === 0) {
      return jsonResponse({ error: "No valid messages were provided." }, 400);
    }

    const system = context ? `${SYSTEM_PROMPT}\n\nAdditional context:\n${context}` : SYSTEM_PROMPT;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error", anthropicRes.status, errText);
      let detail = errText;
      try {
        detail = JSON.parse(errText)?.error?.message ?? errText;
      } catch {
        // keep raw text
      }
      const status = anthropicRes.status === 429 ? 429 : anthropicRes.status >= 500 ? 502 : 400;
      return jsonResponse({ error: `Anthropic API error: ${detail}` }, status);
    }

    const data = await anthropicRes.json();
    const reply = Array.isArray(data?.content)
      ? data.content
          .filter((part: { type?: string }) => part?.type === "text")
          .map((part: { text?: string }) => part?.text ?? "")
          .join("")
          .trim()
      : "";

    if (!reply) {
      return jsonResponse({ error: "The assistant returned an empty response." }, 502);
    }

    return jsonResponse({ reply });
  } catch (err) {
    console.error("chat-agent unexpected error", err);
    return jsonResponse({ error: "Something went wrong while contacting the assistant." }, 500);
  }
});
