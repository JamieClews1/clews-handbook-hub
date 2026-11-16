import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { SOURCE_STATUS_LABELS, type SourceStatus } from "@/lib/colas-report";
import type { LucideIcon } from "lucide-react";

export function useColasAuthorised() {
  const { user, isAdmin } = useAuth();
  const q = useQuery({
    queryKey: ["colas", "authorised", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("colas_can_authorise", { _user_id: user!.id });
      if (error) throw error;
      return !!data;
    },
  });
  return isAdmin || !!q.data;
}

export function useProfileNames(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])].sort();
  return useQuery({
    queryKey: ["colas", "profiles", unique.join(",")],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);
      return new Map((data ?? []).map(p => [p.id, p.full_name || p.email || "Staff member"]));
    },
  }).data ?? new Map<string, string>();
}

const STATUS_CLASS: Record<SourceStatus, string> = {
  received: "bg-primary/10 text-primary border-primary/20",
  approved: "bg-info/10 text-info border-info/20",
  awaiting: "bg-warning-subtle text-warning-text border-warning/30",
  requires_verification: "bg-destructive/10 text-destructive border-destructive/20",
};
export function StatusChip({ status, className }: { status: SourceStatus; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", STATUS_CLASS[status], className)}>{SOURCE_STATUS_LABELS[status]}</span>;
}

export function Chip({ tone, children }: { tone: "good" | "warn" | "bad" | "info" | "neutral"; children: React.ReactNode }) {
  const cls = { good: STATUS_CLASS.received, warn: STATUS_CLASS.awaiting, bad: STATUS_CLASS.requires_verification, info: STATUS_CLASS.approved, neutral: "bg-muted text-muted-foreground border-border" }[tone];
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", cls)}>{children}</span>;
}

export function KpiCard({ label, value, sub, icon: Icon, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: LucideIcon; tone?: "alert" }) {
  return (
    <div className={cn("flex flex-col justify-between gap-2 rounded-lg border bg-card p-4", tone === "alert" && "border-l-4 border-l-destructive")}>
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" aria-hidden />}{label}
      </div>
      <div className="text-[28px] font-bold leading-9 tabular-nums text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export const ukDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
};
export const ukDateTime = (d: string | null | undefined) => d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
