// sTablo service worker — safe offline shell + network-first navigation.
//
// v2 fixes a stale-shell bug that crashed the app on mobile after a deploy
// ("Qualcosa è andato storto" / ChunkLoadError) while desktop stayed fine:
//   - the cache name never changed, so a poisoned cache was never purged;
//   - navigations used `fetch(request)` (no `no-store`), so the worker could
//     re-serve an old HTML shell pointing at JS chunks the server had already
//     replaced → the missing chunk threw on load.
// v2: bump the cache name (wipes the old one on activate), fetch navigations
// with `no-store` so the shell is always fresh while online, and only ever
// cache-first the immutable, content-hashed /_next/static assets.
// v3: new app icon. The manifest is precached cache-first, so bumping the cache
// name is what purges the stale manifest and forces installed clients to re-read
// it (and thus the new icon-*-v2.png set) on the next launch.
const CACHE = "stablo-v3";
const PRECACHE = ["/offline", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigations: always fetch the freshest HTML straight from the network,
  // bypassing the HTTP cache so we can never re-serve (or re-cache) a stale
  // shell that points at deleted chunks. Only fall back to a cached page or
  // the offline shell when the network is actually unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match("/offline")),
        ),
    );
    return;
  }

  // Immutable, content-hashed build assets — safe to serve cache-first.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
            return res;
          }),
      ),
    );
    return;
  }

  // Precached shell files (icon, manifest): cache-first with network fallback.
  if (url.origin === self.location.origin && PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((c) => c || fetch(request)));
    return;
  }

  // Everything else (APIs, RSC payloads, cross-origin) goes straight to network.
});

// ---------------------------------------------------------------------------
// Web Push — show the notification and focus/open the app on click.
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "sTablo", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "sTablo";
  const options = {
    body: payload.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing tab if one is open, otherwise open a new one.
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});
