import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import * as store from "../src/song-store.js";
import * as preferences from "../src/practice-preferences.js";
import { getSongDisplayTitle } from "../src/song-presentation.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import {
  CUSTOM_SONGS_STORAGE_KEY, getCustomSongs, getSongLibrary, getLocalSongCopyLabel,
  getDuplicateImportNotice, parseImportedSongs, saveCustomSongs, deleteCustomSongGroup
} from "../src/song-store.js";

const librarySource = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const production = librarySource.replace(/^import\s[\s\S]+?;\n/gm, "");
const libraryHtml = await readFile(new URL("../songs.html", import.meta.url), "utf8");
const hiddenIds = new Set([...libraryHtml.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)]
  .filter(match => /\shidden(?:\s|>)/.test(match[0])).map(match => match[1]));

const score = (extra = {}) => ({ id: "personal-score", title: "自己的乐谱", bpm: 90,
  steps: [["C4", 0, 1], ["E4", 2, 1]], ...extra });
const pairScore = (extra = {}) => ({ id: "paired-score", title: "自己的双版本", schemaVersion: 2,
  events: [{ beat: 0, duration: 1, notes: [{ name: "C4", role: "melody", judge: true }] }],
  autoAccompaniment: { enabledByDefault: false, volume: 0.3,
    events: [{ beat: 0, duration: 0.5, notes: [{ name: "G3", role: "bass", velocity: 0.32 }] }] },
  sourceFeatures: { sourceTotalBeats: 3, review: { selected: "original", status: "needs-review" } },
  rhythm: { restWindows: [{ beat: 1, duration: 2, policy: "silent" }] }, ...extra });
const parse = (value) => parseImportedSongs(JSON.stringify(value), {});
const music = (song) => {
  const result = structuredClone(song);
  delete result.id; delete result.baseSongId; delete result.localImportCopyNumber;
  return result;
};

