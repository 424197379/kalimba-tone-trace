const APP_VERSION = "2.4.53";
// Compact requested controls, normal-speed marker and silent segment boundary preview.
// Candidate52: natural-demo completion retains terminal progress.
// First-frame preparation and post-audio-graph deadline checks; no musical-data edits.
// 片段循环、准备拍和速度偏好与离线应用壳同步更新。
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
  "./data/archives/jasmine-walter-v2.4.3.json",
  "./data/archives/ling-er-xiang-ding-dang-v2.4.15.json",
  "./src/app.js",
  "./src/practice-preferences.js",
  "./src/practice-loop.js",
  "./src/phrase-boundary-preview.js",
  "./src/phrase-boundary-renderer.js",
  "./src/key-guidance.js",
  "./src/song-presentation.js",
  "./src/practice-fullscreen.js",
  "./src/song-library.js",
  "./src/app-update.js",
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
          .addAll(APP_SHELL.map((asset) => new Request(asset, { cache: "reload" })))
          .then(() => Promise.all(SAMPLE_ASSETS.map((asset) => cacheSampleAsset(cache, asset))))
          .then(async () => {
            // One-time recovery: v48 can fail before any page JS or Update
            // button loads. Only promote this corrective release after its
            // complete offline shell installed, and only if v48 is present.
            // Do not reload clients or modify their songs, drafts or storage.
            if (APP_VERSION === "2.4.49" &&
                (await caches.keys()).includes(`${CACHE_PREFIX}-v2.4.48`)) {
              await self.skipWaiting();
            }
          })
      )
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0]?.postMessage({ version: APP_VERSION });
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

function getNavigationShellPage(request) {
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin) return null;
  if (url.pathname === scope.pathname) return "./index.html";
  // Sites serves /songs as an alias for songs.html. Match only our exact shell
  // routes, not an unrelated path ending in the same filename. Query parameters
  // select the song in client code and do not change the static HTML document.
  return APP_SHELL.find((asset) => {
    if (!asset.endsWith(".html")) return false;
    const path = new URL(asset, scope).pathname;
    return url.pathname === path || url.pathname === path.slice(0, -5);
  }) || null;
}

async function getCachedNavigation(request) {
  const shellPage = getNavigationShellPage(request);
  if (!shellPage) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(shellPage);
    if (!response?.redirected) return response;
    // Static hosts redirect songs.html -> /songs and index.html -> /. Their
    // precached responses retain that URL chain. Navigation requests use manual
    // redirects, so returning the chained response directly causes ERR_FAILED.
    // Rebuild only a successful same-page HTML response; never launder a login,
    // unrelated route, cross-origin, partial, or opaque redirect into our shell.
    if (!response.ok || response.status === 204 || response.status === 206 ||
        !/^text\/html(?:\s*;|$)/i.test(response.headers.get("Content-Type") || "") ||
        getNavigationShellPage({ url: response.url }) !== shellPage) return null;
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (error) {
    console.warn("Unable to read offline page", error);
    return null;
  }
}

function cacheRuntimeResponse(event, response, cacheKey = event.request) {
  if (response && response.ok && response.status !== 204 && response.status !== 206) {
    const copy = response.clone();
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.put(cacheKey, copy))
        .catch((error) => console.warn("Unable to update offline cache", error))
    );
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== new URL(self.registration.scope).origin) {
    return;
  }

  if (url.pathname === new URL("./package.json", self.registration.scope).pathname) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode === "navigate") {
    // The installed shell is a versioned unit. Do not put a server round trip
    // (or a new HTML/old JS mixture) in front of every Change Song / Back action.
    // app-update.js still checks and installs updates separately; after explicit
    // activation, reloads including ?app-update use the new worker's full shell.
    event.respondWith(
      getCachedNavigation(request).then((cached) => cached ||
        fetch(request).then((response) => cacheRuntimeResponse(event, response,
          getNavigationShellPage(request) || request)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => cacheRuntimeResponse(event, response));
    })
  );
});
