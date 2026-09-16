import { Badge } from "@/components/ui/badge";
import { FileCheck } from "lucide-react";
import { permitDisplayState, type PermitApplication } from "@/lib/permits";

/** Small permit state badge used on RouteOne kanban cards and list rows. */
export function PermitBadge({
  permit,
  chaseLeadHours = 72,
  onClick,
  className = "",
}: {
  permit: Pick<PermitApplication, "status" | "expiry_date"> | null | undefined;
  chaseLeadHours?: number;
  onClick?: () => void;
  className?: string;
}) {
  if (!permit) return null;
  const state = permitDisplayState(permit, chaseLeadHours);
  return (
    <Badge
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      className={`text-[10px] px-1.5 py-0 h-4 border-0 font-medium ${state.className} ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <FileCheck className="h-2.5 w-2.5 mr-0.5" />
      {state.label}
    </Badge>
  );
}
