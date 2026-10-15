import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { driverAction, fileToBase64 } from "@/lib/driver-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ArrowLeft, Camera, CheckCircle2, CloudOff, Gem, ListChecks, Loader2, LogOut, Package, Scale, BarChart3, AlertTriangle } from "lucide-react";

type User = { id: string; name: string };
type Grade = { id: string; name: string; guidance: string | null };
type Entry = { id: string; recorded_at: string; created_at: string; weight_kg: number; staff_name: string; grade_id?: string; notes?: string | null; is_voided?: boolean };
type Queued = { action: "add_collection" | "add_sort"; payload: Record<string, unknown>; label: string };

const SESSION_KEY = "metals_yard_session";
const QUEUE_KEY = "metals_yard_queue";

async function yardCall<T = any>(action: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("metals-yard", { body: { action, ...params } });
  if (error) throw new Error(error.message || "Request failed");
  if (data?.error) throw new Error(data.error);
  return data as T;
}
const loadQueue = (): Queued[] => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; } };
const saveQueue = (q: Queued[]) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
const kg = (n: number) => `${Math.round(n * 10) / 10} kg`;
const time = (s: string) => new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/* ── Big numeric keypad ── */
function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (k: string) => {
    if (k === "⌫") return onChange(value.slice(0, -1));
    if (k === "." && value.includes(".")) return;
    if (value.length >= 7) return;
    onChange(value === "0" && k !== "." ? k : value + k);
  };
  return (
    <div className="space-y-3">
      <div className="h-20 rounded-2xl bg-card border-2 border-primary flex items-center justify-end px-5 text-5xl font-bold tabular-nums text-foreground">
        {value || "0"}<span className="text-2xl ml-2 text-muted-foreground">kg</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map((k) => (
          <Button key={k} type="button" variant="outline" onClick={() => press(k)} className="h-16 text-3xl font-semibold">{k}</Button>
        ))}
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr("");
    try {
      const { staff } = await driverAction("yard_login", { username: username.trim(), pin });
      if (!staff) { setErr("Invalid username or PIN"); setBusy(false); return; }
      const u = { id: staff.id, name: staff.staff_name };
      localStorage.setItem(SESSION_KEY, JSON.stringify(u));
      onLogin(u);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex w-20 h-20 rounded-2xl bg-primary/15 items-center justify-center mb-3"><Gem className="w-10 h-10 text-primary" /></div>
          <h1 className="text-3xl font-bold">Non-Ferrous Yard</h1>
          <p className="text-muted-foreground text-lg">Sign in with your yard PIN</p>
        </div>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoCapitalize="none" className="h-14 text-xl text-center" />
        <div className="flex justify-center gap-3">
          {[0,1,2,3].map((i) => <div key={i} className={cn("w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl", pin.length > i ? "border-primary text-primary" : "border-border")}>{pin.length > i ? "●" : ""}</div>)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k) => (
            <Button key={k || "x"} variant="outline" disabled={!k} className="h-16 text-2xl" onClick={() => k === "⌫" ? setPin(pin.slice(0, -1)) : pin.length < 6 && setPin(pin + k)}>{k}</Button>
          ))}
        </div>
        {err && <p className="text-destructive text-center font-medium">{err}</p>}
        <Button className="w-full h-16 text-xl" disabled={busy || !username || !pin} onClick={go}>{busy ? <Loader2 className="animate-spin" /> : "Sign in"}</Button>
      </div>
    </div>
  );
}

