import { useRef, useState } from "react";
import { Check, Loader2, MapPin, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { normaliseSiteSearchTerm, type SiteSearchHit } from "@/lib/site-postcode-finder";

interface Props {
  /** Is this result's site already in one of the form's Data Hub site boxes? */
  isLinked: (hit: SiteSearchHit) => boolean;
  onPick: (hit: SiteSearchHit) => void;
}

const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—");

/**
 * Search Skiptrak and weighbridge sites by postcode, address or name and link them to the site form.
 * Reads the maintained site search bank only; nothing is saved until staff press Save.
 */
export function SitePostcodeFinder({ isLinked, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<SiteSearchHit[] | null>(null);
  const request = useRef(0);

  const search = async () => {
    const term = normaliseSiteSearchTerm(query);
    if (term.replace(/\s/g, "").length < 3) { setError("Enter at least three characters."); return; }
    const id = ++request.current;
    setBusy(true); setError(null);
    try {
      const sources = ["skiptrak", "midweigh"] as const;
      const results = await Promise.all(sources.map(async (source) => {
        const { data, error } = await supabase.rpc("search_site_history_ranked", { p_term: term, p_source: source });
        if (error) throw error;
        return (data ?? []).map((r) => ({ ...r, source }) as SiteSearchHit);
      }));
      if (id !== request.current) return;
      setHits(results.flat().filter((h) => h.site).sort((a, b) => (b.last_date ?? "").localeCompare(a.last_date ?? "")).slice(0, 60));
    } catch {
      if (id === request.current) setError("Site search could not be completed. Please try again.");
    } finally {
      if (id === request.current) setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 grid gap-3">
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Find site by postcode</h4>
        <p className="text-xs text-muted-foreground">
          Search jobs and weighbridge tickets by postcode, address or name. Adding a result links it below and fills any empty address boxes.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void search(); }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Postcode, address or site name"
            placeholder="e.g. CV21 1HA"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {hits && !busy && hits.length === 0 && <p className="text-sm text-muted-foreground">No sites found for that search.</p>}
      {hits && hits.length > 0 && (
        <ul className="max-h-72 overflow-y-auto divide-y divide-border rounded-md border border-border bg-background">
          {hits.map((h) => {
            const linked = isLinked(h);
            const address = [h.address, h.address2, h.address3].filter(Boolean).join(", ");
            return (
              <li key={`${h.source}|${h.customer}|${h.site}|${h.postcode}`} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium truncate">{h.site}</span>
                    <Badge variant="outline">{h.source === "skiptrak" ? "Skip" : "Weighbridge"}</Badge>
                    {h.postcode && <span className="text-sm tabular-nums">{h.postcode}</span>}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {[h.customer, address].filter(Boolean).join(" · ") || "No address recorded"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Number(h.job_count ?? 0)} job{Number(h.job_count ?? 0) === 1 ? "" : "s"} · last {fmtDate(h.last_date)}
                  </div>
                </div>
                <Button type="button" size="sm" variant={linked ? "ghost" : "outline"} disabled={linked} onClick={() => onPick(h)}>
                  {linked ? <><Check className="h-4 w-4" /> Linked</> : <><Plus className="h-4 w-4" /> Add</>}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
