import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Recycle, Target, PiggyBank } from "lucide-react";
import { useWasteValueSettings, streamCostPerTonne } from "@/hooks/useWasteValueSettings";
import { useYardIncentiveSettings, type YardIncentiveSettings } from "@/hooks/useYardIncentiveSettings";
import { format, startOfMonth, subMonths } from "date-fns";

/* ------------------------------------------------------------------ */
/*  ZTL group map – same localStorage key as the ZTL chart / KPIs      */
/* ------------------------------------------------------------------ */
type WasteGroup = "landfill" | "rdf" | "recycled";
const ZTL_STORAGE_KEY = "ztl-waste-group-map";
const DEFAULT_GROUP_MAP: Record<string, WasteGroup> = {
  "MIX MUN": "landfill",
  "Waste Out": "landfill",
  RDF: "rdf",
  "WASTE OUT (FOR RDF)": "rdf",
};
function loadGroupMap(): Record<string, WasteGroup> {
  try {
    const saved = localStorage.getItem(ZTL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...DEFAULT_GROUP_MAP };
}

interface MonthRow {
  key: string;
  label: string;
  landfill: number;
  rdf: number;
  recycled: number;
}

const monthsBack = 13;

const RecyclingIncentive = () => {
  const groupMap = useMemo(() => loadGroupMap(), []);
  const { streams, rates } = useWasteValueSettings();
  const { settings, saveSetting } = useYardIncentiveSettings();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const fetchFrom = format(startOfMonth(subMonths(new Date(), monthsBack)), "yyyy-MM-dd");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["recycling-incentive-outward", fetchFrom],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("data_hub_jobs")
          .select("job_date, weight_t, raw")
          .eq("source", "midweigh")
          .eq("movement_type", "OUTWARD")
          .gte("job_date", fetchFrom)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
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
      buckets[key] = { key, label: format(d, "MMM yyyy"), landfill: 0, rdf: 0, recycled: 0 };
    }
    (rows ?? []).forEach((row: any) => {
      const d = (row.job_date || "").substring(0, 10);
      if (!d || row.weight_t == null) return;
      const b = buckets[d.substring(0, 7)];
      if (!b) return;
      const tonnes = (row.weight_t || 0) / 1000; // midweigh = KG
      const group: WasteGroup = groupMap[row.raw?.Product] || "recycled";
      if (group === "landfill") b.landfill += tonnes;
      else if (group === "rdf") b.rdf += tonnes;
      else b.recycled += tonnes;
    });
    const r = (v: number) => Math.round(v * 100) / 100;
    return Object.values(buckets)
      .map((b) => ({ ...b, landfill: r(b.landfill), rdf: r(b.rdf), recycled: r(b.recycled) }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rows, groupMap]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM"),
  );

  /* ---------------- value per tonne diverted ---------------- */
  const landfillCostPerTonne =
    Number(rates.landfill_gate_rate || 0) + Number(rates.landfill_haulage_rate || 0);
  const rdfCostPerTonne = Number(rates.rdf_gate_rate || 0);
  const recoveryStreams = streams.filter((s) => s.is_recovery);
  const recoveryShare = recoveryStreams.reduce((sum, s) => sum + Number(s.share || 0), 0);
  const blendedRecoveryCost =
    recoveryShare > 0
      ? recoveryStreams.reduce((sum, s) => sum + Number(s.share || 0) * streamCostPerTonne(s), 0) / recoveryShare
      : 0;
  const autoValuePerTonne = Math.max(
    0,
    (landfillCostPerTonne + rdfCostPerTonne) / 2 - blendedRecoveryCost,
  );
  const valuePerTonne =
    Number(settings.recycling_value_per_tonne || 0) > 0
      ? Number(settings.recycling_value_per_tonne)
      : autoValuePerTonne;

  const totalOut = (m: MonthRow) => m.landfill + m.rdf + m.recycled;
  const rateFor = (m: MonthRow) => (totalOut(m) > 0 ? (m.recycled / totalOut(m)) * 100 : 0);

  const idx = months.findIndex((m) => m.key === selectedMonth);
  const current = idx >= 0 ? months[idx] : months[months.length - 1];
  const history = idx > 0 ? months.slice(Math.max(0, idx - 12), idx) : [];
  const autoBaselineRate = (() => {
    const out = history.reduce((s, m) => s + totalOut(m), 0);
    const rec = history.reduce((s, m) => s + m.recycled, 0);
    return out > 0 ? (rec / out) * 100 : 0;
  })();
  const baselineRate =
    settings.recycling_baseline_pct > 0 ? settings.recycling_baseline_pct : autoBaselineRate;
  const targetRate =
    settings.recycling_target_pct > 0 ? settings.recycling_target_pct : baselineRate;
  const teamSize = Number(settings.recycling_team_size || 0);
  const share = Number(settings.recycling_bonus_share_pct || 0) / 100;
  const cap = Number(settings.recycling_monthly_bonus_cap || 0);

  const bonusFor = (m: MonthRow) => {
    const incT = m.recycled - (baselineRate / 100) * totalOut(m);
    let bonus = Math.max(0, incT * valuePerTonne * share);
    if (cap > 0 && bonus > cap) bonus = cap;
    return { incT, bonus, capped: cap > 0 && incT * valuePerTonne * share > cap };
  };

  const stats = useMemo(() => {
    if (!current) return null;
    const out = totalOut(current);
    const actualRate = rateFor(current);
    const disposal = current.landfill + current.rdf;
    const { incT, bonus, capped } = bonusFor(current);
    return {
      out,
      actualRate,
      disposal,
      incrementalTonnes: incT,
      incrementalValue: Math.max(0, incT * valuePerTonne),
      bonus,
      capped,
    };
  }, [current, baselineRate, valuePerTonne, share, cap]);

  const money = (v: number) => `£${Math.round(v).toLocaleString()}`;
  const fmt = (v: number) =>
    v.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  const numberField = (
    key: keyof YardIncentiveSettings,
    label: string,
    hint: string,
    suffix?: string,
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
            setDraft((d) => {
              const n = { ...d };
              delete n[key];
              return n;
            });
          }}
        />
        {suffix && <span className="text-xs text-muted-foreground w-8">{suffix}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center">
            <Recycle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">Recycling Incentive</CardTitle>
            <CardDescription>
              Based purely on the share of outgoing waste that does not go to landfill or RDF
            </CardDescription>
          </div>
          <div className="ml-auto w-48">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {[...months].reverse().map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading || !stats ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {/* Headline */}
            <div className="rounded-lg border-2 border-sky-600/60 p-4 space-y-4">
              <p className="text-lg leading-relaxed text-foreground">
                In <span className="font-semibold">{current.label}</span>{" "}
                <span className="font-bold text-sky-600">{stats.actualRate.toFixed(1)}%</span> of the{" "}
                {fmt(stats.out)}t sent out was recycled (not landfill or RDF), against a baseline of{" "}
                <span className="font-semibold">{baselineRate.toFixed(1)}%</span> — earning a bonus pool of{" "}
                <span className="font-bold text-sky-600">{money(stats.bonus)}</span>.
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Recycled out</p>
                  <p className="text-2xl font-bold">{fmt(current.recycled)}t</p>
                  <p className="text-[11px] text-muted-foreground">of {fmt(stats.out)}t total out</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Landfill + RDF</p>
                  <p className="text-2xl font-bold text-destructive">{fmt(stats.disposal)}t</p>
                  <p className="text-[11px] text-muted-foreground">
                    landfill {fmt(current.landfill)}t · RDF {fmt(current.rdf)}t
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Tonnes above baseline</p>
                  <p
                    className={`text-2xl font-bold ${stats.incrementalTonnes >= 0 ? "text-sky-600" : "text-destructive"}`}
                  >
                    {stats.incrementalTonnes >= 0 ? "+" : ""}
                    {fmt(stats.incrementalTonnes)}t
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    worth {money(stats.incrementalValue)} at {money(valuePerTonne)}/t
                  </p>
                </div>
                <div className="rounded-md border border-sky-600/60 p-3">
                  <p className="text-xs text-muted-foreground">
                    Bonus pool ({settings.recycling_bonus_share_pct}%)
                  </p>
                  <p className="text-2xl font-bold text-sky-600">{money(stats.bonus)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {teamSize > 0
                      ? `${money(stats.bonus / teamSize)} per person (${teamSize})`
                      : "Set team size below for per-head split"}
                    {stats.capped ? " · capped" : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Target progress */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Recycling rate vs target</p>
                <Badge variant="outline" className="ml-auto">
                  Target {targetRate.toFixed(1)}% · Actual {stats.actualRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-sky-600"
                  style={{
                    width: `${targetRate > 0 ? Math.min(100, (stats.actualRate / targetRate) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Every extra 1% of outgoing waste kept out of landfill/RDF is worth about{" "}
                {money((stats.out / 100) * valuePerTonne)} a month, of which the team keeps{" "}
                {money(((stats.out / 100) * valuePerTonne * Number(settings.recycling_bonus_share_pct || 0)) / 100)}.
              </p>
            </div>

            {/* Settings */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Recycling bonus settings</p>
              </div>
              <div className="grid gap-4 md:grid-cols-6">
                {numberField("recycling_bonus_share_pct", "Team share of incremental savings", "Paid monthly. Default 20%.", "%")}
                {numberField("recycling_baseline_pct", "Baseline recycling rate", "0 = use rolling 12-month average automatically.", "%")}
                {numberField("recycling_target_pct", "Target recycling rate", "Stretch target shown on the progress bar.", "%")}
                {numberField("recycling_team_size", "Yard team size", "Used to show the per-person share.", "")}
                {numberField("recycling_monthly_bonus_cap", "Monthly bonus cap", "0 = no cap.", "£")}
                {numberField(
                  "recycling_value_per_tonne",
                  "Value per tonne diverted",
                  `0 = auto (${money(autoValuePerTonne)}/t from waste value settings).`,
                  "£",
                )}
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
                      <TableHead className="text-right">Total out (t)</TableHead>
                      <TableHead className="text-right">Recycled (t)</TableHead>
                      <TableHead className="text-right">Landfill (t)</TableHead>
                      <TableHead className="text-right">RDF (t)</TableHead>
                      <TableHead className="text-right">Recycling %</TableHead>
                      <TableHead className="text-right">Above baseline (t)</TableHead>
                      <TableHead className="text-right">Bonus pool</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...months].reverse().map((m) => {
                      const { incT, bonus } = bonusFor(m);
                      return (
                        <TableRow key={m.key} className={m.key === selectedMonth ? "bg-muted/50" : undefined}>
                          <TableCell className="font-medium">{m.label}</TableCell>
                          <TableCell className="text-right">{fmt(totalOut(m))}</TableCell>
                          <TableCell className="text-right">{fmt(m.recycled)}</TableCell>
                          <TableCell className="text-right">{fmt(m.landfill)}</TableCell>
                          <TableCell className="text-right">{fmt(m.rdf)}</TableCell>
                          <TableCell className="text-right">{rateFor(m).toFixed(1)}%</TableCell>
                          <TableCell className={`text-right ${incT >= 0 ? "text-sky-600" : "text-destructive"}`}>
                            {incT >= 0 ? "+" : ""}
                            {fmt(incT)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{money(bonus)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Recycling % = outgoing tonnes not grouped as landfill or RDF (grouping comes from the Zero to
                Landfill waste group map). Bonus = {settings.recycling_bonus_share_pct}% of the value of tonnes
                diverted above the baseline rate, at {money(valuePerTonne)}/t.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RecyclingIncentive;
