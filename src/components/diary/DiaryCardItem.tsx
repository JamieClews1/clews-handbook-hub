import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Copy } from "lucide-react";
import type { DiaryCard } from "./DiaryWeekView";

interface DiaryCardItemProps {
  card: DiaryCard;
  onUpdate: (id: string, updates: Partial<DiaryCard>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (card: DiaryCard) => void;
}

export const DiaryCardItem = ({ card, onUpdate, onDelete, onDuplicate }: DiaryCardItemProps) => {
  const [isEditing, setIsEditing] = useState(!card.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
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
    onUpdate(card.id, { content: textareaRef.current?.value || card.content });
    if (card.content || textareaRef.current?.value) {
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-md border border-border/20 bg-card/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {/* Action buttons */}
      <div className="absolute -top-2 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(card); }}
          className="w-5 h-5 rounded-full bg-muted border border-border/50 shadow-sm flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Copy className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          className="w-5 h-5 rounded-full bg-muted border border-border/50 shadow-sm flex items-center justify-center hover:scale-110 transition-transform hover:bg-destructive/10"
        >
          <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          defaultValue={card.content}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Write something..."
          className="w-full bg-transparent border-0 outline-none resize-none text-xs text-foreground p-2 min-h-[36px] placeholder:text-muted-foreground/40"
          rows={2}
        />
      ) : (
        <div
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          className="p-2 text-xs text-foreground cursor-text min-h-[36px] whitespace-pre-wrap break-words"
        >
          {card.content || <span className="text-muted-foreground/40 italic">Empty</span>}
        </div>
      )}
    </div>
  );
};
