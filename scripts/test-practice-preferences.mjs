import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import {
  KEY_WIDTH_STORAGE_KEY, LEGACY_KEY_SCALE_STORAGE_KEY, PRACTICE_HISTORY_STORAGE_KEY, SONG_SPEED_STORAGE_KEY, SONG_SPEED_STORAGE_PREFIX, SONG_ACCOMPANIMENT_STORAGE_PREFIX,
  readSongAccompaniment, saveSongAccompaniment,
  readKeyWidth, effectiveKeyScale, saveKeyWidth, readPracticeHistory, recordPractice, readSongSpeed, saveSongSpeed
} from "../src/practice-preferences.js";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const gestureSource = appSource.slice(appSource.indexOf("    function getTouchDistance("), appSource.indexOf("    function scheduleLayoutRefresh("));

function gestureHarness(store) {
  const listeners = new Map();
  const timers = new Map();
  const pageListeners = new Map();
  let resize;
  let timerId = 0;
  const context = {
    pausePractice() {},
    browserPreferenceStorage: store, readKeyWidth, effectiveKeyScale, saveKeyWidth,
    clamp: (n, min, max) => Math.max(min, Math.min(max, n)), setCompactIcon() {},
    keyScaleMin: .72, keyScaleMax: 1.55, keyScale: 1, pinchStartDistance: 0, pinchStartScale: 1,
    savedKeyPitch: null, keyWidthDirty: false, keyWidthSaveTimer: 0, keyWidthStatusTimer: 0,
    boardTop: { clientWidth: 840 }, keyRow: { clientWidth: 840 }, keyScaleBtn: {},
    getComputedStyle: () => ({ paddingLeft: "0px", paddingRight: "0px", columnGap: "0px" }),
    keyWidthStatus: { classList: { toggle() {} } },
    boardShell: { addEventListener: (name, handler) => listeners.set(name, handler) },
    document: { documentElement: { style: { setProperty() {} } }, addEventListener: (name, handler) => pageListeners.set(name, handler) },
    window: { addEventListener: (name, handler) => pageListeners.set(name, handler) },
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id)
  };
  runInNewContext(gestureSource + "\nsetupKeyScaleGesture();", context);
  return {
    context,
    fire: (name, touches) => listeners.get(name)({ touches, preventDefault() {} }),
    resize: () => resize(),
    pageEvent: name => pageListeners.get(name)(),
    flushSave: () => timers.get(context.keyWidthSaveTimer)?.()
  };
}

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

const speedKey = id => SONG_SPEED_STORAGE_PREFIX + encodeURIComponent(id);
const speedEnvelope = (speed, extra = {}) => JSON.stringify({ schemaVersion: 2, record: { ...extra, speed } });

test("song speed is absent by default, persists every supported step and normalizes floating error", () => {
  const store = storage();
  assert.deepEqual(readSongSpeed(store, "birthday"), {});
  assert.equal(store.values.size, 0);
  for (let units = 7; units <= 28; units++) {
    const speed = units / 20;
    assert.deepEqual(saveSongSpeed(store, "birthday", speed), { saved: true, speed });
    assert.deepEqual(readSongSpeed(store, "birthday"), { speed });
  }
  assert.deepEqual(saveSongSpeed(store, "birthday", .1 + .2 + .05), { saved: true, speed: .35 });
  assert.deepEqual(readSongSpeed(store, "jasmine"), {});
  assert.equal(store.values.size, 1, "repeated saves replace only this song's key");
  assert.equal(store.getItem(SONG_SPEED_STORAGE_KEY), null);
  const legacy = storage();
  legacy.setItem(SONG_SPEED_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, songs: { birthday: { speed: .1 + .2 + .05 } } }));
  assert.deepEqual(readSongSpeed(legacy, "birthday"), { speed: .35 });
  assert.equal(legacy.values.size, 1, "reading legacy does not create a new record");
});

