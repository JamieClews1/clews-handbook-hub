import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";
import DataHubAIChat from "@/components/data-hub/DataHubAIChat";
import DataHubAnalytics from "@/components/data-hub/DataHubAnalytics";

import { ArrowLeft, ArrowRight, Upload, Sparkles, Database, BarChart3 } from "lucide-react";

type DataSource = "skiptrak" | "midweigh";

type DataHubJobRow = {
  job_number: string;
  source: string;
  job_date?: string | null;
  customer?: string | null;
  site?: string | null;
  ewc?: string | null;
  waste_description?: string | null;
  category?: string | null;
  movement_type?: string | null;
  container_type?: string | null;
  weight_t?: number | null;
  vehicle_registration?: string | null;
  raw: Record<string, unknown>;
};

type ListedJob = {
  id: string;
  job_number: string;
  source: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  ewc: string | null;
  waste_description: string | null;
  category: string | null;
  movement_type: string | null;
  container_type: string | null;
  weight_t: number | null;
  vehicle_registration: string | null;
  updated_at: string;
};

type ExistingJobFields = {
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  ewc: string | null;
  waste_description: string | null;
  category: string | null;
  movement_type: string | null;
  container_type: string | null;
  weight_t: number | null;
  vehicle_registration: string | null;
};

function normalizeHeaderKey(key: unknown) {
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getFirstMatchingValue(row: Record<string, any>, candidates: string[]) {
  const normalized = new Map<string, any>();
  Object.keys(row).forEach((k) => normalized.set(normalizeHeaderKey(k), row[k]));
  for (const c of candidates) {
    const v = normalized.get(normalizeHeaderKey(c));
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function toCleanString(value: any): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function excelValueToISODate(value: any): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return d.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const s = value.trim();

    // If a date has been stored/formatted as an Excel serial number string, convert it.
    if (/^\d+(?:\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) return excelValueToISODate(n);
    }

    // Handle dd/mm/yyyy or dd-mm-yyyy common exports
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
      const d = new Date(Date.UTC(year, month - 1, day));
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  return null;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const DataUploadsPage = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const { toast } = useToast();

  const rawPreviewScrollRef = useRef<HTMLDivElement | null>(null);
  const [rawScrollLeft, setRawScrollLeft] = useState(0);
  const [rawScrollMax, setRawScrollMax] = useState(0);

  // Results table scroll is handled by the shadcn Table wrapper div (not the outer border container).
  const resultsViewportRef = useRef<HTMLDivElement | null>(null);
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const [resultsScrollLeft, setResultsScrollLeft] = useState(0);
  const [resultsScrollMax, setResultsScrollMax] = useState(0);

  const [isManagement, setIsManagement] = useState(false);
  const canUpload = isAdmin || isManagement;

  const [isUploading, setIsUploading] = useState<DataSource | null>(null);
  const [lastUploadSummary, setLastUploadSummary] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | DataSource>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [jobs, setJobs] = useState<ListedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [lastParsedPreview, setLastParsedPreview] = useState<
    | null
    | {
        source: DataSource;
        fileName: string;
        headers: string[];
        rows: Record<string, unknown>[];
      }
  >(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkManagement = async () => {
      if (!user) return;
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("user_types")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        setIsManagement(false);
        return;
      }

      setIsManagement(Boolean(profile?.user_types?.includes("management")));
    };
    checkManagement();
  }, [user]);

  const filters = useMemo(
    () => ({ search: search.trim(), source: sourceFilter, fromDate, toDate }),
    [search, sourceFilter, fromDate, toDate],
  );

  useEffect(() => {
    const loadJobs = async () => {
      if (!user) return;
      setLoadingJobs(true);
      try {
        let q = supabase
          .from("data_hub_jobs")
          .select(
            "id,job_number,source,job_date,customer,site,ewc,waste_description,category,movement_type,container_type,weight_t,vehicle_registration,updated_at",
          )
          .order("job_date", { ascending: false, nullsFirst: false })
          .order("updated_at", { ascending: false })
          .limit(200);

        if (filters.source !== "all") q = q.eq("source", filters.source);
        if (filters.fromDate) q = q.gte("job_date", filters.fromDate);
        if (filters.toDate) q = q.lte("job_date", filters.toDate);

        if (filters.search) {
          const term = filters.search.replace(/,/g, "");
          q = q.or(
            `job_number.ilike.%${term}%,customer.ilike.%${term}%,site.ilike.%${term}%,ewc.ilike.%${term}%`,
          );
        }

        const { data, error } = await q;
        if (error) throw error;
        setJobs((data ?? []) as ListedJob[]);
      } catch (e: any) {
        console.error(e);
        toast({
          title: "Could not load jobs",
          description: e?.message ?? "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoadingJobs(false);
      }
    };

    loadJobs();
  }, [user, toast, filters]);

  const handleDeleteFiltered = async () => {
    if (!canUpload) {
      toast({
        title: "No permission",
        description: "Only Admin or Management can delete Data Hub records.",
        variant: "destructive",
      });
      return;
    }

    const ids = jobs.map((j) => j.id).filter(Boolean);
    if (ids.length === 0) {
      toast({ title: "Nothing to delete", description: "There are no rows in the current filtered results." });
      return;
    }

    setIsDeleting(true);
    try {
      // Delete the currently displayed results (up to 200) to match what the user is seeing.
      for (const idChunk of chunk(ids, 200)) {
        const { error } = await supabase.from("data_hub_jobs").delete().in("id", idChunk);
        if (error) throw error;
      }

      toast({
        title: "Deleted",
        description: `Deleted ${ids.length.toLocaleString()} record(s) from the current filtered results.`,
      });

      setDeleteConfirmText("");
      setDeleteDialogOpen(false);

      // Refresh list
      setJobs((prev) => prev.filter((j) => !ids.includes(j.id)));
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Delete failed",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const el = rawPreviewScrollRef.current;
    if (!el) return;

    const recompute = () => {
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      setRawScrollMax(max);
      setRawScrollLeft((prev) => Math.min(prev, max));
    };

    const onScroll = () => setRawScrollLeft(el.scrollLeft);

    recompute();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener("resize", recompute);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [lastParsedPreview]);

  useEffect(() => {
    const viewport = resultsViewportRef.current;
    if (!viewport) return;

    // shadcn Table renders: <div class="relative w-full overflow-auto"><table ... /></div>
    // The inner div is the actual scroll container.
    const scroller = (viewport.firstElementChild as HTMLDivElement | null) ?? null;
    if (!scroller) return;
    resultsScrollRef.current = scroller;

    const recompute = () => {
      const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      setResultsScrollMax(max);
      setResultsScrollLeft((prev) => Math.min(prev, max));
    };

    const onScroll = () => setResultsScrollLeft(scroller.scrollLeft);

    // Recompute after layout/paint as scrollWidth can be incorrect on the first pass.
    recompute();
    const raf1 = requestAnimationFrame(recompute);
    const raf2 = requestAnimationFrame(recompute);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(recompute);
    // Observe the table itself (preferred) so width changes update scroll metrics reliably.
    const tableEl = scroller.querySelector("table");
    ro.observe(tableEl ?? scroller);
    window.addEventListener("resize", recompute);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [filters, jobs.length]);

  const parseFileToJobs = async (file: File, source: DataSource): Promise<DataHubJobRow[]> => {
    const buf = await file.arrayBuffer();
    // Ensure date cells come through as actual JS Date objects whenever possible.
    const workbook = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });

    const mapped: DataHubJobRow[] = [];
    for (const r of rows) {
      const ticketVal = getFirstMatchingValue(r, ["Ticket", "ticket", "Job Number", "job number"]);
      const ticket = String(ticketVal ?? "").trim();
      if (!ticket) continue;

      const jobDateVal = getFirstMatchingValue(r, ["Date", "Job Date", "job_date"]);
      const weightVal = getFirstMatchingValue(r, [
        "Weight (t)",
        "Weight",
        "Weight_t",
        "weight_t",
        "Tonnes",
        // Skiptrak commonly provides this as 'Nett Weight'
        "Nett Weight",
        "Net Weight",
        "Nett Weight (t)",
        "Net Weight (t)",
      ]);

      const weightNum =
        weightVal == null || weightVal === ""
          ? null
          : typeof weightVal === "number"
            ? weightVal
            : Number(String(weightVal).replace(/,/g, ""));

      mapped.push({
        job_number: ticket,
        source,
        job_date: excelValueToISODate(jobDateVal),
        customer: toCleanString(
          getFirstMatchingValue(r, [
            "Customer",
            "Customer Name",
            "Customer/Producer",
            "Client",
            "Account",
            "Account Name",
            "Producer",
            "Company",
            "Company /Surname",
            "Company/Surname",
          ]),
        ),
        site: toCleanString(
          getFirstMatchingValue(r, [
            "Site",
            "Site Name",
            "Location",
            "Delivery Site",
            "Collection Site",
            "Job Site",
            "Address",
          ]),
        ),
        ewc: toCleanString(getFirstMatchingValue(r, ["EWC", "EWC Code", "EWC Code (6)", "ewc"])),
        waste_description: toCleanString(
          getFirstMatchingValue(r, [
            "Waste Description",
            "Waste",
            "Waste Type",
            "Waste Type Description",
            "Material",
            "Description",
            "EWC Desc",
            "EWC Description",
            "waste_description",
            "Waste_Description",
          ]),
        ),
        category: toCleanString(getFirstMatchingValue(r, ["Category", "Waste Category", "category"])) ,
        movement_type: toCleanString(getFirstMatchingValue(r, ["Movement Type", "Movement", "movement_type"])),
        container_type: toCleanString(getFirstMatchingValue(r, ["Container", "Container Type", "container_type", "Skip Type"])),
        weight_t: Number.isFinite(weightNum as number) ? (weightNum as number) : null,
        vehicle_registration: toCleanString(
          getFirstMatchingValue(r, ["Vehicle", "Vehicle Registration", "Vehicle Reg", "Reg", "Registration", "vehicle_registration"]),
        ),
        raw: r,
      });
    }

    return mapped;
  };

  const handleUpload = async (source: DataSource, file: File) => {
    if (!canUpload) {
      toast({
        title: "No permission",
        description: "Only Admin or Management can upload Data Hub files.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(source);
    setLastUploadSummary(null);
    try {
      const jobsToUpsert = await parseFileToJobs(file, source);

      // Keep a raw preview (all columns) from the uploaded document for debugging/verification.
      const rawRows = jobsToUpsert.map((j) => j.raw ?? {}).filter(Boolean) as Record<string, unknown>[];
      const headers = Array.from(
        rawRows.reduce((set, r) => {
          Object.keys(r).forEach((k) => set.add(k));
          return set;
        }, new Set<string>()),
      );
      setLastParsedPreview({ source, fileName: file.name, headers, rows: rawRows });

      if (jobsToUpsert.length === 0) {
        toast({
          title: "No rows found",
          description: "We couldn't find a Ticket/Job Number column with values.",
          variant: "destructive",
        });
        return;
      }

      // Avoid overwriting existing non-empty fields with blanks.
      // (Some sources don't include Customer / Waste Description columns.)
      const jobNumbers = jobsToUpsert.map((j) => j.job_number);
      const existingByJob = new Map<string, ExistingJobFields>();
      for (const ids of chunk(jobNumbers, 500)) {
        const { data: existing, error } = await supabase
          .from("data_hub_jobs")
          .select("job_number,customer,site,ewc,waste_description,category,movement_type,container_type,weight_t,vehicle_registration,job_date")
          .in("job_number", ids);
        if (error) throw error;
        (existing ?? []).forEach((row: any) => existingByJob.set(String(row.job_number), row as ExistingJobFields));
      }

      const mergedJobs = jobsToUpsert.map((j) => {
        const existing = existingByJob.get(j.job_number);
        return {
          ...j,
          job_date: j.job_date ?? (existing?.job_date as any) ?? null,
          customer: j.customer ?? (existing?.customer as any) ?? null,
          site: j.site ?? (existing?.site as any) ?? null,
          ewc: j.ewc ?? (existing?.ewc as any) ?? null,
          waste_description: j.waste_description ?? (existing?.waste_description as any) ?? null,
          category: j.category ?? (existing?.category as any) ?? null,
          movement_type: j.movement_type ?? (existing?.movement_type as any) ?? null,
          container_type: j.container_type ?? (existing?.container_type as any) ?? null,
          weight_t: j.weight_t ?? (existing?.weight_t as any) ?? null,
          vehicle_registration: j.vehicle_registration ?? (existing?.vehicle_registration as any) ?? null,
        } satisfies DataHubJobRow;
      });

      // Upsert in chunks to keep request sizes safe
      const chunks = chunk(mergedJobs, 500);
      for (const c of chunks) {
        const { error } = await supabase.from("data_hub_jobs").upsert(c as any, { onConflict: "job_number" });
        if (error) throw error;
      }

      const summary = `${source.toUpperCase()}: processed ${jobsToUpsert.length.toLocaleString()} rows (deduped by Ticket)`;
      setLastUploadSummary(summary);
      toast({
        title: "Upload complete",
        description: summary,
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Upload failed",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/portal">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Portal</span>
                </Button>
              </Link>
              <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Upload className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Data Hub · Data Uploads</h1>
              <p className="text-muted-foreground">
                Upload Skiptrak and Midweigh XLSX files. Records are upserted by Ticket.
              </p>
            </div>
          </div>

          <Tabs defaultValue="data" className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data & Uploads
              </TabsTrigger>
              <TabsTrigger value="tracking" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Data Tracking
              </TabsTrigger>
              <TabsTrigger value="ask-ai" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Ask AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="space-y-8">

          {!canUpload && (
            <Card>
              <CardHeader>
                <CardTitle>Access restricted</CardTitle>
                <CardDescription>Only Admin or Management users can upload/overwrite Data Hub records.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" onClick={() => navigate("/portal")}>Back to Portal</Button>
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Skiptrak upload</CardTitle>
                <CardDescription>Upload the exported XLSX. Ticket column will be used as the unique key.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={!canUpload || isUploading !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void handleUpload("skiptrak", file);
                    e.currentTarget.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled
                  className="w-full"
                >
                  Select a file above to upload
                </Button>
                {isUploading === "skiptrak" && <p className="text-sm text-muted-foreground">Uploading…</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Midweigh upload</CardTitle>
                <CardDescription>Upload the exported XLSX. Ticket column will be used as the unique key.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={!canUpload || isUploading !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void handleUpload("midweigh", file);
                    e.currentTarget.value = "";
                  }}
                />
                <Button type="button" variant="secondary" disabled className="w-full">
                  Select a file above to upload
                </Button>
                {isUploading === "midweigh" && <p className="text-sm text-muted-foreground">Uploading…</p>}
              </CardContent>
            </Card>
          </div>

          {lastUploadSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Last upload</CardTitle>
                <CardDescription>{lastUploadSummary}</CardDescription>
              </CardHeader>
            </Card>
          )}

          {lastParsedPreview && (
            <Card>
              <CardHeader>
                <CardTitle>Uploaded file columns (raw preview)</CardTitle>
                <CardDescription>
                  {lastParsedPreview.source.toUpperCase()} · {lastParsedPreview.fileName} · Showing first{" "}
                  {Math.min(50, lastParsedPreview.rows.length).toLocaleString()} of{" "}
                  {lastParsedPreview.rows.length.toLocaleString()} rows · {lastParsedPreview.headers.length} columns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 pb-2">
                  <p className="text-sm text-muted-foreground">Scroll left/right to view all columns.</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => rawPreviewScrollRef.current?.scrollBy({ left: -600, behavior: "smooth" })}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Left</span>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => rawPreviewScrollRef.current?.scrollBy({ left: 600, behavior: "smooth" })}
                    >
                      <span className="hidden sm:inline">Right</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div
                  ref={rawPreviewScrollRef}
                  className="rounded-md border border-border overflow-x-auto max-w-full"
                >
                  <Table className="min-w-max">
                      <TableHeader>
                        <TableRow>
                          {lastParsedPreview.headers.map((h) => (
                            <TableHead key={h} className="whitespace-nowrap">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lastParsedPreview.rows.slice(0, 50).map((r, idx) => (
                          <TableRow key={idx}>
                            {lastParsedPreview.headers.map((h) => {
                              const v = (r as any)?.[h];
                              const text =
                                v == null
                                  ? ""
                                  : typeof v === "object"
                                    ? (() => {
                                        try {
                                          return JSON.stringify(v);
                                        } catch {
                                          return String(v);
                                        }
                                      })()
                                    : String(v);
                              return (
                                <TableCell key={h} className="whitespace-nowrap max-w-[22rem] truncate" title={text}>
                                  {text || "—"}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Search & results</CardTitle>
              <CardDescription>Latest records in the Data Hub table.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-4 gap-3">
                <Input
                  placeholder="Search Ticket, customer, site, EWC…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="flex items-center">
                  <ToggleGroup
                    type="single"
                    value={sourceFilter}
                    onValueChange={(v) => {
                      if (v === "skiptrak" || v === "midweigh" || v === "all") setSourceFilter(v);
                    }}
                    className="w-full justify-start"
                    aria-label="Source view"
                  >
                    <ToggleGroupItem value="midweigh" aria-label="Midweigh">
                      Midweigh
                    </ToggleGroupItem>
                    <ToggleGroupItem value="skiptrak" aria-label="Skiptrak">
                      Skiptrak
                    </ToggleGroupItem>
                    <ToggleGroupItem value="all" aria-label="Combined">
                      Combined
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Showing up to {jobs.length.toLocaleString()} rows (based on current filters).
                </p>

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={!canUpload || jobs.length === 0}>
                      Delete filtered results
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete filtered results?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the currently displayed results (up to 200 rows). Type{' '}
                        <span className="font-medium">DELETE</span> to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2">
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Type DELETE to confirm"
                        aria-label="Type DELETE to confirm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Deletions are restricted to Admin/Management.
                      </p>
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => {
                          setDeleteConfirmText("");
                        }}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          // Prevent closing if not confirmed.
                          if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
                            e.preventDefault();
                            return;
                          }
                          void handleDeleteFiltered();
                        }}
                        disabled={isDeleting || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                  {Math.round(resultsScrollLeft).toLocaleString()}
                </span>
                <input
                  type="range"
                  min={0}
                  max={resultsScrollMax}
                  value={Math.min(resultsScrollLeft, resultsScrollMax)}
                  disabled={resultsScrollMax <= 0}
                  onInput={(e) => {
                    const next = Number((e.target as HTMLInputElement).value);
                    setResultsScrollLeft(next);
                    resultsScrollRef.current?.scrollTo({ left: next, behavior: "auto" });
                  }}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setResultsScrollLeft(next);
                    resultsScrollRef.current?.scrollTo({ left: next, behavior: "auto" });
                  }}
                  className="w-full"
                  aria-label="Results horizontal scroll control"
                />
                <span className="text-xs text-muted-foreground tabular-nums w-12">
                  {Math.round(resultsScrollMax).toLocaleString()}
                </span>
              </div>

              <div ref={resultsViewportRef} className="rounded-md border border-border max-w-full">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Ticket</TableHead>
                      <TableHead className="whitespace-nowrap">Source</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Customer</TableHead>
                      <TableHead className="whitespace-nowrap">Site</TableHead>
                      <TableHead className="whitespace-nowrap">EWC</TableHead>
                      <TableHead className="whitespace-nowrap">Waste</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Weight (t)</TableHead>
                      <TableHead className="whitespace-nowrap">Vehicle</TableHead>
                      <TableHead className="whitespace-nowrap">Category</TableHead>
                      <TableHead className="whitespace-nowrap">Movement</TableHead>
                      <TableHead className="whitespace-nowrap">Container</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingJobs ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-muted-foreground">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-muted-foreground">
                          No results.
                        </TableCell>
                      </TableRow>
                    ) : (
                      jobs.map((j) => (
                        <TableRow key={j.id}>
                          <TableCell className="font-medium whitespace-nowrap">{j.job_number}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.source}</TableCell>
                          <TableCell className="whitespace-nowrap">{excelValueToISODate(j.job_date) ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.customer ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.site ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.ewc ?? "—"}</TableCell>
                          <TableCell className="max-w-[24rem] truncate" title={j.waste_description ?? ""}>
                            {j.waste_description ?? "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">{j.weight_t ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.vehicle_registration ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.category ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.movement_type ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.container_type ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="tracking" className="min-h-[600px]">
              <DataHubAnalytics />
            </TabsContent>

            <TabsContent value="ask-ai" className="min-h-[600px]">
              <DataHubAIChat />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default DataUploadsPage;
