import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PORTAL_SECTIONS } from "@/lib/portal-sections";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { EyeOff, Eye, Users } from "lucide-react";

type Person = { id: string; name: string; email: string };

export function SectionVisibilitySettings() {
  const { toast } = useToast();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [allowed, setAllowed] = useState<Record<string, string[]>>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [plPeople, setPlPeople] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [vis, prof, pl] = await Promise.all([
        supabase.from("portal_section_visibility").select("section_key, hidden, allowed_user_ids"),
        supabase.from("profiles").select("id, full_name, email, is_archived").order("full_name"),
        supabase.rpc("list_company_pl_access"),
      ]);
      if (vis.error) {
        toast({ title: "Failed to load", description: vis.error.message, variant: "destructive" });
      } else {
        const h: Record<string, boolean> = {};
        const a: Record<string, string[]> = {};
        (vis.data ?? []).forEach((r: any) => { h[r.section_key] = !!r.hidden; a[r.section_key] = r.allowed_user_ids ?? []; });
        setHidden(h); setAllowed(a);
      }
      setPeople(((prof.data ?? []) as any[]).filter(p => !p.is_archived && (p.email ?? "").endsWith("@clewsrecycling.co.uk") || p.email === "jclewsie@gmail.com")
        .map(p => ({ id: p.id, name: p.full_name || p.email, email: p.email })));
      setPlPeople(((pl.data ?? []) as any[]).filter(r => r.has_access || r.is_manager).map(r => r.full_name || r.email));
      setLoading(false);
    })();
  }, [toast]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof PORTAL_SECTIONS> = {};
    PORTAL_SECTIONS.forEach((s) => { (g[s.category] ||= []).push(s); });
    return g;
  }, []);

  const save = async (key: string, patch: { hidden?: boolean; allowed_user_ids?: string[] }) => {
    setSavingKey(key);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("portal_section_visibility").upsert({
      section_key: key,
      hidden: patch.hidden ?? !!hidden[key],
      allowed_user_ids: patch.allowed_user_ids ?? allowed[key] ?? [],
      updated_by: user?.id, updated_at: new Date().toISOString(),
    });
    setSavingKey(null);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return false; }
    if (patch.hidden !== undefined) setHidden(h => ({ ...h, [key]: patch.hidden! }));
    if (patch.allowed_user_ids) setAllowed(a => ({ ...a, [key]: patch.allowed_user_ids! }));
    return true;
  };

  const togglePerson = (key: string, id: string) => {
    const cur = allowed[key] ?? [];
    save(key, { allowed_user_ids: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] });
  };

  const nameOf = (id: string) => people.find(p => p.id === id)?.name ?? "Unknown user";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Section Visibility</CardTitle>
        <CardDescription>
          Turn sections live or hidden, and choose who can see a section. With nobody chosen, everyone with the usual access can see it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{category}</h3>
            <div className="divide-y divide-border border rounded-lg">
              {items.map((s) => {
                const isHidden = !!hidden[s.key];
                const list = allowed[s.key] ?? [];
                const isPl = s.key === "company-pl";
                return (
                  <div key={s.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {isHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
                      <div className="min-w-0">
                        <Label className="text-sm">{s.label}</Label>
                        <p className="text-xs text-muted-foreground">
                          {isPl
                            ? <>Only: {plPeople.join(", ") || "Jamie"} · <Link className="underline" to="/finance/company-pl">managed in Company P&amp;L</Link></>
                            : list.length ? <>Only: {list.map(nameOf).join(", ")}</> : "Everyone with access"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isPl && (
                        <Popover onOpenChange={() => setSearch("")}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5"><Users className="h-3.5 w-3.5" />Who can see</Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 p-2">
                            <Input placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 mb-2" />
                            <div className="max-h-64 overflow-y-auto space-y-1">
                              {people.filter(p => `${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase())).map(p => (
                                <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                                  <Checkbox checked={list.includes(p.id)} disabled={savingKey === s.key} onCheckedChange={() => togglePerson(s.key, p.id)} />
                                  <span className="truncate">{p.name}<span className="block text-xs text-muted-foreground">{p.email}</span></span>
                                </label>
                              ))}
                            </div>
                            {list.length > 0 && <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => save(s.key, { allowed_user_ids: [] })}>Let everyone see it</Button>}
                          </PopoverContent>
                        </Popover>
                      )}
                      <span className="text-xs text-muted-foreground w-12 text-right">{isHidden ? "Hidden" : "Live"}</span>
                      <Switch checked={!isHidden} disabled={savingKey === s.key} onCheckedChange={() => save(s.key, { hidden: !isHidden })} />
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