function environment(t, initial = []) {
  const originals = ["localStorage", "navigator"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  t.after(() => { for (const [key, original] of originals) {
    if (original) Object.defineProperty(globalThis, key, original);
    else delete globalThis[key];
  } });
  const records = new Map([[CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(initial)]]);
  const storage = {
    failRead: false, failWrite: false, writes: 0,
    getItem(key) { if (this.failRead) throw Error("Read denied"); return records.get(key) ?? null; },
    setItem(key, value) { if (this.failWrite) throw Error("Quota exceeded"); this.writes += 1; records.set(key, String(value)); }
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  const navigator = { locks: { async request(_name, _options, callback) { return callback({ mode: "exclusive" }); } } };
  Object.defineProperty(globalThis, "navigator", { value: navigator, configurable: true });
  return { records, storage, navigator, raw: () => JSON.parse(records.get(CUSTOM_SONGS_STORAGE_KEY)),
    save: (value) => saveCustomSongs(parseImportedSongs(JSON.stringify(value))) };
}

function element(tag = "div") {
  let content = "";
  return { tag, children: [], handlers: {}, attrs: {}, hidden: false, disabled: false, value: "", className: "",
    classList: { add() {} }, focus() {}, select() {},
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, callback) { this.handlers[name] = callback; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    get textContent() { return content; },
    set textContent(value) { content = String(value); this.children = []; },
    set innerHTML(value) { throw Error(`Untrusted HTML insertion: ${value}`); }
  };
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const textContent = node => descendants(node).map(item => item.textContent).join(" ");

function tab(env) {
  const nodes = new Map(), drafts = new Map();
  const location = { href: "http://localhost/songs.html", get search() { return new URL(this.href).search; } };
  const context = createContext({ ...store, ...preferences, getSongDisplayTitle, getPracticeTotalBeats,
    URL, URLSearchParams, console, navigator: env.navigator, localStorage: env.storage,
    sessionStorage: { getItem: key => drafts.get(key) ?? null, setItem: (key, value) => drafts.set(key, String(value)),
      removeItem: key => drafts.delete(key) },
    performance: { now: () => 0 }, requestAnimationFrame: callback => callback(), setTimeout: callback => callback(),
    document: { getElementById(id) {
      if (!nodes.has(id)) { const node = element(); node.hidden = hiddenIds.has(id); nodes.set(id, node); }
      return nodes.get(id);
    }, createElement: element, addEventListener() {} },
    window: { location, history: { state: {}, replaceState(_state, _title, url) { location.href = url; } }, addEventListener() {} }
  });
  runInContext(production, context);
  return { nodes, context,
    read: expression => runInContext(expression, context),
    async import(value) { nodes.get("songJsonInput").value = JSON.stringify(value); await nodes.get("importSongBtn").handlers.click(); },
    message: () => nodes.get("importMessage").textContent
  };
}

test("identical imports append distinct copies with a truthful notice and unchanged score data", t => {
  const env = environment(t), originalInput = score(), first = env.save(originalInput);
  const before = env.raw();
  assert.equal(getLocalSongCopyLabel(first[0]), "");
  assert.equal(getDuplicateImportNotice(first), "");
  const second = env.save(originalInput), third = env.save(originalInput);
  assert.equal(env.raw().length, 3);
  assert.deepEqual(env.raw().slice(0, 1), before, "all original stored fields remain untouched");
  assert.equal(new Set(env.raw().map(song => song.id)).size, 3);
  assert.equal(new Set(env.raw().map(song => song.baseSongId)).size, 3);
  assert.deepEqual(second.map(music), first.map(music));
  assert.deepEqual(third.map(music), first.map(music));
  assert.deepEqual(env.raw().map(getLocalSongCopyLabel), ["", "副本 2", "副本 3"]);
  assert.match(getDuplicateImportNotice(second), /1 首重复乐谱.*另存为副本.*原有歌曲未覆盖/);
  assert.equal(first[0].title, originalInput.title);
  assert.deepEqual(originalInput, score(), "parsing and saving do not mutate the caller's source");
});

test("copy metadata survives reload without renaming the title or source fields", t => {
  const env = environment(t), first = env.save(pairScore()), second = env.save(pairScore());
  const before = env.records.get(CUSTOM_SONGS_STORAGE_KEY), writes = env.storage.writes;
  const reloaded = getCustomSongs(), library = getSongLibrary();
  assert.equal(reloaded.length, 4);
  for (const song of second) {
    assert.equal(getLocalSongCopyLabel(library[song.id]), "副本 2");
    assert.equal(library[song.id].title, first[0].title);
    assert.deepEqual(library[song.id].sourceFeatures, first[0].sourceFeatures);
  }
  assert.equal(env.records.get(CUSTOM_SONGS_STORAGE_KEY), before);
  assert.equal(env.storage.writes, writes, "reading cannot persist new metadata or renumber old copies");
});

test("duplicate batch groups are counted once per song, including paired versions", t => {
  const env = environment(t), saved = env.save([pairScore(), pairScore(), pairScore()]);
  assert.equal(saved.length, 6);
  assert.deepEqual(saved.map(getLocalSongCopyLabel), ["", "", "副本 2", "副本 2", "副本 3", "副本 3"]);
  assert.match(getDuplicateImportNotice(saved), /2 首重复乐谱/);
  assert.deepEqual(saved.slice(2, 4).map(music), saved.slice(0, 2).map(music));
  assert.equal(new Set(saved.map(song => song.baseSongId)).size, 3);
});

test("commit reads the latest complete groups even when imports were parsed against a stale library", t => {
  const env = environment(t), stale = parse(pairScore()), incomingBefore = structuredClone(stale);
  const first = saveCustomSongs(stale), before = env.raw();
  const second = saveCustomSongs(stale);
  assert.deepEqual(env.raw().slice(0, 2), before);
  assert.deepEqual(stale, incomingBefore);
  assert.notEqual(second[0].id, first[0].id);
  assert.equal(second[0].baseSongId, second[1].baseSongId);
  assert.equal(getLocalSongCopyLabel(second[0]), "副本 2");
  assert.equal(getLocalSongCopyLabel(second[1]), "副本 2");
});

test("same titles and IDs with different musical or source metadata do not claim exact duplication", t => {
  const env = environment(t), original = pairScore();
  const variants = [
    { bpm: 91 }, { title: "另一标题" }, { difficulty: "hard" }, { defaultSpeedFactor: 0.7 }, { beatsPerMeasure: 3 },
    { hint: "另一个说明" },
    { events: [{ beat: 0, duration: 1, notes: [{ name: "D4", role: "melody", judge: true }] }] },
    { events: [{ beat: 0, duration: 0.5, notes: [{ name: "C4", role: "melody", judge: true }] }] },
    { events: [{ beat: 0.25, duration: 0.5, notes: [{ name: "C4", role: "melody", judge: true }] }] },
    { autoAccompaniment: { ...original.autoAccompaniment, volume: 0.4 } },
    { autoAccompaniment: { ...original.autoAccompaniment, enabledByDefault: true } },
    { autoAccompaniment: { ...original.autoAccompaniment, events: [{ beat: 0, duration: 0.5,
      notes: [{ name: "A3", role: "bass", velocity: 0.32 }] }] } },
    { sourceFeatures: { ...original.sourceFeatures, review: { selected: "another", status: "needs-review" } } },
    { sourceFeatures: { ...original.sourceFeatures, sourceTotalBeats: 4 } },
    { rhythm: { restWindows: [{ beat: 1, duration: 2, policy: "hold" }] } }
  ];
  const first = env.save(original), before = structuredClone(env.raw());
  for (const variant of variants) {
    const saved = env.save(pairScore(variant));
    assert.ok(saved.every(song => getLocalSongCopyLabel(song) === ""), JSON.stringify(variant));
    assert.equal(getDuplicateImportNotice(saved), "", JSON.stringify(variant));
    assert.notEqual(saved[0].baseSongId, first[0].baseSongId);
  }
  assert.deepEqual(env.raw().slice(0, 2), before);
});

test("group matching includes every arrangement note, not only the extracted melody", t => {
  const env = environment(t);
  const chord = (harmony) => pairScore({ events: [{ beat: 0, duration: 1,
    notes: [{ name: "C4", role: "melody", judge: true }, { name: harmony, role: "harmony", judge: false }] }] });
  const first = env.save(chord("E4")), changed = env.save(chord("G4"));
  assert.deepEqual(first[0].events, changed[0].events, "extracted melody alone is deliberately identical");
  assert.equal(getDuplicateImportNotice(changed), "");
  const repeated = env.save(chord("G4"));
  assert.deepEqual(repeated.map(getLocalSongCopyLabel), ["副本 2", "副本 2"]);
});

test("canonical object-key and record order differences do not prevent a true match", t => {
  const env = environment(t), first = env.save(pairScore());
  const reorder = value => Array.isArray(value) ? value.map(reorder)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).reverse().map(key => [key, reorder(value[key])])) : value;
  env.records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(reorder(first).reverse()));
  const rawBefore = env.raw(), second = env.save(reorder(pairScore()));
  assert.equal(getLocalSongCopyLabel(second[0]), "副本 2");
  assert.deepEqual(env.raw().slice(0, 2), rawBefore);
});

