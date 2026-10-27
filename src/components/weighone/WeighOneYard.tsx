import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BanksmanTicketReport, banksmanLabel, type LinkedBanksmanJob } from "./BanksmanTicketReport";
import { BanksmanJobDialog } from "@/components/banksman/BanksmanJobDialog";

type YardTicket = { id: string; ticket_number: string; vehicle_reg: string; customer: string | null; site?: string | null; waste_description: string | null; ewc_code: string | null; status: string; first_weigh_at: string | null; gross_weight_kg: number | null; net_weight_kg: number | null; created_at?: string | null };

const hhmm = (d: string | null | undefined) => d ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—";
const STEPS = ["Weighed in", "Tipping", "Checked", "Weigh out"];

function stageOf(job?: LinkedBanksmanJob) {
  if (!job) return 0;
  if (job.status === "completed") return 2;
  return 1;
}

function tone(job?: LinkedBanksmanJob) {
  if (!job) return null;
  if (job.alert_status === "urgent") return "urgent";
  if (job.has_contamination) return "contamination";
  if (job.status === "completed") return "clean";
  return null;
}

const toneClass = {
  urgent: "bg-destructive-subtle text-destructive",
  contamination: "bg-warning-subtle text-warning-text",
  clean: "bg-success-subtle text-success",
} as const;

