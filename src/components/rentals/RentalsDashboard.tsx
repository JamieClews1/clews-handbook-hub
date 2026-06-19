import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Mail, Settings2, CheckCircle2, Clock, History, FileCheck, Download, Filter, PackageCheck } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import * as XLSX from "xlsx";
import { useLiveJobsSettings } from "@/hooks/useLiveJobsSettings";
import { computeOverRentalBins, type OverRentalBin, type OverRentalJob } from "@/lib/overRental";

type Chase = {
  id: string;
  bin_key: string;
  chase_status: string;
  agreed_to_pay: boolean;
  agreed_amount: number | null;
  agreed_date: string | null;
  assigned_to: string | null;
  notes: string | null;
  collected: boolean;
  collection_ticket: string | null;
  collected_date: string | null;
};

type Profile = { id: string; full_name: string | null; email: string | null };
type ChaseEmail = { id: string; to_email: string; subject: string | null; created_at: string };

const STATUS_LABELS: Record<string, string> = {
  not_chased: "Not Chased",
  chased: "Chased",
  awaiting_reply: "Awaiting Reply",
  agreed: "Agreed",
  disputed: "Disputed",
  resolved: "Resolved",
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  not_chased: "secondary",
  chased: "default",
  awaiting_reply: "outline",
  agreed: "default",
  disputed: "destructive",
  resolved: "secondary",
};