test("unknown fields and unreadable siblings in existing groups never disappear into a false exact match", t => {
  const env = environment(t), current = parse(pairScore());
  const fixtures = [
    current.map((song, index) => index ? song : { ...song, futureMetadata: { preserve: true } }),
    [...current, { id: `${current[0].baseSongId}_future`, baseSongId: current[0].baseSongId, schemaVersion: 99 }],
    [...current, { baseSongId: current[0].baseSongId, futureMusic: ["C#4"] }],
    current.map((song, index) => index ? song : { ...song, events: [...song.events,
      { beat: 10, duration: 1, notes: [{ name: "C#4", role: "melody", judge: true }] }] })
  ];
  for (const initial of fixtures) {
    env.records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(initial));
    const saved = env.save(pairScore());
    assert.equal(getDuplicateImportNotice(saved), "");
    assert.ok(saved.every(song => getLocalSongCopyLabel(song) === ""));
    assert.deepEqual(env.raw().slice(0, initial.length), initial);
  }
});

test("legacy unmarked duplicates count toward new copy numbering without being rewritten", t => {
  const first = parse(pairScore()), second = first.map(song => ({ ...song,
    id: `${song.id}_older-copy`, baseSongId: `${song.baseSongId}_older-copy` }));
  const legacy = [...first, ...second], env = environment(t, legacy);
  const saved = env.save(pairScore());
  assert.deepEqual(saved.map(getLocalSongCopyLabel), ["副本 3", "副本 3"]);
  assert.deepEqual(env.raw().slice(0, legacy.length), legacy);
  assert.ok(env.raw().slice(0, legacy.length).every(song => !Object.hasOwn(song, "localImportCopyNumber")));
});

