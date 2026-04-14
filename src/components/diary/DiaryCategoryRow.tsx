import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { DiaryCardItem } from "./DiaryCardItem";
import type { DiaryCard } from "./DiaryWeekView";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DiaryCategoryRowProps {
  categoryKey: string | null;
  categoryLabel: string;
  colorClasses: { bg: string; border: string; text: string; badge: string };
  weekStart: Date;
  cards: DiaryCard[];
  onAddCard: (dayIndex: number, category: string | null) => void;
  onUpdateCard: (id: string, updates: Partial<DiaryCard>) => void;
  onDeleteCard: (id: string) => void;
  onDuplicateCard: (card: DiaryCard) => void;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export const DiaryCategoryRow = ({
  categoryKey,
  categoryLabel,
  colorClasses,
  weekStart,
  cards,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
}: DiaryCategoryRowProps) => {
  return (
    <div className="grid grid-cols-[120px_repeat(5,1fr)_0.5fr_0.5fr] border-b border-border/10">
      {/* Category label */}
      <div className={`flex items-start pt-2 pl-3 border-l-4 ${colorClasses.border}`}>
        <span className={`text-xs font-bold uppercase tracking-wider ${colorClasses.text}`}>{categoryLabel}</span>
      </div>

      {/* 7 day cells — weekends narrower via grid */}
      {Array.from({ length: 7 }, (_, dayIndex) => {
        const dayDate = addDays(weekStart, dayIndex);
        const isToday = formatDate(dayDate) === formatDate(new Date());
        const dayCards = cards
          .filter((c) => c.day_of_week === dayIndex)
          .sort((a, b) => a.display_order - b.display_order);
        const droppableId = `cat-${categoryKey ?? "general"}-day-${dayIndex}`;

        return (
          <DroppableDay
            key={dayIndex}
            droppableId={droppableId}
            dayIndex={dayIndex}
            isToday={isToday}
            dayDate={dayDate}
            dayCards={dayCards}
            categoryKey={categoryKey}
            onAddCard={onAddCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
            onDuplicateCard={onDuplicateCard}
          />
        );
      })}
    </div>
  );
};

interface DroppableDayProps {
  droppableId: string;
  dayIndex: number;
  isToday: boolean;
  dayDate: Date;
  dayCards: DiaryCard[];
  categoryKey: string | null;
  onAddCard: (dayIndex: number, category: string | null) => void;
  onUpdateCard: (id: string, updates: Partial<DiaryCard>) => void;
  onDeleteCard: (id: string) => void;
  onDuplicateCard: (card: DiaryCard) => void;
}

const DroppableDay = ({
  droppableId,
  dayIndex,
  isToday,
  dayDate,
  dayCards,
  categoryKey,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
}: DroppableDayProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col p-1.5 transition-colors ${isOver ? "bg-primary/5" : ""} ${isToday ? "bg-primary/[0.03]" : ""}`}
    >
      <div className="flex-1 space-y-1.5">
        <SortableContext items={dayCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {dayCards.map((card) => (
            <DiaryCardItem
              key={card.id}
              card={card}
              onUpdate={onUpdateCard}
              onDelete={onDeleteCard}
              onDuplicate={onDuplicateCard}
            />
          ))}
        </SortableContext>
      </div>
      <button
        onClick={() => onAddCard(dayIndex, categoryKey)}
        className="w-full flex items-center justify-center py-1 rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50 transition-all mt-1"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
