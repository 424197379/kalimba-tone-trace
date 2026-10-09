import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const source = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

function createWorker() {
  const listeners = new Map();
  const entries = new Map();
  let networkResponse = new Response("working page");
  let offline = false;
  let rejectWrites = false;
  const cache = {
    put: async (request, response) => {
      if (rejectWrites) throw new Error("Storage quota exceeded");
      entries.set(typeof request === "string" ? request : request.url, response.clone());
    }
  };
  const scope = "https://example.test/kalimba/";
  runInNewContext(source, {
    self: { registration: { scope }, addEventListener: (name, handler) => listeners.set(name, handler) },
    caches: {
      open: async () => cache,
      match: async (request) => entries.get(typeof request === "string" ? request : request.url)?.clone()
    },
    fetch: async () => {
      if (offline) throw new TypeError("Offline");
      return networkResponse.clone();
    },
    URL, Request, Response,
    console: { warn() {} }
  });
  return {
    entries,
    setNetwork(response) { networkResponse = response; },
    setOffline() { offline = true; },
    rejectWrites() { rejectWrites = true; },
    async request(file, mode = "navigate") {
      const pending = [];
      let response;
      listeners.get("fetch")({
        request: { method: "GET", mode, url: new URL(file, scope).href },
        respondWith(promise) { response = promise; },
        waitUntil(promise) { pending.push(promise); }
      });
      const result = await response;
      await Promise.all(pending);
      return { response: result, pendingWrites: pending.length };
    }
  };
}

test("server errors do not replace a working offline page", async () => {
  const worker = createWorker();
  await worker.request("songs.html");
  worker.setNetwork(new Response("server unavailable", { status: 503 }));
  assert.equal((await worker.request("songs.html")).response.status, 503);
  worker.setOffline();
  assert.equal(await (await worker.request("songs.html")).response.text(), "working page");
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
