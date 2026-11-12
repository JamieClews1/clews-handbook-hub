import { supabase } from "@/integrations/supabase/client";
import { updateRememberedToken } from "@/lib/office-app";

let started = false;

/** Keeps each remembered Office App person's saved session current as the portal refreshes it. */
export function startOfficeSessionSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user && session.refresh_token) updateRememberedToken(session.user.id, session.refresh_token);
  });
}

type VerifyResult = { ok?: boolean; needs_new_pin?: boolean; user_id?: string; name?: string | null; error?: string; attempts_left?: number };

/** Calls the Office App PIN check. Errors come back as { error } rather than throwing. */
export async function officePinCall(body: Record<string, unknown>, accessToken?: string): Promise<VerifyResult> {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/office-app-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as VerifyResult;
    if (!res.ok && !data.error) return { error: "PIN check is unavailable right now. Please try again." };
    return data;
  } catch {
    return { error: "No connection. Check the signal and try again." };
  }
}