test("new song speeds preserve exact legacy bytes and nested collision-prone metadata", () => {
  const store = storage();
  const original = { schemaVersion: 1, extra: { keep: true }, songs: {
    birthday: { speed: .65, label: "keep", schemaVersion: 77, record: "legacy metadata", extension: { enabled: true } },
    unknown: { future: "keep" }, opaque: "future record"
  } };
  const raw = JSON.stringify(original, null, 2);
  store.setItem(SONG_SPEED_STORAGE_KEY, raw);
  assert.equal(saveSongSpeed(store, "birthday", .8).saved, true);
  assert.equal(saveSongSpeed(store, "jasmine", 1.1).saved, true);
  assert.equal(store.getItem(SONG_SPEED_STORAGE_KEY), raw);
  assert.deepEqual(JSON.parse(store.getItem(speedKey("birthday"))), {
    schemaVersion: 2, record: { ...original.songs.birthday, speed: .8 }
  });
  assert.deepEqual(JSON.parse(store.getItem(speedKey("jasmine"))), { schemaVersion: 2, record: { speed: 1.1 } });
  assert.deepEqual(readSongSpeed(store, "birthday"), { speed: .8 });
  assert.deepEqual(readSongSpeed(store, "unknown"), {});
  assert.equal(saveSongSpeed(store, "unknown", .5).saved, true);
  assert.deepEqual(JSON.parse(store.getItem(speedKey("unknown"))).record, { future: "keep", speed: .5 });
  assert.equal(store.getItem(SONG_SPEED_STORAGE_KEY), raw);
  assert.equal(store.getItem(PRACTICE_HISTORY_STORAGE_KEY), null);
  assert.equal(store.getItem(KEY_WIDTH_STORAGE_KEY), null);
});

test("new envelope and nested record metadata survive later explicit saves", () => {
  const store = storage();
  const data = { schemaVersion: 2, extension: { root: true }, record: { speed: .65, extension: { nested: true }, schemaVersion: 99 } };
  store.setItem(speedKey("birthday"), JSON.stringify(data));
  assert.equal(saveSongSpeed(store, "birthday", .8).saved, true);
  assert.deepEqual(JSON.parse(store.getItem(speedKey("birthday"))), { ...data, record: { ...data.record, speed: .8 } });
  assert.equal(store.getItem(SONG_SPEED_STORAGE_KEY), null);
});

test("invalid speeds and song ids do not change any saved records", () => {
  const store = storage();
  saveSongSpeed(store, "birthday", .75);
  const before = [...store.values];
  for (const speed of [null, undefined, "0.75", NaN, Infinity, -Infinity, .3, 1.45, .751, .351, 0, -1]) {
    assert.ok(saveSongSpeed(store, "birthday", speed).error);
    assert.deepEqual([...store.values], before);
  }
  for (const id of [undefined, null, "", "   ", 123, {}, "\ud800", "\udfff"]) {
    assert.ok(readSongSpeed(store, id).error);
    assert.ok(saveSongSpeed(store, id, .75).error);
    assert.deepEqual([...store.values], before);
  }
});

test("corrupt, unknown and invalid legacy speed storage blocks first save without overwrite", () => {
  const documents = ["{", "null", "[]", "{}", ...[
    { schemaVersion: 2, songs: {} }, { schemaVersion: "1", songs: {} },
    ...[null, [], 5, "songs"].map(songs => ({ schemaVersion: 1, songs })),
    ...[null, [], "0.75", { speed: "0.75" }, { speed: null }, { speed: .751 }, { speed: 1.45 }]
      .map(record => ({ schemaVersion: 1, songs: { birthday: record } }))
  ].map(JSON.stringify)];
  for (const raw of documents) {
    const store = storage();
    store.setItem(SONG_SPEED_STORAGE_KEY, raw);
    assert.match(readSongSpeed(store, "birthday").error, /速度/);
    assert.match(saveSongSpeed(store, "birthday", .75).error, /未保存/);
    assert.deepEqual([...store.values], [[SONG_SPEED_STORAGE_KEY, raw]]);
  }
});

test("corrupt or future new speed records never fall back to legacy or get overwritten", () => {
  const documents = ["{", "null", "[]", "{}", ...[
    { schemaVersion: 1, record: { speed: .8 } }, { schemaVersion: 3, record: { speed: .8 } },
    { schemaVersion: "2", record: { speed: .8 } },
    ...[null, [], 5, "record", {}, { future: true }, { speed: "0.75" }, { speed: null }, { speed: .751 }, { speed: 1.45 }]
      .map(record => ({ schemaVersion: 2, record }))
  ].map(JSON.stringify)];
  for (const raw of documents) {
    const store = storage();
    store.setItem(SONG_SPEED_STORAGE_KEY, '{"schemaVersion":1,"songs":{"birthday":{"speed":0.65}}}');
    store.setItem(speedKey("birthday"), raw);
    const before = [...store.values];
    assert.match(readSongSpeed(store, "birthday").error, /速度/);
    assert.match(saveSongSpeed(store, "birthday", .75).error, /未保存/);
    assert.deepEqual([...store.values], before);
  }
});

