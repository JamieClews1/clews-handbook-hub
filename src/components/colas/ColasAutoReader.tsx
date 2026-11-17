import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInvalidateColas } from "./useColasData";
import { Chip, ukDateTime } from "./ColasShared";

const RESULT_LABEL: Record<string, string> = { found: "Number found", unreadable: "Can't read", not_present: "Consignment page missing" };
const APPLIED_LABEL: Record<string, string> = { saved: "Saved", flagged: "Flagged on report", kept_existing: "Already recorded — left as it was" };

interface Summary { checked: number; found: number; unreadable: number; page_missing: number; kept: number; remaining: number; saved: string[] }

/** Status and history of the daily 5pm QuickConsign reader (colas-consignment-reader). */
export function ColasAutoReader({ authorised }: { authorised: boolean }) {
  const qc = useQueryClient();
  const invalidate = useInvalidateColas();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["colas", "auto-reader"],
    queryFn: async () => {
      const [state, attempts] = await Promise.all([
        supabase.from("colas_consignment_scan_state").select("*").eq("id", 1).maybeSingle(),
        supabase.from("colas_consignment_scan_attempts").select("*").order("created_at", { ascending: false }).limit(30),
      ]);
      if (state.error) throw state.error;
      if (attempts.error) throw attempts.error;
      return { state: state.data, attempts: attempts.data ?? [] };
    },
  });

  const call = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    const { data, error } = await supabase.functions.invoke("colas-consignment-reader", { body });
    setBusy(null);
    let message = (data as any)?.error as string | undefined;
    if (error) {
      const ctx = (error as any).context;
      try { message = (await ctx?.json?.())?.error ?? error.message; } catch { message = error.message; }
    }
    qc.invalidateQueries({ queryKey: ["colas", "auto-reader"] });
    if (message) { toast.error(message); return; }
    if (body.action === "run") {
      const s = (data as any)?.summary as Summary | undefined;
      if ((data as any)?.message) toast.info((data as any).message);
      else toast.success(s && s.checked ? `Checked ${s.checked} scan${s.checked === 1 ? "" : "s"}: ${s.found} number${s.found === 1 ? "" : "s"} saved, ${s.unreadable + s.page_missing} flagged` : "No new scans to read");
      invalidate();
    } else toast.success("Saved");
  };

  const st = q.data?.state;
  const sum = st?.last_run_summary as unknown as Summary | null;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg">Automatic consignment reading</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Every day at 5pm the portal goes through Colas Rail's hazardous jobs, reads the QuickConsign number off any new scanned paperwork and saves it. If the number can't be read, or the consignment page isn't in the scan, the job is flagged on the monthly report. Each scan is only read once, and a number already saved is never changed.</p>
        </div>
        <Button variant="outline" onClick={() => call({ action: "run" }, "run")} disabled={!!busy || !!st?.paused_reason}>
          {busy === "run" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-1 h-4 w-4" />}Check now
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? <p className="text-sm text-destructive">Couldn't load the reader status.</p> : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Switch id="auto-reader-on" checked={!!st?.enabled} disabled={!authorised || !!busy} onCheckedChange={(v) => call({ action: "settings", enabled: v }, "settings")} />
                <Label htmlFor="auto-reader-on">Daily 5pm check {st?.enabled ? "on" : "off"}</Label>
              </div>
              <div>Last check: <span className="font-medium">{st?.last_run_at ? `${ukDateTime(st.last_run_at)} (${st.last_run_trigger === "scheduled" ? "automatic" : "Check now"})` : "Not run yet"}</span></div>
              {sum && <div className="text-muted-foreground">{sum.checked} scan{sum.checked === 1 ? "" : "s"} read · {sum.found} saved · {sum.unreadable + sum.page_missing} flagged{sum.remaining ? ` · ${sum.remaining} waiting for the next check` : ""}</div>}
            </div>
            {st?.paused_reason && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <span><span className="font-medium">Paused.</span> {st.paused_reason}</span>
                {authorised && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call({ action: "resume" }, "resume")}>Resume</Button>}
              </div>
            )}
            {st?.last_error && !st.paused_reason && <p className="text-sm text-destructive">Last check stopped: {st.last_error}</p>}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Job</TableHead><TableHead>Result</TableHead><TableHead>Number</TableHead><TableHead>What happened</TableHead><TableHead>What the reader saw</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(q.data?.attempts ?? []).map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-sm">{ukDateTime(a.created_at)}</TableCell>
                      <TableCell className="font-medium">{a.job_number}</TableCell>
                      <TableCell><Chip tone={a.result === "found" ? "good" : "bad"}>{RESULT_LABEL[a.result] ?? a.result}</Chip></TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{a.consignment_ref ?? "—"}</TableCell>
                      <TableCell className="text-sm">{APPLIED_LABEL[a.applied] ?? a.applied}</TableCell>
                      <TableCell className="min-w-[18rem] text-sm text-muted-foreground">{a.evidence}</TableCell>
                    </TableRow>
                  ))}
                  {(q.data?.attempts ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No scans read yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
