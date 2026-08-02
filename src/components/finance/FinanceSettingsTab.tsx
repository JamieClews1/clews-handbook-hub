import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { logSyncAttempt, fetchCompanyBranding } from "@/lib/invoice-service";
import { InvoiceDesigner } from "./InvoiceDesigner";
import type { CompanyBranding } from "@/lib/invoice-pdf";

export function FinanceSettingsTab() {
  const [settings, setSettings] = useState<any>(null);
  const [company, setCompany] = useState<CompanyBranding>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: l }, comp] = await Promise.all([
      supabase.from("finance_settings").select("*").limit(1).maybeSingle(),
      supabase
        .from("accounting_sync_log")
        .select("*")
        .order("last_attempt_at", { ascending: false })
        .limit(50),
      fetchCompanyBranding(),
    ]);
    setSettings(s ?? {});
    setCompany(comp ?? {});
    setLogs(l ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k: string, v: any) => setSettings((s: any) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, created_at, updated_at, ...rest } = settings;
    const { error } = id
      ? await supabase.from("finance_settings").update(rest).eq("id", id)
      : await supabase.from("finance_settings").insert(rest as any);
    setSaving(false);
    if (error) return toast.error("Could not save", { description: error.message });
    toast.success("Finance settings saved");
    load();
  };

  const retry = async (log: any) => {
    await supabase
      .from("accounting_sync_log")
      .update({
        status: "pending",
        retry_count: (log.retry_count ?? 0) + 1,
        last_attempt_at: new Date().toISOString(),
        message: "Retry queued — regenerate the Sage 50 import file from the invoice.",
      } as any)
      .eq("id", log.id);
    toast.success("Retry queued");
    load();
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sage 50 Accounts v32 (desktop) — integration status</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            Sage 50 v32 is a desktop product with no cloud REST API. A hosted portal cannot call it
            directly. The three viable routes are:
          </p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              <strong>Sage 50 SDK / SDO (Sage Data Objects)</strong> — full read/write, but requires a Sage
              developer licence and a small connector service running on the machine (or network) where Sage
              50 is installed. This is the only route that gives true two-way live sync.
            </li>
            <li>
              <strong>Third-party middleware</strong> (Codat, Zynk Workflow, Sage Data &amp; Insights) —
              paid subscription, no code on your Sage machine to maintain.
            </li>
            <li>
              <strong>CSV import/export</strong> — available now, no licence or extra cost. The portal
              produces a Sage 50 audit-trail import file per invoice or per batch, and payments are marked
              off in the portal (or imported back later).
            </li>
          </ol>
          <p>
            <strong>Currently live:</strong> option 3 (CSV). Switch on "Accounting sync" below once an SDK
            connector or middleware account is in place — the data model and sync log are already
            provider-agnostic, so adding Sage, Xero or QuickBooks later is a connector change only.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoice numbering &amp; defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Invoice prefix</Label>
            <Input value={settings.invoice_prefix ?? ""} onChange={(e) => set("invoice_prefix", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Next number</Label>
            <Input
              type="number"
              value={settings.next_invoice_number ?? 1}
              onChange={(e) => set("next_invoice_number", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Number padding</Label>
            <Input
              type="number"
              value={settings.invoice_number_padding ?? 5}
              onChange={(e) => set("invoice_number_padding", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default payment terms (days)</Label>
            <Input
              type="number"
              value={settings.default_payment_terms_days ?? 30}
              onChange={(e) => set("default_payment_terms_days", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default VAT rate (%)</Label>
            <Input
              type="number"
              value={settings.default_vat_rate ?? 20}
              onChange={(e) => set("default_vat_rate", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Accounting provider</Label>
            <Input
              value={settings.accounting_provider ?? "sage50"}
              onChange={(e) => set("accounting_provider", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoice email</CardTitle>
          <CardDescription>
            Tokens: {"{{invoice_number}} {{customer_name}} {{finance_contact_name}} {{total}} {{issue_date}} {{due_date}} {{company_name}} {{purchase_order}} {{job_number}}"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              value={settings.invoice_email_subject ?? ""}
              onChange={(e) => set("invoice_email_subject", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea
              rows={9}
              value={settings.invoice_email_body ?? ""}
              onChange={(e) => set("invoice_email_body", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overdue reminders</CardTitle>
          <CardDescription>Extra token: {"{{days_overdue}}"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>Send automated reminders</Label>
              <p className="text-xs text-muted-foreground">
                Emails the finance contact when an invoice passes each reminder day.
              </p>
            </div>
            <Switch
              checked={!!settings.reminders_enabled}
              onCheckedChange={(v) => set("reminders_enabled", v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reminder days after due date</Label>
            <Input
              value={(settings.reminder_days ?? []).join(", ")}
              onChange={(e) =>
                set(
                  "reminder_days",
                  e.target.value
                    .split(",")
                    .map((x) => Number(x.trim()))
                    .filter((n) => Number.isFinite(n) && n > 0),
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reminder subject</Label>
            <Input
              value={settings.reminder_email_subject ?? ""}
              onChange={(e) => set("reminder_email_subject", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reminder body</Label>
            <Textarea
              rows={7}
              value={settings.reminder_email_body ?? ""}
              onChange={(e) => set("reminder_email_body", e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>Accounting sync enabled</Label>
              <p className="text-xs text-muted-foreground">
                Turn on once a Sage SDK connector or middleware account is configured.
              </p>
            </div>
            <Switch
              checked={!!settings.accounting_sync_enabled}
              onCheckedChange={(v) => set("accounting_sync_enabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save settings
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Accounting sync log</CardTitle>
            <CardDescription>Every push/pull attempt, with retry.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No sync activity yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Retries</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(l.last_attempt_at).toLocaleString("en-GB")}
                    </TableCell>
                    <TableCell className="uppercase">{l.provider}</TableCell>
                    <TableCell className="capitalize">{l.direction}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          l.status === "error"
                            ? "border-destructive/30 bg-destructive/15 text-destructive"
                            : l.status === "success"
                              ? "border-primary/30 bg-primary/15 text-primary"
                              : ""
                        }
                      >
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-xs">{l.message}</TableCell>
                    <TableCell className="text-right">{l.retry_count}</TableCell>
                    <TableCell>
                      {l.status === "error" && (
                        <Button size="sm" variant="ghost" onClick={() => retry(l)}>
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FinanceSettingsTab;
