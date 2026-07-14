import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PORTAL_SECTIONS } from "@/lib/portal-sections";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { EyeOff, Eye } from "lucide-react";

export function SectionVisibilitySettings() {
  const { toast } = useToast();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("portal_section_visibility")
        .select("section_key, hidden");
      if (error) {
        toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      } else {
        const map: Record<string, boolean> = {};
        (data ?? []).forEach((r: any) => (map[r.section_key] = !!r.hidden));
        setHidden(map);
      }
      setLoading(false);
    })();
  }, [toast]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof PORTAL_SECTIONS> = {};
    PORTAL_SECTIONS.forEach((s) => {
      (g[s.category] ||= []).push(s);
    });
    return g;
  }, []);

  const toggle = async (key: string, currentHidden: boolean) => {
    const next = !currentHidden;
    setSavingKey(key);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("portal_section_visibility")
      .upsert({ section_key: key, hidden: next, updated_by: user?.id, updated_at: new Date().toISOString() });
    setSavingKey(null);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setHidden((h) => ({ ...h, [key]: next }));
    toast({ title: next ? "Section hidden" : "Section published", description: `${key} is now ${next ? "hidden from users" : "live"}.` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Section Visibility</CardTitle>
        <CardDescription>
          Toggle portal sections live or hide them from users while they're still being built.
          Admins always see every section (hidden ones are marked).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading &&
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{category}</h3>
              <div className="divide-y divide-border border rounded-lg">
                {items.map((s) => {
                  const isHidden = !!hidden[s.key];
                  return (
                    <div key={s.key} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        {isHidden ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-primary" />
                        )}
                        <div>
                          <Label className="text-sm">{s.label}</Label>
                          {s.path && (
                            <p className="text-xs text-muted-foreground font-mono">{s.path}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {isHidden ? "Hidden" : "Live"}
                        </span>
                        <Switch
                          checked={!isHidden}
                          disabled={savingKey === s.key}
                          onCheckedChange={() => toggle(s.key, isHidden)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
