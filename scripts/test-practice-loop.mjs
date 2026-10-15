import test from "node:test";
import assert from "node:assert/strict";
import { createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats } from "../src/practice-loop.js";

const events = [0, 2, 4, 6, 8, 10, 12, 14].map((beat) => ({ beat, duration: 2 }));

test("default range starts at the previous onset and lasts at least eight beats when possible", () => {
  assert.deepEqual(createLoopRange(events, 16), { startBeat: 0, endBeat: 8 });
  assert.deepEqual(createLoopRange(events, 16, 3), { startBeat: 2, endBeat: 10 });
  assert.deepEqual(createLoopRange([{ beat: 0 }, { beat: 9 }], 12), { startBeat: 0, endBeat: 9 });
});

test("short songs and positions at or after song end produce nonempty final phrases", () => {
  assert.deepEqual(createLoopRange([{ beat: 0 }], 0.5), { startBeat: 0, endBeat: 0.5 });
  assert.deepEqual(createLoopRange(events, 16, 16), { startBeat: 8, endBeat: 16 });
  assert.deepEqual(createLoopRange(events, 16, 100), { startBeat: 8, endBeat: 16 });
  assert.deepEqual(createLoopRange(events, 16, 15), { startBeat: 14, endBeat: 16 });
  assert.deepEqual(createLoopRange([{ beat: 0 }, { beat: 5 }, { beat: 13 }], 16, 16), { startBeat: 5, endBeat: 16 });
});

test("fractional pickups and duplicate chord onsets stay musically aligned", () => {
  const pickup = [{ beat: 0.25 }, { beat: 0.25 }, { beat: 2.75 }, { beat: 8.75 }];
  assert.deepEqual(createLoopRange(pickup, 9.25), { startBeat: 0.25, endBeat: 8.75 });
  assert.deepEqual(createLoopRange([...pickup].reverse(), 9.25, 3, 2), { startBeat: 2.75, endBeat: 8.75 });
  assert.deepEqual(snapLoopBoundary(pickup, 9.25, { startBeat: 0.25, endBeat: 8.75 }, "start", 2.8), { startBeat: 2.75, endBeat: 8.75 });
});

test("empty or malformed input has deterministic finite bounds", () => {
  for (const input of [[], null, undefined, [null, {}, { beat: NaN }, { beat: Infinity }, { beat: -1 }, { beat: "2" }]]) {
    assert.deepEqual(createLoopRange(input, 0), { startBeat: 0, endBeat: 1 });
    assert.deepEqual(createLoopRange(input, 4), { startBeat: 0, endBeat: 4 });
  }
  assert.deepEqual(createLoopRange([{ beat: 2, duration: 0.5 }], NaN), { startBeat: 2, endBeat: 2.5 });
  assert.deepEqual(createLoopRange([{ beat: 100 }], 4), { startBeat: 0, endBeat: 4 });
  assert.deepEqual(createLoopRange(events, 16, NaN, -1), { startBeat: 0, endBeat: 8 });
});

test("edge snapping uses nearest valid onsets and cannot cross the other edge", () => {
  const range = { startBeat: 2, endBeat: 10 };
  assert.deepEqual(snapLoopBoundary(events, 16, range, "start", 5), { startBeat: 4, endBeat: 10 });
  assert.deepEqual(snapLoopBoundary(events, 16, range, "start", 100), { startBeat: 8, endBeat: 10 });
  assert.deepEqual(snapLoopBoundary(events, 16, range, "end", -100), { startBeat: 2, endBeat: 4 });
  assert.deepEqual(snapLoopBoundary(events, 16, range, "end", 100), { startBeat: 2, endBeat: 16 });
  assert.deepEqual(range, { startBeat: 2, endBeat: 10 });
});

test("invalid ranges, edges, and attempted boundaries normalize safely", () => {
  assert.deepEqual(snapLoopBoundary(events, 16, { startBeat: 100, endBeat: -100 }, "end", NaN), { startBeat: 14, endBeat: 16 });
  assert.deepEqual(snapLoopBoundary(events, 16, null, "unknown", 5), { startBeat: 0, endBeat: 8 });
  assert.deepEqual(snapLoopBoundary([], 0, {}, "start", 100), { startBeat: 0, endBeat: 1 });
  assert.deepEqual(snapLoopBoundary(events, 16, { startBeat: 3, endBeat: 11 }, "end", Infinity), { startBeat: 2, endBeat: 10 });
});

test("loop membership includes start and excludes end", () => {
  const range = { startBeat: 0.25, endBeat: 2.75 };
  assert.equal(isBeatInLoop(0.25, range), true);
  assert.equal(isBeatInLoop(2.749, range), true);
  assert.equal(isBeatInLoop(2.75, range), false);
  assert.equal(isBeatInLoop(0, range), false);
  assert.equal(isBeatInLoop(NaN, range), false);
  assert.equal(isBeatInLoop(999, null), true);
  assert.equal(isBeatInLoop(-1, undefined), true);
});

test("preparation covers visual lead with a minimum of three beats", () => {
  assert.equal(getPreparationBeats(0.5, 1), 3);
  assert.equal(getPreparationBeats(0.5, 2.1), 5);
  assert.equal(getPreparationBeats(0.25, 3), 12);
  for (const spb of [0, -1, NaN, Infinity, undefined]) assert.equal(getPreparationBeats(spb, 2), 3);
  for (const lead of [-1, NaN, Infinity, undefined]) assert.equal(getPreparationBeats(0.5, lead), 3);
  assert.equal(getPreparationBeats(Number.MIN_VALUE, Number.MAX_VALUE), Number.MAX_SAFE_INTEGER);
});
