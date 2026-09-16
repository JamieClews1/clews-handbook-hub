import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2 } from "lucide-react";
import { incVatFromExc, type PermitPricingRow } from "@/lib/permits";
import { usePermitCouncils, usePermitPricing, usePermitSettings, type PermitCouncil, type PermitSettings } from "@/hooks/usePermits";

type DraftRow = PermitPricingRow & { __new?: boolean; __dirty?: boolean };

export function PermitSettingsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: pricing } = usePermitPricing();
  const { data: councils } = usePermitCouncils();
  const { data: settings } = usePermitSettings();

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [councilRows, setCouncilRows] = useState<PermitCouncil[]>([]);
  const [form, setForm] = useState<PermitSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (pricing) setRows(pricing.map((r) => ({ ...r }))); }, [pricing]);
  useEffect(() => { if (councils) setCouncilRows(councils.map((c) => ({ ...c }))); }, [councils]);
  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);

  const setRow = (id: string, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, __dirty: true } : r)));

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      {
        id: `new-${crypto.randomUUID()}`,
        area: "",
        postcodes: "",
        permit_days: 14,
        price_exc_vat: 0,
        price_inc_vat: 0,
        notice_required: "",
        sort_order: (prev[prev.length - 1]?.sort_order ?? 0) + 10,
        active: true,
        __new: true,
        __dirty: true,
      },
    ]);

  const deleteRow = async (row: DraftRow) => {
    if (row.__new) {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      return;
    }
    const { error } = await supabase.from("permit_pricing").delete().eq("id", row.id);
    if (error) return toast({ title: "Could not delete", description: error.message, variant: "destructive" });
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    qc.invalidateQueries({ queryKey: ["permit_pricing"] });
  };

  const saveRates = async () => {
    setSaving(true);
    try {
      const dirty = rows.filter((r) => r.__dirty);
      for (const r of dirty) {
        const payload = {
          area: r.area,
          postcodes: r.postcodes,
          permit_days: Number(r.permit_days) || 0,
          price_exc_vat: Number(r.price_exc_vat) || 0,
          price_inc_vat: incVatFromExc(Number(r.price_exc_vat) || 0),
          notice_required: r.notice_required,
          sort_order: Number(r.sort_order) || 0,
          active: r.active,
        };
        if (r.__new) {
          const { error } = await supabase.from("permit_pricing").insert(payload);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("permit_pricing").update(payload).eq("id", r.id);
          if (error) throw error;
        }
      }
      toast({ title: "Permit rates saved" });
      qc.invalidateQueries({ queryKey: ["permit_pricing"] });
    } catch (e: any) {
      toast({ title: "Could not save rates", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveCouncil = async (c: PermitCouncil) => {
    const { error } = await supabase
      .from("permit_councils")
      .update({
        council_name: c.council_name,
        application_emails: c.application_emails,
        cc_emails: c.cc_emails,
        portal_url: c.portal_url,
        notes: c.notes,
      })
      .eq("id", c.id);
    if (error) return toast({ title: "Could not save council", description: error.message, variant: "destructive" });
    toast({ title: `${c.area} contacts saved` });
    qc.invalidateQueries({ queryKey: ["permit_councils"] });
  };

  const saveSettings = async () => {
    if (!form) return;
    const { id, ...rest } = form;
    const { error } = await supabase.from("permit_settings").update(rest).eq("id", id);
    if (error) return toast({ title: "Could not save settings", description: error.message, variant: "destructive" });
    toast({ title: "Permit settings saved" });
    qc.invalidateQueries({ queryKey: ["permit_settings"] });
  };

  return (
    <div className="space-y-6">
      {/* Rates */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Council permit rates</CardTitle>
            <CardDescription>
              One row per area and notice period. Inc VAT is calculated automatically (Exc VAT × 1.2).
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add row
            </Button>
            <Button size="sm" onClick={saveRates} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save rates"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Area</TableHead>
                <TableHead className="min-w-[200px]">Postcodes</TableHead>
                <TableHead className="w-[80px]">Days</TableHead>
                <TableHead className="w-[110px]">Exc VAT</TableHead>
                <TableHead className="w-[100px]">Inc VAT</TableHead>
                <TableHead className="min-w-[200px]">Notice required</TableHead>
                <TableHead className="w-[80px]">Order</TableHead>
                <TableHead className="w-[70px]">Active</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Input value={r.area} onChange={(e) => setRow(r.id, { area: e.target.value })} /></TableCell>
                  <TableCell><Input value={r.postcodes} onChange={(e) => setRow(r.id, { postcodes: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" value={r.permit_days} onChange={(e) => setRow(r.id, { permit_days: Number(e.target.value) })} /></TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={r.price_exc_vat}
                      onChange={(e) => setRow(r.id, { price_exc_vat: Number(e.target.value), price_inc_vat: incVatFromExc(Number(e.target.value)) })}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    £{incVatFromExc(Number(r.price_exc_vat) || 0).toFixed(2)}
                  </TableCell>
                  <TableCell><Input value={r.notice_required ?? ""} onChange={(e) => setRow(r.id, { notice_required: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" value={r.sort_order} onChange={(e) => setRow(r.id, { sort_order: Number(e.target.value) })} /></TableCell>
                  <TableCell><Switch checked={r.active} onCheckedChange={(v) => setRow(r.id, { active: v })} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteRow(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Councils */}
      <Card>
        <CardHeader>
          <CardTitle>Council contacts</CardTitle>
          <CardDescription>Where each area's permit applications are emailed. Separate several addresses with commas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {councilRows.map((c, idx) => (
            <div key={c.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.area}</span>
                  {c.application_emails.length === 0 && (
                    <Badge variant="outline" className="text-warning border-warning text-[10px]">No email set</Badge>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => saveCouncil(c)} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Council name</Label>
                  <Input
                    value={c.council_name ?? ""}
                    onChange={(e) => setCouncilRows((prev) => prev.map((x, i) => (i === idx ? { ...x, council_name: e.target.value } : x)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Permit portal / notes URL</Label>
                  <Input
                    value={c.portal_url ?? ""}
                    onChange={(e) => setCouncilRows((prev) => prev.map((x, i) => (i === idx ? { ...x, portal_url: e.target.value } : x)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Application email(s)</Label>
                  <Input
                    value={c.application_emails.join(", ")}
                    onChange={(e) =>
                      setCouncilRows((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, application_emails: splitEmails(e.target.value) } : x)),
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CC email(s)</Label>
                  <Input
                    value={c.cc_emails.join(", ")}
                    onChange={(e) =>
                      setCouncilRows((prev) => prev.map((x, i) => (i === idx ? { ...x, cc_emails: splitEmails(e.target.value) } : x)))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  rows={2}
                  value={c.notes ?? ""}
                  onChange={(e) => setCouncilRows((prev) => prev.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)))}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Automation + templates */}
      {form && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Automation and emails</CardTitle>
              <CardDescription>
                Placeholders: {"{{job_number}} {{customer_name}} {{site_address}} {{site_postcode}} {{skip_size}} {{area}} {{start_date}} {{expiry_date}} {{permit_days}} {{permit_reference}} {{price_exc_vat}} {{hours_remaining}}"}
              </CardDescription>
            </div>
            <Button size="sm" onClick={saveSettings} className="gap-1.5">
              <Save className="h-4 w-4" /> Save settings
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ToggleRow
                label="Send applications automatically"
                hint="When off, an application email is prepared and waits for someone to press send."
                checked={form.auto_send_applications}
                onChange={(v) => setForm({ ...form, auto_send_applications: v })}
              />
              <ToggleRow
                label="Confirm permits from council replies"
                hint="Reads the orders inbox and marks a permit confirmed when the council replies."
                checked={form.auto_confirm_from_replies}
                onChange={(v) => setForm({ ...form, auto_confirm_from_replies: v })}
              />
              <ToggleRow
                label="Daily expiry check"
                hint="Emails the chase recipient when a permit is close to expiry and the skip is still on site."
                checked={form.expiry_check_enabled}
                onChange={(v) => setForm({ ...form, expiry_check_enabled: v })}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Chase lead time (hours)</Label>
                <Input
                  type="number"
                  value={form.chase_lead_hours}
                  onChange={(e) => setForm({ ...form, chase_lead_hours: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chase recipient</Label>
                <Input value={form.chase_recipient} onChange={(e) => setForm({ ...form, chase_recipient: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sender name</Label>
                <Input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sender email</Label>
                <Input value={form.sender_email} onChange={(e) => setForm({ ...form, sender_email: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">Must use the verified domain: noreply.clewsrecycling.co.uk</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Application email subject</Label>
              <Input value={form.application_subject} onChange={(e) => setForm({ ...form, application_subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Application email body</Label>
              <Textarea rows={8} value={form.application_body} onChange={(e) => setForm({ ...form, application_body: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expiry chase subject</Label>
              <Input value={form.chase_subject} onChange={(e) => setForm({ ...form, chase_subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expiry chase body</Label>
              <Textarea rows={8} value={form.chase_body} onChange={(e) => setForm({ ...form, chase_body: e.target.value })} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="pr-3">
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function splitEmails(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
