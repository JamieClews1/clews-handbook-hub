import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import {
  DiaryCard,
  DiaryCategory,
  DIARY_COLOR_DOT,
  addDays,
  DiaryRepeat,
} from "@/lib/diary-utils";

interface DiaryEntryModalProps {
  card: DiaryCard | null;
  weekStart: Date;
  categories: DiaryCategory[];
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<DiaryCard>) => void;
  onDelete: (id: string) => void;
  onSetRepeat: (card: DiaryCard, repeat: DiaryRepeat | null) => void;
}

export const DiaryEntryModal = ({
  card,
  weekStart,
  categories,
  open,
  onClose,
  onUpdate,
  onDelete,
  onSetRepeat,
}: DiaryEntryModalProps) => {
  const [staff, setStaff] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("profiles")
      .select("full_name")
      .order("full_name")
      .then(({ data }) => {
        const names = [
          ...new Set(
            (data ?? []).map((p) => p.full_name).filter((n): n is string => !!n)
          ),
        ];
        setStaff(names);
      });
  }, [open]);

  if (!card) return null;

  const entryDate = addDays(weekStart, card.day_of_week);
  const dateLabel = entryDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
          <DialogTitle asChild>
            <input
              key={card.id}
              defaultValue={card.content}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== card.content) onUpdate(card.id, { content: v });
              }}
              placeholder="Entry title"
              className="text-xl font-bold bg-transparent outline-none w-full placeholder:text-muted-foreground/40"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              key={`${card.id}-notes`}
              defaultValue={card.notes ?? ""}
              rows={3}
              onBlur={(e) => {
                if (e.target.value !== (card.notes ?? ""))
                  onUpdate(card.id, { notes: e.target.value || null });
              }}
              placeholder="Add notes..."
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/50 resize-y"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const selected = (card.category ?? "general") === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() =>
                      onUpdate(card.id, { category: cat.key === "general" ? null : cat.key })
                    }
                    className={`flex items-center gap-1.5 rounded-full px-3 h-8 text-sm font-medium border transition-colors ${
                      selected
                        ? "border-foreground/60 bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        DIARY_COLOR_DOT[cat.color] ?? DIARY_COLOR_DOT.grey
                      }`}
                    />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Assignee</label>
              <Select
                value={card.assignee ?? "none"}
                onValueChange={(v) => onUpdate(card.id, { assignee: v === "none" ? null : v })}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {staff.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Repeat</label>
              <Select
                value={card.repeat ?? "none"}
                onValueChange={(v) =>
                  onSetRepeat(card, v === "none" ? null : (v as DiaryRepeat))
                }
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="Never" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Never</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Switch
                checked={!!card.done}
                onCheckedChange={(checked) => onUpdate(card.id, { done: checked })}
              />
              Done
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onDelete(card.id);
                onClose();
              }}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
