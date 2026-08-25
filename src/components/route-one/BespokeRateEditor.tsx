import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Props = {
  jobId?: string | null;
  jobNumber?: string | null;
  value: number | null | undefined;
  onSaved?: (value: number | null) => void;
};

/** Per-job bespoke rebate rate (£/tonne) editor for Skiptrak (Data Hub) jobs. */
export function BespokeRateEditor({ jobId, jobNumber, value, onSaved }: Props) {
  const { toast } = useToast();
  const [input, setInput] = useState(value == null ? "" : String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInput(value == null ? "" : String(value));
  }, [value, jobId]);

  const save = async (next: number | null) => {
    if (!jobId) return;
    setSaving(true);
    const { error } = await supabase
      .from("data_hub_jobs")
      .update({ rebate_rate_per_tonne: next } as any)
      .eq("id", jobId);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save rate", description: error.message, variant: "destructive" });
      return;
    }
    setInput(next == null ? "" : String(next));
    onSaved?.(next);
    toast({
      title: next == null ? "Bespoke rate cleared" : "Bespoke rate saved",
      description: jobNumber ? `Job ${jobNumber}` : undefined,
    });
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <Label className="text-xs text-muted-foreground">Bespoke rebate rate (£/tonne)</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="Use configured rate"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="h-8 max-w-[160px]"
        />
        <Button
          size="sm"
          className="h-8"
          disabled={saving || !jobId}
          onClick={() => {
            const trimmed = input.trim();
            if (trimmed === "") return save(null);
            const num = Number(trimmed);
            if (!Number.isFinite(num)) {
              toast({ title: "Enter a valid number", variant: "destructive" });
              return;
            }
            save(num);
          }}
        >
          Save
        </Button>
        {value != null && (
          <Button size="sm" variant="ghost" className="h-8" disabled={saving} onClick={() => save(null)}>
            Clear
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Overrides the configured material rate for this job in the skip / RoRo rebate engine.
      </p>
    </div>
  );
}

export default BespokeRateEditor;
