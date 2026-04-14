import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { DiaryCardItem } from "./DiaryCardItem";
import type { DiaryCard } from "./DiaryWeekView";

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
  const today = formatDate(new Date());

  return (
    <div className="grid grid-cols-[repeat(5,1fr)_0.5fr_0.5fr] border-b border-border/10">
      {Array.from({ length: 7 }, (_, dayIndex) => {
        const dayDate = addDays(weekStart, dayIndex);
        const dayStr = formatDate(dayDate);
        const isToday = dayStr === today;
        const isPast = dayStr < today;
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
            isPast={isPast}
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
  isPast: boolean;
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
  isPast,
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
      className={`flex flex-col px-2 py-1 transition-colors border-r border-border/10 last:border-r-0 min-h-[40px] ${
        isOver ? "bg-primary/5" : ""
      }`}
    >
      <div className="flex-1">
        <SortableContext items={dayCards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {dayCards.map((card) => (
            <DiaryCardItem
              key={card.id}
              card={card}
              onUpdate={onUpdateCard}
              onDelete={onDeleteCard}
              onDuplicate={onDuplicateCard}
              isPast={isPast}
            />
          ))}
        </SortableContext>
      </div>
      <button
        onClick={() => onAddCard(dayIndex, categoryKey)}
        className="w-full flex items-center justify-center py-0.5 rounded text-muted-foreground/20 hover:text-muted-foreground/60 transition-all mt-0.5"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
};
