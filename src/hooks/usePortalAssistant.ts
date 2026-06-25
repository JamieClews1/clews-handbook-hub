import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-assistant`;

// Actions that run automatically (reads) and feed results back to the model.
const AUTO_ACTIONS = new Set(["query_data", "query_reports", "rental_positions"]);

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment?: { name: string; data: any[] };
  actionPending?: any;
  actionResult?: { created?: number; updated?: number; deleted?: number; errors: string[] };
  results?: any[];
}

function cleanResponseText(text: string): string {
  let clean = text.replace(/```action[\s\S]*?```/g, "");
  clean = clean.replace(/```json[\s\S]*?```/g, "");
  clean = clean.replace(/```[\s\S]*?```/g, "");
  clean = clean.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, "");
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();
  return clean;
}

function extractAction(text: string): { cleanText: string; action: any } | null {
  const actionMatch = text.match(/```action\s*([\s\S]*?)```/);
  if (!actionMatch) return null;
  try {
    const action = JSON.parse(actionMatch[1].trim());
    return { cleanText: cleanResponseText(text), action };
  } catch {
    return null;
  }
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function usePortalAssistant() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => setMessages([]), []);

  // Stream a chat turn; returns the full raw assistant text (with action block).
  const streamTurn = useCallback(async (history: { role: string; content: string }[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${resp.status}`);
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";

    const upsertAssistant = (text: string) => {
      assistantText = text;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.actionResult && !last.actionPending) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanResponseText(text) } : m));
        }
        return [...prev, { id: crypto.randomUUID(), role: "assistant", content: cleanResponseText(text) }];
      });
    };

    let streamDone = false;
    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) upsertAssistant(assistantText + content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
    return assistantText;
  }, []);

  const runAction = useCallback(async (action: any) => {
    const { action: name, ...rest } = action;
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: name, actionData: rest }),
    });
    return await resp.json();
  }, []);

  const handleSend = useCallback(async (question: string, attachedFile?: { name: string; data: any[] } | null) => {
    if (!question.trim() || isLoading) return;
    cancelledRef.current = false;

    let messageContent = question;
    if (attachedFile) {
      messageContent += `\n\nAttached file "${attachedFile.name}" with ${attachedFile.data.length} rows:\n\`\`\`json\n${JSON.stringify(attachedFile.data, null, 2)}\n\`\`\``;
    }

    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(), role: "user", content: question, attachment: attachedFile || undefined,
    }]);
    setIsLoading(true);

    let history: { role: string; content: string }[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: messageContent },
    ];

    try {
      let depth = 0;
      while (depth < 8 && !cancelledRef.current) {
        depth++;
        const raw = await streamTurn(history);
        const extracted = extractAction(raw);
        if (!extracted) break;

        history = [...history, { role: "assistant", content: raw }];

        if (AUTO_ACTIONS.has(extracted.action.action)) {
          // Read action — run it, attach results to the message, feed back to model.
          const result = await runAction(extracted.action);
          const rows = result.rows || result.reports || [];
          setMessages((prev) => prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: extracted.cleanText, results: rows } : m
          ));
          history.push({
            role: "user",
            content: `[System: tool returned ${result.count ?? rows.length ?? 0} rows]\n${JSON.stringify(rows.slice(0, 100), null, 2)}\n\nUse this to answer the question in plain English. If a write is needed, propose it now with the real ids.`,
          });
          continue; // loop again so the model interprets the results
        }

        // Write action — needs user confirmation.
        setMessages((prev) => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: extracted.cleanText, actionPending: extracted.action } : m
        ));
        break;
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), role: "assistant", content: `Sorry, something went wrong: ${e.message}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, streamTurn, runAction, toast]);

  const confirmAction = useCallback(async (messageId: string, action: any) => {
    setIsLoading(true);
    try {
      let payload = { ...action };
      // For load report creation, resolve a site name to its id.
      if (action.action === "create_load_reports" && action.site_name) {
        const { data: sites } = await supabase
          .from("customer_sites")
          .select("id, site_name")
          .ilike("site_name", `%${action.site_name}%`)
          .limit(1);
        if (sites && sites.length > 0) payload.site_id = sites[0].id;
      }
      const result = await runAction(payload);

      setMessages((prev) => prev.map((m) =>
        m.id === messageId ? { ...m, actionPending: undefined, actionResult: result } : m
      ));

      const successCount = result.created || result.updated || result.deleted || 0;
      if (successCount > 0) toast({ title: `Done — ${successCount} record(s) updated.` });
      if (result.errors?.length > 0) toast({ title: `${result.errors.length} error(s) occurred`, variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [runAction, toast]);

  const cancelAction = useCallback((messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, actionPending: undefined } : m)));
  }, []);

  return { messages, isLoading, handleSend, confirmAction, cancelAction, reset };
}
