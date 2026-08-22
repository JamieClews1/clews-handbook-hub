import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PiggyBank, Recycle, Flame, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useWasteValueSettings, streamCostPerTonne } from "@/hooks/useWasteValueSettings";

interface Props {
  externalStartDate: Date;
  externalEndDate: Date;
}

async function fetchAllPaged(queryBuilder: any) {
  let all: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await queryBuilder.range(from, from + pageSize - 1);
    if (error) throw error;
    if (data) all = all.concat(data);
    hasMore = data?.length === pageSize;
    from += pageSize;
  }
  return all;
}

const money = (n: number) =>
  `${n < 0 ? "-" : ""}£${Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const WasteRecoverySavings = ({ externalStartDate, externalEndDate }: Props) => {
  const { streams, rates, loading: loadingSettings, blendedCostPerTonne } = useWasteValueSettings();

  const startStr = format(externalStartDate, "yyyy-MM-dd");
  const endStr = format(externalEndDate, "yyyy-MM-dd");

  const { data: yardJobs, isLoading } = useQuery({
    queryKey: ["recovery-savings-yard", startStr, endStr],
    queryFn: async () =>
      fetchAllPaged(
        supabase
          .from("data_hub_jobs")
          .select("id, job_date, weight_t")
          .eq("source", "midweigh")
          .in("job_type", ["WASTEIN", "SKIP"])
          .gte("job_date", startStr)
          .lte("job_date", endStr)
          .order("id", { ascending: true })
      ),
  });

  const tonnes = useMemo(
    () => (yardJobs ?? []).reduce((sum: number, j: any) => sum + (j.weight_t ?? 0) / 1000, 0),
    [yardJobs]
  );

  const calc = useMemo(() => {
    const landfillBaseline = rates.landfill_gate_rate + rates.landfill_haulage_rate;
    const actualPerTonne = blendedCostPerTonne;
    const savingPerTonne = landfillBaseline - actualPerTonne;

    const landfillStreams = streams.filter((s) => !s.is_recovery);
    const landfillShare = landfillStreams.reduce((s, r) => s + r.share, 0);
    const rdfStream = streams.find((s) => /rdf/i.test(s.stream));
    const rdfShare = rdfStream?.share ?? 0;

    const rdfSavingPerTonne = rdfStream ? landfillBaseline - streamCostPerTonne(rdfStream) : 0;

    const rows = streams.map((s) => {
      const t = tonnes * s.share;
      const perT = streamCostPerTonne(s);
      return {
        stream: s.stream,
        share: s.share,
        tonnes: t,
        costPerTonne: perT,
        cost: t * perT,
        saving: s.is_recovery ? t * (landfillBaseline - perT) : 0,
      };
    });

    return {
      landfillBaseline,
      actualPerTonne,
      savingPerTonne,
      totalBaseline: tonnes * landfillBaseline,
      totalActual: tonnes * actualPerTonne,
      totalSaving: tonnes * savingPerTonne,
      landfillTonnes: tonnes * landfillShare,
      divertedTonnes: tonnes * (1 - landfillShare),
      rdfTonnes: tonnes * rdfShare,
      rdfSaving: tonnes * rdfShare * rdfSavingPerTonne,
      rows,
    };
  }, [streams, rates, blendedCostPerTonne, tonnes]);

  if (isLoading || loadingSettings) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Loading recovery savings…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-primary" />
          Recovery Savings — Landfill &amp; RDF
        </CardTitle>
        <CardDescription>
          What {tonnes.toLocaleString("en-GB", { maximumFractionDigits: 0 })}t of waste received would have cost at
          landfill (£{calc.landfillBaseline.toFixed(2)}/t) versus what it actually costs to process
          (£{calc.actualPerTonne.toFixed(2)}/t). Values are set in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PiggyBank className="h-4 w-4" /> Total saved
            </div>
            <p className="mt-1 text-2xl font-bold text-primary">{money(calc.totalSaving)}</p>
            <p className="text-xs text-muted-foreground">{money(calc.savingPerTonne)} per tonne</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Recycle className="h-4 w-4" /> Diverted from landfill
            </div>
            <p className="mt-1 text-2xl font-bold">
              {calc.divertedTonnes.toLocaleString("en-GB", { maximumFractionDigits: 0 })}t
            </p>
            <p className="text-xs text-muted-foreground">
              {tonnes > 0 ? ((calc.divertedTonnes / tonnes) * 100).toFixed(1) : "0.0"}% of intake
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Flame className="h-4 w-4" /> RDF recovered
            </div>
            <p className="mt-1 text-2xl font-bold">
              {calc.rdfTonnes.toLocaleString("en-GB", { maximumFractionDigits: 0 })}t
            </p>
            <p className="text-xs text-muted-foreground">{money(calc.rdfSaving)} saved vs landfill</p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trash2 className="h-4 w-4" /> Still to landfill
            </div>
            <p className="mt-1 text-2xl font-bold">
              {calc.landfillTonnes.toLocaleString("en-GB", { maximumFractionDigits: 0 })}t
            </p>
            <p className="text-xs text-muted-foreground">{money(calc.landfillTonnes * calc.landfillBaseline)} cost</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-muted-foreground">Cost if all landfilled</p>
            <p className="text-lg font-semibold">{money(calc.totalBaseline)}</p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-muted-foreground">Actual processing cost</p>
            <p className="text-lg font-semibold">{money(calc.totalActual)}</p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-muted-foreground">Net saving</p>
            <p className="text-lg font-semibold text-primary">{money(calc.totalSaving)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stream</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Tonnes</TableHead>
                <TableHead className="text-right">Cost £/t</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Saving vs landfill</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calc.rows.map((r) => (
                <TableRow key={r.stream}>
                  <TableCell className="font-medium">{r.stream}</TableCell>
                  <TableCell className="text-right tabular-nums">{(r.share * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.tonnes.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">£{r.costPerTonne.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.cost)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-primary">
                    {r.saving ? money(r.saving) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default WasteRecoverySavings;
