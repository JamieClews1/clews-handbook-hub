import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import type { EwcReclassRule } from "@/lib/stock-check-reclass";

interface TypeOption {
  id: string;
  name: string;
  category: string;
}

export const EwcReclassSettings = ({ types }: { types: TypeOption[] }) => {
  const { toast } = useToast();
  const [rules, setRules] = useState<EwcReclassRule[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [codes, setCodes] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("stock_check_ewc_reclass_rules")
        .select("id, from_type_id, to_type_id, ewc_codes, is_active")
        .order("created_at");
      setRules((data ?? []) as EwcReclassRule[]);
    };
    load();
  }, []);

  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? "Unknown";

  const addRule = async () => {
    const codeList = codes.split(",").map((c) => c.trim()).filter(Boolean);
    if (!fromId || !toId || codeList.length === 0) {
      toast({ title: "Missing details", description: "Pick both types and at least one EWC code.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("stock_check_ewc_reclass_rules")
      .insert({ from_type_id: fromId, to_type_id: toId, ewc_codes: codeList })
      .select("id, from_type_id, to_type_id, ewc_codes, is_active")
      .single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setRules((prev) => [...prev, data as EwcReclassRule]);
    setCodes("");
    toast({ title: "Rule added", description: "Jobs will now be re-counted using this rule." });
  };

  const toggleRule = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("stock_check_ewc_reclass_rules")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r)));
  };

  const removeRule = async (id: string) => {
    const { error } = await supabase.from("stock_check_ewc_reclass_rules").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>EWC Reclassification</CardTitle>
        <p className="text-sm text-muted-foreground">
          Count jobs of one container type as another when the waste code matches — e.g. 20yd jobs with
          EWC 17 09 04 or 20 03 01 counted as 25/30yd.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">No rules yet.</p>
        )}
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <Switch checked={rule.is_active} onCheckedChange={(v) => toggleRule(rule.id, v)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span>{typeName(rule.from_type_id)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{typeName(rule.to_type_id)}</span>
              </div>
              <p className="text-xs text-muted-foreground">EWC: {(rule.ewc_codes || []).join(", ")}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => removeRule(rule.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div className="flex items-end gap-2 pt-4 border-t border-border">
          <div className="w-36">
            <Label className="text-xs">Counted as (from)</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Label className="text-xs">Becomes (to)</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs">EWC codes (comma separated)</Label>
            <Input
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
              placeholder="17 09 04, 20 03 01"
            />
          </div>
          <Button onClick={addRule} size="icon" className="h-10 w-10">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
