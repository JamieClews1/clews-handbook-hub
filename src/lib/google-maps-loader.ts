// Loads the Google Maps JavaScript API exactly once, using the Lovable
// Google Maps connector browser key. Uses the async loader pattern with a
// global callback so google.maps.Map is guaranteed available when resolved.

let loadPromise: Promise<typeof google.maps> | null = null;

const CALLBACK_NAME = "__lovableInitGoogleMaps";

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) return loadPromise;

  const browserKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const trackingId = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  if (!browserKey) {
    return Promise.reject(new Error("Google Maps browser key is not configured"));
  }

  loadPromise = new Promise((resolve, reject) => {
    (window as unknown as Record<string, unknown>)[CALLBACK_NAME] = () => {
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: browserKey,
      loading: "async",
      callback: CALLBACK_NAME,
    });
    if (trackingId) params.set("channel", trackingId);

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
