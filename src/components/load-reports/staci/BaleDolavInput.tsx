import { Input } from "@/components/ui/input";

interface BaleDolavInputProps {
  count: number;
  totalWeightKg: number;
  onCountChange: (count: number) => void;
  onTotalWeightChange: (totalWeight: number) => void;
  compact?: boolean;
}

export const BaleDolavInput = ({
  count,
  totalWeightKg,
  onCountChange,
  onTotalWeightChange,
  compact = false,
}: BaleDolavInputProps) => {
  const perUnit = count > 0 ? Math.round(totalWeightKg / count) : 0;

  const handleCountChange = (newCount: number) => {
    const safeCount = Math.max(0, newCount);
    onCountChange(safeCount);
    // Recalculate total using current per-unit weight
    if (safeCount > 0 && perUnit > 0) {
      onTotalWeightChange(perUnit * safeCount);
    }
  };

  const handlePerUnitChange = (newPerUnit: number) => {
    const safePerUnit = Math.max(0, newPerUnit);
    const effectiveCount = count > 0 ? count : 1;
    onTotalWeightChange(safePerUnit * effectiveCount);
  };

  const total = count > 0 ? perUnit * count : 0;
  const inputSize = compact ? "w-16 h-14 text-xl" : "w-20 h-14 text-2xl";
  const estKgSize = compact ? "w-16 h-14 text-xl" : "w-20 h-14 text-2xl";

  return (
    <div className="flex items-center gap-2">
      <div className="text-center">
        <Input
          type="number"
          min={0}
          value={count}
          onChange={(e) => handleCountChange(parseInt(e.target.value) || 0)}
          className={`${inputSize} text-center font-bold`}
        />
        <span className="text-xs text-muted-foreground">Qty</span>
      </div>
      <div className="text-center">
        <Input
          type="number"
          min={0}
          value={perUnit}
          onChange={(e) => handlePerUnitChange(parseFloat(e.target.value) || 0)}
          className={`${estKgSize} text-center font-bold`}
        />
        <span className="text-xs text-muted-foreground">Est KG</span>
      </div>
      {total > 0 && (
        <div className="text-center min-w-[60px]">
          <div className="text-lg font-bold text-foreground">{total.toLocaleString()}</div>
          <span className="text-xs text-muted-foreground">Total KG</span>
        </div>
      )}
    </div>
  );
};
