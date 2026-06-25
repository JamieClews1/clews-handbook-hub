import { useEffect, useState, useCallback } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Trash2, MessageCircle, Loader2 } from "lucide-react";
import type { AssistantQuestionLogEntry } from "@/hooks/usePortalAssistant";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadQuestionLog: () => Promise<AssistantQuestionLogEntry[]>;
  clearQuestionLog: () => Promise<boolean>;
  onPick?: (question: string) => void;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function AssistantQuestionLog({ open, onOpenChange, loadQuestionLog, clearQuestionLog, onPick }: Props) {
  const [entries, setEntries] = useState<AssistantQuestionLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await loadQuestionLog();
    setEntries(data);
    setLoading(false);
  }, [loadQuestionLog]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleClear = async () => {
    if (!window.confirm("Clear your entire Ask One question history? This can't be undone.")) return;
    const ok = await clearQuestionLog();
    if (ok) setEntries([]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Your question history
          </SheetTitle>
          <SheetDescription>
            Every question you've asked Ask One. Click one to ask it again.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-muted-foreground">
            {entries.length} question{entries.length === 1 ? "" : "s"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={handleClear}
            disabled={entries.length === 0 || loading}
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No questions logged yet.
            </div>
          ) : (
            <ul className="space-y-1.5 pb-4">
              {entries.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => { onPick?.(e.question); onOpenChange(false); }}
                    className="w-full text-left rounded-lg border border-border bg-card hover:bg-accent transition-colors px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <MessageCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm break-words">{e.question}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatWhen(e.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
