import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DiaryWeekNavProps {
  weekLabel: string;
  isCurrentWeek: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export const DiaryWeekNav = ({ weekLabel, isCurrentWeek, onPrev, onNext, onToday }: DiaryWeekNavProps) => {
  return (
    <div className="flex items-center gap-3">
      {!isCurrentWeek && (
        <Button variant="outline" size="sm" onClick={onToday} className="text-xs rounded-full px-3 h-7">
          Today
        </Button>
      )}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onPrev} className="h-7 w-7 rounded-full">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNext} className="h-7 w-7 rounded-full">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <span className="text-sm font-medium text-muted-foreground">{weekLabel}</span>
    </div>
  );
};
