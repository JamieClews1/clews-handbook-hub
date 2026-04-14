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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-base font-bold text-foreground min-w-[200px] text-center">
          {weekLabel}
        </span>
        <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {!isCurrentWeek && (
        <Button variant="outline" size="sm" onClick={onToday} className="text-xs">
          This week
        </Button>
      )}
    </div>
  );
};
