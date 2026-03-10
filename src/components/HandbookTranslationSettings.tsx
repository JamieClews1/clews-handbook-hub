import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Languages, Play, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";

interface LogEntry {
  id: number;
  timestamp: Date;
  type: "info" | "progress" | "success" | "error" | "complete";
  message: string;
}

export const HandbookTranslationSettings = () => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const logIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLog = (type: LogEntry["type"], message: string) => {
    const entry: LogEntry = { id: logIdRef.current++, timestamp: new Date(), type, message };
    setLogs(prev => [...prev, entry]);
    // Auto-scroll
    setTimeout(() => {
      if (scrollRef.current) {
        const scrollEl = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    }, 50);
  };

  const startTranslation = async (mode: "all") => {
    setIsTranslating(true);
    setLogs([]);
    setProgress(null);
    addLog("info", "🚀 Starting DeepL translation...");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-handbook-section`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ mode }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        addLog("error", `HTTP Error ${response.status}: ${errorText}`);
        setIsTranslating(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        addLog("error", "No response stream available");
        setIsTranslating(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.total !== undefined && data.completed !== undefined) {
                setProgress({ completed: data.completed, total: data.total });
              }

              switch (currentEvent) {
                case "status":
                  addLog("info", data.message);
                  break;
                case "progress":
                  addLog(data.success ? "success" : "progress", data.message);
                  break;
                case "error":
                  addLog("error", data.message);
                  break;
                case "complete":
                  addLog("complete", data.message);
                  break;
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      addLog("error", `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      case "progress": return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
      case "complete": return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
      default: return <Languages className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            DeepL Translation Settings
          </CardTitle>
          <CardDescription>
            Translate all handbook content to Polish, Ukrainian, and Romanian using DeepL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => startTranslation("all")}
              disabled={isTranslating}
              size="lg"
              className="gap-2"
            >
              {isTranslating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isTranslating ? "Translating..." : "Translate All Content"}
            </Button>

            <div className="flex gap-2">
              <Badge variant="outline">🇵🇱 Polish</Badge>
              <Badge variant="outline">🇺🇦 Ukrainian</Badge>
              <Badge variant="outline">🇷🇴 Romanian</Badge>
            </div>
          </div>

          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progress</span>
                <span>{progress.completed} / {progress.total}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Translation Log</span>
            {logs.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setLogs([]); setProgress(null); }}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={scrollRef}>
            <ScrollArea className="h-[400px] rounded-md border bg-muted/30 p-4">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No translation activity yet. Click "Translate All Content" to begin.
                </p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-sm">
                      {getLogIcon(log.type)}
                      <span className="text-muted-foreground text-xs whitespace-nowrap">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                      <span className={log.type === "error" ? "text-destructive" : log.type === "complete" ? "text-green-600 font-medium" : "text-foreground"}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
