import { supabase } from "@/integrations/supabase/client";

/**
 * Thin wrapper around the `driver-actions` edge function. The driver app runs
 * unauthenticated (PIN-based), so all privileged database/storage operations go
 * through this service-role function instead of touching tables directly.
 */
export async function driverAction<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("driver-actions", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Request failed");
  if (data?.error) throw new Error(data.error);
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
