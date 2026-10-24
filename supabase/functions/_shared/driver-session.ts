// Signed, expiring pass issued after a successful driver PIN login.
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature).
// Signed with the server-only service key so the browser cannot forge one.

export interface DriverPass { d: string; src: "driver" | "profile"; exp: number }

const SESSION_HOURS = 14;
const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

async function key() {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!secret) throw new Error("Server key missing");
  return crypto.subtle.importKey("raw", enc.encode(`driver-pass:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function issueDriverPass(driverId: string, src: DriverPass["src"] = "driver") {
  const payload: DriverPass = { d: driverId, src, exp: Date.now() + SESSION_HOURS * 3600_000 };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifyDriverPass(token: unknown): Promise<DriverPass | null> {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as DriverPass;
    if (!p?.d || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

/** Same normalisation as the RouteOne planner: "Lee.Gane" and "Lee Gane" match; partial names never do. */
export const driverNameKey = (v: unknown) =>
  String(v ?? "").toLowerCase().replace(/[.\-_]+/g, " ").replace(/\s+/g, " ").trim();