export default function MetalsYardPage() {
  const [user, setUser] = useState<User | null>(() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } });
  const [screen, setScreen] = useState<"home" | "collect" | "sort" | "totals" | "recent">("home");
  const [data, setData] = useState<{ grades: Grade[]; collections: Entry[]; sorts: Entry[]; recentCollections: Entry[]; recentSorts: Entry[] } | null>(null);
  const [queue, setQueue] = useState<Queued[]>(loadQueue);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Non-Ferrous Yard";
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const prev = link?.href;
    if (link) link.href = "/manifest-metals.webmanifest";
    return () => { if (link && prev) link.href = prev; };
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try { setData(await yardCall("summary", { staff_id: user.id })); } catch (e) {
      if ((e as Error).message === "Not signed in") { localStorage.removeItem(SESSION_KEY); setUser(null); }
    }
  }, [user]);

  const flush = useCallback(async () => {
    if (!user) return;
    let q = loadQueue();
    while (q.length && navigator.onLine) {
      try { await yardCall(q[0].action, { ...q[0].payload, staff_id: user.id }); q = q.slice(1); saveQueue(q); setQueue(q); }
      catch { break; }
    }
    refresh();
  }, [user, refresh]);

  useEffect(() => { flush(); const on = () => flush(); window.addEventListener("online", on); const t = setInterval(flush, 30000); return () => { window.removeEventListener("online", on); clearInterval(t); }; }, [flush]);

  const submit = async (action: Queued["action"], payload: Record<string, unknown>, label: string) => {
    const full = { ...payload, client_ref: crypto.randomUUID(), recorded_at: new Date().toISOString() };
    try {
      await yardCall(action, { ...full, staff_id: user!.id });
      setFlash(`Saved: ${label}`); refresh(); return true;
    } catch (e) {
      const msg = (e as Error).message;
      if (!navigator.onLine || /fetch|network|Failed to send/i.test(msg)) {
        const q = [...loadQueue(), { action, payload: full, label }]; saveQueue(q); setQueue(q);
        setFlash(`No signal — ${label} is waiting to sync (not saved yet)`); return true;
      }
      setFlash(`Not saved: ${msg}`); return false;
    }
  };

  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(null), 3500); return () => clearTimeout(t); } }, [flash]);

  if (!user) return <Login onLogin={setUser} />;

  const collected = (data?.collections ?? []).reduce((a, r) => a + Number(r.weight_kg), 0);
  const sorted = (data?.sorts ?? []).reduce((a, r) => a + Number(r.weight_kg), 0);
  const gradeName = (id?: string) => data?.grades.find((g) => g.id === id)?.name ?? "Metal";

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-10 bg-card border-b px-4 h-16 flex items-center justify-between">
        {screen !== "home" ? <Button variant="ghost" className="h-12 text-lg gap-2" onClick={() => setScreen("home")}><ArrowLeft />Home</Button> : <span className="text-lg font-bold flex items-center gap-2"><Gem className="text-primary" />Non-Ferrous</span>}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{user.name}</span>
          <Button variant="ghost" size="icon" className="h-12 w-12" onClick={() => { localStorage.removeItem(SESSION_KEY); setUser(null); }} aria-label="Sign out"><LogOut /></Button>
        </div>
      </header>
      {queue.length > 0 && <div className="bg-[hsl(var(--warning)/0.15)] text-foreground px-4 py-3 flex items-center gap-2 font-medium"><CloudOff className="h-5 w-5" />{queue.length} entr{queue.length === 1 ? "y" : "ies"} waiting to sync — not saved yet</div>}
      {flash && <div className={cn("mx-4 mt-4 rounded-xl p-4 text-lg font-semibold flex gap-2", flash.startsWith("Saved") ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive")}><CheckCircle2 />{flash}</div>}

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {screen === "home" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card border p-4"><p className="text-muted-foreground">Collected today</p><p className="text-3xl font-bold">{kg(collected)}</p></div>
              <div className="rounded-2xl bg-card border p-4"><p className="text-muted-foreground">Sorted today</p><p className="text-3xl font-bold">{kg(sorted)}</p></div>
            </div>
            {[
              { k: "collect", label: "Record Collection", icon: Package },
              { k: "sort", label: "Record Sorted Metal", icon: Scale },
              { k: "totals", label: "Today's Totals", icon: BarChart3 },
              { k: "recent", label: "Recent Entries", icon: ListChecks },
            ].map(({ k, label, icon: Icon }) => (
              <Button key={k} variant={k === "collect" || k === "sort" ? "default" : "outline"} className="w-full h-24 text-2xl justify-start gap-4" onClick={() => setScreen(k as any)}><Icon className="!h-9 !w-9" />{label}</Button>
            ))}
          </>
        )}
        {screen === "collect" && <CollectForm onSave={async (p, l) => { if (await submit("add_collection", p, l)) setScreen("home"); }} />}
        {screen === "sort" && data && <SortScreen grades={data.grades} onSave={(p, l) => submit("add_sort", p, l)} />}
        {screen === "totals" && data && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Big label="Collected" value={kg(collected)} /><Big label="Sorted" value={kg(sorted)} />
              <Big label="Entries" value={String(data.collections.length + data.sorts.length)} />
              <Big label="Difference" value={kg(collected - sorted)} warn={collected > 0 && Math.abs(collected - sorted) > collected * 0.1} />
            </div>
            {collected > 0 && Math.abs(collected - sorted) > collected * 0.1 && <p className="rounded-xl bg-[hsl(var(--warning)/0.15)] p-4 font-medium flex gap-2"><AlertTriangle />Collected and sorted weights differ by more than 10% — check with the office.</p>}
            <div className="rounded-2xl bg-card border divide-y">
              {data.grades.map((g) => { const w = data.sorts.filter((s) => s.grade_id === g.id).reduce((a, r) => a + Number(r.weight_kg), 0); return w > 0 ? <div key={g.id} className="flex justify-between p-4 text-xl"><span>{g.name}</span><span className="font-bold">{kg(w)}</span></div> : null; })}
              {data.sorts.length === 0 && <p className="p-4 text-muted-foreground">Nothing sorted yet today.</p>}
            </div>
          </>
        )}
        {screen === "recent" && data && <Recent user={user} data={data} gradeName={gradeName} onChanged={refresh} />}
      </main>
    </div>
  );
}

