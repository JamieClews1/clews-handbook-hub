import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { driverAction } from "@/lib/driver-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ArrowLeft, Camera, CheckCircle2, ClipboardList, HardHat, Loader2, LogOut,
  Minus, Plus, RefreshCw, Search, Send, Trash2, Truck, X, Bell, Package,
} from "lucide-react";
import BanksmanJobsPhotos from "./BanksmanJobsPhotos";

export interface BanksmanUser { id: string; name: string }
type Photo = { url: string; taken_at: string; item_id?: string | null };
type Item = { item_id: string; name: string; unit_charge: number; qty: number; line_total: number };
export interface BJob {
  id: string; job_number: string; vehicle_reg: string | null; customer: string | null; site: string | null;
  material: string | null; container_type: string | null; notes: string | null; status: string;
  created_at: string; completed_at: string | null; completed_by_name: string | null;
  load_photos: Photo[]; has_contamination: boolean; contamination_items: Item[];
  contamination_total: number; contamination_photos: Photo[]; alert_status: string;
  acknowledged_by_name: string | null;
}
type ChargeItem = { id: string; name: string; unit_charge: number };

const gbp = (n: number) => `£${Number(n || 0).toFixed(2)}`;
const time = (s: string | null) => (s ? new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");

/** Shrink a camera photo to ~1600px JPEG and return base64 (no prefix). */
async function compress(file: File): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return c.toDataURL("image/jpeg", 0.8).split(",")[1];
}

export function StatusPill({ job }: { job: Pick<BJob, "status" | "alert_status"> }) {
  const map: Record<string, [string, string]> = {
    new: ["NEW", "bg-blue-600 text-white"],
    in_progress: ["IN PROGRESS", "bg-yellow-400 text-black"],
    completed: ["COMPLETED", "bg-emerald-600 text-white"],
    urgent: ["URGENT – CONTAMINATION", "bg-destructive text-destructive-foreground"],
    acknowledged: ["ACKNOWLEDGED", "bg-orange-500 text-white"],
  };
  const key = job.alert_status === "urgent" || job.alert_status === "acknowledged" ? job.alert_status : job.status;
  const [label, cls] = map[key] ?? map.new;
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-extrabold tracking-wide", cls)}>
    {key === "urgent" && <AlertTriangle className="h-3.5 w-3.5" />}{key === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}{label}
  </span>;
}

/* ─── Camera strip ─── */
function PhotoCapture({ staffId, jobId, kind, photos, setPhotos, itemId }: {
  staffId: string; jobId: string; kind: "load" | "contamination"; photos: Photo[];
  setPhotos: (fn: (p: Photo[]) => Photo[]) => void; itemId?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    for (const f of Array.from(files)) {
      setBusy((b) => b + 1);
      try {
        const file_base64 = await compress(f);
        const r = await driverAction<{ url: string; taken_at: string }>("banksman_upload_photo", { staff_id: staffId, job_id: jobId, kind, file_base64 });
        setPhotos((p) => [...p, { url: r.url, taken_at: r.taken_at, item_id: itemId ?? null }]);
      } catch (e) { setErr((e as Error).message || "Photo failed to upload — try again"); }
      setBusy((b) => b - 1);
    }
    if (input.current) input.current.value = "";
  };
  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <Button onClick={() => input.current?.click()} className="h-20 w-full gap-3 text-xl font-extrabold">
        {busy > 0 ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-8 w-8" />}
        {busy > 0 ? "Saving photo…" : photos.length ? "TAKE ANOTHER PHOTO" : "TAKE PHOTO"}
      </Button>
      {err && <p className="text-center font-semibold text-destructive">{err}</p>}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.url} className="relative aspect-square overflow-hidden rounded-lg border-2 border-border">
              <button onClick={() => setPreview(p.url)} className="h-full w-full"><img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" /></button>
              <button aria-label="Delete photo" onClick={() => setPhotos((all) => all.filter((x) => x.url !== p.url))}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-2 text-destructive"><Trash2 className="h-5 w-5" /></button>
            </div>
          ))}
        </div>
      )}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-3" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-h-full max-w-full rounded-lg" />
          <button aria-label="Close" className="absolute right-4 top-4 rounded-full bg-background p-3"><X className="h-6 w-6" /></button>
        </div>
      )}
    </div>
  );
}