test("authoritative valid new records do not read legacy, including corrupt or denied legacy", () => {
  for (const raw of [null, "{", '{"schemaVersion":9}', '{"schemaVersion":1,"songs":{"birthday":{"speed":1.4}}}']) {
    const store = storage();
    if (raw !== null) store.setItem(SONG_SPEED_STORAGE_KEY, raw);
    store.setItem(speedKey("birthday"), speedEnvelope(.7));
    const read = store.getItem;
    store.getItem = key => {
      if (key === SONG_SPEED_STORAGE_KEY) throw new Error("Legacy must not be read");
      return read(key);
    };
    assert.deepEqual(readSongSpeed(store, "birthday"), { speed: .7 });
    assert.deepEqual(saveSongSpeed(store, "birthday", .8), { saved: true, speed: .8 });
    assert.deepEqual(readSongSpeed(store, "birthday"), { speed: .8 });
    assert.equal(store.values.get(SONG_SPEED_STORAGE_KEY) ?? null, raw);
  }
});

test("encoded ids stay distinct, including inherited names, separators and Unicode", () => {
  const store = storage();
  const ids = ["__proto__", "constructor", "toString", "local_a/b", "local_a%2Fb", "local_a:b", "local_声声慢", "local_😀"];
  for (const [index, id] of ids.entries()) {
    assert.deepEqual(readSongSpeed(store, id), {});
    assert.equal(saveSongSpeed(store, id, .35 + index / 20).saved, true);
  }
  for (const [index, id] of ids.entries()) assert.deepEqual(readSongSpeed(store, id), { speed: Math.round((.35 + index / 20) * 20) / 20 });
  assert.equal(store.values.size, ids.length);
  assert.equal(store.getItem(SONG_SPEED_STORAGE_KEY), null);
});

test("unavailable storage, quota failure and readback mismatch do not claim speed was saved", () => {
  const denied = { getItem() { throw new Error("Denied"); }, setItem() { throw new Error("Denied"); } };
  assert.ok(readSongSpeed(denied, "birthday").error);
  assert.ok(saveSongSpeed(denied, "birthday", .75).error);
  const store = storage();
  saveSongSpeed(store, "birthday", .75);
  const before = [...store.values];
  store.setItem = () => { throw new Error("Quota"); };
  assert.ok(saveSongSpeed(store, "birthday", .8).error);
  assert.deepEqual([...store.values], before);
  assert.ok(saveSongSpeed({ getItem() { return null; }, setItem() {} }, "birthday", .75).error);
});

test("different-song saves touch only their key during a synthetic storage-call overlap", () => {
  // This is an operation-order unit test, not a same-event-loop browser race claim.
  // Independent-agent differential evidence is recorded in SONG_SPEED_ISOLATION.md.
  for (const existing of [false, true]) {
    const store = storage();
    const legacy = '{ "schemaVersion": 1, "songs": { "birthday": {"speed":0.55}, "jasmine": {"speed":0.6} }, "keep": true }';
    store.setItem(SONG_SPEED_STORAGE_KEY, legacy);
    if (existing) {
      saveSongSpeed(store, "birthday", .55);
      saveSongSpeed(store, "jasmine", .6);
    }
    const write = store.setItem;
    let otherResult;
    store.setItem = (key, value) => {
      if (key === speedKey("birthday")) otherResult = saveSongSpeed(store, "jasmine", 1.1);
      write(key, value);
    };
    assert.deepEqual(saveSongSpeed(store, "birthday", .8), { saved: true, speed: .8 });
    assert.deepEqual(otherResult, { saved: true, speed: 1.1 });
    assert.deepEqual(readSongSpeed(store, "birthday"), { speed: .8 });
    assert.deepEqual(readSongSpeed(store, "jasmine"), { speed: 1.1 });
    assert.equal(store.getItem(SONG_SPEED_STORAGE_KEY), legacy);
  }
});

