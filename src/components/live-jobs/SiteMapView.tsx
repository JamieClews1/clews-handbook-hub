import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { History, Loader2, MapPin, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { fetchAllRows } from "@/lib/fetch-all";
import { HISTORY_FIELDS, type HistoryJob } from "@/lib/site-history";
import { filterSiteMapEntries, siteMapEntries, siteMapPostcodes, type SiteMapEntry } from "@/lib/site-map";
import { normalisePostcode } from "@/hooks/usePostcodeCoords";
import { useSiteCoords } from "@/hooks/useSiteCoords";
import { londonCalendarKey } from "@/lib/ui-calendar";
import type { StandingBinRule } from "@/lib/standing-bins";
import type { LiveJobsSettings } from "@/hooks/useLiveJobsSettings";

// Live Jobs site map: one pin per site that has containers on it, using exactly
// the on-site estimate the dashboard shows. Search narrows the pins; a pin opens
// the site's details and a link into its full history.

const MOVEMENTS = ["Deliver", "Exchange", "Collect", "Tip/Return"];
const LIST_LIMIT = 60;

const pinIcon = (count: number, active: boolean): google.maps.Icon => {
  const fill = active ? "#0B3D24" : "#157F4B";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
    <path d="M20 1C10.6 1 3 8.6 3 18c0 12 17 28 17 28s17-16 17-28C37 8.6 29.4 1 20 1z" fill="${fill}" stroke="#fff" stroke-width="2"/>
    <text x="20" y="23" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#fff">${count}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(40, 48),
    anchor: new google.maps.Point(20, 46),
  };
};

interface Props {
  settings: LiveJobsSettings;
  onOpenHistory: (site: { key: string; site: string; customer: string | null; postcode: string; address: string }) => void;
}

