import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./index.css";
import { moduleSignature, shouldReloadForNewerBuild } from "@/lib/build-watchdog";

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

// Keep open tabs on the newest build: when the server starts serving different
// app scripts than the ones this tab is running, reload once onto the new build.
const BUILD_FLAG = "w1-build-check";
const liveSignature = moduleSignature(document.documentElement.outerHTML);

async function checkForNewerBuild() {
  if (document.hidden) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_b", String(Date.now()));
    const res = await fetch(url.toString(), { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return;
    const freshSignature = moduleSignature(await res.text());
    if (shouldReloadForNewerBuild(liveSignature, freshSignature, sessionStorage.getItem(BUILD_FLAG))) {
      sessionStorage.setItem(BUILD_FLAG, freshSignature);
      window.location.reload();
      return;
    }
    if (sessionStorage.getItem(BUILD_FLAG) === freshSignature) {
      sessionStorage.removeItem(BUILD_FLAG);
    }
  } catch {
    /* ignore */
  }
}

window.setInterval(checkForNewerBuild, 45_000);
window.addEventListener("focus", checkForNewerBuild);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkForNewerBuild();
});

createRoot(document.getElementById("root")!).render(<App />);
