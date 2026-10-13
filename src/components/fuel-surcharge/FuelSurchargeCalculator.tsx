import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RotateCcw, Save, Calculator, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  calculateFuelSurcharges, DEFAULT_FUEL_CALC_SETTINGS, fuelIncrease, type CalcVehicle, type FuelCalcSettings,
} from "@/lib/fuel-surcharge-calculator";
import { formatGBP, type FuelSurchargeRate } from "@/lib/fuel-surcharge";

const KEY = "fuel_surcharge_calculator";
const VEHICLES: CalcVehicle[] = ["Skips", "RoRo", "Artic"];

/** Surcharge settings + price-per-litre calculator. Never edits the live rates. */
export default function FuelSurchargeCalculator({ canEdit }: { canEdit: boolean }) {
  const [s, setS] = useState<FuelCalcSettings | null>(null);
  const [price, setPrice] = useState("1.45");
  const [rates, setRates] = useState<FuelSurchargeRate[]>([]);
  const [saving, setSaving] = useState(false);
  const [emailTo, setEmailTo] = useState("jamie@clewsrecycling.co.uk");
  const [emailing, setEmailing] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: set }, { data: r }] = await Promise.all([
        supabase.from("pricing_settings").select("setting_value").eq("setting_key", KEY).maybeSingle(),
        supabase.from("fuel_surcharge_rates").select("*").eq("active", true).is("customer_match", null),
      ]);
      const saved = (set?.setting_value ?? {}) as Partial<FuelCalcSettings>;
      setS({ ...DEFAULT_FUEL_CALC_SETTINGS, ...saved,
        round_trip_miles: { ...DEFAULT_FUEL_CALC_SETTINGS.round_trip_miles, ...(saved.round_trip_miles ?? {}) },
        fuel_cost_per_km: { ...DEFAULT_FUEL_CALC_SETTINGS.fuel_cost_per_km, ...(saved.fuel_cost_per_km ?? {}) } });
      setRates((r ?? []) as any);
    })();
  }, []);

  const p = parseFloat(price) || 0;
  const rows = useMemo(() => (s ? calculateFuelSurcharges(p, s) : []), [s, p]);

  if (!s) return <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin" />;

  const current = (v: string, z: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return rates.filter((r) => r.vehicle_category === v && r.zone === z && r.effective_from_date <= today)
      .sort((a, b) => (a.effective_from_date < b.effective_from_date ? 1 : -1))[0];
  };

  const num = (val: number, on: (n: number) => void, step = "0.01") => (
    <Input type="number" step={step} value={Number.isFinite(val) ? val : 0} disabled={!canEdit}
      onChange={(e) => on(parseFloat(e.target.value) || 0)} className="h-9" />
  );
  const set = <K extends keyof FuelCalcSettings>(k: K, v: FuelCalcSettings[K]) => setS({ ...s, [k]: v });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("pricing_settings")
      .upsert({ setting_key: KEY, setting_value: s as any }, { onConflict: "setting_key" });
    setSaving(false);
    error ? toast.error("Couldn't save settings") : toast.success("Surcharge settings saved");
  };

  const inc = fuelIncrease(p, s);

  const emailFigures = async () => {
    setEmailing(true);
    const { error } = await supabase.functions.invoke("send-fuel-surcharge-figures", {
      body: { price_per_litre: p, to_email: emailTo.trim() },
    });
    setEmailing(false);
    error ? toast.error("Couldn't send the email") : toast.success(`Figures emailed to ${emailTo.trim()}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Calculator className="h-5 w-5 text-primary" />What should the surcharge be?</CardTitle>
          <p className="text-sm text-muted-foreground">Enter what we pay per litre. This only suggests figures — your live surcharges on the Rates tab are not changed.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-6">
            <div className="space-y-1.5">
              <Label>Diesel price per litre (£)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11 w-40 text-lg font-semibold" />
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Increase over £{s.base_price_per_litre.toFixed(2)} base</div>
              <div className="text-xl font-semibold">{(inc * 100).toFixed(2)}%</div>
            </div>
            <div className="ml-auto flex items-end gap-2">
              <div className="space-y-1.5">
                <Label>Email the figures to</Label>
                <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="h-9 w-64" />
              </div>
              <Button variant="outline" onClick={emailFigures} disabled={emailing || !p || !emailTo.includes("@")}>
                {emailing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Email figures (rounded up)
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Vehicle</TableHead><TableHead>Zone</TableHead>
              <TableHead className="text-right">Haulage</TableHead><TableHead className="text-right">Processing</TableHead>
              <TableHead className="text-right">Suggested</TableHead><TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Difference</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => {
                const c = current(r.vehicle, r.zone);
                const diff = c ? r.surcharge - Number(c.surcharge_amount) : null;
                return (
                  <TableRow key={r.vehicle + r.zone}>
                    <TableCell className="font-medium">{r.vehicle}</TableCell><TableCell>{r.zone}</TableCell>
                    <TableCell className="text-right">{formatGBP(r.haulage)}</TableCell>
                    <TableCell className="text-right">{formatGBP(r.processing)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatGBP(r.surcharge)}</TableCell>
                    <TableCell className="text-right">{c ? formatGBP(Number(c.surcharge_amount)) : "—"}</TableCell>
                    <TableCell className={`text-right ${diff && Math.abs(diff) >= 0.005 ? (diff > 0 ? "text-destructive" : "text-primary") : "text-muted-foreground"}`}>
                      {diff === null ? "—" : `${diff > 0 ? "+" : ""}${formatGBP(diff)}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">The processing column (weighbridge tip) rises and falls with the fuel % increase — it is £3.10 at £1.45/litre and drops to £0 at the £{s.base_price_per_litre.toFixed(2)} base price. Customer-specific flat fees (e.g. Go Green) aren't fuel-linked and aren't shown.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Surcharge settings</CardTitle>
          <p className="text-sm text-muted-foreground">The figures behind the calculation, taken from the 2026 haulage calculator.{!canEdit && " Only management can change these."}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Base diesel price per litre (£)</Label>{num(s.base_price_per_litre, (n) => set("base_price_per_litre", n))}</div>
            <div className="space-y-1.5"><Label>Miles → km divisor</Label>{num(s.miles_to_km_divisor, (n) => set("miles_to_km_divisor", n))}</div>
            <div className="space-y-1.5"><Label>Price the £3.10 tip levy was set at (£)</Label>{num(s.processing_reference_price, (n) => set("processing_reference_price", n))}</div>
          </div>

          <div>
            <h4 className="mb-2 font-semibold">Haulage — average round trip & fuel cost</h4>
            <Table>
              <TableHeader><TableRow><TableHead>Vehicle</TableHead><TableHead>Zone 1 (miles)</TableHead><TableHead>Zone 2 (miles)</TableHead><TableHead>Zone 3 (miles)</TableHead><TableHead>Base fuel cost per km (£)</TableHead></TableRow></TableHeader>
              <TableBody>
                {VEHICLES.map((v) => (
                  <TableRow key={v}>
                    <TableCell className="font-medium">{v}</TableCell>
                    {[0, 1, 2].map((i) => (
                      <TableCell key={i}>{num(s.round_trip_miles[v][i], (n) => {
                        const arr = [...s.round_trip_miles[v]] as [number, number, number]; arr[i] = n;
                        set("round_trip_miles", { ...s.round_trip_miles, [v]: arr });
                      }, "1")}</TableCell>
                    ))}
                    <TableCell>{num(s.fuel_cost_per_km[v], (n) => set("fuel_cost_per_km", { ...s.fuel_cost_per_km, [v]: n }), "0.0001")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3 rounded-lg border p-4">
              <h4 className="font-semibold">Grade C processing</h4>
              <div className="space-y-1.5"><Label>Tonnes per load</Label>{num(s.grade_c_tonnes_per_load, (n) => set("grade_c_tonnes_per_load", n), "1")}</div>
              <div className="space-y-1.5"><Label>Loads</Label>{num(s.grade_c_loads, (n) => set("grade_c_loads", n), "1")}</div>
              <div className="space-y-1.5"><Label>Surcharge per tonne (£)</Label>{num(s.grade_c_cost_per_tonne, (n) => set("grade_c_cost_per_tonne", n))}</div>
              <div className="space-y-1.5"><Label>Total jobs</Label>{num(s.grade_c_jobs, (n) => set("grade_c_jobs", n), "1")}</div>
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <h4 className="font-semibold">Waste out haulage</h4>
              <div className="space-y-1.5"><Label>Loads</Label>{num(s.waste_loads, (n) => set("waste_loads", n), "1")}</div>
              <div className="space-y-1.5"><Label>Surcharge per load (£)</Label>{num(s.waste_cost_per_load, (n) => set("waste_cost_per_load", n))}</div>
              <div className="space-y-1.5"><Label>Total jobs</Label>{num(s.waste_jobs, (n) => set("waste_jobs", n), "1")}</div>
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <h4 className="font-semibold">Yard diesel</h4>
              <div className="space-y-1.5"><Label>Weekly diesel usage (litres)</Label>{num(s.yard_weekly_litres, (n) => set("yard_weekly_litres", n), "1")}</div>
              <div className="space-y-1.5"><Label>Weekly jobs (all work)</Label>{num(s.yard_weekly_jobs, (n) => set("yard_weekly_jobs", n), "1")}</div>
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setS(DEFAULT_FUEL_CALC_SETTINGS)}><RotateCcw className="mr-2 h-4 w-4" />Spreadsheet defaults</Button>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save settings</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
