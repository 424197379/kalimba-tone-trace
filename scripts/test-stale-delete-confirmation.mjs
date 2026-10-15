import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Run these same handler assertions against a frozen old checkout with
// KALIMBA_TEST_ROOT=/absolute/old/checkout node --test scripts/test-stale-delete-confirmation.mjs.
const root = process.env.KALIMBA_TEST_ROOT
  ? pathToFileURL(`${resolve(process.env.KALIMBA_TEST_ROOT)}/`) : new URL("../", import.meta.url);
const store = await import(new URL("src/song-store.js", root));
const preferences = await import(new URL("src/practice-preferences.js", root));
const { getPracticeTotalBeats } = await import(new URL("src/practice-loop.js", root));

const librarySource = await readFile(new URL("src/song-library.js", root), "utf8");
// Older frozen targets predate the presentation module; load only exports used
// by the selected production entry, never a substitute title implementation.
const presentation = librarySource.includes('"./song-presentation.js"')
  ? await import(new URL("src/song-presentation.js", root)) : {};
const libraryHtml = await readFile(new URL("songs.html", root), "utf8");
const initiallyHiddenIds = new Set([...libraryHtml.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)]
  .filter(match => /\shidden(?:\s|>)/.test(match[0])).map(match => match[1]));
// Execute the complete production entry, including its real event listeners,
// import/delete handlers and renderers. Only browser APIs are simulated here.
const production = librarySource.replace(/^import\s[\s\S]+?;\n/gm, "");
const score = (extra = {}) => ({ id: "qa-same-source-id", title: "并页旧谱", steps: [["C4", 0, 1]], ...extra });
const backing = { enabledByDefault: false, volume: 0.3,
  events: [{ beat: 0, duration: 0.5, notes: [{ name: "G3", role: "bass", velocity: 0.32 }] }] };
const pairScore = (extra = {}) => ({ ...score(), schemaVersion: 2,
  events: [{ beat: 0, duration: 1, notes: [{ name: "C4", role: "melody", judge: true }] }],
  autoAccompaniment: backing, ...extra });
const parse = (value, existing = {}) => store.parseImportedSongs(JSON.stringify(value), existing);

function element(tag = "div") {
  let text = "";
  const classes = new Set();
  return { tag, children: [], handlers: {}, attrs: {}, hidden: false, disabled: false, value: "", className: "",
    classList: { add: value => classes.add(value) }, classes,
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, callback) { this.handlers[name] = callback; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    focus() { this.focused = true; }, select() {},
    get textContent() { return text; }, set textContent(value) { text = String(value); this.children = []; }
  };
}
const descendants = node => [node, ...node.children.flatMap(descendants)];

