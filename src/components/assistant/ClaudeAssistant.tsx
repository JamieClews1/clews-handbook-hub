import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Bot, Send, User, AlertCircle, Info, Check, X, Zap, Loader2, Square, RefreshCw, Copy, Star,
  BookMarked, PanelLeft, Trash2,
} from "lucide-react";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { ConversationList, type Conversation } from "./ConversationList";

type PendingAction = { id: string; tool: string; input: unknown; description: string };
type ActionState = "pending" | "running" | "done" | "cancelled";
type ChatMessage = {
  id?: string; // database row id once saved
  role: "user" | "assistant";
  content: string;
  pendingActions?: PendingAction[];
  actionState?: ActionState;
};
type SavedPrompt = { id: string; user_id: string; name: string; prompt: string; is_shared: boolean };

const SUGGESTIONS = [
  "CEO daily brief",
  "Contaminations without charges",
  "Unassigned CRM tickets",
  "Rentals with no rate",
  "Top 10 customers by tonnage this month",
  "Today's jobs",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-agent`;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again to use the assistant.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

const toHistory = (msgs: ChatMessage[]) => msgs.map((m) => ({ role: m.role, content: m.content }));

export function ClaudeAssistant() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [saveDraft, setSaveDraft] = useState<{ prompt: string; name: string; shared: boolean } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeConvRef = useRef<string | undefined>(conversationId);
  const skipLoadRef = useRef<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, step]);

  useEffect(() => { if (!isLoading) inputRef.current?.focus(); }, [isLoading, conversationId]);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from("assistant_conversations")
      .select("id, title, pinned, updated_at")
      .order("updated_at", { ascending: false })
      .limit(300);
    setConversations((data || []) as Conversation[]);
  }, []);

  const loadPrompts = useCallback(async () => {
    const { data } = await supabase
      .from("assistant_saved_prompts")
      .select("id, user_id, name, prompt, is_shared")
      .order("name");
    setPrompts((data || []) as SavedPrompt[]);
  }, []);

  useEffect(() => { if (user) { loadConversations(); loadPrompts(); } }, [user, loadConversations, loadPrompts]);

  // Load a conversation's messages when the URL changes.
  useEffect(() => {
    activeConvRef.current = conversationId;
    setError(null);
    if (!conversationId) { setMessages([]); return; }
    if (skipLoadRef.current === conversationId) { skipLoadRef.current = null; return; }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("assistant_messages")
        .select("id, role, content, tool_calls")
        .eq("conversation_id", conversationId)
        .order("created_at");
      if (cancelled) return;
      if (err) { setError("Couldn't load this conversation."); return; }
      setMessages((data || []).map((r: any) => ({
        id: r.id, role: r.role, content: r.content,
        pendingActions: r.tool_calls?.pendingActions,
        actionState: r.tool_calls?.actionState === "running" ? "pending" : r.tool_calls?.actionState,
      })));
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  const saveMessage = useCallback(async (convId: string, m: ChatMessage): Promise<string | undefined> => {
    if (!user) return;
    const { data, error: err } = await supabase.from("assistant_messages").insert({
      conversation_id: convId, user_id: user.id, role: m.role, content: m.content,
      tool_calls: m.pendingActions ? { pendingActions: m.pendingActions, actionState: m.actionState } : null,
    }).select("id").single();
    if (err) { console.error(err); toast({ title: "Couldn't save message to history", variant: "destructive" }); return; }
    await supabase.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    return data?.id;
  }, [user, toast]);

  const ensureConversation = useCallback(async (firstText: string): Promise<string | undefined> => {
    if (conversationId) return conversationId;
    if (!user) return;
    const title = firstText.length > 60 ? `${firstText.slice(0, 57)}…` : firstText;
    const { data, error: err } = await supabase
      .from("assistant_conversations").insert({ user_id: user.id, title }).select("id").single();
    if (err || !data) { toast({ title: "Couldn't start a saved conversation", variant: "destructive" }); return; }
    skipLoadRef.current = data.id;
    activeConvRef.current = data.id;
    navigate(`/ai-assistant/${data.id}`, { replace: true });
    loadConversations();
    return data.id;
  }, [conversationId, user, navigate, loadConversations, toast]);

  // Calls the assistant and reads live progress steps until it finishes.
  const callAssistant = useCallback(async (body: unknown, signal: AbortSignal) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST", headers: await authHeaders(), body: JSON.stringify(body), signal,
    });
    const ctype = resp.headers.get("content-type") || "";
    if (!ctype.includes("text/event-stream")) {
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) throw new Error(data?.error || `The assistant failed (${resp.status}).`);
      return data;
    }
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: any = null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event = "message"; let dataStr = "";
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event: ")) event = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (!dataStr) continue;
        const data = JSON.parse(dataStr);
        if (event === "step") setStep(`${data.label}…`);
        else if (event === "done") result = data;
        else if (event === "error") throw new Error(data?.error || "The assistant failed.");
      }
    }
    if (!result?.reply) throw new Error("The assistant returned an empty response.");
    return result;
  }, []);

  const send = useCallback(async (override?: string, retry = false) => {
    const text = (override ?? input).trim();
    if (!text || isLoading) return;

    const base = retry ? messages : [...messages, { role: "user" as const, content: text }];
    setMessages(base);
    setInput("");
    setError(null);
    setLastPrompt(text);
    setIsLoading(true);
    setStep("Thinking…");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const convId = await ensureConversation(text);
      if (convId && !retry) await saveMessage(convId, { role: "user", content: text });

      const data = await callAssistant({ messages: toHistory(base), stream: true }, controller.signal);
      const pending: PendingAction[] | undefined =
        Array.isArray(data.pendingActions) && data.pendingActions.length > 0 ? data.pendingActions : undefined;
      const reply: ChatMessage = { role: "assistant", content: data.reply, pendingActions: pending, actionState: pending ? "pending" : undefined };
      const id = convId ? await saveMessage(convId, reply) : undefined;
      if (activeConvRef.current === convId) setMessages((prev) => [...prev, { ...reply, id }]);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") setError("Stopped. You can retry or ask something else.");
      else setError(err instanceof Error ? err.message : "Failed to reach the assistant.");
    } finally {
      abortRef.current = null;
      setIsLoading(false);
      setStep(null);
    }
  }, [input, isLoading, messages, ensureConversation, saveMessage, callAssistant]);

  const stop = () => abortRef.current?.abort();

  const persistActionState = async (m: ChatMessage, state: ActionState) => {
    if (!m.id) return;
    await supabase.from("assistant_messages")
      .update({ tool_calls: { pendingActions: m.pendingActions, actionState: state } }).eq("id", m.id);
  };

  const confirmActions = useCallback(async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg?.pendingActions || msg.actionState !== "pending" || isLoading) return;
    setError(null);
    setIsLoading(true);
    setStep("Running the approved changes…");
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionState: "running" } : m)));
    try {
      const controller = new AbortController();
      const data = await callAssistant({
        confirmedActions: msg.pendingActions.map((a) => ({ tool: a.tool, input: a.input, description: a.description })),
      }, controller.signal);
      await persistActionState(msg, "done");
      const reply: ChatMessage = { role: "assistant", content: data?.reply || "Done." };
      const id = conversationId ? await saveMessage(conversationId, reply) : undefined;
      setMessages((prev) => [
        ...prev.map((m, i) => (i === msgIndex ? { ...m, actionState: "done" as ActionState } : m)),
        { ...reply, id },
      ]);
    } catch (err) {
      setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionState: "pending" } : m)));
      setError(err instanceof Error ? err.message : "Failed to run the action.");
    } finally {
      setIsLoading(false);
      setStep(null);
    }
  }, [messages, isLoading, callAssistant, conversationId, saveMessage]);

  const cancelActions = useCallback((msgIndex: number) => {
    const msg = messages[msgIndex];
    if (msg) persistActionState(msg, "cancelled");
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionState: "cancelled" } : m)));
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const newConversation = () => { if (!isLoading) navigate("/ai-assistant"); };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  };

  const savePrompt = async () => {
    if (!saveDraft || !user || !saveDraft.name.trim()) return;
    const { error: err } = await supabase.from("assistant_saved_prompts").insert({
      user_id: user.id, name: saveDraft.name.trim(), prompt: saveDraft.prompt, is_shared: isAdmin && saveDraft.shared,
    });
    if (err) { toast({ title: "Couldn't save prompt", description: err.message, variant: "destructive" }); return; }
    toast({ title: "Prompt saved" });
    setSaveDraft(null);
    loadPrompts();
  };

  const deletePrompt = async (id: string) => {
    await supabase.from("assistant_saved_prompts").delete().eq("id", id);
    loadPrompts();
  };

  const runPrompt = (p: string) => {
    setPromptsOpen(false);
    if (isLoading) return;
    if (conversationId) { navigate("/ai-assistant"); setTimeout(() => setInput(p), 0); }
    else send(p);
  };

  const myPrompts = prompts.filter((p) => p.user_id === user?.id && !p.is_shared);
  const teamPrompts = prompts.filter((p) => p.is_shared);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {showList && (
        <aside className="hidden w-64 flex-shrink-0 border-r border-border bg-card md:block">
          <ConversationList
            conversations={conversations}
            activeId={conversationId}
            onSelect={(id) => !isLoading && navigate(`/ai-assistant/${id}`)}
            onNew={newConversation}
            onRename={async (id, title) => {
              await supabase.from("assistant_conversations").update({ title }).eq("id", id);
              loadConversations();
            }}
            onTogglePin={async (c) => {
              await supabase.from("assistant_conversations").update({ pinned: !c.pinned }).eq("id", c.id);
              loadConversations();
            }}
            onDelete={async (id) => {
              await supabase.from("assistant_conversations").delete().eq("id", id);
              if (id === conversationId) navigate("/ai-assistant");
              loadConversations();
            }}
          />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="hidden h-8 w-8 md:inline-flex" onClick={() => setShowList((v) => !v)} aria-label="Toggle conversation list">
              <PanelLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold">AI Assistant</h1>
              <p className="text-xs text-muted-foreground">Answers from your live data. Changes only run after you confirm.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPromptsOpen(true)}>
              <BookMarked className="h-3.5 w-3.5" /> Prompts
            </Button>
            <Button variant="outline" size="sm" className="md:hidden" onClick={newConversation}>New</Button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-screen-md space-y-6 px-4 py-6">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center pt-12 text-center">
                <Bot className="mb-3 h-10 w-10 text-primary/50" />
                <p className="max-w-md text-sm text-muted-foreground">
                  Ask about jobs, weights, rentals, stock, pricing, customers or CRM. I can also draft emails and
                  prepare changes for you to approve.
                </p>
                <div className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => send(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={m.id || i} className={`group flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`flex min-w-0 max-w-[85%] flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  {m.role === "assistant" ? (
                    <div className="w-full text-sm text-foreground"><AssistantMarkdown>{m.content}</AssistantMarkdown></div>
                  ) : (
                    <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                  )}

                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Copy" onClick={() => copy(m.content)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    {m.role === "user" && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Save as prompt"
                        onClick={() => setSaveDraft({ prompt: m.content, name: m.content.slice(0, 40), shared: false })}>
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {m.pendingActions && m.pendingActions.length > 0 && (
                    <div className="w-full rounded-xl border border-border bg-muted/40 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        {m.actionState === "done" ? "Action(s) completed" : m.actionState === "cancelled" ? "Action(s) cancelled" : "Confirm before running"}
                      </div>
                      <ul className="mb-3 space-y-1 text-sm">
                        {m.pendingActions.map((a) => (
                          <li key={a.id} className="flex items-start gap-1.5">
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
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
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {step || "Thinking…"}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-screen-md px-4 pb-4">
          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{error}</span>
                {lastPrompt && (
                  <Button size="sm" variant="outline" className="h-7 flex-shrink-0 gap-1.5" onClick={() => {
                    const lastIsUser = messages[messages.length - 1]?.role === "user";
                    send(lastPrompt, lastIsUser);
                  }}>
                    <RefreshCw className="h-3 w-3" /> Retry
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-end gap-2 border-t border-border pt-3">
            <Textarea
              ref={inputRef}
              placeholder={isLoading ? "Wait for the current answer, or press Stop…" : "Message the AI Assistant…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="min-h-[44px] max-h-[160px] resize-none"
              rows={1}
            />
            {isLoading && abortRef.current ? (
              <Button onClick={stop} variant="outline" size="icon" className="h-11 w-11 flex-shrink-0" aria-label="Stop">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => send()} disabled={!input.trim() || isLoading} size="icon" className="h-11 w-11 flex-shrink-0" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3 w-3 flex-shrink-0" />
            I never change data or send email without your confirmation.
          </p>
        </div>
      </div>

      <Sheet open={promptsOpen} onOpenChange={setPromptsOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Saved prompts</SheetTitle></SheetHeader>
          <Tabs defaultValue="mine" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mine">My prompts</TabsTrigger>
              <TabsTrigger value="team">Team prompts</TabsTrigger>
            </TabsList>
            {[{ v: "mine", list: myPrompts, empty: "Hover over any question you asked and press the star to save it here." },
              { v: "team", list: teamPrompts, empty: "Admins can share prompts with the whole team." }].map(({ v, list, empty }) => (
              <TabsContent key={v} value={v} className="space-y-2">
                {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>}
                {list.map((p) => (
                  <div key={p.id} className="group flex items-start gap-2 rounded-md border border-border p-2.5">
                    <button className="min-w-0 flex-1 text-left" onClick={() => runPrompt(p.prompt)}>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{p.prompt}</p>
                    </button>
                    {(p.user_id === user?.id || isAdmin) && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deletePrompt(p.id)} aria-label="Delete prompt">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </SheetContent>
      </Sheet>

      <Dialog open={!!saveDraft} onOpenChange={(o) => !o && setSaveDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save prompt</DialogTitle></DialogHeader>
          {saveDraft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="prompt-name">Name</Label>
                <Input id="prompt-name" value={saveDraft.name} onChange={(e) => setSaveDraft({ ...saveDraft, name: e.target.value })} />
              </div>
              <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{saveDraft.prompt}</p>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Switch id="prompt-shared" checked={saveDraft.shared} onCheckedChange={(v) => setSaveDraft({ ...saveDraft, shared: v })} />
                  <Label htmlFor="prompt-shared">Share with the team</Label>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDraft(null)}>Cancel</Button>
            <Button onClick={savePrompt} disabled={!saveDraft?.name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ClaudeAssistant;
