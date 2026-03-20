import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import type { DiaryCard } from "./DiaryWeekView";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const COLOR_OPTIONS = [
  { key: "default", class: "bg-card" },
  { key: "rose", class: "bg-rose-50 dark:bg-rose-950/30" },
  { key: "amber", class: "bg-amber-50 dark:bg-amber-950/30" },
  { key: "emerald", class: "bg-emerald-50 dark:bg-emerald-950/30" },
  { key: "sky", class: "bg-sky-50 dark:bg-sky-950/30" },
  { key: "violet", class: "bg-violet-50 dark:bg-violet-950/30" },
];

function getColorClass(color: string): string {
  return COLOR_OPTIONS.find((c) => c.key === color)?.class || "";
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

interface MobileCardProps {
  card: DiaryCard;
  onUpdate: (id: string, updates: Partial<DiaryCard>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (card: DiaryCard) => void;
}

const MobileCard = ({ card, onUpdate, onDelete, onDuplicate }: MobileCardProps) => {
  const [isEditing, setIsEditing] = useState(!card.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate(card.id, { content: value });
    }, 400);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onUpdate(card.id, { content: inputRef.current?.value || card.content });
    if (card.content || inputRef.current?.value) setIsEditing(false);
  };

  const colorClass = getColorClass(card.color);

  return (
    <div className={`group flex items-center gap-3 py-3 border-b border-border/30 last:border-b-0 ${colorClass} px-1 -mx-1 rounded`}>      
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            defaultValue={card.content}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="Write something..."
            className="w-full bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/40"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-left w-full text-sm text-foreground truncate"
          >
            {card.content || <span className="text-muted-foreground/40 italic">Empty</span>}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onDuplicate(card)}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={() => onDelete(card.id)}
          className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Completion circle (decorative, like the reference) */}
      <button className="shrink-0 w-7 h-7 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center hover:border-primary/50 transition-colors">
        <Check className="h-3.5 w-3.5 text-muted-foreground/30" />
      </button>
    </div>
  );
};

interface DiaryMobileListViewProps {
  weekStart: Date;
  cards: DiaryCard[];
  onAddCard: (dayIndex: number) => void;
  onUpdateCard: (id: string, updates: Partial<DiaryCard>) => void;
  onDeleteCard: (id: string) => void;
  onDuplicateCard: (card: DiaryCard) => void;
}

export const DiaryMobileListView = ({
  weekStart,
  cards,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
}: DiaryMobileListViewProps) => {
  return (
    <div className="space-y-6">
      {Array.from({ length: 7 }, (_, i) => {
        const dayDate = addDays(weekStart, i);
        const isToday = formatDate(dayDate) === formatDate(new Date());
        const dayCards = cards
          .filter((c) => c.day_of_week === i)
          .sort((a, b) => a.display_order - b.display_order);

        const dateLabel = dayDate.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        });

        return (
          <div key={i}>
            {/* Day header */}
            <div className="flex items-baseline justify-between mb-1">
              <h3 className={`text-lg font-bold tracking-tight ${isToday ? "text-primary" : "text-foreground"}`}>
                {dateLabel}
              </h3>
              <span className={`text-sm font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {DAY_NAMES[i]}
              </span>
            </div>
            <div className={`h-px w-full mb-2 ${isToday ? "bg-primary" : "bg-border"}`} />

            {/* Cards */}
            <div>
              {dayCards.map((card) => (
                <MobileCard
                  key={card.id}
                  card={card}
                  onUpdate={onUpdateCard}
                  onDelete={onDeleteCard}
                  onDuplicate={onDuplicateCard}
                />
              ))}
            </div>

            {/* Add button */}
            <button
              onClick={() => onAddCard(i)}
              className="flex items-center gap-2 py-2 text-muted-foreground/40 hover:text-muted-foreground text-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