test("old aggregate writes cannot replace an existing authoritative per-song choice", () => {
  const store = storage();
  const old = { schemaVersion: 1, songs: { birthday: { speed: .65 }, jasmine: { speed: .6 } } };
  store.setItem(SONG_SPEED_STORAGE_KEY, JSON.stringify(old));
  saveSongSpeed(store, "birthday", .8);
  store.setItem(SONG_SPEED_STORAGE_KEY, JSON.stringify({ ...old, songs: { birthday: { speed: 1.2 }, jasmine: { speed: 1.1 } } }));
  assert.deepEqual(readSongSpeed(store, "birthday"), { speed: .8 });
  assert.deepEqual(readSongSpeed(store, "jasmine"), { speed: 1.1 }, "unmigrated songs still use legacy");
  assert.equal(store.values.size, 2);
});

test("missing, valid legacy and new key widths restore without writing over legacy", () => {
  const store = storage();
  assert.deepEqual(readKeyWidth(store), {});
  for (const scale of [.72, 1, 1.55]) {
    store.setItem(LEGACY_KEY_SCALE_STORAGE_KEY, scale);
    assert.deepEqual(readKeyWidth(store), { scale });
  }
  assert.equal(saveKeyWidth(store, 35).saved, true);
  assert.deepEqual(readKeyWidth(store), { pitchCssPx: 35 });
  assert.equal(store.getItem(LEGACY_KEY_SCALE_STORAGE_KEY), "1.55");
});

test("resize and temporary bounds preserve saved pitch on return to original width", () => {
  const store = storage();
  saveKeyWidth(store, 35);
  const raw = store.getItem(KEY_WIDTH_STORAGE_KEY);
  assert.equal(effectiveKeyScale(35, 735), 1);
  assert.equal(effectiveKeyScale(35, 300), 1.55);
  assert.equal(effectiveKeyScale(35, 1600), .72);
  assert.equal(effectiveKeyScale(readKeyWidth(store).pitchCssPx, 735), 1);
  assert.equal(store.getItem(KEY_WIDTH_STORAGE_KEY), raw);
});

test("corrupt, unknown and nonnumeric widths are not reported as restored or overwritten", () => {
  const store = storage();
  for (const raw of ["{", "null", '{"schemaVersion":2,"pitchCssPx":35}', ...[null,"35",-2,0,Infinity].map(pitchCssPx => JSON.stringify({ schemaVersion:1, pitchCssPx }))]) {
    store.setItem(KEY_WIDTH_STORAGE_KEY, raw);
    assert.ok(readKeyWidth(store).error);
    assert.equal(store.getItem(KEY_WIDTH_STORAGE_KEY), raw);
  }
});

test("disabled storage, write errors and readback mismatch never claim a successful save", () => {
  const denied = { getItem() { throw new Error("Denied"); }, setItem() { throw new Error("Denied"); } };
  assert.ok(readKeyWidth(denied).error);
  assert.ok(saveKeyWidth(denied, 35).error);
  const store = storage();
  saveKeyWidth(store, 30);
  store.setItem = () => { throw new Error("Quota"); };
  assert.ok(saveKeyWidth(store, 35).error);
  assert.equal(readKeyWidth(store).pitchCssPx, 30);
  assert.ok(saveKeyWidth({ setItem() {}, getItem() { return "different"; } }, 35).error);
});

test("recent practice updates the same song and keeps unrelated and unknown records", () => {
  const store = storage();
  store.setItem(PRACTICE_HISTORY_STORAGE_KEY, JSON.stringify({ schemaVersion:1, songs:{ future:{ metadata:"keep" } } }));
  recordPractice(store, "birthday", 100);
  recordPractice(store, "jasmine", 200);
  recordPractice(store, "birthday", 300);
  const history = readPracticeHistory(store);
  assert.equal(history.records.birthday.lastPracticedAt, 300);
  assert.equal(history.records.jasmine.lastPracticedAt, 200);
  assert.equal(history.records.future, undefined);
  assert.deepEqual(JSON.parse(store.getItem(PRACTICE_HISTORY_STORAGE_KEY)).songs.future, { metadata:"keep" });
});

test("corrupt or unknown practice history is preserved when recording fails", () => {
  const store = storage();
  for (const raw of ["{", "null", '{"schemaVersion":2,"songs":{}}']) {
    store.setItem(PRACTICE_HISTORY_STORAGE_KEY, raw);
    assert.ok(readPracticeHistory(store).error);
    assert.ok(recordPractice(store, "birthday").error);
    assert.equal(store.getItem(PRACTICE_HISTORY_STORAGE_KEY), raw);
  }
});

