import { getSongDisplayTitle } from "../src/song-presentation.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import test from "node:test";
import * as store from "../src/song-store.js";
import * as preferences from "../src/practice-preferences.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";

const librarySource = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const libraryHtml = await readFile(new URL("../songs.html", import.meta.url), "utf8");
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
  const nodes = new Map(), listeners = new Map(), replacements = [];
  const location = { href: `http://localhost/songs.html${selected === null ? "" : `?selected=${selected}&keep=1`}#library`,
    get search() { return new URL(this.href, "http://localhost/").search; } };
  const context = createContext({ ...store, ...preferences, getSongDisplayTitle, getPracticeTotalBeats, URL, URLSearchParams,
    localStorage: env.storage, sessionStorage, navigator: env.navigator, console,
    performance: { now: () => 0 }, requestAnimationFrame: callback => callback(), setTimeout: callback => callback(),
    document: { getElementById(id) {
      if (!nodes.has(id)) { const node = element(); node.hidden = initiallyHiddenIds.has(id); nodes.set(id, node); }
      return nodes.get(id);
    }, createElement: element, addEventListener() {} },
    window: { location, history: { state: { retained: true }, replaceState(state, title, href) { replacements.push({ state, title, href }); location.href = href; } },
      addEventListener(name, callback) {
        const prior = listeners.get(name);
        listeners.set(name, prior ? (...args) => { prior(...args); return callback(...args); } : callback);
      } }
  });
  runInContext(production, context);
  return { context, nodes, listeners, replacements, location,
    read: expression => runInContext(expression, context),
    async import(value) { nodes.get("songJsonInput").value = typeof value === "string" ? value : JSON.stringify(value); await nodes.get("importSongBtn").handlers.click(); },
    openDelete(song) {
      const row = nodes.get("localSongList").children.find(row => descendants(row).some(node =>
        node.className === "local-song-title" && node.textContent === song.title));
      assert.ok(row, `delete uses the real rendered row: ${song.title}`);
      descendants(row).find(node => node.className === "delete-song-btn").handlers.click();
    },
    async delete(song) { this.openDelete(song); await nodes.get("confirmDeleteBtn").handlers.click(); },
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

test("actual two preopened library entries preserve both same-source imports without a storage event", async t => {
  const env = environment(t), a = tab(env), b = tab(env);
  assert.deepEqual(a.ids(), []); assert.deepEqual(b.ids(), []);
  await a.import(score());
  const original = structuredClone(env.raw()[0]);
  assert.deepEqual(b.ids(), [], "tab B deliberately retains its stale startup snapshot");
  await b.import(score({ title: "并页另一版", steps: [["E4", 0, 1]] }));
  assert.match(a.kind(), /success/); assert.match(b.kind(), /success/);
  assert.equal(env.raw().length, 2); assert.deepEqual(env.raw()[0], original);
  assert.equal(env.raw()[1].id, `${original.id}_2`); assert.notEqual(env.raw()[1].baseSongId, original.baseSongId);
  assert.deepEqual(env.raw().map(s => s.steps[0][0]), ["C4", "E4"]);
  assert.equal(b.read("getSelectedSongId()"), env.raw()[1].id);
  a.listeners.get("pageshow")({ persisted: true });
  assert.equal(a.nodes.get("localSongCountText").textContent, "2 首");
  assert.equal(a.read("getSelectedSongId()"), original.id, "another tab's current-song write cannot steal selection");
  assert.ok(env.writes.filter(w => w.key === store.CUSTOM_SONGS_STORAGE_KEY).every(w => w.lock === "kalimba-custom-songs-write"));
});

test("commit boundary rebases stale parsed melody and arrangement versions as one group", t => {
  const env = environment(t), stale = parse(pairScore()), old = store.saveCustomSongs(stale), original = structuredClone(env.raw());
  const incoming = parse(pairScore({ title: "新伴奏组" }));
  assert.equal(incoming[0].id, old[0].id);
  const saved = store.saveCustomSongs(incoming);
  assert.deepEqual(env.raw().slice(0, 2), original); assert.equal(env.raw().length, 4);
  assert.notEqual(saved[0].baseSongId, old[0].baseSongId);
  assert.equal(saved[0].id, saved[0].baseSongId); assert.equal(saved[1].baseSongId, saved[0].baseSongId);
  assert.equal(saved[1].id, `${saved[0].id}_chord`);
  assert.deepEqual(saved[1].autoAccompaniment, incoming[1].autoAccompaniment);
  assert.deepEqual(incoming, parse(pairScore({ title: "新伴奏组" })), "commit does not mutate parsed source objects");
});

test("a stale melody import cannot inherit an existing same-ID arrangement or its preferences", t => {
  const env = environment(t), old = store.saveCustomSongs(parse(pairScore()));
  preferences.saveSongSpeed(env.storage, old[0].id, 0.8);
  preferences.saveSongAccompaniment(env.storage, old[0].id, "imported-auto", "old-source-signature");
  const preferenceRecords = [...env.records].filter(([key]) => key !== store.CUSTOM_SONGS_STORAGE_KEY);
  const [fresh] = store.saveCustomSongs(parse(score({ title: "独立新旋律", steps: [["E4", 0, 1]] })));
  const library = store.getSongLibrary();
  assert.notEqual(fresh.baseSongId, old[0].baseSongId);
  assert.equal(store.getSongAccompanimentProvider(library[fresh.id], Object.values(library).filter(s => s.baseSongId === fresh.baseSongId)), null);
  assert.equal(preferences.readSongSpeed(env.storage, old[0].id).speed, 0.8);
  assert.deepEqual(preferences.readSongSpeed(env.storage, fresh.id), {});
  assert.deepEqual(preferences.readSongAccompaniment(env.storage, old[0].id, "old-source-signature"), { choice: "imported-auto" });
  assert.deepEqual(preferences.readSongAccompaniment(env.storage, fresh.id, "old-source-signature"), {});
  assert.deepEqual([...env.records].filter(([key]) => key !== store.CUSTOM_SONGS_STORAGE_KEY), preferenceRecords);
  assert.equal(library[old[1].id].baseSongId, old[0].baseSongId);
});

test("hidden future, malformed and base-only identities are reserved and preserved verbatim", t => {
  const imported = parse(score());
  for (const raw of [
    { id: imported[0].id, schemaVersion: 99, unknown: { untouched: [null, false, "value"] } },
    { id: imported[0].id, steps: [["C#4", 0, 1]], ignoredToday: true },
    { id: "unrelated-future-id", baseSongId: imported[0].baseSongId, schemaVersion: 99 },
    { baseSongId: imported[0].baseSongId, unknown: true },
    { id: `${imported[0].baseSongId}_chord`, schemaVersion: 99 }
  ]) {
    const env = environment(t, [raw, null, { id: 42 }, []]);
    const saved = store.saveCustomSongs(imported);
    assert.deepEqual(env.raw().slice(0, 4), [raw, null, { id: 42 }, []]);
    assert.notEqual(saved[0].baseSongId, imported[0].baseSongId);
  }
});

test("an arrangement-only ID collision rebases the whole group, then reserves IDs for every later batch group", t => {
  const pair = parse(pairScore()), raw = { id: pair[1].id, baseSongId: "other-hidden-group", schemaVersion: 99 };
  const env = environment(t, [raw]);
  const batch = parse([pairScore(), pairScore(), score()]);
  const saved = store.saveCustomSongs(batch);
  assert.deepEqual(env.raw()[0], raw); assert.equal(saved.length, 5);
  assert.equal(new Set(saved.map(s => s.id)).size, 5);
  assert.equal(new Set(saved.map(s => s.baseSongId)).size, 3);
  assert.notEqual(saved[0].baseSongId, pair[0].baseSongId);
  assert.equal(saved[0].baseSongId, saved[1].baseSongId);
  assert.equal(saved[2].baseSongId, saved[3].baseSongId);
});

test("fresh repeated imports and supported V1, notation, V2 wrapper batches preserve exact music", async t => {
  const env = environment(t), page = tab(env);
  const inputs = [score(), { id: "notation", title: "简谱", notation: [{ degree: 1, beat: 0, duration: 1 / 3 }, { degree: 2, beat: 2 / 3, duration: 1 / 3 }] }, pairScore({ id: "v2-source" })];
  await page.import({ songs: inputs });
  assert.match(page.kind(), /success/); assert.equal(env.raw().length, 4);
  const first = structuredClone(env.raw());
  await page.import({ songs: inputs });
  assert.equal(env.raw().length, 8); assert.deepEqual(env.raw().slice(0, 4), first);
  for (let index = 0; index < 4; index += 1) {
    assert.deepEqual(env.raw()[index + 4].steps, first[index].steps);
    assert.deepEqual(env.raw()[index + 4].events, first[index].events);
    assert.deepEqual(env.raw()[index + 4].autoAccompaniment, first[index].autoAccompaniment);
  }
});

test("two simultaneous import attempts cannot overwrite: contention retains full input and retry appends", async t => {
  const env = environment(t), a = tab(env), b = tab(env);
  const inputA = `\n${JSON.stringify(score())}\n`, inputB = `\n${JSON.stringify(score({ title: "同时另一版", steps: [["E4", 0, 1]] }))}\n`;
  await Promise.all([a.import(inputA), b.import(inputB)]);
  const failed = /error/.test(a.kind()) ? a : b;
  assert.equal(env.raw().length, 1); assert.match(failed.message(), /另一个页面.*稍后重试/);
  assert.equal(failed.nodes.get("songJsonInput").value, failed === a ? inputA : inputB);
  assertReleased(a, env); assertReleased(b, env);
  const kept = structuredClone(env.raw()[0]);
  await failed.import(failed.nodes.get("songJsonInput").value);
  assert.match(failed.kind(), /success/); assert.equal(env.raw().length, 2); assert.deepEqual(env.raw()[0], kept);
});

for (const mode of ["missing locks", "denied request", "busy lock", "read failure", "quota failure", "bad JSON", "nonarray storage", "empty storage", "future wrapper"]) {
  test(`real import failure preserves text, filters, choice and all storage: ${mode}`, async t => {
    t.mock.method(console, "warn", () => {});
    const env = environment(t, parse(score({ id: "kept" }))), page = tab(env, "jasmine");
    if (mode === "missing locks") delete env.navigator.locks;
    if (mode === "denied request") env.lock.denied = true;
    if (mode === "busy lock") env.lock.held = true;
    if (mode === "read failure") env.storage.readFails = true;
    if (mode === "quota failure") env.storage.writeFails = true;
    const broken = { "bad JSON": "{broken", "nonarray storage": "{}", "empty storage": "", "future wrapper": '{"schemaVersion":99,"songs":[]}' }[mode];
    if (broken !== undefined) env.records.set(store.CUSTOM_SONGS_STORAGE_KEY, broken);
    const input = `\n ${JSON.stringify(pairScore(), null, 2)} \n`, before = inputSnapshot(page, env, input);
    await page.nodes.get("importSongBtn").handlers.click();
    assert.match(page.kind(), /error/); assertPreserved(page, env, before);
    if (mode === "missing locks") assert.match(page.message(), /HTTPS.*localhost.*Web Locks/);
    if (mode === "busy lock") {
      const writes = env.writes.length; env.lock.held = false; await Promise.resolve(); await Promise.resolve();
      assert.equal(env.writes.length, writes, "failed ifAvailable request never writes later");
    }
  });
}

test("one invalid batch member cannot save the valid prefix or clear input", async t => {
  const env = environment(t), page = tab(env);
  const input = JSON.stringify([pairScore(), score({ title: "错误第二首", steps: [["C#4", 0, 1]] })]);
  const before = inputSnapshot(page, env, input);
  await page.nodes.get("importSongBtn").handlers.click();
  assert.match(page.message(), /第 2 首歌曲.*错误第二首.*C#4/); assertPreserved(page, env, before);
  assert.equal(env.lock.held, false);
});

test("internal commit rejects incomplete or duplicate-ID batches atomically", t => {
  const env = environment(t, parse(score({ id: "kept" }))), before = [...env.records], song = parse(score())[0];
  for (const batch of [[], null, [song, null], [song, { id: "future", schemaVersion: 99 }], [song, song]]) {
    assert.throws(() => store.saveCustomSongs(batch));
    assert.deepEqual([...env.records], before); assert.deepEqual(env.writes, []);
  }
});

test("pageshow and relevant storage refreshes preserve selection, draft, filters, URL and preferences", async t => {
  const env = environment(t), page = tab(env, null), other = tab(env);
  page.nodes.get("songJsonInput").value = "未提交 JSON 草稿";
  page.nodes.get("songJsonInput").handlers.input(); // Real typing, not silent native history replay.
  page.nodes.get("difficultyTabs").children.find(node => node.textContent.startsWith(`${store.DIFFICULTY_LABELS.hard} `)).handlers.click();
  page.nodes.get("songSearchInput").value = "并页"; page.nodes.get("songSearchInput").handlers.input();
  await other.import(score());
  const before = [...env.records], writeCount = env.writes.length, href = page.location.href;
  for (const [eventName, event] of [["storage", { key: store.CUSTOM_SONGS_STORAGE_KEY }], ["pageshow", { persisted: true }], ["storage", { key: null }]]) {
    page.listeners.get(eventName)(event);
    assert.equal(page.nodes.get("localSongCountText").textContent, "1 首");
    assert.equal(page.nodes.get("songJsonInput").value, "未提交 JSON 草稿");
    assert.equal(page.nodes.get("songSearchInput").value, "并页"); assert.equal(page.read("activeDifficulty"), "hard");
    assert.equal(page.read("getSelectedSongId()"), "birthday"); assert.equal(page.location.href, href);
    assert.deepEqual([...env.records], before); assert.equal(env.writes.length, writeCount); assert.deepEqual(page.replacements, []);
  }
  page.read('activeDifficulty = "all"'); page.nodes.get("songSearchInput").value = ""; page.context.renderSongList();
  assert.ok(descendants(page.nodes.get("songList")).some(node => node.textContent === "并页旧谱"));
  const selected = tab(env, "jasmine-chord"); selected.listeners.get("storage")({ key: store.CUSTOM_SONGS_STORAGE_KEY });
  assert.equal(selected.read("getSelectedSongId()"), "jasmine");
  const cards = page.nodes.get("songList").children;
  page.listeners.get("storage")({ key: "unrelated-storage-key" });
  assert.equal(page.nodes.get("songList").children, cards, "unrelated events do not redraw cards");
});

test("import and delete serialize through one lock in either order without stale resurrection", async t => {
  for (const order of ["import-first", "delete-first"]) {
    const env = environment(t, parse(score({ id: "existing" }))), saved = store.getCustomSongs()[0], a = tab(env), b = tab(env);
    if (order === "import-first") { await a.import(score()); await b.delete(saved); }
    else { await b.delete(saved); await a.import(score()); }
    assert.equal(env.raw().length, 1); assert.equal(env.raw()[0].title, "并页旧谱");
    assert.notEqual(env.raw()[0].id, saved.id);
    assert.ok(env.lock.requests.length >= 2); assert.equal(new Set(env.lock.requests.map(r => r.name)).size, 1);
    assert.ok(env.writes.filter(w => w.key === store.CUSTOM_SONGS_STORAGE_KEY).every(w => w.lock === "kalimba-custom-songs-write"));
  }
});

test("delete contention, absent lock and quota failure preserve the entire original library", async t => {
  for (const mode of ["busy", "missing", "quota"]) {
    const env = environment(t, parse(score())), song = store.getCustomSongs()[0], page = tab(env, song.id), before = [...env.records];
    page.nodes.get("songJsonInput").value = "keep draft";
    if (mode === "busy") env.lock.held = true;
    if (mode === "missing") delete env.navigator.locks;
    if (mode === "quota") env.storage.writeFails = true;
    await page.delete(song);
    assert.match(page.kind(), /error/); assert.deepEqual([...env.records], before); assert.deepEqual(env.writes, []);
    assert.equal(page.read("getSelectedSongId()"), song.id); assert.equal(page.nodes.get("songJsonInput").value, "keep draft");
    assert.equal(page.read("pendingDeleteBaseSongId"), null);
  }
});

test("deletion preserves unreadable raw aliases and cannot delete the other newly rebased group", async t => {
  const original = parse(pairScore()), hidden = { id: original[0].id, baseSongId: original[0].baseSongId, schemaVersion: 99, keep: true };
  const env = environment(t, [hidden, ...original]), page = tab(env);
  await page.import(pairScore({ title: "保留的新组" }));
  const newGroup = env.raw().slice(3);
  await page.delete(store.getCustomSongs().find(s => s.id === original[0].id));
  assert.deepEqual(env.raw(), [hidden, ...newGroup]);
  assert.equal(newGroup.length, 2); assert.notEqual(newGroup[0].baseSongId, original[0].baseSongId);
});


test("same-tab repeated confirms and import during deletion cannot write twice or replace the success message", async t => {
  const env = environment(t, parse(score())), song = store.getCustomSongs()[0], page = tab(env, song.id);
  page.openDelete(song);
  const first = page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.equal(page.read("deletingSong"), true);
  assert.equal(page.nodes.get("confirmDeleteBtn").disabled, true);
  assert.equal(page.nodes.get("importSongBtn").disabled, true);
  const second = page.nodes.get("confirmDeleteBtn").handlers.click();
  await page.import(score({ title: "稍后再导入" }));
  await Promise.all([first, second]);
  assert.equal(env.raw().length, 0); assert.match(page.message(), /^已删除/); assert.match(page.kind(), /success/);
  assert.equal(env.writes.filter(w => w.key === store.CUSTOM_SONGS_STORAGE_KEY).length, 1);
  assert.equal(page.nodes.get("songJsonInput").value, JSON.stringify(score({ title: "稍后再导入" })));
  assert.equal(page.read("deletingSong"), false); assert.equal(page.nodes.get("confirmDeleteBtn").disabled, false);
  assert.equal(page.nodes.get("importSongBtn").disabled, false);
});

test("confirming deletion during import is ignored safely and can be retried when the import finishes", async t => {
  const env = environment(t, parse(score({ id: "existing" }))), song = store.getCustomSongs()[0], page = tab(env);
  page.openDelete(song);
  const importing = page.import(score());
  assert.equal(page.nodes.get("confirmDeleteBtn").disabled, true);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  await importing;
  assert.match(page.kind(), /success/); assert.equal(env.raw().length, 2);
  assert.equal(page.read("pendingDeleteBaseSongId"), song.baseSongId);
  assertReleased(page, env);
  await page.nodes.get("confirmDeleteBtn").handlers.click();
  assert.equal(env.raw().length, 1); assert.notEqual(env.raw()[0].id, song.id); assert.match(page.message(), /^已删除/);
});


test("legacy stringified or trimmed base identities cannot merge an old visible score into a new import", t => {
  for (const baseSongId of [" local_qa_same_source_id ", ["local_qa_same_source_id"]]) {
    const old = { id: " old-readable-id ", baseSongId, title: "旧组仍可练习", schemaVersion: 1, steps: [["C4", 0, 1]] };
    const env = environment(t, [old]);
    const [saved] = store.saveCustomSongs(parse(score({ title: "不能覆盖旧组", steps: [["E4", 0, 1]] })));
    assert.deepEqual(env.raw()[0], old);
    assert.notEqual(saved.baseSongId, "local_qa_same_source_id");
    const library = store.getSongLibrary(), groups = store.getPracticeSongs(library).filter(song => song.source === "local");
    assert.equal(groups.length, 2);
    assert.equal(store.getPracticeSongId(library, old.id), old.id);
    assert.equal(library[old.id].baseSongId, "local_qa_same_source_id");
    assert.equal(groups.find(song => song.id === saved.id).steps[0][0], "E4");
  }
});


test("failed passive refresh keeps the last good snapshot and explicit choice through read recovery", t => {
  const saved = parse(score({ id: "read-recovery" })), env = environment(t, saved), page = tab(env, saved[0].id);
  const before = [...env.records], library = page.read("songLibrary"), href = page.location.href;
  page.nodes.get("addSongBtn").handlers.click();
  page.nodes.get("songJsonInput").value = "keep recovery draft";
  page.nodes.get("songJsonInput").handlers.input(); // Edited draft, with the add panel subsequently collapsed.
  page.nodes.get("addSongBtn").handlers.click();
  page.nodes.get("difficultyTabs").children.find(node => node.textContent.startsWith(`${store.DIFFICULTY_LABELS.hard} `)).handlers.click();
  page.nodes.get("songSearchInput").value = "keep recovery query"; page.nodes.get("songSearchInput").handlers.input();
  assert.equal(page.nodes.get("importPanel").hidden, true, "the user deliberately collapsed the safely retained draft");
  assert.ok(libraryHtml.indexOf('id="libraryRefreshMessage"') < libraryHtml.indexOf('id="importPanel"'), "refresh status is outside the collapsed import panel");
  assert.match(libraryHtml, /<p id="libraryRefreshMessage"[^>]*role="status"/);
  page.nodes.get("importMessage").textContent = "先前的导入结果";
  env.storage.readFails = true;
  for (const [event, payload] of [["pageshow", {}], ["storage", { key: store.CUSTOM_SONGS_STORAGE_KEY }]]) {
    page.listeners.get(event)(payload);
    assert.equal(page.read("songLibrary"), library); assert.equal(page.read("getSelectedSongId()"), saved[0].id);
    assert.equal(page.nodes.get("localSongCountText").textContent, "1 首");
    assert.match(page.nodes.get("libraryRefreshMessage").textContent, /暂时保留当前列表和选择/);
    assert.equal(page.nodes.get("libraryRefreshMessage").hidden, false);
    assert.equal(page.nodes.get("importPanel").hidden, true, "passive refresh preserves the explicit collapse of a safely retained draft");
    assert.equal(page.message(), "先前的导入结果");
  }
  env.storage.readFails = false; page.listeners.get("pageshow")({ persisted: true });
  assert.equal(page.nodes.get("libraryRefreshMessage").hidden, true, "clear only the recovered refresh warning");
  assert.equal(page.read("getSelectedSongId()"), saved[0].id); assert.equal(page.nodes.get("localSongCountText").textContent, "1 首");
  assert.equal(page.message(), "先前的导入结果");
  assert.equal(page.nodes.get("songJsonInput").value, "keep recovery draft");
  assert.equal(page.nodes.get("songSearchInput").value, "keep recovery query"); assert.equal(page.read("activeDifficulty"), "hard");
  assert.equal(page.location.href, href); assert.deepEqual([...env.records], before); assert.deepEqual(env.writes, []);
});

test("a local deep link temporarily unreadable on startup resolves when strict refresh succeeds", t => {
  t.mock.method(console, "warn", () => {});
  const saved = parse(score({ id: "startup-recovery" })), env = environment(t, saved);
  env.storage.readFails = true;
  const page = tab(env, saved[0].id), before = [...env.records], href = page.location.href;
  page.listeners.get("pageshow")({ persisted: false });
  assert.equal(page.read("getSelectedSongId()"), "birthday");
  env.storage.readFails = false; page.listeners.get("pageshow")({ persisted: true });
  assert.equal(page.nodes.get("libraryRefreshMessage").hidden, true, "clear only the recovered refresh warning");
  assert.equal(page.read("getSelectedSongId()"), saved[0].id); assert.equal(page.nodes.get("localSongCountText").textContent, "1 首");
  assert.equal(page.location.href, href); assert.deepEqual([...env.records], before); assert.deepEqual(env.writes, []);
});
