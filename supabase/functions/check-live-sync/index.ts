const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIVE_URLS = [
  "https://portal.clewsrecycling.co.uk/",
  "https://clewshandbook.lovable.app/",
];

function extractMainScript(html: string): string | null {
  // Vite emits <script type="module" crossorigin src="/assets/index-XXXX.js">
  const match = html.match(/<script[^>]+src="([^"]*\/assets\/[^"]+\.js)"/);
  return match ? match[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const results: Record<string, { url: string; script: string | null; error?: string }> = {};
    for (const url of LIVE_URLS) {
      try {
        const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
        const html = await res.text();
        results[url] = { url, script: extractMainScript(html) };
      } catch (e) {
        results[url] = { url, script: null, error: String(e) };
      }
    }
    return new Response(JSON.stringify({ ok: true, results, fetchedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
