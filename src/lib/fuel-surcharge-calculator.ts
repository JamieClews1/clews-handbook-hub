// Fuel surcharge calculator — mirrors the "Fuel surcharge" sheet of
// Haulage_Calculator_2026. Read-only: it suggests surcharges, never writes rates.
//
//   increase      = (price per litre − base price) / base price
//   haulage       = round-trip km × base fuel cost per km × increase
//   processing    = Grade C cost per job + waste haulage per job + yard diesel per job
//   surcharge     = haulage + processing   (Weighbridge Tip = processing only)

export type CalcVehicle = "Skips" | "RoRo" | "Artic";

export interface FuelCalcSettings {
  base_price_per_litre: number;
  miles_to_km_divisor: number; // sheet converts miles ÷ 0.63
  round_trip_miles: Record<CalcVehicle, [number, number, number]>;
  fuel_cost_per_km: Record<CalcVehicle, number>;
  grade_c_tonnes_per_load: number;
  grade_c_loads: number;
  grade_c_cost_per_tonne: number;
  grade_c_jobs: number;
  waste_loads: number;
  waste_cost_per_load: number;
  waste_jobs: number;
  yard_weekly_litres: number;
  yard_weekly_jobs: number;
}

export const DEFAULT_FUEL_CALC_SETTINGS: FuelCalcSettings = {
  base_price_per_litre: 1.1,
  miles_to_km_divisor: 0.63,
  round_trip_miles: { Skips: [7, 18, 28], RoRo: [7, 18, 32], Artic: [7, 18, 32] },
  fuel_cost_per_km: { Skips: 0.3776547392655039, RoRo: 0.5251253813666615, Artic: 0.7 },
  grade_c_tonnes_per_load: 14,
  grade_c_loads: 4,
  grade_c_cost_per_tonne: 3.9,
  grade_c_jobs: 250,
  waste_loads: 2,
  waste_cost_per_load: 3.1818181818181808,
  waste_jobs: 250,
  yard_weekly_litres: 1600,
  yard_weekly_jobs: 255,
};

export interface CalcRow {
  vehicle: CalcVehicle | "Weighbridge Tip";
  zone: "NA" | "Zone 1" | "Zone 2" | "Zone 3";
  haulage: number;
  processing: number;
  surcharge: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function fuelIncrease(price: number, s: FuelCalcSettings): number {
  if (!s.base_price_per_litre) return 0;
  return (price - s.base_price_per_litre) / s.base_price_per_litre;
}

export function processingLevy(price: number, s: FuelCalcSettings): number {
  const inc = fuelIncrease(price, s);
  const gradeC = s.grade_c_jobs ? (s.grade_c_tonnes_per_load * s.grade_c_loads * s.grade_c_cost_per_tonne) / s.grade_c_jobs : 0;
  const waste = s.waste_jobs ? (s.waste_loads * s.waste_cost_per_load) / s.waste_jobs : 0;
  const diesel = s.yard_weekly_jobs ? (s.yard_weekly_litres / s.yard_weekly_jobs) * s.base_price_per_litre * inc : 0;
  return gradeC + waste + diesel;
}

export function calculateFuelSurcharges(price: number, s: FuelCalcSettings): CalcRow[] {
  const inc = fuelIncrease(price, s);
  const proc = processingLevy(price, s);
  const rows: CalcRow[] = [{ vehicle: "Weighbridge Tip", zone: "NA", haulage: 0, processing: r2(proc), surcharge: r2(proc) }];
  (["Skips", "RoRo", "Artic"] as CalcVehicle[]).forEach((v) => {
    s.round_trip_miles[v].forEach((miles, i) => {
      const km = s.miles_to_km_divisor ? miles / s.miles_to_km_divisor : 0;
      const haul = km * s.fuel_cost_per_km[v] * inc;
      rows.push({ vehicle: v, zone: `Zone ${i + 1}` as CalcRow["zone"], haulage: r2(haul), processing: r2(proc), surcharge: r2(haul + proc) });
    });
  });
  return rows;
}
