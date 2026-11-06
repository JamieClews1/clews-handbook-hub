import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FunctionsHttpError, supabase } from "@/integrations/supabase/client";
import { normalisePostcode } from "@/hooks/usePostcodeCoords";

// Resolves site postcodes to map coordinates. Coordinates already cached in the
// database are read back for free; anything missing is looked up in bounded,
// sequential batches so one page load can never fan out into an unbounded
// billable request. `locateMore` lets staff top up the rest deliberately.

export type SiteCoord = { lat: number; lng: number; label: string | null };

// null = looked up already, no coordinates available (bad or unfindable postcode).
const geoCache = new Map<string, SiteCoord | null>();

const BATCH_SIZE = 25;
const AUTO_LOCATE = 100;

const normaliseList = (postcodes: string[]) =>
  [...new Set(postcodes.map(normalisePostcode).filter(pc => pc.length >= 5))].sort();

async function readCached(postcodes: string[]) {
  for (let from = 0; from < postcodes.length; from += 500) {
    const chunk = postcodes.slice(from, from + 500);
    const { data, error } = await supabase
      .from("site_geocodes")
      .select("postcode,latitude,longitude,label,status")
      .in("postcode", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const lat = row.latitude;
      const lng = row.longitude;
      geoCache.set(
        row.postcode,
        typeof lat === "number" && typeof lng === "number"
          ? { lat, lng, label: row.label ?? null }
          : null,
      );
    }
  }
}

async function requestMissing(postcodes: string[]) {
  for (let from = 0; from < postcodes.length; from += BATCH_SIZE) {
    const batch = postcodes.slice(from, from + BATCH_SIZE);
    const { data, error } = await supabase.functions.invoke("geocode-sites", {
      body: { postcodes: batch },
    });
    if (error) {
      const details =
        error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      throw new Error(details || "Site locations could not be loaded");
    }
    const coords = (data?.coords ?? {}) as Record<string, { lat: number; lng: number; label: string | null }>;
    for (const pc of batch) {
      geoCache.set(pc, coords[pc] ? { lat: coords[pc].lat, lng: coords[pc].lng, label: coords[pc].label ?? null } : null);
    }
  }
}

export function useSiteCoords(postcodes: string[], enabled = true) {
  const key = useMemo(() => normaliseList(postcodes).join("|"), [postcodes]);
  const wanted = useMemo(() => (key ? key.split("|") : []), [key]);

  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const wantedRef = useRef<string[]>([]);
  wantedRef.current = wanted;

  const resolve = useCallback(async (list: string[]) => {
    try {
      await readCached(list);
      const missing = list.filter(pc => !geoCache.has(pc));
      if (missing.length) await requestMissing(missing);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Site locations could not be loaded");
    } finally {
      setVersion(v => v + 1);
    }
  }, []);

  useEffect(() => {
    if (!enabled || wanted.length === 0) return;
    const unresolved = wanted.filter(pc => !geoCache.has(pc));
    if (unresolved.length === 0 || busy.current) return;
    busy.current = true;
    setLoading(true);
    void resolve(unresolved.slice(0, AUTO_LOCATE)).finally(() => {
      busy.current = false;
      setLoading(false);
    });
  }, [wanted, enabled, resolve]);

  const locateMore = useCallback(() => {
    const unresolved = wantedRef.current.filter(pc => !geoCache.has(pc));
    if (!unresolved.length || busy.current) return;
    busy.current = true;
    setLoading(true);
    void resolve(unresolved.slice(0, AUTO_LOCATE)).finally(() => {
      busy.current = false;
      setLoading(false);
    });
  }, [resolve]);

  const coords = useMemo(() => {
    const map = new Map<string, SiteCoord>();
    for (const pc of wanted) {
      const hit = geoCache.get(pc);
      if (hit) map.set(pc, hit);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, version]);

  const unresolvedCount = useMemo(
    () => wanted.filter(pc => !geoCache.has(pc)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wanted, version],
  );

  return { coords, loading, error, unresolvedCount, locateMore };
}
