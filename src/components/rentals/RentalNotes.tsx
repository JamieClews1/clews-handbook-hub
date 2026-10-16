import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Note = { id: string; body: string; author_name: string; created_at: string };

export default function RentalNotes({ binKey, agreementId, legacyNotes }: { binKey?: string; agreementId?: string; legacyNotes?: string | null }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const load = async () => {
    setLoading(true);
    let query = supabase.from("rental_notes").select("id,body,author_name,created_at").order("created_at", { ascending: false });
    if (binKey) query = query.eq("bin_key", binKey);
    else if (agreementId) query = query.eq("agreement_id", agreementId);
    else return;
    const { data, error } = await query;
    if (error) toast({ title: "Could not load notes", description: error.message, variant: "destructive" });
    else setNotes(data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [binKey, agreementId]);

  const add = async () => {
    if (!body.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from("rental_notes").insert({ body: body.trim(), bin_key: binKey ?? null, agreement_id: agreementId ?? null });
    if (error) toast({ title: "Could not save note", description: error.message, variant: "destructive" });
    else { setBody(""); await load(); }
    setSaving(false);
  };

  return <section className="space-y-3">
    <Label className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> Notes</Label>
    <div className="max-h-64 overflow-y-auto space-y-3">
      {loading ? <p className="text-sm text-muted-foreground">Loading notes…</p> : notes.map(note => <div key={note.id} className="border-b pb-3 space-y-1">
        <p className="text-sm whitespace-pre-wrap break-words">{note.body}</p>
        <p className="text-xs text-muted-foreground">{note.author_name} · {format(new Date(note.created_at), "dd MMM yyyy HH:mm")}</p>
      </div>)}
      {legacyNotes && !notes.some(note => note.body === legacyNotes) && <div className="border-b pb-3"><p className="text-sm whitespace-pre-wrap">{legacyNotes}</p><p className="text-xs text-muted-foreground">Earlier note · author not recorded</p></div>}
      {!loading && !notes.length && !legacyNotes && <p className="text-sm text-muted-foreground">No notes yet.</p>}
    </div>
    <Textarea aria-label="New rental note" placeholder="Add a note…" value={body} onChange={event => setBody(event.target.value)} rows={3} />
    <Button size="sm" onClick={add} disabled={!body.trim() || saving}><Plus className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Add Note"}</Button>
  </section>;
}