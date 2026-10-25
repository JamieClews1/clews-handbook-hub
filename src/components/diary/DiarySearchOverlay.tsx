import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, X } from "lucide-react";
import {
  DiaryCard,
  CATEGORY_DOT_CLASS,
  categoryKeyOf,
  searchEntries,
  addDays,
  getMonday,
} from "@/lib/diary-utils";

interface DiarySearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onJumpToEntry: (card: DiaryCard) => void;
}

export const DiarySearchOverlay = ({ open, onClose, onJumpToEntry }: DiarySearchOverlayProps) => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [allCards, setAllCards] = useState<DiaryCard[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    setQuery("");
    supabase
      .from("diary_cards")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false })
      .then(({ data }) => setAllCards((data as DiaryCard[]) ?? []));
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const results = useMemo(
    () => searchEntries(allCards, query).slice(0, 30),
    [allCards, query]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-24 w-full max-w-lg rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all weeks..."
            className="flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No entries found
            </p>
          )}
          {results.map((card) => {
            const date = addDays(getMonday(new Date(card.week_start + "T00:00:00")), card.day_of_week);
            return (
              <button
                key={card.id}
                onClick={() => onJumpToEntry(card)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left hover:bg-muted/50"
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${CATEGORY_DOT_CLASS[categoryKeyOf(card)]}`}
                />
                <span
                  className={`flex-1 truncate text-sm ${
                    card.done ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {card.content}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {date.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
