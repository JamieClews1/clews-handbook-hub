import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check } from "lucide-react";
import { DiaryCard, CATEGORY_DOT_CLASS, categoryKeyOf } from "@/lib/diary-utils";

interface DiaryEntryLineProps {
  card: DiaryCard;
  editing: boolean;
  onRequestEdit: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<DiaryCard>) => void;
  onDelete: (id: string) => void;
  onOpen: (card: DiaryCard) => void;
  onToggleDone: (card: DiaryCard) => void;
  onEnterNext: () => void;
}

export const DiaryEntryLine = ({
  card,
  editing,
  onRequestEdit,
  onUpdate,
  onDelete,
  onOpen,
  onToggleDone,
  onEnterNext,
}: DiaryEntryLineProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  const [value, setValue] = useState(card.content);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setValue(card.content);
      inputRef.current?.focus();
    }
  }, [editing, card.content]);

  const commit = () => {
    const v = value.trim();
    if (!v) onDelete(card.id);
    else if (v !== card.content) onUpdate(card.id, { content: v });
    onRequestEdit(null);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="group flex items-center gap-2 h-[42px] border-b border-border/40"
      {...attributes}
      {...listeners}
    >
      <span
        className={`h-2 w-2 rounded-full shrink-0 ${CATEGORY_DOT_CLASS[categoryKeyOf(card)]}`}
      />
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              onEnterNext();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              if (!card.content) onDelete(card.id);
              onRequestEdit(null);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Write something..."
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-foreground placeholder:text-muted-foreground/40"
        />
      ) : (
        <button
          onClick={() => onOpen(card)}
          onDoubleClick={() => onRequestEdit(card.id)}
          className={`flex-1 min-w-0 text-left truncate text-[14px] ${
            card.done ? "line-through text-muted-foreground/60" : "text-foreground"
          }`}
        >
          {card.content}
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone(card);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={card.done ? "Mark as not done" : "Mark as done"}
        className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
          card.done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 text-transparent opacity-0 group-hover:opacity-100 hover:border-primary"
        }`}
      >
        <Check className="h-3 w-3" />
      </button>
    </div>
  );
};
