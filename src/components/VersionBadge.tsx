import { useState } from "react";
import packageJson from "../../package.json";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw, Info } from "lucide-react";

type Verdict = "match" | "mismatch" | "dev-preview" | "unknown";
type Status = "idle" | "checking" | "done" | "error";

export const VersionBadge = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [verdict, setVerdict] = useState<Verdict>("unknown");
  const [detail, setDetail] = useState<string>("");

  const check = async () => {
    setStatus("checking");
    setDetail("");
    try {
      const { data, error } = await supabase.functions.invoke("check-live-sync", {
        body: { previewOrigin: window.location.origin },
      });
      if (error) throw error;
      const v = (data?.verdict ?? "unknown") as Verdict;
      setVerdict(v);
      setStatus("done");
      const preview = data?.preview?.script ?? "(none)";
      const live = (data?.live ?? []).map((r: any) => `${new URL(r.url).host}: ${r.script ?? "?"}`).join("\n");
      setDetail(`preview (${new URL(window.location.origin).host}): ${preview}\n${live}`);
    } catch (e: any) {
      setStatus("error");
      setDetail(e?.message ?? String(e));
    }
  };

  const view = (() => {
    if (status === "idle") return { icon: <RefreshCw className="h-3 w-3" />, label: "Check live sync", tone: "" };
    if (status === "checking") return { icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Checking…", tone: "" };
    if (status === "error") return { icon: <AlertTriangle className="h-3 w-3 text-destructive" />, label: "Check failed", tone: "text-destructive" };
    if (verdict === "match") return { icon: <CheckCircle2 className="h-3 w-3 text-success" />, label: "In sync with live", tone: "text-success" };
    if (verdict === "mismatch") return { icon: <AlertTriangle className="h-3 w-3 text-warning" />, label: "Preview differs from live", tone: "text-warning" };
    if (verdict === "dev-preview") return { icon: <Info className="h-3 w-3 text-muted-foreground" />, label: "Editor preview (unbuilt) — publish to compare", tone: "" };
    return { icon: <Info className="h-3 w-3" />, label: "Unknown", tone: "" };
  })();

  return (
    <div className="px-4 py-2 text-xs text-muted-foreground/60 border-t border-border/50 space-y-1">
      <div className="flex items-center justify-between">
        <span>v{packageJson.version}</span>
        <span className="text-[10px] opacity-50">
          {new Date().toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
        </span>
      </div>
      <Button
        onClick={check}
        variant="ghost"
        size="sm"
        className={`h-6 w-full justify-start gap-1.5 px-1 text-[11px] hover:text-foreground ${view.tone || "text-muted-foreground/70"}`}
        disabled={status === "checking"}
        title={detail || "Compare preview bundle to live deployed bundle"}
      >
        {view.icon}
        <span className="truncate">{view.label}</span>
      </Button>
      {status !== "idle" && status !== "checking" && detail && (
        <pre className="whitespace-pre-wrap break-all text-[10px] opacity-70 leading-tight">{detail}</pre>
      )}
    </div>
  );
};
