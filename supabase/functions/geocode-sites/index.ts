import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Resolves UK postcodes to map coordinates for the Live Jobs site map.
// Postcodes are cached in public.site_geocodes so each one is only ever looked
// up once; only staff sessions may call this, and each request is capped so a
// page load can never fan out into an unbounded billable batch.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const MAX_PER_REQUEST = 25;

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalise = (raw: unknown) =>
  String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

// A real UK postcode is 5-8 alphanumeric characters with a digit in the second
// or third position. Anything else is rejected before it reaches Google.
const isPostcode = (pc: string) => /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(pc);

type Cached = {
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  label: string | null;
  status: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the caller's own session, then require a staff role before any
    // billable Google request is made.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: session, error: sessionError } = await userClient.auth.getUser();
    if (sessionError || !session?.user) return json({ error: "Not signed in" }, 401);

    const { data: staff } = await admin.rpc("is_staff", { _user_id: session.user.id });
    if (!staff) return json({ error: "Not permitted" }, 403);

    const body = await req.json().catch(() => ({}));
    const requested: string[] = Array.isArray(body?.postcodes) ? body.postcodes : [];
    const wanted: string[] = [];
    for (const raw of requested) {
      const pc = normalise(raw);
      if (pc && isPostcode(pc) && !wanted.includes(pc)) wanted.push(pc);
      if (wanted.length >= MAX_PER_REQUEST) break;
    }
    if (wanted.length === 0) return json({ error: "No valid postcodes supplied" }, 400);

    const { data: cachedRows, error: cacheError } = await admin
      .from("site_geocodes")
      .select("postcode,latitude,longitude,label,status")
      .in("postcode", wanted);
    if (cacheError) throw cacheError;

    const cached = new Map<string, Cached>();
    for (const row of (cachedRows ?? []) as Cached[]) {
      // A failed lookup is still an answer: only errored rows are retried.
      if (row.status !== "error") cached.set(row.postcode, row);
    }

    const missing = wanted.filter((pc) => !cached.has(pc));
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (missing.length > 0 && (!lovableKey || !mapsKey)) {
      return json({ error: "Google Maps connector is not configured" }, 500);
    }

    const resolved: Record<string, { lat: number; lng: number; label: string | null }> = {};
    let located = 0;
    let notFound = 0;

    for (const pc of missing) {
      const url = `${GATEWAY_URL}/maps/api/geocode/json?${new URLSearchParams({
        address: pc,
        region: "gb",
      })}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
        },
      });

      if (response.status === 403) {
        const details: Array<{ reason?: string }> =
          (await response.json().catch(() => null))?.error?.details ?? [];
        const reason = details.find((d) => d.reason)?.reason;
        if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
          return json({
            error:
              "Google Maps server key is referrer-restricted. In Google Cloud Console, set the server key's application restrictions to \"None\" or \"IP addresses\".",
          }, 403);
        }
        if (reason === "API_KEY_SERVICE_BLOCKED") {
          return json({
            error:
              "Google Maps server key does not allow this API. In Google Cloud Console, add the Geocoding API to the server key's allowed-APIs list.",
          }, 403);
        }
        return json({ error: "Google Maps request was denied (403). Check the server key's restrictions in Google Cloud Console." }, 403);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Geocode request failed [${response.status}]: ${errorBody}`);
        await admin.from("site_geocodes").upsert(
          { postcode: pc, status: "error", attempts: 1, updated_at: new Date().toISOString() },
          { onConflict: "postcode" },
        );
        continue;
      }

      const payload = await response.json();
      const place = payload?.results?.[0];
      if (payload?.status === "OK" && place?.geometry?.location) {
        const row = {
          postcode: pc,
          latitude: Number(place.geometry.location.lat),
          longitude: Number(place.geometry.location.lng),
          label: place.formatted_address ?? null,
          location_type: place.geometry.location_type ?? null,
          status: "ok",
          attempts: 1,
          geocoded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await admin.from("site_geocodes").upsert(row, { onConflict: "postcode" });
        resolved[pc] = { lat: row.latitude, lng: row.longitude, label: row.label };
        located++;
      } else {
        await admin.from("site_geocodes").upsert(
          {
            postcode: pc,
            status: "not_found",
            attempts: 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "postcode" },
        );
        notFound++;
      }
    }

    for (const [pc, row] of cached) {
      if (row.latitude != null && row.longitude != null) {
        resolved[pc] = { lat: row.latitude, lng: row.longitude, label: row.label };
      }
    }

    return json({
      coords: resolved,
      located,
      notFound,
      remaining: wanted.length - missing.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("geocode-sites failed:", message);
    return json({ error: message }, 500);
  }
});
