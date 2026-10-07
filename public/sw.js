/*
 * Mirna Storefront service worker — deliberately conservative.
 *
 * Its job is installability and fast repeat loads of static files, nothing
 * more. It never stores anything personal.
 *
 *   CACHED   · same-origin, content-hashed build assets (/_next/static/*)
 *            · app icons (/icons/*) and the offline fallback page
 *   NEVER    · HTML pages / RSC payloads (may later contain account or cart
 *              state for signed-in customers)
 *            · Server Actions, API routes, any non-GET request
 *            · any cross-origin request — including Supabase (auth tokens,
 *              REST, Storage), which is passed straight to the network
 *            · customer, cart, order, address or payment data of any kind
 *   OFFLINE  · failed page navigations show /offline.html (no offline
 *              browsing, checkout or account editing)
 *
 * Bump VERSION to drop old caches on deploy.
 */
const VERSION = "v1";
const CACHE = `mirna-storefront-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("mirna-storefront-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never touch cross-origin traffic (Supabase Auth/REST/Storage, fonts, …).
  if (url.origin !== self.location.origin) return;

  // Pages: always network; offline page on failure. Never cached.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Immutable build assets and icons: cache-first.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
            }
            return response;
          }),
      ),
    );
  }
  // Everything else falls through to the network untouched.
});
