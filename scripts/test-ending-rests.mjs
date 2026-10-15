import assert from "node:assert/strict";
import test from "node:test";
import { readSongFiles } from "./build-song-library.mjs";
import { createLoopRange, getPracticeTotalBeats, snapLoopBoundary } from "../src/practice-loop.js";
import { getEventTotalBeats, getPracticeSongs, getSongLibrary, parseImportedSongs } from "../src/song-store.js";

const EPSILON = 1e-9;
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < EPSILON,
  `${message}: ${actual} != ${expected}`);
const sourceBounds = {
  "song-bie": [94, 96],
  "da-yu": [128, 128],
  "ling-er-xiang-ding-dang": [64, 64],
  "zhu-zhu-xia-theme": [40, 40],
  "see-you-again": [48, 48],
  "tai-yang-zhao-chang-sheng-qi": [68, 68],
  "bie-kan-wo-zhi-shi-yi-zhi-yang": [63, 63],
  "da-yu-xiao-yu": [44, 44],
  "fu-shi-shan-xia": [20, 20],
  "gao-bai-qi-qiu": [129, 132],
  "hong-yan": [96, 96],
  "jasmine": [55, 56],
  "ju-ci-lang-de-xia-tian": [32, 32],
  "jie-wang": [72, 72],
  "meng-zhong-de-hun-li": [103.5, 103.5],
  "mi-xue-bing-cheng-theme": [42, 42],
  "mo-he-wu-ting-verse": [64, 64],
  "one-summers-day": [236, 236],
  "ping-fan-zhi-lu": [64, 68],
  "qi-feng-le": [77, 80],
  "qing-cheng-shan-xia-bai-su-zhen": [120, 120],
  "qing-hua-ci": [64, 64],
  "rang-wo-men-dang-qi-shuang-jiang": [60, 60],
  "sheng-sheng-man": [192, 192],
  "tong-hua-zhen": [44, 44],
  "tong-nian": [64, 64],
  "ye-de-gang-qin-qu-wu": [129, 132],
  "xuan-cao-hua": [191, 192],
  "yun-yan-cheng-yu": [120, 124]
};
const restBeats = { "song-bie": 2, "xuan-cao-hua": 1, "ping-fan-zhi-lu": 4, "jasmine": 1, "gao-bai-qi-qiu": 3, "qi-feng-le": 3, "ye-de-gang-qin-qu-wu": 3, "yun-yan-cheng-yu": 4 };
const restSongIds = Object.keys(restBeats).sort();
const rawSongs = (await readSongFiles()).map(({ song }) => song);
globalThis.localStorage = { getItem: () => null };
const practiceSongs = getPracticeSongs(getSongLibrary());

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test("all 29 source-notated V1 bounds remain covered and cannot truncate notes", () => {
  const sources = rawSongs.filter((song) => song.schemaVersion === 1 && Object.hasOwn(song.sourceFeatures || {}, "sourceTotalBeats"));
  assert.equal(sources.length, 29);
  assert.deepEqual(sources.map(({ id }) => id).sort(), Object.keys(sourceBounds).sort());
  for (const song of sources) {
    assert.equal(song.schemaVersion, 1, song.id);
    const [expectedEventEnd, expectedSourceEnd] = sourceBounds[song.id];
    const events = song.steps.map(([name, beat, duration]) => ({ name, beat, duration }));
    near(getEventTotalBeats(events), expectedEventEnd, `${song.id}: event end`);
    assert.equal(song.sourceFeatures.sourceTotalBeats, expectedSourceEnd, song.id);
    near(getPracticeTotalBeats(events, song), expectedSourceEnd, `${song.id}: source end`);
    assert.ok(getPracticeTotalBeats(events, song) >= getEventTotalBeats(events), song.id);
  }
});