test("history storage failure does not claim the recent-order record was saved", () => {
  const denied = { getItem() { return null; }, setItem() { throw new Error("Quota"); } };
  assert.ok(recordPractice(denied, "birthday").error);
  assert.ok(recordPractice({ setItem() {}, getItem() { return null; } }, "birthday").error);
});

test("actual pinch handlers save on finger release and ignore single-finger movement", () => {
  const store = storage();
  const gesture = gestureHarness(store);
  const pair = width => [{ clientX:0, clientY:0 }, { clientX:width, clientY:0 }];
  gesture.fire("touchstart", pair(100));
  gesture.fire("touchmove", pair(120));
  assert.equal(store.getItem(KEY_WIDTH_STORAGE_KEY), null);
  gesture.fire("touchend", []);
  assert.equal(readKeyWidth(store).pitchCssPx, 48);
  assert.equal(gesture.context.keyWidthStatus.textContent, "键宽已保存");
  gesture.fire("touchstart", pair(100).slice(0, 1));
  gesture.fire("touchmove", pair(140).slice(0, 1));
  gesture.fire("touchend", []);
  assert.equal(readKeyWidth(store).pitchCssPx, 48);
});

test("cancelled pinch flushes the final width and failures keep the current adjustment", () => {
  const store = storage();
  const gesture = gestureHarness(store);
  gesture.fire("touchstart", [{ clientX:0, clientY:0 }, { clientX:100, clientY:0 }]);
  gesture.fire("touchmove", [{ clientX:0, clientY:0 }, { clientX:90, clientY:0 }]);
  store.setItem = () => { throw new Error("Quota"); };
  gesture.fire("touchcancel", []);
  assert.equal(gesture.context.keyScale, .9);
  assert.equal(gesture.context.keyWidthDirty, true);
  assert.match(gesture.context.keyWidthStatus.textContent, /未保存/);
});

test("saved pitch accounts for key grid padding and gap without using rotated screen bounds", () => {
  const store = storage();
  const gesture = gestureHarness(store);
  gesture.context.getComputedStyle = () => ({ paddingLeft: "6px", paddingRight: "6px", columnGap: "2px" });
  gesture.fire("touchstart", [{ clientX:0, clientY:0 }, { clientX:100, clientY:0 }]);
  gesture.fire("touchmove", [{ clientX:0, clientY:0 }, { clientX:120, clientY:0 }]);
  gesture.fire("touchend", []);
  assert.equal(readKeyWidth(store).pitchCssPx, 830 * 1.2 / 21);
});

test("actual saved pinch width restores on reload and survives constrained layout changes without writes", () => {
  const store = storage();
  const pair = width => [{ clientX:0, clientY:0 }, { clientX:width, clientY:0 }];
  const first = gestureHarness(store);
  first.fire("touchstart", pair(100));
  first.fire("touchmove", pair(120));
  first.fire("touchend", []);
  const raw = store.getItem(KEY_WIDTH_STORAGE_KEY);
  const restored = gestureHarness(store);
  restored.context.restoreKeyScale();
  assert.equal(restored.context.keyScale, 1.2);
  assert.equal(restored.context.keyWidthDirty, false);
  for (const [width, scale] of [[300,1.55], [1600,.72], [840,1.2]]) {
    restored.context.keyRow.clientWidth = width;
    restored.resize();
    assert.equal(restored.context.keyScale, scale);
    assert.equal(store.getItem(KEY_WIDTH_STORAGE_KEY), raw);
    assert.equal(restored.context.keyWidthDirty, false);
  }
});

test("pending adjustment is saved by debounce, pagehide and hidden-page flush", () => {
  const pair = width => [{ clientX:0, clientY:0 }, { clientX:width, clientY:0 }];
  for (const finish of [g => g.flushSave(), g => g.pageEvent("pagehide"), g => {
    g.context.document.hidden = true;
    g.pageEvent("visibilitychange");
  }]) {
    const store = storage();
    const gesture = gestureHarness(store);
    gesture.fire("touchstart", pair(100));
    gesture.fire("touchmove", pair(90));
    finish(gesture);
    assert.equal(readKeyWidth(store).pitchCssPx, 36);
    assert.equal(gesture.context.keyWidthDirty, false);
  }
});

