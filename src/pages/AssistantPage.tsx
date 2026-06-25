import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Paperclip, X, RotateCcw, History } from "lucide-react";
import { usePortalAssistant } from "@/hooks/usePortalAssistant";
import { AssistantThread } from "@/components/assistant/AssistantThread";
import { AssistantQuestionLog } from "@/components/assistant/AssistantQuestionLog";

const SUGGESTIONS = [
  "Total weight by customer this month",
  "Which skips are over-rental right now?",
  "Show last 10 load reports for Amazon",
  "What's our residential pricing for Zone 1?",
  "List open CRM tickets",
];

const AssistantPage = () => {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<{ name: string; data: any[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, isLoading, handleSend, confirmAction, cancelAction, reset } = usePortalAssistant();

  const parseExcelFile = useCallback((file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(firstSheet));
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

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    handleSend(q, attachedFile);
    setInput("");
    setAttachedFile(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Ask One</h1>
            <p className="text-sm text-muted-foreground">Read & interpret your data, or take admin actions — in plain English.</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> New chat
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col max-w-screen-lg w-full mx-auto min-h-0">
        <AssistantThread
          messages={messages}
          isLoading={isLoading}
          onConfirm={confirmAction}
          onCancel={cancelAction}
          emptyHint="Ask about jobs, weights, rentals, stock, pricing, customers or CRM — or ask me to update load reports and more. I read your live data and propose any changes for you to confirm."
        />

        {messages.length === 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => send(s)} disabled={isLoading}>
                {s}
              </Button>
            ))}
          </div>
        )}

        {attachedFile && (
          <div className="px-4 py-1.5 bg-muted/30 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Paperclip className="h-3 w-3" /> {attachedFile.name} ({attachedFile.data.length} rows)
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setAttachedFile(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2 px-4 py-4 border-t border-border">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileAttach} />
          <Button variant="ghost" size="icon" className="h-11 w-11 flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            placeholder="Ask anything about your data…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="min-h-[44px] max-h-[160px] resize-none"
            rows={1}
          />
          <Button onClick={() => send()} disabled={!input.trim() || isLoading} size="icon" className="h-11 w-11 flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssistantPage;
