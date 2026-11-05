import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export const STOCK_CONDITIONS = ["New", "Good", "Fair", "Poor", "Scrapped", "Yard Use"];
// Used until the saved rules load (and if a condition has no saved rule).
export const DEFAULT_EXCLUDED_CONDITIONS = ["Poor", "Scrapped", "Yard Use"];

const QUERY_KEY = ["inventory-condition-stock-rules"];

/** Conditions that are NOT counted as live stock. */
export const useExcludedConditions = () => {
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_condition_stock_rules")
        .select("condition, counts_in_stock");
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!data) return DEFAULT_EXCLUDED_CONDITIONS;
  const saved = new Map(data.map((r) => [r.condition, r.counts_in_stock]));
  return STOCK_CONDITIONS.filter((c) =>
    saved.has(c) ? !saved.get(c) : DEFAULT_EXCLUDED_CONDITIONS.includes(c),
  );
};

export const ConditionStockSettings = () => {
  const excluded = useExcludedConditions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const setCounts = async (condition: string, counts: boolean) => {
    const { error } = await supabase
      .from("inventory_condition_stock_rules")
      .upsert({ condition, counts_in_stock: counts, updated_at: new Date().toISOString() });
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Counted as stock</CardTitle>
        <p className="text-sm text-muted-foreground">
          Switch off a condition to leave those containers out of the Inventory list and the Stock
          Accounted For figures. They move to the "Not in stock" tab instead.
        </p>
      </CardHeader>
      <CardContent className="divide-y">
        {STOCK_CONDITIONS.map((c) => {
          const counts = !excluded.includes(c);
          return (
            <label key={c} className="flex items-center justify-between py-2.5">
              <span className="font-medium">{c}</span>
              <span className="flex items-center gap-3 text-sm text-muted-foreground">
                {counts ? "Included" : "Not included"}
                <Switch checked={counts} onCheckedChange={(v) => setCounts(c, v)} aria-label={`Count ${c} as stock`} />
              </span>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
};
