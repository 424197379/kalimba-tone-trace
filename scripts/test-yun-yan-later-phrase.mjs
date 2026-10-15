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
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const inside = ([, beat]) => beat >= 48.5 && beat < 81.5;
// Independent source-pixel expectations, authored before the implementation.
const expected = [
  ["D5", 48.5, 0.5],
  ["D5", 49, 0.5],
  ["C5", 49.5, 0.5],
  ["A4", 50, 0.5],
  ["G5", 50.5, 1],
  ["D5", 51.5, 1.5],
  ["G4", 54, 1],
  ["G5", 55, 1],
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
  ["D5", 64, 0.75],
  ["C5", 64.75, 0.75],
  ["A5", 65.5, 0.5],
  ["G5", 66, 0.5],
  ["F5", 66.5, 0.5],
  ["E5", 67, 0.5],
  ["F5", 67.5, 0.5],
  ["E5", 68, 2],
  ["G5", 70, 1],
  ["E5", 71, 0.5],
  ["D5", 71.5, 0.5],
  ["C5", 72, 1.5],
  ["A4", 73.5, 0.5],
  ["A4", 74, 0.5],
  ["B4", 74.5, 0.5],
  ["C5", 75, 0.5],
  ["G4", 75.5, 1],
  ["G4", 76.5, 0.5],
  ["D5", 77, 0.5],
  ["C5", 77.5, 0.5],
  ["C5", 78.5, 0.5],
  ["E5", 79, 0.5],
  ["D5", 79.5, 2]
];
// Immutable pre-batch tuples, not another transcription expectation.
const original = [
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
const at = (beat) => song.steps.find(([, onset]) => onset === beat);
const sum = (steps) => steps.reduce((total, [, , duration]) => total + duration, 0);
const overlap = ([, beat, duration], start, end) => Math.max(0, Math.min(beat + duration, end) - Math.max(beat, start));

test("Selected Sohu m13–20 span has its exact 43 attacks and bounded timeline", () => {
  assert.deepEqual(song.steps.filter(inside), expected);
  assert.equal(expected.length, 43);
  assert.equal(stepsBeforeTailCorrection.length, 187);
  assert.equal(sum(expected), 31.5);
  assert.equal(sum(stepsBeforeTailCorrection), 110.5);
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 120);
  assert.equal(song.bpm, 69);
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.defaultSpeedFactor, 0.9);
});

test("Four additional ties have one attack and preserve separate black repeats", () => {
  for (const [merged, continuationBeat] of [
    [["D5", 51.5, 1.5], 52], [["C5", 64.75, 0.75], 65],
    [["G4", 75.5, 1], 76], [["D5", 79.5, 2], 80],
  ]) {
    assert.deepEqual(at(merged[1]), merged);
    assert.equal(at(continuationBeat), undefined);
  }
  assert.equal(at(81), undefined);
  assert.deepEqual(at(47.5), ["D5", 47.5, 1]);
  assert.deepEqual(at(48.5), ["D5", 48.5, 0.5]);
  assert.deepEqual(at(49), ["D5", 49, 0.5]);
  assert.deepEqual(at(76.5), ["G4", 76.5, 0.5]);
  assert.deepEqual(at(81.5), ["D5", 81.5, 0.5]);
});

test("m14 and m20 preserve their true rest windows without fake attacks or holds", () => {
  for (const [start, end] of [[53, 54], [78, 78.5]]) {
    assert.equal(song.steps.some((step) => overlap(step, start, end) > 0), false);
  }
  assert.deepEqual(at(54), ["G4", 54, 1]);
  assert.deepEqual(at(55), ["G5", 55, 1]);
  assert.equal(at(55.5), undefined);
  assert.deepEqual(at(78.5), ["C5", 78.5, 0.5]);
  assert.deepEqual(at(79), ["E5", 79, 0.5]);
  for (let start = 48; start < 80; start += 4) {
    const occupied = song.steps.reduce((total, step) => total + overlap(step, start, start + 4), 0);
    const rest = start === 52 ? 1 : start === 76 ? 0.5 : 0;
    assert.equal(occupied + rest, 4, "bar at " + start);
  }
});

test("m17 is dotted eighth then tied sixteenth/eighth, not a triplet or grace group", () => {
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 64 && beat < 68), [
    ["D5", 64, 0.75], ["C5", 64.75, 0.75], ["A5", 65.5, 0.5],
    ["G5", 66, 0.5], ["F5", 66.5, 0.5], ["E5", 67, 0.5], ["F5", 67.5, 0.5],
  ]);
});

