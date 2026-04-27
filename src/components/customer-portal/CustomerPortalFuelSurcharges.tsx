import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Search, Fuel, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import {
  buildLinkedMidweighTickets,
  calculateSurcharge,
  formatGBP,
  type FuelSurchargeRate,
  type PostcodeZoneRow,
  type RawJob,
  type SurchargeCalc,
} from "@/lib/fuel-surcharge";

interface Props {
  customerId: string;
  customerName: string;
  accessibleSiteIds?: string[];
}

interface CalcRow {
  job: RawJob;
  calc: SurchargeCalc;
}

export function CustomerPortalFuelSurcharges({ customerId, customerName, accessibleSiteIds }: Props) {
  const { toast } = useToast();
  const today = new Date();
  // Surcharges only effective from 1 April 2026 — default to current month or that date, whichever is later
  const earliest = new Date("2026-04-01");
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultStart = monthStart > earliest ? monthStart : earliest;

  const [from, setFrom] = useState(defaultStart.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const [rates, setRates] = useState<FuelSurchargeRate[]>([]);
  const [zones, setZones] = useState<PostcodeZoneRow[]>([]);
  const [rows, setRows] = useState<CalcRow[]>([]);

  async function fetchAll() {
    setLoading(true);
    try {
      // Resolve customer's data_hub aliases (customer + site name variants)
      let siteQuery = supabase
        .from("customer_sites")
        .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5")
        .eq("customer_id", customerId);
      if (accessibleSiteIds) {
        if (accessibleSiteIds.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }
        siteQuery = supabase
          .from("customer_sites")
          .select("id, site_name, data_hub_customer, data_hub_site, data_hub_site_2, data_hub_site_3, data_hub_site_4, data_hub_site_5")
          .in("id", accessibleSiteIds);
      }
      const { data: sitesData, error: sitesErr } = await siteQuery;
      if (sitesErr) throw sitesErr;

      const customerAliases = new Set<string>();
      const siteAliases = new Set<string>();
      (sitesData ?? []).forEach((s: any) => {
        if (s.data_hub_customer) customerAliases.add(s.data_hub_customer);
        ["data_hub_site", "data_hub_site_2", "data_hub_site_3", "data_hub_site_4", "data_hub_site_5"]
          .forEach((k) => { if (s[k]) siteAliases.add(s[k]); });
      });

      const [ratesRes, zonesRes] = await Promise.all([
        supabase.from("fuel_surcharge_rates").select("*"),
        supabase.from("postcode_zones").select("zone_name, postcodes"),
      ]);
      if (ratesRes.error) throw ratesRes.error;
      if (zonesRes.error) throw zonesRes.error;
      const ratesData = (ratesRes.data ?? []) as FuelSurchargeRate[];
      const zonesData = (zonesRes.data ?? []) as PostcodeZoneRow[];
      setRates(ratesData);
      setZones(zonesData);

      // Pull jobs scoped to customer aliases (and optionally site names)
      const all: RawJob[] = [];
      if (customerAliases.size === 0 && siteAliases.size === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      let offset = 0;
      const PAGE = 1000;
      while (true) {
        let q = supabase
          .from("data_hub_jobs")
          .select("id, job_number, source, job_date, customer, site, movement_type, job_type, container_type, vehicle_registration, raw")
          .gte("job_date", from)
          .lte("job_date", to)
          .order("job_date", { ascending: false })
          .range(offset, offset + PAGE - 1);
        if (customerAliases.size > 0) q = q.in("customer", Array.from(customerAliases));
        if (siteAliases.size > 0) q = q.in("site", Array.from(siteAliases));
        const { data, error } = await q;
        if (error) throw error;
        const batch = (data ?? []) as RawJob[];
        all.push(...batch);
        if (batch.length < PAGE) break;
        offset += PAGE;
        if (offset > 50000) break;
      }
      const linked = buildLinkedMidweighTickets(all);
      const computed = all.map((j) => ({ job: j, calc: calculateSurcharge(j, ratesData, zonesData, linked) }));
      setRows(computed);
    } catch (e: any) {
      toast({ title: "Could not load fuel surcharges", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, customerId, accessibleSiteIds?.join(",")]);

  const sites = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.job.site && set.add(r.job.site));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Customer-facing: only show jobs where a surcharge was actually applied
      if (!r.calc.applied) return false;
      if (siteFilter !== "all" && r.job.site !== siteFilter) return false;
      if (vehicleFilter !== "all" && r.calc.vehicle_category !== vehicleFilter) return false;
      if (q) {
        const blob = `${r.job.job_number ?? ""} ${r.job.site ?? ""} ${r.calc.postcode ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, siteFilter, vehicleFilter]);

  const summary = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.calc.surcharge_amount, 0);
    return {
      count: filtered.length,
      total,
      avg: filtered.length ? total / filtered.length : 0,
    };
  }, [filtered]);

  function buildExportRows() {
    return filtered.map((r) => ({
      "Job Date": r.job.job_date,
      "Job Number": r.job.job_number,
      Site: r.job.site,
      "Movement Type": r.job.movement_type,
      "Vehicle Category": r.calc.vehicle_category,
      "Container Type": r.job.container_type,
      Postcode: r.calc.postcode,
      Zone: r.calc.zone,
      "Fuel Surcharge (£)": r.calc.surcharge_amount.toFixed(2),
    }));
  }

  function exportCsv() {
    const data = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuel-surcharges_${customerName}_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportXlsx() {
    const data = buildExportRows();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Fuel Surcharges");
    XLSX.writeFile(wb, `fuel-surcharges_${customerName}_${from}_to_${to}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 flex gap-3 items-start">
          <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground">
            Temporary fuel surcharges are applied from <strong>1 April 2026</strong> on Delivery,
            Exchange and Wait & Load jobs. Rates vary by vehicle category and delivery zone.
            Collections are not surcharged.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-primary" />
            Filters &amp; Export
          </CardTitle>
          <CardDescription>Review and download fuel surcharges applied to your jobs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label>Site</Label>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vehicle</Label>
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Weighbridge Tip">Weighbridge Tip</SelectItem>
                  <SelectItem value="Skips">Skips</SelectItem>
                  <SelectItem value="RoRo">RoRo</SelectItem>
                  <SelectItem value="Artic">Artic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
            <div>
              <Label>Search (job number, site, postcode)</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to filter…" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="flex-1" />
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" onClick={exportXlsx} disabled={!filtered.length}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Surcharged jobs</div>
            <div className="text-2xl font-bold">{summary.count.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total fuel surcharge</div>
            <div className="text-2xl font-bold">{formatGBP(summary.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Average per job</div>
            <div className="text-2xl font-bold">{formatGBP(summary.avg)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Surcharged Jobs ({filtered.length.toLocaleString()})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Job #</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Movement</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Postcode</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead className="text-right">Surcharge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((r) => (
                    <TableRow key={r.job.id}>
                      <TableCell className="whitespace-nowrap">{r.job.job_date}</TableCell>
                      <TableCell className="font-mono text-xs">{r.job.job_number}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.job.site}</TableCell>
                      <TableCell>{r.job.movement_type}</TableCell>
                      <TableCell>{r.calc.vehicle_category ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.calc.postcode ?? "—"}</TableCell>
                      <TableCell>
                        {r.calc.zone ?? "—"}
                        {r.calc.zone_was_fallback && (
                          <Badge variant="outline" className="ml-1 text-[10px]">fallback</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatGBP(r.calc.surcharge_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No fuel surcharges in this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing first 500 rows. Export to see all {filtered.length.toLocaleString()}.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
