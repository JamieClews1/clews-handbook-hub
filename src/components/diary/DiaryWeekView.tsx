import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DiaryDayColumn } from "./DiaryDayColumn";
import { DiaryWeekNote } from "./DiaryWeekNote";
import { DiaryWeekNav } from "./DiaryWeekNav";
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

export interface DiaryCard {
  id: string;
  user_id: string;
  day_of_week: number;
  week_start: string;
  content: string;
  color: string;
  display_order: number;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const DiaryWeekView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cards, setCards] = useState<DiaryCard[]>([]);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<DiaryCard | null>(null);

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

  const addCard = async (dayIndex: number) => {
    if (!user) return;
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
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to add card", variant: "destructive" });
      return;
    }
    setCards((prev) => [...prev, data as DiaryCard]);
  };

  const updateCard = async (id: string, updates: Partial<DiaryCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    const { error } = await supabase.from("diary_cards").update(updates).eq("id", id);
    if (error) toast({ title: "Failed to save", variant: "destructive" });
  };

  const deleteCard = async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from("diary_cards").delete().eq("id", id);
    if (error) toast({ title: "Failed to delete", variant: "destructive" });
  };

  const duplicateCard = async (card: DiaryCard) => {
    if (!user) return;
    const maxOrder = cards
      .filter((c) => c.day_of_week === card.day_of_week)
      .reduce((m, c) => Math.max(m, c.display_order), -1);

    const { data, error } = await supabase
      .from("diary_cards")
      .insert({
        user_id: user.id,
        day_of_week: card.day_of_week,
        week_start: weekStartStr,
        content: card.content,
        color: card.color,
        display_order: maxOrder + 1,
      })
      .select()
      .single();
    if (!error && data) setCards((prev) => [...prev, data as DiaryCard]);
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

    // over.id is either a card id or "day-{index}"
    let targetDay: number;
    if (overId.startsWith("day-")) {
      targetDay = parseInt(overId.split("-")[1], 10);
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (!overCard) return;
      targetDay = overCard.day_of_week;
    }

    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    if (card.day_of_week !== targetDay) {
      const dayCards = cards.filter((c) => c.day_of_week === targetDay);
      const maxOrder = dayCards.reduce((m, c) => Math.max(m, c.display_order), -1);
      await updateCard(cardId, { day_of_week: targetDay, display_order: maxOrder + 1 });
    }
  };

  const goToPrevWeek = () => setWeekStart((prev) => addDays(prev, -7));
  const goToNextWeek = () => setWeekStart((prev) => addDays(prev, 7));
  const goToThisWeek = () => setWeekStart(getMonday(new Date()));

  const isCurrentWeek = formatDate(getMonday(new Date())) === weekStartStr;

  const weekEndDate = addDays(weekStart, 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEndDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-6">
      <DiaryWeekNav
        weekLabel={weekLabel}
        isCurrentWeek={isCurrentWeek}
        onPrev={goToPrevWeek}
        onNext={goToNextWeek}
        onToday={goToThisWeek}
      />

      <DiaryWeekNote weekStart={weekStartStr} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-7 gap-2 lg:gap-3">
            {DAY_NAMES.map((name, i) => {
              const dayDate = addDays(weekStart, i);
              const isToday = formatDate(dayDate) === formatDate(new Date());
              return (
                <DiaryDayColumn
                  key={i}
                  dayIndex={i}
                  dayName={name}
                  dayShort={DAY_SHORT[i]}
                  dayDate={dayDate}
                  isToday={isToday}
                  cards={cards.filter((c) => c.day_of_week === i)}
                  onAddCard={() => addCard(i)}
                  onUpdateCard={updateCard}
                  onDeleteCard={deleteCard}
                  onDuplicateCard={duplicateCard}
                />
              );
            })}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="bg-card rounded-lg p-3 shadow-lg border border-border/50 opacity-90 rotate-2 max-w-[180px]">
                <p className="text-sm text-foreground">{activeCard.content || "Empty card"}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};
