import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import { StandardContainer } from "@/components/containers/ContainerRef";
import { standardContainerName } from "@/lib/container-standard";
import { formatEwc, standardWasteName } from "@/lib/waste-streams";
import { format, startOfMonth, subMonths } from "date-fns";
import { ArrowLeft, ArrowDown, ArrowUp, Search, History, Loader2, Package, ArrowRightLeft, Truck, CheckCircle2, Clock, GanttChart, List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentSiteContainers, HISTORY_FIELDS, HISTORY_ORDER_FIELDS, siteHistorySearchFilters, historySiteIdentity, historySourceLabel, historyStatus, historyOrderNumber, jobWeightTonnes, mergeMappedSites, siteBinHistories, type HistorySource, type HistoryJob, type HistoryOrder, type LinkedTicket, type SiteMapping, type SiteSearchResult } from "@/lib/site-history";
import SiteBinHistoryList from "./SiteBinHistoryList";
import SiteHistoryTimeline from "./SiteHistoryTimeline";
import { londonCalendarKey } from "@/lib/ui-calendar";
import { parseLoadReportDate } from "@/lib/load-report-dates";
import type { StandingBinRule } from "@/lib/standing-bins";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

type SiteResult = SiteSearchResult;
type MappedSite = SiteMapping;
type HistoryRow = HistoryJob & HistoryOrder;
const FULL_FIELDS = `${HISTORY_FIELDS},${HISTORY_ORDER_FIELDS}`;
const sel = (s: string): string => s;
/** One automatic retry absorbs a momentary connection or database hiccup before showing an error. */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch { await new Promise(r => setTimeout(r, 900)); return run(); }
}
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
  const [source, setSource] = useState<HistorySource>("skiptrak");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SiteResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SiteResult | null>(null);
  const [jobs, setJobs] = useState<HistoryRow[]>([]);
  const [linked, setLinked] = useState<Map<string, LinkedTicket[]>>(new Map());
  const [showCleared, setShowCleared] = useState(false);
  const [rules, setRules] = useState<StandingBinRule[]>([]);
  const [ownKeys, setOwnKeys] = useState<Set<string>>(new Set());
  const [ticket, setTicket] = useState<HistoryRow | null>(null);
  const [container, setContainer] = useState("all");
  const [movement, setMovement] = useState("all");
  const [oldestFirst, setOldestFirst] = useState(false);
  const [visible, setVisible] = useState(100);
  const [view, setView] = useState<"list" | "timeline">("list");
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
      source: "skiptrak",
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
      const filters = siteHistorySearchFilters(term);
      const [rows, mappings] = await Promise.all([
        withRetry(async () => {
          const { data, error } = await supabase.rpc("search_site_history_ranked", { p_term: term, p_source: source });
          if (error) throw error;
          return (data ?? []) as (Pick<HistoryJob,"customer"|"site"|"postcode"|"address"|"address2"|"address3"> & { job_count?: number })[];
        }),
        // Saved site links only combine names; if they can't load, still show the matching sites.
        source === "skiptrak" ? withRetry(() => readPages<MappedSite>((from,to) => supabase.from("customer_sites").select("site_name,data_hub_customer,data_hub_site,data_hub_site_2,data_hub_site_3,data_hub_site_4,data_hub_site_5,address_1,address_2,postcode").or(filters.mappings).order("id").range(from,to))).catch(() => [] as MappedSite[]) : Promise.resolve([] as MappedSite[]),
      ]);
      const found = new Map<string, SiteResult>();
      for (const j of rows) {
        const identity = historySiteIdentity(j, source);
        if (!identity) continue;
        const { key } = identity;
        const result = found.get(key) ?? { key, source, site:identity.site, customers:[], names:j.site ? [j.site] : [], address:[j.address,j.address2,j.address3].filter(Boolean).join(", "), postcode:j.postcode ?? "" };
        if (j.customer && !result.customers.includes(j.customer)) result.customers.push(j.customer);
        result.address ||= [j.address,j.address2,j.address3].filter(Boolean).join(", ");
        result.postcode ||= j.postcode ?? "";
        result.jobCount = (result.jobCount ?? 0) + Number(j.job_count ?? 0);
        found.set(key,result);
      }
      const sites = mergeMappedSites(found, mappings, source);
      if (id === request.current) setResults([...sites.values()].sort((a,b)=>(b.jobCount??0)-(a.jobCount??0) || a.site.localeCompare(b.site)));
    } catch { if (id === request.current) setError("Site search could not be completed. Please try again."); }
    finally { if (id === request.current) setBusy(false); }
  };
  const openSite = async (site: SiteResult) => {
    const id = ++request.current;
    setSelected(site);setJobs([]);setLinked(new Map());setShowCleared(false);setBusy(true);setError(null);setContainer("all");setMovement("all");setVisible(100);
    try {
      if (site.source === "midweigh") {
        const history = await withRetry(() => readPages<HistoryRow>((from,to) => {
          let read = supabase.from("data_hub_jobs").select(sel(FULL_FIELDS)).eq("source", "midweigh").in("customer", site.customers);
          read = site.names.length ? read.in("site", site.names) : read.is("site", null);
          return read.order("job_date", {ascending:false}).order("id").range(from,to);
        }));
        if (id !== request.current) return;
        setJobs(history); setRules([]); setOwnKeys(new Set());
        return;
      }
      const [history, standing, own] = await Promise.all([
        withRetry(() => readPages<HistoryRow>((from,to)=>supabase.from("data_hub_jobs").select(sel(FULL_FIELDS)).eq("source","skiptrak").in("site",site.names).order("job_date",{ascending:false}).order("id").range(from,to))),
        supabase.from("site_standing_bins").select("id,customer,site,container_type,ewc,bin_count,active,notes").eq("active",true).in("site",site.names),
        supabase.from("rental_chases").select("bin_key").eq("own_skip",true),
      ]);
      if (standing.error || own.error) throw new Error("Current containers unavailable");
      if (id !== request.current) return;
      setJobs(history);setRules((standing.data ?? []) as StandingBinRule[]);setOwnKeys(new Set((own.data ?? []).map(r=>r.bin_key)));
      void loadLinkedTickets(id, [...new Set(history.map(j=>j.job_number).filter(Boolean))]);
    } catch { if(id===request.current) setError("The full site history could not be loaded. Please try again."); }
    finally { if(id===request.current) setBusy(false); }
  };
  // Weighbridge tickets recorded against each skip job; extra evidence only, so a failure leaves the orders visible.
  const loadLinkedTickets = async (id: number, jobNumbers: string[]) => {
    const map = new Map<string, LinkedTicket[]>();
    try {
      for (let i = 0; i < jobNumbers.length; i += 150) {
        const { data, error } = await supabase.from("data_hub_jobs").select("id,job_number,job_date,weight_t,linked_skip_job").eq("source","midweigh").in("linked_skip_job", jobNumbers.slice(i, i + 150));
        if (error) throw error;
        for (const t of data ?? []) {
          if (!t.linked_skip_job) continue;
          const list = map.get(t.linked_skip_job) ?? [];
          list.push({ id: t.id, job_number: t.job_number, job_date: t.job_date, weight_kg: t.weight_t == null ? null : Number(t.weight_t) });
          map.set(t.linked_skip_job, list);
        }
      }
      if (id === request.current) setLinked(map);
    } catch { /* tickets are optional detail */ }
  };
  const current = useMemo(()=>currentSiteContainers(jobs,rules,settings,since,today),[jobs,rules,settings,since,today]);
  const bins = useMemo(()=>siteBinHistories(jobs,current),[jobs,current]);
  const onSiteBins = bins.filter(b=>b.onSite>0), clearedBins = bins.filter(b=>b.onSite===0);
  const isOwn = (site: string, container: string) => ownKeys.has(`${site.toLowerCase().trim()}|||${container.toLowerCase().trim()}`) || selected?.names.some(n=>ownKeys.has(`${n.toLowerCase().trim()}|||${container.toLowerCase().trim()}`)) === true;
  const timeline = useMemo(()=>jobs.filter(j=>(container==="all"||j.container_type===container)&&(movement==="all"||j.movement_type===movement)).sort((a,b)=>oldestFirst ? (a.job_date??"").localeCompare(b.job_date??"") : (b.job_date??"").localeCompare(a.job_date??"")),[jobs,container,movement,oldestFirst]);

  return <section className="space-y-6" aria-label="Site history">
    <ToggleGroup type="single" value={source} variant="outline" className="justify-start" aria-label="Customer service" onValueChange={value=>{
      if (value !== "skiptrak" && value !== "midweigh") return;
      ++request.current; setSource(value); setSelected(null); setResults([]); setSearched(false); setError(null); setBusy(false); setTicket(null);
    }}>
      <ToggleGroupItem value="skiptrak"><Package className="mr-2 h-4 w-4"/>Skip customers</ToggleGroupItem>
      <ToggleGroupItem value="midweigh"><Truck className="mr-2 h-4 w-4"/>Weighbridge customers</ToggleGroupItem>
    </ToggleGroup>
    <form onSubmit={e=>{e.preventDefault();void search();}} className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-56 max-w-2xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Company, site address or postcode" placeholder="Company, site address or postcode" value={query} onChange={e=>setQuery(e.target.value)} className="pl-9"/></div>
      <Button type="submit" disabled={busy}><Search className="mr-2 h-4 w-4"/>Search</Button>
    </form>
    {error && <div role="alert" className="flex items-center gap-3 text-destructive"><span>{error}</span><Button variant="outline" onClick={()=>selected?void openSite(selected):void search()}>Try again</Button></div>}
    {busy && <div role="status" className="flex gap-2 items-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin"/>{selected ? "Loading complete site history…" : "Searching sites…"}</div>}
    {!busy && !selected && searched && !error && <div><h2 className="text-lg font-semibold mb-3">Sites <span className="text-muted-foreground">({results.length})</span></h2>{results.length===0 ? <p className="text-muted-foreground">No sites found.</p> : <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Company</TableHead><TableHead>Site</TableHead><TableHead>Address</TableHead><TableHead>Postcode</TableHead><TableHead className="text-right">Jobs</TableHead><TableHead/></TableRow></TableHeader><TableBody>{results.map(s=><TableRow key={s.key}><TableCell><Badge variant="outline">{historySourceLabel(s.source)}</Badge></TableCell><TableCell>{s.customers.join(" / ") || "—"}</TableCell><TableCell className="font-medium">{s.site}</TableCell><TableCell>{s.address || "—"}</TableCell><TableCell className="whitespace-nowrap">{s.postcode || "—"}</TableCell><TableCell className="text-right tabular-nums">{s.jobCount ?? 0}</TableCell><TableCell><Button variant="outline" size="sm" onClick={()=>void openSite(s)}><History className="mr-2 h-4 w-4"/>History</Button></TableCell></TableRow>)}</TableBody></Table>}</div>}
    {selected && !busy && !error && <>
      <div className="flex flex-wrap gap-4 items-start"><Button variant="ghost" size="icon" aria-label="Back to search results" onClick={()=>setSelected(null)}><ArrowLeft className="h-5 w-5"/></Button><div><h2 className="text-xl font-semibold">{selected.site}</h2><Badge variant="outline">{historySourceLabel(selected.source)}</Badge><p className="text-muted-foreground text-sm">{selected.customers.join(" / ")}</p><p className="text-muted-foreground text-sm">{[selected.address,selected.postcode].filter(Boolean).join(", ")}</p></div></div>
      {selected.source === "skiptrak" && <div className="border-y border-border py-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-baseline"><h3 className="font-semibold">On site now</h3><span className="text-2xl font-semibold tabular-nums">{current.reduce((n,t)=>n+t.count,0)}</span><span className="text-sm text-muted-foreground">Estimated from Live Jobs · {dateLabel(today)} · open a bin to see every order and ticket</span></div>
        {onSiteBins.length===0 ? <p className="text-muted-foreground">No containers currently identified on site.</p> : <SiteBinHistoryList key={`on:${selected.key}`} bins={onSiteBins} today={today} linked={linked} isOwn={isOwn} dateLabel={dateLabel} onOpenJob={setTicket} defaultOpen={onSiteBins.length<=3}/>}
        {clearedBins.length>0 && <div className="space-y-3 pt-2">
          <Button variant="outline" onClick={()=>setShowCleared(v=>!v)} aria-expanded={showCleared}>{showCleared?"Hide":"Show"} previous bins ({clearedBins.length})</Button>
          {showCleared && <SiteBinHistoryList key={`off:${selected.key}`} bins={clearedBins} today={today} linked={linked} isOwn={isOwn} dateLabel={dateLabel} onOpenJob={setTicket}/>}
        </div>}
      </div>}
      <div className="space-y-4"><div className="flex flex-wrap gap-3 items-center"><h3 className="font-semibold mr-auto">Full timeline <span className="text-muted-foreground">({timeline.length} jobs)</span></h3>{selected.source === "skiptrak" && <ToggleGroup type="single" variant="outline" value={view} onValueChange={v=>{ if (v==="list"||v==="timeline") setView(v); }} aria-label="Timeline view"><ToggleGroupItem value="list"><List className="mr-2 h-4 w-4"/>List</ToggleGroupItem><ToggleGroupItem value="timeline"><GanttChart className="mr-2 h-4 w-4"/>Timeline</ToggleGroupItem></ToggleGroup>}<Select value={container} onValueChange={v=>{setContainer(v);setVisible(100);}}><SelectTrigger className="w-48" aria-label="Filter container"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All containers</SelectItem>{[...new Set(jobs.map(j=>j.container_type).filter((v):v is string=>Boolean(v)))].sort().map(v=><SelectItem key={v} value={v}>{standardContainerName(v) !== v ? `${standardContainerName(v)} (${v})` : v}</SelectItem>)}</SelectContent></Select><Select value={movement} onValueChange={v=>{setMovement(v);setVisible(100);}}><SelectTrigger className="w-44" aria-label="Filter movement"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All movements</SelectItem>{[...new Set(jobs.map(j=>j.movement_type).filter((v):v is string=>Boolean(v)))].sort().map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>{(view === "list" || selected.source !== "skiptrak") && <Button variant="outline" onClick={()=>setOldestFirst(v=>!v)}>{oldestFirst?<ArrowUp className="mr-2 h-4 w-4"/>:<ArrowDown className="mr-2 h-4 w-4"/>}{oldestFirst?"Oldest first":"Newest first"}</Button>}</div>
      <p className="text-xs text-muted-foreground">{selected.source === "skiptrak" ? "All retained Skip history · bookings are separate from completed movements" : "All retained Weighbridge tickets · site shown only where recorded"}</p>
      {view === "timeline" && selected.source === "skiptrak" ? <SiteHistoryTimeline bins={container === "all" ? bins : bins.filter(b => b.container === container)} today={today} isOwn={isOwn} movement={movement} onViewJob={j => setTicket(j as HistoryRow)} /> : <>
      <ol className="divide-y divide-border">{timeline.slice(0,visible).map(j=>{const status=historyStatus(j,today);const Icon=j.movement_type==="Deliver"?Package:j.movement_type==="Collect"?Truck:ArrowRightLeft;return <li key={`${j.source}:${j.id}`} className="flex gap-3 py-4"><div className="mt-1 rounded-md bg-muted p-2 h-fit"><Icon className="h-4 w-4 text-primary"/></div><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{j.movement_type || "Job"}</span><span className="text-sm">{dateLabel(j.job_date)}</span><Badge variant={status==="Completed"?"secondary":"outline"}>{status==="Completed"?<CheckCircle2 className="h-3 w-3 mr-1"/>:<Clock className="h-3 w-3 mr-1"/>}{status}</Badge></div><p className="text-sm mt-1"><StandardContainer recorded={j.container_type} /> · {(j.waste_description ? standardWasteName(j.waste_description, j.ewc, { source: j.source }) : "") || formatEwc(j.ewc) || "Waste not recorded"}</p><p className="text-xs text-muted-foreground mt-1">{[j.customer,formatEwc(j.ewc),historyOrderNumber(j)&&`Order ${historyOrderNumber(j)}`,(()=>{const t=jobWeightTonnes(j);return t!=null?`${t.toFixed(2)} t`:null;})(),(linked.get(j.job_number)??[]).map(t=>`Ticket #${t.job_number}`).join(", ")||null,j.driver,j.vehicle_registration].filter(Boolean).join(" · ")}</p></div><Button variant="outline" size="sm" aria-label={`View job ${j.job_number}`} onClick={()=>setTicket(j)}>#{j.job_number}</Button></li>;})}</ol>
      {timeline.length===0 && <p className="text-muted-foreground">No jobs found for this selection.</p>}{visible<timeline.length && <Button variant="outline" onClick={()=>setVisible(n=>n+100)}>Show more ({timeline.length-visible} remaining)</Button>}</>}</div>
    </>}
    <Dialog open={Boolean(ticket)} onOpenChange={open=>{if(!open)setTicket(null);}}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Job {ticket?.job_number}</DialogTitle><DialogDescription>{ticket?.source} · {dateLabel(ticket?.job_date ?? null)}</DialogDescription></DialogHeader>{ticket&&<dl className="grid grid-cols-2 gap-4 text-sm">{([["Company",ticket.customer],["Site",ticket.site],["Movement",ticket.movement_type],["Status",historyStatus(ticket,today)],["Container",ticket.container_type ? <StandardContainer recorded={ticket.container_type} /> : null],["Container recorded as",ticket.container_type && standardContainerName(ticket.container_type) !== ticket.container_type ? ticket.container_type : null],["Waste",ticket.waste_description ? standardWasteName(ticket.waste_description, ticket.ewc, { source: ticket.source }) : null],["Recorded as",ticket.waste_description && standardWasteName(ticket.waste_description, ticket.ewc, { source: ticket.source }) !== ticket.waste_description ? ticket.waste_description : null],["EWC",formatEwc(ticket.ewc)],["Order no.",historyOrderNumber(ticket)],["Weight",(()=>{const t=jobWeightTonnes(ticket);return t!=null?`${t.toFixed(2)} t`:null;})()],["Weighbridge tickets",(linked.get(ticket.job_number)??[]).map(t=>`#${t.job_number}${t.weight_kg?` (${(t.weight_kg/1000).toFixed(2)} t)`:""}`).join(", ")||null],["Postcode",ticket.postcode],["Driver",ticket.driver],["Vehicle",ticket.vehicle_registration]] as [string, ReactNode][]).map(([label,value])=><div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium break-words">{value||"—"}</dd></div>)}</dl>}</DialogContent></Dialog>
  </section>;
}