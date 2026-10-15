import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const song = JSON.parse(await readFile(new URL("../data/songs/interstellar-main-theme.json", import.meta.url), "utf8"));
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fileHash = (value) => createHash("sha256").update(value).digest("hex");
const inside = ([, beat]) => beat >= 131 && beat < 155;
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-10,
  `${message}: ${actual} !== ${expected}`);

// Source-pixel expectations established before the edit: EOP 0005180 m44–49.
// Each 4/4 bar has eight marked, double-beamed three-note cells, not four
// four-note cells. This public fixture stores decisions, never source images.
const reviewedBars = [
  { measure: 44, start: 131, cell: ["C5", "A4", "E4"] },
  { measure: 45, start: 135, cell: ["C5", "A4", "E4"] },
  { measure: 46, start: 139, cell: ["F5", "C5", "A4"] },
  { measure: 47, start: 143, cell: ["B5", "G5", "E5"] },
  { measure: 48, start: 147, cell: ["C6", "G5", "E5"] },
  { measure: 49, start: 151, cell: ["D6", "B5", "E5"] },
];
const expected = reviewedBars.flatMap(({ start, cell }) =>
  Array.from({ length: 24 }, (_, index) => [cell[index % 3], start + index / 6, 1 / 6]));

// Immutable old production pattern, for reconstruction only. It is NOT a
// source expectation or an approved easier arrangement.
const legacyCells = [
  ["C5", "A4", "E4", "A4"], ["C5", "A4", "E4", "A4"],
  ["F5", "C5", "A4", "C5"], ["B4", "G4", "E4", "G4"],
  ["C5", "G4", "E4", "G4"], ["D5", "B4", "E4", "B4"],
];
const originalTail = legacyCells.flatMap((cell, bar) =>
  Array.from({ length: 16 }, (_, index) => [cell[index % 4], 131 + bar * 4 + index / 4, 0.25]));
const reconstructedSteps = [
  ...song.steps.filter(([, beat]) => beat < 131),
  ...originalTail,
  ...song.steps.filter(([, beat]) => beat >= 155),
];

test("EOP m44–49 contains exactly the 144 reviewed pitch/onset/duration tuples", () => {
  assert.equal(expected.length, 144);
  assert.deepEqual(song.steps.filter(inside), expected);
  assert.equal(hash(expected), "814fdc8555d25d4b4c7eb9f14266a40dc5f83514c31e509dc3d7ca4985a2633d");
  assert.equal(song.steps.length, 290);
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.bpm, 90);
  assert.equal(song.defaultSpeedFactor, 0.82);
  assert.equal(song.beatsPerMeasure, 3, "the existing scalar remains unchanged by display-only metadata");
  assert.equal(song.difficulty, "hard");
});

test("sixteenth triplets use common-origin fractions with no rounded accumulation or cell gaps", () => {
  for (const { measure, start, cell } of reviewedBars) {
    const notes = song.steps.filter(([, beat]) => beat >= start && beat < start + 4);
    assert.equal(notes.length, 24, `m${measure}`);
    for (let index = 0; index < 24; index += 1) {
      const [name, beat, duration] = notes[index];
      assert.equal(name, cell[index % 3]);
      assert.equal(beat, (start * 6 + index) / 6, `m${measure}, rational onset ${index}`);
      assert.equal(duration, 1 / 6);
      close(beat + duration, index === 23 ? start + 4 : notes[index + 1][1], "contiguous triplets");
    }
    close(notes.reduce((sum, [, , duration]) => sum + duration, 0), 4, `m${measure} occupancy`);
    for (let cellIndex = 0; cellIndex < 8; cellIndex += 1) {
      const group = notes.slice(cellIndex * 3, cellIndex * 3 + 3);
      close(group[0][1], start + cellIndex / 2, "cell origin");
      close(group.at(-1)[1] + group.at(-1)[2], start + (cellIndex + 1) / 2, "cell end");
    }
  }
  // This tests score-time arithmetic, not audio scheduling or listening.
  for (const speed of [1, 0.82, 0.55]) {
    const secondsPerBeat = 60 / (song.bpm * speed);
    const times = song.steps.filter(inside).map(([, beat]) => (beat - 131) * secondsPerBeat);
    for (let index = 1; index < times.length; index += 1) {
      close(times[index] - times[index - 1], secondsPerBeat / 6, `spacing at ${speed}x`);
    }
  }
});

test("source octave dots restore m47–49 and never fold the fitting E4–D6 tail", () => {
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 143 && beat < 143.5).map(([name]) => name), ["B5", "G5", "E5"]);
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 147 && beat < 147.5).map(([name]) => name), ["C6", "G5", "E5"]);
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 151 && beat < 151.5).map(([name]) => name), ["D6", "B5", "E5"]);
  assert.equal(song.steps.filter(inside).some(([name]) => ["B4", "G4", "D5"].includes(name)), false);
  assert.equal(song.sourceFeatures.sourceReview.currentScopeReview.transpositionSemitones, 0);
});

