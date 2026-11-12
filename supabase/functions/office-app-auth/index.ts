// Office App PIN checks for office staff.
// - Every office profile starts on the starting PIN and must choose its own PIN at first use.
// - Five wrong PINs lock that username for 15 minutes; an admin can reset a PIN.
// - This function only checks PINs. It never creates sign-in sessions: each person signs in
//   once per device with their normal portal password, and the PIN then unlocks that device.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMAIL_DOMAIN = "clewsrecycling.co.uk";
const STARTING_PIN = "1234";
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const ITERATIONS = 100_000;
const enc = new TextEncoder();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isPin = (v: unknown): v is string => typeof v === "string" && /^\d{4,6}$/.test(v);
const newPinProblem = (pin: unknown) => {
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) return "Your new PIN must be 4 digits.";
  if (pin === STARTING_PIN) return "Pick a PIN that isn't 1234.";
  if (/^(\d)\1{3}$/.test(pin)) return "Pick a PIN that isn't the same digit four times.";
  return null;
};

const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => Uint8Array.from((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));

async function derive(pin: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${hex(salt)}$${await derive(pin, salt, ITERATIONS)}`;
}
async function checkPin(pin: string, stored: string | null) {
  if (!stored) return pin === STARTING_PIN;
  const [, iter, salt, hash] = stored.split("$");
  const got = await derive(pin, unhex(salt), Number(iter));
  let diff = got.length ^ hash.length;
  for (let i = 0; i < Math.min(got.length, hash.length); i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const NOT_RECOGNISED = "Username or PIN not recognised.";

async function findOfficeProfile(rawUsername: unknown) {
  const u = String(rawUsername ?? "").trim().toLowerCase();
  if (!u || u.length > 120) return null;
  const email = u.includes("@") ? u : `${u}@${EMAIL_DOMAIN}`;
  const { data } = await admin.from("profiles").select("id, email, full_name, user_types, is_archived").eq("email", email).maybeSingle();
  if (!data || data.is_archived || !(data.user_types ?? []).includes("office")) return null;
  return data as { id: string; email: string; full_name: string | null; user_types: string[] };
}

type PinRow = { user_id: string; pin_hash: string | null; failed_attempts: number; locked_until: string | null };

async function loadPinRow(userId: string): Promise<PinRow> {
  const { data } = await admin.from("office_app_pins").select("user_id, pin_hash, failed_attempts, locked_until").eq("user_id", userId).maybeSingle();
  return (data as PinRow) ?? { user_id: userId, pin_hash: null, failed_attempts: 0, locked_until: null };
}

/** Checks the PIN and applies the lockout. Returns null when it matches, otherwise the response to send. */
async function verify(row: PinRow, pin: string): Promise<Response | null> {
  const now = Date.now();
  if (row.locked_until && new Date(row.locked_until).getTime() > now) {
    const mins = Math.ceil((new Date(row.locked_until).getTime() - now) / 60000);
    return json({ error: `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? "" : "s"}, or ask an admin to reset your PIN.` }, 423);
  }
  if (await checkPin(pin, row.pin_hash)) {
    if (row.failed_attempts || row.locked_until) {
      await admin.from("office_app_pins").upsert({ user_id: row.user_id, pin_hash: row.pin_hash, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() });
    }
    return null;
  }
  const attempts = (row.failed_attempts ?? 0) + 1;
  const lock = attempts >= MAX_ATTEMPTS;
  await admin.from("office_app_pins").upsert({
    user_id: row.user_id,
    pin_hash: row.pin_hash,
    failed_attempts: lock ? 0 : attempts,
    locked_until: lock ? new Date(now + LOCK_MINUTES * 60000).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  if (lock) return json({ error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes, or ask an admin to reset your PIN.` }, 423);
  return json({ error: NOT_RECOGNISED, attempts_left: MAX_ATTEMPTS - attempts }, 401);
}

async function setPin(userId: string, pin: string) {
  const now = new Date().toISOString();
  const { error } = await admin.from("office_app_pins").upsert({ user_id: userId, pin_hash: await hashPin(pin), failed_attempts: 0, locked_until: null, pin_set_at: now, updated_at: now });
  if (error) throw error;
}

async function callerIsAdmin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const { data } = await admin.auth.getUser(token);
  if (!data?.user) return false;
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  return !!isAdmin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "verify");

    if (action === "verify") {
      const pin = body?.pin;
      const newPin = body?.new_pin;
      if (!isPin(pin)) return json({ error: NOT_RECOGNISED }, 401);
      const profile = await findOfficeProfile(body?.username);
      if (!profile) {
        await derive(pin, new Uint8Array(16), ITERATIONS); // similar timing for unknown names
        return json({ error: NOT_RECOGNISED }, 401);
      }
      const row = await loadPinRow(profile.id);
      const failed = await verify(row, pin);
      if (failed) return failed;

      const mustChange = !row.pin_hash;
      const wantsChange = newPin !== undefined && newPin !== null && newPin !== "";
      if (wantsChange) {
        const problem = newPinProblem(newPin);
        if (problem) return json({ error: problem, needs_new_pin: mustChange }, 400);
        await setPin(profile.id, newPin as string);
      } else if (mustChange) {
        return json({ needs_new_pin: true, name: profile.full_name });
      }
      return json({ ok: true, user_id: profile.id, name: profile.full_name, pin_changed: wantsChange });
    }

    if (action === "reset") {
      if (!(await callerIsAdmin(req))) return json({ error: "Only admins can reset Office App PINs" }, 403);
      const userId = String(body?.user_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "Invalid user" }, 400);
      const { error } = await admin.from("office_app_pins").upsert({ user_id: userId, pin_hash: null, failed_attempts: 0, locked_until: null, pin_set_at: null, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("office-app-auth error", e);
    return json({ error: "PIN check is unavailable right now. Please try again." }, 500);
  }
});
