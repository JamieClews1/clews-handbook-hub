import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Target, PiggyBank } from "lucide-react";
import { useWasteValueSettings, streamCostPerTonne } from "@/hooks/useWasteValueSettings";
import { useYardIncentiveSettings } from "@/hooks/useYardIncentiveSettings";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";

const WOOD_A_PRODUCTS = ["WOOD A", "WOOD A OUT"];
const WOOD_C_PRODUCTS = ["WOOD-C", "WOOD-C OUT"];
const ALL_WOOD_PRODUCTS = [...WOOD_A_PRODUCTS, ...WOOD_C_PRODUCTS];

const MIXED_WASTE_DESCRIPTIONS = [
  "Mixed Municipal Waste",
  "mixed construction and demolition wastes other than those mentioned in 17 09 01 17 09 02 and 17 09 03",
  "mixed construction and demolition wastes other than those mentioned in 17 09 01 17 09 02 and 17 09 0",
];

interface MonthRow {
  key: string;
  label: string;
  mixed: number;
  aIn: number;
  aOut: number;
  cIn: number;
  cOut: number;
  extA: number;
  extC: number;
}

interface YardIncentivesProps {
  hideHeader?: boolean;
}

const YardIncentives = ({ hideHeader }: YardIncentivesProps) => {
  const { streams, rates } = useWasteValueSettings();
  const { settings, saveSetting } = useYardIncentiveSettings();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const monthsBack = 13;
  const fetchFrom = format(startOfMonth(subMonths(new Date(), monthsBack)), "yyyy-MM-dd");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["yard-incentives-wood-rows", fetchFrom],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, movement_type, weight_t, waste_description, raw")
          .eq("source", "midweigh")
          .in("movement_type", ["INWARD", "OUTWARD"])
          .gte("job_date", fetchFrom)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(
          ...data.filter(
            (r: any) =>
              ALL_WOOD_PRODUCTS.includes((r.raw as any)?.Product) ||
              (r.movement_type === "INWARD" && MIXED_WASTE_DESCRIPTIONS.includes(r.waste_description))
          )
        );
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const months = useMemo<MonthRow[]>(() => {
    const buckets: Record<string, MonthRow> = {};
    for (let i = monthsBack; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      const key = format(d, "yyyy-MM");
      buckets[key] = {
        key,
        label: format(d, "MMM yyyy"),
        mixed: 0, aIn: 0, aOut: 0, cIn: 0, cOut: 0, extA: 0, extC: 0,
      };
    }
    (rows ?? []).forEach((row: any) => {
      const d = (row.job_date || "").substring(0, 10);
      if (!d) return;
      const b = buckets[d.substring(0, 7)];
      if (!b) return;
      const tonnes = (row.weight_t || 0) / 1000; // midweigh = KG
      const product = (row.raw as any)?.Product;
      if (ALL_WOOD_PRODUCTS.includes(product)) {
        const isA = WOOD_A_PRODUCTS.includes(product);
        if (row.movement_type === "INWARD") isA ? (b.aIn += tonnes) : (b.cIn += tonnes);
        else if (row.movement_type === "OUTWARD") isA ? (b.aOut += tonnes) : (b.cOut += tonnes);
      } else if (row.movement_type === "INWARD") {
        b.mixed += tonnes;
      }
    });
    const r = (v: number) => Math.round(v * 100) / 100;
    return Object.values(buckets)
      .map((b) => ({
        ...b,
        extA: r(Math.max(0, b.aOut - b.aIn)),
        extC: r(Math.max(0, b.cOut - b.cIn)),
        mixed: r(b.mixed),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rows]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM"));

  const landfillCostPerTonne =
    Number(rates.landfill_gate_rate || 0) + Number(rates.landfill_haulage_rate || 0);
  const findStream = (needle: string) => streams.find((s) => s.stream?.toLowerCase().includes(needle));
  const woodACost = (() => { const s = findStream("wood a"); return s ? streamCostPerTonne(s) : 0; })();
  const woodCCost = (() => { const s = findStream("wood c") ?? findStream("wood-c"); return s ? streamCostPerTonne(s) : 0; })();
  const netA = landfillCostPerTonne - woodACost;
  const netC = landfillCostPerTonne - woodCCost;

  const savingFor = (m: MonthRow) => m.extA * netA + m.extC * netC;
  const rateFor = (m: MonthRow) => (m.mixed > 0 ? ((m.extA + m.extC) / m.mixed) * 100 : 0);

  // Baseline: manual setting, or trailing 12-month average recovery rate before the selected month
  const idx = months.findIndex((m) => m.key === selectedMonth);
  const current = idx >= 0 ? months[idx] : months[months.length - 1];
  const history = idx > 0 ? months.slice(Math.max(0, idx - 12), idx) : [];
  const autoBaselineRate = (() => {
    const mixed = history.reduce((s, m) => s + m.mixed, 0);
    const rec = history.reduce((s, m) => s + m.extA + m.extC, 0);
    return mixed > 0 ? (rec / mixed) * 100 : 0;
  })();
  const baselineRate = settings.baseline_recovery_pct > 0 ? settings.baseline_recovery_pct : autoBaselineRate;

  const monthStats = useMemo(() => {
    if (!current) return null;
    const actualRate = rateFor(current);
    const recovered = current.extA + current.extC;
    const baselineTonnes = (baselineRate / 100) * current.mixed;
    const incrementalTonnes = recovered - baselineTonnes;
    // value per tonne blended across the mix actually recovered this month
    const blendedNet = recovered > 0 ? (current.extA * netA + current.extC * netC) / recovered : 0;
    const totalSaving = savingFor(current);
    const incrementalSaving = incrementalTonnes * blendedNet;
    const share = Number(settings.bonus_share_pct || 0) / 100;
    let bonus = Math.max(0, incrementalSaving * share);
    const cap = Number(settings.monthly_bonus_cap || 0);
    const capped = cap > 0 && bonus > cap;
    if (capped) bonus = cap;
    return {
      actualRate, recovered, baselineTonnes, incrementalTonnes,
      blendedNet, totalSaving, incrementalSaving, bonus, capped,
    };
  }, [current, baselineRate, netA, netC, settings.bonus_share_pct, settings.monthly_bonus_cap]);

  const money = (v: number) => `£${Math.round(v).toLocaleString()}`;
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  const numberField = (
    key: keyof typeof settings,
    label: string,
    hint: string,
    suffix?: string
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.1"
          className="h-9"
          value={draft[key] ?? String(settings[key] ?? 0)}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          onBlur={async (e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v) && v !== settings[key]) await saveSetting(key, v);
            setDraft((d) => { const n = { ...d }; delete n[key]; return n; });
          }}
        />
        {suffix && <span className="text-xs text-muted-foreground w-8">{suffix}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );

  const targetRate = settings.target_recovery_pct > 0 ? settings.target_recovery_pct : baselineRate;
  const teamSize = Number(settings.team_size || 0);

  return (
    <Card>
      {!hideHeader && (
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Yard Team Incentives</CardTitle>
              <CardDescription>
                Monthly bonus pool = a share of the extra savings the yard creates above the baseline recovery rate
              </CardDescription>
            </div>
            <div className="ml-auto w-48">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {[...months].reverse().map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-6">
        {isLoading || !monthStats ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Headline */}
            <div className="rounded-lg border-2 border-emerald-600/60 p-4 space-y-4">
              <p className="text-lg leading-relaxed text-foreground">
                In <span className="font-semibold">{current.label}</span> the yard recovered{" "}
                <span className="font-bold text-emerald-600">{fmt(monthStats.recovered)}t</span> of wood
                ({monthStats.actualRate.toFixed(1)}% of {fmt(current.mixed)}t mixed waste) against a baseline of{" "}
                <span className="font-semibold">{baselineRate.toFixed(1)}%</span> — earning a bonus pool of{" "}
                <span className="font-bold text-emerald-600">{money(monthStats.bonus)}</span>.
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Total saving this month</p>
                  <p className="text-2xl font-bold">{money(monthStats.totalSaving)}</p>
                  <p className="text-[11px] text-muted-foreground">vs landfill at {money(landfillCostPerTonne)}/t</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Tonnes above baseline</p>
                  <p className={`text-2xl font-bold ${monthStats.incrementalTonnes >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {monthStats.incrementalTonnes >= 0 ? "+" : ""}{fmt(monthStats.incrementalTonnes)}t
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    baseline {fmt(monthStats.baselineTonnes)}t
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Incremental saving</p>
                  <p className="text-2xl font-bold">{money(Math.max(0, monthStats.incrementalSaving))}</p>
                  <p className="text-[11px] text-muted-foreground">at {money(monthStats.blendedNet)}/t net</p>
                </div>
                <div className="rounded-md border border-emerald-600/60 p-3">
                  <p className="text-xs text-muted-foreground">Bonus pool ({settings.bonus_share_pct}%)</p>
                  <p className="text-2xl font-bold text-emerald-600">{money(monthStats.bonus)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {teamSize > 0 ? `${money(monthStats.bonus / teamSize)} per person (${teamSize})` : "Set team size below for per-head split"}
                    {monthStats.capped ? " · capped" : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Target progress */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Recovery rate vs target</p>
                <Badge variant="outline" className="ml-auto">
                  Target {targetRate.toFixed(1)}% · Actual {monthStats.actualRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-600"
                  style={{ width: `${targetRate > 0 ? Math.min(100, (monthStats.actualRate / targetRate) * 100) : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Every extra 1% of mixed waste turned into wood is worth about{" "}
                {money((current.mixed / 100) * (monthStats.blendedNet || netC))} a month, of which the team keeps{" "}
                {money(((current.mixed / 100) * (monthStats.blendedNet || netC) * Number(settings.bonus_share_pct || 0)) / 100)}.
              </p>
            </div>

            {/* Settings */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Bonus scheme settings</p>
              </div>
              <div className="grid gap-4 md:grid-cols-5">
                {numberField("bonus_share_pct", "Team share of incremental savings", "Paid monthly. Default 20%.", "%")}
                {numberField("baseline_recovery_pct", "Baseline recovery rate", "0 = use rolling 12-month average automatically.", "%")}
                {numberField("target_recovery_pct", "Target recovery rate", "Stretch target shown on the progress bar.", "%")}
                {numberField("team_size", "Yard team size", "Used to show the per-person share.", "")}
                {numberField("monthly_bonus_cap", "Monthly bonus cap", "0 = no cap.", "£")}
              </div>
            </div>

            {/* Monthly table */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Monthly bonus history</p>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Mixed in (t)</TableHead>
                      <TableHead className="text-right">Wood recovered (t)</TableHead>
                      <TableHead className="text-right">Recovery %</TableHead>
                      <TableHead className="text-right">Total saving</TableHead>
                      <TableHead className="text-right">Above baseline (t)</TableHead>
                      <TableHead className="text-right">Bonus pool</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...months].reverse().map((m) => {
                      const rec = m.extA + m.extC;
                      const blended = rec > 0 ? (m.extA * netA + m.extC * netC) / rec : 0;
                      const incT = rec - (baselineRate / 100) * m.mixed;
                      let bonus = Math.max(0, incT * blended * (Number(settings.bonus_share_pct || 0) / 100));
                      const cap = Number(settings.monthly_bonus_cap || 0);
                      if (cap > 0 && bonus > cap) bonus = cap;
                      return (
                        <TableRow key={m.key} className={m.key === selectedMonth ? "bg-muted/50" : undefined}>
                          <TableCell className="font-medium">{m.label}</TableCell>
                          <TableCell className="text-right">{fmt(m.mixed)}</TableCell>
                          <TableCell className="text-right">{fmt(rec)}</TableCell>
                          <TableCell className="text-right">{rateFor(m).toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{money(savingFor(m))}</TableCell>
                          <TableCell className={`text-right ${incT >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {incT >= 0 ? "+" : ""}{fmt(incT)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{money(bonus)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Bonus = {settings.bonus_share_pct}% of the savings created above the baseline recovery rate, paid monthly.
                Wood values come from the Settings tab (landfill {money(landfillCostPerTonne)}/t · Grade A net {money(netA)}/t · Grade C net {money(netC)}/t).
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default YardIncentives;