test("all 146 outside tuples and the original 242-attack song are frozen", () => {
  const outside = song.steps.filter((step) => !inside(step));
  assert.equal(outside.length, 146);
  assert.equal(hash(outside), "367c9789af8ea696b5bafdc91176f7543a8bb0dca489a80e0828ae93e80ca9d4");
  assert.equal(originalTail.length, 96);
  assert.equal(hash(originalTail), "8370b29deae9d482a3650479a576f302e537cc4b2a102b682918b9457d58a716");
  assert.equal(reconstructedSteps.length, 242);
  assert.equal(hash(reconstructedSteps), "bd5b6b946164f7825643c2daec80c48c5eb55dc78007aa34262d4b733f8d383e");
  assert.deepEqual(song.steps.at(-1), ["E5", 155, 4]);
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 159);
  assert.deepEqual(song.steps.filter(([, beat]) => beat >= 123 && beat < 131),
    Array.from({ length: 8 }, (_, index) => ["E5", 123 + index, 1]));
});

test("pre-correction provenance and full original JSON are reconstructible without a private fixture", () => {
  const reconstructed = structuredClone(song);
  const features = reconstructed.sourceFeatures;
  const review = features.sourceReview;
  const history = review.historicalReviewNotes;
  reconstructed.hint = review.scopedSourceAdoptions[0].previousHint;
  reconstructed.steps = reconstructedSteps;
  features.unsupported = history.unsupported;
  features.unsureMeasures = history.unsureMeasures;
  review.confidence = history.confidence;
  review.decision = history.decision;
  review.sources = review.sources.slice(0, 2);
  delete review.historicalReviewNotes;
  delete review.scopedSourceAdoptions;
  delete review.currentScopeReview;
  delete features.suitability;
  delete features.meterDisplay;
  delete features.meterDisplayReview;
  assert.equal(hash(features), "01e57a03ab34ed14092b51f0bd49d065118f9ba36ac9f7987800459e73fdaba0");
  assert.equal(fileHash(JSON.stringify(reconstructed, null, 2) + "\n"),
    "fcc970457f69d44efba29ec5b11ec070ecefe4bb207696cd895aed41e623a503");
});

test("EOP is adopted only for this span and missing Doc88 screenshots are not reverified", () => {
  const review = song.sourceFeatures.sourceReview;
  const current = review.currentScopeReview;
  const adoption = review.scopedSourceAdoptions[0];
  assert.equal(current.status, "reviewed-tail-only-rest-needs-review");
  assert.deepEqual(current.reviewedBeatRanges, [[131, 155]]);
  assert.deepEqual(current.deferredBeatRanges, [[0, 131], [155, 159]]);
  assert.deepEqual(adoption.beatRange, [131, 155]);
  assert.equal(current.sourceUrl, "https://www.everyonepiano.cn/Music-5180.html");
  assert.equal(adoption.sourceUrl, current.sourceUrl);
  assert.deepEqual(current.sourceImageSha256, [
    "5922836333c1683532e272aefb291cde8329eb1c66cda3b3866ef5d12b2735a5",
    "4b57280bad19be3d328554a998983ab16bd8d359a487c7300d6794eb4be9629b",
    "3bd8aab33c077197a7705bcdd3d8929dec0ff271f9abf393e772466151f6388d",
  ]);
  assert.equal(current.oldDoc88Reverified, false);
  assert.equal(review.sources[0].url, "https://www.doc88.com/p-16016400430940.html");
  assert.match(adoption.sourceDiscrepancy, /Doc88 was not reverified/);
  assert.match(review.historicalReviewNotes.unsupported[2], /quantized to 0\.25/);
  assert.equal(song.sourceFeatures.unsupported.some((text) => /quantized to 0\.25/.test(text)), false);
  assert.match(current.deferredReason, /m10-41/);
  assert.match(current.deferredReason, /m42-43/);
  assert.match(current.timebase, /unexpanded opening-repeat/);
  assert.equal(current.sourceMeterInScope, "4/4");
  assert.equal(current.tripletCellBeats, "1/2");
  assert.equal(current.tripletNoteBeats, "1/6");
});

test("difficulty and source fidelity do not imply reference, instrument or publication approval", () => {
  const { suitability, sourceReview } = song.sourceFeatures;
  assert.equal(suitability.status, "needs-review");
  assert.match(suitability.reason, /not a beginner recommendation/);
  assert.equal(sourceReview.currentScopeReview.referenceListening, "not-performed");
  assert.equal(sourceReview.currentScopeReview.physicalKalimba, "not-performed");
  assert.match(sourceReview.currentScopeReview.limitations, /public-distribution rights remain unapproved/);
  assert.ok(suitability.reviewRequired.some((text) => text.includes("optional support")));
  close(60000 / song.bpm / 6, 111.11111111111111, "source attack spacing in milliseconds");
});

test("the V2 source and accompaniment sibling remains byte-identical to the baseline", async () => {
  const sibling = await readFile(new URL("../data/songs/interstellar-main-theme-chord.json", import.meta.url));
  assert.equal(fileHash(sibling), "3b28eec6bc38685b9116f23766f9665e66435538b60240e060cfeaf977780e36");
});
