import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const song = JSON.parse(await readFile(new URL("../data/songs/yun-yan-cheng-yu.json", import.meta.url), "utf8"));

// Only adopted tail ranges are reconstructed; the deferred m28 stays live.
const tailOriginal = [
  ["D5", 81.5, 0.5],
  ["C6", 82, 0.5],
  ["C6", 82.5, 0.5],
  ["G5", 83, 1],
  ["G5", 84, 0.5],
  ["D5", 84.5, 0.5],
  ["C6", 85, 0.5],
  ["F5", 85.5, 0.5],
  ["A5", 86, 0.5],
  ["C6", 86.5, 0.5],
  ["G5", 87.5, 0.5],
  ["G5", 88, 0.5],
  ["F5", 88.5, 0.5],
  ["F5", 89, 0.5],
  ["E5", 89.5, 0.25],
  ["E5", 89.75, 0.25],
  ["E5", 90, 0.25],
  ["D5", 90.25, 0.25],
  ["D5", 90.5, 0.25],
  ["D5", 90.75, 0.25],
  ["E5", 91, 0.5],
  ["G5", 91.5, 0.5],
  ["G5", 92, 0.5],
  ["D5", 92.5, 0.5],
  ["D5", 93, 0.5],
  ["C6", 93.5, 0.5],
  ["B5", 94, 1],
  ["G5", 95.5, 0.5],
  ["A5", 96, 0.5],
  ["F5", 96.5, 0.5],
  ["F5", 97, 0.5],
  ["E5", 97.5, 0.5],
  ["E5", 98, 0.25],
  ["D5", 98.25, 0.25],
  ["D5", 98.5, 0.25],
  ["D5", 98.75, 0.25],
  ["C6", 99, 0.5],
  ["D5", 99.5, 0.5],
  ["E5", 100, 0.5],
  ["E5", 100.5, 0.25],
  ["E5", 100.75, 0.25],
  ["E5", 101, 0.25],
  ["F5", 101.25, 0.25],
  ["G5", 101.5, 0.5],
  ["G5", 102, 0.5],
  ["G5", 103.5, 0.5],
  ["A5", 104, 0.5],
  ["F5", 104.5, 0.5],
  ["F5", 105, 0.5],
  ["E5", 105.5, 0.25],
  ["D5", 105.75, 0.25],
  ["D5", 106, 0.25],
  ["E5", 106.25, 0.25],
  ["E5", 106.5, 0.25],
  ["E5", 106.75, 0.25],
  ["F5", 107, 0.5],
  ["G5", 107.5, 0.5],
  ["A5", 112, 0.5],
  ["A5", 112.5, 0.5],
  ["A5", 113, 0.5],
  ["G5", 113.5, 0.5],
  ["G5", 114, 0.5],
  ["G5", 114.5, 0.25],
  ["G5", 114.75, 0.25],
  ["G5", 115, 0.5],
  ["D5", 115.5, 0.25],
  ["E5", 115.75, 0.25],
  ["F5", 116, 0.5],
  ["C6", 116.5, 0.5],
  ["A5", 117, 0.5],
  ["G5", 117.5, 0.5],
  ["G5", 118, 0.5],
  ["B5", 118.5, 0.5],
  ["C6", 119, 1]
];
const stepsBeforeTailCorrection = [
  ...song.steps.filter(([, beat]) => beat < 81.5),
  ...tailOriginal.filter(([, beat]) => beat < 108),
  ...song.steps.filter(([, beat]) => beat >= 108 && beat < 112),
  ...tailOriginal.filter(([, beat]) => beat >= 112),
];

// Reconstruct only the independently approved later span for older freezes.
const laterOriginal = [
  ["D5", 48.5, 0.5],
  ["D5", 49, 0.5],
  ["C6", 49.5, 0.5],
  ["A5", 50, 1],
  ["G5", 51, 1],
  ["D5", 52, 1],
  ["D5", 53, 1],
  ["G5", 55, 0.5],
  ["G5", 55.5, 0.5],
  ["E5", 56, 1.5],
  ["E5", 57.5, 0.5],
  ["E5", 58, 0.5],
  ["G5", 58.5, 0.5],
  ["F5", 59, 0.5],
  ["E5", 59.5, 0.5],
  ["D5", 60, 1.5],
  ["D5", 61.5, 0.5],
  ["D5", 62, 0.5],
  ["F5", 62.5, 0.5],
  ["E5", 63, 0.5],
  ["D5", 63.5, 0.5],
  ["D5", 64, 1],
  ["C6", 65, 0.5],
  ["C6", 65.5, 0.5],
  ["A5", 66, 0.5],
  ["G5", 66.5, 0.5],
  ["F5", 67, 0.5],
  ["E5", 67.5, 0.25],
  ["F5", 67.75, 0.25],
  ["E5", 68, 2],
  ["G5", 70, 1],
  ["E5", 71, 0.5],
  ["D5", 71.5, 0.5],
  ["C6", 72, 1.5],
  ["A5", 73.5, 0.5],
  ["A5", 74, 0.5],
  ["B5", 74.5, 0.5],
  ["C6", 75, 0.5],
  ["G5", 75.5, 0.5],
  ["G5", 76, 0.5],
  ["G5", 76.5, 0.5],
  ["D5", 77, 0.5],
  ["C6", 77.5, 0.5],
  ["C6", 79, 0.25],
  ["E5", 79.25, 0.25],
  ["D5", 79.5, 0.5],
  ["D5", 80, 1],
  ["D5", 81, 0.5]
];
const stepsBeforeLaterCorrection = [
  ...song.steps.filter(([, beat]) => beat < 48.5),
  ...laterOriginal,
  ...stepsBeforeTailCorrection.filter(([, beat]) => beat >= 81.5),
];