const restoredTestEnvironments = new WeakSet();
function environment(t, songs = []) {
  if (!restoredTestEnvironments.has(t)) {
    restoredTestEnvironments.add(t);
    const originals = ["localStorage", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    t.after(() => {
      for (const [key, previous] of originals) {
        if (previous) Object.defineProperty(globalThis, key, previous);
        else delete globalThis[key];
      }
    });
  }
  const records = new Map([[store.CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(songs)], [store.CURRENT_SONG_STORAGE_KEY, "birthday"]]);
  const writes = [];
  const lock = { held: false, requests: [], active: null, denied: false };
  const storage = {
    readFails: false, writeFails: false,
    getItem(key) { if (this.readFails && key === store.CUSTOM_SONGS_STORAGE_KEY) throw Error("read denied"); return records.get(key) ?? null; },
    setItem(key, value) {
      if (this.writeFails && key === store.CUSTOM_SONGS_STORAGE_KEY) throw Error("quota denied");
      writes.push({ key, value: String(value), lock: lock.active }); records.set(key, String(value));
    }
  };
  const navigator = { locks: { async request(name, options, callback) {
    lock.requests.push({ name, ...options });
    assert.deepEqual(options, { mode: "exclusive", ifAvailable: true }, "no indefinite waiting or hidden late commit");
    if (lock.denied) throw Error("lock denied");
    if (lock.held) return callback(null);
    if (lock.pause) await lock.pause;
    if (lock.beforeEnter) lock.beforeEnter();
    lock.held = true; lock.active = name;
    try { return await callback({ name, mode: "exclusive" }); }
    finally { lock.held = false; lock.active = null; }
  } } };
  for (const [key, value] of Object.entries({ localStorage: storage, navigator })) {
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  return { records, writes, storage, navigator, lock, raw: () => JSON.parse(records.get(store.CUSTOM_SONGS_STORAGE_KEY)) };
}

function tab(env, selected = "birthday") {
  const draftRecords = new Map();
  const sessionStorage = { getItem: key => draftRecords.get(key) ?? null, setItem: (key, value) => draftRecords.set(key, String(value)), removeItem: key => draftRecords.delete(key) };
  const nodes = new Map(), listeners = new Map(), documentListeners = new Map(), replacements = [];
  const location = { href: `http://localhost/songs.html${selected === null ? "" : `?selected=${selected}&keep=1`}#library`,
    get search() { return new URL(this.href, "http://localhost/").search; } };
  const context = createContext({ ...store, ...preferences, ...presentation, getPracticeTotalBeats, URL, URLSearchParams,
    localStorage: env.storage, sessionStorage, navigator: env.navigator, console,
    performance: { now: () => 0 }, requestAnimationFrame: callback => callback(), setTimeout: callback => callback(),
    document: { getElementById(id) {
      if (!nodes.has(id)) { const node = element(); node.hidden = initiallyHiddenIds.has(id); nodes.set(id, node); }
      return nodes.get(id);
    }, createElement: element, addEventListener(name, callback) { documentListeners.set(name, callback); } },
    window: { location, history: { state: { retained: true }, replaceState(state, title, href) { replacements.push({ state, title, href }); location.href = href; } },
      addEventListener(name, callback) {
        const prior = listeners.get(name);
        listeners.set(name, prior ? (...args) => { prior(...args); return callback(...args); } : callback);
      } }
  });
  runInContext(production, context);
  return { context, nodes, listeners, documentListeners, replacements, location,
    read: expression => runInContext(expression, context),
    async import(value) { nodes.get("songJsonInput").value = typeof value === "string" ? value : JSON.stringify(value); await nodes.get("importSongBtn").handlers.click(); },
    open(title = "并页旧谱") {
      const row = nodes.get("localSongList").children.find(row => descendants(row).some(node => node.className === "local-song-title" && node.textContent === title));
      assert.ok(row, `real displayed row exists: ${title}`);
      const button = descendants(row).find(node => node.className === "delete-song-btn");
      button.handlers.click();
      return row;
    },
    async delete(title = "并页旧谱") { this.open(title); await nodes.get("confirmDeleteBtn").handlers.click(); },
    message: () => nodes.get("importMessage").textContent,
    kind: () => nodes.get("importMessage").className,
    ids: () => Object.keys(runInContext("songLibrary", context)).filter(id => id.startsWith("local_"))
  };
}

function assertReleased(tab, env) {
  assert.equal(tab.read("importingSong"), false);
  assert.equal(tab.read("deletingSong"), false);
  assert.equal(tab.nodes.get("confirmDeleteBtn").disabled, false);
  assert.equal(tab.nodes.get("songJsonInput").disabled, false);
  assert.equal(tab.nodes.get("importSongBtn").disabled, false);
  assert.equal(tab.nodes.get("aiThinkingModal").hidden, true);
  assert.equal(env.lock.active, null);
}

function assertPreserved(tab, env, before) {
  assert.equal(tab.nodes.get("songJsonInput").value, before.input);
  assert.equal(tab.nodes.get("songSearchInput").value, before.search);
  assert.equal(tab.read("activeDifficulty"), before.difficulty);
  assert.equal(tab.read("getSelectedSongId()"), before.selection);
  assert.equal(tab.location.href, before.href);
  assert.deepEqual([...env.records], before.storage);
  assert.equal(env.writes.length, before.writes);
  assertReleased(tab, env);
}

function inputSnapshot(tab, env, input) {
  tab.nodes.get("songJsonInput").value = input;
  tab.nodes.get("songSearchInput").value = "保留搜索";
  tab.read('activeDifficulty = "hard"');
  return { input, search: "保留搜索", difficulty: "hard", selection: tab.read("getSelectedSongId()"), href: tab.location.href,
    storage: [...env.records], writes: env.writes.length };
}

function beforeConfirm(page, env) {
  return inputSnapshot(page, env, '{"unsaved":"必须保留的 JSON 草稿"}');
}
function assertDraftSelection(page, before) {
  assert.equal(page.nodes.get("songJsonInput").value, before.input);
  assert.equal(page.nodes.get("songSearchInput").value, before.search);
  assert.equal(page.read("activeDifficulty"), before.difficulty);
  assert.equal(page.read("getSelectedSongId()"), before.selection);
  assert.equal(page.location.href, before.href);
}
function assertRecheckMessage(page) {
  const visible = page.nodes.get("libraryRefreshMessage");
  assert.equal(page.nodes.get("importPanel").hidden, true, "the warning cannot depend on opening the import panel");
  assert.equal(visible.hidden, false);
  assert.match(visible.textContent, /本地.*(变化|不存在)|找不到.*本地/);
  assert.match(visible.textContent, /重新.*(检查|确认)|检查.*重新/);
}
function replaceRaw(env, songs) { env.records.set(store.CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(songs)); }
const libraryWrites = env => env.writes.filter(write => write.key === store.CUSTOM_SONGS_STORAGE_KEY);

// These are actual DOM handlers. No delete/confirmation function is mocked.
test("ordinary confirmed deletion removes all displayed versions, preserves unknown raw aliases, draft, filters and unrelated selection", async t => {
  const original = parse(pairScore()), hidden = { id: original[0].id, baseSongId: original[0].baseSongId, schemaVersion: 99, payload: { keep: "future record" } };
  const unrelated = parse(score({ id: "unrelated", title: "无关曲目" }));
  const env = environment(t, [hidden, null, 7, ...original, ...unrelated]), page = tab(env, "jasmine");
  const before = beforeConfirm(page, env);
  page.open();
  assert.match(page.nodes.get("deleteConfirmTitle").textContent, /并页旧谱/);
  assert.equal(page.nodes.get("deleteConfirmModal").hidden, false);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), [hidden, null, 7, ...unrelated]);
  assert.match(page.message(), /^已删除.*并页旧谱/); assert.match(page.kind(), /success/);
  assert.equal(libraryWrites(env).length, 1);
  assert.ok(libraryWrites(env).every(write => write.lock === "kalimba-custom-songs-write"));
  assertDraftSelection(page, before); assertReleased(page, env);
});

