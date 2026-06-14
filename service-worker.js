const APP_VERSION = "2.2.11";
const CACHE_PREFIX = "kalimba-tone-trace";
const CACHE_NAME = `${CACHE_PREFIX}-v${APP_VERSION}`;

const SAMPLE_ASSETS = [
  "./assets/samples/d6.mp3",
  "./assets/samples/b5.mp3",
  "./assets/samples/g5.mp3",
  "./assets/samples/e5.mp3",
  "./assets/samples/c5.mp3",
  "./assets/samples/a4.mp3",
  "./assets/samples/f4.mp3",
  "./assets/samples/d4.mp3",
  "./assets/samples/b3.mp3",
  "./assets/samples/g3.mp3",
  "./assets/samples/f3.mp3",
  "./assets/samples/a3.mp3",
  "./assets/samples/c4.mp3",
  "./assets/samples/e4.mp3",
  "./assets/samples/g4.mp3",
  "./assets/samples/b4.mp3",
  "./assets/samples/d5.mp3",
  "./assets/samples/f5.mp3",
  "./assets/samples/a5.mp3",
  "./assets/samples/c6.mp3",
  "./assets/samples/e6.mp3"
];

const APP_SHELL = [
  "./",
  "./index.html",
  "./changelog.html",
  "./support.html",
  "./songs.html",
  "./kalimba-practice.html",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/song-library.js",
  "./src/song-store.js",
  "./src/songs.js",
  "./src/styles.css",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png",
  "./assets/support/alipay-reward.jpg",
  "./assets/samples/manifest.json"
];

function cacheSampleAsset(cache, asset) {
  return fetch(asset, { headers: { Range: "bytes=0-" } })
    .then((response) => {
      if (!response.ok || response.status === 204) {
        throw new Error(`Unable to cache sample ${asset}`);
      }
      const contentType = response.headers.get("Content-Type") || "audio/mpeg";
      return response.arrayBuffer().then((body) =>
        cache.put(asset, new Response(body, {
          status: 200,
          headers: {
            "Content-Type": contentType
          }
        }))
      );
    });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache
          .addAll(APP_SHELL)
          .then(() => Promise.all(SAMPLE_ASSETS.map((asset) => cacheSampleAsset(cache, asset))))
      )
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function getNavigationFallback(request) {
  const url = new URL(request.url);
  const fileName = url.pathname.split("/").pop() || "index.html";
  const shellPage = `./${fileName}`;

  return caches
    .match(request)
    .then((cached) => cached || caches.match(shellPage))
    .then((cached) => cached || caches.match("./index.html"));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => getNavigationFallback(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response && response.ok && response.status !== 204 && response.status !== 206) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
