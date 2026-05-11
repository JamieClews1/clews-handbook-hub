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
import { useToast } from "@/hooks/use-toast";
import clewsLogo from "@/assets/clews-logo.png";
import { ArrowLeft, ArrowRight, RefreshCw, Upload } from "lucide-react";

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
  job_type?: string | null;
  weight_t?: number | null;
  vehicle_registration?: string | null;
  driver?: string | null;
  tipping_location?: string | null;
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
  driver: string | null;
  tipping_location: string | null;
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
  driver: string | null;
  tipping_location: string | null;
};

function normalizeHeaderKey(key: unknown) {
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/"); // Normalize spaces around slashes
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

function parseFlexibleNumber(value: any): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  let str = String(value).trim();
  if (!str) return null;

  // Remove common unit suffixes/prefixes (e.g. "160KG", "3.8 t")
  str = str.replace(/\b(kg|kgs|tonnes?|tonne|t)\b/gi, "");
  // Keep only number-relevant characters
  str = str.replace(/[^0-9.,\-]/g, "");
  if (!str) return null;

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  const isCommaDecimal = lastComma > lastDot;

  if (isCommaDecimal) {
    // 1.234,56 -> 1234.56
    str = str.replace(/\./g, "");
    str = str.replace(/,/g, ".");
  } else {
    // 1,234.56 -> 1234.56
    str = str.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(str);
  return Number.isFinite(parsed) ? parsed : null;
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
  const [pendingUpload, setPendingUpload] = useState<{ source: DataSource; file: File } | null>(null);
  const [lastUploadSummary, setLastUploadSummary] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; stage: string } | null>(null);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | DataSource>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [jobs, setJobs] = useState<ListedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Orphaned jobs detection after upload
  const [orphanedJobs, setOrphanedJobs] = useState<{ id: string; job_number: string; customer: string | null; site: string | null; job_date: string | null }[]>([]);
  const [orphanDialogOpen, setOrphanDialogOpen] = useState(false);
  const [isDeletingOrphans, setIsDeletingOrphans] = useState(false);

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

  const loadJobs = async () => {
    if (!user) return;
    setLoadingJobs(true);
    try {
      let q = supabase
        .from("data_hub_jobs")
        .select(
          "id,job_number,source,job_date,customer,site,ewc,waste_description,category,movement_type,container_type,weight_t,vehicle_registration,driver,tipping_location,updated_at",
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

  useEffect(() => {
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

  const handleDeleteOrphans = async () => {
    setIsDeletingOrphans(true);
    try {
      const ids = orphanedJobs.map((j) => j.id);
      for (const idChunk of chunk(ids, 200)) {
        const { error } = await supabase.from("data_hub_jobs").delete().in("id", idChunk);
        if (error) throw error;
      }
      toast({
        title: "Jobs deleted",
        description: `${orphanedJobs.length} orphaned job(s) removed.`,
      });
      setOrphanedJobs([]);
      setOrphanDialogOpen(false);
      loadJobs();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    } finally {
      setIsDeletingOrphans(false);
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
      // For Skiptrak uploads, skip rows where Status = 'V' (voided)
      if (source === "skiptrak") {
        const statusVal = getFirstMatchingValue(r, ["Status", "status"]);
        if (statusVal && String(statusVal).trim().toUpperCase() === "V") continue;
      }

      const ticketVal = getFirstMatchingValue(r, ["Ticket", "ticket", "Job Number", "job number"]);
      const ticket = String(ticketVal ?? "").trim();
      if (!ticket) continue;

      const jobDateVal = getFirstMatchingValue(r, ["Date", "Job Date", "job_date"]);

      // Weight handling (IMPORTANT):
      // - Skiptrak: weight_t is stored in TONNES
      // - Midweigh: weight_t is stored in KG
      // Any UI/reporting that needs tonnes should convert Midweigh by dividing by 1000.
      const weightTonnesVal = getFirstMatchingValue(r, ["Weight (t)", "Tonnes", "Nett Weight (t)", "Net Weight (t)"]);
      const weightOtherVal = getFirstMatchingValue(r, [
        "Weight (kg)",
        "Weight (KG)",
        "Weight",
        "Weight_t",
        "weight_t",
        // Skiptrak commonly provides this as 'Nett Weight'
        "Nett Weight",
        "Net Weight",
      ]);

      const inputIsTonnes = weightTonnesVal != null && String(weightTonnesVal).trim() !== "";
      const parsedWeight = parseFlexibleNumber(inputIsTonnes ? weightTonnesVal : weightOtherVal);
      const weightTonnes = parsedWeight == null ? null : parsedWeight;

      // Source-specific customer field mapping
      const customerCandidates = source === "midweigh"
        ? [
            "Company/Surname",
            "Company /Surname",
            "Company",
          ]
        : [
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
          ];

      mapped.push({
        job_number: ticket,
        source,
        job_date: excelValueToISODate(jobDateVal),
        customer: toCleanString(getFirstMatchingValue(r, customerCandidates)),
        site: toCleanString(
          getFirstMatchingValue(r, [
            "Site",
            "Site Name",
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
        category: source === "midweigh" 
          ? "Midweigh"
          : toCleanString(getFirstMatchingValue(r, ["Category", "Waste Category", "category"])),
        movement_type: toCleanString(getFirstMatchingValue(r, [
          "Movement Type", 
          "Movement", 
          "movement_type",
          "In / Out",
          "In/Out",
          "In Out",
        ])),
        container_type: toCleanString(getFirstMatchingValue(r, [
          "Container", 
          "Container Type", 
          "container_type", 
          "Skip Type",
        ])),
        job_type: source === "midweigh" 
          ? toCleanString(getFirstMatchingValue(r, ["Job Type", "JobType", "job_type"]))
          : null,
        weight_t: weightTonnes,
        vehicle_registration: toCleanString(
          getFirstMatchingValue(r, ["Vehicle", "Vehicle Registration", "Vehicle Reg", "Reg", "Registration", "vehicle_registration"]),
        ),
        driver: toCleanString(
          getFirstMatchingValue(r, ["Driver", "Drivers", "Driver Name", "driver"]),
        ),
        tipping_location: toCleanString(
          getFirstMatchingValue(r, ["Location", "Tipping Location", "Tip Location", "tipping_location"]),
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
    setUploadProgress({ current: 0, total: 0, stage: "Parsing file..." });
    
    try {
      const jobsToUpsert = await parseFileToJobs(file, source);
      const totalRows = jobsToUpsert.length;

      // Keep a raw preview (first 100 rows) from the uploaded document for debugging/verification.
      const rawRows = jobsToUpsert.slice(0, 100).map((j) => j.raw ?? {}).filter(Boolean) as Record<string, unknown>[];
      const headers = Array.from(
        rawRows.reduce((set, r) => {
          Object.keys(r).forEach((k) => set.add(k));
          return set;
        }, new Set<string>()),
      );
      setLastParsedPreview({ source, fileName: file.name, headers, rows: rawRows });

      if (totalRows === 0) {
        toast({
          title: "No rows found",
          description: "We couldn't find a Ticket/Job Number column with values.",
          variant: "destructive",
        });
        return;
      }

      setUploadProgress({ current: 0, total: totalRows, stage: "Processing records..." });

      // For very large files, process in smaller batches to prevent timeouts
      const BATCH_SIZE = 500;
      const jobBatches = chunk(jobsToUpsert, BATCH_SIZE);
      let processedCount = 0;

      for (let batchIndex = 0; batchIndex < jobBatches.length; batchIndex++) {
        const batch = jobBatches[batchIndex];
        const jobNumbers = batch.map((j) => j.job_number);

        // Fetch existing records for this batch only (filter by source too since job_number is unique per source)
        const existingByJob = new Map<string, ExistingJobFields>();
        const { data: existing, error: fetchError } = await supabase
          .from("data_hub_jobs")
          .select("job_number,customer,site,ewc,waste_description,category,movement_type,container_type,weight_t,vehicle_registration,job_date,driver,tipping_location")
          .in("job_number", jobNumbers)
          .eq("source", source);
        
        if (fetchError) throw fetchError;
        (existing ?? []).forEach((row: any) => existingByJob.set(String(row.job_number), row as ExistingJobFields));

        // Merge with existing data (avoid overwriting non-empty fields with blanks)
        const mergedBatch = batch.map((j) => {
          const existingRow = existingByJob.get(j.job_number);
          return {
            ...j,
            job_date: j.job_date ?? (existingRow?.job_date as any) ?? null,
            customer: j.customer ?? (existingRow?.customer as any) ?? null,
            site: j.site ?? (existingRow?.site as any) ?? null,
            ewc: j.ewc ?? (existingRow?.ewc as any) ?? null,
            waste_description: j.waste_description ?? (existingRow?.waste_description as any) ?? null,
            category: j.category ?? (existingRow?.category as any) ?? null,
            movement_type: j.movement_type ?? (existingRow?.movement_type as any) ?? null,
            container_type: j.container_type ?? (existingRow?.container_type as any) ?? null,
            weight_t: j.weight_t ?? (existingRow?.weight_t as any) ?? null,
            vehicle_registration: j.vehicle_registration ?? (existingRow?.vehicle_registration as any) ?? null,
            driver: j.driver ?? (existingRow?.driver as any) ?? null,
            tipping_location: j.tipping_location ?? (existingRow?.tipping_location as any) ?? null,
          } satisfies DataHubJobRow;
        });

        // Upsert this batch using composite key (job_number + source)
        const { error: upsertError } = await supabase
          .from("data_hub_jobs")
          .upsert(mergedBatch as any, { onConflict: "job_number,source" });
        
        if (upsertError) throw upsertError;

        processedCount += batch.length;
        setUploadProgress({ 
          current: processedCount, 
          total: totalRows, 
          stage: `Processed ${processedCount.toLocaleString()} of ${totalRows.toLocaleString()} records...` 
        });

        // Yield to UI thread to prevent freezing
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const summary = `${source.toUpperCase()}: processed ${totalRows.toLocaleString()} rows (deduped by Ticket)`;
      setLastUploadSummary(summary);
      toast({
        title: "Upload complete",
        description: summary,
      });

      // --- Orphaned jobs detection ---
      // Find the earliest date in the uploaded data
      const uploadedDates = jobsToUpsert
        .map((j) => j.job_date)
        .filter((d): d is string => !!d)
        .sort();
      const minUploadDate = uploadedDates.length > 0 ? uploadedDates[0] : null;

      if (minUploadDate) {
        const uploadedJobNumbers = new Set(jobsToUpsert.map((j) => j.job_number));

        // Fetch all existing DB jobs for this source from minUploadDate onward
        let allExisting: { id: string; job_number: string; customer: string | null; site: string | null; job_date: string | null }[] = [];
        let fetchFrom = 0;
        const fetchBatch = 1000;
        while (true) {
          const { data: existingBatch, error: fetchErr } = await supabase
            .from("data_hub_jobs")
            .select("id, job_number, customer, site, job_date")
            .eq("source", source)
            .gte("job_date", minUploadDate)
            .range(fetchFrom, fetchFrom + fetchBatch - 1);
          if (fetchErr) { console.error("Orphan check fetch error:", fetchErr); break; }
          if (!existingBatch || existingBatch.length === 0) break;
          allExisting.push(...existingBatch);
          if (existingBatch.length < fetchBatch) break;
          fetchFrom += fetchBatch;
        }

        const orphans = allExisting.filter((e) => !uploadedJobNumbers.has(e.job_number));
        if (orphans.length > 0) {
          setOrphanedJobs(orphans);
          setOrphanDialogOpen(true);
        }
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Upload failed",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(null);
      setUploadProgress(null);
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
              <Link to="/performance-hub">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Performance Hub</span>
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
              <h1 className="text-2xl font-bold text-foreground">Performance Hub · Data Uploads</h1>
              <p className="text-muted-foreground">
                Upload Skiptrak and Midweigh XLSX files. Records are upserted by Ticket.
              </p>
            </div>
          </div>

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
                    setPendingUpload({ source: "skiptrak", file });
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
                {isUploading === "skiptrak" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {uploadProgress?.stage || "Uploading…"}
                    </p>
                    {uploadProgress && uploadProgress.total > 0 && (
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
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
                    setPendingUpload({ source: "midweigh", file });
                    e.currentTarget.value = "";
                  }}
                />
                <Button type="button" variant="secondary" disabled className="w-full">
                  Select a file above to upload
                </Button>
                {isUploading === "midweigh" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {uploadProgress?.stage || "Uploading…"}
                    </p>
                    {uploadProgress && uploadProgress.total > 0 && (
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
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
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    Showing up to {jobs.length.toLocaleString()} rows (based on current filters).
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => loadJobs()}
                    disabled={loadingJobs}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingJobs ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

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
                      <TableHead className="whitespace-nowrap">Driver</TableHead>
                      <TableHead className="whitespace-nowrap">Tipping Location</TableHead>
                      <TableHead className="whitespace-nowrap">Category</TableHead>
                      <TableHead className="whitespace-nowrap">Movement</TableHead>
                      <TableHead className="whitespace-nowrap">Container</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingJobs ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-12">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p className="text-muted-foreground">Loading data...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="text-muted-foreground">
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
                          <TableCell className="text-right whitespace-nowrap">
                            {j.weight_t == null
                              ? "—"
                              : j.source === "midweigh"
                                ? (j.weight_t / 1000).toFixed(2)
                                : j.weight_t.toFixed(2)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{j.vehicle_registration ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.driver ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{j.tipping_location ?? "—"}</TableCell>
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
        </div>
      </main>

      {/* Orphaned Jobs Dialog */}
      <AlertDialog open={orphanDialogOpen} onOpenChange={(open) => { if (!open) { setOrphanDialogOpen(false); setOrphanedJobs([]); } }}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Jobs Missing From Upload</AlertDialogTitle>
            <AlertDialogDescription>
              {orphanedJobs.length} job(s) exist in the database but were not found in the file you just uploaded (from the upload's earliest date onward). Would you like to delete them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="overflow-auto max-h-[40vh] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphanedJobs.slice(0, 100).map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-sm">{j.job_number}</TableCell>
                    <TableCell>{j.customer ?? "—"}</TableCell>
                    <TableCell>{j.site ?? "—"}</TableCell>
                    <TableCell>{j.job_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {orphanedJobs.length > 100 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                      … and {orphanedJobs.length - 100} more
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingOrphans}>Keep All</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDeleteOrphans(); }}
              disabled={isDeletingOrphans}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingOrphans ? "Deleting…" : `Delete ${orphanedJobs.length} Job(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DataUploadsPage;
