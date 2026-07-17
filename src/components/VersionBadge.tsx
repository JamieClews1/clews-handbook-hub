import { useState } from "react";
import packageJson from "../../package.json";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";

type Status = "idle" | "checking" | "match" | "mismatch" | "error";

function getCurrentBundleScript(): string | null {
  const scripts = Array.from(document.querySelectorAll('script[src*="/assets/"]')) as HTMLScriptElement[];
  const main = scripts.find((s) => /\/assets\/index-.+\.js/.test(s.src)) ?? scripts[0];
  if (!main) return null;
  try {
    return new URL(main.src).pathname;
  } catch {
    return main.src;
  }
}

export const VersionBadge = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState<string>("");

  const check = async () => {
    setStatus("checking");
    setDetail("");
    const current = getCurrentBundleScript();
    if (!current) {
      setStatus("error");
      setDetail("Could not read current bundle");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("check-live-sync");
      if (error) throw error;
      const results = (data as any)?.results ?? {};
      const scripts = Object.values(results).map((r: any) => r.script).filter(Boolean) as string[];
      if (scripts.length === 0) {
        setStatus("error");
        setDetail("No live bundle found");
        return;
      }
      const allMatch = scripts.every((s) => s === current);
      if (allMatch) {
        setStatus("match");
        setDetail(current);
      } else {
        setStatus("mismatch");
        setDetail(`preview: ${current}\nlive: ${scripts.join(", ")}`);
      }
    } catch (e: any) {
      setStatus("error");
      setDetail(e?.message ?? String(e));
    }
  };

  const icon = {
    idle: <RefreshCw className="h-3 w-3" />,
    checking: <Loader2 className="h-3 w-3 animate-spin" />,
    match: <CheckCircle2 className="h-3 w-3 text-success" />,
    mismatch: <AlertTriangle className="h-3 w-3 text-warning" />,
    error: <AlertTriangle className="h-3 w-3 text-destructive" />,
  }[status];

  const label = {
    idle: "Check live sync",
    checking: "Checking…",
    match: "In sync with live",
    mismatch: "Preview differs",
    error: "Check failed",
  }[status];

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
        className="h-6 w-full justify-start gap-1.5 px-1 text-[11px] text-muted-foreground/70 hover:text-foreground"
        disabled={status === "checking"}
        title={detail || "Compare preview bundle to live deployed bundle"}
      >
        {icon}
        <span className="truncate">{label}</span>
      </Button>
      {status === "mismatch" && (
        <pre className="whitespace-pre-wrap break-all text-[10px] text-warning/80 leading-tight">{detail}</pre>
      )}
    </div>
  );
};