function InfoRows({ job }: { job: BJob }) {
  const rows: [string, string | null][] = [
    ["Registration", job.vehicle_reg], ["Customer", job.customer], ["Material", job.material],
    ["Container", job.container_type], ["Site", job.site], ["Notes", job.notes],
  ];
  return <div className="divide-y divide-border rounded-xl border-2 border-border bg-card">
    {rows.filter(([, v]) => v).map(([k, v]) => (
      <div key={k} className="flex justify-between gap-4 px-4 py-3 text-lg">
        <span className="text-muted-foreground">{k}</span>
        <span className={cn("text-right font-bold", k === "Registration" && "rounded bg-yellow-300 px-2 font-mono text-black")}>{v}</span>
      </div>
    ))}
  </div>;
}

/* ─── The job workflow ─── */
type Step = "details" | "load" | "question" | "contamination" | "contPhotos" | "summary" | "done";

function JobFlow({ user, job, onClose }: { user: BanksmanUser; job: BJob; onClose: () => void }) {
  const [step, setStep] = useState<Step>("details");
  const [loadPhotos, setLoadPhotos] = useState<Photo[]>([]);
  const [contPhotos, setContPhotos] = useState<Photo[]>([]);
  const [hasCont, setHasCont] = useState(false);
  const [catalog, setCatalog] = useState<ChargeItem[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    driverAction<{ items: ChargeItem[] }>("banksman_charge_items", { staff_id: user.id }).then((r) => setCatalog(r.items)).catch(() => {});
  }, [user.id]);

  const selected = useMemo(() => catalog.filter((c) => qty[c.id] > 0).map((c) => ({
    item_id: c.id, name: c.name, unit_charge: Number(c.unit_charge), qty: qty[c.id], line_total: Number(c.unit_charge) * qty[c.id],
  })), [catalog, qty]);
  const total = selected.reduce((s, i) => s + i.line_total, 0);

  const start = async () => {
    driverAction("banksman_start", { staff_id: user.id, job_id: job.id }).catch(() => {});
    setStep("load");
  };
  const complete = async () => {
    setSending(true); setErr("");
    try {
      await driverAction("banksman_complete", {
        staff_id: user.id, job_id: job.id, load_photos: loadPhotos,
        contamination_items: hasCont ? selected.map((s) => ({ item_id: s.item_id, qty: s.qty })) : [],
        contamination_photos: hasCont ? contPhotos : [],
      });
      setStep("done");
    } catch (e) { setErr((e as Error).message || "Could not send — check signal and try again"); }
    setSending(false);
  };
  const back: Partial<Record<Step, Step>> = { load: "details", question: "load", contamination: "question", contPhotos: "contamination", summary: hasCont ? "contPhotos" : "question" };
  const titles: Record<Step, string> = {
    details: `Job #${job.job_number}`, load: "Take Load Photos", question: "Contamination check", contamination: "Select contamination",
    contPhotos: "Take Contamination Photo", summary: "Job Summary", done: "Job Completed",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b-2 border-border bg-card px-2 py-3">
        {step !== "done" && <Button variant="ghost" size="icon" className="h-12 w-12" aria-label="Back" onClick={() => (back[step] ? setStep(back[step]!) : onClose())}><ArrowLeft className="h-7 w-7" /></Button>}
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-xl font-extrabold">{titles[step]}</p>
          <p className="truncate text-sm text-muted-foreground">#{job.job_number} · {job.vehicle_reg || "No reg"}</p>
        </div>
      </header>

      <main className="flex-1 space-y-5 p-4 pb-36">
        {step === "details" && <InfoRows job={job} />}

        {step === "load" && <>
          <p className="text-lg text-muted-foreground">Photograph the load. Take as many as you need — tap a photo to view it, the bin to delete.</p>
          <PhotoCapture staffId={user.id} jobId={job.id} kind="load" photos={loadPhotos} setPhotos={setLoadPhotos} />
        </>}

        {step === "question" && <div className="space-y-5 pt-4">
          <p className="text-center text-3xl font-extrabold">Is there any contamination?</p>
          <button onClick={() => { setHasCont(false); setStep("summary"); }}
            className="flex h-32 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-2xl font-extrabold text-white active:scale-[0.98]">
            <CheckCircle2 className="h-10 w-10" /> NO CONTAMINATION
          </button>
          <button onClick={() => { setHasCont(true); setStep("contamination"); }}
            className="flex h-32 w-full items-center justify-center gap-3 rounded-2xl bg-destructive text-2xl font-extrabold text-destructive-foreground active:scale-[0.98]">
            <AlertTriangle className="h-10 w-10" /> YES – ADD CONTAMINATION
          </button>
        </div>}

        {step === "contamination" && <>
          <div className="grid grid-cols-1 gap-3">
            {catalog.length === 0 && <Loader2 className="mx-auto h-8 w-8 animate-spin" />}
            {catalog.map((c) => {
              const q = qty[c.id] ?? 0;
              return (
                <div key={c.id} className={cn("rounded-xl border-2 p-3 transition-colors", q ? "border-destructive bg-destructive/10" : "border-border bg-card")}>
                  <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setQty((s) => ({ ...s, [c.id]: q ? 0 : 1 }))}>
                    <span className="text-lg font-bold leading-tight">{c.name}</span>
                    <span className="shrink-0 text-xl font-extrabold">{gbp(c.unit_charge)}</span>
                  </button>
                  {q > 0 && (
                    <div className="mt-3 flex items-center justify-end gap-3">
                      <span className="mr-auto text-sm text-muted-foreground">How many?</span>
                      <Button variant="outline" size="icon" className="h-12 w-12" aria-label="Fewer" onClick={() => setQty((s) => ({ ...s, [c.id]: q - 1 }))}><Minus className="h-6 w-6" /></Button>
                      <span className="w-10 text-center text-2xl font-extrabold">{q}</span>
                      <Button variant="outline" size="icon" className="h-12 w-12" aria-label="More" onClick={() => setQty((s) => ({ ...s, [c.id]: Math.min(99, q + 1) }))}><Plus className="h-6 w-6" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {selected.length > 0 && <ContSummary items={selected} total={total} />}
        </>}

        {step === "contPhotos" && <>
          <div className="flex items-center gap-2 rounded-xl border-2 border-destructive bg-destructive/10 p-3 font-bold text-destructive">
            <AlertTriangle className="h-6 w-6 shrink-0" /> A photo of the contamination is required.
          </div>
          <PhotoCapture staffId={user.id} jobId={job.id} kind="contamination" photos={contPhotos} setPhotos={setContPhotos} />
        </>}

        {step === "summary" && <>
          <div className="divide-y divide-border rounded-xl border-2 border-border bg-card text-lg">
            {[["Job", `#${job.job_number}`], ["Registration", job.vehicle_reg || "—"], ["Load Photos", String(loadPhotos.length)], ["Contamination", hasCont ? "YES" : "No"],
              ...(hasCont ? [["Contamination Photos", String(contPhotos.length)]] : [])].map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-3"><span className="text-muted-foreground">{k}</span>
                <span className={cn("font-extrabold", k === "Contamination" && hasCont && "text-destructive")}>{v}</span></div>
            ))}
          </div>
          {hasCont && <ContSummary items={selected} total={total} />}
          {err && <p className="text-center text-lg font-bold text-destructive">{err}</p>}
        </>}

        {step === "done" && <div className="flex flex-col items-center gap-4 pt-16 text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="h-16 w-16" /></div>
          <p className="text-3xl font-extrabold">Job Completed</p>
          <p className="text-lg text-muted-foreground">Information sent successfully{hasCont ? " — the weighbridge has an URGENT contamination alert." : "."}</p>
        </div>}
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t-2 border-border bg-card p-4">
        {step === "details" && <Button onClick={start} className="h-20 w-full gap-3 text-xl font-extrabold"><Camera className="h-8 w-8" /> TAKE LOAD PHOTOS</Button>}
        {step === "load" && <Button disabled={loadPhotos.length === 0} onClick={() => setStep("question")} className="h-20 w-full text-xl font-extrabold">{loadPhotos.length ? `CONTINUE (${loadPhotos.length} photo${loadPhotos.length > 1 ? "s" : ""})` : "Take at least 1 photo"}</Button>}
        {step === "contamination" && <Button disabled={!selected.length} onClick={() => setStep("contPhotos")} className="h-20 w-full text-xl font-extrabold">{selected.length ? `NEXT – PHOTO (${gbp(total)})` : "Select contamination"}</Button>}
        {step === "contPhotos" && <Button disabled={!contPhotos.length} onClick={() => setStep("summary")} className="h-20 w-full text-xl font-extrabold">{contPhotos.length ? "REVIEW JOB" : "Photo required"}</Button>}
        {step === "summary" && <Button disabled={sending} onClick={complete}
          className={cn("h-20 w-full gap-3 text-xl font-extrabold", hasCont ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-emerald-600 text-white hover:bg-emerald-700")}>
          {sending ? <Loader2 className="h-8 w-8 animate-spin" /> : <Send className="h-7 w-7" />}{hasCont ? "COMPLETE & SEND" : "COMPLETE JOB"}</Button>}
        {step === "done" && <Button onClick={onClose} className="h-20 w-full text-xl font-extrabold">BACK TO JOBS</Button>}
      </footer>
    </div>
  );
}

function ContSummary({ items, total }: { items: Item[]; total: number }) {
  return <div className="rounded-xl border-2 border-destructive bg-card p-4">
    <p className="mb-2 font-extrabold uppercase text-destructive">Contamination Summary</p>
    {items.map((i) => <div key={i.item_id} className="flex justify-between py-1 text-lg">
      <span>{i.name}{i.qty > 1 ? ` × ${i.qty}` : ""}</span><span className="font-bold">{gbp(i.line_total)}</span></div>)}
    <div className="mt-2 flex justify-between border-t-2 border-border pt-2 text-xl font-extrabold">
      <span>Total Additional Charge</span><span className="text-destructive">{gbp(total)}</span></div>
  </div>;
}

function JobCard({ job, onStart }: { job: BJob; onStart?: () => void }) {
  return <div className={cn("rounded-2xl border-2 bg-card p-4", job.alert_status === "urgent" ? "border-destructive" : "border-border")}>
    <div className="flex items-start justify-between gap-2">
      <p className="text-2xl font-extrabold">#{job.job_number}</p><StatusPill job={job} />
    </div>
    <div className="mt-2 space-y-1 text-lg">
      <p><span className="text-muted-foreground">Reg: </span><span className="rounded bg-yellow-300 px-1.5 font-mono font-bold text-black">{job.vehicle_reg || "—"}</span></p>
      {job.customer && <p className="truncate"><span className="text-muted-foreground">Customer: </span><b>{job.customer}</b></p>}
      {job.material && <p className="truncate"><span className="text-muted-foreground">Material: </span><b>{job.material}</b></p>}
      {job.status === "completed" && <p className="text-sm text-muted-foreground">Completed {time(job.completed_at)} by {job.completed_by_name}
        {job.has_contamination && <> · <b className="text-destructive">{gbp(job.contamination_total)}</b></>}</p>}
    </div>
    {onStart && <Button onClick={onStart} className="mt-4 h-16 w-full text-xl font-extrabold">{job.status === "in_progress" ? "CONTINUE JOB" : "START JOB"}</Button>}
  </div>;
}

/* ─── App shell ─── */
export default function BanksmanWorkflow({ user, onLogout }: { user: BanksmanUser; onLogout: () => void }) {
  const [jobs, setJobs] = useState<BJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"jobs" | "completed" | "alerts" | "search">("jobs");
  const [active, setActive] = useState<BJob | null>(null);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try { const r = await driverAction<{ jobs: BJob[] }>("banksman_list", { staff_id: user.id }); setJobs(r.jobs ?? []); } catch (e) { console.error(e); }
    setLoading(false); setRefreshing(false);
  }, [user.id]);
  useEffect(() => { load(); const t = setInterval(() => load(true), 15000); return () => clearInterval(t); }, [load]);

  const waiting = jobs.filter((j) => j.status !== "completed").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const today = new Date().toISOString().slice(0, 10);
  const completed = jobs.filter((j) => j.status === "completed" && (j.completed_at ?? "").slice(0, 10) === today);
  const alerts = jobs.filter((j) => j.alert_status === "urgent" || j.alert_status === "acknowledged");
  const urgent = alerts.filter((j) => j.alert_status === "urgent");

  if (active) return <JobFlow user={user} job={active} onClose={() => { setActive(null); load(true); }} />;

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15"><HardHat className="h-6 w-6 text-primary" /></div>
          <div><p className="text-lg font-extrabold leading-tight">Banksman</p><p className="text-sm text-muted-foreground">{user.name}</p></div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-12 w-12" aria-label="Refresh" onClick={() => load(true)}><RefreshCw className={cn("h-6 w-6", refreshing && "animate-spin")} /></Button>
          <Button variant="ghost" size="icon" className="h-12 w-12" aria-label="Sign out" onClick={onLogout}><LogOut className="h-6 w-6" /></Button>
        </div>
      </header>

      <main className="space-y-4 p-4">
        {loading ? <Loader2 className="mx-auto mt-20 h-10 w-10 animate-spin" /> : <>
          {tab === "jobs" && <>
            {urgent.length > 0 && (
              <button onClick={() => setTab("alerts")} className="flex w-full items-center justify-between rounded-2xl bg-destructive p-4 text-left text-destructive-foreground">
                <span className="flex items-center gap-2 text-xl font-extrabold"><AlertTriangle className="h-7 w-7" />{urgent.length} URGENT CONTAMINATION</span>
                <span className="font-bold underline">VIEW ALERT</span>
              </button>
            )}
            <div><p className="text-sm font-bold uppercase text-muted-foreground">Today's Jobs</p>
              <p className="text-3xl font-extrabold">{waiting.length} Job{waiting.length === 1 ? "" : "s"} Waiting</p></div>
            {waiting.length === 0 && <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-lg text-muted-foreground">
              <Truck className="mx-auto mb-2 h-10 w-10" />No jobs waiting. New weigh-ins appear here automatically.</div>}
            {waiting.map((j) => <JobCard key={j.id} job={j} onStart={() => setActive(j)} />)}
          </>}
          {tab === "completed" && <>
            <p className="text-2xl font-extrabold">Completed today ({completed.length})</p>
            {completed.map((j) => <JobCard key={j.id} job={j} />)}
            {completed.length === 0 && <p className="text-center text-lg text-muted-foreground">Nothing completed yet today.</p>}
          </>}
          {tab === "alerts" && <>
            <p className="text-2xl font-extrabold">Alerts</p>
            {alerts.map((j) => <JobCard key={j.id} job={j} />)}
            {alerts.length === 0 && <p className="text-center text-lg text-muted-foreground">No contamination alerts.</p>}
          </>}
          {tab === "search" && <BanksmanJobsPhotos staffId={user.id} />}
        </>}
      </main>

      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t-2 border-border bg-card">
        {([["jobs", "Jobs", ClipboardList, waiting.length], ["completed", "Completed", CheckCircle2, 0], ["alerts", "Alerts", Bell, urgent.length], ["search", "Search", Search, 0]] as const).map(([k, label, Icon, n]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("relative flex h-20 flex-col items-center justify-center gap-1 text-sm font-bold", tab === k ? "text-primary" : "text-muted-foreground")}>
            <Icon className="h-7 w-7" />{label}
            {n > 0 && <span className={cn("absolute right-[22%] top-2 min-w-6 rounded-full px-1.5 text-xs font-extrabold", k === "alerts" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")}>{n}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

export { Package };
