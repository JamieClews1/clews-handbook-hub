import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Trophy, XCircle, Truck, Clock, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { DEAL_STAGES, LOST_REASONS, type Deal, type DealStage, formatMoney, needsFollowUp, stageMeta } from "@/lib/crm-deals";

interface Props {
  ticket: { id: string; subject: string | null; customer_id: string | null; assigned_to: string | null };
  deal: Deal | null;
  userId?: string;
  onChange: (deal: Deal) => void;
  /** £ amounts found in the email conversation, offered as one-click values. */
  suggestedValues?: number[];
}

/** Sales deal attached to an Inbox email: stage, quoted value and Route One link. */
export function CrmDealCard({ ticket, deal, userId, onChange, suggestedValues = [] }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [jobNo, setJobNo] = useState("");
  const [lostOpen, setLostOpen] = useState(false);

  const save = async (patch: Partial<Deal>) => {
    if (!deal) return;
    setBusy(true);
    const { data, error } = await supabase.from("crm_deals").update(patch as any).eq("id", deal.id).select("*").single();
    setBusy(false);
    if (error) return toast({ title: "Could not update deal", description: error.message, variant: "destructive" });
    onChange(data as Deal);
  };

  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("crm_deals")
      .insert({ ticket_id: ticket.id, customer_id: ticket.customer_id, title: ticket.subject, assigned_to: ticket.assigned_to, created_by: userId ?? null })
      .select("*")
      .single();
    setBusy(false);
    if (error) return toast({ title: "Could not create deal", description: error.message, variant: "destructive" });
    onChange(data as Deal);
  };

  if (!deal) {
    return (
      <div className="rounded-lg border border-dashed p-3">
        <Button size="sm" variant="outline" className="w-full" onClick={create} disabled={busy}>
          <Plus className="h-3.5 w-3.5" /> Make deal
        </Button>
      </div>
    );
  }

  const meta = stageMeta(deal.stage);
  const setStage = (stage: DealStage) => {
    const now = new Date().toISOString();
    const patch: Partial<Deal> = { stage };
    if (stage === "quoted" && !deal.quoted_at) patch.quoted_at = now;
    if (stage === "won") patch.won_at = now;
    if (stage === "completed" || stage === "lost") patch.closed_at = now;
    save(patch);
  };

  return (
    <div className="rounded-lg border p-3 space-y-2.5 bg-card">
      <div className="flex items-center justify-between gap-2 pr-5">
        <span className="flex items-center gap-1.5 text-sm font-semibold"><Briefcase className="h-4 w-4 text-primary" />Deal</span>
        <Badge variant="outline" className={cn("text-[10px]", meta.className)}>{meta.label}</Badge>
      </div>
      {needsFollowUp(deal) && (
        <p className="flex items-center gap-1 text-xs font-medium text-amber-700"><Clock className="h-3.5 w-3.5" />Follow up — no reply since quote</p>
      )}
      <div className="flex gap-1">
        {DEAL_STAGES.map((s) => (
          <button
            key={s.value}
            title={s.label}
            onClick={() => setStage(s.value)}
            disabled={busy}
            className={cn("h-1.5 flex-1 rounded-full transition-colors", DEAL_STAGES.findIndex((x) => x.value === deal.stage) >= DEAL_STAGES.findIndex((x) => x.value === s.value) && deal.stage !== "lost" ? "bg-primary" : "bg-muted", deal.stage === "lost" && s.value === "lost" && "bg-destructive")}
          />
        ))}
      </div>
      <label className="block text-xs text-muted-foreground">
        Quoted value (net) <span className="text-muted-foreground/80">— optional</span>
        <Input
          type="number"
          step="0.01"
          className="h-8 mt-1"
          defaultValue={deal.value_net ?? ""}
          key={deal.id + String(deal.value_net)}
          onBlur={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            if (v !== deal.value_net) save({ value_net: v });
          }}
        />
      </label>
      {suggestedValues.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-muted-foreground">From emails:</span>
          {suggestedValues.map((v) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              onClick={() => save({ value_net: v })}
              className={cn("rounded-full border px-2 py-0.5 text-[11px] transition-colors", deal.value_net === v ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/50 text-foreground")}
            >
              {formatMoney(v)}
            </button>
          ))}
          {deal.value_net != null && (
            <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => save({ value_net: null })}>Clear</button>
          )}
        </div>
      )}
      {(deal.postcode || deal.container || deal.waste_type) && (
        <p className="text-xs text-muted-foreground">{[deal.container, deal.waste_type, deal.postcode].filter(Boolean).join(" · ")}</p>
      )}

      {(deal.stage === "new" || deal.stage === "quoted") && (
        <div className="grid grid-cols-2 gap-1.5">
          {deal.stage === "new" && (
            <Button size="sm" variant="outline" className="col-span-2" onClick={() => setStage("quoted")} disabled={busy}>Mark quoted</Button>
          )}
          <Button size="sm" onClick={() => setStage("won")} disabled={busy}><Trophy className="h-3.5 w-3.5" />Won</Button>
          <Button size="sm" variant="outline" onClick={() => setLostOpen((v) => !v)} disabled={busy}><XCircle className="h-3.5 w-3.5 text-destructive" />Lost</Button>
        </div>
      )}
      {lostOpen && (deal.stage === "new" || deal.stage === "quoted") && (
        <Select onValueChange={(r) => { setLostOpen(false); save({ stage: "lost", lost_reason: r, closed_at: new Date().toISOString() }); }}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Why was it lost?" /></SelectTrigger>
          <SelectContent>{LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {deal.stage === "lost" && deal.lost_reason && <p className="text-xs text-muted-foreground">Lost: {deal.lost_reason}</p>}

      {deal.stage === "won" && (
        <div className="space-y-1.5">
          <Button size="sm" variant="outline" className="w-full" asChild>
            <Link to="/route-one"><Truck className="h-3.5 w-3.5" />Book in Route One</Link>
          </Button>
          {deal.route_one_job_number ? (
            <p className="text-xs">Linked to job <span className="font-semibold">{deal.route_one_job_number}</span> — moves to Completed when the job is done.</p>
          ) : (
            <div className="flex gap-1.5">
              <Input className="h-8" placeholder="Route One job no." value={jobNo} onChange={(e) => setJobNo(e.target.value)} />
              <Button size="sm" variant="secondary" disabled={!jobNo.trim() || busy} onClick={() => save({ route_one_job_number: jobNo.trim() })}>Link</Button>
            </div>
          )}
        </div>
      )}
      {deal.stage === "completed" && <p className="text-xs text-emerald-700 font-medium">Completed {deal.route_one_job_number ? `· job ${deal.route_one_job_number}` : ""} {formatMoney(deal.value_net)}</p>}
    </div>
  );
}
