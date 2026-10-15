import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const source = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
const appVersion = source.match(/const APP_VERSION = "([^"]+)"/)[1];
const cacheName = `kalimba-tone-trace-v${appVersion}`;

function createWorker({ version = appVersion, scope = "https://example.test/kalimba/" } = {}) {
  const listeners = new Map();
  const namespaces = new Map();
  const networkCalls = [];
  const activationRequests = [];
  let installRejected = false;
  let networkResponse = new Response("working page");
  let offline = false;
  let rejectWrites = false;
  let rejectReads = false;
  let networkNeverSettles = false;
  const key = request => new URL(typeof request === "string" ? request : request.url, scope).href;
  const entriesFor = name => {
    if (!namespaces.has(name)) namespaces.set(name, new Map());
    return namespaces.get(name);
  };
  const openCache = async name => ({
    addAll: async requests => {
      if (installRejected) throw new Error("Install failed");
      for (const request of requests) entriesFor(name).set(key(request), new Response("installed asset"));
    },
    match: async request => {
      if (rejectReads) throw new Error("Cache unavailable");
      return entriesFor(name).get(key(request))?.clone();
    },
    put: async (request, response) => {
      if (rejectWrites) throw new Error("Storage quota exceeded");
      entriesFor(name).set(key(request), response.clone());
    }
  });
  runInNewContext(source.replace(`const APP_VERSION = "${appVersion}"`, `const APP_VERSION = "${version}"`), {
    self: {
      registration: { scope },
      addEventListener: (name, handler) => listeners.set(name, handler),
      clients: { claim: async () => {} },
      skipWaiting: async () => { activationRequests.push(entriesFor(`kalimba-tone-trace-v${version}`).size); }
    },
    caches: {
      open: openCache,
      keys: async () => [...namespaces.keys()],
      delete: async name => namespaces.delete(name),
      match: async request => {
        for (const entries of namespaces.values()) {
          const response = entries.get(key(request));
          if (response) return response.clone();
        }
      }
    },
    fetch: async (request, options) => {
      networkCalls.push({ url: key(request), options });
      if (offline) throw new TypeError("Offline");
      if (networkNeverSettles) return new Promise(() => {});
      return networkResponse.clone();
    },
    URL, Request: class extends Request {
      constructor(input, options) { super(new URL(input, scope), options); }
    }, Response,
    console: { warn() {} }
  });
  return {
    networkCalls, namespaces, activationRequests,
    rejectInstall() { installRejected = true; },
    seedResponse(file, response, name = `kalimba-tone-trace-v${version}`) {
      entriesFor(name).set(key(file), response.clone());
    },
    seed(file, text, name = `kalimba-tone-trace-v${version}`) {
      entriesFor(name).set(key(file), new Response(text));
    },
    entry(file, name = `kalimba-tone-trace-v${version}`) { return entriesFor(name).get(key(file)); },
    setNetwork(response) { networkResponse = response; },
    setOffline() { offline = true; },
    hangNetwork() { networkNeverSettles = true; },
    rejectWrites() { rejectWrites = true; },
    rejectReads() { rejectReads = true; },
    async install() {
      let completion;
      listeners.get("install")({ waitUntil(promise) { completion = promise; } });
      await completion;
    },
    async activate() {
      let completion;
      listeners.get("activate")({ waitUntil(promise) { completion = promise; } });
      await completion;
    },
    dispatch(file, mode = "navigate", method = "GET") {
      const pending = [];
      let response;
      const request = { method, mode, redirect: mode === "navigate" ? "manual" : "follow", url: key(file) };
      listeners.get("fetch")({
        request,
        respondWith(promise) { response = promise; },
        waitUntil(promise) { pending.push(promise); }
      });
      return { request, response, pending };
    },
    async request(file, mode = "navigate") {
      const event = this.dispatch(file, mode);
      const response = await event.response;
      await Promise.all(event.pending);
      return { response, pendingWrites: event.pending.length };
    }
  };
}

// Unlike synthetic Response fixtures, these real HTTP fetches retain the URL
// chain created by the same 307 clean-URL redirects as the public Sites host.
async function withRedirectHost(run) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://fixture.test");
    if (url.pathname.endsWith(".html")) {
      const route = url.pathname === "/kalimba/index.html" ? "/kalimba/" : url.pathname.slice(0, -5);
      response.writeHead(307, { Location: route + url.search });
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": url.searchParams.has("json") ? "application/json" : "text/html; charset=utf-8",
      "X-Shell-Fixture": "clean-url"
    });
    response.end(`<h1>${url.pathname === "/kalimba/" ? "practice" : "library"}</h1>`);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const scope = `http://127.0.0.1:${server.address().port}/kalimba/`;
  try { await run(scope); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test("real 307 precache responses become safe manual-redirect navigation responses", async () => {
  await withRedirectHost(async scope => {
    const worker = createWorker({ scope });
    for (const [file, text, targets] of [
      ["index.html", "practice", ["./?song=my-song", "index.html?app-update=2.4.49-1&song=my-song"]],
      ["songs.html", "library", ["songs?selected=my-song", "songs.html?selected=other-song"]]
    ]) {
      const redirected = await fetch(new URL(file, scope));
      assert.equal(redirected.redirected, true, "fixture must exercise a real redirect chain");
      assert.equal(redirected.type, "basic");
      worker.seedResponse(file, redirected);
      assert.equal(worker.entry(file).redirected, true, "cache clones preserve the failure condition");
      for (const target of targets) {
        const event = worker.dispatch(target);
        assert.equal(event.request.redirect, "manual");
        const response = await event.response;
        // Fetch's service-worker response check rejects redirected=true for
        // manual navigation. The old v48 implementation fails this assertion.
        assert.equal(response.redirected, false);
        assert.equal(response.url, "");
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("Content-Type"), "text/html; charset=utf-8");
        assert.equal(response.headers.get("X-Shell-Fixture"), "clean-url");
        assert.equal(await response.text(), `<h1>${text}</h1>`);
        assert.equal(event.request.url, new URL(target, scope).href);
      }
    }
    assert.equal(worker.networkCalls.length, 0);
  });
});