// Accompaniment intentionally uses independent canonical-song keys, unlike a
// shared whole-library document that can lose another tab's concurrent update.
test("song accompaniment defaults absent and round-trips only explicit light/off choices", () => {
  const store = storage();
  assert.deepEqual(readSongAccompaniment(store, "birthday", "source-a"), {});
  assert.equal(store.values.size, 0);
  assert.deepEqual(saveSongAccompaniment(store, "birthday", "light", "source-a"), { saved: true, choice: "light" });
  assert.deepEqual(readSongAccompaniment(store, "birthday", "source-a"), { choice: "light" });
  assert.deepEqual(readSongAccompaniment(store, "jasmine", "source-a"), {});
  assert.deepEqual(saveSongAccompaniment(store, "birthday", "off", null), { saved: true, choice: "off" });
  assert.deepEqual(readSongAccompaniment(store, "birthday", "new-source"), { choice: "off" });
  assert.equal(Object.hasOwn(JSON.parse(store.getItem(SONG_ACCOMPANIMENT_STORAGE_PREFIX + "birthday")), "sourceSignature"), false);
});

test("changed, missing and empty support identities cannot restore remembered light", () => {
  const store = storage();
  saveSongAccompaniment(store, "birthday", "light", "source-a");
  const raw = store.getItem(SONG_ACCOMPANIMENT_STORAGE_PREFIX + "birthday");
  for (const signature of [null, undefined, "", "source-b", {}, 1]) {
    assert.deepEqual(readSongAccompaniment(store, "birthday", signature), { choice: "off", stale: true });
    assert.equal(store.getItem(SONG_ACCOMPANIMENT_STORAGE_PREFIX + "birthday"), raw);
  }
  assert.equal(saveSongAccompaniment(store, "birthday", "light", "source-b").saved, true);
  assert.deepEqual(readSongAccompaniment(store, "birthday", "source-b"), { choice: "light" });
});

test("accompaniment never migrates or writes the legacy global enable or other preferences", () => {
  const store = storage();
  store.setItem("kalimba-accompaniment-enabled", "true");
  store.setItem("kalimba-accompaniment-volume", ".07");
  store.setItem(SONG_SPEED_STORAGE_KEY, "existing speed");
  assert.deepEqual(readSongAccompaniment(store, "birthday", "a"), {});
  saveSongAccompaniment(store, "birthday", "light", "a");
  assert.equal(store.getItem("kalimba-accompaniment-enabled"), "true");
  assert.equal(store.getItem("kalimba-accompaniment-volume"), ".07");
  assert.equal(store.getItem(SONG_SPEED_STORAGE_KEY), "existing speed");
});

test("interleaved tab writes cannot replace an unrelated song and preserve current metadata", () => {
  const store = storage();
  const key = SONG_ACCOMPANIMENT_STORAGE_PREFIX + "birthday";
  store.setItem(key, JSON.stringify({ schemaVersion: 1, choice: "off", future: { keep: true } }));
  let interleaved = false;
  const tabA = { ...store, getItem(id) {
    const value = store.getItem(id);
    if (id === key && !interleaved) {
      interleaved = true;
      assert.equal(saveSongAccompaniment(store, "see-you-again", "light", "source-b").saved, true);
    }
    return value;
  } };
  assert.equal(saveSongAccompaniment(tabA, "birthday", "light", "source-a").saved, true);
  assert.deepEqual(readSongAccompaniment(store, "see-you-again", "source-b"), { choice: "light" });
  assert.deepEqual(JSON.parse(store.getItem(key)).future, { keep: true });
  assert.deepEqual(readSongAccompaniment(store, "birthday", "source-a"), { choice: "light" });
  saveSongAccompaniment(store, "birthday", "off");
  assert.deepEqual(readSongAccompaniment(tabA, "birthday", "source-a"), { choice: "off" });
});

test("invalid accompaniment choices, signatures and ids do not write", () => {
  const store = storage();
  for (const choice of [undefined, null, "original", "true", true, "LIGHT", {}, 1]) {
    assert.ok(saveSongAccompaniment(store, "birthday", choice, "source-a").error);
  }
  for (const signature of [undefined, null, "", {}, true, 1]) {
    assert.ok(saveSongAccompaniment(store, "birthday", "light", signature).error);
  }
  for (const id of [undefined, null, "", "   ", {}, 1, "\uD800"]) {
    assert.ok(saveSongAccompaniment(store, id, "off").error);
    assert.equal(readSongAccompaniment(store, id, "a").choice, "off");
  }
  assert.equal(store.values.size, 0);
});

