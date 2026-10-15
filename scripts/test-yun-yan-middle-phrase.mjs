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
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const inside = ([, beat]) => beat >= 16 && beat < 48.5;
// Expected attacks were transcribed from reviewed source pixels in a separate
// read-only audit before implementation, rather than copied from this song.
const expected = [["G5",16,4],
  ["G4",21.5,0.5],
  ["D5",22,1],
  ["C5",23,1],
  ["E5",24,1.5],
  ["G5",25.5,0.5],
  ["F5",26,0.5],
  ["E5",26.5,0.5],
  ["E5",27,0.5],
  ["G5",27.5,0.5],
  ["G5",28,1],
  ["D5",29,1],
  ["C5",30,0.5],
  ["D5",30.5,0.5],
  ["C5",31,0.5],
  ["D5",31.5,0.5],
  ["E5",32,1],
  ["E5",33,0.5],
  ["E5",33.5,0.5],
  ["E5",34,0.5],
  ["G5",34.5,0.5],
  ["F5",35,0.5],
  ["E5",35.5,1.5],
  ["E5",38,0.5],
  ["D5",38.5,0.5],
  ["C5",39,0.5],
  ["B4",39.5,1],
  ["A4",40.5,0.5],
  ["A4",41,0.5],
  ["A4",41.5,0.5],
  ["A4",42,0.5],
  ["B4",42.5,0.5],
  ["C5",43,0.5],
  ["G4",43.5,1],
  ["G4",44.5,0.5],
  ["D5",45,0.5],
  ["C5",45.5,1.5],
  ["E5",47,0.5],
  ["D5",47.5,1]];
// Pre-change span captured from the immutable 2.4.1 baseline. Replacing only
// this range reconstructs the historical whole-song fingerprint, so excluding
// the newly approved scope cannot conceal an unrelated edit.
const original = [["G5",16,4],
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
const tieGroups = [
  { start: ["E5", 35.5, 0.5], continuation: ["E5", 36, 1], merged: ["E5", 35.5, 1.5] },
  { start: ["B4", 39.5, 0.5], continuation: ["B4", 40, 0.5], merged: ["B4", 39.5, 1] },
  { start: ["G4", 43.5, 0.5], continuation: ["G4", 44, 0.5], merged: ["G4", 43.5, 1] },
  { start: ["C5", 45.5, 0.5], continuation: ["C5", 46, 1], merged: ["C5", 45.5, 1.5] },
  { start: ["D5", 47.5, 0.5], continuation: ["D5", 48, 0.5], merged: ["D5", 47.5, 1] },
];
const at = (beat) => song.steps.find(([, onset]) => onset === beat);
const overlap = ([, beat, duration], start, end) => Math.max(0, Math.min(beat + duration, end) - Math.max(beat, start));
const sumDurations = (steps) => steps.reduce((sum, [, , duration]) => sum + duration, 0);

test("The reviewed Sohu m5–12 span encodes exactly 39 source attacks", () => {
  assert.equal(expected.length, 39);
  assert.deepEqual(song.steps.filter(inside), expected);
  assert.equal(stepsBeforeLaterCorrection.length, 192);
  assert.equal(sumDurations(stepsBeforeLaterCorrection), 110);
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 120);
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.bpm, 69);
  assert.equal(song.key, "C");
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.defaultSpeedFactor, 0.9);
});

test("Five proven same-pitch ties sound once through their exact endpoints", () => {
  for (const { start, continuation, merged } of tieGroups) {
    assert.equal(start[0], continuation[0]);
    assert.equal(start[1] + start[2], continuation[1]);
    assert.deepEqual(at(merged[1]), merged);
    assert.equal(at(continuation[1]), undefined);
    assert.equal(merged[2], start[2] + continuation[2]);
    assert.equal(merged[1] + merged[2], continuation[1] + continuation[2]);
  }
  assert.deepEqual(at(44.5), ["G4", 44.5, 0.5]);
  assert.deepEqual(at(48.5), ["D5", 48.5, 0.5]);
});

test("Written repeated E5 and A4 attacks remain independent", () => {
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 32 && beat < 34.5), [
    ["E5", 32, 1], ["E5", 33, 0.5], ["E5", 33.5, 0.5], ["E5", 34, 0.5],
  ]);
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 40.5 && beat <= 42), [
    ["A4", 40.5, 0.5], ["A4", 41, 0.5], ["A4", 41.5, 0.5], ["A4", 42, 0.5],
  ]);
  assert.deepEqual(at(26.5), ["E5", 26.5, 0.5]);
  assert.deepEqual(at(27), ["E5", 27, 0.5]);
  assert.deepEqual(at(34.5), ["G5", 34.5, 0.5]);
  assert.deepEqual(at(35), ["F5", 35, 0.5]);
});

test("m6 dotted silence and m10 quarter silence stay empty, with complete bar accounting", () => {
  for (const [start, end] of [[20, 21.5], [37, 38]]) {
    assert.equal(song.steps.some((step) => overlap(step, start, end) > 0), false);
  }
  assert.deepEqual(at(21.5), ["G4", 21.5, 0.5]);
  assert.deepEqual(at(22), ["D5", 22, 1]);
  assert.deepEqual(at(23), ["C5", 23, 1]);
  for (let start = 16; start < 48; start += 4) {
    const occupied = song.steps.reduce((sum, step) => sum + overlap(step, start, start + 4), 0);
    const rest = start === 20 ? 1.5 : start === 36 ? 1 : 0;
    assert.equal(occupied + rest, 4, "measure starting at " + start);
  }
  const span = song.steps.filter(inside);
  span.forEach(([, beat, duration], index) => {
    if (index < span.length - 1) assert.ok(beat + duration <= span[index + 1][1]);
  });
});

