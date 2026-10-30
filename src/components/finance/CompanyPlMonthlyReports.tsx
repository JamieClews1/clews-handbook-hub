import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileText, Loader2, Mail, RefreshCw } from "lucide-react";
import { withTimeout } from "@/lib/with-timeout";
import { FunctionsHttpError } from "@supabase/supabase-js";

type Report = { id: string; period: string; status: string; error: string | null; created_at: string; deliveries: unknown };
export default function CompanyPlMonthlyReports() {
  const [enabled, setEnabled] = useState(false), [paused, setPaused] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1)).toISOString().slice(0, 7); });
  const load = useCallback(async () => {
    try {
      const [settings, history] = await withTimeout(Promise.all([
        supabase.from("ceo_report_settings").select("enabled,paused_reason").eq("id", true).maybeSingle(),
        supabase.from("ceo_monthly_reports").select("id,period,status,error,created_at,deliveries").order("period", { ascending: false }).limit(24),
      ]), 12000, "CEO reports");
      if (settings.error || history.error) throw settings.error ?? history.error;
      setEnabled(settings.data?.enabled ?? false); setPaused(settings.data?.paused_reason ?? null); setReports(history.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Reports could not load."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true); setError("");
    try {
      const result = await supabase.functions.invoke("monthly-ceo-report", { body: { action, ...extra } });
      if (result.error) {
        if (result.error instanceof FunctionsHttpError) { const detail = await result.error.context.json(); throw new Error(detail.error ?? result.error.message); }
        throw result.error;
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Reporting failed."); }
    finally { await load(); setBusy(false); }
  };
  const download = async (report: Report) => {
    setBusy(true); setError("");
    try {
      const { data, error: readError } = await withTimeout(supabase.from("ceo_monthly_reports").select("pdf_base64").eq("id", report.id).single(), 15000, "Download PDF");
      if (readError || !data?.pdf_base64) throw new Error("PDF is not available yet.");
      const bytes = Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `CEO_Report_${report.period.slice(0, 7)}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed."); } finally { setBusy(false); }
  };
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-primary" />Monthly CEO report</h2><Button variant="outline" size="icon" aria-label="Refresh monthly reports" onClick={() => void load()} disabled={busy}><RefreshCw className="h-4 w-4" /></Button></div>
    <div className="flex items-center justify-between gap-4 border-y border-border py-4"><div><Label htmlFor="monthly-ceo-enabled" className="font-medium">Send on the 1st of each month · 08:00 UTC</Label><p className="mt-1 text-sm text-muted-foreground">Richard Clews · richard@clewsrecycling.co.uk<br />Jamie Clews · jamie@clewsrecycling.co.uk</p></div><Switch id="monthly-ceo-enabled" checked={enabled} disabled={busy || !!paused} onCheckedChange={value => void run("settings", { enabled: value })} /></div>
    {paused && <div role="alert" className="space-y-2 text-sm text-destructive"><p>Reporting paused: {paused}</p><Button variant="outline" onClick={() => void run("resume")} disabled={busy}>Resume after resolving</Button></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-end gap-3"><div className="space-y-2"><Label htmlFor="ceo-month">Report month</Label><Input id="ceo-month" type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-44" /></div><Button variant="outline" disabled={busy || !!paused || !month} onClick={() => void run("generate", { period: `${month}-01` })}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Generate PDF</Button></div>
    <div className="divide-y divide-border">{reports.map(report => <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium">{report.period.slice(0, 7)} <span className="ml-2 text-sm text-muted-foreground">{report.status === "sent" ? "Accepted by email service" : report.status}</span></p>{report.error && <p className="mt-1 text-sm text-destructive">{report.error}</p>}</div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || report.status === "generating"} onClick={() => void download(report)}><Download className="mr-2 h-4 w-4" />PDF</Button>{report.status !== "sent" && <Button size="sm" disabled={busy || !!paused || report.status === "generating"} onClick={() => { if (window.confirm(`Send the ${report.period.slice(0, 7)} CEO PDF to Richard and Jamie?`)) void run("send", { period: report.period }); }}><Mail className="mr-2 h-4 w-4" />Send to directors</Button>}</div></div>)}</div>
  </section>;
}