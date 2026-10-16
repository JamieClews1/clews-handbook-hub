import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { userColour } from "@/lib/user-colour";
import { loadSeenMap, markNotesSeen, notesBadgeLabel, notesKeyFor, unreadNotes } from "@/lib/rental-notes-unread";

type Note = { id: string; body: string; author_name: string; created_at: string };

type Props = {
  binKey?: string;
  agreementId?: string;
  legacyNotes?: string | null;
  userId?: string | null;
  // Tells the surrounding list to refresh its "notes to read" counts.
  onRead?: () => void;
};

export default function RentalNotes({ binKey, agreementId, legacyNotes, userId, onRead }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Captured when the thread opens: which notes this person had not seen yet.
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const threadKey = notesKeyFor({ binKey, agreementId });

  const load = async (markRead: boolean) => {
    setLoading(true);
    let query = supabase.from("rental_notes").select("id,body,author_name,created_at").order("created_at", { ascending: false });
    if (binKey) query = query.eq("bin_key", binKey);
    else if (agreementId) query = query.eq("agreement_id", agreementId);
    else { setLoading(false); return; }
    const { data, error } = await query;
    if (error) toast({ title: "Could not load notes", description: error.message, variant: "destructive" });
    else {
      const rows = (data ?? []) as Note[];
      setNotes(rows);
      const seenAt = threadKey ? loadSeenMap(userId)[threadKey] ?? null : null;
      const unread = unreadNotes(rows, seenAt);
      setUnreadIds(new Set(unread.map((note) => note.id)));
      // Opening the thread is the read action — the highlight stays for this view
      // only, so it is not flagged again next time.
      if (markRead && unread.length && threadKey) {
        markNotesSeen(userId, threadKey);
        onRead?.();
      }
    }
    setLoading(false);
  };

  useEffect(() => { void load(true); }, [binKey, agreementId, userId]);

  const add = async () => {
    if (!body.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from("rental_notes").insert({ body: body.trim(), bin_key: binKey ?? null, agreement_id: agreementId ?? null });
    if (error) toast({ title: "Could not save note", description: error.message, variant: "destructive" });
    else {
      setBody("");
      await load(false);
      // A note you wrote yourself needs no reading.
      if (threadKey) { markNotesSeen(userId, threadKey); onRead?.(); }
    }
    setSaving(false);
  };

  const toRead = unreadIds.size;

  return (
    <section className={cn(
      "space-y-3 rounded-lg border p-3",
      toRead > 0 ? "border-primary/60 bg-primary/5" : "border-transparent",
    )}>
      <Label className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" /> Notes
        {toRead > 0 && <Badge className="ml-1">{notesBadgeLabel(toRead)} to read</Badge>}
      </Label>
      <div className="max-h-64 overflow-y-auto space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Loading notes…</p> : notes.map(note => {
          const isNew = unreadIds.has(note.id);
          return <div key={note.id} className={cn(
            "space-y-1 border-b pb-3",
            isNew && "-mx-2 rounded-md border-l-2 border-primary bg-primary/10 px-2",
          )}>
            <p className="text-sm whitespace-pre-wrap break-words">{note.body}</p>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: userColour(note.author_name) }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: userColour(note.author_name) }} />
                {note.author_name}
              </span>
              <span>· {format(new Date(note.created_at), "dd MMM yyyy HH:mm")}</span>
              {isNew && <Badge variant="outline" className="text-[10px]">New</Badge>}
            </p>
          </div>;
        })}
        {legacyNotes && !notes.some(note => note.body === legacyNotes) && <div className="border-b pb-3"><p className="text-sm whitespace-pre-wrap">{legacyNotes}</p><p className="text-xs text-muted-foreground">Earlier note · author not recorded</p></div>}
        {!loading && !notes.length && !legacyNotes && <p className="text-sm text-muted-foreground">No notes yet.</p>}
      </div>
      <Textarea aria-label="New rental note" placeholder="Add a note…" value={body} onChange={event => setBody(event.target.value)} rows={3} />
      <Button size="sm" onClick={add} disabled={!body.trim() || saving}><Plus className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Add Note"}</Button>
    </section>
  );
}