test("Local octave dots restore source pitches without a global shift or untied-note merging", () => {
  for (const beat of [23, 30, 31, 39, 43, 45.5]) assert.equal(at(beat)[0], "C5");
  for (const beat of [21.5, 43.5, 44.5]) assert.equal(at(beat)[0], "G4");
  for (const beat of [39.5, 42.5]) assert.equal(at(beat)[0], "B4");
  assert.deepEqual(at(16), ["G5", 16, 4]);
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 24 && beat < 28),
    original.filter(([, beat]) => beat >= 24 && beat < 28));
});

test("All 153 outside-scope tuples and the 23 first-four-measure tuples stay frozen", () => {
  const outside = stepsBeforeLaterCorrection.filter((step) => !inside(step));
  assert.equal(outside.length, 153);
  assert.equal(hash(outside), "72e6212b5787779a5e0f41643b7908b4c7cffb852a468a20464a2885bdff6c1d");
  const firstFour = song.steps.filter(([, beat]) => beat < 16);
  assert.equal(firstFour.length, 23);
  assert.equal(hash(firstFour), "5dc9435e4810e905c9f867c8c63fde40c49c29c4b6445326b2a3c8ada17d3ffb");
  const reconstructed = [
    ...song.steps.filter(([, beat]) => beat < 16), ...original,
    ...stepsBeforeLaterCorrection.filter(([, beat]) => beat >= 48.5),
  ];
  assert.equal(original.length, 43);
  assert.equal(hash(original), "bb2ddaf08ee8313fa177abb150e882a2afb17b774934ff0bc7e4176ab4e38c48");
  assert.equal(reconstructed.length, 196);
  assert.equal(hash(reconstructed), "3f1b3140ac74c4fafa0792691be382b160eae9c6f0148c09b3e9250127b71e1f");
  assert.equal(sumDurations(reconstructed) - sumDurations(stepsBeforeLaterCorrection), 0.5);
});

test("Previous provenance and the complete pre-change file can be reconstructed exactly", () => {
  const reconstructed = structuredClone(song);
  const history = reconstructed.sourceFeatures.sourceReview.historicalReviewNotes;
  reconstructed.sourceFeatures.unsupported = structuredClone(history.unsupported);
  reconstructed.sourceFeatures.unsureMeasures = structuredClone(history.unsureMeasures);
  reconstructed.sourceFeatures.sourceReview.confidence = history.confidence;
  reconstructed.sourceFeatures.sourceReview.decision = history.decision;
  delete reconstructed.sourceFeatures.sourceReview.historicalReviewNotes;
  delete reconstructed.sourceFeatures.sourceReview.currentScopeReview;
  delete reconstructed.sourceFeatures.sourceTotalBeats;
  delete reconstructed.sourceFeatures.melodyOnlyRestWindows;
  delete reconstructed.sourceFeatures.suitability;

  const review = reconstructed.sourceFeatures.sourceReview;
  reconstructed.hint = review.scopedSourceAdoptions[0].previousHint;
  delete review.scopedSourceAdoptions;
  review.focusedCorrections = review.focusedCorrections.slice(0, 3);
  reconstructed.sourceFeatures.unsupported = reconstructed.sourceFeatures.unsupported.slice(0, 4);
  reconstructed.sourceFeatures.unsureMeasures = reconstructed.sourceFeatures.unsureMeasures.slice(0, 3);
  assert.equal(hash(reconstructed.sourceFeatures), "8a866db1ad28f1638400a764e8bed36fbb4b670998887a62853c9fc88f113b4e");
  reconstructed.steps = [
    ...song.steps.filter(([, beat]) => beat < 16), ...original,
    ...stepsBeforeLaterCorrection.filter(([, beat]) => beat >= 48.5),
  ];
  const fileHash = createHash("sha256").update(JSON.stringify(reconstructed, null, 2) + "\n").digest("hex");
  assert.equal(fileHash, "bf72c25572f9432551a110efc92b6e7c39f60b3d8e3b2a4688905427adefea05");
});

test("New metadata separates ties, rhythm and source octaves, keeping source conflicts scoped", () => {
  const review = song.sourceFeatures.sourceReview;
  const adoption = review.scopedSourceAdoptions[0];
  assert.equal(adoption.sourceUrl, "https://www.sohu.com/a/274931646_759018");
  assert.equal(adoption.sourceImageSha256, "e8a1574fe02f817fcfbf5db94ad4d72bf8e90a004519b643395e640c2594dbd3");
  assert.deepEqual(adoption.beatRange, [16, 48.5]);
  assert.match(adoption.sourceDiscrepancy, /Qupu123 was not reverified/);
  assert.match(adoption.limitations, /No whole-song or all-versions accuracy claim/);
  assert.match(adoption.limitations, /reference listening, browser audio acceptance or physical-kalimba validation/);
  assert.equal(review.sources[0].url, "https://qupu123.com/qiyue/qita/p330663.html");
  assert.deepEqual(review.focusedCorrections.slice(3, 6).map(({ scope }) => scope), [
    "measures-9-12-five-tied-continuations-only",
    "measures-6-and-9-rest-and-repeated-note-rhythm-only",
    "measures-6-8-and-10-12-local-source-octaves-only",
  ]);
  assert.notEqual(song.sourceFeatures.suitability?.status, "recommended");
  assert.ok(adoption.previousHint.includes("主旋律练习版"));
  assert.match(song.hint, /旧曲谱网版本未重验/);
});
