import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2 } from "lucide-react";

interface WasteType {
  id: string;
  waste_type: string;
  default_avg_weight_kg: number;
  pallet_weight_kg: number;
  display_order: number;
  is_active: boolean;
  isNew?: boolean;
}

interface SortableWasteTypeItemProps {
  wasteType: WasteType;
  onFieldChange: (id: string, field: keyof WasteType, value: number | string) => void;
  onDelete: (id: string) => void;
}

export const SortableWasteTypeItem = ({
  wasteType,
  onFieldChange,
  onDelete,
}: SortableWasteTypeItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: wasteType.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-muted/50 rounded-lg"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <Input
          value={wasteType.waste_type}
          onChange={(e) => onFieldChange(wasteType.id, "waste_type", e.target.value)}
          className="font-medium"
          placeholder="Waste type name"
        />
        {wasteType.isNew && (
          <span className="ml-2 text-xs text-primary">(new)</span>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Avg Weight (KG):
          </Label>
          <Input
            type="number"
            min="0"
            step="10"
            value={wasteType.default_avg_weight_kg}
            onChange={(e) =>
              onFieldChange(wasteType.id, "default_avg_weight_kg", Number(e.target.value))
            }
            className="w-24 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Pallet Deduct (KG):
          </Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={wasteType.pallet_weight_kg}
            onChange={(e) =>
              onFieldChange(wasteType.id, "pallet_weight_kg", Number(e.target.value))
            }
            className="w-24 h-9"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive hover:text-destructive"
          onClick={() => onDelete(wasteType.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
