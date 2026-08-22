import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useWasteValueSettings, streamCostPerTonne, type WasteStreamValue, type WasteValueRates } from "@/hooks/useWasteValueSettings";

const RATE_FIELDS: { key: keyof WasteValueRates; label: string; hint: string }[] = [
  { key: "landfill_gate_rate", label: "Landfill gate rate (£/t)", hint: "Cost per tonne if the material went straight to landfill" },
  { key: "landfill_haulage_rate", label: "Landfill haulage (£/t)", hint: "Haulage added to the landfill baseline" },
  { key: "rdf_gate_rate", label: "RDF gate rate (£/t)", hint: "Cost per tonne to send material out as RDF" },
  { key: "gate_fee_per_tonne", label: "Income gate fee (£/t)", hint: "Average gate fee charged on waste received" },
];

const WasteValueSettings = () => {
  const { streams, rates, loading, saveRate, saveStream, addStream, deleteStream, blendedCostPerTonne, totalShare } = useWasteValueSettings();
  const [rateDraft, setRateDraft] = useState<Partial<Record<keyof WasteValueRates, string>>>({});

  const commitRate = async (key: keyof WasteValueRates) => {
    const raw = rateDraft[key];
    if (raw === undefined) return;
    const num = Number(raw);
    setRateDraft((d) => ({ ...d, [key]: undefined }));
    if (Number.isNaN(num)) return;
    try {
      await saveRate(key, num);
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    }
  };

  const commitStream = async (s: WasteStreamValue, patch: Partial<WasteStreamValue>) => {
    try {
      await saveStream(s.id, patch);
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading waste values…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Baseline rates</CardTitle>
          <CardDescription>Used to work out what the waste would have cost with no recovery.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RATE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                step="0.01"
                value={rateDraft[f.key] ?? String(rates[f.key])}
                onChange={(e) => setRateDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                onBlur={() => commitRate(f.key)}
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Waste mix &amp; processing values</CardTitle>
            <CardDescription>
              Share of every tonne that ends up in each stream, and what that stream costs to handle.
              Negative costs are income (e.g. metal, card).
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => addStream().catch((e) => toast({ title: "Could not add", description: e.message, variant: "destructive" }))}>
            <Plus className="h-4 w-4" /> Add stream
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Stream</TableHead>
                  <TableHead className="w-[110px]">Share %</TableHead>
                  <TableHead className="w-[120px]">Waste cost £/t</TableHead>
                  <TableHead className="w-[140px]">Processing £/t</TableHead>
                  <TableHead className="w-[110px]">Haulage £/t</TableHead>
                  <TableHead className="w-[110px] text-right">Cost £/t</TableHead>
                  <TableHead className="w-[110px]">Recovered</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {streams.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Input defaultValue={s.stream} onBlur={(e) => commitStream(s, { stream: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.1"
                        defaultValue={(s.share * 100).toFixed(1)}
                        onBlur={(e) => commitStream(s, { share: Number(e.target.value) / 100 })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" defaultValue={s.waste_cost} onBlur={(e) => commitStream(s, { waste_cost: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" defaultValue={s.additional_processing} onBlur={(e) => commitStream(s, { additional_processing: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" defaultValue={s.haulage} onBlur={(e) => commitStream(s, { haulage: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      £{streamCostPerTonne(s).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.is_recovery} onCheckedChange={(v) => commitStream(s, { is_recovery: v })} />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => deleteStream(s.id).catch((e) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/40 p-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total share: </span>
              <span className={totalShare > 1.001 || totalShare < 0.999 ? "font-semibold text-destructive" : "font-semibold"}>
                {(totalShare * 100).toFixed(1)}%
              </span>
              {(totalShare > 1.001 || totalShare < 0.999) && (
                <span className="ml-2 text-xs text-muted-foreground">Shares should add up to 100%</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Blended cost per tonne: </span>
              <span className="font-semibold">£{blendedCostPerTonne.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Landfill baseline per tonne: </span>
              <span className="font-semibold">£{(rates.landfill_gate_rate + rates.landfill_haulage_rate).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WasteValueSettings;
