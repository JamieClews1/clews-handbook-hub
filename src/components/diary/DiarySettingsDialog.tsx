import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import {
  DiaryCategory,
  DIARY_COLOR_DOT,
  DIARY_COLOR_NAMES,
} from "@/lib/diary-utils";

interface DiarySettingsDialogProps {
  open: boolean;
  onClose: () => void;
  categories: DiaryCategory[];
  onAdd: (label: string, color: string) => void;
  onUpdate: (key: string, updates: Partial<DiaryCategory>) => void;
  onDelete: (key: string) => void;
}

export const DiarySettingsDialog = ({
  open,
  onClose,
  categories,
  onAdd,
  onUpdate,
  onDelete,
}: DiarySettingsDialogProps) => {
  const cycleColor = (cat: DiaryCategory) => {
    const idx = DIARY_COLOR_NAMES.indexOf(cat.color);
    const next = DIARY_COLOR_NAMES[(idx + 1) % DIARY_COLOR_NAMES.length];
    onUpdate(cat.key, { color: next });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Diary settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">Categories</p>
          {categories.map((cat) => (
            <div key={cat.key} className="flex items-center gap-2.5 py-1">
              <button
                onClick={() => cycleColor(cat)}
                title="Click to change colour"
                aria-label={`Change colour for ${cat.label}`}
                className={`h-5 w-5 rounded-full shrink-0 ring-offset-2 hover:ring-2 ring-foreground/30 transition-shadow ${
                  DIARY_COLOR_DOT[cat.color] ?? DIARY_COLOR_DOT.grey
                }`}
              />
              <input
                key={`${cat.key}-${cat.label}`}
                defaultValue={cat.label}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== cat.label) onUpdate(cat.key, { label: v });
                }}
                className="flex-1 min-w-0 bg-transparent border-b border-transparent focus:border-primary/50 outline-none text-sm text-foreground py-1"
              />
              {cat.key !== "general" && (
                <button
                  onClick={() => onDelete(cat.key)}
                  aria-label={`Delete ${cat.label}`}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAdd("New category", "grey")}
            className="mt-2 text-muted-foreground"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add category
          </Button>

          <p className="text-xs text-muted-foreground/70 pt-3">
            Click a dot to change its colour. Deleting a category moves its entries to
            General.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
