import { useRef } from "react";
import { DiaryDayColumn } from "./DiaryDayColumn";
import { DiaryCard, addDays, formatDate, entriesForDay } from "@/lib/diary-utils";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DiaryMobileDayViewProps {
  weekStart: Date;
  cards: DiaryCard[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
  today: string;
  editingId: string | null;
  onAddLine: (dayIndex: number) => Promise<DiaryCard | null>;
  onRequestEdit: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<DiaryCard>) => void;
  onDelete: (id: string) => void;
  onOpen: (card: DiaryCard) => void;
  onToggleDone: (card: DiaryCard) => void;
}

export const DiaryMobileDayView = ({
  weekStart,
  cards,
  selectedDay,
  onSelectDay,
  today,
  ...rest
}: DiaryMobileDayViewProps) => {
  const touchStartX = useRef<number | null>(null);

  return (
    <div
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (dx < -50) onSelectDay(Math.min(6, selectedDay + 1));
        else if (dx > 50) onSelectDay(Math.max(0, selectedDay - 1));
        touchStartX.current = null;
      }}
    >
      {/* Day strip */}
      <div className="mb-4 grid grid-cols-7 gap-1">
        {DAY_NAMES.map((name, i) => {
          const date = addDays(weekStart, i);
          const isToday = formatDate(date) === today;
          const selected = i === selectedDay;
          return (
            <button
              key={name}
              onClick={() => onSelectDay(i)}
              className={`flex flex-col items-center rounded-lg py-1.5 text-xs transition-colors ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : isToday
                    ? "text-primary"
                    : "text-muted-foreground"
              }`}
            >
              <span className="font-medium">{name}</span>
              <span className="text-sm font-bold">{date.getDate()}</span>
            </button>
          );
        })}
      </div>

      <DiaryDayColumn
        dayIndex={selectedDay}
        weekStart={weekStart}
        today={today}
        entries={entriesForDay(cards, selectedDay)}
        lines={10}
        {...rest}
      />
    </div>
  );
};
