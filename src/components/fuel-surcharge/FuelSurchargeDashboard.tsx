import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Fuel, Truck, MapPin, Hash, TrendingUp } from "lucide-react";
import {
  calculateSurcharge,
  formatGBP,
  type FuelSurchargeRate,
  type PostcodeZoneRow,
  type RawJob,
} from "@/lib/fuel-surcharge";

export default function FuelSurchargeDashboard() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ job: RawJob; amount: number; vehicle: string | null; customer: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      const startStr = start.toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const [ratesRes, zonesRes] = await Promise.all([
        supabase.from("fuel_surcharge_rates").select("*"),
        supabase.from("postcode_zones").select("zone_name, postcodes"),
      ]);
      const rates = (ratesRes.data ?? []) as FuelSurchargeRate[];
      const zones = (zonesRes.data ?? []) as PostcodeZoneRow[];

      const all: RawJob[] = [];
      let offset = 0;
      while (true) {
        const { data } = await supabase
          .from("data_hub_jobs")
          .select("id, job_number, source, job_date, customer, site, movement_type, job_type, container_type, vehicle_registration, raw")
          .gte("job_date", startStr)
          .lte("job_date", today)
          .range(offset, offset + 999);
        const batch = (data ?? []) as RawJob[];
        all.push(...batch);
        if (batch.length < 1000) break;
        offset += 1000;
        if (offset > 50000) break;
      }

      const computed = all
        .map((j) => {
          const c = calculateSurcharge(j, rates, zones);
          return { job: j, amount: c.applied ? c.surcharge_amount : 0, vehicle: c.vehicle_category, customer: j.customer, applied: c.applied };
        })
        .filter((r) => r.applied);

      setRows(computed);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const thisMonth = rows.filter((r) => (r.job.job_date ?? "") >= monthStart);
    const totalThisMonth = thisMonth.reduce((s, r) => s + r.amount, 0);

    const byCustomer = new Map<string, { count: number; total: number }>();
    rows.forEach((r) => {
      const k = r.customer ?? "(unknown)";
      const cur = byCustomer.get(k) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += r.amount;
      byCustomer.set(k, cur);
    });

    const byVehicle = new Map<string, { count: number; total: number }>();
    rows.forEach((r) => {
      const k = r.vehicle ?? "(unknown)";
      const cur = byVehicle.get(k) ?? { count: 0, total: 0 };
      cur.count++;
      cur.total += r.amount;
      byVehicle.set(k, cur);
    });

    return {
      total,
      totalThisMonth,
      countThisMonth: thisMonth.length,
      count: rows.length,
      avg: rows.length ? total / rows.length : 0,
      byCustomer: Array.from(byCustomer.entries()).map(([k, v]) => ({ name: k, ...v })).sort((a, b) => b.total - a.total),
      byVehicle: Array.from(byVehicle.entries()).map(([k, v]) => ({ name: k, ...v })).sort((a, b) => b.total - a.total),
    };
  }, [rows]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI icon={<Fuel className="h-4 w-4" />} label="Total this month" value={formatGBP(stats.totalThisMonth)} />
        <KPI icon={<Hash className="h-4 w-4" />} label="Jobs this month" value={stats.countThisMonth.toLocaleString()} />
        <KPI icon={<TrendingUp className="h-4 w-4" />} label="Total (last ~60d)" value={formatGBP(stats.total)} />
        <KPI icon={<Truck className="h-4 w-4" />} label="Surcharged jobs" value={stats.count.toLocaleString()} />
        <KPI icon={<MapPin className="h-4 w-4" />} label="Avg / job" value={formatGBP(stats.avg)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Surcharge by Customer</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byCustomer.slice(0, 25).map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="max-w-[240px] truncate">{r.name}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right font-medium">{formatGBP(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Surcharge by Vehicle Category</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byVehicle.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                    <TableCell className="text-right font-medium">{formatGBP(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
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