export default function SiteMapView({ settings, onOpenHistory }: Props) {
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [rules, setRules] = useState<StandingBinRule[]>([]);
  const [ownKeys, setOwnKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapsRef = useRef<typeof google.maps | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const fittedRef = useRef(false);

  const today = londonCalendarKey();
  const since = useMemo(() => format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd"), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, standing, own] = await Promise.all([
          fetchAllRows<HistoryJob>("data_hub_jobs", HISTORY_FIELDS, "id", q =>
            q.eq("source", "skiptrak").in("movement_type", MOVEMENTS).gte("job_date", since),
          ),
          supabase
            .from("site_standing_bins")
            .select("id,customer,site,container_type,ewc,bin_count,active,notes")
            .eq("active", true),
          supabase.from("rental_chases").select("bin_key").eq("own_skip", true),
        ]);
        if (cancelled) return;
        if (standing.error || own.error) throw new Error("Site details could not be loaded");
        setJobs(rows);
        setRules((standing.data ?? []) as StandingBinRule[]);
        setOwnKeys(new Set((own.data ?? []).map((r: { bin_key: string }) => r.bin_key)));
      } catch (cause) {
        console.error(cause);
        if (!cancelled) setError("Sites could not be loaded in full. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [since]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(maps => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: 52.33, lng: -1.35 },
          zoom: 9,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
        });
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError("The map could not be loaded. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(
    () => siteMapEntries(jobs, rules, settings, since, today),
    [jobs, rules, settings, since, today],
  );

  const visible = useMemo(() => {
    const found = filterSiteMapEntries(entries, term);
    return showEmpty ? found : found.filter(e => e.total > 0);
  }, [entries, term, showEmpty]);

  const postcodes = useMemo(() => siteMapPostcodes(visible), [visible]);
  const { coords, loading: coordsLoading, error: coordsError, unresolvedCount, locateMore } =
    useSiteCoords(postcodes, mapReady);

  const selected = useMemo(
    () => visible.find(e => e.key === selectedKey) ?? entries.find(e => e.key === selectedKey) ?? null,
    [visible, entries, selectedKey],
  );

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    const markers = markersRef.current;
    const keep = new Set<string>();

    for (const entry of visible) {
      const coord = entry.postcode ? coords.get(normalisePostcode(entry.postcode)) : undefined;
      if (!coord) continue;
      keep.add(entry.key);
      const active = entry.key === selectedKey;
      const existing = markers.get(entry.key);
      if (existing) {
        existing.setPosition(coord);
        existing.setIcon(pinIcon(entry.total, active));
        continue;
      }
      const marker = new maps.Marker({
        map,
        position: coord,
        icon: pinIcon(entry.total, active),
        title: `${entry.site} — ${entry.total} container${entry.total === 1 ? "" : "s"}`,
      });
      marker.addListener("click", () => {
        setSelectedKey(entry.key);
        map.panTo(coord);
      });
      markers.set(entry.key, marker);
    }

    for (const [key, marker] of markers) {
      if (!keep.has(key)) {
        marker.setMap(null);
        markers.delete(key);
      }
    }

    if (!fittedRef.current && keep.size > 1) {
      const bounds = new maps.LatLngBounds();
      for (const entry of visible) {
        const coord = entry.postcode ? coords.get(normalisePostcode(entry.postcode)) : undefined;
        if (coord) bounds.extend(coord);
      }
      map.fitBounds(bounds, 40);
      fittedRef.current = true;
    }
  }, [visible, coords, selectedKey, mapReady]);

  const plottable = visible.filter(e => e.postcode).length;
  const located = visible.filter(e => e.postcode && coords.has(normalisePostcode(e.postcode))).length;

  if (loading) {
    return (
      <div role="status" className="flex items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading sites…
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-label="Site map">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56 max-w-xl">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search sites by company, site, postcode or address"
            placeholder="Company, site, postcode or address"
            value={term}
            onChange={e => setTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant={showEmpty ? "default" : "outline"} onClick={() => setShowEmpty(v => !v)}>
          {showEmpty ? "Showing all sites" : "Show sites with nothing on site"}
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {visible.length} site{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 text-destructive">
          <span>{error}</span>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      )}
      {mapError && (
        <div role="alert" className="flex items-center gap-3 text-destructive">
          <span>{mapError}</span>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="relative">
          <div
            ref={containerRef}
            aria-label="Map of sites"
            className="h-[70vh] min-h-[520px] rounded-lg border border-border bg-muted/40"
          />
          {(coordsLoading || unresolvedCount > 0) && (
            <div className="absolute left-3 bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card/95 px-3 py-2 text-sm shadow-sm">
              {coordsLoading ? (
                <span role="status" className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Locating sites… {located}/{plottable}
                </span>
              ) : (
                <span>
                  {located}/{plottable} sites placed
                  {unresolvedCount > 0 ? ` · ${unresolvedCount} postcode${unresolvedCount === 1 ? "" : "s"} not looked up yet` : ""}
                </span>
              )}
              {!coordsLoading && unresolvedCount > 0 && (
                <Button size="sm" variant="outline" onClick={locateMore}>
                  Locate {Math.min(unresolvedCount, 100)} more
                </Button>
              )}
            </div>
          )}
        </div>

        <aside className="border border-border rounded-lg bg-card overflow-hidden flex flex-col min-h-[520px] max-h-[70vh]">
          {selected ? (
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold break-words">{selected.site}</h3>
                  <p className="text-sm text-muted-foreground">{selected.customers.join(" / ") || "Company not recorded"}</p>
                  <p className="text-sm text-muted-foreground break-words">
                    {[selected.address, selected.postcode].filter(Boolean).join(", ") || "Address not recorded"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Close site details" onClick={() => setSelectedKey(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-baseline gap-2 border-y border-border py-3">
                <span className="text-2xl font-semibold tabular-nums">{selected.total}</span>
                <span className="text-sm text-muted-foreground">container{selected.total === 1 ? "" : "s"} on site now</span>
              </div>

              {selected.containers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing currently identified on site.</p>
              ) : (
                <ul className="space-y-2">
                  {selected.containers.map(c => {
                    const own = selected.names.some(
                      n => ownKeys.has(`${n.toLowerCase().trim()}|||${c.container.toLowerCase().trim()}`),
                    );
                    return (
                      <li key={c.container} className="border border-border rounded-md p-3">
                        <div className="flex justify-between gap-2 items-center">
                          <span className="font-medium">
                            {c.count} × {c.container}
                          </span>
                          <Badge variant="outline">{own ? "Own" : "Clews"}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{c.wastes.join(" / ") || "Waste type not recorded"}</p>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Button
                className="w-full"
                onClick={() =>
                  onOpenHistory({
                    key: selected.key,
                    site: selected.site,
                    customer: selected.customers[0] ?? null,
                    postcode: selected.postcode,
                    address: selected.address,
                  })
                }
              >
                <History className="mr-2 h-4 w-4" /> View full history
              </Button>
            </div>
          ) : (
            <div className="overflow-y-auto">
              <p className="px-4 py-3 text-sm text-muted-foreground border-b border-border">
                Pick a pin or a site below to see what is on site.
              </p>
              <ul className="divide-y divide-border">
                {visible.slice(0, LIST_LIMIT).map(entry => (
                  <li key={entry.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKey(entry.key);
                        const coord = entry.postcode ? coords.get(normalisePostcode(entry.postcode)) : undefined;
                        if (coord) mapRef.current?.panTo(coord);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-muted/60 flex items-center gap-3"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">{entry.site}</span>
                        <span className="block text-sm text-muted-foreground truncate">
                          {entry.customers.join(" / ") || "Company not recorded"} · {entry.postcode || "No postcode"}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{entry.total}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {visible.length > LIST_LIMIT && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Showing the first {LIST_LIMIT} — narrow the search to see more.
                </p>
              )}
              {visible.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">No sites match this search.</p>
              )}
            </div>
          )}
        </aside>
      </div>
      <p className="text-xs text-muted-foreground">
        The number on each pin is the estimated containers on site, the same figure Live Jobs shows. Sites with no
        postcode recorded cannot be placed yet.
      </p>
    </section>
  );
}
