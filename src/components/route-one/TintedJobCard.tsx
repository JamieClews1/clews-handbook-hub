import type { ReactNode, DragEvent } from "react";
import { boardJobType, boardUnconfirmed } from "@/lib/route-board-presentation";
import { bookingContainerLabel } from "@/lib/container-taxonomy";

export function TintedJobCard({ job, type, label, imported = false, onClick, onDragStart, onDragEnd, isDragging, actions, permit }: {
  job: any; type: string; label: string; imported?: boolean;
  onClick?: () => void; onDragStart?: (e: DragEvent) => void; onDragEnd?: (e: DragEvent) => void;
  isDragging?: boolean; actions?: ReactNode; permit?: ReactNode;
}) {
  const presentation = boardJobType(type, label);
  const postcode = imported ? job.postcode : job.site_postcode;
  const site = imported ? job.site : job.site_area || job.site_name;
  const destination = String(imported ? job.tipping_location || "" : job.destination_name || job.disposal_site || "")
    .replace(/Clews Recycling(?:\s+Ltd)?/gi, "Clews");
  const container = imported ? job.container_type : bookingContainerLabel(job.container_type, job.container_size);
  const unconfirmed = boardUnconfirmed(job);
  const time = job.time_window || (job.time_from && job.time_to ? `${job.time_from}–${job.time_to}` : "");
  return <div role="button" tabIndex={0} draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
    onClick={onClick} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick?.(); } }}
    aria-label={`Open job ${job.job_number || ""} — ${imported ? job.customer : job.customer_name}`}
    data-job-palette={presentation.palette} data-unconfirmed={unconfirmed} data-dragging={Boolean(isDragging)}
    className="routeone-tinted-job group">
    <div className="flex items-center justify-between gap-1 min-w-0">
      <span className="routeone-job-tag">{presentation.label}</span>
      <div className="flex items-center gap-1 min-w-0">{time && <span className="routeone-job-accent text-[11px] whitespace-nowrap">{time}</span>}{actions}</div>
    </div>
    <div className="routeone-job-customer text-sm font-semibold leading-snug line-clamp-2 break-words">{(imported ? job.customer : job.customer_name) || "Unknown"}</div>
    {(postcode || site) && <div className="routeone-job-detail text-xs leading-snug break-words">{[postcode, site].filter(Boolean).join(" · ")}</div>}
    {(container || destination) && <div className="routeone-job-detail text-[11px] leading-snug break-words">{container}{destination && <> {container && " · "}→ {destination}</>}</div>}
    <div className="routeone-job-divider" />
    <div className="routeone-job-accent text-[11px] leading-snug flex flex-wrap items-center gap-x-1">
      <span>#{job.job_number || "—"} · {imported ? "Skiptrak" : "RouteOne"}{unconfirmed ? " · Unconfirmed" : ""}</span>
      {!imported && <span>· {job.is_live ? "Sent" : "Draft"}{["completed", "in_progress", "query"].includes(job.status) ? ` · ${job.status === "completed" ? "Done" : job.status === "query" ? "Query" : "In progress"}` : ""}</span>}
      {permit}
    </div>
  </div>;
}