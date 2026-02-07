import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Settings } from "lucide-react";

type RebateRule = {
  id: string;
  rule_key: string;
  rule_name: string;
  description: string;
  is_enabled: boolean;
  rule_value: number | null;
};

type Props = {
  canEdit: boolean;
};

export const RebateSettingsSection = ({ canEdit }: Props) => {
  const { toast } = useToast();
  const [rules, setRules] = useState<RebateRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local state for the exclusion toggles
  const [excludeSkip, setExcludeSkip] = useState(false);
  const [excludeDeliver, setExcludeDeliver] = useState(false);

  useEffect(() => {
    const loadRules = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("rebate_rules")
          .select("*")
          .order("display_order");

        if (error) throw error;

        const rulesData = (data ?? []) as RebateRule[];
        setRules(rulesData);

        // Find and set local state for our specific rules
        const skipRule = rulesData.find(r => r.rule_key === "exclude_skip_job_type");
        const deliverRule = rulesData.find(r => r.rule_key === "exclude_deliver_movement");

        setExcludeSkip(skipRule?.is_enabled ?? false);
        setExcludeDeliver(deliverRule?.is_enabled ?? false);
      } catch (e: any) {
        console.error(e);
        toast({
          title: "Error loading settings",
          description: e?.message ?? "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadRules();
  }, [toast]);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);

    try {
      // Upsert the exclusion rules
      const rulesToUpsert = [
        {
          rule_key: "exclude_skip_job_type",
          rule_name: "Exclude SKIP Job Type",
          description: "Exclude jobs with 'SKIP' job type (container type) from rebate reporting.",
          is_enabled: excludeSkip,
          display_order: 20,
        },
        {
          rule_key: "exclude_deliver_movement",
          rule_name: "Exclude Deliver Movement",
          description: "Exclude jobs with 'Deliver' movement type from rebate reporting.",
          is_enabled: excludeDeliver,
          display_order: 30,
        },
      ];

      for (const rule of rulesToUpsert) {
        const existing = rules.find(r => r.rule_key === rule.rule_key);
        
        if (existing) {
          // Update existing rule
          const { error } = await supabase
            .from("rebate_rules")
            .update({ is_enabled: rule.is_enabled })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          // Insert new rule
          const { error } = await supabase
            .from("rebate_rules")
            .insert(rule);
          if (error) throw error;
        }
      }

      toast({
        title: "Settings saved",
        description: "Rebate exclusion settings have been updated.",
      });

      // Reload rules to sync state
      const { data } = await supabase.from("rebate_rules").select("*").order("display_order");
      if (data) setRules(data as RebateRule[]);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Save failed",
        description: e?.message ?? "Could not save settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Rebate Settings
          </CardTitle>
          <CardDescription>
            Configure which job types and movements are excluded from rebate calculations.
          </CardDescription>
        </div>
        <Button onClick={handleSave} disabled={!canEdit || saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Exclusion Rules</h3>
          <p className="text-sm text-muted-foreground">
            Enable these options to exclude specific job types or movement types from rebate reporting.
          </p>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="exclude-skip" className="text-base font-medium">
                  Exclude SKIP Job Type
                </Label>
                <p className="text-sm text-muted-foreground">
                  Jobs with container type containing "SKIP" will be excluded from rebate calculations.
                </p>
              </div>
              <Switch
                id="exclude-skip"
                checked={excludeSkip}
                onCheckedChange={setExcludeSkip}
                disabled={!canEdit}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="exclude-deliver" className="text-base font-medium">
                  Exclude Deliver Movement
                </Label>
                <p className="text-sm text-muted-foreground">
                  Jobs with movement type "Deliver" will be excluded from rebate calculations.
                </p>
              </div>
              <Switch
                id="exclude-deliver"
                checked={excludeDeliver}
                onCheckedChange={setExcludeDeliver}
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>

        {!canEdit && (
          <p className="text-sm text-muted-foreground">
            View-only: you don't have permission to edit rebate settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
