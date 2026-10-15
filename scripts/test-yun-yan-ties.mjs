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
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const groups = [
  { original: [["D5", 5.75, 0.25], ["D5", 6, 0.5]], merged: ["D5", 5.75, 0.75] },
  { original: [["C6", 9.5, 0.5], ["C6", 10, 1]], merged: ["C6", 9.5, 1.5] },
  { original: [["A5", 13.5, 0.5], ["A5", 14, 1]], merged: ["A5", 13.5, 1.5] },
];
const endingOriginal = [["F5", 15, 0.5], ["E5", 15.5, 0.25], ["C5", 15.75, 0.25]];
const endingCorrected = [["F5", 15, 0.25], ["E5", 15.25, 0.25], ["C5", 15.5, 0.5]];
const affectedBeats = new Set([
  ...groups.flatMap(({ original }) => original.map(([, beat]) => beat)),
  ...endingOriginal.map(([, beat]) => beat),
  ...endingCorrected.map(([, beat]) => beat),
]);

test("Three source-backed gray continuations are held rather than retriggered", () => {
  for (const { original, merged } of groups) {
    assert.deepEqual(song.steps.find(([, beat]) => beat === merged[1]), merged);
    assert.equal(song.steps.some(([, beat]) => beat === original[1][1]), false);
    assert.equal(merged[2], original[0][2] + original[1][2]);
    assert.equal(merged[1] + merged[2], original[1][1] + original[1][2]);
  }
  // A following black 2 is a separate attack, despite having the same pitch.
  assert.deepEqual(song.steps.find(([, beat]) => beat === 6.5), ["D5", 6.5, 0.5]);
});

test("Measure 4 closes with two sixteenths and an eighth, retaining all three pitches", () => {
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 15 && beat < 16), endingCorrected);
  assert.equal(endingCorrected.reduce((total, [, , duration]) => total + duration, 0), 1);
  endingCorrected.forEach(([, beat, duration], index) => {
    assert.equal(beat + duration, index < 2 ? endingCorrected[index + 1][1] : 16);
  });
  assert.deepEqual(song.steps.find(([, beat]) => beat === 16), ["G5", 16, 4]);
});

test("Historical 190-unrelated-tuple and whole-song freezes survive the separately reviewed middle correction", () => {
  assert.equal(song.steps.length, 181);
  assert.equal(stepsBeforeMiddleCorrection.length, 196);
  const unaffected = stepsBeforeMiddleCorrection.filter(([, beat]) => !affectedBeats.has(beat));
  assert.equal(unaffected.length, 190);
  assert.equal(hash(unaffected), "542ac8c33f05e1d17aec1d83b97454036d4e369a2332a2ed2b1d9cea960e6aa2");

  // Restore the approved middle span first, then reconstruct the original
  // 199 attacks and ending rhythm. The original historical hash stays fixed;
  // new middle tuples and untouched regions have their own exact regression.
  const reconstructed = stepsBeforeMiddleCorrection.flatMap((step) => {
    const group = groups.find(({ merged }) => merged[1] === step[1]);
    if (group) return group.original;
    const endingIndex = endingCorrected.findIndex(([, beat]) => beat === step[1]);
    return endingIndex >= 0 ? [endingOriginal[endingIndex]] : [step];
  });
  assert.equal(hash(reconstructed), "ab2ed17117ffef1ffe08009ccd9f059900831e0ac379c2132080e2e3cdf957f4");
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 120);
  assert.equal(stepsBeforeMiddleCorrection.reduce((total, [, , duration]) => total + duration, 0),
    reconstructed.reduce((total, [, , duration]) => total + duration, 0));
  assert.equal(song.bpm, 69);
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.defaultSpeedFactor, 0.9);
});

test("Measures 2-4 retain their boundaries and the half-beat rest in measure 3", () => {
  for (const [start, stop, restDuration] of [[4, 8, 0], [8, 12, 0.5], [12, 16, 0]]) {
    const steps = song.steps.filter(([, beat]) => beat >= start && beat < stop);
    assert.equal(steps[0][1], start);
    assert.equal(steps.at(-1)[1] + steps.at(-1)[2], stop);
    assert.equal(steps.reduce((total, [, , duration]) => total + duration, restDuration), 4);
    steps.forEach(([, beat, duration], index) => {
      assert.ok(beat + duration <= stop);
      if (index < steps.length - 1) assert.ok(beat + duration <= steps[index + 1][1]);
    });
  }
  assert.deepEqual(song.steps.find(([, beat]) => beat === 9.5), ["C6", 9.5, 1.5]);
  assert.equal(song.steps.some(([, beat]) => beat >= 11 && beat < 11.5), false);
  assert.deepEqual(song.steps.find(([, beat]) => beat === 11.5), ["D5", 11.5, 0.25]);
  assert.deepEqual(song.steps.find(([, beat]) => beat === 16), ["G5", 16, 4]);
});

test("Tie and ending-rhythm evidence each retain their precise source-backed scope", () => {
  const correction = song.sourceFeatures.sourceReview.focusedCorrections.find((entry) => entry.scope === "measures-2-4-three-tied-continuations-only");
  assert.equal(correction.confidence, "high-for-these-three-tie-groups-only");
  assert.equal(correction.sourceUrl, "https://www.sohu.com/a/274931646_759018");
  assert.equal(correction.imageUrl, "https://5b0988e595225.cdn.sohucs.com/images/20181113/3696afe6f91f4067999b5f0c48daad10.jpeg");
  assert.match(correction.evidence, /only the first note.*translucent continuation/);
  assert.match(correction.limitations, /only three tied groups/);
  assert.match(correction.limitations, /measure-4 ending rhythm.*separate focused correction/);
  const ending = song.sourceFeatures.sourceReview.focusedCorrections.find((entry) => entry.scope === "measure-4-ending-4-3-1-rhythm-only");
  assert.equal(ending.confidence, "high-for-this-three-note-rhythm-group-only");
  assert.equal(ending.sourceUrl, correction.sourceUrl);
  assert.equal(ending.imageUrl, correction.imageUrl);
  assert.match(ending.evidence, /second underline beneath only 4 and 3/);
  assert.match(ending.limitations, /only the closing three-note rhythm group/);
  assert.match(song.sourceFeatures.sourceReview.historicalReviewNotes.unsureMeasures.join(" "), /0\.25 \+ 0\.25 \+ 0\.5.*0\.5 \+ 0\.25 \+ 0\.25/);
  assert.notEqual(song.sourceFeatures.suitability?.status, "recommended");
});
