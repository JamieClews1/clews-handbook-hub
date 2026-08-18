import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Loader2, FileText } from "lucide-react";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Site = {
  id: string;
  site_name: string;
  data_hub_customer: string | null;
  data_hub_site: string | null;
  data_hub_site_2: string | null;
  data_hub_site_3: string | null;
  data_hub_site_4: string | null;
  data_hub_site_5: string | null;
};

type JobRow = {
  id: string;
  job_date: string;
  job_number: string;
  site: string | null;
  container_type: string | null;
  waste_description: string | null;
};

const ALL_SITES = "__all__";

interface Props {
  customerId: string;
  customerName: string;
  accessibleSiteIds?: string[];
}

export function CustomerPortalPods({ customerId, accessibleSiteIds }: Props) {
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(ALL_SITES);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [podJobs, setPodJobs] = useState<Set<string>>(new Set());
  const [wtnJobs, setWtnJobs] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadSites = async () => {
      const cols =
        "id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5";
      if (accessibleSiteIds) {
        if (!accessibleSiteIds.length) {
          setSites([]);
          return;
        }
        const { data } = await supabase.from("customer_sites").select(cols).in("id", accessibleSiteIds).order("site_name");
        setSites((data as Site[]) ?? []);
        return;
      }
      const { data } = await supabase.from("customer_sites").select(cols).eq("customer_id", customerId).order("site_name");
      setSites((data as Site[]) ?? []);
    };
    loadSites();
  }, [customerId, accessibleSiteIds]);

  const load = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    try {
      const scoped = selectedSiteId === ALL_SITES ? sites : sites.filter((s) => s.id === selectedSiteId);
      const siteNames = Array.from(
        new Set(
          scoped
            .flatMap((s) => [s.data_hub_site, s.data_hub_site_2, s.data_hub_site_3, s.data_hub_site_4, s.data_hub_site_5])
            .filter(Boolean) as string[]
        )
      );
      const customerNames = Array.from(new Set(scoped.map((s) => s.data_hub_customer).filter(Boolean) as string[]));

      if (!siteNames.length && !customerNames.length) {
        setJobs([]);
        setPodJobs(new Set());
        setWtnJobs(new Set());
        setLoaded(true);
        return;
      }

      let query = supabase
        .from("data_hub_jobs")
        .select("id, job_date, job_number, site, container_type, waste_description")
        .gte("job_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("job_date", format(dateRange.to, "yyyy-MM-dd"))
        .order("job_date", { ascending: false })
        .limit(2000);

      if (customerNames.length) query = query.in("customer", customerNames);
      if (siteNames.length) query = query.in("site", siteNames);

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data as JobRow[]) ?? [];
      setJobs(rows);

      const jobNumbers = Array.from(new Set(rows.map((r) => r.job_number).filter(Boolean)));
      if (jobNumbers.length) {
        const { data: lookup } = await supabase.functions.invoke("pod-lookup", { body: { job_numbers: jobNumbers } });
        setPodJobs(new Set<string>((lookup?.available ?? []).map(String)));
        setWtnJobs(new Set<string>((lookup?.wtn_available ?? []).map(String)));
      } else {
        setPodJobs(new Set());
        setWtnJobs(new Set());
      }
      setLoaded(true);
    } catch (e: any) {
      toast({ title: "Failed to load PODs", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sites.length && !loaded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites]);

  const download = async (jobNumber: string, source: "pod" | "wtn") => {
    setDownloading(`${source}-${jobNumber}`);
    try {
      const { data, error } = await supabase.functions.invoke("pod-lookup", {
        body: { job_number: jobNumber, source },
      });
      if (error) throw error;
      if (!data?.url) {
        toast({ title: "Not found", description: `No document for job ${jobNumber}.`, variant: "destructive" });
        return;
      }
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.file_name ?? `${source.toUpperCase()}-${jobNumber}.pdf`;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const withDocs = jobs.filter((j) => podJobs.has(j.job_number) || wtnJobs.has(j.job_number));
    if (!term) return withDocs;
    return withDocs.filter((j) =>
      [j.job_number, j.site, j.waste_description, j.container_type].some((v) => (v ?? "").toLowerCase().includes(term))
    );
  }, [jobs, podJobs, wtnJobs, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Site</Label>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SITES}>All sites</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.site_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Date range</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-64 justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                  : "Pick dates"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <Label>Search</Label>
          <Input
            className="w-56"
            placeholder="Job no, site, waste..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Load documents
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading documents...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
          No proof of delivery documents found for this period.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Job No.</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Container</TableHead>
                <TableHead>Waste Type</TableHead>
                <TableHead className="text-center">POD</TableHead>
                <TableHead className="text-center">Ticket (PDA)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>{job.job_date ? format(new Date(job.job_date), "dd/MM/yyyy") : "-"}</TableCell>
                  <TableCell className="font-mono text-sm">{job.job_number}</TableCell>
                  <TableCell>{job.site ?? "-"}</TableCell>
                  <TableCell>{job.container_type ?? "-"}</TableCell>
                  <TableCell>{job.waste_description ?? "-"}</TableCell>
                  <TableCell className="text-center">
                    {podJobs.has(job.job_number) ? (
                      <Button size="sm" variant="outline" onClick={() => download(job.job_number, "pod")} disabled={downloading === `pod-${job.job_number}`}>
                        {downloading === `pod-${job.job_number}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <Badge variant="secondary">-</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {wtnJobs.has(job.job_number) ? (
                      <Button size="sm" variant="outline" onClick={() => download(job.job_number, "wtn")} disabled={downloading === `wtn-${job.job_number}`}>
                        {downloading === `wtn-${job.job_number}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <Badge variant="secondary">-</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