test("eight of the 36 practice songs preserve a selected melody ending rest", () => {
  assert.equal(practiceSongs.length, 36);
  const changed = [];
  for (const song of practiceSongs) {
    const before = structuredClone(song);
    deepFreeze(song);
    const eventEnd = getEventTotalBeats(song.events);
    const total = getPracticeTotalBeats(song.events, song);
    assert.ok(total >= eventEnd, song.id);
    if (total > eventEnd + EPSILON) {
      changed.push(song.id);
      assert.equal(total - eventEnd, restBeats[song.id], `${song.id}: exactly the reviewed selected-melody rest beats`);
    } else {
      near(total, eventEnd, `${song.id}: unchanged ending`);
    }
    assert.deepEqual(song, before, `${song.id}: no added attacks, rest notes, or duration edits`);
  }
  assert.deepEqual(changed.sort(), restSongIds);
});

for (const id of restSongIds) {
  test(`${id}: final phrase and loop B include all ${restBeats[id]} silent beats without adding notes`, () => {
    const song = practiceSongs.find((entry) => entry.id === id);
    const total = getPracticeTotalBeats(song.events, song);
    const eventEnd = getEventTotalBeats(song.events);
    const before = structuredClone(song.events);
    for (const position of [eventEnd, total, total + 8]) {
      const range = createLoopRange(song.events, total, position);
      assert.equal(range.endBeat, total);
      assert.ok(range.startBeat < eventEnd);
    }
    const firstPhrase = createLoopRange(song.events, total);
    assert.equal(snapLoopBoundary(song.events, total, firstPhrase, "end", total).endBeat, total);
    assert.ok(song.events.every((event) => event.beat + event.duration <= eventEnd));
    assert.deepEqual(song.events, before, "silence is a timeline interval, not a note event");
  });
}

test("arbitrary valid imported songs without source metadata preserve their event ending", () => {
  const [song] = parseImportedSongs(JSON.stringify({
    id: "ending-rest-fallback", title: "Fallback", schemaVersion: 2,
    arrangementKind: "melody", judgementMode: "melody", bpm: 90,
    events: [
      { beat: 0.25, duration: 0.5, notes: [{ name: "C4", role: "melody", judge: true }] },
      { beat: 2.75, duration: 0.75, notes: [{ name: "E4", role: "melody", judge: true }] }
    ]
  }));
  assert.equal(song.sourceFeatures, undefined);
  assert.equal(getPracticeTotalBeats(song.events, song), 3.5);
  assert.equal(getPracticeTotalBeats(song.events), 3.5);
  assert.equal(createLoopRange(song.events, getPracticeTotalBeats(song.events, song), 3.5).endBeat, 3.5);
});

test("missing, negative, nonfinite, and nonnumeric source bounds fall back to valid event end", () => {
  const events = [{ beat: 2, duration: 0.5 }, { beat: 0, duration: 4 }];
  for (const sourceTotalBeats of [undefined, null, -1, NaN, Infinity, -Infinity, "8", "", true, {}, []]) {
    assert.equal(getPracticeTotalBeats(events, { sourceFeatures: { sourceTotalBeats } }), 4);
  }
  for (const song of [undefined, null, {}, { sourceFeatures: null }]) {
    assert.equal(getPracticeTotalBeats(events, song), 4);
  }
  for (const sourceTotalBeats of [0, 2, 4, 5.5]) {
    assert.equal(getPracticeTotalBeats(events, { sourceFeatures: { sourceTotalBeats } }), Math.max(4, sourceTotalBeats));
  }
});

test("invalid events are ignored without inventing a note duration or a nonfinite ending", () => {
  const invalidEvents = [null, {}, { beat: -1, duration: 2 }, { beat: "2", duration: 1 },
    { beat: 2, duration: "1" }, { beat: 2, duration: 0 }, { beat: 2, duration: -1 },
    { beat: NaN, duration: 1 }, { beat: Infinity, duration: 1 },
    { beat: 2, duration: NaN }, { beat: 2, duration: Infinity },
    { beat: Number.MAX_VALUE, duration: Number.MAX_VALUE }];
  for (const events of [undefined, null, {}, [], invalidEvents]) {
    assert.equal(getPracticeTotalBeats(events), 0);
    assert.equal(getPracticeTotalBeats(events, { sourceFeatures: { sourceTotalBeats: 6 } }), 6);
  }
  assert.equal(getPracticeTotalBeats([...invalidEvents, { beat: 2, duration: 0.5 }]), 2.5);
  assert.equal(getPracticeTotalBeats([], { sourceFeatures: { sourceTotalBeats: 0 } }), 0);
});
