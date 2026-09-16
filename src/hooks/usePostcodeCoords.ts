import { useEffect, useMemo, useState } from "react";

export type LatLng = { lat: number; lng: number };

const cache = new Map<string, LatLng | null>();

export const normalisePostcode = (pc: string | null | undefined) =>
  String(pc ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const outward = (pc: string) => {
  const clean = normalisePostcode(pc);
  if (clean.length <= 4) return clean;
  return clean.slice(0, clean.length - 3);
};

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function lookupFull(postcodes: string[]) {
  const results = new Map<string, LatLng | null>();
  for (const batch of chunk(postcodes, 100)) {
    try {
      const res = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postcodes: batch }),
      });
      const json = await res.json();
      for (const row of json?.result ?? []) {
        const key = normalisePostcode(row.query);
        const r = row.result;
        results.set(key, r ? { lat: r.latitude, lng: r.longitude } : null);
      }
    } catch {
      for (const pc of batch) results.set(normalisePostcode(pc), null);
    }
  }
  return results;
}

async function lookupOutward(codes: string[]) {
  const results = new Map<string, LatLng | null>();
  await Promise.all(
    codes.map(async code => {
      try {
        const res = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(code)}`);
        const json = await res.json();
        const r = json?.result;
        results.set(code, r ? { lat: r.latitude, lng: r.longitude } : null);
      } catch {
        results.set(code, null);
      }
    }),
  );
  return results;
}

/**
 * Resolve postcodes (and their outward codes as a fallback) to coordinates so
 * travel time can be worked out from real postcode-to-postcode distance.
 */
export function usePostcodeCoords(postcodes: (string | null | undefined)[], enabled = true) {
  const wanted = useMemo(() => {
    const set = new Set<string>();
    for (const pc of postcodes) {
      const clean = normalisePostcode(pc);
      if (clean.length >= 2) set.add(clean);
    }
    return [...set].sort();
  }, [postcodes]);

  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || wanted.length === 0) return;
    const missing = wanted.filter(pc => !cache.has(pc));
    if (missing.length === 0) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const full = missing.filter(pc => pc.length >= 5);
      const resolved = full.length ? await lookupFull(full) : new Map<string, LatLng | null>();
      for (const [k, v] of resolved) cache.set(k, v);

      // Anything unresolved (or partial postcodes) falls back to its outward code.
      const needOutward = new Set<string>();
      for (const pc of missing) if (!cache.get(pc)) needOutward.add(outward(pc));
      const outCodes = [...needOutward].filter(c => c && !cache.has(`OUT:${c}`));
      if (outCodes.length) {
        const outRes = await lookupOutward(outCodes);
        for (const [k, v] of outRes) cache.set(`OUT:${k}`, v);
      }
      for (const pc of missing) {
        if (!cache.get(pc)) cache.set(pc, cache.get(`OUT:${outward(pc)}`) ?? null);
      }
      if (!cancelled) {
        setLoading(false);
        setVersion(v => v + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wanted, enabled]);

  const coords = useMemo(() => {
    const map = new Map<string, LatLng>();
    for (const pc of wanted) {
      const hit = cache.get(pc);
      if (hit) map.set(pc, hit);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, version]);

  return { coords, loading };
}
