import { supabase } from "@/integrations/supabase/client";

/** Company brand logo (Settings → Brand details), cached for printed documents. */
let cached: string | null = null;

export function absoluteUrl(url: string): string {
  if (!url || url.startsWith("data:") || /^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function loadBrandLogo(): Promise<string | null> {
  const { data } = await supabase.from("company_profile").select("brand_logo_url").limit(1).maybeSingle();
  const url = (data as { brand_logo_url?: string | null } | null)?.brand_logo_url ?? null;
  cached = url ? absoluteUrl(url) : null;
  return cached;
}

export function getBrandLogoUrl(): string | null {
  return cached;
}

/** Converts any image URL into a data URL (needed for PDF generation). */
export async function toDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(absoluteUrl(url));
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  loadBrandLogo().catch(() => undefined);
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION") loadBrandLogo().catch(() => undefined);
  });
}
