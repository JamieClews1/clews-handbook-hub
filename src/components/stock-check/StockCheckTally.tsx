import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Minus, Truck, Container, Pencil } from "lucide-react";

interface ContainerType {
  id: string;
  name: string;
  category: string;
  display_order: number;
  default_runner: number;
}

interface TallyItem {
  container_type_id: string;
  in_yard: number;
  runner: number;
  notes: string;
}

interface StockCheckTallyProps {
  userId: string;
  onComplete: () => void;
  editCheckId?: string | null;
}

interface LastCheckInfo {
  id: string;
  operator_name: string;
  created_at: string;
  notes: string | null;
  itemNotes: { name: string; notes: string }[];
}

export const StockCheckTally = ({ userId, onComplete, editCheckId }: StockCheckTallyProps) => {
  const { toast } = useToast();
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [tallyItems, setTallyItems] = useState<TallyItem[]>([]);
  const [operatorName, setOperatorName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<LastCheckInfo | null>(null);
  const isEditing = !!editCheckId;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: types }, { data: profile }] = await Promise.all([
        supabase
          .from("stock_check_container_types")
          .select("*")
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .single(),
      ]);

      if (!types) {
        setLoading(false);
        return;
      }
      setContainerTypes(types);

      // If editing, load existing check + items
      let existingItems: Record<string, { in_yard: number; runner: number; notes: string | null }> = {};
      let existingOperator = "";
      let existingNotes = "";
      if (editCheckId) {
        const [{ data: check }, { data: items }] = await Promise.all([
          supabase
            .from("stock_checks")
            .select("operator_name, notes")
            .eq("id", editCheckId)
            .single(),
          supabase
            .from("stock_check_items")
            .select("container_type_id, in_yard, runner, notes")
            .eq("stock_check_id", editCheckId),
        ]);
        if (check) {
          existingOperator = check.operator_name || "";
          existingNotes = check.notes || "";
        }
        if (items) {
          for (const i of items) {
            existingItems[i.container_type_id] = {
              in_yard: i.in_yard,
              runner: i.runner,
              notes: i.notes,
            };
          }
        }
      }

      setTallyItems(
        types.map((t: any) => {
          const ex = existingItems[t.id];
          return {
            container_type_id: t.id,
            in_yard: ex?.in_yard ?? 0,
            runner: ex?.runner ?? (t.default_runner ?? 0),
            notes: ex?.notes ?? "",
          };
        })
      );

      if (editCheckId) {
        setOperatorName(existingOperator || profile?.full_name || "");
        setNotes(existingNotes);
      } else {
        if (profile?.full_name) setOperatorName(profile.full_name);
      }
      setLoading(false);
    };
    load();
  }, [userId, editCheckId]);

  const updateItem = (typeId: string, field: keyof TallyItem, value: any) => {
    setTallyItems((prev) =>
      prev.map((item) =>
        item.container_type_id === typeId ? { ...item, [field]: value } : item
      )
    );
  };

  const increment = (typeId: string, field: "in_yard" | "runner") => {
    setTallyItems((prev) =>
      prev.map((item) =>
        item.container_type_id === typeId
          ? { ...item, [field]: item[field] + 1 }
          : item
      )
    );
  };

  const decrement = (typeId: string, field: "in_yard" | "runner") => {
    setTallyItems((prev) =>
      prev.map((item) =>
        item.container_type_id === typeId
          ? { ...item, [field]: Math.max(0, item[field] - 1) }
          : item
      )
    );
  };

  const handleSave = async () => {
    if (!operatorName.trim()) {
      toast({ title: "Error", description: "Operator name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let checkId: string;

      if (editCheckId) {
        // Update existing check
        const { error: updateError } = await supabase
          .from("stock_checks")
          .update({ operator_name: operatorName, notes })
          .eq("id", editCheckId);
        if (updateError) throw updateError;

        // Replace items
        const { error: delError } = await supabase
          .from("stock_check_items")
          .delete()
          .eq("stock_check_id", editCheckId);
        if (delError) throw delError;

        checkId = editCheckId;
      } else {
        const { data: stockCheck, error: checkError } = await supabase
          .from("stock_checks")
          .insert({
            operator_id: userId,
            operator_name: operatorName,
            notes,
            status: "submitted",
          })
          .select("id")
          .single();

        if (checkError) throw checkError;
        checkId = stockCheck.id;
      }

      const items = tallyItems.map((item) => ({
        stock_check_id: checkId,
        container_type_id: item.container_type_id,
        in_yard: item.in_yard,
        runner: item.runner,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from("stock_check_items")
        .insert(items);

      if (itemsError) throw itemsError;

      toast({
        title: editCheckId ? "Stock check updated" : "Stock check saved",
        description: editCheckId
          ? "Your changes have been saved."
          : "Your tally has been submitted successfully.",
      });
      onComplete();
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const skips = containerTypes.filter((t) => t.category === "skip");
  const roros = containerTypes.filter((t) => t.category === "roro");

  const totalInYard = tallyItems.reduce((s, i) => s + i.in_yard, 0);
  const totalRunners = tallyItems.reduce((s, i) => s + i.runner, 0);

  return (
    <div className="space-y-6 pb-32">
      {isEditing && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
          <Pencil className="h-4 w-4" />
          Editing the most recent tally — saving will overwrite it.
        </div>
      )}
      {/* Operator */}
      <Card>
        <CardContent className="p-4">
          <Label htmlFor="operatorName" className="text-sm font-medium">Operator Name</Label>
          <Input
            id="operatorName"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
            className="mt-1"
          />
        </CardContent>
      </Card>

      {/* Skips Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Skips</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {skips.map((type) => {
            const item = tallyItems.find((i) => i.container_type_id === type.id);
            if (!item) return null;
            return (
              <TallyCard
                key={type.id}
                name={type.name}
                item={item}
                onIncrement={(f) => increment(type.id, f)}
                onDecrement={(f) => decrement(type.id, f)}
                onNotesChange={(v) => updateItem(type.id, "notes", v)}
              />
            );
          })}
        </div>
      </div>

      {/* RoRos Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Container className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">RoRos</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {roros.map((type) => {
            const item = tallyItems.find((i) => i.container_type_id === type.id);
            if (!item) return null;
            return (
              <TallyCard
                key={type.id}
                name={type.name}
                item={item}
                onIncrement={(f) => increment(type.id, f)}
                onDecrement={(f) => decrement(type.id, f)}
                onNotesChange={(v) => updateItem(type.id, "notes", v)}
              />
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <Card>
        <CardContent className="p-4">
          <Label htmlFor="generalNotes" className="text-sm font-medium">General Notes</Label>
          <Textarea
            id="generalNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any general observations..."
            className="mt-1"
          />
        </CardContent>
      </Card>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border shadow-lg p-4 z-50">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{totalInYard}</div>
                <div className="text-xs text-muted-foreground">In Yard</div>
              </div>
              <div className="w-px h-10 bg-border" />
              <div>
                <div className="text-2xl font-bold text-primary">{totalRunners}</div>
                <div className="text-xs text-muted-foreground">Runners</div>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="h-12 px-6 gap-2 text-base">
              {isEditing ? <Pencil className="h-5 w-5" /> : <Save className="h-5 w-5" />}
              {saving ? "Saving..." : isEditing ? "Update" : "Submit"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TallyCardProps {
  name: string;
  item: TallyItem;
  onIncrement: (field: "in_yard" | "runner") => void;
  onDecrement: (field: "in_yard" | "runner") => void;
  onNotesChange: (value: string) => void;
}

const TallyCard = ({ name, item, onIncrement, onDecrement, onNotesChange }: TallyCardProps) => {
  return (
    <Card className="border-2 border-border/50">
      <CardContent className="p-4 space-y-4">
        <h3 className="text-lg font-bold text-foreground">{name}</h3>

        <div className="grid grid-cols-2 gap-4">
          {/* In Yard */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">In Yard</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-xl text-lg"
                onClick={() => onDecrement("in_yard")}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-bold text-foreground">{item.in_yard}</span>
              </div>
              <Button
                variant="default"
                size="icon"
                className="h-12 w-12 rounded-xl text-lg"
                onClick={() => onIncrement("in_yard")}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Runner */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Runner</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-xl text-lg"
                onClick={() => onDecrement("runner")}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <div className="flex-1 text-center">
                <span className="text-3xl font-bold text-primary">{item.runner}</span>
              </div>
              <Button
                variant="default"
                size="icon"
                className="h-12 w-12 rounded-xl text-lg"
                onClick={() => onIncrement("runner")}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <Input
          placeholder="Notes (e.g., At the farm)"
          value={item.notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="text-sm"
        />
      </CardContent>
    </Card>
  );
};
