import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire } from "node:module";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const { createKalimbaServer } = createRequire(import.meta.url)("../serve-kalimba.js");

test("local server serves app resources and rejects private files and unsupported requests", async () => {
  const server = createKalimbaServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const worker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
    const shell = JSON.parse(worker.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]);
    const samples = JSON.parse(worker.match(/const SAMPLE_ASSETS = (\[[\s\S]*?\]);/)[1]);
    const expectedMime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg" };
    for (const asset of [...shell, ...samples]) {
      const response = await fetch(base + asset.slice(1));
      assert.equal(response.status, 200, `precached asset must be served: ${asset}`);
      assert.equal(response.headers.get("Content-Type"), expectedMime[extname(asset) || ".html"], `MIME ${asset}`);
      assert.ok((await response.arrayBuffer()).byteLength > 0, asset);
    }
    const archive = await (await fetch(base + "/data/archives/jasmine-walter-v2.4.3.json")).json();
    assert.equal(archive.steps.length, 145);
    const oldJingle = await (await fetch(base + "/data/archives/ling-er-xiang-ding-dang-v2.4.15.json")).json();
    assert.equal(oldJingle.steps.length, 49);
    for (const path of ["/", "/index.html?song=birthday", "/songs.html", "/service-worker.js", "/package.json", "/manifest.webmanifest", "/src/app.js", "/assets/samples/c4.mp3"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.ok((await response.arrayBuffer()).byteLength > 0, path);
    }
    for (const path of ["/data/songs/jasmine.json", "/data/archives/unlisted.json", "/data/archives/qing-hua-ci-v2.4.19.json", "/data/archives/da-yu-v2.4.21.json", "/data/archives/ping-fan-zhi-lu-v2.4.23.json", "/data/archives/ju-ci-lang-de-xia-tian-v2.4.25.json", "/data/archives/xuan-cao-hua-v2.4.27.json", "/data/archives/song-bie-v2.4.28.json", "/data/archives/rang-wo-men-dang-qi-shuang-jiang-v2.4.34.json", "/data/archives/qing-cheng-shan-xia-bai-su-zhen-v2.4.35.json", "/.git/config", "/AI_PROJECT.md", "/private/dev-docs/check-progress-seek-2.2.24.js", "/src/../private/test.json", "/assets/%2e%2e%5c%2e%2e%5cAGENTS.md", "/src/.hidden", "/AGENTS.md"]) {
      assert.equal((await fetch(base + path)).status, 403, path);
    }
    const head = await fetch(base + "/src/app.js", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal((await fetch(base + "/src/missing.js")).status, 404);
    assert.equal((await fetch(base + "/%invalid")).status, 400);
    const post = await fetch(base + "/index.html", { method: "POST", body: "ignored" });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("Allow"), "GET, HEAD");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