test("redirect normalization never turns a wrong route, origin, or non-HTML body into a shell", async () => {
  await withRedirectHost(async scope => {
    const wrongRoute = await fetch(new URL("login.html", scope));
    const wrongType = await fetch(new URL("songs.html?json=1", scope));
    const correctRoute = await fetch(new URL("songs.html", scope));
    for (const [workerScope, cached] of [[scope, wrongRoute], [scope, wrongType], [scope.replace("127.0.0.1", "localhost"), correctRoute]]) {
      assert.equal(cached.redirected, true);
      const worker = createWorker({ scope: workerScope });
      worker.seedResponse("songs.html", cached);
      worker.setNetwork(new Response("fresh network"));
      assert.equal(await (await worker.request("songs?selected=test")).response.text(), "fresh network");
      assert.equal(worker.networkCalls.length, 1);
    }
  });
});

test("v49 rescue activates only after the full shell and samples install when v48 exists", async () => {
  const worker = createWorker({ version: "2.4.49" });
  worker.seed("index.html", "broken v48", "kalimba-tone-trace-v2.4.48");
  await worker.install();
  const shell = JSON.parse(source.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]);
  const samples = JSON.parse(source.match(/const SAMPLE_ASSETS = (\[[\s\S]*?\]);/)[1]);
  assert.deepEqual(worker.activationRequests, [shell.length + samples.length]);
  assert.equal(worker.entry("index.html", "kalimba-tone-trace-v2.4.48") !== undefined, true, "install does not prematurely delete active caches");
});

test("failed rescue installation leaves the current worker and cache unchanged", async () => {
  const worker = createWorker({ version: "2.4.49" });
  worker.seed("index.html", "old data", "kalimba-tone-trace-v2.4.48");
  worker.rejectInstall();
  await assert.rejects(worker.install(), /Install failed/);
  assert.deepEqual(worker.activationRequests, []);
  assert.equal(await worker.entry("index.html", "kalimba-tone-trace-v2.4.48").clone().text(), "old data");
  const samplesFail = createWorker({ version: "2.4.49" });
  samplesFail.seed("index.html", "old data", "kalimba-tone-trace-v2.4.48");
  samplesFail.setOffline();
  await assert.rejects(samplesFail.install(), /Offline/);
  assert.deepEqual(samplesFail.activationRequests, []);
});

test("ordinary upgrades remain explicit and the rescue cannot auto-activate later releases", async () => {
  const ordinary = createWorker({ version: "2.4.49" });
  ordinary.seed("index.html", "v47", "kalimba-tone-trace-v2.4.47");
  await ordinary.install();
  assert.deepEqual(ordinary.activationRequests, []);
  const future = createWorker({ version: "2.4.50" });
  future.seed("index.html", "v48", "kalimba-tone-trace-v2.4.48");
  await future.install();
  assert.deepEqual(future.activationRequests, []);
});

test("cached shell opens without starting or waiting for a hanging network", async () => {
  const worker = createWorker();
  worker.seed("songs.html", "installed library");
  worker.hangNetwork();
  const event = worker.dispatch("songs.html?selected=birthday");
  // Deterministic: if production touches fetch this assertion fails, rather
  // than racing an arbitrary short timeout or hiding a never-settling fetch.
  let settled = false;
  event.response.then(() => { settled = true; });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(worker.networkCalls.length, 0);
  assert.equal(settled, true);
  assert.equal(await (await event.response).text(), "installed library");
  assert.equal(event.request.url, "https://example.test/kalimba/songs.html?selected=birthday");
});

test("Sites extensionless aliases and query variants reuse only the installed shell", async () => {
  const worker = createWorker();
  worker.seed("songs.html", "library");
  worker.seed("index.html", "practice");
  worker.setOffline();
  for (const file of ["songs", "songs?selected=one", "songs.html?selected=two%2Fthree", "songs?app-update=next&selected=four"]) {
    assert.equal(await (await worker.request(file)).response.text(), "library", file);
  }
  for (const file of ["./?song=one", "index?song=two", "index.html?app-update=next&song=three"]) {
    assert.equal(await (await worker.request(file)).response.text(), "practice", file);
  }
  assert.equal(worker.networkCalls.length, 0);
});

