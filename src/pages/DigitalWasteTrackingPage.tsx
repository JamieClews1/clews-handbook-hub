import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Search, Truck, Weight, Package, Info, Radio, Calendar, Pencil, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import clewsLogo from "@/assets/clews-logo.png";
import { Json } from "@/integrations/supabase/types";

interface Row {
  id: string;
  job_number: string;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  driver: string | null;
  vehicle_registration: string | null;
  waste_description: string | null;
  ewc: string | null;
  container_type: string | null;
  weight_t: number | null;
  movement_type: string | null;
  raw: Json;
}

type Override = {
  carrier_registration?: string;
  carrier_name?: string;
  physical_form?: string;
  vehicle_registration?: string;
  ewc?: string;
  waste_description?: string;
  container_type?: string;
  customer?: string;
  means_of_transport?: string;
};

const rawField = (raw: Json, keys: string[]): string => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  for (const k of keys) {
    const v = (raw as Record<string, unknown>)[k];
    if (v != null && v !== "") return String(v);
  }
  return "";
};

const DigitalWasteTrackingPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dwt-inbound", date],
    queryFn: async () => {
      const all: Row[] = [];
      let from = 0;
      const ps = 1000;
      let more = true;
      while (more) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("id, job_number, job_date, customer, site, driver, vehicle_registration, waste_description, ewc, container_type, weight_t, movement_type, raw")
          .eq("source", "midweigh")
          .eq("job_date", date)
          .order("job_number", { ascending: false })
          .range(from, from + ps - 1);
        if (error) throw error;
        if (data) all.push(...(data as Row[]));
        more = (data?.length ?? 0) === ps;
        from += ps;
      }
      return all.filter((r) => {
        const mt = (r.movement_type ?? "").toUpperCase();
        return mt === "" || mt === "INWARD" || mt === "IN" || mt.includes("IN");
      });
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const jobIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const { data: overridesMap = {} } = useQuery({
    queryKey: ["dwt-overrides", date, jobIds.length],
    queryFn: async () => {
      if (jobIds.length === 0) return {} as Record<string, Override>;
      const { data, error } = await supabase
        .from("dwt_job_overrides")
        .select("job_id, overrides")
        .in("job_id", jobIds);
      if (error) throw error;
      const map: Record<string, Override> = {};
      (data ?? []).forEach((r: any) => { map[r.job_id] = (r.overrides ?? {}) as Override; });
      return map;
    },
    enabled: !!user && jobIds.length > 0,
  });

  const merged = useMemo(() => {
    return rows.map((r) => {
      const ov = overridesMap[r.id] ?? {};
      return {
        row: r,
        ticket: r.job_number,
        time: rawField(r.raw, ["Time In", "TimeIn", "Time", "Weigh In Time", "In Time"]),
        customer: ov.customer || r.customer || "",
        site: r.site || "",
        vehicle: ov.vehicle_registration || r.vehicle_registration || "",
        carrierReg: ov.carrier_registration || rawField(r.raw, ["Carrier Registration", "Carrier Reg", "Haulier Reg", "Carrier Vehicle Reg", "Carrier Reg No"]),
        carrierName: ov.carrier_name || rawField(r.raw, ["Carrier", "Haulier", "Carrier Name", "Transport"]),
        physicalForm: ov.physical_form || rawField(r.raw, ["Physical Form", "Form", "Material Form", "Waste Physical Form", "Physical State"]),
        ewc: ov.ewc || r.ewc || "",
        waste: ov.waste_description || r.waste_description || "",
        container: ov.container_type || r.container_type || "",
        meansOfTransport: ov.means_of_transport || rawField(r.raw, ["Means of Transport", "Transport Mode", "Mode of Transport"]) || "Road",
        weightT: r.weight_t != null ? Number(r.weight_t) / 1000 : null,
      };
    });
  }, [rows, overridesMap]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return merged;
    return merged.filter((m) =>
      [m.ticket, m.customer, m.site, m.vehicle, m.waste, m.ewc, m.carrierName, m.carrierReg]
        .some((v) => (v ?? "").toLowerCase().includes(term))
    );
  }, [merged, search]);

  const totalWeight = useMemo(
    () => filtered.reduce((sum, m) => sum + (m.weightT ?? 0), 0),
    [filtered]
  );
  const uniqueEwc = useMemo(
    () => new Set(filtered.map((m) => m.ewc.trim()).filter(Boolean)).size,
    [filtered]
  );
  const incompleteCount = useMemo(
    () => filtered.filter((m) => !m.customer || !m.vehicle || !m.carrierReg || !m.carrierName || !m.physicalForm || !m.ewc || !m.waste || !m.container || m.weightT == null).length,
    [filtered]
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const missingCls = "bg-destructive/10 text-destructive font-semibold";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/portal">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Portal</span>
              </Button>
            </Link>
            <img src={clewsLogo} alt="Clews Recycling" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">Digital Waste Tracking</h1>
                <Badge variant="outline" className="gap-1.5">
                  <Radio className="h-3 w-3" /> API not connected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Daily record of every waste job received into Clews Recycling (Midweigh). From 1st October
                this dataset will be submitted live to the government Digital Waste Tracking (DWT) service
                via the Receipt of Waste API.
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Phase 1 — Receipt of Waste (RoW)</AlertTitle>
            <AlertDescription>
              As the waste receiver we must submit each accepted load at the point of receipt. Any field
              shown in <span className="text-destructive font-semibold">red</span> is missing and must be
              completed — click the pencil to edit before submission.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <StatCard icon={Truck} label="Loads received" value={filtered.length.toString()} />
            <StatCard icon={Weight} label="Total weight" value={`${totalWeight.toFixed(3)} t`} />
            <StatCard icon={Package} label="Unique EWC codes" value={uniqueEwc.toString()} />
            <StatCard icon={AlertTriangle} label="Incomplete rows" value={incompleteCount.toString()} tone={incompleteCount > 0 ? "warn" : "ok"} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[170px]"
                max={format(new Date(), "yyyy-MM-dd")}
              />
              <Button variant="outline" size="sm" onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}>
                Today
              </Button>
            </div>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search job, customer, vehicle, EWC, waste..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Loading incoming loads…</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Truck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No Midweigh loads received on {format(parseISO(date), "EEE d MMM yyyy")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b border-border/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Ticket #</th>
                        <th className="text-left px-3 py-2 font-medium">Time</th>
                        <th className="text-left px-3 py-2 font-medium">Customer / Producer</th>
                        <th className="text-left px-3 py-2 font-medium">Vehicle</th>
                        <th className="text-left px-3 py-2 font-medium">Carrier Reg</th>
                        <th className="text-left px-3 py-2 font-medium">Carrier Name</th>
                        <th className="text-left px-3 py-2 font-medium">Physical Form</th>
                        <th className="text-left px-3 py-2 font-medium">EWC</th>
                        <th className="text-left px-3 py-2 font-medium">Waste description</th>
                        <th className="text-left px-3 py-2 font-medium">Container</th>
                        <th className="text-left px-3 py-2 font-medium">Means of Transport</th>
                        <th className="text-right px-3 py-2 font-medium">Weight (t)</th>
                        <th className="text-left px-3 py-2 font-medium">DWT</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m) => (
                        <tr key={m.row.id} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono font-semibold">{m.ticket}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{m.time || "—"}</td>
                          <td className={`px-3 py-2 ${!m.customer ? missingCls : ""}`}>
                            <div className="font-medium">{m.customer || "Missing"}</div>
                            {m.site && <div className="text-xs text-muted-foreground">{m.site}</div>}
                          </td>
                          <td className={`px-3 py-2 font-mono ${!m.vehicle ? missingCls : ""}`}>{m.vehicle || "Missing"}</td>
                          <td className={`px-3 py-2 font-mono ${!m.carrierReg ? missingCls : ""}`}>{m.carrierReg || "Missing"}</td>
                          <td className={`px-3 py-2 ${!m.carrierName ? missingCls : ""}`}>{m.carrierName || "Missing"}</td>
                          <td className={`px-3 py-2 ${!m.physicalForm ? missingCls : ""}`}>{m.physicalForm || "Missing"}</td>
                          <td className={`px-3 py-2 font-mono ${!m.ewc ? missingCls : ""}`}>{m.ewc || "Missing"}</td>
                          <td className={`px-3 py-2 ${!m.waste ? missingCls : ""}`}>{m.waste || "Missing"}</td>
                          <td className={`px-3 py-2 ${!m.container ? missingCls : ""}`}>{m.container || "Missing"}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-semibold ${m.weightT == null ? missingCls : ""}`}>
                            {m.weightT != null ? m.weightT.toFixed(3) : "Missing"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="text-[10px]">Pending API</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(m.row)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t border-border/50 font-semibold">
                      <tr>
                        <td className="px-3 py-2" colSpan={10}>Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">{totalWeight.toFixed(3)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Data source: Midweigh weighbridge (data_hub_jobs). Manual edits are saved to dwt_job_overrides
            and take precedence over the raw ticket. Once the DWT Receipt of Waste API is connected each
            completed row will POST at the point of receipt and store its returned WT-ID.
          </p>
        </div>
      </main>

      <EditDialog
        row={editing}
        currentOverride={editing ? overridesMap[editing.id] : undefined}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["dwt-overrides", date] });
          setEditing(null);
        }}
      />
    </div>
  );
};

function EditDialog({
  row,
  currentOverride,
  onClose,
  onSaved,
}: {
  row: Row | null;
  currentOverride?: Override;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Override>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    setForm({
      customer: currentOverride?.customer ?? row.customer ?? "",
      vehicle_registration: currentOverride?.vehicle_registration ?? row.vehicle_registration ?? "",
      carrier_registration: currentOverride?.carrier_registration ?? rawField(row.raw, ["Carrier Registration", "Carrier Reg", "Haulier Reg", "Carrier Vehicle Reg", "Carrier Reg No"]),
      carrier_name: currentOverride?.carrier_name ?? rawField(row.raw, ["Carrier", "Haulier", "Carrier Name", "Transport"]),
      physical_form: currentOverride?.physical_form ?? rawField(row.raw, ["Physical Form", "Form", "Material Form", "Waste Physical Form", "Physical State"]),
      ewc: currentOverride?.ewc ?? row.ewc ?? "",
      waste_description: currentOverride?.waste_description ?? row.waste_description ?? "",
      container_type: currentOverride?.container_type ?? row.container_type ?? "",
    });
  }, [row, currentOverride]);

  if (!row) return null;

  const save = async () => {
    setSaving(true);
    try {
      const cleaned: Override = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v != null && String(v).trim() !== "") (cleaned as any)[k] = String(v).trim();
      });
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("dwt_job_overrides")
        .upsert(
          { job_id: row.id, overrides: cleaned as any, updated_by: userRes.user?.id ?? null },
          { onConflict: "job_id" }
        );
      if (error) throw error;
      toast.success("DWT details saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit DWT details — Ticket {row.job_number}</DialogTitle>
          <DialogDescription>
            Complete any missing fields required for Digital Waste Tracking submission.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <Field label="Customer / Producer" value={form.customer} onChange={(v) => setForm({ ...form, customer: v })} />
          <Field label="Vehicle Registration" value={form.vehicle_registration} onChange={(v) => setForm({ ...form, vehicle_registration: v })} />
          <Field label="Carrier Registration" value={form.carrier_registration} onChange={(v) => setForm({ ...form, carrier_registration: v })} placeholder="e.g. CBDU203180" />
          <Field label="Carrier Name" value={form.carrier_name} onChange={(v) => setForm({ ...form, carrier_name: v })} />
          <Field label="Physical Form" value={form.physical_form} onChange={(v) => setForm({ ...form, physical_form: v })} placeholder="Solid / Liquid / Sludge / Mixed" />
          <Field label="EWC Code" value={form.ewc} onChange={(v) => setForm({ ...form, ewc: v })} placeholder="e.g. 20 03 01" />
          <Field label="Container" value={form.container_type} onChange={(v) => setForm({ ...form, container_type: v })} />
          <div className="col-span-2">
            <Field label="Waste Description" value={form.waste_description} onChange={(v) => setForm({ ...form, waste_description: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  const missing = !value || value.trim() === "";
  return (
    <div className="space-y-1.5">
      <Label className={missing ? "text-destructive" : ""}>{label}{missing && " *"}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={missing ? "border-destructive/60" : ""} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = "default" }: { icon: any; label: string; value: string; tone?: "default" | "warn" | "ok" }) {
  const toneCls =
    tone === "warn" ? "bg-destructive/10 text-destructive" :
    tone === "ok" ? "bg-emerald-500/10 text-emerald-600" :
    "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DigitalWasteTrackingPage;
