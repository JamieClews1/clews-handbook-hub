import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DiaryWeekNote } from "./DiaryWeekNote";
import { DiaryWeekNav } from "./DiaryWeekNav";
import { DiaryCategoryRow } from "./DiaryCategoryRow";
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
import { DiaryMobileListView } from "./DiaryMobileListView";

export const DIARY_CATEGORIES = [
  { key: null, label: "General", icon: "📝" },
  { key: "drivers", label: "Drivers", icon: "🚛" },
  { key: "loads_in", label: "Loads In", icon: "📥" },
  { key: "loads_out", label: "Loads Out", icon: "📤" },
  { key: "maintenance", label: "Maintenance", icon: "🔧" },
] as const;

export const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  general: { bg: "", border: "border-slate-300", text: "text-slate-500", badge: "bg-slate-200" },
  drivers: { bg: "", border: "border-blue-400", text: "text-blue-600", badge: "bg-blue-200" },
  loads_in: { bg: "", border: "border-emerald-400", text: "text-emerald-600", badge: "bg-emerald-200" },
  loads_out: { bg: "", border: "border-amber-400", text: "text-amber-600", badge: "bg-amber-200" },
  maintenance: { bg: "", border: "border-rose-400", text: "text-rose-600", badge: "bg-rose-200" },
};

export interface DiaryCard {
  id: string;
  user_id: string;
  day_of_week: number;
  week_start: string;
  content: string;
  color: string;
  display_order: number;
  category: string | null;
}

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
  const isMobile = useIsMobile();
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

  const addCard = async (dayIndex: number, category: string | null = null) => {
    if (!user) return;
    const maxOrder = cards
      .filter((c) => c.day_of_week === dayIndex && c.category === category)
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
        category,
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
      .filter((c) => c.day_of_week === card.day_of_week && c.category === card.category)
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
        category: card.category,
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

    let targetDay: number;
    let targetCategory: string | null | undefined;

    if (overId.startsWith("cat-")) {
      const parts = overId.split("-day-");
      targetDay = parseInt(parts[1], 10);
      const catPart = parts[0].replace("cat-", "");
      targetCategory = catPart === "general" ? null : catPart;
    } else {
      const overCard = cards.find((c) => c.id === overId);
      if (!overCard) return;
      targetDay = overCard.day_of_week;
      targetCategory = overCard.category;
    }

    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const updates: Partial<DiaryCard> = {};
    if (card.day_of_week !== targetDay) updates.day_of_week = targetDay;
    if (targetCategory !== undefined && card.category !== targetCategory) updates.category = targetCategory;

    if (Object.keys(updates).length > 0) {
      const dayCards = cards.filter((c) => c.day_of_week === targetDay && c.category === targetCategory);
      const maxOrder = dayCards.reduce((m, c) => Math.max(m, c.display_order), -1);
      updates.display_order = maxOrder + 1;
      await updateCard(cardId, updates);
    }
  };

  const goToPrevWeek = () => setWeekStart((prev) => addDays(prev, -7));
  const goToNextWeek = () => setWeekStart((prev) => addDays(prev, 7));
  const goToThisWeek = () => setWeekStart(getMonday(new Date()));

  const isCurrentWeek = formatDate(getMonday(new Date())) === weekStartStr;
  const today = formatDate(new Date());

  const weekEndDate = addDays(weekStart, 6);
  const monthYear = weekStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Month title - large and bold like Tweek */}
      <h2 className="text-3xl font-black text-foreground tracking-tight">{monthYear}</h2>

      <DiaryWeekNav
        weekLabel={`${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEndDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
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
      ) : isMobile ? (
        <DiaryMobileListView
          weekStart={weekStart}
          cards={cards}
          onAddCard={addCard}
          onUpdateCard={updateCard}
          onDeleteCard={deleteCard}
          onDuplicateCard={duplicateCard}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Day headers — Tweek style */}
          <div className="grid grid-cols-[repeat(5,1fr)_0.5fr_0.5fr] gap-0">
            {DAY_SHORT.map((day, i) => {
              const dayDate = addDays(weekStart, i);
              const dayStr = formatDate(dayDate);
              const isToday = dayStr === today;
              const isPast = dayStr < today;
              const isWeekend = i >= 5;
              const dateLabel = dayDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
              return (
                <div
                  key={i}
                  className={`px-2 pb-2 ${isToday ? "border-b-[3px] border-primary" : "border-b border-border/30"}`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className={`text-sm font-bold ${
                      isToday ? "text-primary" : isPast ? "text-muted-foreground/40" : isWeekend ? "text-muted-foreground/50" : "text-foreground"
                    }`}>
                      {dateLabel}
                    </span>
                    <span className={`text-xs font-semibold ${
                      isToday ? "text-primary" : isPast ? "text-muted-foreground/30" : isWeekend ? "text-muted-foreground/40" : "text-muted-foreground/60"
                    }`}>
                      {day}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Category rows — minimal with just a small colored label */}
          <div>
            {DIARY_CATEGORIES.map((cat) => {
              const catKey = cat.key ?? "general";
              const colorClasses = CATEGORY_COLORS[catKey];
              const catCards = cards.filter((c) => (c.category ?? "general") === catKey || (c.category === null && catKey === "general"));
              const hasCards = catCards.length > 0;

              return (
                <div key={catKey}>
                  {/* Subtle category divider */}
                  <div className="grid grid-cols-[repeat(5,1fr)_0.5fr_0.5fr] gap-0">
                    <div className="px-2 pt-2 pb-0.5 col-span-7">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${colorClasses.text}`}>
                        {categoryLabel(cat)}
                      </span>
                    </div>
                  </div>
                  <DiaryCategoryRow
                    categoryKey={cat.key}
                    categoryLabel={cat.label}
                    colorClasses={colorClasses}
                    weekStart={weekStart}
                    cards={catCards}
                    onAddCard={addCard}
                    onUpdateCard={updateCard}
                    onDeleteCard={deleteCard}
                    onDuplicateCard={duplicateCard}
                  />
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="bg-card rounded px-2 py-1.5 shadow-lg border border-border/30 opacity-90 rotate-1 max-w-[200px]">
                <p className="text-[13px] text-foreground">{activeCard.content || "Empty"}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};

function categoryLabel(cat: { key: string | null; label: string }) {
  return cat.label;
}
