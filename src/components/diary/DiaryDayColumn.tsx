import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DiaryEntryLine } from "./DiaryEntryLine";
import { DiaryCard, addDays, formatDate } from "@/lib/diary-utils";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DiaryDayColumnProps {
  dayIndex: number;
  weekStart: Date;
  today: string;
  entries: DiaryCard[];
  lines?: number;
  editingId: string | null;
  onAddLine: (dayIndex: number) => Promise<DiaryCard | null>;
  onRequestEdit: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<DiaryCard>) => void;
  onDelete: (id: string) => void;
  onOpen: (card: DiaryCard) => void;
  onToggleDone: (card: DiaryCard) => void;
}

export const DiaryDayColumn = ({
  dayIndex,
  weekStart,
  today,
  entries,
  lines = 8,
  editingId,
  onAddLine,
  onRequestEdit,
  onUpdate,
  onDelete,
  onOpen,
  onToggleDone,
}: DiaryDayColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayIndex}` });
  const dayDate = addDays(weekStart, dayIndex);
  const isToday = formatDate(dayDate) === today;
  const dateLabel = dayDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const emptyLines = Math.max(lines - entries.length, 1);

  const addAndEdit = async () => {
    const card = await onAddLine(dayIndex);
    if (card) onRequestEdit(card.id);
  };

  return (
    <div
      ref={setNodeRef}
      className={`rounded transition-colors ${isOver ? "bg-primary/5" : ""}`}
      aria-current={isToday ? "date" : undefined}
    >
      <div
        className={`flex items-baseline justify-between pb-1 border-b-2 ${
          isToday ? "border-primary" : "border-foreground/70"
        }`}
      >
        <span className={`text-sm font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
          {dateLabel}
        </span>
        <span className={`text-xs ${isToday ? "text-primary" : "text-muted-foreground"}`}>
          {DAY_NAMES[dayIndex]}
        </span>
      </div>

      <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        {entries.map((card) => (
          <DiaryEntryLine
            key={card.id}
            card={card}
            editing={editingId === card.id}
            onRequestEdit={onRequestEdit}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onOpen={onOpen}
            onToggleDone={onToggleDone}
            onEnterNext={addAndEdit}
          />
        ))}
      </SortableContext>

      {Array.from({ length: emptyLines }).map((_, i) => (
        <button
          key={i}
          onClick={addAndEdit}
          aria-label={`Add entry on ${DAY_NAMES[dayIndex]} ${dateLabel}`}
          className="block w-full h-[42px] border-b border-border/40 hover:bg-muted/20 transition-colors"
        />
      ))}
    </div>
  );
};