export function WeighOneYard({ tickets, todayTickets = [], jobs, onTicket, onWeighOut }: { tickets: YardTicket[]; todayTickets?: YardTicket[]; jobs: LinkedBanksmanJob[]; onTicket: (id: string) => void; onWeighOut: (id: string) => void }) {
  const [filter, setFilter] = useState<"all" | "alert" | "awaiting">("all");
  const [report, setReport] = useState<LinkedBanksmanJob | null>(null);
  const onsite = tickets.filter(t => t.status === "first_weigh");
  const match = (id: string) => jobs.find(j => j.weighbridge_transaction_id === id);
  const alerts = jobs.filter(j => j.alert_status === "urgent" || (j.has_contamination && j.status !== "completed"));
  const rows = todayTickets.filter(t => filter === "all" ? true : filter === "awaiting" ? t.status === "first_weigh" : !!tone(match(t.id)) && tone(match(t.id)) !== "clean");

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div className="space-y-6 min-w-0">
      <section className="space-y-3">
        <div className="flex items-baseline gap-2"><h2 className="text-base font-semibold">Who’s in the yard</h2><span className="text-xs text-muted-foreground">{onsite.length} vehicles · weighed in, not yet weighed out</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{onsite.map(ticket => {
          const job = match(ticket.id);
          const t = tone(job);
          const stage = stageOf(job);
          const elapsed = ticket.first_weigh_at ? Math.max(0, Math.floor((Date.now() - new Date(ticket.first_weigh_at).getTime()) / 60000)) : null;
          return <button type="button" key={ticket.id} onClick={() => onTicket(ticket.id)} className={`min-w-0 rounded-xl border bg-card p-3.5 text-left space-y-2 transition-colors hover:border-foreground/30 ${t === "urgent" ? "border-destructive" : "border-border"}`}>
            <div className="flex items-center justify-between gap-2"><span className="rounded bg-warning-subtle px-2 py-0.5 font-mono text-sm font-bold text-foreground">{ticket.vehicle_reg}</span><span className="flex items-center gap-1.5 text-xs text-muted-foreground">{elapsed !== null && elapsed > 45 && <span className="h-2 w-2 rounded-full bg-warning" />}{elapsed !== null ? `${elapsed} min` : "—"}</span></div>
            <div><p className="truncate font-semibold text-foreground">{ticket.customer || "No customer"}</p><p className="truncate text-xs text-muted-foreground">{ticket.waste_description || "—"} · {hhmm(ticket.first_weigh_at)}</p></div>
            <p className="font-mono text-xs text-muted-foreground">1st {hhmm(ticket.first_weigh_at)} · {ticket.gross_weight_kg !== null ? `${(ticket.gross_weight_kg / 1000).toFixed(2)} t gross` : "—"} · #{ticket.ticket_number}</p>
            <div className="grid grid-cols-4 gap-1">{STEPS.map((s, i) => <span key={s} className={`h-1 rounded-full ${i <= stage ? (t === "urgent" ? "bg-destructive" : "bg-primary") : "bg-muted"}`} />)}</div>
            <div className="flex justify-between text-xs"><span className="font-medium text-foreground">{STEPS[stage]}</span><span className="text-muted-foreground">Next: {STEPS[stage + 1]}</span></div>
            {t && <p className={`rounded-md px-2 py-1 text-xs font-medium ${toneClass[t]}`}>Banksman · {banksmanLabel(job)}</p>}
          </button>;
        })}</div>
        {!onsite.length && <p className="rounded-xl border border-border bg-card py-10 text-center text-muted-foreground">No vehicles awaiting weigh-out.</p>}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2"><h2 className="text-base font-semibold">Today’s tickets</h2><span className="text-xs text-muted-foreground">{todayTickets.length} native tickets</span></div>
          <div className="flex gap-1.5">{([["all", "All"], ["alert", "Has alert"], ["awaiting", "Awaiting 2nd weigh"]] as const).map(([v, l]) => <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} className="h-7 rounded-full px-3 text-xs" onClick={() => setFilter(v)}>{l}</Button>)}</div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="px-3 py-2 font-medium">Ticket</th><th className="px-3 py-2 font-medium">Customer / Site</th><th className="px-3 py-2 font-medium">Vehicle</th><th className="px-3 py-2 font-medium">Waste</th><th className="px-3 py-2 font-medium">Banksman</th><th className="px-3 py-2 font-medium text-right">Net (t)</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
            <tbody>{rows.map(ticket => {
              const job = match(ticket.id); const t = tone(job);
              return <tr key={ticket.id} onClick={() => onTicket(ticket.id)} className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/50 ${t === "urgent" ? "shadow-[inset_3px_0_0_hsl(var(--destructive))]" : t === "contamination" ? "shadow-[inset_3px_0_0_hsl(var(--warning))]" : ""}`}>
                <td className="px-3 py-2 font-mono font-semibold">{ticket.ticket_number}</td>
                <td className="px-3 py-2">{ticket.customer || "—"}</td>
                <td className="px-3 py-2"><span className="rounded bg-warning-subtle px-1.5 py-0.5 font-mono text-xs font-bold">{ticket.vehicle_reg}</span></td>
                <td className="px-3 py-2 text-muted-foreground">{ticket.waste_description || "—"}</td>
                <td className="px-3 py-2">{t ? <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${toneClass[t]}`}>{banksmanLabel(job)}</span> : <span className="text-xs text-muted-foreground">Not checked yet</span>}</td>
                <td className="px-3 py-2 text-right font-mono">{ticket.net_weight_kg != null ? (ticket.net_weight_kg / 1000).toFixed(3) : "—"}</td>
                <td className="px-3 py-2">{ticket.status === "first_weigh" ? <Badge variant="outline">In yard</Badge> : <Badge className="bg-success-subtle text-success hover:bg-success-subtle">Complete</Badge>}</td>
              </tr>;
            })}{!rows.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No tickets.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>

    <aside className="space-y-3 rounded-xl border border-border bg-card p-4 self-start">
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><h2 className="font-semibold text-sm">Banksman alerts</h2>{alerts.length > 0 && <Badge variant="outline" className="border-destructive text-destructive">{alerts.length} need action</Badge>}</div><Link to="/banksman" className="text-xs font-medium text-primary hover:underline">Open app</Link></div>
      {alerts.map(job => { const urgent = job.alert_status === "urgent"; return <div key={job.id} className={`rounded-lg border p-3 space-y-2 ${urgent ? "border-destructive bg-destructive-subtle" : "border-warning bg-warning-subtle"}`}>
        <div className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2"><span className={`rounded px-1.5 py-0.5 font-semibold ${urgent ? "bg-destructive text-destructive-foreground" : "bg-warning text-foreground"}`}>{urgent ? "Urgent" : "Contamination"}</span><span className="rounded bg-card px-1.5 py-0.5 font-mono font-bold">{job.vehicle_reg}</span></span></div>
        <p className="text-xs font-medium text-foreground">#{job.job_number} · {job.customer}</p>
        <BanksmanTicketReport job={job} />
        <Button size="sm" onClick={() => setReport(job)}>{urgent ? "Review alert" : "Review charge"}</Button>
      </div>; })}
      {!alerts.length && <p className="text-sm text-muted-foreground py-4">No alerts need action.</p>}
      <h3 className="border-t border-border pt-3 text-xs font-semibold text-muted-foreground">Recently checked</h3>
      {jobs.filter(j => j.status === "completed" && j.alert_status !== "urgent").slice(0, 5).map(job => <button type="button" key={job.id} className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-xs hover:bg-muted" onClick={() => setReport(job)}><span className="rounded bg-warning-subtle px-1.5 py-0.5 font-mono font-bold">{job.vehicle_reg}</span><span className="truncate text-muted-foreground">#{job.job_number} · {banksmanLabel(job)}</span></button>)}
      <BanksmanJobDialog job={report} onClose={() => setReport(null)} />
    </aside>
  </div>;
}
