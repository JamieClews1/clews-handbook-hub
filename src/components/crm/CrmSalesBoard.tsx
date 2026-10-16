import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEAL_STAGES, type Deal, type DealStage, formatMoney, needsFollowUp } from "@/lib/crm-deals";

interface Props {
  deals: Deal[];
  setDeals: (fn: (d: Deal[]) => Deal[]) => void;
  team: Array<{ id: string; name: string }>;
  customerNames: Record<string, string>;
  onlyMineId: string | null;
  onOpenTicket: (ticketId: string) => void;
}

/** Kanban board of Inbox deals — drag between stages, click to open the email. */
export function CrmSalesBoard({ deals, setDeals, team, customerNames, onlyMineId, onOpenTicket }: Props) {
  const { toast } = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const visible = useMemo(() => (onlyMineId ? deals.filter((d) => d.assigned_to === onlyMineId) : deals), [deals, onlyMineId]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const week = visible.filter((d) => new Date(d.created_at).getTime() >= weekAgo);
    const closed = visible.filter((d) => ["won", "completed", "lost"].includes(d.stage));
    const won = closed.filter((d) => d.stage !== "lost");
    const quotedValue = visible.filter((d) => ["quoted", "won", "completed"].includes(d.stage)).reduce((s, d) => s + Number(d.value_net ?? 0), 0);
    return { week: week.length, winRate: closed.length ? Math.round((won.length / closed.length) * 100) : null, quotedValue, follow: visible.filter((d) => needsFollowUp(d)).length };
  }, [visible]);

  const move = async (id: string, stage: DealStage) => {
    const now = new Date().toISOString();
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    const patch: Partial<Deal> = { stage };
    if (stage === "quoted" && !deal.quoted_at) patch.quoted_at = now;
    if (stage === "won") patch.won_at = now;
    if (stage === "completed" || stage === "lost") patch.closed_at = now;
    setDeals((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    const { error } = await supabase.from("crm_deals").update(patch as any).eq("id", id);
    if (error) toast({ title: "Could not move deal", description: error.message, variant: "destructive" });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border-b shrink-0">
        {[
          ["New this week", String(stats.week)],
          ["Win rate", stats.winRate == null ? "—" : `${stats.winRate}%`],
          ["Value quoted (net)", formatMoney(stats.quotedValue) || "£0"],
          ["Need follow-up", String(stats.follow)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-md border px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
            <p className="text-lg font-semibold text-foreground">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="grid grid-cols-5 gap-3 p-3 min-w-[1000px] h-full">
          {DEAL_STAGES.map((s) => {
            const col = visible.filter((d) => d.stage === s.value);
            const total = col.reduce((t, d) => t + Number(d.value_net ?? 0), 0);
            return (
              <div
                key={s.value}
                className="flex flex-col min-h-0 rounded-lg bg-muted/40 border"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) move(dragId, s.value); setDragId(null); }}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <Badge variant="outline" className={cn("text-[11px]", s.className)}>{s.label}</Badge>
                  <span className="text-xs text-muted-foreground">{col.length}{total ? ` · ${formatMoney(total)}` : ""}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
                  {col.map((d) => (
                    <button
                      key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onClick={() => d.ticket_id && onOpenTicket(d.ticket_id)}
                      className="w-full text-left rounded-md border bg-card p-2.5 shadow-sm hover:border-primary/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground line-clamp-2">{d.title || "(no subject)"}</p>
                      {d.customer_id && customerNames[d.customer_id] && <p className="text-xs text-muted-foreground truncate">{customerNames[d.customer_id]}</p>}
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {d.value_net != null && <Badge variant="secondary" className="text-[10px]">{formatMoney(d.value_net)}</Badge>}
                        {d.assigned_to && team.find((m) => m.id === d.assigned_to) && <Badge variant="outline" className="text-[10px]">{team.find((m) => m.id === d.assigned_to)!.name}</Badge>}
                        {needsFollowUp(d) && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700"><Clock className="h-3 w-3 mr-0.5" />Follow up</Badge>}
                        {d.lost_reason && <span className="text-[10px] text-muted-foreground">{d.lost_reason}</span>}
                        {d.route_one_job_number && <span className="text-[10px] text-muted-foreground">Job {d.route_one_job_number}</span>}
                      </div>
                    </button>
                  ))}
                  {!col.length && <p className="text-xs text-muted-foreground text-center py-4">Drop deals here</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
