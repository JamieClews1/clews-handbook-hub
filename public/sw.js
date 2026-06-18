// Kill-switch service worker.
// A previous PWA build registered a caching service worker that keeps serving
// a stale version of the app to returning visitors. This replacement worker
// unregisters itself, deletes every cache, and forces all open tabs to reload
// so users always get the latest version.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (e) {
        // ignore
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});

// Never serve from cache — always go to the network.
self.addEventListener("fetch", () => {});
