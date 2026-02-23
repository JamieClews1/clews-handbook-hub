import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const MATERIALS = [
  "CARD", "RDF", "WHITE PAPER", "PET", "PP BAGS", "MIXED RIGIDS",
  "98/2", "95/5", "90/10", "JAZZ", "FRIDGES", "BAILING WIRE",
  "MIXED PAPER", "TUBES", "BROWN PAPER", "PAPER PALLETS",
] as const;

interface TallyEntry { onStock: number; out: number; }
type TallyData = Record<string, TallyEntry>;

const initTally = (): TallyData =>
  Object.fromEntries(MATERIALS.map((m) => [m, { onStock: 0, out: 0 }]));

interface StockReportTallyProps {
  onSaved: () => void;
}

export default function StockReportTally({ onSaved }: StockReportTallyProps) {
  const { user } = useAuth();
  const [tally, setTally] = useState<TallyData>(initTally);
  const [activeField, setActiveField] = useState<{ material: string; field: "onStock" | "out" } | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (material: string, field: "onStock" | "out", delta: number) => {
    setTally((prev) => ({
      ...prev,
      [material]: {
        ...prev[material],
        [field]: Math.max(0, prev[material][field] + delta),
      },
    }));
  };

  const handleReset = () => {
    setTally(initTally());
    setActiveField(null);
    toast.success("Tally reset");
  };

  const handleSave = async () => {
    if (!user) { toast.error("Not logged in"); return; }
    setSaving(true);
    try {
      const totalOnStock = Object.values(tally).reduce((s, e) => s + e.onStock, 0);
      const totalOut = Object.values(tally).reduce((s, e) => s + e.out, 0);

      const profileRes = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const operatorName = profileRes.data?.full_name || user.email || "Unknown";

      const { data: report, error: reportErr } = await supabase
        .from("stock_reports")
        .insert({
          operator_id: user.id,
          operator_name: operatorName,
          total_on_stock: totalOnStock,
          total_out: totalOut,
        })
        .select("id")
        .single();

      if (reportErr || !report) throw reportErr || new Error("Failed to create report");

      const items = MATERIALS.map((material, idx) => ({
        stock_report_id: report.id,
        material,
        on_stock: tally[material].onStock,
        out: tally[material].out,
        display_order: idx,
      }));

      const { error: itemsErr } = await supabase
        .from("stock_report_items")
        .insert(items);
      if (itemsErr) throw itemsErr;

      // Send email notification (fire-and-forget)
      supabase.functions.invoke("send-stock-report-email", {
        body: { reportId: report.id },
      }).catch(console.error);

      toast.success("Stock report saved");
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save report");
    } finally {
      setSaving(false);
    }
  };

  const totalOnStock = Object.values(tally).reduce((s, e) => s + e.onStock, 0);
  const totalOut = Object.values(tally).reduce((s, e) => s + e.out, 0);

  return (
    <div className="space-y-3 pb-28">
      <div className="text-center text-sm text-muted-foreground font-medium">
        {format(new Date(), "EEEE, d MMMM yyyy")}
      </div>

      {MATERIALS.map((material) => {
        const entry = tally[material];
        const isActiveStock = activeField?.material === material && activeField.field === "onStock";
        const isActiveOut = activeField?.material === material && activeField.field === "out";

        return (
          <Card key={material} className="border border-border/60 shadow-sm">
            <CardContent className="p-3">
              <div className="text-xs font-bold text-foreground/80 uppercase tracking-wide mb-2">
                {material}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* ON STOCK */}
                <div
                  className={`rounded-xl p-2 transition-colors cursor-pointer ${
                    isActiveStock ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/50"
                  }`}
                  onClick={() => setActiveField({ material, field: "onStock" })}
                >
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase text-center mb-1">On Stock</div>
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" className="w-9 h-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center active:scale-90 transition-transform touch-manipulation"
                      onClick={(e) => { e.stopPropagation(); update(material, "onStock", -1); setActiveField({ material, field: "onStock" }); }}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-2xl font-bold tabular-nums w-12 text-center text-foreground">{entry.onStock}</span>
                    <button type="button" className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center active:scale-90 transition-transform touch-manipulation"
                      onClick={(e) => { e.stopPropagation(); update(material, "onStock", 1); setActiveField({ material, field: "onStock" }); }}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* OUT */}
                <div
                  className={`rounded-xl p-2 transition-colors cursor-pointer ${
                    isActiveOut ? "bg-accent/30 ring-2 ring-accent" : "bg-muted/50"
                  }`}
                  onClick={() => setActiveField({ material, field: "out" })}
                >
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase text-center mb-1">Out</div>
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" className="w-9 h-9 rounded-full bg-destructive/10 text-destructive flex items-center justify-center active:scale-90 transition-transform touch-manipulation"
                      onClick={(e) => { e.stopPropagation(); update(material, "out", -1); setActiveField({ material, field: "out" }); }}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-2xl font-bold tabular-nums w-12 text-center text-foreground">{entry.out}</span>
                    <button type="button" className="w-9 h-9 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center active:scale-90 transition-transform touch-manipulation"
                      onClick={(e) => { e.stopPropagation(); update(material, "out", 1); setActiveField({ material, field: "out" }); }}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border shadow-lg p-3 z-50">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <div className="flex items-center gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-foreground tabular-nums">{totalOnStock}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Stock</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-lg font-bold text-accent-foreground tabular-nums">{totalOut}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Out</div>
            </div>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