for (const cancel of ["button", "escape", "backdrop"]) test(`cancel via ${cancel} never writes or changes selection`, async t => {
  const env = environment(t, parse(score())), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  page.open();
  if (cancel === "button") page.nodes.get("cancelDeleteBtn").handlers.click();
  if (cancel === "escape") page.documentListeners.get("keydown")({ key: "Escape" });
  if (cancel === "backdrop") page.nodes.get("deleteConfirmModal").handlers.click({ target: page.nodes.get("deleteConfirmModal") });
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.equal(page.nodes.get("deleteConfirmModal").hidden, true);
  assertPreserved(page, env, before);
});

for (const refresh of [false, true]) for (const sameTitle of [false, true]) {
  test(`stale confirmation preserves replacement after ID reuse (storage refresh=${refresh}, same title=${sameTitle})`, async t => {
    const env = environment(t, parse(score())), a = tab(env, "jasmine"), b = tab(env);
    const original = structuredClone(env.raw()[0]), before = beforeConfirm(a, env);
    a.open();
    await b.delete();
    await b.import(score({ title: sameTitle ? "并页旧谱" : "另一首必须保留", steps: [["E4", 0, 1]] }));
    const replacement = env.raw();
    assert.equal(replacement[0].id, original.id, "test must exercise actual ID reuse");
    assert.equal(replacement[0].baseSongId, original.baseSongId);
    assert.notDeepEqual(replacement[0].steps, original.steps);
    const writes = env.writes.length, records = [...env.records];
    if (refresh) a.listeners.get("storage")({ key: store.CUSTOM_SONGS_STORAGE_KEY });
    await a.nodes.get("confirmDeleteBtn").handlers.click();
    assert.deepEqual(env.raw(), replacement, "unconfirmed replacement must survive");
    assert.deepEqual([...env.records], records); assert.equal(env.writes.length, writes);
    assertDraftSelection(a, before); assertRecheckMessage(a); assertReleased(a, env);
    // A fresh click on the newly displayed row is a new, valid confirmation.
    a.listeners.get("pageshow")({ persisted: true });
    await a.delete(replacement[0].title);
    assert.deepEqual(env.raw(), []); assert.match(a.message(), /^已删除/);
  });
}

