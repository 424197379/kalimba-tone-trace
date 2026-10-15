import { getSongDisplayTitle } from "../src/song-presentation.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { readSongSpeed, saveSongSpeed, readSongAccompaniment, SONG_SPEED_STORAGE_KEY, SONG_SPEED_STORAGE_PREFIX, PRACTICE_HISTORY_STORAGE_KEY } from "../src/practice-preferences.js";
import { NOTE_INDEX } from "../src/songs.js";
import * as songStore from "../src/song-store.js";

const librarySource = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const cardSource = librarySource.slice(librarySource.indexOf("function getSelectedSongId("), librarySource.indexOf("function renderLocalSongManager("));
const runtimeNames = ["setCurrentSong", "buildSongEvents", "buildAutoAccompanimentEvents", "getPracticeAccompanimentConfig",
  "getAccompanimentConfig", "getDefaultAccompanimentEnabled", "getDefaultAccompanimentVolume", "getSongVariants",
  "getPracticeAccompanimentSource", "getSongAccompanimentSignature", "restoreSongAccompaniment",
  "applySpeed", "getScaledBeatSeconds", "getSongEndSeconds", "getSongProgressDuration", "admitPracticeFrame"];
const runtimeSource = runtimeNames.map((name) => {
  const body = appSource.match(new RegExp(`^    function ${name}\\([^]*?^    \\}`, "m"));
  assert.ok(body, `Missing production runtime ${name}`);
  return body[0];
}).join("\n");

function storage(songs, raw) {
  const values = new Map();
  if (songs) values.set(SONG_SPEED_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, songs }));
  if (raw !== undefined) values.set(SONG_SPEED_STORAGE_KEY, raw);
  const writes = [];
  return { values, writes, getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { writes.push([key, value]); values.set(key, String(value)); } };
}

function libraryWith(custom = []) {
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => key === songStore.CUSTOM_SONGS_STORAGE_KEY ? JSON.stringify(custom) : null };
  try { return songStore.getSongLibrary(); }
  finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
}

