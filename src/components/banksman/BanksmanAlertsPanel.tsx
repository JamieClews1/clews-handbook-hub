import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, CheckCircle2, ClipboardList, Loader2, Maximize2, Minimize2, Search, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill, type BJob } from "./BanksmanWorkflow";
import { useBanksmanJobs } from "./useBanksmanJobs";
import { BanksmanJobDialog } from "./BanksmanJobDialog";

const gbp = (n: number) => `£${Number(n || 0).toFixed(2)}`;
const tm = (s: string | null) => (s ? new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");

/** Weighbridge live view: at-a-glance counts, urgent alerts first, and searchable banksman jobs. */
export function BanksmanAlertsPanel() {
  const { jobs, loading } = useBanksmanJobs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const todays = jobs.filter((j) => j.created_at.slice(0, 10) === today);
  const urgent = jobs.filter((j) => j.alert_status === "urgent");
  const stats = [
    { label: "Jobs Today", value: todays.length, icon: ClipboardList, cls: "" },
    { label: "Jobs Waiting", value: jobs.filter((j) => j.status !== "completed").length, icon: Timer, cls: "" },
    { label: "Completed", value: todays.filter((j) => j.status === "completed").length, icon: CheckCircle2, cls: "" },
    { label: "Urgent Contamination", value: urgent.length, icon: AlertTriangle, cls: urgent.length ? "border-destructive bg-destructive text-destructive-foreground" : "" },
    { label: "Alerts Waiting", value: urgent.length, icon: Bell, cls: urgent.length ? "border-destructive" : "" },
  ];
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rank = (j: BJob) => (j.alert_status === "urgent" ? 0 : 1);
    return jobs.filter((j) => !s || [j.job_number, j.vehicle_reg, j.customer, j.material].some((v) => (v ?? "").toLowerCase().includes(s)))
      .sort((a, b) => rank(a) - rank(b) || (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at));
  }, [jobs, q]);
  const open = jobs.find((j) => j.id === openId) ?? null;
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    const h = () => setIsFull(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  };

  return (
    <div ref={rootRef} className={cn("space-y-4", isFull && "overflow-auto bg-background p-6")}>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={toggleFull} className="gap-2">
          {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isFull ? "Exit full screen" : "Full screen"}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className={cn("border-2", s.cls)}>
            <CardContent className="flex items-center justify-between p-4">
              <div><p className="text-xs font-semibold uppercase opacity-80">{s.label}</p><p className="text-3xl font-extrabold">{s.value}</p></div>
              <s.icon className="h-7 w-7 opacity-70" />
            </CardContent>
          </Card>
        ))}
      </div>

      {urgent.map((j) => (
        <div key={j.id} role="alert" className="flex flex-wrap items-center gap-4 rounded-xl bg-destructive p-4 text-destructive-foreground">
          <AlertTriangle className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold">URGENT – CONTAMINATION</p>
            <p className="font-semibold">Job #{j.job_number} · {j.vehicle_reg || "No reg"} · {j.contamination_items.map((i) => i.name).join(" + ")}</p>
            <p>Additional charge <b className="text-lg">{gbp(j.contamination_total)}</b> · {j.completed_by_name} at {tm(j.completed_at)}</p>
          </div>
          <Button variant="secondary" size="lg" className="font-bold" onClick={() => setOpenId(j.id)}>VIEW JOB</Button>
        </div>
      ))}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job, reg, customer…" className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin" /> : (
            <div className="divide-y divide-border">
              {list.map((j) => (
                <button key={j.id} onClick={() => setOpenId(j.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                  <span className="w-24 font-bold">#{j.job_number}</span>
                  <span className="w-28 font-mono">{j.vehicle_reg || "—"}</span>
                  <span className="min-w-0 flex-1 truncate">{j.customer || "—"} <span className="text-muted-foreground">· {j.material || ""}</span></span>
                  {j.has_contamination && <span className="font-bold text-destructive">{gbp(j.contamination_total)}</span>}
                  <span className="text-xs text-muted-foreground">{tm(j.completed_at ?? j.created_at)}</span>
                  <StatusPill job={j} />
                </button>
              ))}
              {list.length === 0 && <p className="p-8 text-center text-muted-foreground">No banksman jobs yet. First weighs appear here automatically.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <BanksmanJobDialog job={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
