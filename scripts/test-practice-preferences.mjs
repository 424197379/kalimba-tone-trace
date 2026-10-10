import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import {
  KEY_WIDTH_STORAGE_KEY, LEGACY_KEY_SCALE_STORAGE_KEY, PRACTICE_HISTORY_STORAGE_KEY,
  readKeyWidth, effectiveKeyScale, saveKeyWidth, readPracticeHistory, recordPractice
} from "../src/practice-preferences.js";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const gestureSource = appSource.slice(appSource.indexOf("    function getTouchDistance("), appSource.indexOf("    function scheduleLayoutRefresh("));

function gestureHarness(store) {
  const listeners = new Map();
  const timers = new Map();
  let timerId = 0;
  const context = {
    browserPreferenceStorage: store, readKeyWidth, effectiveKeyScale, saveKeyWidth,
    clamp: (n, min, max) => Math.max(min, Math.min(max, n)), setCompactIcon() {},
    keyScaleMin: .72, keyScaleMax: 1.55, keyScale: 1, pinchStartDistance: 0, pinchStartScale: 1,
    savedKeyPitch: null, keyWidthDirty: false, keyWidthSaveTimer: 0, keyWidthStatusTimer: 0,
    boardTop: { clientWidth: 840 }, keyRow: { clientWidth: 840 }, keyScaleBtn: {},
    getComputedStyle: () => ({ paddingLeft: "0px", paddingRight: "0px", columnGap: "0px" }),
    keyWidthStatus: { classList: { toggle() {} } },
    boardShell: { addEventListener: (name, handler) => listeners.set(name, handler) },
    document: { documentElement: { style: { setProperty() {} } }, addEventListener() {} },
    window: { addEventListener() {} },
    ResizeObserver: class { observe() {} },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id)
  };
  runInNewContext(gestureSource + "\nsetupKeyScaleGesture();", context);
  return { context, fire: (name, touches) => listeners.get(name)({ touches, preventDefault() {} }) };
}

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

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
