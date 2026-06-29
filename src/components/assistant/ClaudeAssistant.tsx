import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bot, Send, RotateCcw, User, AlertCircle, Info, Check, X, Zap, Loader2 } from "lucide-react";

type PendingAction = { id: string; tool: string; input: unknown; description: string };
type ActionState = "pending" | "running" | "done" | "cancelled";
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  pendingActions?: PendingAction[];
  actionState?: ActionState;
};

const TypingDots = () => (
  <div className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);

export function ClaudeAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  // Strip UI-only fields before sending history to the backend.
  const toHistory = (msgs: ChatMessage[]) => msgs.map((m) => ({ role: m.role, content: m.content }));

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const history = [...messages, userMessage];

    setMessages(history);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("chat-agent", {
        body: { messages: toHistory(history) },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.reply) throw new Error("The assistant did not return a reply.");

      const pending: PendingAction[] | undefined =
        Array.isArray(data.pendingActions) && data.pendingActions.length > 0 ? data.pendingActions : undefined;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          pendingActions: pending,
          actionState: pending ? "pending" : undefined,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach the assistant.");
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const confirmActions = useCallback(
    async (msgIndex: number) => {
      const msg = messages[msgIndex];
      if (!msg?.pendingActions || msg.actionState !== "pending" || isLoading) return;

      setError(null);
      setIsLoading(true);
      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionState: "running" } : m)));

      try {
        const { data, error: fnError } = await supabase.functions.invoke("chat-agent", {
          body: {
            confirmedActions: msg.pendingActions.map((a) => ({
              tool: a.tool,
              input: a.input,
              description: a.description,
            })),
          },
        });

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);

        setMessages((prev) => [
          ...prev.map((m, i) => (i === msgIndex ? { ...m, actionState: "done" as ActionState } : m)),
          { role: "assistant", content: data?.reply || "Done." },
        ]);
      } catch (err) {
        setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionState: "pending" } : m)));
        setError(err instanceof Error ? err.message : "Failed to run the action.");
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading],
  );

  const cancelActions = useCallback((msgIndex: number) => {
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionState: "cancelled" } : m)));
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const newConversation = () => {
    setMessages([]);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">Powered by Claude — answers questions, drafts, and runs tasks with your approval.</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={newConversation}>
            <RotateCcw className="h-3.5 w-3.5" /> New conversation
          </Button>
        )}
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="mx-auto w-full max-w-screen-md flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Bot className="mb-3 h-10 w-10 opacity-40" />
            <p className="max-w-sm text-sm">
              Ask about jobs, weights, rentals, stock, pricing, customers or CRM — I read your live data to answer. I
              can also draft emails and <strong>do tasks for you</strong> (update records, close tickets, edit pricing,
              mark rentals collected, send emails) — you approve each change before it runs.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`flex max-w-[80%] flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
              </div>

              {/* Confirmation card for proposed actions */}
              {m.pendingActions && m.pendingActions.length > 0 && (
                <div className="w-full rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-700/50 dark:bg-amber-950/30">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Zap className="h-3.5 w-3.5" />
                    {m.actionState === "done"
                      ? "Action(s) completed"
                      : m.actionState === "cancelled"
                        ? "Action(s) cancelled"
                        : "Confirm before running"}
                  </div>
                  <ul className="mb-3 space-y-1 text-sm">
                    {m.pendingActions.map((a) => (
                      <li key={a.id} className="flex items-start gap-1.5">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                        <span>{a.description}</span>
                      </li>
                    ))}
                  </ul>
                  {m.actionState === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5" onClick={() => confirmActions(i)} disabled={isLoading}>
                        <Check className="h-3.5 w-3.5" /> Confirm & run
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => cancelActions(i)} disabled={isLoading}>
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    </div>
                  )}
                  {m.actionState === "running" && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl bg-muted px-4 py-2.5">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mx-auto w-full max-w-screen-md px-4 pb-4">
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-end gap-2 border-t border-border pt-3">
          <Textarea
            ref={inputRef}
            placeholder="Message the AI Assistant…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="min-h-[44px] max-h-[160px] resize-none"
            rows={1}
          />
          <Button onClick={send} disabled={!input.trim() || isLoading} size="icon" className="h-11 w-11 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3 w-3 flex-shrink-0" />
          I never change data or send email without your confirmation.
        </p>
      </div>
    </div>
  );
}

export default ClaudeAssistant;
