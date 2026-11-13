import { cn } from "@/lib/utils";
import { tabCountLabel } from "@/lib/inbox-counts";

/**
 * Small count pill shown on a tab label (Inbox, Orders portal).
 * Renders nothing when there is nothing to report.
 */
export function TabCountBadge({
  count,
  title,
  className,
}: {
  count: number;
  title?: string;
  className?: string;
}) {
  const label = tabCountLabel(count);
  if (!label) return null;
  return (
    <span
      title={title}
      className={cn(
        "ml-0.5 min-w-[18px] rounded-full bg-primary px-1.5 text-center text-[10px] font-semibold leading-4 text-primary-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
