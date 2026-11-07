const VERSION = "railverify-v2";
const SHELL = [
  "/",
  "/dashboard",
  "/index.html",
  "/styles.css",
  "/app.mjs",
  "/engine.mjs",
  "/manifest.webmanifest",
  "/fonts/manrope-latin-400-normal.woff2",
  "/fonts/manrope-latin-600-normal.woff2",
  "/fonts/manrope-latin-700-normal.woff2",
  "/fonts/space-grotesk-latin-500-normal.woff2",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
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
            .filter((key) => key.startsWith("railverify-") && key !== VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/webhooks/")
  )
    return;
  event.respondWith(
    fetch(event.request).catch(
      async () =>
        (await caches.match(event.request)) ||
        (event.request.mode === "navigate"
          ? await caches.match("/index.html")
          : Response.error()),
    ),
  );
});
