import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const song = JSON.parse(await readFile(new URL("../data/songs/yun-yan-cheng-yu.json", import.meta.url), "utf8"));
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const inside = ([, beat]) => (beat >= 81.5 && beat < 108) || (beat >= 112 && beat < 124);
const expected = [
  ["D5", 81.5, 0.5],
  ["D5", 82, 0.5],
  ["C5", 82.5, 0.5],
  ["C5", 83, 0.5],
  ["G5", 83.5, 1],
  ["D5", 84.5, 0.5],
  ["C4", 85, 0.5],
  ["F4", 85.5, 0.5],
  ["A4", 86, 0.5],
  ["C5", 86.5, 0.5],
  ["G4", 87.75, 0.25],
  ["G5", 88, 0.5],
  ["F5", 88.5, 0.5],
  ["F5", 89, 0.5],
  ["E5", 89.5, 0.25],
  ["E5", 89.75, 0.75],
  ["D5", 90.5, 0.25],
  ["D5", 90.75, 0.25],
  ["E5", 91, 0.5],
  ["G5", 91.5, 0.5],
  ["G5", 92, 0.5],
  ["D5", 92.5, 0.5],
  ["D5", 93, 0.5],
  ["C5", 93.5, 0.25],
  ["B4", 93.75, 1.25],
  ["G4", 95.75, 0.25],
  ["A5", 96, 0.5],
  ["F5", 96.5, 0.5],
  ["F5", 97, 0.5],
  ["E5", 97.5, 0.5],
  ["E5", 98, 0.5],
  ["D5", 98.5, 0.25],
  ["D5", 98.75, 0.75],
  ["C5", 99.5, 0.25],
  ["D5", 99.75, 0.25],
  ["E5", 100, 0.5],
  ["E5", 100.5, 0.25],
  ["E5", 100.75, 0.25],
  ["E5", 101, 0.5],
  ["F5", 101.5, 0.25],
  ["G5", 101.75, 1.25],
  ["G5", 103.75, 0.25],
  ["A5", 104, 0.5],
  ["F5", 104.5, 0.5],
  ["F5", 105, 0.5],
  ["E5", 105.5, 0.25],
  ["D5", 105.75, 0.75],
  ["E5", 106.5, 0.25],
  ["E5", 106.75, 0.25],
  ["E5", 107, 0.3333333333333333],
  ["F5", 107.33333333333333, 0.3333333333333333],
  ["G5", 107.66666666666667, 0.3333333333333333],
  ["A5", 112, 0.5],
  ["A5", 112.5, 0.5],
  ["A5", 113, 0.5],
  ["G5", 113.5, 0.5],
  ["G5", 114, 0.5],
  ["G5", 114.5, 0.25],
  ["G5", 114.75, 0.75],
  ["D5", 115.5, 0.25],
  ["E5", 115.75, 0.25],
  ["F5", 116, 1],
  ["C6", 117, 0.5],
  ["A5", 117.5, 0.5],
  ["G4", 118, 0.5],
  ["G5", 118.5, 0.5],
  ["B4", 119, 0.5],
  ["C5", 119.5, 0.5]
];
const original = [
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
const deferred = [
  ["G5", 108, 0.5],
  ["A5", 108.5, 0.5],
  ["B5", 109, 1],
  ["A5", 110, 0.5],
  ["E5", 110.5, 0.5],
  ["A5", 111, 0.5],
  ["C6", 111.5, 0.25],
  ["E5", 111.75, 0.25]
];
const at = (beat) => song.steps.find(([, onset]) => onset === beat);
const near = (actual, target) => assert.ok(Math.abs(actual - target) < 1e-10, actual + " != " + target);
const overlap = ([, beat, duration], start, end) => Math.max(0, Math.min(beat + duration, end) - Math.max(beat, start));

test("Approved tail ranges contain exactly 68 source attacks, excluding the whole of m28", () => {
  assert.deepEqual(song.steps.filter(inside), expected);
  assert.equal(expected.length, 68);
  assert.equal(song.steps.length, 181);
  near(song.steps.reduce((sum, [, , duration]) => sum + duration, 0), 110.25);
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 120);
  assert.equal(song.sourceFeatures.sourceTotalBeats, 124);
});

test("All eight m28 tuples are frozen with no partial rhythm or pitch adoption", () => {
  const actual = song.steps.filter(([, beat]) => beat >= 108 && beat < 112);
  assert.deepEqual(actual, deferred);
  assert.equal(actual.length, 8);
  assert.equal(hash(actual), "738b5b91962809f077df9623a40e989c56ce98f6d833a55eddddd18cba50ddb0");
  assert.equal(at(109.75), undefined);
  assert.deepEqual(at(109), ["B5", 109, 1]);
  assert.deepEqual(at(110), ["A5", 110, 0.5]);
  assert.deepEqual(at(111.75), ["E5", 111.75, 0.25]);
});

test("Seven additional tied continuations do not retrigger, while black repeated notes do", () => {
  for (const [merged, continuation] of [
    [["G5", 83.5, 1], 84], [["E5", 89.75, 0.75], 90],
    [["B4", 93.75, 1.25], 94], [["D5", 98.75, 0.75], 99],
    [["G5", 101.75, 1.25], 102], [["D5", 105.75, 0.75], 106],
    [["G5", 114.75, 0.75], 115],
  ]) {
    assert.deepEqual(at(merged[1]), merged);
    assert.equal(at(continuation), undefined);
  }
  for (const step of [
    ["D5", 81.5, 0.5], ["D5", 82, 0.5], ["E5", 89.5, 0.25],
    ["D5", 90.5, 0.25], ["D5", 90.75, 0.25], ["D5", 98.5, 0.25],
    ["E5", 100, 0.5], ["E5", 100.5, 0.25], ["E5", 100.75, 0.25], ["E5", 101, 0.5],
    ["A5", 112, 0.5], ["A5", 112.5, 0.5], ["A5", 113, 0.5], ["G5", 114.5, 0.25],
  ]) assert.deepEqual(at(step[1]), step);
});