test("waiting and unrelated caches never supply the active version's HTML", async () => {
  const worker = createWorker();
  worker.seed("songs.html", "unrelated page", "another-app");
  worker.seed("songs.html", "new page", "kalimba-tone-trace-v99.0.0");
  worker.seed("songs.html", "current page");
  worker.hangNetwork();
  assert.equal(await (await worker.request("songs?selected=test")).response.text(), "current page");
  assert.equal(worker.networkCalls.length, 0);
});

test("activation and update reload use the complete new shell and preserve unrelated caches", async () => {
  const version = "99.0.0";
  const worker = createWorker({ version });
  worker.seed("songs.html", "old page", cacheName);
  worker.seed("songs.html", "new page");
  worker.seed("other.html", "other app", "another-app");
  await worker.activate();
  worker.setOffline();
  const event = worker.dispatch("songs?selected=my-song&app-update=99.0.0-123");
  assert.equal(await (await event.response).text(), "new page");
  assert.match(event.request.url, /selected=my-song&app-update=99.0.0-123$/);
  assert.equal(worker.namespaces.has(cacheName), false);
  assert.equal(worker.namespaces.has("another-app"), true);
});

test("version checks bypass cached package data and still use no-store", async () => {
  const worker = createWorker();
  worker.seed("package.json?version-check=now", "old version");
  worker.setNetwork(new Response('{"version":"99.0.0"}'));
  const result = await worker.request("package.json?version-check=now", "cors");
  assert.equal((await result.response.json()).version, "99.0.0");
  assert.equal(worker.networkCalls.length, 1);
  assert.equal(worker.networkCalls[0].options.cache, "no-store");
  assert.equal(result.pendingWrites, 0);
});

test("unknown nested routes do not receive a same-named page or index fallback", async () => {
  const worker = createWorker();
  worker.seed("songs.html", "library");
  worker.seed("index.html", "practice");
  worker.setNetwork(new Response("Not found", { status: 404 }));
  for (const file of ["other/songs.html", "unknown", "../songs.html"]) {
    assert.equal((await worker.request(file)).response.status, 404);
  }
  worker.setOffline();
  await assert.rejects(worker.request("other/songs.html"), /Offline/);
});

test("cross-origin requests and non-GET requests are not intercepted", () => {
  const worker = createWorker();
  assert.equal(worker.dispatch("https://other.test/kalimba/songs.html").response, undefined);
  assert.equal(worker.dispatch("https://other.test/kalimba/package.json", "cors").response, undefined);
  assert.equal(worker.dispatch("songs.html", "navigate", "POST").response, undefined);
  assert.equal(worker.networkCalls.length, 0);
});

test("server errors do not replace an installed shell or become offline pages", async () => {
  const worker = createWorker();
  worker.seed("songs.html", "working library");
  worker.setNetwork(new Response("server unavailable", { status: 503 }));
  assert.equal(await (await worker.request("songs.html")).response.text(), "working library");
  assert.equal((await worker.request("index.html")).response.status, 503);
  assert.equal(worker.entry("index.html"), undefined);
  worker.setOffline();
  assert.equal(await (await worker.request("songs.html")).response.text(), "working library");
});

test("a missing shell entry recovers under a bounded canonical key, preserving query state", async () => {
  const worker = createWorker();
  const result = await worker.request("songs?selected=one");
  assert.equal(result.pendingWrites, 1);
  assert.equal(await worker.entry("songs.html").clone().text(), "working page");
  assert.equal(worker.entry("songs?selected=one"), undefined);
  worker.setOffline();
  assert.equal(await (await worker.request("songs?selected=two")).response.text(), "working page");
});

test("cache read errors fall back to the network without suppressing the page", async () => {
  const worker = createWorker();
  worker.rejectReads();
  assert.equal(await (await worker.request("songs?selected=one")).response.text(), "working page");
});

test("successful navigation writes stay alive for the service worker event", async () => {
  const worker = createWorker();
  assert.equal((await worker.request("index.html")).pendingWrites, 1);
});

test("runtime asset writes stay alive and storage failures preserve the network response", async () => {
  const worker = createWorker();
  worker.rejectWrites();
  const result = await worker.request("src/app.js", "cors");
  assert.equal(result.pendingWrites, 1);
  assert.equal(await result.response.text(), "working page");
});

// The recoverable edition must ship with the offline app, not depend on a live server.
test("selected-edition archive is an existing precached public asset", async () => {
  const shell = JSON.parse(source.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]);
  assert.ok(shell.includes("./data/archives/jasmine-walter-v2.4.3.json"));
  assert.ok(shell.includes("./data/archives/ling-er-xiang-ding-dang-v2.4.15.json"));
  for (const asset of shell) await readFile(new URL("../" + (asset === "./" ? "index.html" : asset.slice(2)), import.meta.url));
  const archive = JSON.parse(await readFile(new URL("../data/archives/jasmine-walter-v2.4.3.json", import.meta.url), "utf8"));
  assert.equal(archive.steps.length, 145);
});