test("deleting an earlier original or copy preserves surviving labels and monotonic new numbers", t => {
  const env = environment(t), first = env.save(score()), second = env.save(score()), third = env.save(score());
  deleteCustomSongGroup(first[0].baseSongId);
  deleteCustomSongGroup(second[0].baseSongId);
  const reloaded = getCustomSongs();
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].id, third[0].id);
  assert.equal(getLocalSongCopyLabel(reloaded[0]), "副本 3");
  assert.equal(getLocalSongCopyLabel(env.save(score())[0]), "副本 4");
});

test("deleted-number history is intentionally not retained when no numbered copies survive", t => {
  const env = environment(t), first = env.save(score()), second = env.save(score());
  deleteCustomSongGroup(second[0].baseSongId);
  assert.equal(getLocalSongCopyLabel(getCustomSongs()[0]), "");
  assert.equal(getLocalSongCopyLabel(env.save(score())[0]), "副本 2", "no separate deleted-copy ledger is created");
  assert.deepEqual(env.raw()[0], first[0]);
  assert.deepEqual([...env.records.keys()], [CUSTOM_SONGS_STORAGE_KEY]);
});

test("external and replayed copy markers cannot spoof a successful duplicate import", t => {
  const env = environment(t);
  for (const marker of [2, 999, "2", -2, 0, 1.5, true, {}, [2], null]) {
    const projected = parse(score({ localImportCopyNumber: marker }));
    assert.ok(projected.every(song => !Object.hasOwn(song, "localImportCopyNumber")));
    const replay = projected.map(song => ({ ...song, localImportCopyNumber: marker }));
    const inputBefore = structuredClone(replay);
    env.records.set(CUSTOM_SONGS_STORAGE_KEY, "[]");
    const first = saveCustomSongs(replay);
    assert.equal(getDuplicateImportNotice(first), "");
    assert.equal(getLocalSongCopyLabel(first[0]), "");
    assert.deepEqual(replay, inputBefore);
    const second = saveCustomSongs(replay);
    assert.equal(getLocalSongCopyLabel(second[0]), "副本 2", "recompute rather than trust incoming ordinal");
  }
  for (const marker of ["2", 1, -2, 2.5, NaN, Infinity, {}, null]) {
    assert.equal(getLocalSongCopyLabel({ source: "local", localImportCopyNumber: marker }), "");
  }
  assert.equal(getLocalSongCopyLabel({ source: "system", localImportCopyNumber: 2 }), "");
  assert.equal(getLocalSongCopyLabel(null), "");
});

test("failed saves leave original storage, input and copy numbers unchanged", t => {
  const env = environment(t), first = env.save(pairScore()), incoming = parse(pairScore());
  const rawBefore = env.records.get(CUSTOM_SONGS_STORAGE_KEY), inputBefore = structuredClone(incoming);
  for (const failure of ["failRead", "failWrite"]) {
    env.storage[failure] = true;
    assert.throws(() => saveCustomSongs(incoming), /无法读取|无法保存/);
    env.storage[failure] = false;
    assert.equal(env.records.get(CUSTOM_SONGS_STORAGE_KEY), rawBefore);
    assert.deepEqual(incoming, inputBefore);
    assert.deepEqual(env.raw(), first);
  }
  const saved = saveCustomSongs(incoming);
  assert.equal(getLocalSongCopyLabel(saved[0]), "副本 2", "a failed attempt consumes no number");
});