function element(tag) {
  return { tag, children: [], textContent: "", className: "", attrs: {}, handlers: {}, classList: { add() {} },
    append(...children) { this.children.push(...children); },
    setAttribute(key, value) { this.attrs[key] = value; },
    addEventListener(name, handler) { this.handlers[name] = handler; } };
}
const text = (node) => [node.textContent, ...node.children.map(text)].join(" ");
const near = (actual, expected, label = "") => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} != ${expected}`);

function cards(songLibrary, store) {
  const context = { ...songStore, getSongDisplayTitle, getPracticeTotalBeats, readSongSpeed, browserPreferenceStorage: store,
    songLibrary, URLSearchParams, selectedSongOverride: null, window: { location: { search: "" } }, readStoredSongId: () => null,
    document: { createElement: element } };
  runInNewContext(cardSource, context);
  const groups = context.getGroupedSongs(Object.values(songLibrary)).filter((group) => group.practiceReady);
  return { context, groups, card: (group, selected = group.primary.id) => context.createSongCard(group, selected, group.baseSongId) };
}

// Load actual production initialization, speed restoration, support selection and
// end-clock functions. Only DOM, audio-independent rendering and selection writes
// are stubbed; expected timing is not a test reimplementation of the formula.
function runtime(songLibrary, store, { accompanimentEnabled = null } = {}) {
  const context = { ...songStore, getSongDisplayTitle, NOTE_INDEX, getPracticeTotalBeats, readSongSpeed, saveSongSpeed, readSongAccompaniment, sessionAccompanimentChoices: new Map(),
    songLibrary, browserPreferenceStorage: store, storedAccompanimentEnabled: accompanimentEnabled, storedAccompanimentVolume: null,
    speedSlider: {}, speedValue: {}, speedFactor: 1, baseFallLeadSeconds: 3.15, statusText: { textContent: "待开始" },
    practiceLoopRange: null, practiceRunning: false, demoMode: false,
    pendingPlayback: null, pausedSession: null, resumePreparation: null, lastPracticeFrameSeconds: null,
    clearPracticeInteractions() {},
    storeSongId() {}, applySongMeta() {}, renderStaticBoard() {}, resetPracticeState() {}, showKeyWidthStatus() {},
    currentPracticeTime: () => 0, shouldLoop: () => false, getSessionLeadSeconds: () => 999,
    renderBoard() {}, clamp: (value, min, max) => Math.max(min, Math.min(max, value)) };
  runInNewContext(runtimeSource, context);
  return context;
}

function durationBadge(card) {
  return card.children[0].children[1].children.find((node) => node.textContent.startsWith("练习 "));
}

function assertMatchesRuntime(library, store, requestedId, options) {
  const list = cards(library, store);
  const practiceId = songStore.getPracticeSongId(library, requestedId);
  const group = list.groups.find((candidate) => candidate.primary.id === practiceId);
  assert.ok(group, requestedId);
  const actual = runtime(library, store, options);
  actual.setCurrentSong(requestedId);
  const seconds = list.context.getSongDuration(group, actual.speedFactor);
  near(seconds, actual.getSongEndSeconds(), requestedId);
  const card = list.card(group, requestedId);
  const badge = durationBadge(card);
  const meta = card.children[0].children[1];
  assert.equal(card.children[0].children.some(node => node.tag === "details"), false, requestedId);
  assert.ok(text(meta).includes(`练习速度 ${actual.speedFactor.toFixed(2)}x · ${Math.round(actual.currentSong.bpm * actual.speedFactor)} BPM`), requestedId);
  assert.equal(badge.textContent, `练习 ${list.context.formatDuration(actual.getSongEndSeconds())}`, requestedId);
  assert.match(badge.title, /全曲一遍.*结尾休止.*0\.9 秒余音.*不含准备倒数.*循环次数/);
  return { list, group, actual, badge, seconds };
}

test("all 36 built-in cards match first practice at 1.00x without writing preferences or history", () => {
  const library = libraryWith(), store = storage(), before = JSON.stringify(library);
  const songs = songStore.getPracticeSongs(library);
  assert.equal(songs.length, 36);
  for (const song of songs) {
    const { actual } = assertMatchesRuntime(library, store, song.id);
    assert.equal(actual.speedFactor, 1, song.id);
  }
  assert.equal(JSON.stringify(library), before);
  assert.equal(store.values.size, 0);
  assert.deepEqual(store.writes, []);
});

test("all 36 built-in cards use each song's remembered slow, medium and fast speed", () => {
  const library = libraryWith();
  for (const song of songStore.getPracticeSongs(library)) {
    for (const speed of [.35, .75, 1.4]) {
      const store = storage({ [song.id]: { speed, extra: "preserve" }, unrelated: { speed: 1.1 } });
      const before = [...store.values];
      const { actual } = assertMatchesRuntime(library, store, song.id);
      assert.equal(actual.speedFactor, speed, song.id);
      assert.deepEqual([...store.values], before);
      assert.deepEqual(store.writes, []);
    }
  }
});

test("Rain card includes 0.9s ringout and rounds to 30 seconds at the real first-play speed", () => {
  const library = libraryWith(), store = storage();
  const { badge, seconds, actual } = assertMatchesRuntime(library, store, "da-yu-xiao-yu");
  assert.equal(badge.textContent, "练习 约 30 秒");
  assert.equal(actual.currentSong.defaultSpeedFactor, .9);
  near(seconds, 44 * 60 / 92 / 1 + .9);
  assert.ok(actual.pausedElapsed < -900, "the injected long preparation is outside the song end clock");
});

test("all 17 legacy chord links use canonical melody speed, ignoring stale chord-only preferences", () => {
  const library = libraryWith();
  const chords = Object.values(library).filter((song) => songStore.getSongVersionRank(song) === 1);
  assert.equal(chords.length, 17);
  for (const chord of chords) {
    const id = songStore.getPracticeSongId(library, chord.id);
    for (const canonicalSpeed of [undefined, .65]) {
      const store = storage({ [chord.id]: { speed: 1.4 }, ...(canonicalSpeed ? { [id]: { speed: canonicalSpeed } } : {}) });
      const { list, actual } = assertMatchesRuntime(library, store, chord.id);
      list.context.window.location.search = `?selected=${encodeURIComponent(chord.id)}`;
      assert.equal(list.context.getSelectedSongId(), id);
      assert.equal(actual.speedFactor, canonicalSpeed ?? 1);
      assert.deepEqual(store.writes, []);
    }
  }
});

function melody(id = "custom-duration", extra = {}) {
  const steps = [["C4", 0, 1], ["D4", 1, 1]];
  return { id, baseSongId: id, title: "Local timing", schemaVersion: 2, bpm: 120,
    arrangementKind: "melody", judgementMode: "melody", steps,
    events: steps.map(([name, beat, duration]) => ({ beat, duration, notes: [{ name, role: "melody", judge: true }] })), ...extra };
}
const backing = (end, extra = {}) => ({ enabledByDefault: true, events: [{ beat: 0, duration: end, notes: ["G3"] }], ...extra });
function sibling(song, id = `${song.id}-chord`, extra = {}) {
  return { ...song, id, schemaVersion: 2, arrangementKind: "chord", judgementMode: "chord", steps: undefined,
    events: song.steps.map(([name, beat, duration]) => ({ beat, duration,
      notes: [{ name, role: "melody", judge: true }, { name: "G3", role: "harmony", judge: true }] })), ...extra };
}

test("custom and derived legacy melody IDs keep independent speeds without rewriting stored songs", () => {
  const first = melody("local_duration-a", { source: "local" });
  const second = melody("local_duration-b", { source: "local", bpm: 60 });
  const legacy = sibling(melody("local_legacy-duration"), "local_legacy-duration_chord", { source: "local" });
  const library = libraryWith([first, second, legacy]);
  const derivedId = songStore.getPracticeSongId(library, legacy.id);
  assert.notEqual(derivedId, legacy.id);
  const store = storage({ [first.id]: { speed: .4 }, [second.id]: { speed: 1.2 }, [derivedId]: { speed: .85 }, [legacy.id]: { speed: 1.4 } });
  const before = JSON.stringify(library);
  for (const [id, speed] of [[first.id, .4], [second.id, 1.2], [legacy.id, .85]]) {
    assert.equal(assertMatchesRuntime(library, store, id).actual.speedFactor, speed);
  }
  assert.equal(JSON.stringify(library), before);
  assert.deepEqual(store.writes, []);
});

test("trailing source rests and a longer compatible initial backing span both count, even with backing muted", () => {
  const source = melody("local_source-rest", { source: "local", sourceFeatures: { sourceTotalBeats: 6 } });
  const library = libraryWith([source, sibling(source, `${source.id}-chord`, { practiceAccompaniment: backing(8) })]);
  const store = storage({ [source.id]: { speed: .5 } });
  for (const accompanimentEnabled of [false, true, null]) {
    const { seconds, actual, list, group } = assertMatchesRuntime(library, store, source.id, { accompanimentEnabled });
    near(seconds, 8.9);
    assert.equal(actual.songTotalBeats, 6);
    assert.equal(actual.accompanimentTotalBeats, 8);
    assert.equal(list.context.hasPracticeAccompaniment(group), true);
  }
  const withoutSupport = libraryWith([source]);
  near(assertMatchesRuntime(withoutSupport, store, source.id).seconds, 6.9);
  assert.deepEqual(store.writes, []);
});

test("initial support uses light-before-original and own-before-sibling precedence, not longest backing", () => {
  const cases = [
    [{ practiceAccompaniment: backing(4), autoAccompaniment: backing(20) }, { practiceAccompaniment: backing(8) }, 4],
    [{ autoAccompaniment: backing(20) }, { practiceAccompaniment: backing(6), autoAccompaniment: backing(10) }, 6],
    [{ autoAccompaniment: backing(4) }, { autoAccompaniment: backing(8) }, 4],
    [{}, { autoAccompaniment: backing(8) }, 8]
  ];
  for (const [own, other, end] of cases) {
    const source = melody("local_precedence", { source: "local", ...own });
    const library = libraryWith([source, sibling(source, `${source.id}-chord`, { ...other, practiceAccompaniment: other.practiceAccompaniment })]);
    const { actual, seconds } = assertMatchesRuntime(library, storage({ [source.id]: { speed: 1 } }), source.id);
    assert.equal(actual.accompanimentTotalBeats, end);
    near(seconds, end * .5 + .9);
  }
});

test("same-name incompatible source layers cannot extend a card or gain an accompaniment badge", () => {
  for (const alter of [
    (song) => { song.bpm = 121; },
    (song) => { song.events[1].notes[0].name = "E4"; },
    (song) => { song.events[1].beat = 1.25; },
    (song) => { song.events[1].duration = 1.5; },
    (song) => { song.sourceFeatures = { sourceTotalBeats: 4 }; }
  ]) {
    const source = melody("local_incompatible", { source: "local" });
    const chord = sibling(source, `${source.id}-chord`, { practiceAccompaniment: backing(12), autoAccompaniment: backing(20) });
    alter(chord);
    const library = libraryWith([source, chord]);
    const { actual, list, group, seconds } = assertMatchesRuntime(library, storage({ [source.id]: { speed: 1 } }), source.id);
    assert.equal(actual.accompanimentTotalBeats, 0);
    assert.equal(list.context.hasPracticeAccompaniment(group), false);
    assert.doesNotMatch(text(list.card(group)), /伴奏 有/);
    near(seconds, 1.9);
  }
});

test("legacy backing is normalized before timing; empty and unsupported events cannot extend the card", () => {
  const source = melody("local_normalized-backing", { source: "local",
    practiceAccompaniment: { events: [{ beat: 0, duration: 99, notes: ["C#4"] }] },
    autoAccompaniment: { events: [
      { beat: "3", duration: "1", notes: ["G3"] },
      { beat: 0, duration: 999, notes: [] },
      { beat: 0, duration: 999, notes: ["C#4"] },
      { beat: -1, duration: 999, notes: ["G3"] }
    ] }
  });
  const before = JSON.stringify(source), library = libraryWith([source]);
  const { actual, seconds } = assertMatchesRuntime(library, storage({ [source.id]: { speed: 1 } }), source.id);
  assert.equal(actual.accompanimentStyle, "imported-auto");
  assert.equal(actual.accompanimentEvents.length, 1);
  assert.equal(actual.accompanimentTotalBeats, 4);
  near(seconds, 2.9);
  assert.equal(JSON.stringify(source), before);
});

test("corrupt, unknown-version, invalid-record and unavailable speed storage all retain the 1.00 fallback", () => {
  const library = libraryWith();
  for (const raw of ["{", "null", "[]", "{}", ...[
    { schemaVersion: 2, songs: {} }, { schemaVersion: 1, songs: [] },
    ...[null, "0.75", { speed: "0.75" }, { speed: .751 }, { speed: 2 }]
      .map((record) => ({ schemaVersion: 1, songs: { "da-yu-xiao-yu": record } }))
  ].map(JSON.stringify)]) {
    const store = storage(null, raw);
    assert.equal(assertMatchesRuntime(library, store, "da-yu-xiao-yu").actual.speedFactor, 1);
    assert.equal(store.values.get(SONG_SPEED_STORAGE_KEY), raw);
    assert.deepEqual(store.writes, []);
  }
  let writes = 0;
  const denied = { getItem() { throw new Error("Denied"); }, setItem() { writes += 1; throw new Error("Denied"); } };
  assert.equal(assertMatchesRuntime(library, denied, "da-yu-xiao-yu").actual.speedFactor, 1);
  assert.equal(writes, 0);
});

test("returning to the library and cross-tab speed updates refresh cards without changing history", () => {
  const callbacks = new Map();
  let renders = 0;
  const listeners = librarySource.slice(librarySource.indexOf('window.addEventListener("pageshow"'), librarySource.indexOf('addSongBtn.addEventListener'));
  runInNewContext(listeners, { window: { addEventListener: (event, callback) => {
    const previous = callbacks.get(event);
    callbacks.set(event, previous ? (...args) => { previous(...args); callback(...args); } : callback);
  } },
    // This isolates card-duration listeners. Full-entry draft and navigation behavior
    // is exercised separately by test-import-draft-retention.mjs.
    restoreImportDraftAfterPageShow() {}, restoreLibraryViewAfterPageShow() {}, prepareImportDraftForLeave: () => true,
    songSearchInput: { addEventListener() {} },
    renderSongList: () => { renders += 1; }, reloadLibraryViews: () => { renders += 1; },
    CUSTOM_SONGS_STORAGE_KEY: songStore.CUSTOM_SONGS_STORAGE_KEY, SONG_SPEED_STORAGE_KEY, SONG_SPEED_STORAGE_PREFIX, PRACTICE_HISTORY_STORAGE_KEY });
  callbacks.get("pageshow")();
  callbacks.get("storage")({ key: SONG_SPEED_STORAGE_KEY });
  callbacks.get("storage")({ key: PRACTICE_HISTORY_STORAGE_KEY });
  callbacks.get("storage")({ key: SONG_SPEED_STORAGE_PREFIX + encodeURIComponent("birthday") });
  callbacks.get("storage")({ key: null });
  assert.equal(renders, 5);
  callbacks.get("storage")({ key: "unrelated" });
  callbacks.get("storage")({ key: "kalimba-song-speed-v2-unrelated" });
  callbacks.get("storage")({ key: undefined });
  assert.equal(renders, 5);
  const library = libraryWith(), store = storage();
  store.values.set(PRACTICE_HISTORY_STORAGE_KEY, '{"schemaVersion":1,"songs":{"birthday":{"lastPracticedAt":123}}}');
  const history = store.values.get(PRACTICE_HISTORY_STORAGE_KEY);
  assert.equal(assertMatchesRuntime(library, store, "da-yu-xiao-yu").badge.textContent, "练习 约 30 秒");
  store.values.set(SONG_SPEED_STORAGE_KEY, '{"schemaVersion":1,"songs":{"da-yu-xiao-yu":{"speed":1.1}}}');
  assert.equal(assertMatchesRuntime(library, store, "da-yu-xiao-yu").badge.textContent, "练习 约 27 秒");
  assert.equal(store.values.get(PRACTICE_HISTORY_STORAGE_KEY), history);
  assert.deepEqual(store.writes, []);
});

test("card and practice restore the same authoritative per-song speed without migration writes", () => {
  const library = libraryWith(), store = storage({ "da-yu-xiao-yu": { speed: .55 } });
  const key = SONG_SPEED_STORAGE_PREFIX + "da-yu-xiao-yu";
  store.values.set(key, '{"schemaVersion":2,"record":{"speed":1.1}}');
  const before = [...store.values];
  const result = assertMatchesRuntime(library, store, "da-yu-xiao-yu");
  assert.equal(result.actual.speedFactor, 1.1);
  assert.equal(result.badge.textContent, "练习 约 27 秒");
  assert.deepEqual([...store.values], before);
  assert.deepEqual(store.writes, []);
});

test("invalid authoritative per-song speeds retain runtime fallback and never use the old speed", () => {
  const library = libraryWith();
  for (const raw of ["{", '{"schemaVersion":3,"record":{"speed":1.1}}', '{"schemaVersion":2,"record":{}}']) {
    const store = storage({ "da-yu-xiao-yu": { speed: 1.1 } });
    store.values.set(SONG_SPEED_STORAGE_PREFIX + "da-yu-xiao-yu", raw);
    const before = [...store.values];
    const result = assertMatchesRuntime(library, store, "da-yu-xiao-yu");
    assert.equal(result.actual.speedFactor, 1);
    assert.equal(result.badge.textContent, "练习 约 30 秒");
    assert.deepEqual([...store.values], before);
    assert.deepEqual(store.writes, []);
  }
});

test("duration rounding stays compact at minute boundaries", () => {
  const { context } = cards(libraryWith(), storage());
  for (const [seconds, expected] of [[.9, "约 1 秒"], [59.4, "约 59 秒"], [59.5, "约 1:00"], [60, "约 1:00"], [119.5, "约 2:00"], [124, "约 2:04"]]) {
    assert.equal(context.formatDuration(seconds), expected);
  }
});

test("real external import retains its exact provider, local manager label, card duration and practice", () => {
  const imported = songStore.parseImportedSongs(JSON.stringify({ schemaVersion: 2, id: "card-import", title: "Imported card", bpm: 96,
    sourceFeatures: { sourceTotalBeats: 4 },
    events: ["E4", "F4", "G4", "C5"].map((name, beat) => ({ beat, duration: 1, notes: [{ name, role: "melody", judge: true }] })),
    autoAccompaniment: { enabledByDefault: true, volume: .72, events: [
      { beat: 0, duration: .75, notes: [{ name: "G3", role: "bass", velocity: .6 }] },
      { beat: 2, duration: .75, notes: [{ name: "C4", role: "bass", velocity: .7 }] }
    ] }
  }), {});
  const library = libraryWith(imported), store = storage();
  const { group, list, actual, seconds } = assertMatchesRuntime(library, store, imported[1].id);
  assert.equal(group.accompanimentProvider.kind, "imported-auto");
  assert.equal(group.accompanimentProvider.song.id, imported[1].id);
  assert.equal(group.initialAccompaniment, actual.getAccompanimentConfig(actual.currentSong, "imported-auto"));
  assert.equal(actual.accompanimentEnabled, false);
  assert.equal(actual.accompanimentVolume, .72);
  near(seconds, 4 * 60 / 96 / 1 + .9);
  assert.doesNotMatch(text(list.card(group)), /伴奏|轻伴奏|自动优化/);
  assert.match(text(list.context.createLocalSongItem(group)), /伴奏 导入伴奏/);
  assert.doesNotMatch(text(list.context.createLocalSongItem(group)), /轻伴奏|自动优化/);
  assert.deepEqual(store.writes, []);
});
