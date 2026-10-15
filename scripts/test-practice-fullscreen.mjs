import assert from "node:assert/strict";
import { test } from "node:test";
import { createPracticeFullscreen } from "../src/practice-fullscreen.js";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
function production(name) {
  const declarations = [...appSource.matchAll(/^    (?:async )?function (\w+)\(/gm)];
  const i = declarations.findIndex(d => d[1] === name);
  assert.ok(i >= 0, `Missing actual ${name}`);
  return appSource.slice(declarations[i].index, declarations[i + 1]?.index ?? appSource.length);
}

function setup({ support = true, enabled = true, state = "idle", reject = false, hanging = false } = {}) {
  const calls = [], notices = [], listeners = new Map(), attrs = {};
  let release;
  const doc = {
    fullscreenEnabled: enabled, fullscreenElement: null,
    documentElement: {},
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    exitFullscreen() { calls.push("exit"); this.fullscreenElement = null; listeners.get("fullscreenchange")?.(); return Promise.resolve(); }
  };
  if (support) doc.documentElement.requestFullscreen = options => {
    calls.push(["request", options]);
    if (reject) return Promise.reject(new Error("NotAllowedError"));
    const enter = () => { doc.fullscreenElement = doc.documentElement; listeners.get("fullscreenchange")?.(); };
    if (hanging) return new Promise(resolve => { release = () => { enter(); resolve(); }; });
    enter(); return Promise.resolve();
  };
  const button = { textContent: "", setAttribute(k, v) { attrs[k] = v; },
    addEventListener(type, fn) { listeners.set(`button:${type}`, fn); },
    removeEventListener(type) { listeners.delete(`button:${type}`); } };
  const controller = createPracticeFullscreen({ document: doc, button,
    getPlaybackState: () => state, begin(s) { calls.push(["begin", s]); state = "active"; }, notify: n => notices.push(n) });
  return { controller, doc, button, calls, notices, attrs, listeners, release: () => release(), setState: s => { state = s; } };
}

test("load and refresh do not attempt fullscreen or start playback", () => {
  const f = setup(); f.controller.refresh();
  assert.deepEqual(f.calls, []); assert.equal(f.attrs["aria-label"], "全屏开始");
});
test("explicit fullscreen start requests synchronously before beginning preparation", async () => {
  const f = setup({ hanging: true }); const result = f.controller.activate();
  assert.deepEqual(f.calls, [["request", { navigationUI: "hide" }], ["begin", "idle"]]);
  f.release(); assert.equal(await result, true); assert.equal(f.attrs["aria-label"], "退出全屏");
});
test("paused fullscreen action keeps the paused mode by delegating continuation", async () => {
  const f = setup({ state: "paused" }); assert.equal(f.attrs["aria-label"], "全屏继续");
  await f.controller.activate(); assert.deepEqual(f.calls[1], ["begin", "paused"]);
});
for (const state of ["active", "pending", "preparing"]) test(`${state} action does not start duplicate playback`, async () => {
  const f = setup({ state }); await f.controller.activate();
  assert.equal(f.calls.length, 1); assert.equal(f.attrs["aria-label"], "退出全屏");
});
test("a repeated click while request is pending begins only once", async () => {
  const f = setup({ hanging: true }); const first = f.controller.activate(); const second = f.controller.activate();
  assert.equal(first, second); assert.equal(f.calls.length, 2); f.release(); await first;
});
test("rejected fullscreen still begins exactly once, reports once and remains usable", async () => {
  const f = setup({ reject: true }); await f.controller.activate();
  assert.deepEqual(f.calls[1], ["begin", "idle"]); assert.equal(f.notices.length, 1);
  assert.equal(f.attrs["aria-label"], "全屏说明"); await f.controller.request();
  assert.equal(f.notices.length, 1); assert.equal(f.calls.length, 2);
});
for (const options of [{ support: false }, { enabled: false }]) test(`unsupported capability presents honest explanation ${JSON.stringify(options)}`, async () => {
  const f = setup(options); assert.equal(f.attrs["aria-label"], "全屏说明");
  await f.controller.activate(); assert.deepEqual(f.calls, []); assert.match(f.notices[0], /不能由网页强制隐藏/);
});
test("escape/fullscreenchange refreshes labels without automatic reentry", async () => {
  const f = setup(); await f.controller.activate(); const before = f.calls.length;
  f.doc.fullscreenElement = null; f.listeners.get("fullscreenchange")();
  assert.equal(f.attrs["aria-label"], "全屏"); assert.equal(f.calls.length, before);
});
test("normal play gesture tries once; later play after Escape honors the exit", async () => {
  const f = setup(); await f.controller.requestOnStart();
  f.doc.fullscreenElement = null; f.listeners.get("fullscreenchange")();
  await f.controller.requestOnStart();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], "request");
  assert.equal(f.calls.some(c => c[0] === "begin"), false);
});
test("explicit fullscreen action also consumes the automatic first-play attempt", async () => {
  const f = setup(); await f.controller.activate(); await f.controller.activate();
  const count = f.calls.length; await f.controller.requestOnStart();
  assert.equal(f.calls.length, count);
});
test("landscape fullscreen request followed by exit also prevents automatic reentry", async () => {
  const f = setup(); await f.controller.request();
  f.doc.fullscreenElement = null; f.listeners.get("fullscreenchange")();
  const count = f.calls.length; await f.controller.requestOnStart();
  assert.equal(f.calls.length, count);
});
test("explicit exit never restarts or pauses transport", async () => {
  const f = setup(); await f.controller.activate(); await f.controller.activate();
  assert.equal(f.calls.filter(c => Array.isArray(c) && c[0] === "begin").length, 1);
  assert.equal(f.calls.at(-1), "exit"); assert.equal(f.attrs["aria-pressed"], "false");
});
test("disposed pending request cannot produce a late page notice", async () => {
  const f = setup({ hanging: true }); const p = f.controller.activate(); f.controller.dispose(); f.release(); await p;
  assert.equal(f.listeners.has("fullscreenchange"), false); assert.equal(f.listeners.has("button:click"), false);
  assert.deepEqual(f.notices, []);
});
for (const [wrapper, target] of [["startPracticeFromGesture", "startPractice"], ["playDemoFromGesture", "playDemo"]]) {
  test(`actual ${wrapper} requests before playback without awaiting a hung API`, () => {
    const calls = [];
    const c = { fullscreenControl: { requestOnStart() { calls.push("fullscreen"); return new Promise(() => {}); } },
      shouldAutoEnterLandscapeFromLibrary: () => true, shouldUseLandscapeFullscreen: () => false,
      [target]() { calls.push(target); return "playing"; } };
    runInNewContext(production(wrapper), c);
    assert.equal(c[wrapper](), "playing"); assert.deepEqual(calls, ["fullscreen", target]);
  });
}
test("actual initial/resize layout functions only refresh state, never request fullscreen", () => {
  const calls = [];
  const c = { portraitPracticeQuery: { matches: false }, shouldAutoEnterLandscapeFromLibrary: () => true,
    setSoftwareLandscapeMode: v => calls.push(["layout", v]), scheduleLayoutRefresh() {},
    fullscreenControl: { refresh() { calls.push("refresh"); }, request() { throw new Error("unexpected automatic request"); } },
    document: { documentElement: { classList: { contains: () => false } } } };
  runInNewContext(["applyInitialLandscapeMode", "refreshLandscapeMode"].map(production).join("\n"), c);
  c.applyInitialLandscapeMode(); c.refreshLandscapeMode();
  assert.deepEqual(calls, ["refresh", ["layout", false], "refresh"]);
  assert.doesNotMatch(appSource, /scheduleLandscapeFullscreenRequest|requestFullscreenOnNextGesture|landscapeFullscreenTimer/);
});
test("actual fullscreen state treats pending and resume preparation as active", () => {
  const c = { pendingPlayback: null, resumePreparation: null, practiceRunning: false, demoMode: false, pausedSession: null };
  runInNewContext(production("getFullscreenPlaybackState"), c);
  assert.equal(c.getFullscreenPlaybackState(), "idle"); c.pausedSession = { mode: "demo", seconds: 8 };
  assert.equal(c.getFullscreenPlaybackState(), "paused");
  for (const field of ["pendingPlayback", "resumePreparation", "practiceRunning", "demoMode"]) {
    c[field] = true; assert.equal(c.getFullscreenPlaybackState(), "active"); c[field] = null;
  }
  assert.match(appSource, /begin: state => state === "paused" \? continuePractice\(\) : startPractice\(\)/);
});


