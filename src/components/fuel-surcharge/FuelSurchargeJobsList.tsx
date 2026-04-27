import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Search } from "lucide-react";
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

interface CalcRow {
  job: RawJob;
  calc: SurchargeCalc;
}

export default function FuelSurchargeJobsList() {
  const { toast } = useToast();
  const today = new Date();
  const defaultStart = new Date(Math.max(new Date("2026-04-01").getTime(), new Date(today.getFullYear(), today.getMonth(), 1).getTime()));

  const [from, setFrom] = useState(defaultStart.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [appliedOnly, setAppliedOnly] = useState(true);
  const [loading, setLoading] = useState(false);

  const [rates, setRates] = useState<FuelSurchargeRate[]>([]);
  const [zones, setZones] = useState<PostcodeZoneRow[]>([]);
  const [rows, setRows] = useState<CalcRow[]>([]);

  async function fetchAll() {
    setLoading(true);
    const [ratesRes, zonesRes] = await Promise.all([
      supabase.from("fuel_surcharge_rates").select("*"),
      supabase.from("postcode_zones").select("zone_name, postcodes"),
    ]);
    if (ratesRes.error) toast({ title: "Rates load failed", description: ratesRes.error.message, variant: "destructive" });
    if (zonesRes.error) toast({ title: "Zones load failed", description: zonesRes.error.message, variant: "destructive" });
    const ratesData = (ratesRes.data ?? []) as FuelSurchargeRate[];
    const zonesData = (zonesRes.data ?? []) as PostcodeZoneRow[];
    setRates(ratesData);
    setZones(zonesData);

    // Page through jobs (Supabase 1000-row limit)
    const all: RawJob[] = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("data_hub_jobs")
        .select("id, job_number, source, job_date, customer, site, movement_type, job_type, container_type, vehicle_registration, raw")
        .gte("job_date", from)
        .lte("job_date", to)
        .order("job_date", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (error) {
        toast({ title: "Jobs load failed", description: error.message, variant: "destructive" });
        break;
      }
      const batch = (data ?? []) as RawJob[];
      all.push(...batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
      if (offset > 50000) break; // safety
    }
    const linked = buildLinkedMidweighTickets(all);
    const computed = all.map((j) => ({ job: j, calc: calculateSurcharge(j, ratesData, zonesData, linked) }));
    setRows(computed);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const customers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.job.customer && set.add(r.job.customer));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (appliedOnly && !r.calc.applied) return false;
      if (vehicleFilter !== "all" && r.calc.vehicle_category !== vehicleFilter) return false;
      if (zoneFilter !== "all" && r.calc.zone !== zoneFilter) return false;
      if (customerFilter !== "all" && r.job.customer !== customerFilter) return false;
      if (q) {
        const blob = `${r.job.job_number ?? ""} ${r.job.customer ?? ""} ${r.job.site ?? ""} ${r.calc.postcode ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, vehicleFilter, zoneFilter, customerFilter, appliedOnly]);

  const summary = useMemo(() => {
    const applied = filtered.filter((r) => r.calc.applied);
    const total = applied.reduce((s, r) => s + r.calc.surcharge_amount, 0);
    return {
      count: applied.length,
      total,
      avg: applied.length ? total / applied.length : 0,
    };
  }, [filtered]);

  function buildExportRows() {
    return filtered.map((r) => ({
      "Job Date": r.job.job_date,
      "Job Number": r.job.job_number,
      Source: r.job.source,
      Customer: r.job.customer,
      Site: r.job.site,
      "Movement Type": r.job.movement_type,
      "Vehicle Category": r.calc.vehicle_category,
      "Container Type": r.job.container_type,
      Postcode: r.calc.postcode,
      Zone: r.calc.zone,
      "Zone Fallback": r.calc.zone_was_fallback ? "Yes (defaulted to Zone 3)" : "No",
      "Fuel Surcharge Applied": r.calc.applied ? "Yes" : "No",
      "Fuel Surcharge (£)": r.calc.applied ? r.calc.surcharge_amount.toFixed(2) : "",
      "Reason (if not applied)": r.calc.applied ? "" : r.calc.reason ?? "",
      Vehicle: r.job.vehicle_registration,
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
    a.download = `fuel-surcharge_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportXlsx() {
    const data = buildExportRows();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Fuel Surcharges");
    XLSX.writeFile(wb, `fuel-surcharge_${from}_to_${to}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filters & Export</CardTitle>
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
            <div>
              <Label>Zone</Label>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="NA">NA</SelectItem>
                  <SelectItem value="Zone 1">Zone 1</SelectItem>
                  <SelectItem value="Zone 2">Zone 2</SelectItem>
                  <SelectItem value="Zone 3">Zone 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Customer</Label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Search (job number, customer, site, postcode)</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type to filter…" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant={appliedOnly ? "default" : "outline"} size="sm" onClick={() => setAppliedOnly((v) => !v)}>
              {appliedOnly ? "Showing surcharged jobs only" : "Showing all jobs"}
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Surcharged jobs</div><div className="text-2xl font-bold">{summary.count.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total surcharge</div><div className="text-2xl font-bold">{formatGBP(summary.total)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Avg per job</div><div className="text-2xl font-bold">{formatGBP(summary.avg)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Jobs ({filtered.length.toLocaleString()})</CardTitle></CardHeader>
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
                    <TableHead>Customer</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Movement</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Postcode</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead className="text-right">Surcharge</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((r) => (
                    <TableRow key={r.job.id}>
                      <TableCell className="whitespace-nowrap">{r.job.job_date}</TableCell>
                      <TableCell className="font-mono text-xs">{r.job.job_number}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.job.customer}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{r.job.site}</TableCell>
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
                        {r.calc.applied ? formatGBP(r.calc.surcharge_amount) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.calc.applied ? (
                          <Badge>Applied</Badge>
                        ) : (
                          <Badge variant="secondary" title={r.calc.reason}>Skipped</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No matching jobs</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <p className="text-xs text-muted-foreground mt-2">Showing first 500 rows. Export to see all {filtered.length.toLocaleString()}.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