test("Source octaves and unchanged m15/m16/m18 controls are explicit", () => {
  for (const beat of [49.5, 64.75, 72, 75, 77.5, 78.5]) assert.equal(at(beat)[0], "C5");
  for (const beat of [50, 73.5, 74]) assert.equal(at(beat)[0], "A4");
  for (const beat of [54, 75.5, 76.5]) assert.equal(at(beat)[0], "G4");
  assert.equal(at(74.5)[0], "B4");
  for (const [start, end] of [[56, 60], [60, 64], [68, 72]]) {
    assert.deepEqual(song.steps.filter(([, beat]) => beat >= start && beat < end),
      original.filter(([, beat]) => beat >= start && beat < end));
  }
  assert.deepEqual(at(73.5), ["A4", 73.5, 0.5]);
  assert.deepEqual(at(74), ["A4", 74, 0.5]);
});

test("All 144 outside tuples remain fixed and the 192-attack baseline reconstructs exactly", () => {
  const outside = stepsBeforeTailCorrection.filter((step) => !inside(step));
  assert.equal(outside.length, 144);
  assert.equal(hash(outside), "038917f8cded36133fe21c436ec665a25c8dd36f893df3616cc0d4dc7e1d1183");
  assert.equal(hash(original), "d827002e5d33559f5e16467c1ce13b57cf5854f4d0db56db54fa480f7e49e576");
  const reconstructed = [
    ...song.steps.filter(([, beat]) => beat < 48.5), ...original,
    ...stepsBeforeTailCorrection.filter(([, beat]) => beat >= 81.5),
  ];
  assert.equal(reconstructed.length, 192);
  assert.equal(hash(reconstructed), "22f770a9b4690cdd7666a85420284a96729b5e34532f6e538681e5975b69d6bf");
  assert.equal(sum(stepsBeforeTailCorrection) - sum(reconstructed), 0.5);
});

test("Pre-batch source history and complete JSON file remain reconstructible", () => {
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
  reconstructed.hint = review.scopedSourceAdoptions[1].previousHint;
  review.scopedSourceAdoptions = review.scopedSourceAdoptions.slice(0, 1);
  review.focusedCorrections = review.focusedCorrections.slice(0, 6);
  reconstructed.sourceFeatures.unsupported = reconstructed.sourceFeatures.unsupported.slice(0, 5);
  reconstructed.sourceFeatures.unsureMeasures = reconstructed.sourceFeatures.unsureMeasures.slice(0, 4);
  assert.equal(hash(reconstructed.sourceFeatures), "b623be1fa13a5efdb1b75d4a6e0a87141833cc4cf9a6ed7e3397b68fc5439240");
  reconstructed.steps = [
    ...song.steps.filter(([, beat]) => beat < 48.5), ...original,
    ...stepsBeforeTailCorrection.filter(([, beat]) => beat >= 81.5),
  ];
  assert.equal(createHash("sha256").update(JSON.stringify(reconstructed, null, 2) + "\n").digest("hex"),
    "557b400852cc391f368b098195f75ce1686c0223427694c4e37fbee0fe0dc4cf");
});

test("m13–20 evidence keeps pitch, rhythm and ties separate without broader source approval", () => {
  const review = song.sourceFeatures.sourceReview;
  const adoption = review.scopedSourceAdoptions[1];
  assert.deepEqual(adoption.beatRange, [48.5, 81.5]);
  assert.equal(adoption.sourceUrl, "https://www.sohu.com/a/274931646_759018");
  assert.equal(adoption.sourceImageSha256[1], "01023a8c008dd064ae082cba0b9d18f9f1caf37315c1c05067483140c338666f");
  assert.match(adoption.sourceDiscrepancy, /Qupu123 was not reverified/);
  assert.match(adoption.limitations, /No new approval for notes starting at or after 81.5/);
  assert.deepEqual(review.focusedCorrections.slice(6, 9).map(({ scope }) => scope), [
    "measures-13-20-four-tied-continuations-only",
    "measures-13-14-17-and-20-rhythm-and-rests-only",
    "measures-13-14-17-and-19-20-local-source-octaves-only",
  ]);
  assert.notEqual(song.sourceFeatures.suitability?.status, "recommended");
});
