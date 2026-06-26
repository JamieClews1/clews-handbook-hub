import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Fuel, Truck, Hash, PoundSterling, Percent, Download, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatGBP } from "@/lib/fuel-surcharge";
import * as XLSX from "xlsx";

interface BiffaSettings {
  id: string;
  percentage: number;
  included_customers: string[];
  haulier_filter: string;
}

interface BiffaJob {
  id: string;
  job_number: string | null;
  job_date: string | null;
  customer: string | null;
  site: string | null;
  weight_t: number | null;
  haulier: string | null;
  product: string | null;
  total_price: number;
}

interface Props {
  canEdit: boolean;
}

function firstOfMonthsAgo(monthsBack: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function BiffaFuelSurcharge({ canEdit }: Props) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<BiffaSettings | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // editable form state
  const [percentage, setPercentage] = useState("0");
  const [included, setIncluded] = useState<string[]>([]);
  const [haulierFilter, setHaulierFilter] = useState("Biffa");

  // report filters
  const [fromDate, setFromDate] = useState(firstOfMonthsAgo(3));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobs, setJobs] = useState<BiffaJob[]>([]);
  const [calcLoading, setCalcLoading] = useState(false);

  // Load settings + available Biffa customers
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: settingsRows }, { data: custRows }] = await Promise.all([
        supabase.from("biffa_fuel_surcharge_settings").select("*").limit(1),
        supabase
          .from("data_hub_jobs")
          .select("customer")
          .eq("source", "midweigh")
          .ilike("customer", "%biffa%"),
      ]);

      const s = (settingsRows ?? [])[0] as BiffaSettings | undefined;
      if (s) {
        setSettings(s);
        setPercentage(String(s.percentage ?? 0));
        setIncluded(s.included_customers ?? []);
        setHaulierFilter(s.haulier_filter ?? "Biffa");
      }

      const unique = Array.from(
        new Set((custRows ?? []).map((r: any) => r.customer).filter(Boolean) as string[]),
      ).sort();
      setAvailableCustomers(unique);
      setLoading(false);
    })();
  }, []);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    const pct = Number(percentage);
    if (Number.isNaN(pct) || pct < 0) {
      toast({ title: "Invalid percentage", variant: "destructive" });
      setSaving(false);
      return;
    }
    const payload = {
      percentage: pct,
      included_customers: included,
      haulier_filter: haulierFilter.trim() || "Biffa",
    };
    const { error } = await supabase
      .from("biffa_fuel_surcharge_settings")
      .update(payload)
      .eq("id", settings.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setSettings({ ...settings, ...payload });
      toast({ title: "Settings saved" });
    }
    setSaving(false);
  }

  const runCalc = useCallback(async () => {
    if (!settings) return;
    if (included.length === 0) {
      setJobs([]);
      return;
    }
    setCalcLoading(true);
    const all: any[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("id, job_number, job_date, customer, site, weight_t, raw")
        .eq("source", "midweigh")
        .in("customer", included)
        .gte("job_date", fromDate)
        .lte("job_date", toDate)
        .range(offset, offset + 999);
      if (error) {
        toast({ title: "Failed to load loads", description: error.message, variant: "destructive" });
        break;
      }
      const batch = data ?? [];
      all.push(...batch);
      if (batch.length < 1000) break;
      offset += 1000;
      if (offset > 50000) break;
    }

    const hf = (haulierFilter || "Biffa").toLowerCase().trim();
    const filtered: BiffaJob[] = all
      .map((j) => {
        const raw = (j.raw ?? {}) as Record<string, any>;
        const haulier = raw["Haulier"] ? String(raw["Haulier"]).trim() : null;
        const tp = Number(raw["Total Price"]);
        return {
          id: j.id,
          job_number: j.job_number,
          job_date: j.job_date,
          customer: j.customer,
          site: j.site,
          weight_t: j.weight_t,
          haulier,
          product: raw["Product"] ? String(raw["Product"]) : raw["EWC Desc"] ? String(raw["EWC Desc"]) : null,
          total_price: Number.isFinite(tp) ? tp : 0,
        };
      })
      .filter((j) => (j.haulier ?? "").toLowerCase().startsWith(hf) && j.total_price > 0);

    setJobs(filtered);
    setCalcLoading(false);
  }, [settings, included, fromDate, toDate, haulierFilter, toast]);

  // auto-run once settings are loaded
  useEffect(() => {
    if (settings) runCalc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const pctNum = Number(settings?.percentage ?? 0);

  const stats = useMemo(() => {
    const totalValue = jobs.reduce((s, j) => s + j.total_price, 0);
    const surcharge = totalValue * (pctNum / 100);
    const byCustomer = new Map<string, { count: number; value: number }>();
    jobs.forEach((j) => {
      const k = j.customer ?? "(unknown)";
      const cur = byCustomer.get(k) ?? { count: 0, value: 0 };
      cur.count++;
      cur.value += j.total_price;
      byCustomer.set(k, cur);
    });
    return {
      totalValue,
      surcharge,
      count: jobs.length,
      byCustomer: Array.from(byCustomer.entries())
        .map(([name, v]) => ({ name, ...v, surcharge: v.value * (pctNum / 100) }))
        .sort((a, b) => b.value - a.value),
    };
  }, [jobs, pctNum]);

  function exportXlsx() {
    const rows = jobs.map((j) => ({
      "Ticket": j.job_number,
      "Date": j.job_date,
      "Customer": j.customer,
      "Site": j.site,
      "Haulier": j.haulier,
      "Product": j.product,
      "Weight (kg)": j.weight_t,
      "Load Value (£)": Number(j.total_price.toFixed(2)),
      [`Fuel Surcharge ${pctNum}% (£)`]: Number((j.total_price * (pctNum / 100)).toFixed(2)),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Biffa Fuel Surcharge");
    XLSX.writeFile(wb, `biffa-fuel-surcharge-${fromDate}-to-${toDate}.xlsx`);
  }

  function toggleCustomer(name: string, checked: boolean) {
    setIncluded((prev) => (checked ? [...new Set([...prev, name])] : prev.filter((c) => c !== name)));
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4" /> Biffa Fuel Surcharge Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Applies a percentage charge against the total load value of Biffa-hauliered weighbridge loads only.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Surcharge % of load value</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={percentage}
                  disabled={!canEdit}
                  onChange={(e) => setPercentage(e.target.value)}
                />
                <Percent className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div>
              <Label>Haulier (Biffa-hauliered only)</Label>
              <Input
                value={haulierFilter}
                disabled={!canEdit}
                onChange={(e) => setHaulierFilter(e.target.value)}
                placeholder="Biffa"
              />
              <p className="text-xs text-muted-foreground mt-1">Matches loads whose haulier starts with this text.</p>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Biffa customers to include</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {availableCustomers.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={included.includes(c)}
                    disabled={!canEdit}
                    onCheckedChange={(v) => toggleCustomer(c, v === true)}
                  />
                  <span className="truncate">{c}</span>
                </label>
              ))}
              {availableCustomers.length === 0 && (
                <p className="text-sm text-muted-foreground">No Biffa weighbridge customers found.</p>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calculation Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button variant="secondary" onClick={runCalc} disabled={calcLoading}>
              {calcLoading ? "Calculating…" : "Recalculate"}
            </Button>
            <Button variant="outline" onClick={exportXlsx} disabled={jobs.length === 0}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Hash className="h-4 w-4" />} label="Biffa-hauliered loads" value={stats.count.toLocaleString()} />
        <KPI icon={<PoundSterling className="h-4 w-4" />} label="Total load value" value={formatGBP(stats.totalValue)} />
        <KPI icon={<Percent className="h-4 w-4" />} label="Surcharge rate" value={`${pctNum}%`} />
        <KPI icon={<Fuel className="h-4 w-4" />} label="Total fuel surcharge" value={formatGBP(stats.surcharge)} />
      </div>

      {/* By customer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" /> Surcharge by Customer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Loads</TableHead>
                <TableHead className="text-right">Load value</TableHead>
                <TableHead className="text-right">Surcharge ({pctNum}%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.byCustomer.map((r) => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right">{formatGBP(r.value)}</TableCell>
                  <TableCell className="text-right font-medium">{formatGBP(r.surcharge)}</TableCell>
                </TableRow>
              ))}
              {stats.byCustomer.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No Biffa-hauliered loads for the selected customers and period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail */}
      {jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Load Detail ({jobs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Haulier</TableHead>
                    <TableHead className="text-right">Load value</TableHead>
                    <TableHead className="text-right">Surcharge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs
                    .slice()
                    .sort((a, b) => (b.job_date ?? "").localeCompare(a.job_date ?? ""))
                    .map((j) => (
                      <TableRow key={j.id}>
                        <TableCell>{j.job_number}</TableCell>
                        <TableCell>{j.job_date}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{j.customer}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{j.product}</TableCell>
                        <TableCell><Badge variant="secondary">{j.haulier}</Badge></TableCell>
                        <TableCell className="text-right">{formatGBP(j.total_price)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatGBP(j.total_price * (pctNum / 100))}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