test("m27 triplet retains three exact thirds and its separate preceding E5 attacks", () => {
  const group = song.steps.filter(([, beat]) => beat >= 107 && beat < 108);
  assert.deepEqual(group.map(([name]) => name), ["E5", "F5", "G5"]);
  group.forEach(([, beat, duration], index) => {
    near(beat, 107 + index / 3);
    near(duration, 1 / 3);
  });
  near(group.at(-1)[1] + group.at(-1)[2], 108);
  assert.deepEqual(at(106.5), ["E5", 106.5, 0.25]);
  assert.deepEqual(at(106.75), ["E5", 106.75, 0.25]);
  assert.deepEqual(at(108), ["G5", 108, 0.5]);
});

test("Dotted rests remain silent and each adopted bar accounts for its full four beats", () => {
  for (const [start, end] of [[87, 87.75], [95, 95.75], [103, 103.75], [120, 124]]) {
    assert.equal(song.steps.some((step) => overlap(step, start, end) > 1e-10), false);
  }
  for (let start = 80; start < 124; start += 4) {
    if (start === 108) continue;
    const occupied = song.steps.reduce((sum, step) => sum + overlap(step, start, start + 4), 0);
    const rest = [84, 92, 100].includes(start) ? 0.75 : start === 120 ? 4 : 0;
    near(occupied + rest, 4);
  }
});

test("The source ending is melody-only silence through124 without extending the final note", () => {
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 116), [
    ["F5", 116, 1], ["C6", 117, 0.5], ["A5", 117.5, 0.5], ["G4", 118, 0.5],
    ["G5", 118.5, 0.5], ["B4", 119, 0.5], ["C5", 119.5, 0.5],
  ]);
  assert.deepEqual(song.sourceFeatures.melodyOnlyRestWindows.map(({ beat, duration }) => [beat, duration]), [[120, 4]]);
  assert.match(song.sourceFeatures.melodyOnlyRestWindows[0].reason, /not all-layer silence/);
  assert.equal(song.sourceFeatures.silentWindows, undefined);
  assert.equal(song.autoAccompaniment, undefined);
});

test("All 113 outside tuples and the complete187-attack previous stage remain reconstructible", () => {
  const outside = song.steps.filter((step) => !inside(step));
  assert.equal(outside.length, 113);
  assert.equal(hash(outside), "40cf1c6b80c35e89431ff87e829d49cb3e7f0f398d0e8ccc2127e5adda471510");
  assert.equal(hash(original), "1beae26cebc0a0d932c4c1841ae56d63532975e775e506e00ede316be6c403a7");
  const reconstructed = [
    ...song.steps.filter(([, beat]) => beat < 81.5), ...original.filter(([, beat]) => beat < 108),
    ...song.steps.filter(([, beat]) => beat >= 108 && beat < 112), ...original.filter(([, beat]) => beat >= 112),
  ];
  assert.equal(reconstructed.length, 187);
  assert.equal(hash(reconstructed), "48ec7952d167b4111d9a12788009088131ea44b11fef82a87c73e88e2551c956");
});

test("Moving resolved cautions to history preserves the entire prior JSON byte-for-byte", () => {
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
  reconstructed.hint = review.scopedSourceAdoptions[2].previousHint;
  review.scopedSourceAdoptions = review.scopedSourceAdoptions.slice(0, 2);
  review.focusedCorrections = review.focusedCorrections.slice(0, 9);
  assert.equal(hash(reconstructed.sourceFeatures), "6801cb8d1eb6d9943c9749c03b19382b37dfb44135c833c0c5010658457e9595");
  reconstructed.steps = [
    ...song.steps.filter(([, beat]) => beat < 81.5), ...original.filter(([, beat]) => beat < 108),
    ...song.steps.filter(([, beat]) => beat >= 108 && beat < 112), ...original.filter(([, beat]) => beat >= 112),
  ];
  assert.equal(createHash("sha256").update(JSON.stringify(reconstructed, null, 2) + "\n").digest("hex"),
    "69ea7019d95c801abcb8183ac4e42d25ac726aefe7ce8629575baf08aa4fcbad");
});

test("Current review scope excludes m28, preserves source limits, and does not claim whole-song approval", () => {
  const review = song.sourceFeatures.sourceReview.currentScopeReview;
  assert.deepEqual(review.reviewedBeatRanges, [[0, 108], [112, 124]]);
  assert.deepEqual(review.deferredBeatRanges, [[108, 112]]);
  assert.equal(review.oldQupuReverified, false);
  assert.equal(review.sourceTotalBeats, 124);
  assert.equal(review.physicalKalimba, "not-performed");
  assert.match(review.deferredReason, /Entire m28 is frozen/);
  assert.match(review.limitations, /not whole-song\/all-versions fidelity/);
  assert.equal(song.sourceFeatures.suitability.status, "needs-review");
  assert.match(song.hint, /第28小节暂保留旧数据待核实/);
  assert.doesNotMatch(song.sourceFeatures.unsupported.join(" "), /quantized.*remain unverified/);
  assert.match(song.sourceFeatures.sourceReview.historicalReviewNotes.unsupported.join(" "), /remain unverified/);
});
