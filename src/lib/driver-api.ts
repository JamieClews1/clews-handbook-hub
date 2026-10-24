import { supabase } from "@/integrations/supabase/client";

const PASS_KEY = "driver_pass";

/** Signed driver pass returned by PIN login; sent with every driver action. */
export const driverPass = {
  get: () => localStorage.getItem(PASS_KEY),
  set: (token: string | null | undefined) => (token ? localStorage.setItem(PASS_KEY, token) : localStorage.removeItem(PASS_KEY)),
  clear: () => localStorage.removeItem(PASS_KEY),
};

/**
 * Thin wrapper around the `driver-actions` edge function. The driver app runs
 * unauthenticated (PIN-based), so all privileged database/storage operations go
 * through this function, which checks the signed driver pass and job ownership.
 */
export async function driverAction<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = driverPass.get();
  const { data, error } = await supabase.functions.invoke("driver-actions", {
    body: { action, ...(token ? { token } : {}), ...params },
  });
  if (error) {
    let message = error.message || "Request failed";
    try {
      const ctx = (error as any).context;
      const parsed = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      if (parsed?.session_expired) {
        driverPass.clear();
        localStorage.removeItem("driver_session");
        window.location.reload();
      }
      if (parsed?.error) message = parsed.error;
    } catch { /* keep generic message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  if (data?.token) driverPass.set(data.token);
  return data as T;
}

/** Read a File as a base64 string (without the data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