// Frozen 2.4.1 tuples only for the separately source-reviewed 2.4.2 span.
// Reconstruct this span for historical hashes; test-yun-yan-middle-phrase.mjs
// independently freezes all 39 new tuples and every tuple outside this scope.
const middleOriginal = [["G5",16,4],
  ["G5",21,1],
  ["D5",22,1],
  ["C6",23,1],
  ["E5",24,1.5],
  ["G5",25.5,0.5],
  ["F5",26,0.5],
  ["E5",26.5,0.5],
  ["E5",27,0.5],
  ["G5",27.5,0.5],
  ["G5",28,1],
  ["D5",29,1],
  ["C6",30,0.5],
  ["D5",30.5,0.5],
  ["C6",31,0.5],
  ["D5",31.5,0.5],
  ["E5",32,1],
  ["E5",33,0.5],
  ["E5",33.5,0.5],
  ["G5",34,0.5],
  ["F5",34.5,0.5],
  ["E5",35,1],
  ["E5",36,1],
  ["E5",38,0.5],
  ["D5",38.5,0.5],
  ["C6",39,0.5],
  ["B5",39.5,0.5],
  ["B5",40,0.5],
  ["A5",40.5,0.5],
  ["A5",41,0.5],
  ["A5",41.5,0.5],
  ["A5",42,0.5],
  ["B5",42.5,0.5],
  ["C6",43,0.5],
  ["G5",43.5,0.5],
  ["G5",44,0.5],
  ["G5",44.5,0.5],
  ["D5",45,0.5],
  ["C6",45.5,0.5],
  ["C6",46,1],
  ["E5",47,0.5],
  ["D5",47.5,0.5],
  ["D5",48,0.5]];
const stepsBeforeMiddleCorrection = [
  ...song.steps.filter(([, beat]) => beat < 16),
  ...middleOriginal,
  ...stepsBeforeLaterCorrection.filter(([, beat]) => beat >= 48.5),
];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("Clouds Become Rain opens with the source's one-beat high 3-4-5 triplet", () => {
  assert.deepEqual(song.steps.slice(0, 3).map(([name]) => name), ["E5", "F5", "G5"]);
  song.steps.slice(0, 3).forEach(([, beat, duration], index) => {
    near(beat, 3 + index / 3);
    near(duration, 1 / 3);
    if (index < 2) near(beat + duration, song.steps[index + 1][1]);
  });
  near(song.steps[2][1] + song.steps[2][2], 4);
  assert.deepEqual(song.steps[3], ["A5", 4, 0.5]);
});

test("The opening keeps its rest and tempo while historical 187-tail-tuple freeze survives later scoped corrections", () => {
  assert.equal(song.steps.length, 181);
  assert.equal(stepsBeforeMiddleCorrection.length, 196);
  assert.equal(song.steps[0][1], 3);
  assert.equal(song.bpm, 69);
  assert.equal(song.key, "C");
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.defaultSpeedFactor, 0.9);
  // Exclude the separately source-verified 2.4.1 tie/m4 edits after restoring
  // the approved 2.4.2 middle span. Keep the original historical tail hash.
  const laterCorrectionBeats = new Set([5.75, 6, 9.5, 10, 13.5, 14, 15, 15.25, 15.5, 15.75]);
  const untouchedTail = stepsBeforeMiddleCorrection.slice(3).filter(([, beat]) => !laterCorrectionBeats.has(beat));
  assert.equal(untouchedTail.length, 187);
  assert.equal(
    createHash("sha256").update(JSON.stringify(untouchedTail)).digest("hex"),
    "3ef55150da342e5e219bdd294cac178c17b40781eb13d8213814cf2d9ddf3015"
  );
});

test("Opening-triplet evidence retains its exact source and whole-song review limits", () => {
  const correction = song.sourceFeatures.sourceReview.focusedCorrections.find((entry) => entry.scope === "measure-1-opening-triplet-only");
  assert.equal(correction.date, "2026-10-12");
  assert.equal(correction.confidence, "high-for-opening-triplet-only");
  assert.equal(correction.sourceUrl, "https://www.sohu.com/a/274931646_759018");
  assert.equal(correction.imageUrl, "https://5b0988e595225.cdn.sohucs.com/images/20181113/3696afe6f91f4067999b5f0c48daad10.jpeg");
  assert.match(correction.limitations, /only the opening triplet/);
  assert.match(song.sourceFeatures.sourceReview.historicalReviewNotes.unsupported.join(" "), /remain unverified/);
  assert.match(song.sourceFeatures.sourceReview.historicalReviewNotes.unsureMeasures.join(" "), /5\.75\/6.*9\.5\/10.*13\.5\/14/);
  assert.notEqual(song.sourceFeatures.suitability?.status, "recommended");
});
