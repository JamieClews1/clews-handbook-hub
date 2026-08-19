import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Globe, Loader2, Plus, Save, X } from "lucide-react";

type Rules = {
  id?: string;
  exclude_website_enquiries: boolean;
  exclude_patterns: string[];
};

export const AutoReplyExclusionSettings = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<Rules>({ exclude_website_enquiries: true, exclude_patterns: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("crm_auto_reply_rules")
        .select("id, exclude_website_enquiries, exclude_patterns")
        .limit(1)
        .maybeSingle();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else if (data) {
        setRules({
          id: data.id,
          exclude_website_enquiries: data.exclude_website_enquiries ?? true,
          exclude_patterns: (data.exclude_patterns ?? []) as string[],
        });
      }
      setLoading(false);
    })();
  }, [toast]);

  const addPattern = () => {
    const v = input.trim();
    if (!v) return;
    if (rules.exclude_patterns.some((p) => p.toLowerCase() === v.toLowerCase())) return;
    setRules((r) => ({ ...r, exclude_patterns: [...r.exclude_patterns, v] }));
    setInput("");
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      exclude_website_enquiries: rules.exclude_website_enquiries,
      exclude_patterns: rules.exclude_patterns,
      updated_at: new Date().toISOString(),
    };
    const { error } = rules.id
      ? await supabase.from("crm_auto_reply_rules").update(payload).eq("id", rules.id)
      : await supabase.from("crm_auto_reply_rules").insert(payload as any);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved", description: "Auto-reply exclusions updated." });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Website Enquiry Exclusions
        </CardTitle>
        <CardDescription>
          Stop the automatic holding reply going out to enquiries submitted through the website
          (www.clewsrecycling.co.uk) or any other source you list below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm">Skip auto-reply for website enquiries</Label>
            <p className="text-xs text-muted-foreground">
              When on, any incoming email matching the markers below will not receive the automated reply.
            </p>
          </div>
          <Switch
            checked={rules.exclude_website_enquiries}
            onCheckedChange={(v) => setRules((r) => ({ ...r, exclude_website_enquiries: v }))}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Matching markers</Label>
          <p className="text-xs text-muted-foreground">
            Matched against the sender address, subject and email body (case-insensitive).
          </p>
          <div className="flex flex-wrap gap-1.5 min-h-[32px]">
            {rules.exclude_patterns.map((p, i) => (
              <Badge key={i} variant="secondary" className="gap-1 pr-1 font-mono text-xs">
                {p}
                <button
                  onClick={() =>
                    setRules((r) => ({ ...r, exclude_patterns: r.exclude_patterns.filter((_, x) => x !== i) }))
                  }
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {rules.exclude_patterns.length === 0 && (
              <span className="text-xs text-muted-foreground">No markers — nothing will be excluded.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPattern())}
              placeholder="e.g. clewsrecycling.co.uk or website enquiry"
              className="flex-1"
            />
            <Button type="button" size="sm" variant="outline" onClick={addPattern} disabled={!input.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
