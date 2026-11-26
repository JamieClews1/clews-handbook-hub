import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export const WALK_AROUND_BUCKET = "walk-around-photos";

export function useSignedPhoto(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    supabase.storage.from(WALK_AROUND_BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

export function PhotoThumb({ path, className = "h-20 w-20" }: { path: string | null | undefined; className?: string }) {
  const url = useSignedPhoto(path);
  if (!path) return null;
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
      <img src={url} alt="Inspection photo" className={`${className} rounded-md border object-cover`} />
    </a>
  ) : (
    <div className={`${className} animate-pulse rounded-md border bg-muted`} />
  );
}

/** Phone-friendly photo capture: opens the camera on mobile, uploads to private storage. */
export function WalkAroundPhoto({ folder, path, onChange, disabled, label = "Add photo" }: {
  folder: string;
  path: string | null | undefined;
  onChange: (path: string | null) => void;
  disabled?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(WALK_AROUND_BUCKET).upload(key, file, { contentType: file.type || "image/jpeg" });
    setBusy(false);
    if (error) { toast.error(`Photo upload failed: ${error.message}`); return; }
    onChange(key);
  };

  return (
    <div className="flex items-center gap-3">
      <PhotoThumb path={path} />
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }}
      />
      {!disabled && (
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
            {path ? "Retake" : label}
          </Button>
          {path && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="mr-1.5 h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Several photos for one line: thumbnails with remove buttons plus an "Add photo" button (multiple files allowed). */
export function WalkAroundPhotos({ folder, paths, onChange, disabled }: {
  folder: string;
  paths: string[];
  onChange: (paths: string[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (files: File[]) => {
    setBusy(true);
    const added: string[] = [];
    for (const file of files) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(WALK_AROUND_BUCKET).upload(key, file, { contentType: file.type || "image/jpeg" });
      if (error) toast.error(`Photo upload failed: ${error.message}`);
      else added.push(key);
    }
    setBusy(false);
    if (added.length) onChange([...paths, ...added]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {paths.map(p => (
        <div key={p} className="relative">
          <PhotoThumb path={p} />
          {!disabled && (
            <button type="button" aria-label="Remove photo" onClick={() => onChange(paths.filter(x => x !== p))}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-foreground shadow">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <input ref={input} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) upload(f); }} />
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Camera className="mr-1.5 h-4 w-4" />}
          {paths.length ? "Add another photo" : "Add photos"}
        </Button>
      )}
    </div>
  );
}
