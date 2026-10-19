import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Sparkles } from "lucide-react";

type Persona = { id: string; team_member_id: string | null; is_default: boolean; name: string; persona: string; is_active: boolean; test_status: string; reviewed_at: string | null };
type Member = { id: string; name: string };
type Score = { persona: string; send: number; light: number; rewrite: number };

const TEMPLATE = `NAME / ROLE\n\nVOICE\n- \n\nGREETING / SIGN-OFF\n\nLENGTH AND LAYOUT\n\nPATTERNS BY TAG\nQuote:\nNew order / Exchange / Collection:\nDecline:\nService issue:\nWeight / WTN:\n\nPHRASES TO USE\n\nPHRASES TO AVOID\n\nEXAMPLES\n\nGUARDRAILS\n- Facts only from the portal.\n- Never passwords, bank or card details.\n- Never offer money or admit fault without approval.\n- Draft only.`;

const STEPS = [
  ["Collect", "Gather at least 50 replies the person sent over the last 2–3 months, across every email type."],
  ["Clean", "Remove quoted history, signatures, disclaimers, passwords and bank details."],
  ["Analyse", "Note greeting, sign-off, length, how prices are laid out, how they say no and apologise, regular phrases."],
  ["Group by email type", "Write one reply shape for each tag: Quote, New order, Exchange, Collection, Service issue, Weight / WTN…"],
  ["Pick examples", "2–3 real replies per type, with customer names and prices swapped for placeholders."],
  ["Write the voice", "Fill in the template below and save it against the person."],
  ["Test", "Use AI draft on 20 of their emails and rate each one. Aim for 70% or more Send as is / Light edit, then mark Approved."],
  ["Review quarterly", "Or whenever rates, policies or the team change."],
];

export function CrmPersonas() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Persona[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState("");

  const load = async () => {
    const [{ data: p }, { data: m }, { data: t }] = await Promise.all([
      supabase.from("crm_ai_personas").select("*").order("is_default", { ascending: false }).order("name"),
      supabase.from("crm_team_members").select("id, name").eq("is_active", true).order("name"),
      supabase.from("crm_tickets").select("ai_draft_persona, ai_draft_score").not("ai_draft_score", "is", null),
    ]);
    setRows((p ?? []) as Persona[]);
    setMembers((m ?? []) as Member[]);
    const s: Record<string, Score> = {};
    for (const r of (t ?? []) as any[]) {
      const k = r.ai_draft_persona ?? "";
      s[k] ??= { persona: k, send: 0, light: 0, rewrite: 0 };
      (s[k] as any)[r.ai_draft_score]++;
    }
    setScores(s);
  };
  useEffect(() => { load(); }, []);

  const current = rows.find((r) => r.id === sel);
  useEffect(() => { setText(current?.persona ?? ""); }, [sel, current?.persona]);

  const update = async (id: string, patch: Partial<Persona>) => {
    const { error } = await supabase.from("crm_ai_personas").update(patch).eq("id", id);
    if (error) return toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    toast({ title: "Saved" });
    load();
  };

  const create = async (m: Member) => {
    const { data, error } = await supabase.from("crm_ai_personas").insert({ team_member_id: m.id, name: m.name, persona: TEMPLATE }).select("id").single();
    if (error) return toast({ title: "Couldn't create", description: error.message, variant: "destructive" });
    await load();
    setSel(data.id);
  };

  const withoutVoice = members.filter((m) => !rows.some((r) => r.team_member_id === m.id));

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card className="p-3 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> AI voices</h3>
          <p className="text-xs text-muted-foreground">AI draft writes in the voice of the person the email is assigned to, otherwise the person drafting, otherwise the team voice. Prices and dates always come from the portal.</p>
          {rows.map((r) => {
            const s = scores[r.name];
            const total = s ? s.send + s.light + s.rewrite : 0;
            const pct = total ? Math.round(((s!.send + s!.light) / total) * 100) : null;
            return (
              <button key={r.id} onClick={() => setSel(r.id)}
                className={`w-full text-left rounded-md border p-2 text-sm ${sel === r.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <Badge variant={r.test_status === "approved" ? "default" : "secondary"}>{r.is_default ? "Team default" : r.test_status === "approved" ? "Approved" : "Testing"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total ? `${total} rated · ${pct}% send or light edit` : "No drafts rated yet"}{!r.is_active && " · off"}
                </p>
              </button>
            );
          })}
          {withoutVoice.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs text-muted-foreground">Add a voice for:</p>
              <div className="flex flex-wrap gap-1">
                {withoutVoice.map((m) => (
                  <Button key={m.id} size="sm" variant="outline" className="h-7" onClick={() => create(m)}><Plus className="h-3 w-3" /> {m.name}</Button>
                ))}
              </div>
            </div>
          )}
        </Card>
        <Card className="p-3">
          <h3 className="font-semibold text-sm mb-2">How to build a voice</h3>
          <ol className="space-y-1.5 text-xs">
            {STEPS.map(([t, d], i) => (
              <li key={t}><span className="font-medium text-foreground">{i + 1}. {t}.</span> <span className="text-muted-foreground">{d}</span></li>
            ))}
          </ol>
        </Card>
      </div>

      <Card className="p-4">
        {!current ? (
          <p className="text-sm text-muted-foreground">Choose a voice to view or edit it.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">{current.name}</h3>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">On <Switch checked={current.is_active} onCheckedChange={(v) => update(current.id, { is_active: v })} /></label>
                {!current.is_default && (
                  <Button size="sm" variant="outline" onClick={() => update(current.id, { test_status: current.test_status === "approved" ? "testing" : "approved", reviewed_at: new Date().toISOString().slice(0, 10) })}>
                    {current.test_status === "approved" ? "Back to testing" : "Mark approved"}
                  </Button>
                )}
                <Button size="sm" onClick={() => update(current.id, { persona: text, reviewed_at: new Date().toISOString().slice(0, 10) })}><Save className="h-4 w-4" /> Save</Button>
              </div>
            </div>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[560px] font-mono text-xs" />
            <p className="text-xs text-muted-foreground">Last reviewed: {current.reviewed_at ? new Date(current.reviewed_at).toLocaleDateString("en-GB") : "not yet"}. Never put real prices in examples — use [RATE].</p>
          </div>
        )}
      </Card>
    </div>
  );
}
