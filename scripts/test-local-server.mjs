import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire } from "node:module";
import { test } from "node:test";

const { createKalimbaServer } = createRequire(import.meta.url)("../serve-kalimba.js");

test("local server serves app resources and rejects private files and unsupported requests", async () => {
  const server = createKalimbaServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ["/", "/index.html?song=birthday", "/songs.html", "/service-worker.js", "/package.json", "/manifest.webmanifest", "/src/app.js", "/assets/samples/c4.mp3"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      assert.ok((await response.arrayBuffer()).byteLength > 0, path);
    }
    for (const path of ["/.git/config", "/AI_PROJECT.md", "/private/dev-docs/check-progress-seek-2.2.24.js", "/src/../private/test.json", "/assets/%2e%2e%5c%2e%2e%5cAGENTS.md", "/src/.hidden", "/AGENTS.md"]) {
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
