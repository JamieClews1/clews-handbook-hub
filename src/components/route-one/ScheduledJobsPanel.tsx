import { useEffect, useState } from "react";
import { Loader2, Repeat, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookingContainerLabel } from "@/lib/container-taxonomy";
import { formatEwc } from "@/lib/waste-streams";
import { londonCalendarKey } from "@/lib/ui-calendar";
import { nextScheduleDate, scheduleFrequencyLabel, type ScheduleRow } from "@/lib/route-job-schedules";
import { SiteContainersDialog, type ContainersSite } from "./SiteContainersDialog";
import { ScheduleEditorDialog, type ScheduleDraft } from "./ScheduleEditorDialog";
import { JOB_TYPE_LABELS } from "./JobFormFields";

const shortDate = (key: string | null) => key ? new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

/** Repeating jobs per site. Each schedule books its own unassigned jobs ahead; nothing else changes on the board. */
export function ScheduledJobsPanel({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ContainersSite[] | null>(null);
  const [site, setSite] = useState<ContainersSite | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [running, setRunning] = useState(false);
  const today = londonCalendarKey();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("route_one_job_schedules").select("*").order("active", { ascending: false }).order("customer_name").order("site_name");
    if (error) setError("Scheduled jobs could not be loaded."); else { setError(""); setRows((data ?? []) as ScheduleRow[]); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const changed = () => { void load(); onChanged?.(); };

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    const { data, error } = await supabase.rpc("search_recent_booking_sites", { p_query: query.trim(), p_limit: 20 });
    setSearching(false);
    if (error) { toast.error("Site search is unavailable. Try again."); return; }
    setResults((data ?? []).map(r => ({ customer: r.customer ?? "", site: r.site ?? "", address: r.address ?? "", postcode: r.postcode ?? "" })));
  };

  const bookNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("generate_route_one_scheduled_jobs", { p_schedule_id: null });
    setRunning(false);
    if (error) toast.error("Jobs could not be booked. Try again."); else toast.success(data ? `${data} job${data === 1 ? "" : "s"} booked` : "Everything is already booked");
    changed();
  };

  return <div className="space-y-6">
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Set up a schedule</h3>
      <p className="text-sm text-muted-foreground">Find the site, then choose Schedule on the bin or trailer that runs on a repeat.</p>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void search(); }}>
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Customer, site or postcode" aria-label="Find a site to schedule" />
        <Button type="submit" variant="outline" disabled={searching || query.trim().length < 2}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Find</Button>
      </form>
      {results && (results.length === 0 ? <p className="text-sm text-muted-foreground">No sites found.</p> :
        <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border" aria-label="Sites found">
          {results.map((r, i) => <li key={`${r.site}|${r.customer}|${i}`}>
            <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => setSite(r)}>
              <span className="font-medium">{r.site || r.customer}</span>
              <span className="block text-xs text-muted-foreground">{[r.customer, r.address, r.postcode].filter(Boolean).join(" · ")}</span>
            </button>
          </li>)}
        </ul>)}
    </section>

    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Schedules</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => void bookNow()} disabled={running || rows.every(r => !r.active)}>{running && <Loader2 className="h-4 w-4 animate-spin" />}Book due jobs now</Button>
      </div>
      <p className="text-xs text-muted-foreground">Running schedules book their next jobs every morning as unassigned jobs.</p>
      {loading ? <div role="status" className="flex items-center gap-2 py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading schedules…</div>
        : error ? <div role="alert" className="flex items-center gap-3 text-destructive">{error}<Button size="sm" variant="outline" onClick={() => void load()}>Try again</Button></div>
        : rows.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No scheduled jobs yet.</p>
        : <Table>
          <TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Job</TableHead><TableHead>Repeat</TableHead><TableHead>Next</TableHead><TableHead>Booked to</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => <TableRow key={r.id} className="cursor-pointer" onClick={() => setDraft({ ...r })}>
              <TableCell><span className="font-medium">{r.site_name || r.customer_name}</span><span className="block text-xs text-muted-foreground">{[r.customer_name !== r.site_name ? r.customer_name : null, r.site_postcode].filter(Boolean).join(" · ")}</span></TableCell>
              <TableCell className="text-sm">{JOB_TYPE_LABELS[r.job_type] ?? r.job_type.replace(/_/g, " ")} · {bookingContainerLabel(r.container_type, r.container_size)}<span className="block text-xs text-muted-foreground">{r.waste_type}{r.ewc_code ? ` · ${formatEwc(r.ewc_code)}` : ""}</span></TableCell>
              <TableCell className="whitespace-nowrap text-sm">{scheduleFrequencyLabel(r.interval_weeks)}</TableCell>
              <TableCell className="whitespace-nowrap text-sm tabular-nums">{r.active ? shortDate(nextScheduleDate(r, today)) : "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-sm tabular-nums">{shortDate(r.booked_until)}</TableCell>
              <TableCell>{r.active ? <Badge variant="secondary" className="gap-1"><Repeat className="h-3 w-3" />Running</Badge> : <Badge variant="outline">Paused</Badge>}</TableCell>
            </TableRow>)}
          </TableBody>
        </Table>}
    </section>

    <SiteContainersDialog site={site} onOpenChange={open => { if (!open) setSite(null); }} scheduleOnly onSchedulesChanged={changed} />
    <ScheduleEditorDialog draft={draft} onOpenChange={open => { if (!open) setDraft(null); }} onSaved={changed} />
  </div>;
}
