import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Settings = {
  id: string;
  retention_months: number;
  apply_to_customers: boolean;
  apply_to_contacts: boolean;
  auto_archive: boolean;
  notes: string | null;
};

type ActivityRow = {
  customer_id: string;
  customer_name: string;
  customer_code: string | null;
  is_inactive: boolean;
  last_activity_date: string | null;
  job_count: number;
  contact_count: number;
  site_count: number;
};

type LogRow = {
  id: string;
  customer_name: string;
  action: string;
  last_activity_date: string | null;
  notes: string | null;
  created_at: string;
};

const fmtDate = (d: string | null) => {
  if (!d) return "Never";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};

const monthsSince = (d: string | null) => {
  if (!d) return null;
  const then = new Date(d);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
};

export function GdprCleanup() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [months, setMonths] = useState("12");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{ row: ActivityRow; action: "archive" | "anonymise" } | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: act, error: actErr }, { data: lg }] = await Promise.all([
      supabase.from("gdpr_retention_settings").select("*").order("created_at").limit(1).maybeSingle(),
      supabase.rpc("get_customer_activity_summary"),
      supabase
        .from("gdpr_cleanup_log")
        .select("id,customer_name,action,last_activity_date,notes,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (s) {
      setSettings(s as Settings);
      setMonths(String((s as Settings).retention_months));
    }
    if (actErr) console.error("[GDPR] activity load failed", actErr);
    setRows(((act ?? []) as ActivityRow[]).slice());
    setLog((lg ?? []) as LogRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async (patch: Partial<Settings>) => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("gdpr_retention_settings").update(patch).eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setSettings({ ...settings, ...patch } as Settings);
    toast({ title: "Retention settings saved" });
  };

  const retention = settings?.retention_months ?? 12;

  const expired = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        const m = monthsSince(r.last_activity_date);
        const isExpired = m === null || m >= retention;
        if (!isExpired) return false;
        if (!q) return true;
        return (
          r.customer_name.toLowerCase().includes(q) ||
          (r.customer_code ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.last_activity_date ?? "").localeCompare(b.last_activity_date ?? ""));
  }, [rows, retention, search]);

  const withData = expired.filter((r) => r.contact_count > 0);

  const runAction = async () => {
    if (!pending) return;
    const { row, action } = pending;
    setWorking(true);
    try {
      if (action === "archive") {
        const { error } = await supabase.from("customers").update({ is_active: false }).eq("id", row.customer_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customer_contacts").delete().eq("customer_id", row.customer_id);
        if (error) throw error;
      }
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("gdpr_cleanup_log").insert({
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        action: action === "archive" ? "archived" : "contacts_removed",
        last_activity_date: row.last_activity_date,
        performed_by: auth?.user?.id ?? null,
        notes: `Retention period ${retention} months`,
      });
      toast({
        title: action === "archive" ? "Customer archived" : "Contact data removed",
        description: row.customer_name,
      });
      setPending(null);
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Action failed", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data retention parameters</CardTitle>
          <CardDescription>
            Customer records with no activity for longer than the retention period are listed below for review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="retention-months">Keep data for (months since last usage)</Label>
              <Input
                id="retention-months"
                type="number"
                min={1}
                className="w-40"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
            <Button
              onClick={() => saveSettings({ retention_months: Math.max(1, parseInt(months, 10) || 12) })}
              disabled={saving || !settings}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Apply to customer records</p>
                <p className="text-xs text-muted-foreground">Flag expired customers for archiving</p>
              </div>
              <Switch
                checked={settings?.apply_to_customers ?? true}
                onCheckedChange={(v) => saveSettings({ apply_to_customers: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Apply to contact details</p>
                <p className="text-xs text-muted-foreground">Names, emails and phone numbers</p>
              </div>
              <Switch
                checked={settings?.apply_to_contacts ?? true}
                onCheckedChange={(v) => saveSettings({ apply_to_contacts: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Auto-archive</p>
                <p className="text-xs text-muted-foreground">Off = manual review before any removal</p>
              </div>
              <Switch
                checked={settings?.auto_archive ?? false}
                onCheckedChange={(v) => saveSettings({ auto_archive: v })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customers past retention ({expired.length})</CardTitle>
          <CardDescription>
            No jobs in the last {retention} months. {withData.length} still hold personal contact data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Sites</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  expired.slice(0, 300).map((r) => (
                    <TableRow key={r.customer_id}>
                      <TableCell className="font-medium">
                        {r.customer_name}
                        {r.customer_code && (
                          <span className="ml-2 text-xs text-muted-foreground">{r.customer_code}</span>
                        )}
                      </TableCell>
                      <TableCell>{fmtDate(r.last_activity_date)}</TableCell>
                      <TableCell>{r.job_count}</TableCell>
                      <TableCell>{r.contact_count}</TableCell>
                      <TableCell>{r.site_count}</TableCell>
                      <TableCell>
                        {r.is_inactive ? (
                          <Badge variant="secondary">Archived</Badge>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {!r.is_inactive && (settings?.apply_to_customers ?? true) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPending({ row: r, action: "archive" })}
                            >
                              Archive
                            </Button>
                          )}
                          {r.contact_count > 0 && (settings?.apply_to_contacts ?? true) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setPending({ row: r, action: "anonymise" })}
                            >
                              Remove contacts
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && expired.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No customers are past the retention period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {expired.length > 300 && (
            <p className="text-xs text-muted-foreground">Showing the 300 oldest — use search to narrow down.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cleanup log</CardTitle>
          <CardDescription>Audit trail of retention actions taken.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{new Date(l.created_at).toLocaleString("en-GB")}</TableCell>
                    <TableCell className="font-medium">{l.customer_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{l.action.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>{fmtDate(l.last_activity_date)}</TableCell>
                    <TableCell className="text-muted-foreground">{l.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {log.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No cleanup actions recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.action === "archive" ? "Archive customer?" : "Remove contact data?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === "archive"
                ? `${pending?.row.customer_name} will be marked inactive and hidden from active lists. Job history is kept.`
                : `All ${pending?.row.contact_count} contact record(s) for ${pending?.row.customer_name} will be permanently deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runAction} disabled={working}>
              {working ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
