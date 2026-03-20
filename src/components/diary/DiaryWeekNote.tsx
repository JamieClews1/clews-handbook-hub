import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DiaryWeekNoteProps {
  weekStart: string;
}

export const DiaryWeekNote = ({ weekStart }: DiaryWeekNoteProps) => {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!user) return;
    setLoaded(false);
    supabase
      .from("diary_week_notes")
      .select("note")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle()
      .then(({ data }) => {
        setNote(data?.note || "");
        setLoaded(true);
      });
  }, [user, weekStart]);

  const saveNote = (value: string) => {
    if (!user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!value.trim()) {
        await supabase
          .from("diary_week_notes")
          .delete()
          .eq("user_id", user.id)
          .eq("week_start", weekStart);
        return;
      }
      await supabase.from("diary_week_notes").upsert(
        { user_id: user.id, week_start: weekStart, note: value },
        { onConflict: "user_id,week_start" }
      );
    }, 600);
  };

  if (!loaded) return null;

  return (
    <div className="px-1">
      <input
        type="text"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          saveNote(e.target.value);
        }}
        placeholder="Week note — what's the theme this week?"
        className="w-full bg-transparent border-0 border-b border-border/30 focus:border-primary/40 outline-none text-base text-foreground placeholder:text-muted-foreground/30 py-2 transition-colors font-light tracking-wide"
      />
    </div>
  );
};
