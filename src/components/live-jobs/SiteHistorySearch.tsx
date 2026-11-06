import { useMemo, useRef, useState, useEffect } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { ArrowLeft, ArrowDown, ArrowUp, Search, History, Loader2, Package, ArrowRightLeft, Truck, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentSiteContainers, HISTORY_FIELDS, historyStatus, type HistoryJob } from "@/lib/site-history";
import { londonCalendarKey } from "@/lib/ui-calendar";
import { parseLoadReportDate } from "@/lib/load-report-dates";
import type { StandingBinRule } from "@/lib/standing-bins";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

type SiteResult = { key: string; site: string; customers: string[]; names: string[]; address: string; postcode: string };
type MappedSite = { site_name: string; data_hub_customer: string | null; data_hub_site: string | null; data_hub_site_2: string | null; data_hub_site_3: string | null; data_hub_site_4: string | null; data_hub_site_5: string | null; address_1: string | null; address_2: string | null; postcode: string | null };
const dateLabel = (value: string | null) => { const date = parseLoadReportDate(value); return date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "Undated"; };
async function readPages<T>(read: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await read(from, from + 499);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error("History could not be loaded");
    all.push(...data as T[]);
    if (data.length < 500) return all;
  }
}

type StartSite = { key: string; site: string; customer: string | null; postcode: string; address: string };

