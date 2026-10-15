import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import * as store from "../src/song-store.js";
import * as preferences from "../src/practice-preferences.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { getSongDisplayTitle } from "../src/song-presentation.js";

// Run the complete production library entry and its actual event handlers.
// Only imports are replaced by the real repository exports. Browser APIs are
// isolated fakes; history replay checks model ordering, not native bfcache proof.
const source = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const html = await readFile(new URL("../songs.html", import.meta.url), "utf8");
const production = source.replace(/^import\s[\s\S]+?;\n/gm, "");
const hiddenIds = new Set([...html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)]
  .filter(match => /\shidden(?:\s|>)/.test(match[0])).map(match => match[1]));
const viewKey = "kalimba-library-view-v1", draftKey = "kalimba-import-draft-v1";
const defaults = { schemaVersion: 1, search: "", difficulty: "all", importPanelOpen: null };
const rawDraft = '\n {"title":"保留原稿 🪕", "unfinished": ';
const validScore = JSON.stringify({ id: "qa-view-continuity", title: "连续视图新曲", steps: [["C4", 0, 1]] });

function emitter() {
  const handlers = new Map();
  return {
    addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(fn); },
    async emit(name, event = {}) { for (const fn of handlers.get(name) || []) await fn(event); }
  };
}
function element(tag = "div") {
  let text = "";
  return { ...emitter(), tag, children: [], attrs: {}, value: "", hidden: false, disabled: false, className: "",
    classList: { add() {} }, setAttribute(key, value) { this.attrs[key] = String(value); },
    append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); },
    replaceChildren(...nodes) { this.children = nodes; }, focus() { this.focused = true; }, select() {},
    get textContent() { return text; }, set textContent(value) { text = String(value); this.children = []; }
  };
}
function storage(initial = []) {
  const records = new Map(initial), writes = [], faults = new Map();
  return { records, writes, faults, denied: false,
    getItem(key) { if (this.denied || faults.get(key) === "read") throw Error("read denied"); return records.get(key) ?? null; },
    setItem(key, value) {
      writes.push({ key, value });
      if (this.denied || faults.get(key) === "write") throw Error("quota denied");
      if (faults.get(key) !== "drop") records.set(key, String(value));
    },
    removeItem(key) {
      if (this.denied || faults.get(key) === "remove") throw Error("remove denied");
      records.delete(key);
    }
  };
}
function environment(t, session = storage()) {
  const local = storage([[store.CUSTOM_SONGS_STORAGE_KEY, "[]"], [store.CURRENT_SONG_STORAGE_KEY, "jasmine"]]);
  const navigator = { locks: { request: async (name, options, callback) => callback({ name }) } };
  const prior = ["localStorage", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries({ localStorage: local, navigator })) Object.defineProperty(globalThis, key, { configurable: true, value });
  t.after(() => { for (const [key, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  return { session, local, navigator };
}
function page(env, { session = env.session, selected = "birthday-chord" } = {}) {
  const nodes = new Map(), tasks = [], transitions = [];
  let address = `https://example.test/songs.html?selected=${selected}&keep=1#library`;
  const location = { get href() { return address; },
    set href(value) { address = new URL(value, address).href; transitions.push(address); },
    get search() { return new URL(address).search; }
  };
  const window = { ...emitter(), location, history: { state: { keep: true },
    replaceState(state, title, value) { address = new URL(value, address).href; }
  } };
  const document = { ...emitter(), createElement: element, getElementById(id) {
    if (!nodes.has(id)) { const node = element(); node.hidden = hiddenIds.has(id); nodes.set(id, node); }
    return nodes.get(id);
  } };
  const globals = { ...store, ...preferences, getSongDisplayTitle, getPracticeTotalBeats, URL, URLSearchParams,
    window, document, navigator: env.navigator, localStorage: env.local,
    requestAnimationFrame: fn => fn(), performance: { now: () => 0 },
    setTimeout(fn, ms = 0) { if (ms > 0) fn(); else tasks.push(fn); }
  };
  Object.defineProperty(globals, "sessionStorage", { get() {
    if (session.propertyDenied) throw Error("session storage unavailable"); return session;
  } });
  runInContext(production, createContext(globals), { filename: "PRODUCTION:src/song-library.js" });
  return { nodes, window, location, transitions,
    click: id => nodes.get(id).emit("click"),
    async input(id, text) { nodes.get(id).value = text; await nodes.get(id).emit("input"); },
    async difficulty(value) {
      const button = nodes.get("difficultyTabs").children.find(node => node.textContent.startsWith(`${store.DIFFICULTY_LABELS[value]} `));
      assert.ok(button && !button.disabled, "difficulty uses an enabled rendered button"); await button.emit("click");
    },
    async practice() {
      const card = nodes.get("songList").children[0]; assert.ok(card, "practice uses a rendered card");
      await card.children.find(node => node.tag === "button").emit("click");
    },
    async tasks() { for (const fn of tasks.splice(0)) fn(); await Promise.resolve(); },
    async back({ before = "", after = null, persisted = true } = {}) {
      nodes.get("songSearchInput").value = before;
      await window.emit("pageshow", { persisted });
      if (after !== null) nodes.get("songSearchInput").value = after;
      await this.tasks();
    }
  };
}
const currentView = p => ({ search: p.nodes.get("songSearchInput").value,
  difficulty: p.nodes.get("difficultyTabs").children.find(node => node.attrs["aria-pressed"] === "true")?.textContent.split(" ")[0],
  open: !p.nodes.get("importPanel").hidden });
const expectView = (p, search, difficulty, open) => assert.deepEqual(currentView(p), {
  search, difficulty: store.DIFFICULTY_LABELS[difficulty], open
});

test("empty first visit stays collapsed with no writes or selection changes", t => {
  const env = environment(t), p = page(env);
  expectView(p, "", "all", false); assert.equal(p.nodes.get("songJsonInput").value, "");
  assert.deepEqual(env.session.writes, []); assert.deepEqual(env.local.writes, []);
  const selected = p.nodes.get("songList").children.find(node => node.children[1].className.includes("accent"));
  assert.match(selected.children[1].attrs["aria-label"], /生日/);
  assert.match(p.location.search, /selected=birthday-chord/, "explicit URL remains unchanged and wins over saved jasmine");
});

test("search, difficulty and a collapsed raw draft survive practice, new document, reload and Back replay", async t => {
  const env = environment(t), p = page(env);
  await p.difficulty("easy"); await p.input("songSearchInput", " 生日 ");
  await p.click("addSongBtn"); await p.input("songJsonInput", rawDraft); await p.click("addSongBtn");
  const before = [...env.session.records]; expectView(p, " 生日 ", "easy", false);
  await p.practice(); assert.equal(p.transitions.length, 1);
  assert.match(p.transitions[0], /index\.html\?song=birthday&fromLibrary=1/);
  for (const returned of [page(env), page(env)]) {
    expectView(returned, " 生日 ", "easy", false); assert.equal(returned.nodes.get("songJsonInput").value, rawDraft);
    await returned.back({ before: "old native search", after: "later native replay", persisted: false });
    expectView(returned, " 生日 ", "easy", false); assert.equal(returned.nodes.get("songJsonInput").value, rawDraft);
  }
  await p.back({ before: "old query", after: "old replay" }); expectView(p, " 生日 ", "easy", false);
  assert.deepEqual([...env.session.records], before); assert.equal(env.local.records.get(store.CUSTOM_SONGS_STORAGE_KEY), "[]");
});

test("explicit open choice survives an empty editor while legacy drafts retain default auto-reveal", async t => {
  const env = environment(t), p = page(env); await p.click("addSongBtn");
  expectView(page(env), "", "all", true); assert.equal(env.session.records.has(draftKey), false);
  const legacy = storage([[draftKey, rawDraft]]);
  expectView(page(env, { session: legacy }), "", "all", true); assert.deepEqual(legacy.writes, []);
  const otherTab = page(env, { session: storage() }); expectView(otherTab, "", "all", false);
});

test("returning older document adopts latest same-tab view without overwriting storage", async t => {
  const env = environment(t), older = page(env); await older.difficulty("easy"); await older.input("songSearchInput", "生日");
  const newer = page(env); await newer.input("songSearchInput", ""); await newer.difficulty("hard"); await newer.input("songSearchInput", "星际");
  await newer.click("addSongBtn"); const before = [...env.session.records];
  await older.back({ after: "old historical search" }); expectView(older, "星际", "hard", true);
  assert.deepEqual([...env.session.records], before);
});

test("real search/filter/editor changes during deferred history replay take precedence", async t => {
  const env = environment(t), p = page(env); await p.window.emit("pageshow", { persisted: true });
  await p.difficulty("easy"); await p.input("songSearchInput", "生日"); await p.click("addSongBtn");
  p.nodes.get("songSearchInput").value = "native replay after the real input";
  await p.tasks(); expectView(p, "生日", "easy", true); expectView(page(env), "生日", "easy", true);
});

for (const invalid of ["{", "null", "[]", "{}", ...[
  { ...defaults, schemaVersion: 2 }, { ...defaults, search: {} }, { ...defaults, difficulty: "__proto__" },
  { ...defaults, importPanelOpen: "false" }, { schemaVersion: 1, search: "", difficulty: "all" }
].map(JSON.stringify)]) test(`malformed/future UI state remains untouched: ${invalid}`, async t => {
  const session = storage([[viewKey, invalid], [draftKey, rawDraft]]), env = environment(t, session), p = page(env);
  expectView(p, "", "all", true); await p.difficulty("easy"); await p.input("songSearchInput", "生日");
  await p.click("addSongBtn"); await p.back({ after: "native replay" }); expectView(p, "生日", "easy", false);
  assert.equal(session.records.get(viewKey), invalid); assert.equal(session.records.get(draftKey), rawDraft);
  assert.equal(session.writes.some(write => write.key === viewKey), false);
});

test("supported UI records retain unknown fields while raw draft and local data remain separate", async t => {
  const session = storage([[viewKey, JSON.stringify({ ...defaults, futureHint: { keep: 1 } })]]), env = environment(t, session), p = page(env);
  await p.input("songSearchInput", '<img src=x> 原样 🪕'); await p.click("addSongBtn"); await p.input("songJsonInput", rawDraft);
  const state = JSON.parse(session.records.get(viewKey)); assert.deepEqual(state.futureHint, { keep: 1 });
  assert.equal(state.search, '<img src=x> 原样 🪕'); assert.equal(JSON.stringify(state).includes("unfinished"), false);
  assert.equal(session.records.get(draftKey), rawDraft); assert.deepEqual(env.local.writes, []);
});

for (const fault of ["read", "write", "drop", "property"]) test(`UI storage ${fault} failure stays optional and never masks raw-draft failure`, async t => {
  const env = environment(t), p = page(env);
  if (fault === "property") env.session.propertyDenied = true; else env.session.faults.set(viewKey, fault);
  await p.difficulty("easy"); await p.input("songSearchInput", "生日");
  await p.click("addSongBtn"); await p.input("songJsonInput", rawDraft); await p.click("addSongBtn");
  if (fault !== "property") {
    assert.equal(p.nodes.get("importDraftMessage").className, "import-message neutral");
    assert.equal(env.session.records.get(draftKey), rawDraft);
    await p.back({ after: "native replay" }); expectView(p, "生日", "easy", false);
    env.session.faults.set(draftKey, "write"); await p.input("songJsonInput", `${rawDraft}later edit`);
  }
  assert.equal(p.nodes.get("importDraftMessage").className, "import-message error");
  assert.match(p.nodes.get("importDraftMessage").textContent, /无法|未.*保留/);
  await p.practice(); assert.equal(p.transitions.length, 0); assert.equal(p.nodes.get("importPanel").hidden, false);
  assert.equal(env.local.records.get(store.CURRENT_SONG_STORAGE_KEY), "jasmine");
  assert.equal(env.local.records.get(store.CUSTOM_SONGS_STORAGE_KEY), "[]");
});

test("a saved collapse never conceals a raw-draft read error on reload", async t => {
  const session = storage([[viewKey, JSON.stringify({ ...defaults, importPanelOpen: false })], [draftKey, rawDraft]]);
  session.faults.set(draftKey, "read"); const env = environment(t, session), p = page(env);
  assert.equal(p.nodes.get("importPanel").hidden, false); assert.equal(p.nodes.get("importDraftMessage").className, "import-message error");
  await p.back(); assert.equal(p.nodes.get("importPanel").hidden, false); assert.equal(session.records.get(draftKey), rawDraft);
  assert.deepEqual(session.writes, []);
});

test("empty-filter recovery persists only its intentional filter reset", async t => {
  const env = environment(t), p = page(env); await p.difficulty("hard"); await p.input("songSearchInput", "生日");
  const recovery = p.nodes.get("emptySongText").children[0]; assert.ok(recovery);
  await recovery.emit("click"); expectView(page(env), "生日", "all", false); assert.deepEqual(env.local.writes, []);
});

test("successful import keeps the existing search/filter reset and explicit panel choice across reload", async t => {
  const env = environment(t), p = page(env); await p.difficulty("hard"); await p.input("songSearchInput", "星际");
  await p.click("addSongBtn"); await p.input("songJsonInput", validScore); await p.click("importSongBtn");
  assert.match(p.nodes.get("importMessage").className, /success/); expectView(page(env), "", "all", true);
  assert.equal(env.session.records.has(draftKey), false); assert.equal(JSON.parse(env.local.records.get(store.CUSTOM_SONGS_STORAGE_KEY)).length, 1);
});
