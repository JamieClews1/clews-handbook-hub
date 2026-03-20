import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { DiaryCardItem } from "./DiaryCardItem";
import type { DiaryCard } from "./DiaryWeekView";

interface DiaryDayColumnProps {
  dayIndex: number;
  dayName: string;
  dayShort: string;
  dayDate: Date;
  isToday: boolean;
  cards: DiaryCard[];
  onAddCard: () => void;
  onUpdateCard: (id: string, updates: Partial<DiaryCard>) => void;
  onDeleteCard: (id: string) => void;
  onDuplicateCard: (card: DiaryCard) => void;
}

export const DiaryDayColumn = ({
  dayIndex,
  dayName,
  dayShort,
  dayDate,
  isToday,
  cards,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
}: DiaryDayColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayIndex}` });
  const dateStr = dayDate.getDate().toString();

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl transition-colors duration-200 min-h-[320px] ${
        isOver ? "bg-primary/5" : "bg-muted/30"
      }`}
    >
      {/* Day header */}
      <div className="px-3 pt-3 pb-2 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:block">
          {dayName}
        </p>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider lg:hidden">
          {dayShort}
        </p>
        <div
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full mt-1 text-sm font-semibold transition-colors ${
            isToday
              ? "bg-primary text-primary-foreground"
              : "text-foreground"
          }`}
        >
          {dateStr}
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 px-2 pb-2 space-y-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <DiaryCardItem
              key={card.id}
              card={card}
              onUpdate={onUpdateCard}
              onDelete={onDeleteCard}
              onDuplicate={onDuplicateCard}
            />
          ))}
        </SortableContext>

        {/* Add card button */}
        <button
          onClick={onAddCard}
          className="w-full flex items-center justify-center py-2 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 transition-all duration-200 group"
        >
          <Plus className="h-4 w-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
};
