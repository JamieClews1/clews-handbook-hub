import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  before: "Before",
  after: "After",
  contamination: "Contamination",
  third_party_ticket: "Third Party Ticket",
};

const prettify = (key: string) =>
  TYPE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Shows the photos a driver captured against a Route One job, grouped by type. */
export function JobPhotosSection({ jobId }: { jobId?: string | null }) {
  const { data: photos = [] } = useQuery({
    queryKey: ["route-one-job-photos", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_one_job_photos")
        .select("id, photo_type, file_path, file_name, created_at")
        .eq("job_id", jobId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!jobId || photos.length === 0) return null;

  const groups = photos.reduce<Record<string, typeof photos>>((acc, p) => {
    const key = p.photo_type || "photo";
    (acc[key] ||= []).push(p);
    return acc;
  }, {});

  const urlFor = (path: string) =>
    supabase.storage.from("route-one-photos").getPublicUrl(path).data.publicUrl;

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5" /> Driver Photos
      </p>
      {Object.entries(groups).map(([type, items]) => (
        <div key={type} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{prettify(type)}</span>
            <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map((p) => (
              <a key={p.id} href={urlFor(p.file_path)} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <img
                  src={urlFor(p.file_path)}
                  alt={p.file_name || prettify(type)}
                  className="h-20 w-20 rounded-lg border object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