const Big = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
  <div className={cn("rounded-2xl border p-4 bg-card", warn && "border-[hsl(var(--warning))]")}><p className="text-muted-foreground">{label}</p><p className="text-3xl font-bold">{value}</p></div>
);

function CollectForm({ onSave }: { onSave: (p: Record<string, unknown>, label: string) => Promise<void> }) {
  const [w, setW] = useState(""); const [notes, setNotes] = useState(""); const [photo, setPhoto] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Record Collection</h2>
      <p className="text-muted-foreground">Total from the tippy skip after the M &amp; K picking line.</p>
      <Keypad value={w} onChange={setW} />
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="text-lg" />
      <label className="flex items-center gap-3 h-14 px-4 rounded-xl border cursor-pointer text-lg"><Camera />{photo ? photo.name : "Add photo (optional)"}<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
      <Button className="w-full h-16 text-2xl" disabled={busy || !(Number(w) > 0)} onClick={async () => {
        setBusy(true);
        await onSave({ weight_kg: Number(w), notes: notes || null, photo_base64: photo ? await fileToBase64(photo) : null }, `collection ${w} kg`);
        setBusy(false);
      }}>{busy ? <Loader2 className="animate-spin" /> : "Save collection"}</Button>
    </div>
  );
}

function SortScreen({ grades, onSave }: { grades: Grade[]; onSave: (p: Record<string, unknown>, label: string) => Promise<boolean> }) {
  const session = useMemo(() => `S-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`, []);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [w, setW] = useState(""); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; kg: number }[]>([]);
  const total = done.reduce((a, d) => a + d.kg, 0);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-primary/10 p-4 flex justify-between items-center"><span className="text-lg">This session ({done.length})</span><span className="text-3xl font-bold">{kg(total)}</span></div>
      {!grade ? (
        <div className="grid grid-cols-2 gap-3">
          {grades.map((g) => <Button key={g.id} variant="outline" className="h-20 text-lg whitespace-normal leading-tight" onClick={() => { setGrade(g); setW(""); setNotes(""); }}>{g.name}</Button>)}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between"><h2 className="text-2xl font-bold">{grade.name}</h2><Button variant="ghost" className="h-12" onClick={() => setGrade(null)}>Change</Button></div>
          {grade.guidance && <p className="rounded-xl bg-muted p-3">{grade.guidance}</p>}
          <Keypad value={w} onChange={setW} />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="h-14 text-lg" />
          <Button className="w-full h-16 text-2xl" disabled={busy || !(Number(w) > 0)} onClick={async () => {
            setBusy(true);
            const ok = await onSave({ grade_id: grade.id, weight_kg: Number(w), notes: notes || null, session_ref: session }, `${grade.name} ${w} kg`);
            setBusy(false);
            if (ok) { setDone([...done, { name: grade.name, kg: Number(w) }]); setGrade(null); }
          }}>{busy ? <Loader2 className="animate-spin" /> : "Save"}</Button>
        </>
      )}
      {done.length > 0 && <div className="rounded-2xl border divide-y">{done.map((d, i) => <div key={i} className="flex justify-between p-3 text-lg"><span>{d.name}</span><span className="font-semibold">{kg(d.kg)}</span></div>)}</div>}
    </div>
  );
}

