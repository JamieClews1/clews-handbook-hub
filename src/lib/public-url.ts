/**
 * Base URL to use when generating links that are shared with people outside
 * the business. The Lovable preview host requires a Lovable sign-in, so links
 * copied from there must point at the public published domain instead.
 */
export const PUBLIC_SITE_URL = "https://portal.clewsrecycling.co.uk";

export const publicBaseUrl = (): string => {
  if (typeof window === "undefined") return PUBLIC_SITE_URL;
  const host = window.location.hostname;
  const isPreview =
    host.includes("id-preview") ||
    host.includes("lovableproject.com") ||
    host.includes("sandbox") ||
    host === "localhost" ||
    host === "127.0.0.1";
  return isPreview ? PUBLIC_SITE_URL : window.location.origin;
};

export const publicUrl = (path: string): string =>
  `${publicBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
