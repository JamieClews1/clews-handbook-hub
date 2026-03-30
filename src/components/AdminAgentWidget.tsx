import { useState, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Loader2, X, MessageCircle, Paperclip, CheckCircle, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment?: { name: string; data: any[] };
  actionPending?: any;
  actionResult?: { created: number; errors: string[] };
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-agent`;

export function AdminAgentWidget() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; data: any[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const parseExcelFile = useCallback((file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseExcelFile(file);
      setAttachedFile({ name: file.name, data });
      toast({ title: `Loaded ${data.length} rows from ${file.name}` });
    } catch {
      toast({ title: "Failed to read file", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const extractAction = (text: string): { cleanText: string; action: any } | null => {
    const actionMatch = text.match(/```action\s*([\s\S]*?)```/);
    if (!actionMatch) return null;
    try {
      const action = JSON.parse(actionMatch[1].trim());
      const cleanText = text.replace(/```action[\s\S]*?```/, "").trim();
      return { cleanText, action };
    } catch {
      return null;
    }
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    // Build user message content - include file data if attached
    let messageContent = question;
    if (attachedFile) {
      messageContent += `\n\nAttached file "${attachedFile.name}" with ${attachedFile.data.length} rows:\n\`\`\`json\n${JSON.stringify(attachedFile.data, null, 2)}\n\`\`\``;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      attachment: attachedFile || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    const fileData = attachedFile;
    setAttachedFile(null);
    setIsLoading(true);

    const allMessages = [...messages, { role: "user" as const, content: messageContent }];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      // Stream the response
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      const upsertAssistant = (text: string) => {
        assistantText = text;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.actionResult) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: text } : m));
          }
          return [...prev, { id: crypto.randomUUID(), role: "assistant", content: text }];
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

      // Check if the AI returned an action
      const actionResult = extractAction(assistantText);
      if (actionResult) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, content: actionResult.cleanText, actionPending: actionResult.action }
              : m
          )
        );
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: `Sorry, something went wrong: ${e.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (messageId: string, action: any) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Look up site_id if a site name was mentioned
      let siteId: string | null = null;
      if (action.site_name) {
        const { data: sites } = await supabase
          .from("customer_sites")
          .select("id, site_name")
          .ilike("site_name", `%${action.site_name}%`)
          .limit(1);
        if (sites && sites.length > 0) siteId = sites[0].id;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: action.action,
          actionData: {
            reports: action.reports,
            site_id: siteId,
            operator_id: session.user.id,
            operator_name: profile?.full_name || "Admin Agent",
          },
        }),
      });

      const result = await resp.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, actionPending: undefined, actionResult: result }
            : m
        )
      );

      if (result.created > 0) {
        toast({ title: `Created ${result.created} load reports successfully` });
      }
      if (result.errors?.length > 0) {
        toast({ title: `${result.errors.length} errors occurred`, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Admin Agent</h3>
            <p className="text-xs text-muted-foreground">AI-powered admin assistant</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h4 className="font-medium text-sm mb-1">How can I help?</h4>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Upload an Excel file and tell me what you need. I can create load reports, process data, and more.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {msg.attachment && (
                    <div className="text-xs opacity-80 mb-1 flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {msg.attachment.name} ({msg.attachment.data.length} rows)
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-1 [&>p:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Action confirmation */}
                  {msg.actionPending && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-xs font-medium mb-2">
                        Ready to create {msg.actionPending.reports?.length || 0} load reports?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleConfirmAction(msg.id, msg.actionPending)}
                          disabled={isLoading}
                        >
                          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            setMessages((prev) =>
                              prev.map((m) => (m.id === msg.id ? { ...m, actionPending: undefined } : m))
                            )
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action result */}
                  {msg.actionResult && (
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                      {msg.actionResult.created > 0 && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Created {msg.actionResult.created} load reports
                        </div>
                      )}
                      {msg.actionResult.errors?.map((err, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Attached file indicator */}
      {attachedFile && (
        <div className="px-4 py-1.5 border-t border-border bg-muted/30 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            {attachedFile.name} ({attachedFile.data.length} rows)
          </span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setAttachedFile(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 px-4 py-3 border-t border-border">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileAttach}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          placeholder="Ask me to do something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="min-h-[36px] max-h-[100px] resize-none text-sm"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          size="icon"
          className="h-9 w-9 flex-shrink-0"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