test("opening a stale rendered row cannot silently capture newer storage beneath its old title", async t => {
  const env = environment(t, parse(score())), a = tab(env, "jasmine"), b = tab(env);
  const before = beforeConfirm(a, env);
  await b.delete();
  await b.import(score({ title: "新曲必须保留", steps: [["E4", 0, 1]] }));
  const replacement = env.raw(), writes = env.writes.length;
  a.open("并页旧谱");
  assert.match(a.nodes.get("deleteConfirmTitle").textContent, /并页旧谱/);
  await a.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), replacement); assert.equal(env.writes.length, writes);
  assertDraftSelection(a, before); assertRecheckMessage(a);
});

for (const [name, change] of [
  ["melody note", rows => { rows[0].events[0].notes[0].name = "E4"; rows[0].steps[0][0] = "E4"; }],
  ["accompaniment volume", rows => { rows.find(song => song.autoAccompaniment).autoAccompaniment.volume = 0.8; }],
  ["accompaniment note", rows => { rows.find(song => song.autoAccompaniment).autoAccompaniment.events[0].notes[0].name = "A3"; }],
  ["metadata", rows => { rows[0].sourceFeatures = { review: "changed metadata" }; }],
  ["normalization-hidden metadata", rows => { rows[0].events[0].extraAnnotation = "raw metadata must also be compared"; }],
  ["another version only", rows => { rows[1].uploader = "changed on the second version"; }],
  ["group member added", rows => { rows.push({ ...rows[1], id: `${rows[1].id}-extra` }); }],
  ["group member removed", rows => { rows.pop(); }],
  ["duplicate ID member added", rows => { rows.push({ ...rows[0], hint: "same ID, different complete record" }); }]
]) test(`same-title confirmation rejects ${name} without affecting data, draft, filter or selection`, async t => {
  const env = environment(t, parse(pairScore())), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  page.open();
  const changed = env.raw(); change(changed); replaceRaw(env, changed);
  const records = [...env.records], writes = env.writes.length;
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), changed); assert.deepEqual([...env.records], records); assert.equal(env.writes.length, writes);
  assertDraftSelection(page, before); assertRecheckMessage(page); assertReleased(page, env);
});

test("already missing target is reported as stale and never rewrites storage", async t => {
  const env = environment(t, parse(score())), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  page.open(); replaceRaw(env, []);
  const records = [...env.records];
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual([...env.records], records); assert.deepEqual(env.writes, []);
  assertDraftSelection(page, before); assertRecheckMessage(page); assertReleased(page, env);
});

test("unrelated new song and reordered JSON keys do not invalidate a confirmed unchanged group", async t => {
  const target = parse(pairScore()), env = environment(t, target), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  page.open();
  const unrelated = parse(score({ id: "other", title: "无关新曲" }));
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, nested]) => [key, reorder(nested)])) : value;
  replaceRaw(env, [...unrelated, ...reorder(target).reverse()]);
  page.listeners.get("storage")({ key: store.CUSTOM_SONGS_STORAGE_KEY });
  assert.equal(page.nodes.get("deleteConfirmModal").hidden, false);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), unrelated); assert.match(page.kind(), /success/);
  assertDraftSelection(page, before); assertReleased(page, env);
});

test("the commit comparison reads inside the acquired lock, after confirmation and any intervening storage change", async t => {
  const env = environment(t, parse(score())), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  page.open();
  const changed = env.raw(); changed[0].hint = "changed immediately before lock acquisition";
  env.lock.beforeEnter = () => replaceRaw(env, changed);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.equal(env.lock.requests.length, 1); assert.deepEqual(env.raw(), changed); assert.deepEqual(env.writes, []);
  assertDraftSelection(page, before); assertRecheckMessage(page); assertReleased(page, env);
});

for (const mode of ["busy lock", "missing locks", "denied lock", "read failure", "invalid JSON", "non-array", "write failure"]) {
  test(`deletion ${mode} fails closed and retains all user inputs and selected song`, async t => {
    t.mock.method(console, "warn", () => {});
    const target = parse(score()), env = environment(t, target), page = tab(env, target[0].id);
    page.open();
    if (mode === "busy lock") env.lock.held = true;
    if (mode === "missing locks") delete env.navigator.locks;
    if (mode === "denied lock") env.lock.denied = true;
    if (mode === "read failure") env.storage.readFails = true;
    if (mode === "invalid JSON") env.records.set(store.CUSTOM_SONGS_STORAGE_KEY, "broken-json");
    if (mode === "non-array") env.records.set(store.CUSTOM_SONGS_STORAGE_KEY, '{"unknown":"untouched"}');
    if (mode === "write failure") env.storage.writeFails = true;
    const before = beforeConfirm(page, env);
    await page.nodes.get("confirmDeleteBtn").handlers.click();
    assert.match(page.kind(), /error/); assertPreserved(page, env, before);
    const visible = page.nodes.get("libraryRefreshMessage");
    assert.equal(visible.hidden, false, "delete failures are visible with the import panel collapsed");
    assert.ok(visible.textContent.length > 0);
    if (mode === "busy lock") {
      env.lock.held = false; await Promise.resolve(); await Promise.resolve();
      assert.equal(env.writes.length, before.writes, "contention never becomes a hidden deferred delete");
    }
  });
}

