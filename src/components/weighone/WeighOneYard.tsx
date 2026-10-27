import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BanksmanTicketReport, banksmanLabel, type LinkedBanksmanJob } from "./BanksmanTicketReport";
import { BanksmanJobDialog } from "@/components/banksman/BanksmanJobDialog";
import { AlertTriangle, Search } from "lucide-react";

type YardTicket = { id: string; ticket_number: string; vehicle_reg: string; customer: string | null; waste_description: string | null; ewc_code: string | null; status: string; first_weigh_at: string | null; gross_weight_kg: number | null; net_weight_kg: number | null };

export function WeighOneYard({ tickets, jobs, onTicket, onWeighOut }: { tickets: YardTicket[]; jobs: LinkedBanksmanJob[]; onTicket: (id: string) => void; onWeighOut: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [report, setReport] = useState<LinkedBanksmanJob | null>(null);
  const onsite = tickets.filter(t => t.status === "first_weigh");
  const urgent = jobs.filter(j => j.alert_status === "urgent");
  const match = (id: string) => jobs.find(j => j.weighbridge_transaction_id === id);
  const shown = onsite.filter(t => (!search || [t.ticket_number, t.vehicle_reg, t.customer, t.waste_description].some(v => v?.toLowerCase().includes(search.toLowerCase()))) && (filter !== "alert" || match(t.id)?.has_contamination));
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-baseline gap-2"><h2 className="text-base font-semibold">Who’s in the yard</h2><span className="text-xs text-muted-foreground">{onsite.length} vehicles · awaiting weigh-out</span></div><div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search yard vehicles" placeholder="Search vehicle, customer…" className="h-9 pl-8" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
      <div className="flex gap-2"><Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button><Button size="sm" variant={filter === "alert" ? "default" : "outline"} onClick={() => setFilter("alert")}>Has report</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map(ticket => {
        const job = match(ticket.id);
        const elapsed = ticket.first_weigh_at ? Math.max(0, Math.floor((Date.now() - new Date(ticket.first_weigh_at).getTime()) / 60000)) : null;
        return <article key={ticket.id} className={`min-w-0 rounded-lg border bg-card p-3 space-y-3 ${job?.alert_status === "urgent" ? "border-destructive" : "border-border"}`}>
          <Button variant="ghost" className="h-auto w-full justify-start p-0 text-left whitespace-normal" onClick={() => onTicket(ticket.id)}><div className="w-full space-y-2"><div className="flex justify-between gap-2"><span className="rounded bg-warning-subtle px-2 py-1 font-mono font-bold text-foreground">{ticket.vehicle_reg}</span><span className="text-xs font-normal text-muted-foreground">{elapsed !== null ? `${elapsed} min` : "—"}</span></div><p className="break-words font-semibold">{ticket.customer || "No customer"}</p><p className="text-xs text-muted-foreground font-normal">{ticket.waste_description} · {ticket.ewc_code}</p><p className="text-xs font-normal text-muted-foreground">#{ticket.ticket_number} · Gross {ticket.gross_weight_kg !== null ? `${(ticket.gross_weight_kg / 1000).toFixed(2)} t` : "—"}</p></div></Button>
          <Badge variant="outline" className={job?.alert_status === "urgent" ? "text-destructive border-destructive" : job?.has_contamination ? "text-warning-text bg-warning-subtle" : "text-muted-foreground"}>{banksmanLabel(job)}</Badge>
          <div className="flex justify-between gap-2"><Button size="sm" variant="outline" onClick={() => onTicket(ticket.id)}>View ticket</Button><Button size="sm" onClick={() => onWeighOut(ticket.id)}>Weigh out</Button></div>
        </article>;
      })}</div>
      {!shown.length && <p className="border-y border-border py-10 text-center text-muted-foreground">{onsite.length ? "No vehicles match this search." : "No vehicles awaiting weigh-out."}</p>}
    </div>
    <aside className="space-y-3 border-l border-border pl-4"><div className="flex items-center justify-between"><h2 className="font-semibold text-sm">Banksman alerts</h2><Badge variant="outline">{urgent.length} need review</Badge></div>{urgent.map(job => <div key={job.id} className="rounded-lg border border-destructive bg-destructive-subtle p-3 space-y-2"><p className="flex gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />Urgent · {job.vehicle_reg}</p><p className="text-xs">#{job.job_number} · {job.customer}</p><BanksmanTicketReport job={job} /><Button variant="outline" size="sm" onClick={() => setReport(job)}>Review alert</Button></div>)}{!urgent.length && <p className="text-sm text-muted-foreground py-5">No unresolved urgent alerts.</p>}<h3 className="border-t border-border pt-4 text-xs font-semibold">Recently checked</h3>{jobs.filter(j => j.status === "completed" && j.alert_status !== "urgent").slice(0, 5).map(job => <Button key={job.id} variant="ghost" className="h-auto w-full justify-start text-left whitespace-normal p-2 text-xs" onClick={() => setReport(job)}><div><strong className="font-mono">{job.vehicle_reg}</strong><p className="font-normal text-muted-foreground">{banksmanLabel(job)}</p></div></Button>)}<BanksmanJobDialog job={report} onClose={() => setReport(null)} /></aside>
  </div>;
}