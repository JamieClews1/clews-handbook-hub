import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, X, MessageCircle, Paperclip, Maximize2 } from "lucide-react";
import { usePortalAssistant } from "@/hooks/usePortalAssistant";
import { AssistantThread } from "@/components/assistant/AssistantThread";

export function PortalAssistantWidget() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<{ name: string; data: any[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, isLoading, handleSend, confirmAction, cancelAction } = usePortalAssistant();

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

  const send = () => {
    const q = input.trim();
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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
        aria-label="Open Ask One assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[620px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Ask One</h3>
            <p className="text-xs text-muted-foreground">Your portal AI assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Open full page">
            <Link to="/assistant"><Maximize2 className="h-4 w-4" /></Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AssistantThread
        messages={messages}
        isLoading={isLoading}
        onConfirm={confirmAction}
        onCancel={cancelAction}
        compact
      />

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

      <div className="flex items-end gap-2 px-4 py-3 border-t border-border">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileAttach} />
        <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          placeholder="Ask anything about your data…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="min-h-[40px] max-h-[120px] resize-none text-sm"
          rows={1}
        />
        <Button onClick={send} disabled={!input.trim() || isLoading} size="icon" className="h-9 w-9 flex-shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
