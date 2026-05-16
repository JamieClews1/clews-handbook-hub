import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Undo2 } from "lucide-react";

type DataSource = "skiptrak" | "midweigh";

type ArchivedJob = {
  id: string;
  original_id: string | null;
  job_number: string;
  source: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  weight_t: number | null;
  archived_at: string;
  archive_reason: string | null;
};

interface Props {
  source: DataSource;
  canManage: boolean;
  refreshKey?: number;
  onRestored?: () => void;
}

export const ArchivedJobsPanel = ({ source, canManage, refreshKey, onRestored }: Props) => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<ArchivedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("data_hub_jobs_archive")
        .select("id, original_id, job_number, source, job_date, customer, site, weight_t, archived_at, archive_reason")
        .eq("source", source)
        .order("archived_at", { ascending: false })
        .limit(200);

      if (search.trim()) {
        const term = search.trim().replace(/,/g, "");
        q = q.or(`job_number.ilike.%${term}%,customer.ilike.%${term}%,site.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      setJobs((data ?? []) as ArchivedJob[]);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Could not load archive", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [source, search, toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const handleRestore = async (job: ArchivedJob) => {
    if (!canManage) return;
    setRestoringId(job.id);
    try {
      // Fetch full archived row
      const { data: full, error: fetchErr } = await supabase
        .from("data_hub_jobs_archive")
        .select("*")
        .eq("id", job.id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!full) throw new Error("Archived job not found");

      const restoreRow: Record<string, any> = {
        job_number: full.job_number,
        source: full.source,
        job_date: full.job_date,
        customer: full.customer,
        site: full.site,
        ewc: full.ewc,
        waste_description: full.waste_description,
        category: full.category,
        movement_type: full.movement_type,
        container_type: full.container_type,
        weight_t: full.weight_t,
        vehicle_registration: full.vehicle_registration,
        raw: full.raw ?? {},
        order_number_override: full.order_number_override,
        job_type: full.job_type,
        driver: full.driver,
        tipping_location: full.tipping_location,
        manual_edit_note: full.manual_edit_note,
      };
      if (full.original_id) restoreRow.id = full.original_id;

      const { error: upsertErr } = await supabase
        .from("data_hub_jobs")
        .upsert(restoreRow, { onConflict: "job_number,source" });
      if (upsertErr) throw upsertErr;

      const { error: delErr } = await supabase
        .from("data_hub_jobs_archive")
        .delete()
        .eq("id", job.id);
      if (delErr) throw delErr;

      toast({ title: "Restored", description: `Job ${job.job_number} restored to Data Hub.` });
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      onRestored?.();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Restore failed", description: e?.message, variant: "destructive" });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{source === "skiptrak" ? "Skiptrak" : "Midweigh"} archive</CardTitle>
        <CardDescription>
          Jobs auto-removed on upload. Excluded from all reporting. Restore if needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search ticket, customer, site…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-1.5 shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="rounded-md border max-h-72 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Job #</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Customer</TableHead>
                <TableHead className="whitespace-nowrap">Site</TableHead>
                <TableHead className="whitespace-nowrap">Archived</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                    No archived jobs.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.job_number}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{j.job_date ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[12rem] truncate" title={j.customer ?? ""}>{j.customer ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[12rem] truncate" title={j.site ?? ""}>{j.site ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(j.archived_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Restore job"
                        disabled={!canManage || restoringId === j.id}
                        onClick={() => void handleRestore(j)}
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {jobs.length >= 200 && (
          <p className="text-xs text-muted-foreground">Showing latest 200. Refine search to find older entries.</p>
        )}
      </CardContent>
    </Card>
  );
};