for (const outcome of ["success", "stale"]) test(`an older ${outcome} result never closes or replaces a newer confirmation`, async t => {
  const target = parse(score()), other = parse(score({ id: "other", title: "后开的确认" }));
  const env = environment(t, [...target, ...other]), page = tab(env, "jasmine");
  let release;
  env.lock.pause = new Promise(resolve => { release = resolve; });
  page.open();
  const first = page.nodes.get("confirmDeleteBtn").handlers.click();
  page.open("后开的确认");
  assert.equal(page.nodes.get("deleteConfirmModal").hidden, false);
  const newTitle = page.nodes.get("deleteConfirmTitle").textContent;
  if (outcome === "stale") {
    const changed = env.raw(); changed[0].hint = "must survive"; replaceRaw(env, changed);
  }
  release(); await first;
  assert.equal(page.nodes.get("deleteConfirmModal").hidden, false);
  assert.equal(page.nodes.get("deleteConfirmTitle").textContent, newTitle);
  assert.equal(page.read("pendingDeleteBaseSongId"), other[0].baseSongId);
  assert.equal(page.nodes.get("confirmDeleteBtn").disabled, false);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.equal(env.raw().some(song => song.id === other[0].id), false);
  assert.equal(env.raw().length, outcome === "stale" ? 1 : 0);
});

test("selected-song identity is retained after content mismatch and an identical-content ABA remains indistinguishable", async t => {
  const target = parse(score()), env = environment(t, target), page = tab(env, target[0].id);
  const before = beforeConfirm(page, env);
  page.open();
  const changed = env.raw(); changed[0].hint = "changed"; replaceRaw(env, changed);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), changed); assertDraftSelection(page, before); assertRecheckMessage(page);
  // Content snapshots intentionally add no persistent generation/schema. A byte-
  // equivalent delete/reimport cannot be distinguished from the original record.
  page.listeners.get("pageshow")({ persisted: true }); page.open();
  replaceRaw(env, []); replaceRaw(env, structuredClone(changed));
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), []); assert.match(page.kind(), /success/);
});

for (const mutation of ["added", "changed", "removed"]) test(`unknown same-group raw record ${mutation} invalidates permission without deleting any record`, async t => {
  const target = parse(score()), unknown = { id: `${target[0].id}-unknown`, baseSongId: target[0].baseSongId, schemaVersion: 99, payload: { keep: "unrecognized data" } };
  const env = environment(t, mutation === "added" ? target : [...target, unknown]), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  page.open();
  const changed = env.raw();
  if (mutation === "added") changed.push(unknown);
  if (mutation === "changed") changed[1].payload.keep = "different unrecognized data";
  if (mutation === "removed") changed.pop();
  replaceRaw(env, changed);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), changed); assert.deepEqual(env.writes, []);
  assertDraftSelection(page, before); assertRecheckMessage(page); assertReleased(page, env);
});

test("unrelated unreadable records can change without blocking a valid group deletion or being rewritten", async t => {
  const target = parse(score()), unknown = { id: "other-unknown", schemaVersion: 99, opaque: [null, { __other: true }] };
  const env = environment(t, [...target, unknown]), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  page.open();
  const changed = { ...unknown, opaque: ["keep exactly", null] };
  replaceRaw(env, [...target, changed, false]);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), [changed, false]); assert.match(page.kind(), /success/);
  assertDraftSelection(page, before);
});

