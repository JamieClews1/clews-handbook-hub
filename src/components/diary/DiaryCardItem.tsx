import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2, Copy } from "lucide-react";
import type { DiaryCard } from "./DiaryWeekView";

const COLOR_OPTIONS = [
  { key: "default", class: "bg-card" },
  { key: "rose", class: "bg-rose-50 dark:bg-rose-950/30" },
  { key: "amber", class: "bg-amber-50 dark:bg-amber-950/30" },
  { key: "emerald", class: "bg-emerald-50 dark:bg-emerald-950/30" },
  { key: "sky", class: "bg-sky-50 dark:bg-sky-950/30" },
  { key: "violet", class: "bg-violet-50 dark:bg-violet-950/30" },
];

function getColorClass(color: string): string {
  return COLOR_OPTIONS.find((c) => c.key === color)?.class || "bg-card";
}

interface DiaryCardItemProps {
  card: DiaryCard;
  onUpdate: (id: string, updates: Partial<DiaryCard>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (card: DiaryCard) => void;
}

export const DiaryCardItem = ({ card, onUpdate, onDelete, onDuplicate }: DiaryCardItemProps) => {
  const [isEditing, setIsEditing] = useState(!card.content);
  const [showColors, setShowColors] = useState(false);
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
      // Move cursor to end
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
      className={`group relative rounded-lg border border-border/30 shadow-sm hover:shadow-md transition-all duration-200 ${getColorClass(card.color)} cursor-grab active:cursor-grabbing`}
      {...attributes}
      {...listeners}
    >
      {/* Action buttons — visible on hover */}
      <div className="absolute -top-2 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); setShowColors(!showColors); }}
          className="w-5 h-5 rounded-full bg-muted border border-border/50 shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: card.color !== "default" ? undefined : undefined }}
        >
          <span className="sr-only">Color</span>
          <span className="block w-3 h-3 mx-auto rounded-full bg-gradient-to-br from-rose-300 via-amber-300 to-sky-300" />
        </button>
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

      {/* Color picker dropdown */}
      {showColors && (
        <div className="absolute -top-8 right-0 flex gap-1 bg-card border border-border rounded-full px-2 py-1 shadow-lg z-20">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.key}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(card.id, { color: c.key });
                setShowColors(false);
              }}
              className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 ${c.class} ${
                card.color === c.key ? "ring-2 ring-primary ring-offset-1" : "border-border/50"
              }`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          defaultValue={card.content}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Write something..."
          className="w-full bg-transparent border-0 outline-none resize-none text-sm text-foreground p-3 min-h-[48px] placeholder:text-muted-foreground/40"
          rows={2}
        />
      ) : (
        <div
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          onPointerDown={(e) => {
            // Allow drag unless they click to edit
          }}
          className="p-3 text-sm text-foreground cursor-text min-h-[48px] whitespace-pre-wrap break-words"
        >
          {card.content || <span className="text-muted-foreground/40 italic">Empty</span>}
        </div>
      )}
    </div>
  );
};
