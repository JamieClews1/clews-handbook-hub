import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./index.css";

// Unregister all stale service workers and clear cached app shells so returning
// visitors always load the latest version instead of an old cached build.
// If an old worker is still controlling this tab, the page was served from its
// cache: clear everything, then reload once so the latest build is fetched.
(async () => {
  const controlled = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  const flag = "w1-stale-reload";
  if (controlled && !sessionStorage.getItem(flag)) {
    sessionStorage.setItem(flag, "1");
    window.location.reload();
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