test("pause feedback is an accessible track overlay with hidden-state precedence", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(html, /id="boardTop">\s*<div id="playbackNotice" class="playback-notice" role="status" aria-live="polite" hidden><\/div>/);
  const rule = css.match(/\.playback-notice \{([^}]+)\}/)[1];
  assert.match(rule, /position: absolute/);
  assert.match(rule, /max-width: calc\(100% - 16px\)/);
  assert.match(rule, /pointer-events: none/);
  assert.doesNotMatch(rule, /animation|transition/);
  assert.match(css, /\.playback-notice\[hidden\]\s*\{\s*display: none !important;/);
  assert.match(css, /\.playback-notice:not\(\[hidden\]\) \+ \.preparation-cue \{ visibility: hidden; \}/);
});


test("fullscreen is icon-only while accessible labels still describe the true state", async () => {
  const f = setup();
  assert.equal(f.button.textContent, "");
  assert.match(f.button.innerHTML, /<svg[^>]+aria-hidden="true"/);
  assert.doesNotMatch(f.button.innerHTML, /全屏|开始|继续/);
  const entry = f.button.innerHTML;
  await f.controller.activate();
  assert.equal(f.attrs["aria-label"], "退出全屏");
  assert.notEqual(f.button.innerHTML, entry);
  assert.equal(f.button.textContent, "");
});

test("practice controls keep requested icons and exact compact segment wording", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["restartBtn", "fullscreenBtn"]) {
    const body = html.match(new RegExp(`<button id="${id}"[^>]*>([\\s\\S]*?)<\\/button>`))[1];
    assert.match(body, /^<svg/);
    assert.doesNotMatch(body.replace(/<[^>]+>/g, ""), /\S/);
  }
  assert.match(html, /id="repeatBtn"[^>]*>分段练习<\/button>/);
  assert.match(html, /id="loopStartHandle"[^>]*>起<\/button>/);
  assert.match(html, /id="loopEndHandle"[^>]*>终<\/button>/);
  assert.doesNotMatch(html, /反复练这一段|>A\/B片段</);
});