export default function RentalsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings, loading: settingsLoading } = useLiveJobsSettings();

  const [jobs, setJobs] = useState<OverRentalJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [chases, setChases] = useState<Record<string, Chase>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});

  // dialogs
  const [manageBin, setManageBin] = useState<OverRentalBin | null>(null);
  const [emailBin, setEmailBin] = useState<OverRentalBin | null>(null);
  const [collectBin, setCollectBin] = useState<OverRentalBin | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      setJobsLoading(true);
      // Use the EXACT same data source and window as the Live Jobs / Over Rental
      // dashboard so the two stay perfectly in sync: last 12 months of skiptrak
      // movements, then computeOverRentalBins (the shared logic Live Jobs also uses).
      const since = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      const all: OverRentalJob[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("id,job_number,job_date,customer,site,container_type,movement_type,waste_description,vehicle_registration,ewc")
          .eq("source", "skiptrak")
          .gte("job_date", since)
          .in("movement_type", ["Deliver", "Exchange", "Collect", "Tip/Return"])
          .order("job_date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) { console.error(error); break; }
        all.push(...((data ?? []) as OverRentalJob[]));
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }
      setJobs(all);
      setJobsLoading(false);
    };
    fetchJobs();
  }, []);




  const fetchChases = async () => {
    const { data } = await supabase.from("rental_chases").select("*");
    const map: Record<string, Chase> = {};
    for (const c of (data ?? []) as Chase[]) map[c.bin_key] = c;
    setChases(map);
  };

  useEffect(() => {
    fetchChases();
    supabase.from("profiles").select("id,full_name,email").then(({ data }) => setProfiles((data ?? []) as Profile[]));
    // Build customer name -> email lookup
    (async () => {
      const [{ data: customers }, { data: contacts }] = await Promise.all([
        supabase.from("customers").select("id,customer_name,data_hub_customer,po_notification_email"),
        supabase.from("customer_contacts").select("customer_id,email"),
      ]);
      const emailByCustomerId: Record<string, string> = {};
      for (const ct of contacts ?? []) {
        if (ct.email && ct.customer_id && !emailByCustomerId[ct.customer_id]) {
          emailByCustomerId[ct.customer_id] = ct.email;
        }
      }
      const map: Record<string, string> = {};
      for (const c of customers ?? []) {
        const email = emailByCustomerId[c.id] || c.po_notification_email || "";
        if (!email) continue;
        if (c.customer_name) map[c.customer_name.toLowerCase().trim()] = email;
        if (c.data_hub_customer) map[c.data_hub_customer.toLowerCase().trim()] = email;
      }
      setEmailMap(map);
    })();
  }, []);

  const bins = useMemo(() => {
    if (settingsLoading) return [];
    // Exclude bins that staff have confirmed as collected (a real collection ticket
    // exists but the raw data couldn't be auto-matched — e.g. blank or mismatched site).
    return computeOverRentalBins(jobs, settings)
      .filter((b) => !chases[b.binKey]?.collected);
  }, [jobs, settings, settingsLoading, chases]);

  // ── Filters: category (Skip/RoRo) then size (container type) ──
  const [categoryFilter, setCategoryFilter] = useState<"all" | "skip" | "roro">("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");

  // Container types ("sizes") available for the chosen category
  const sizeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of bins) {
      if (categoryFilter !== "all" && b.category !== categoryFilter) continue;
      if (b.containerType) set.add(b.containerType);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [bins, categoryFilter]);

  const filteredBins = useMemo(() => {
    return bins.filter((b) => {
      if (categoryFilter !== "all" && b.category !== categoryFilter) return false;
      if (sizeFilter !== "all" && b.containerType !== sizeFilter) return false;
      return true;
    });
  }, [bins, categoryFilter, sizeFilter]);

  const stats = useMemo(() => {
    let chased = 0, agreed = 0, unchased = 0;
    for (const b of filteredBins) {
      const c = chases[b.binKey];
      if (!c || c.chase_status === "not_chased") unchased++;
      else if (c.agreed_to_pay) agreed++;
      else chased++;
    }
    return { total: filteredBins.length, chased, agreed, unchased };
  }, [filteredBins, chases]);

  const loading = jobsLoading || settingsLoading;

  function downloadExcel() {
    const rows = filteredBins.map((b) => {
      const c = chases[b.binKey];
      return {
        Customer: b.customer,
        Site: b.site,
        Type: b.category,
        "Container Type": b.containerType,
        "On-Site": b.netOnSite,
        "Days Over": b.daysSinceActivity ?? "",
        "Last Activity": b.lastActivityDate ? format(new Date(b.lastActivityDate), "dd MMM yyyy") : "",
        "Last Ticket": b.lastJobNumber ?? "",
        "Chase Status": c ? STATUS_LABELS[c.chase_status] ?? c.chase_status : "Not Chased",
        "Agreed To Pay": c?.agreed_to_pay ? "Yes" : "No",
        "Agreed Amount": c?.agreed_amount ?? "",
        Notes: c?.notes ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Over Rental");
    XLSX.writeFile(wb, `Rentals_Over_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} label="Over Rental" value={stats.total} tone="destructive" />
        <StatCard icon={Clock} label="Not Chased" value={stats.unchased} tone="muted" />
        <StatCard icon={Mail} label="Chasing" value={stats.chased} tone="primary" />
        <StatCard icon={CheckCircle2} label="Agreed To Pay" value={stats.agreed} tone="success" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Bins Over Free Rental ({filteredBins.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <RentalsInfoDialog settings={settings} binCount={bins.length} updateSetting={updateSetting} />
              <Button variant="outline" size="sm" onClick={downloadExcel} disabled={filteredBins.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Download Excel
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Every skip/RoRo on-site beyond the {settings.rental_free_days}-day free rental period. Chase customers and track who has agreed to pay.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={categoryFilter}
              onValueChange={(v) => { setCategoryFilter(v as "all" | "skip" | "roro"); setSizeFilter("all"); }}
            >
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="skip">Skip</SelectItem>
                <SelectItem value="roro">RoRo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sizes</SelectItem>
                {sizeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {(categoryFilter !== "all" || sizeFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter("all"); setSizeFilter("all"); }}>
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredBins.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              {bins.length === 0 ? "No bins are currently over the rental free period. 🎉" : "No bins match the selected filters."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead className="text-center">On-Site</TableHead>
                  <TableHead className="text-center">Days Over</TableHead>
                  <TableHead>Last Ticket</TableHead>
                  <TableHead>Chase Status</TableHead>
                  <TableHead>Pay</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBins.map((b) => {
                  const c = chases[b.binKey];
                  const assignee = c?.assigned_to ? profiles.find((p) => p.id === c.assigned_to) : null;
                  return (
                    <TableRow key={b.binKey} className="bg-destructive/5">
                      <TableCell className="font-medium">{b.customer}</TableCell>
                      <TableCell>{b.site}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{b.containerType}</Badge></TableCell>
                      <TableCell className="text-center"><Badge variant="default">{b.netOnSite}</Badge></TableCell>
                      <TableCell className="text-center"><Badge variant="destructive">{b.daysSinceActivity}d</Badge></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{b.lastJobNumber ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[c?.chase_status ?? "not_chased"]}>
                          {STATUS_LABELS[c?.chase_status ?? "not_chased"]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c?.agreed_to_pay
                          ? <Badge className="bg-green-600 hover:bg-green-600">Agreed{c.agreed_amount != null ? ` £${c.agreed_amount}` : ""}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {assignee ? (assignee.full_name || assignee.email) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" onClick={() => setEmailBin(b)}>
                            <Mail className="h-4 w-4 mr-1" /> Chase
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setCollectBin(b)} title="Mark as collected">
                            <PackageCheck className="h-4 w-4 mr-1" /> Collected
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setManageBin(b)}>
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {manageBin && (
        <ManageDialog
          bin={manageBin}
          chase={chases[manageBin.binKey]}
          profiles={profiles}
          userId={user?.id ?? null}
          onClose={() => setManageBin(null)}
          onSaved={() => { setManageBin(null); fetchChases(); }}
          toast={toast}
        />
      )}

      {emailBin && (
        <EmailDialog
          bin={emailBin}
          chase={chases[emailBin.binKey]}
          defaultEmail={emailMap[emailBin.customer.toLowerCase().trim()] ?? ""}
          freeDays={settings.rental_free_days}
          userId={user?.id ?? null}
          onClose={() => setEmailBin(null)}
          onSent={() => { setEmailBin(null); fetchChases(); }}
          toast={toast}
        />
      )}

      {collectBin && (
        <CollectDialog
          bin={collectBin}
          chase={chases[collectBin.binKey]}
          userId={user?.id ?? null}
          onClose={() => setCollectBin(null)}
          onSaved={() => { setCollectBin(null); fetchChases(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "destructive" | "muted" | "primary" | "success" }) {
  const color = tone === "destructive" ? "text-destructive" : tone === "success" ? "text-green-600" : tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium flex items-center gap-2 ${color}`}>
          <Icon className="h-4 w-4" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

async function ensureChase(bin: OverRentalBin, userId: string | null): Promise<string | null> {
  const { data: existing } = await supabase.from("rental_chases").select("id").eq("bin_key", bin.binKey).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from("rental_chases").insert({
    bin_key: bin.binKey,
    customer: bin.customer,
    site: bin.site,
    category: bin.category,
    container_type: bin.containerType,
    created_by: userId,
  }).select("id").single();
  if (error) { console.error(error); return null; }
  return data.id;
}

type CollectCandidate = { job_number: string; job_date: string | null; site: string | null; container_type: string | null };

function CollectDialog({ bin, chase, userId, onClose, onSaved, toast }: {
  bin: OverRentalBin; chase?: Chase; userId: string | null;
  onClose: () => void; onSaved: () => void; toast: ReturnType<typeof useToast>["toast"];
}) {
  const [ticket, setTicket] = useState(chase?.collection_ticket ?? "");
  const [date, setDate] = useState(chase?.collected_date ?? "");
  const [notes, setNotes] = useState(chase?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<CollectCandidate[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Find Skiptrak collection tickets that plausibly match this bin. Collections are
  // often logged with a blank or differently-spelled site, so we match on customer OR
  // site and (loosely) container type, newest first. Picking a ticket auto-fills the date.
  useEffect(() => {
    (async () => {
      setLoadingTickets(true);
      const { data } = await supabase
        .from("data_hub_jobs")
        .select("job_number,job_date,site,container_type,customer")
        .eq("source", "skiptrak")
        .eq("movement_type", "Collect")
        .or(`customer.ilike.${bin.customer},site.ilike.${bin.site}`)
        .order("job_date", { ascending: false })
        .limit(50);
      const rows = (data ?? []) as (CollectCandidate & { customer: string | null })[];
      // Prefer same container type, but keep all as fallback.
      const sameType = rows.filter((r) => (r.container_type ?? "").toLowerCase().trim() === bin.containerType.toLowerCase().trim());
      const list = (sameType.length ? sameType : rows).map(({ job_number, job_date, site, container_type }) => ({ job_number, job_date, site, container_type }));
      setCandidates(list);
      // Auto-select the most recent matching collection if nothing recorded yet.
      if (!chase?.collection_ticket && list.length) {
        setTicket(list[0].job_number);
        setDate(list[0].job_date ?? "");
      } else if (!chase?.collected_date && chase?.collection_ticket) {
        const found = list.find((l) => l.job_number === chase.collection_ticket);
        if (found?.job_date) setDate(found.job_date);
      }
      setLoadingTickets(false);
    })();
  }, [bin.customer, bin.site, bin.containerType, chase?.collection_ticket, chase?.collected_date]);

  const onPickTicket = (jobNumber: string) => {
    setTicket(jobNumber);
    const found = candidates.find((c) => c.job_number === jobNumber);
    if (found?.job_date) setDate(found.job_date);
  };

  const save = async () => {
    setSaving(true);
    const id = await ensureChase(bin, userId);
    if (!id) { setSaving(false); toast({ title: "Failed to save", variant: "destructive" }); return; }
    const { error } = await supabase.from("rental_chases").update({
      collected: true,
      collection_ticket: ticket.trim() || null,
      collected_date: date || null,
      chase_status: "resolved",
      notes: notes.trim() || null,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast({ title: "Failed to save", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Marked as collected", description: "Removed from the over-rental list." });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Collected</DialogTitle>
          <DialogDescription>{bin.customer} — {bin.site} ({bin.containerType})</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Pick the Skiptrak collection ticket — the collection date is filled in automatically from that ticket. The bin will drop off the over-rental list.
          </p>
          <div className="space-y-1.5">
            <Label>Skiptrak Collection Ticket</Label>
            {loadingTickets ? (
              <Skeleton className="h-10 w-full" />
            ) : candidates.length > 0 ? (
              <Select value={ticket} onValueChange={onPickTicket}>
                <SelectTrigger><SelectValue placeholder="Select a collection ticket" /></SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.job_number} value={c.job_number}>
                      #{c.job_number} · {c.job_date ? format(new Date(c.job_date), "dd MMM yyyy") : "no date"}
                      {c.container_type ? ` · ${c.container_type}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">No matching Skiptrak collection ticket found — enter one manually below.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ticket / Job No.</Label>
              <Input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="e.g. 44222" />
            </div>
            <div className="space-y-1.5">
              <Label>Collection Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            <PackageCheck className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Confirm Collected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageDialog({ bin, chase, profiles, userId, onClose, onSaved, toast }: {
  bin: OverRentalBin; chase?: Chase; profiles: Profile[]; userId: string | null;
  onClose: () => void; onSaved: () => void; toast: ReturnType<typeof useToast>["toast"];
}) {
  const [status, setStatus] = useState(chase?.chase_status ?? "not_chased");
  const [agreed, setAgreed] = useState(chase?.agreed_to_pay ?? false);
  const [amount, setAmount] = useState(chase?.agreed_amount != null ? String(chase.agreed_amount) : "");
  const [agreedDate, setAgreedDate] = useState(chase?.agreed_date ?? "");
  const [assignedTo, setAssignedTo] = useState(chase?.assigned_to ?? "unassigned");
  const [notes, setNotes] = useState(chase?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ChaseEmail[]>([]);

  useEffect(() => {
    if (chase?.id) {
      supabase.from("rental_chase_emails").select("id,to_email,subject,created_at").eq("chase_id", chase.id).order("created_at", { ascending: false })
        .then(({ data }) => setHistory((data ?? []) as ChaseEmail[]));
    }
  }, [chase?.id]);

  const save = async () => {
    setSaving(true);
    const id = await ensureChase(bin, userId);
    if (!id) { setSaving(false); toast({ title: "Failed to save", variant: "destructive" }); return; }
    const { error } = await supabase.from("rental_chases").update({
      chase_status: status,
      agreed_to_pay: agreed,
      agreed_amount: amount ? Number(amount) : null,
      agreed_date: agreedDate || null,
      assigned_to: assignedTo === "unassigned" ? null : assignedTo,
      notes: notes.trim() || null,
    }).eq("id", id);
    setSaving(false);
    if (error) { toast({ title: "Failed to save", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Chase updated" });
    onSaved();
  };

  const promoteToAgreement = async () => {
    const { error } = await supabase.from("rental_agreements").insert({
      customer: bin.customer,
      site: bin.site,
      container_type: bin.containerType,
      agreed_rate: amount ? Number(amount) : null,
      start_date: agreedDate || null,
      status: "active",
      source: "promoted",
      chase_id: chase?.id ?? null,
      created_by: userId,
    });
    if (error) { toast({ title: "Failed to create agreement", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Rental agreement created", description: "Added to Confirmed Rental Agreements." });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Rental Chase</DialogTitle>
          <DialogDescription>{bin.customer} — {bin.site} ({bin.containerType})</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Chase Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Agreed to pay</Label>
              <p className="text-xs text-muted-foreground">Customer has accepted rental charges</p>
            </div>
            <Switch checked={agreed} onCheckedChange={setAgreed} />
          </div>

          {agreed && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Agreed Amount (£)</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Agreed Date</Label>
                <Input type="date" value={agreedDate} onChange={(e) => setAgreedDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {agreed && (
            <Button variant="outline" className="w-full" onClick={promoteToAgreement}>
              <FileCheck className="h-4 w-4 mr-2" /> Create Confirmed Rental Agreement
            </Button>
          )}

          {history.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><History className="h-4 w-4" /> Chase Email History</Label>
              <div className="space-y-1 text-xs">
                {history.map((h) => (
                  <div key={h.id} className="flex justify-between rounded border p-2">
                    <span className="truncate">{h.subject || "(no subject)"} → {h.to_email}</span>
                    <span className="text-muted-foreground whitespace-nowrap ml-2">{format(new Date(h.created_at), "dd MMM yyyy")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmailDialog({ bin, chase, defaultEmail, freeDays, userId, onClose, onSent, toast }: {
  bin: OverRentalBin; chase?: Chase; defaultEmail: string; freeDays: number; userId: string | null;
  onClose: () => void; onSent: () => void; toast: ReturnType<typeof useToast>["toast"];
}) {
  const [to, setTo] = useState(defaultEmail);
  const [subject, setSubject] = useState(`Container rental notice — ${bin.site}`);
  const [body, setBody] = useState(
    `Dear ${bin.customer},\n\n` +
    `Our records show a ${bin.containerType} container has been on site at ${bin.site} for ${bin.daysSinceActivity} days, which is beyond the ${freeDays}-day free rental period.\n\n` +
    `Rental charges now apply for this container. Please arrange a collection or exchange, or contact us to confirm how you would like to proceed.\n\n` +
    `If you would like the container to remain on site, please reply to confirm acceptance of the rental charges.\n\n` +
    `Kind regards,\nClews Recycling`
  );
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!to.trim()) { toast({ title: "Recipient email required", variant: "destructive" }); return; }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-rental-chase-email", {
        body: { to: to.trim(), subject, body, customer: bin.customer, site: bin.site },
      });
      if (error) throw error;

      const chaseId = await ensureChase(bin, userId);
      if (chaseId) {
        await supabase.from("rental_chase_emails").insert({
          chase_id: chaseId, to_email: to.trim(), subject, body, sent_by: userId,
        });
        // Move to "chased" unless already further along
        if (!chase || chase.chase_status === "not_chased") {
          await supabase.from("rental_chases").update({ chase_status: "chased" }).eq("id", chaseId);
        }
      }
      toast({ title: "Chase email sent", description: `Sent to ${to.trim()}` });
      onSent();
    } catch (e: any) {
      toast({ title: "Failed to send", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chase Rental by Email</DialogTitle>
          <DialogDescription>{bin.customer} — {bin.site} ({bin.containerType})</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" />
            {!defaultEmail && <p className="text-xs text-muted-foreground">No saved contact email found — enter one above.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={sending}>
            <Mail className="h-4 w-4 mr-1" /> {sending ? "Sending…" : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