test("actual repeated-import handler displays duplicate-only card and manager badges with its success notice", async t => {
  const env = environment(t), page = tab(env), source = score({ title: "<img src=x> 原标题" });
  await page.import(source);
  assert.doesNotMatch(page.message(), /重复乐谱|另存为副本/);
  const first = structuredClone(env.raw()[0]);
  await page.import(source);
  assert.match(page.message(), /1 首重复乐谱.*另存为副本.*原有歌曲未覆盖/);
  assert.match(page.nodes.get("importMessage").className, /success/);
  assert.equal(page.nodes.get("songJsonInput").value, "");
  assert.equal(env.raw().length, 2);
  assert.deepEqual(env.raw()[0], first);
  const rows = page.nodes.get("localSongList").children;
  assert.equal(rows.length, 2);
  assert.equal(rows.filter(row => textContent(row).includes("副本 2")).length, 1);
  assert.equal(rows.every(row => descendants(row).find(node => node.className === "local-song-title")?.textContent === source.title), true);
  const cards = page.nodes.get("songList").children.filter(card => descendants(card).some(node => node.tag === "h2" && node.textContent === source.title));
  assert.equal(cards.length, 2);
  assert.equal(cards.filter(card => textContent(card).includes("副本 2")).length, 1);
  assert.equal(page.read("getSelectedSongId()"), env.raw()[1].id);
  const reloaded = tab(env);
  assert.equal(reloaded.nodes.get("localSongList").children.filter(row => textContent(row).includes("副本 2")).length, 1);
  const copyRow = reloaded.nodes.get("localSongList").children.find(row => textContent(row).includes("副本 2"));
  const remove = descendants(copyRow).find(node => node.className === "delete-song-btn");
  const beforeDelete = env.records.get(CUSTOM_SONGS_STORAGE_KEY);
  remove.handlers.click();
  assert.match(reloaded.nodes.get("deleteConfirmTitle").textContent, /原标题.*副本 2/);
  reloaded.nodes.get("cancelDeleteBtn").handlers.click();
  assert.equal(env.records.get(CUSTOM_SONGS_STORAGE_KEY), beforeDelete, "cancelling a clearly identified copy is nonmutating");
  remove.handlers.click();
  await reloaded.nodes.get("confirmDeleteBtn").handlers.click();
  assert.deepEqual(env.raw(), [first], "confirming the displayed copy deletes only that copy, preserving the original");
});

test("actual paired-version duplicate import reports one duplicate and no false musical changes", async t => {
  const env = environment(t), page = tab(env);
  await page.import(pairScore());
  const original = structuredClone(env.raw());
  await page.import(pairScore());
  assert.match(page.message(), /1 首重复乐谱/);
  assert.equal(env.raw().length, 4);
  assert.deepEqual(env.raw().slice(0, 2), original);
  assert.deepEqual(env.raw().slice(2).map(music), original.map(music));
  assert.equal(page.nodes.get("localSongList").children.length, 2);
});

test("actual duplicate import write failure keeps the draft and does not show a false success or new copy", async t => {
  const env = environment(t), page = tab(env), source = score();
  await page.import(source);
  const before = env.records.get(CUSTOM_SONGS_STORAGE_KEY);
  env.storage.failWrite = true;
  await page.import(source);
  env.storage.failWrite = false;
  assert.match(page.nodes.get("importMessage").className, /error/);
  assert.doesNotMatch(page.message(), /另存为副本|原有歌曲未覆盖/);
  assert.equal(page.nodes.get("songJsonInput").value, JSON.stringify(source));
  assert.equal(env.records.get(CUSTOM_SONGS_STORAGE_KEY), before);
  assert.equal(page.nodes.get("localSongList").children.length, 1);
  await page.import(source);
  assert.match(page.message(), /1 首重复乐谱/);
  assert.equal(getLocalSongCopyLabel(env.raw()[1]), "副本 2");
});