test("rendering never mixes a fresh raw group with a title from an older library read", async t => {
  const target = parse(score()), env = environment(t, target), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  const changed = env.raw(); changed[0].title = "新内容不可被旧标题授权"; changed[0].sourceFeatures = { changed: true };
  replaceRaw(env, changed);
  // A normal rerender is not a refresh. It must retain one coherent displayed
  // snapshot until a strict reload succeeds, including its deletion evidence.
  page.context.refreshLibraryViews();
  assert.ok(descendants(page.nodes.get("localSongList")).some(node => node.textContent === "并页旧谱"));
  page.open(); await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), changed); assert.deepEqual(env.writes, []);
  assertDraftSelection(page, before); assertRecheckMessage(page);
});

test("failed passive read retains the old dialog and snapshot; failed confirmation remains nonmutating", async t => {
  t.mock.method(console, "warn", () => {});
  const env = environment(t, parse(score())), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  page.open();
  const title = page.nodes.get("deleteConfirmTitle").textContent;
  env.storage.readFails = true;
  page.listeners.get("storage")({ key: store.CUSTOM_SONGS_STORAGE_KEY });
  assert.equal(page.nodes.get("deleteConfirmModal").hidden, false);
  assert.equal(page.nodes.get("deleteConfirmTitle").textContent, title);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assertPreserved(page, env, before); assert.match(page.message(), /无法读取原有本地曲库/);
  env.storage.readFails = false;
  page.listeners.get("pageshow")({ persisted: true });
  await page.delete();
  assert.deepEqual(env.raw(), []); assert.match(page.kind(), /success/);
});

for (const base of [" local_weird_base ", ["local_weird_base"]]) test(`legacy normalized base ${JSON.stringify(base)} uses the full original raw snapshot`, async t => {
  const raw = { id: " readable-legacy-id ", baseSongId: base, title: "并页旧谱", schemaVersion: 1, steps: [["C4", 0, 1]], retained: { source: "legacy" } };
  const env = environment(t, [raw]), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  page.open();
  const changed = env.raw(); changed[0].retained.source = "new metadata"; replaceRaw(env, changed);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), changed); assert.deepEqual(env.writes, []);
  assertDraftSelection(page, before); assertRecheckMessage(page);
});

test("legacy arrangement-only group still displays its derived melody and deletes only original stored records", async t => {
  const original = { id: "local_only_chord", baseSongId: "local_only", title: "仅存编配的旧谱", schemaVersion: 2,
    arrangementKind: "chord", judgementMode: "chord", bpm: 96, beatsPerMeasure: 4,
    events: [{ beat: 0, duration: 1, notes: [
      { name: "C4", role: "melody", judge: true }, { name: "G3", role: "bass", judge: true }
    ] }], sourceFeatures: { preserve: "original arrangement" } };
  const unknown = { id: "local_only_future", baseSongId: original.baseSongId, schemaVersion: 99, keep: true };
  const env = environment(t, [original, unknown]), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  const row = page.nodes.get("localSongList").children[0];
  assert.ok(descendants(row).some(node => node.textContent === "音符 1"), "manager keeps the legacy derived one-note melody display");
  assert.ok(descendants(row).some(node => node.attrs["aria-label"] === "练习仅存编配的旧谱"));
  assert.equal(page.read("songLibrary.local_only.steps.length"), 1);
  assert.equal(page.read("songLibrary.local_only_chord.steps.length"), 2);
  assert.equal(page.read("getCustomSongsForLibrary(songLibrary).length"), 1, "transient derived melody is not an extra saved version");
  assert.deepEqual(env.raw(), [original, unknown]); assert.deepEqual(env.writes, []);
  await page.delete(original.title);
  assert.deepEqual(env.raw(), [unknown]); assert.match(page.kind(), /success/);
  assertDraftSelection(page, before); assertReleased(page, env);
});

test("duplicate raw IDs in distinct groups cannot borrow another group's displayed title or delete that group", async t => {
  const first = { id: "shared-legacy-id", baseSongId: "group-first", title: "第一组旧谱", schemaVersion: 1, steps: [["C4", 0, 1]] };
  const second = { ...first, baseSongId: "group-second", title: "第二组必须保留", steps: [["E4", 0, 1]] };
  const env = environment(t, [first, second]), page = tab(env, "jasmine"), before = beforeConfirm(page, env);
  assert.equal(page.nodes.get("localSongList").children.length, 2);
  page.open(first.title);
  assert.match(page.nodes.get("deleteConfirmTitle").textContent, /第一组旧谱/);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), [second]); assert.match(page.message(), /已删除.*第一组旧谱/);
  assertDraftSelection(page, before); assertReleased(page, env);
});
