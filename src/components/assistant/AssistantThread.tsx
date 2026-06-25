import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Loader2, Paperclip, CheckCircle, AlertCircle, Table as TableIcon } from "lucide-react";
import type { AssistantMessage } from "@/hooks/usePortalAssistant";

interface Props {
  messages: AssistantMessage[];
  isLoading: boolean;
  onConfirm: (id: string, action: any) => void;
  onCancel: (id: string) => void;
  compact?: boolean;
  emptyHint?: string;
}

function ResultsPreview({ rows, compact }: { rows: any[]; compact?: boolean }) {
  if (!rows || rows.length === 0) return null;
  const columns = Object.keys(rows[0]).slice(0, compact ? 4 : 8);
  const shown = rows.slice(0, compact ? 5 : 25);
  return (
    <div className="mt-2 border border-border/60 rounded-lg overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 text-xs text-muted-foreground">
        <TableIcon className="h-3 w-3" /> {rows.length} result{rows.length === 1 ? "" : "s"}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60">
              {columns.map((c) => (
                <th key={c} className="text-left px-2 py-1 font-medium whitespace-nowrap">{c.replace(/_/g, " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0">
                {columns.map((c) => (
                  <td key={c} className="px-2 py-1 whitespace-nowrap">{row[c] != null ? String(row[c]) : "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <div className="px-2 py-1 text-[11px] text-muted-foreground">Showing {shown.length} of {rows.length}</div>
      )}
    </div>
  );
}

export function AssistantThread({ messages, isLoading, onConfirm, onCancel, compact, emptyHint }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <ScrollArea className="flex-1 px-4 py-3">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-medium text-sm mb-1">How can I help?</h4>
          <p className="text-xs text-muted-foreground max-w-[320px]">
            {emptyHint || "Ask me to look up jobs, weights, rentals, stock, pricing or customers — or to make changes like updating load reports."}
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
              <div className={`${compact ? "max-w-[85%]" : "max-w-[90%]"} rounded-xl px-3 py-2 text-sm ${
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {msg.attachment && (
                  <div className="text-xs opacity-80 mb-1 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {msg.attachment.name} ({msg.attachment.data.length} rows)
                  </div>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert [&>p]:mb-1 [&>p:last-child]:mb-0 [&>pre]:hidden [&_code]:text-xs [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:mb-0.5">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {msg.results && <ResultsPreview rows={msg.results} compact={compact} />}

                {msg.actionPending && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs font-medium mb-2">
                      {msg.actionPending.description || "Confirm this action?"}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => onConfirm(msg.id, msg.actionPending)} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCancel(msg.id)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {msg.actionResult && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                    {(msg.actionResult.created ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Created {msg.actionResult.created} record(s)
                      </div>
                    )}
                    {(msg.actionResult.updated ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Updated {msg.actionResult.updated} record(s)
                      </div>
                    )}
                    {(msg.actionResult.deleted ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Deleted {msg.actionResult.deleted} record(s)
                      </div>
                    )}
                    {msg.actionResult.errors?.map((err, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" /> {err}
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
          <div ref={endRef} />
        </div>
      )}
    </ScrollArea>
  );
}