test("corrupt or future accompaniment records fail closed and are preserved", () => {
  const store = storage();
  const key = SONG_ACCOMPANIMENT_STORAGE_PREFIX + "birthday";
  for (const raw of ["{", "null", "[]", "{}", ...[
    { schemaVersion: 2, choice: "light", sourceSignature: "a" },
    { schemaVersion: "1", choice: "off" }, { schemaVersion: 1, choice: "original" },
    { schemaVersion: 1, choice: true }, { schemaVersion: 1, choice: "light" },
    { schemaVersion: 1, choice: "light", sourceSignature: 1 }
  ].map(JSON.stringify)]) {
    store.setItem(key, raw);
    assert.equal(readSongAccompaniment(store, "birthday", "a").choice, "off");
    assert.ok(readSongAccompaniment(store, "birthday", "a").error);
    assert.ok(saveSongAccompaniment(store, "birthday", "off").error);
    assert.equal(store.getItem(key), raw);
  }
});

test("song accompaniment keys safely encode ids and treat prototype names as ordinary ids", () => {
  const store = storage();
  for (const id of ["__proto__", "constructor", "toString", "a:b", "a%3Ab", "本地曲目"]) {
    assert.equal(saveSongAccompaniment(store, id, "light", id).saved, true);
    assert.deepEqual(readSongAccompaniment(store, id, id), { choice: "light" });
  }
  assert.equal(store.values.size, 6);
});

test("denied storage, quota and readback failure never claim accompaniment was saved", () => {
  const denied = { getItem() { throw new Error("Denied"); }, setItem() { throw new Error("Denied"); } };
  assert.equal(readSongAccompaniment(denied, "birthday", "a").choice, "off");
  assert.ok(saveSongAccompaniment(denied, "birthday", "light", "a").error);
  const store = storage();
  saveSongAccompaniment(store, "birthday", "off");
  const raw = store.getItem(SONG_ACCOMPANIMENT_STORAGE_PREFIX + "birthday");
  store.setItem = () => { throw new Error("Quota"); };
  assert.ok(saveSongAccompaniment(store, "birthday", "light", "a").error);
  assert.equal(store.getItem(SONG_ACCOMPANIMENT_STORAGE_PREFIX + "birthday"), raw);
  assert.ok(saveSongAccompaniment({ getItem: () => null, setItem() {} }, "birthday", "off").error);
});

test("imported-auto is a distinct exact-signature choice while old light and off records remain readable", () => {
  const store = storage(), key = SONG_ACCOMPANIMENT_STORAGE_PREFIX + "local-song";
  const raw = JSON.stringify({ schemaVersion: 1, choice: "light", sourceSignature: "light-v1-existing", extra: { keep: true } });
  store.setItem(key, raw);
  assert.deepEqual(readSongAccompaniment(store, "local-song", "light-v1-existing"), { choice: "light" });
  assert.equal(store.getItem(key), raw);
  assert.deepEqual(saveSongAccompaniment(store, "local-song", "imported-auto", "imported-source"), { saved: true, choice: "imported-auto" });
  assert.deepEqual(readSongAccompaniment(store, "local-song", "imported-source"), { choice: "imported-auto" });
  assert.deepEqual(readSongAccompaniment(store, "local-song", "light-v1-existing"), { choice: "off", stale: true });
  assert.deepEqual(JSON.parse(store.getItem(key)).extra, { keep: true });
  assert.deepEqual(saveSongAccompaniment(store, "local-song", "off"), { saved: true, choice: "off" });
  assert.deepEqual(readSongAccompaniment(store, "local-song", "any-new-content"), { choice: "off" });
  for (const signature of [undefined, null, "", {}, true, 1]) assert.ok(saveSongAccompaniment(store, "local-song", "imported-auto", signature).error);
  for (const record of [{ schemaVersion: 1, choice: "imported-auto" }, { schemaVersion: 1, choice: "imported-auto", sourceSignature: 1 }]) {
    store.setItem(key, JSON.stringify(record));
    assert.ok(readSongAccompaniment(store, "local-song", "a").error);
    assert.ok(saveSongAccompaniment(store, "local-song", "imported-auto", "a").error);
    assert.equal(store.getItem(key), JSON.stringify(record));
  }
});