function Recent({ user, data, gradeName, onChanged }: { user: User; data: { recentCollections: Entry[]; recentSorts: Entry[] }; gradeName: (id?: string) => string; onChanged: () => void }) {
  const rows = [...data.recentCollections.map((r) => ({ ...r, kind: "collection" as const })), ...data.recentSorts.map((r) => ({ ...r, kind: "sort" as const }))]
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const [edit, setEdit] = useState<string | null>(null); const [w, setW] = useState(""); const [reason, setReason] = useState(""); const [err, setErr] = useState("");
  const act = async (r: (typeof rows)[number], voidIt: boolean) => {
    setErr("");
    try { await yardCall("correct", { staff_id: user.id, kind: r.kind, id: r.id, weight_kg: Number(w), void: voidIt, reason }); setEdit(null); onChanged(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold">My recent entries</h2>
      {rows.length === 0 && <p className="text-muted-foreground">No entries in the last 7 days.</p>}
      {rows.map((r) => (
        <div key={r.id} className={cn("rounded-2xl border bg-card p-4", r.is_voided && "opacity-50 line-through")}>
          <div className="flex justify-between text-lg"><span className="font-semibold">{r.kind === "collection" ? "Collection" : gradeName(r.grade_id)}</span><span className="font-bold">{kg(Number(r.weight_kg))}</span></div>
          <p className="text-muted-foreground">{new Date(r.recorded_at).toLocaleDateString("en-GB")} {time(r.recorded_at)} · {r.staff_name}</p>
          {!r.is_voided && Date.now() - new Date(r.created_at).getTime() < 24 * 3600e3 && (edit === r.id ? (
            <div className="mt-3 space-y-2">
              <Input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder="Correct weight (kg)" className="h-14 text-xl" />
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="h-12" />
              {err && <p className="text-destructive">{err}</p>}
              <div className="grid grid-cols-3 gap-2">
                <Button className="h-12" disabled={!(Number(w) > 0)} onClick={() => act(r, false)}>Save</Button>
                <Button variant="destructive" className="h-12" onClick={() => act(r, true)}>Remove</Button>
                <Button variant="outline" className="h-12" onClick={() => setEdit(null)}>Cancel</Button>
              </div>
            </div>
          ) : <Button variant="outline" className="mt-3 h-12 w-full" onClick={() => { setEdit(r.id); setW(String(r.weight_kg)); setReason(""); }}>Correct mistake</Button>)}
        </div>
      ))}
    </div>
  );
}