export default function SiteHistorySearch({ settings, startSite, onStartSiteHandled }: {
  settings: LiveJobsSettings;
  startSite?: StartSite | null;
  onStartSiteHandled?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SiteResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SiteResult | null>(null);
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [rules, setRules] = useState<StandingBinRule[]>([]);
  const [ownKeys, setOwnKeys] = useState<Set<string>>(new Set());
  const [ticket, setTicket] = useState<HistoryJob | null>(null);
  const [container, setContainer] = useState("all");
  const [movement, setMovement] = useState("all");
  const [oldestFirst, setOldestFirst] = useState(false);
  const [visible, setVisible] = useState(100);
  const request = useRef(0);
  const handledStart = useRef<string | null>(null);

  // Opened straight from a pin on the site map.
  useEffect(() => {
    if (!startSite) {
      handledStart.current = null;
      return;
    }
    if (handledStart.current === startSite.key) return;
    handledStart.current = startSite.key;
    void openSite({
      key: startSite.key,
      site: startSite.site,
      customers: startSite.customer ? [startSite.customer] : [],
      names: [startSite.site],
      address: startSite.address,
      postcode: startSite.postcode,
    });
    onStartSiteHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSite]);
  const today = londonCalendarKey();
  const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");

  const search = async () => {
    const term = query.trim().replace(/[,%_()"\\]/g, " ").trim();
    if (term.length < 3) { setError("Enter at least three characters."); return; }
    const id = ++request.current;
    setBusy(true); setError(null); setSelected(null); setResults([]); setSearched(true);
    try {
      const filter = `customer.ilike.%${term}%,site.ilike.%${term}%,postcode.ilike.%${term}%,raw->>Location Postc_1.ilike.%${term}%`;
      const [rows, mappings] = await Promise.all([
        readPages<HistoryJob>((from,to) => supabase.from("data_hub_jobs").select(HISTORY_FIELDS).eq("source","skiptrak").or(filter).order("id").range(from,to)),
        readPages<MappedSite>((from,to) => supabase.from("customer_sites").select("site_name,data_hub_customer,data_hub_site,data_hub_site_2,data_hub_site_3,data_hub_site_4,data_hub_site_5,address_1,address_2,postcode").or(`site_name.ilike.%${term}%,data_hub_customer.ilike.%${term}%,address_1.ilike.%${term}%,address_2.ilike.%${term}%,postcode.ilike.%${term}%`).order("id").range(from,to)),
      ]);
      const sites = new Map<string, SiteResult>();
      for (const j of rows) {
        if (!j.site) continue;
        const key = j.site.toLowerCase().trim();
        const result = sites.get(key) ?? { key, site:j.site, customers:[], names:[j.site], address:[j.address,j.address2,j.address3].filter(Boolean).join(", "), postcode:j.postcode ?? "" };
        if (j.customer && !result.customers.includes(j.customer)) result.customers.push(j.customer);
        sites.set(key,result);
      }
      for (const m of mappings) {
        const names = [m.site_name,m.data_hub_site,m.data_hub_site_2,m.data_hub_site_3,m.data_hub_site_4,m.data_hub_site_5].filter((n): n is string => Boolean(n));
        const existing = names.map(n=>sites.get(n.toLowerCase().trim())).find(Boolean);
        const result = existing ?? {key:m.site_name.toLowerCase().trim(),site:m.site_name,customers:m.data_hub_customer ? [m.data_hub_customer] : [],names,address:"",postcode:""};
        result.names = [...new Set([...result.names,...names])];
        result.address = [m.address_1,m.address_2].filter(Boolean).join(", ") || result.address;
        result.postcode = m.postcode || result.postcode;
        sites.set(result.key,result);
      }
      if (id === request.current) setResults([...sites.values()].sort((a,b)=>a.site.localeCompare(b.site)));
    } catch { if (id === request.current) setError("Site search could not be completed. Please try again."); }
    finally { if (id === request.current) setBusy(false); }
  };
  const openSite = async (site: SiteResult) => {
    const id = ++request.current;
    setSelected(site);setJobs([]);setBusy(true);setError(null);setContainer("all");setMovement("all");setVisible(100);
    try {
      const [history, standing, own] = await Promise.all([
        readPages<HistoryJob>((from,to)=>supabase.from("data_hub_jobs").select(HISTORY_FIELDS).eq("source","skiptrak").in("site",site.names).order("job_date",{ascending:false}).order("id").range(from,to)),
        supabase.from("site_standing_bins").select("id,customer,site,container_type,ewc,bin_count,active,notes").eq("active",true).in("site",site.names),
        supabase.from("rental_chases").select("bin_key").eq("own_skip",true),
      ]);
      if (standing.error || own.error) throw new Error("Current containers unavailable");
      if (id !== request.current) return;
      setJobs(history);setRules((standing.data ?? []) as StandingBinRule[]);setOwnKeys(new Set((own.data ?? []).map(r=>r.bin_key)));
    } catch { if(id===request.current) setError("The full site history could not be loaded. Please try again."); }
    finally { if(id===request.current) setBusy(false); }
  };
  const current = useMemo(()=>currentSiteContainers(jobs,rules,settings,since,today),[jobs,rules,settings,since,today]);
  const timeline = useMemo(()=>jobs.filter(j=>(container==="all"||j.container_type===container)&&(movement==="all"||j.movement_type===movement)).sort((a,b)=>oldestFirst ? (a.job_date??"").localeCompare(b.job_date??"") : (b.job_date??"").localeCompare(a.job_date??"")),[jobs,container,movement,oldestFirst]);

  return <section className="space-y-6" aria-label="Site history">
    <form onSubmit={e=>{e.preventDefault();void search();}} className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-56 max-w-2xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Company, site address or postcode" placeholder="Company, site address or postcode" value={query} onChange={e=>setQuery(e.target.value)} className="pl-9"/></div>
      <Button type="submit" disabled={busy}><Search className="mr-2 h-4 w-4"/>Search</Button>
    </form>
    {error && <div role="alert" className="flex items-center gap-3 text-destructive"><span>{error}</span><Button variant="outline" onClick={()=>selected?void openSite(selected):void search()}>Try again</Button></div>}
    {busy && <div role="status" className="flex gap-2 items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin"/>{selected ? "Loading complete site history…" : "Searching sites…"}</div>}
    {!busy && !selected && searched && !error && <div><h2 className="text-lg font-semibold mb-3">Sites <span className="text-muted-foreground">({results.length})</span></h2>{results.length===0 ? <p className="text-muted-foreground">No sites found.</p> : <Table><TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Site</TableHead><TableHead>Address</TableHead><TableHead>Postcode</TableHead><TableHead/></TableRow></TableHeader><TableBody>{results.map(s=><TableRow key={s.key}><TableCell>{s.customers.join(" / ") || "—"}</TableCell><TableCell className="font-medium">{s.site}</TableCell><TableCell>{s.address || "—"}</TableCell><TableCell className="whitespace-nowrap">{s.postcode || "—"}</TableCell><TableCell><Button variant="outline" size="sm" onClick={()=>void openSite(s)}><History className="mr-2 h-4 w-4"/>History</Button></TableCell></TableRow>)}</TableBody></Table>}</div>}
    {selected && !busy && !error && <>
      <div className="flex flex-wrap gap-4 items-start"><Button variant="ghost" size="icon" aria-label="Back to search results" onClick={()=>setSelected(null)}><ArrowLeft className="h-5 w-5"/></Button><div><h2 className="text-xl font-semibold">{selected.site}</h2><p className="text-muted-foreground text-sm">{selected.customers.join(" / ")}</p><p className="text-muted-foreground text-sm">{[selected.address,selected.postcode].filter(Boolean).join(", ")}</p></div></div>
      <div className="border-y border-border py-5 space-y-4"><div className="flex flex-wrap gap-3 items-baseline"><h3 className="font-semibold">On site now</h3><span className="text-2xl font-semibold tabular-nums">{current.reduce((n,t)=>n+t.count,0)}</span><span className="text-sm text-muted-foreground">Estimated from Live Jobs · {dateLabel(today)}</span></div>{current.length===0 ? <p className="text-muted-foreground">No containers currently identified on site.</p> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{current.map(t=>{const own=selected.names.some(n=>ownKeys.has(`${n.toLowerCase().trim()}|||${t.container.toLowerCase().trim()}`));return <div key={t.container} className="border border-border rounded-md p-4 bg-card"><div className="flex justify-between gap-2"><span className="font-semibold">{t.count} × {t.container}</span><Badge variant="outline">{own?"Own":"Clews"}</Badge></div><p className="text-sm text-muted-foreground mt-2">{t.wastes.join(" / ") || "Waste type not recorded"}</p></div>;})}</div>}</div>
      <div className="space-y-4"><div className="flex flex-wrap gap-3 items-center"><h3 className="font-semibold mr-auto">Full timeline <span className="text-muted-foreground">({timeline.length} jobs)</span></h3><Select value={container} onValueChange={v=>{setContainer(v);setVisible(100);}}><SelectTrigger className="w-48" aria-label="Filter container"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All containers</SelectItem>{[...new Set(jobs.map(j=>j.container_type).filter((v):v is string=>Boolean(v)))].sort().map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Select value={movement} onValueChange={v=>{setMovement(v);setVisible(100);}}><SelectTrigger className="w-44" aria-label="Filter movement"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All movements</SelectItem>{[...new Set(jobs.map(j=>j.movement_type).filter((v):v is string=>Boolean(v)))].sort().map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={()=>setOldestFirst(v=>!v)}>{oldestFirst?<ArrowUp className="mr-2 h-4 w-4"/>:<ArrowDown className="mr-2 h-4 w-4"/>}{oldestFirst?"Oldest first":"Newest first"}</Button></div>
      <p className="text-xs text-muted-foreground">All retained Skiptrak history · bookings are separate from completed movements</p>
      <ol className="divide-y divide-border">{timeline.slice(0,visible).map(j=>{const status=historyStatus(j,today);const Icon=j.movement_type==="Deliver"?Package:j.movement_type==="Collect"?Truck:ArrowRightLeft;return <li key={`${j.source}:${j.id}`} className="flex gap-3 py-4"><div className="mt-1 rounded-md bg-muted p-2 h-fit"><Icon className="h-4 w-4 text-primary"/></div><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{j.movement_type || "Job"}</span><span className="text-sm">{dateLabel(j.job_date)}</span><Badge variant={status==="Completed"?"secondary":"outline"}>{status==="Completed"?<CheckCircle2 className="h-3 w-3 mr-1"/>:<Clock className="h-3 w-3 mr-1"/>}{status}</Badge></div><p className="text-sm mt-1">{j.container_type || "No container recorded"} · {j.waste_description || j.ewc || "Waste not recorded"}</p><p className="text-xs text-muted-foreground mt-1">{[j.customer,j.ewc,j.driver,j.vehicle_registration].filter(Boolean).join(" · ")}</p></div><Button variant="outline" size="sm" aria-label={`View job ${j.job_number}`} onClick={()=>setTicket(j)}>#{j.job_number}</Button></li>;})}</ol>
      {timeline.length===0 && <p className="text-muted-foreground">No jobs found for this selection.</p>}{visible<timeline.length && <Button variant="outline" onClick={()=>setVisible(n=>n+100)}>Show more ({timeline.length-visible} remaining)</Button>}</div>
    </>}
    <Dialog open={Boolean(ticket)} onOpenChange={open=>{if(!open)setTicket(null);}}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Job {ticket?.job_number}</DialogTitle><DialogDescription>{ticket?.source} · {dateLabel(ticket?.job_date ?? null)}</DialogDescription></DialogHeader>{ticket&&<dl className="grid grid-cols-2 gap-4 text-sm">{[["Company",ticket.customer],["Site",ticket.site],["Movement",ticket.movement_type],["Status",historyStatus(ticket,today)],["Container",ticket.container_type],["Waste",ticket.waste_description],["EWC",ticket.ewc],["Postcode",ticket.postcode],["Driver",ticket.driver],["Vehicle",ticket.vehicle_registration]].map(([label,value])=><div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium break-words">{value||"—"}</dd></div>)}</dl>}</DialogContent></Dialog>
  </section>;
}