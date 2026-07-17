const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIVE_URLS = [
  "https://portal.clewsrecycling.co.uk/",
  "https://clewshandbook.lovable.app/",
];

function extractMainScript(html: string): string | null {
  const match = html.match(/<script[^>]+src="([^"]+)"[^>]*type="module"/i)
    || html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i);
  if (!match) return null;
  return match[1];
}

function isDevBundle(src: string): boolean {
  // Vite dev serves /src/main.tsx (unhashed). Prod builds hash into /assets/index-*.js
  return /\/src\/main\.tsx/.test(src) || !/\/assets\/.*\.js/.test(src);
}

async function fetchScript(url: string) {
  try {
    const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
    const html = await res.text();
    const script = extractMainScript(html);
    return { url, status: res.status, script, dev: script ? isDevBundle(script) : false };
  } catch (e) {
    return { url, status: 0, script: null, dev: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let previewOrigin: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.previewOrigin && typeof body.previewOrigin === "string") {
          previewOrigin = body.previewOrigin.replace(/\/$/, "");
        }
      } catch {}
    }

    const urls = [...LIVE_URLS];
    if (previewOrigin) urls.push(previewOrigin + "/");

    const results = await Promise.all(urls.map(fetchScript));
    const preview = previewOrigin ? results[results.length - 1] : null;
    const live = previewOrigin ? results.slice(0, -1) : results;

    let verdict: "match" | "mismatch" | "dev-preview" | "unknown" = "unknown";
    if (preview) {
      if (preview.dev) verdict = "dev-preview";
      else {
        const liveScripts = live.map((r) => r.script).filter(Boolean) as string[];
        verdict = liveScripts.length && liveScripts.every((s) => s === preview.script) ? "match" : "mismatch";
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      verdict,
      preview,
      live,
      fetchedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
