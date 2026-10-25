import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDiaryCategories } from "@/hooks/useDiaryCategories";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, Settings2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useIsMobile } from "@/hooks/use-mobile";
import { DiaryWeekNote } from "./DiaryWeekNote";
import { DiaryDayColumn } from "./DiaryDayColumn";
import { DiaryEntryModal } from "./DiaryEntryModal";
import { DiarySearchOverlay } from "./DiarySearchOverlay";
import { DiaryMobileDayView } from "./DiaryMobileDayView";
import { DiarySettingsDialog } from "./DiarySettingsDialog";
import {
  DiaryCard,
  DIARY_COLOR_DOT,
  getMonday,
  addDays,
  formatDate,
  isoWeekNumber,
  filterByCategory,
  entriesForDay,
  repeatOccurrences,
  DiaryRepeat,
} from "@/lib/diary-utils";

export const DiaryWeekView = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useDiaryCategories();
  const [cards, setCards] = useState<DiaryCard[]>([]);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<DiaryCard | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalCardId, setModalCardId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const weekStartStr = formatDate(weekStart);

  const fetchCards = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("diary_cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start", weekStartStr)
        .order("display_order", { ascending: true });
      if (error) throw error;
      setCards((data as DiaryCard[]) || []);
    } catch {
      toast({ title: "Error loading diary", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, weekStartStr, toast]);

  useEffect(() => {
    setLoading(true);
    fetchCards();
  }, [fetchCards]);

  const visibleCards = useMemo(
    () => filterByCategory(cards, categoryFilter),
    [cards, categoryFilter]
  );

  const addCard = async (dayIndex: number): Promise<DiaryCard | null> => {
    if (!user) return null;
    const maxOrder = cards
      .filter((c) => c.day_of_week === dayIndex)
      .reduce((m, c) => Math.max(m, c.display_order), -1);

    const { data, error } = await supabase
      .from("diary_cards")
      .insert({
        user_id: user.id,
        day_of_week: dayIndex,
        week_start: weekStartStr,
        content: "",
        color: "default",
        display_order: maxOrder + 1,
        category: null,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to add entry", variant: "destructive" });
      return null;
    }
    const card = data as DiaryCard;
    setCards((prev) => [...prev, card]);
    return card;
  };

  const updateCard = async (id: string, updates: Partial<DiaryCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    const { error } = await supabase.from("diary_cards").update(updates).eq("id", id);
    if (error) toast({ title: "Failed to save", variant: "destructive" });
  };

  const deleteCard = async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (modalCardId === id) setModalCardId(null);
    if (editingId === id) setEditingId(null);
    const { error } = await supabase.from("diary_cards").delete().eq("id", id);
    if (error) toast({ title: "Failed to delete", variant: "destructive" });
  };

  const toggleDone = (card: DiaryCard) => updateCard(card.id, { done: !card.done });

  const setRepeat = async (card: DiaryCard, repeat: DiaryRepeat | null) => {
    await updateCard(card.id, { repeat });
    if (!repeat || !user) return;
    const occurrences = repeatOccurrences(card, repeat);
    for (const occ of occurrences) {
      await supabase.from("diary_cards").insert({
        user_id: user.id,
        day_of_week: occ.day_of_week,
        week_start: occ.week_start,
        content: card.content,
        color: card.color ?? "default",
        display_order: 1000,
        category: card.category,
      });
    }
    toast({ title: `Repeat set — ${occurrences.length} future entries added` });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const overId = over.id as string;
    if (cardId === overId) return;

    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    let targetDay: number;
    let targetIndex: number;

    if (overId.startsWith("day-")) {
      targetDay = parseInt(overId.slice(4), 10);
      targetIndex = entriesForDay(cards, targetDay).filter((c) => c.id !== cardId).length;
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (!overCard) return;
      targetDay = overCard.day_of_week;
      targetIndex = entriesForDay(cards, targetDay).findIndex((c) => c.id === overId);
      if (targetIndex < 0) targetIndex = 0;
    }

    const dayEntries = entriesForDay(cards, targetDay).filter((c) => c.id !== cardId);
    dayEntries.splice(targetIndex, 0, { ...card, day_of_week: targetDay });

    const updates: Array<{ id: string; display_order: number; day_of_week: number }> = [];
    dayEntries.forEach((c, i) => {
      if (c.id === cardId || c.display_order !== i || c.day_of_week !== targetDay) {
        updates.push({ id: c.id, display_order: i, day_of_week: targetDay });
      }
    });
    if (updates.length === 0) return;

    setCards((prev) =>
      prev.map((c) => {
        const u = updates.find((x) => x.id === c.id);
        return u ? { ...c, display_order: u.display_order, day_of_week: u.day_of_week } : c;
      })
    );
    for (const u of updates) {
      await supabase
        .from("diary_cards")
        .update({ display_order: u.display_order, day_of_week: u.day_of_week })
        .eq("id", u.id);
    }
  };

  const goToPrevWeek = () => setWeekStart((prev) => addDays(prev, -7));
  const goToNextWeek = () => setWeekStart((prev) => addDays(prev, 7));
  const goToThisWeek = () => setWeekStart(getMonday(new Date()));

  // Keyboard: arrows change week, T jumps to today
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        return;
      if (modalCardId || searchOpen || settingsOpen) return;
      if (e.key === "ArrowLeft") goToPrevWeek();
      else if (e.key === "ArrowRight") goToNextWeek();
      else if (e.key.toLowerCase() === "t") goToThisWeek();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalCardId, searchOpen, settingsOpen]);

  const isCurrentWeek = formatDate(getMonday(new Date())) === weekStartStr;
  const today = formatDate(new Date());
  const monthYear = weekStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const weekNumber = isoWeekNumber(weekStart);
  const modalCard = modalCardId ? cards.find((c) => c.id === modalCardId) ?? null : null;

  const columnProps = {
    weekStart,
    today,
    categories,
    editingId,
    onAddLine: addCard,
    onRequestEdit: setEditingId,
    onUpdate: updateCard,
    onDelete: deleteCard,
    onOpen: (card: DiaryCard) => setModalCardId(card.id),
    onToggleDone: toggleDone,
  };

  return (
    <div className="space-y-5">
      {/* Header: month + week number, search / today / nav / settings */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-4xl font-black text-foreground tracking-tight">
          {monthYear}{" "}
          <span className="text-2xl font-semibold text-muted-foreground/60">W{weekNumber}</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search diary"
            onClick={() => setSearchOpen(true)}
            className="h-9 w-9 rounded-full"
          >
            <Search className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToThisWeek}
              className="text-sm rounded-full px-4 h-9"
            >
              Today
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous week"
            onClick={goToPrevWeek}
            className="h-9 w-9 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next week"
            onClick={goToNextWeek}
            className="h-9 w-9 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Diary settings"
            onClick={() => setSettingsOpen(true)}
            className="h-9 w-9 rounded-full"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
          label="All"
        />
        {categories.map((cat) => (
          <FilterChip
            key={cat.key}
            active={categoryFilter === cat.key}
            onClick={() => setCategoryFilter(cat.key)}
            label={cat.label}
            dotClass={DIARY_COLOR_DOT[cat.color] ?? DIARY_COLOR_DOT.grey}
          />
        ))}
      </div>

      <DiaryWeekNote weekStart={weekStartStr} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : isMobile ? (
        <DiaryMobileDayView
          weekStart={weekStart}
          cards={visibleCards}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          {...columnProps}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-6 gap-x-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <DiaryDayColumn
                key={i}
                dayIndex={i}
                entries={entriesForDay(visibleCards, i)}
                {...columnProps}
              />
            ))}
            <div className="flex flex-col gap-8">
              <DiaryDayColumn
                dayIndex={5}
                entries={entriesForDay(visibleCards, 5)}
                lines={4}
                {...columnProps}
              />
              <DiaryDayColumn
                dayIndex={6}
                entries={entriesForDay(visibleCards, 6)}
                lines={4}
                {...columnProps}
              />
            </div>
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="bg-card rounded px-2 py-1.5 shadow-lg border border-border/30 opacity-90 rotate-1 max-w-[220px]">
                <p className="text-sm text-foreground truncate">
                  {activeCard.content || "Empty"}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <DiaryEntryModal
        card={modalCard}
        weekStart={weekStart}
        categories={categories}
        open={!!modalCard}
        onClose={() => setModalCardId(null)}
        onUpdate={updateCard}
        onDelete={deleteCard}
        onSetRepeat={setRepeat}
      />

      <DiarySearchOverlay
        open={searchOpen}
        categories={categories}
        onClose={() => setSearchOpen(false)}
        onJumpToEntry={(card) => {
          setWeekStart(getMonday(new Date(card.week_start + "T00:00:00")));
          setModalCardId(card.id);
          setSearchOpen(false);
        }}
      />

      <DiarySettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        categories={categories}
        onAdd={addCategory}
        onUpdate={updateCategory}
        onDelete={deleteCategory}
      />
    </div>
  );
};

const FilterChip = ({
  active,
  onClick,
  label,
  dotClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dotClass?: string;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 rounded-full px-3.5 h-8 text-sm font-medium border transition-colors ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
    }`}
  >
    {dotClass && <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />}
    {label}
  </button>
);
