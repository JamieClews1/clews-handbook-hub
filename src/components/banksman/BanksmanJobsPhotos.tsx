import { useCallback, useEffect, useState } from "react";
import { driverAction } from "@/lib/driver-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Camera, ImageOff, Loader2, Search, Truck, Weight, X } from "lucide-react";

interface Job {
  id: string;
  job_number: string;
  source: string | null;
  customer: string | null;
  site: string | null;
  driver: string | null;
  vehicle_registration: string | null;
  container_type: string | null;
  waste_description: string | null;
  weight_t: number | null;
  job_date: string | null;
}
interface Photo { id: string; url: string; label: string }

export default function BanksmanJobsPhotos({ staffId }: { staffId: string }) {
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [zoom, setZoom] = useState<Photo | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const { jobs } = await driverAction("yard_job_search", { staff_id: staffId, query: q });
      setJobs(jobs ?? []);
    } catch (e) {
      setError((e as Error).message || "Could not load jobs");
    }
    setLoading(false);
  }, [staffId]);

  useEffect(() => { search(""); }, [search]);

  const open = async (job: Job) => {
    setSelected(job);
    setPhotos([]);
    setPhotosLoading(true);
    try {
      const { photos } = await driverAction("yard_job_photos", { staff_id: staffId, job_number: job.job_number });
      setPhotos(photos ?? []);
    } catch { /* show empty */ }
    setPhotosLoading(false);
  };

  if (selected) {
    return (
      <div className="p-4 space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelected(null)}>
          <ArrowLeft className="w-4 h-4" /> Back to jobs
        </Button>
        <div className="bg-card border border-border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-foreground">Job #{selected.job_number}</p>
            {selected.source && <Badge variant="outline" className="capitalize">{selected.source}</Badge>}
          </div>
          <p className="text-foreground">{selected.customer || "Unknown customer"}</p>
          {selected.site && <p className="text-sm text-muted-foreground">{selected.site}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm pt-2 text-foreground">
            {selected.job_date && <span>{selected.job_date}</span>}
            {selected.vehicle_registration && <span className="inline-flex items-center gap-1"><Truck className="w-4 h-4 text-muted-foreground" />{selected.vehicle_registration}</span>}
            {selected.weight_t != null && <span className="inline-flex items-center gap-1"><Weight className="w-4 h-4 text-muted-foreground" />{selected.weight_t} t</span>}
            {selected.container_type && <span>{selected.container_type}</span>}
            {selected.driver && <span>Driver: {selected.driver}</span>}
          </div>
          {selected.waste_description && <p className="text-xs text-muted-foreground pt-1">{selected.waste_description}</p>}
        </div>

        <h2 className="font-semibold text-foreground flex items-center gap-2"><Camera className="w-4 h-4" /> Photos</h2>
        {photosLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <ImageOff className="w-9 h-9 mb-2 opacity-50" />
            <p>No photos for this job yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((p) => (
              <button key={p.id} onClick={() => setZoom(p)} className="text-left">
                <img src={p.url} alt={p.label} loading="lazy" className="w-full aspect-square object-cover rounded-lg border border-border" />
                <p className="text-xs text-muted-foreground mt-1 truncate">{p.label}</p>
              </button>
            ))}
          </div>
        )}

        {zoom && (
          <div className="fixed inset-0 z-50 bg-background/95 flex flex-col" onClick={() => setZoom(null)}>
            <div className="flex justify-between items-center p-3">
              <span className="text-sm text-foreground">{zoom.label}</span>
              <Button variant="ghost" size="icon"><X className="w-6 h-6" /></Button>
            </div>
            <img src={zoom.url} alt={zoom.label} className="flex-1 object-contain min-h-0 p-2" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); search(query); }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Job number, reg or customer" className="pl-9 h-11" />
        </div>
        <Button type="submit" className="h-11">Search</Button>
      </form>
      <p className="text-xs text-muted-foreground">{query.trim() ? "Search results" : "Jobs from today and yesterday"}</p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <p className="text-destructive text-sm text-center py-8">{error}</p>
      ) : jobs.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">No jobs found</p>
      ) : (
        jobs.map((j) => (
          <button key={j.id} onClick={() => open(j)} className="w-full text-left bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between gap-3">
              <p className="font-bold text-foreground truncate">#{j.job_number} · {j.customer || "Unknown"}</p>
              {j.source && <Badge variant="outline" className="capitalize shrink-0">{j.source}</Badge>}
            </div>
            {j.site && <p className="text-sm text-muted-foreground truncate">{j.site}</p>}
            <div className="flex flex-wrap gap-x-4 text-sm mt-1 text-foreground">
              {j.job_date && <span>{j.job_date}</span>}
              {j.vehicle_registration && <span>{j.vehicle_registration}</span>}
              {j.weight_t != null && <span>{j.weight_t} t</span>}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
