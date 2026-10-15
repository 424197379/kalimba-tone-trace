import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const fileHash = value => createHash("sha256").update(value).digest("hex");
const hash = value => fileHash(JSON.stringify(value));
const song = JSON.parse(await read("data/archives/song-bie-v2.4.28.json"));
const sourceUrl = "https://www.guitarworld.com.cn/pu/q45790";
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const history = review.historicalReviewNotes;
const originalFileHash = "adaf958d152111ca3a11c0a7b9a6373e9074035d9a464a88504f08e57afb884d";
const siblingFileHash = "dd575f1e2db95a54b010d3e9eca6e1f273f58190743fec68e7db55490e61c35c";

// Source-pixel decisions recorded before the edit, from the existing cited
// GuitarWorld public preview, m7–8 ONLY. Neither the original kalimba photo
// nor the paid second page was available. These six tuples are a scoped
// regression fixture, not a reproduction of the complete published score.
const expectedCadence = [
  ["G4", 24, 1],
  ["D4", 25, 0.5],
  ["E4", 25.5, 0.5],
  ["F4", 26, 1.5],
  ["B3", 27.5, 0.5],
  ["C4", 28, 2],
];
const oldPitches = new Map([
  [25, "D5"], [25.5, "E5"], [26, "F5"], [27.5, "B4"], [28, "C5"],
]);
const reconstructedSteps = song.steps.map(([name, beat, duration]) =>
  [oldPitches.get(beat) ?? name, beat, duration]);
const phrase = (from, to) => song.steps.filter(([, beat]) => beat >= from && beat < to);
const overlaps = ([, beat, duration], from, to) => beat < to && beat + duration > from;
const pitchNumber = name => 12 * Number(name.slice(1)) + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[name[0]]);

test("the selected public-preview m7–8 has exactly six separate reviewed attacks and a two-beat rest", () => {
  assert.deepEqual(phrase(24, 32), expectedCadence);
  assert.equal(expectedCadence.length, 6);
  assert.equal(song.steps.some(step => overlaps(step, 30, 32)), false);
  assert.deepEqual(current.sourceConfirmedRestWindows, [{ beat: 30, duration: 2 }]);
  for (let index = 1; index < expectedCadence.length; index += 1) {
    const previous = expectedCadence[index - 1];
    assert.equal(previous[1] + previous[2], expectedCadence[index][1]);
  }
  assert.equal(expectedCadence.at(-1)[1] + expectedCadence.at(-1)[2], 30);
  assert.equal(expectedCadence.reduce((sum, [, , duration]) => sum + duration, 0) + 2, 8);
  assert.match(current.notationDecision, /slur/);
  assert.match(current.notationDecision, /F side dot augments duration/);
  assert.match(current.notationDecision, /B lower dot lowers its octave/);
});

test("only the five reviewed pitch fields drop an octave; all 58 timing tuples and 53 other notes are frozen", () => {
  assert.equal(song.steps.length, 58);
  const changed = song.steps.flatMap((step, index) =>
    step[0] === reconstructedSteps[index][0] ? [] : [{ before: reconstructedSteps[index], after: step }]);
  assert.equal(changed.length, 5);
  assert.deepEqual(changed.map(({ after }) => after[1]), [...oldPitches.keys()]);
  for (const { before, after } of changed) {
    assert.deepEqual(after.slice(1), before.slice(1), "onset and duration must not change");
    assert.equal(pitchNumber(after[0]) - pitchNumber(before[0]), -12);
  }
  const unchanged = song.steps.filter(([, beat]) => !oldPitches.has(beat));
  assert.equal(unchanged.length, 53);
  assert.equal(hash(unchanged), "eae72eb2954619f3e60063c752bd6c3788ace43d2ed4d4e25a2c5c2eb2101c10");
  assert.equal(hash(song.steps.map(([, beat, duration]) => [beat, duration])),
    "7beb8e92f5ad9e0f403b4e4175ad6c40541f137b0027b09d35d53aa0083d1f3f");
  assert.equal(hash(reconstructedSteps), "1b018745e9caf389a2dcbfdd0ae76349724bda5aa76226ed46fe51615cfa686f");
});

test("every outside-scope tuple, unresolved m3–4, and unseen later cadence remains unchanged", () => {
  const outside = song.steps.filter(([, beat]) => beat < 24 || beat >= 32);
  assert.equal(outside.length, 52);
  assert.equal(hash(outside), "e0ed4c2f6cd3bc3193201a339af59294d82095c717047599f2196e999d0081ae");
  // These are frozen old production tuples, NOT an approval of their source
  // fidelity. The first phrase's engraving intent remains unresolved.
  assert.deepEqual(phrase(8, 16), [
    ["G4", 8, 1], ["C5", 9, 0.5], ["D5", 9.5, 0.5],
    ["E5", 10, 1], ["D5", 11, 0.5], ["C5", 11.5, 0.5], ["D5", 12, 2],
  ]);
  assert.deepEqual(phrase(56, 64), [
    ["G4", 56, 1], ["D5", 57, 0.5], ["E5", 57.5, 0.5],
    ["F5", 58, 1.5], ["B4", 59.5, 0.5], ["C5", 60, 4],
  ]);
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 64);
  assert.equal("sourceTotalBeats" in song.sourceFeatures, false,
    "an encoded end is not a verified source ending");
  const gaps = song.steps.flatMap(([, beat, duration], index) => {
    const next = song.steps[index + 1];
    const end = beat + duration;
    return next && next[1] > end ? [[end, next[1] - end]] : [];
  });
  assert.deepEqual(gaps, [[14, 2], [30, 2], [46, 2]]);
});

test("the complete pre-correction JSON, including all provenance, is exactly reconstructible", () => {
  const reconstructed = structuredClone(song);
  reconstructed.hint = history.previousHint;
  reconstructed.steps = reconstructedSteps;
  reconstructed.sourceFeatures.unsupported = history.unsupported;
  reconstructed.sourceFeatures.unsureMeasures = history.unsureMeasures;
  delete reconstructed.sourceFeatures.sourceReview;
  delete reconstructed.sourceFeatures.suitability;
  assert.equal(hash(reconstructed.sourceFeatures), "567656687cdf8e996582c6a125360a6ed7842bcca918d309ad7973d44731e973");
  assert.equal(fileHash(JSON.stringify(reconstructed, null, 2) + "\n"), originalFileHash);
  assert.equal(current.originalMelodyFileSha256, originalFileHash);
  assert.equal(history.unsupported[1], "重新读谱后修正旧版开头误把伴奏行或低八度音当成主旋律的问题。");
  assert.equal(song.sourceFeatures.unsupported.includes(history.unsupported[1]), false);
  assert.match(history.status, /Historical/);
  assert.match(history.status, /not current source verification/);
});

test("metadata and hint disclose the narrow source adoption without approving an unavailable edition or the whole song", () => {
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.id, "song-bie");
  assert.equal(song.title, "《送别》");
  assert.equal(song.bpm, 70);
  assert.equal(song.defaultSpeedFactor, 0.9);
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.key, "C");
  assert.equal(song.difficulty, "easy");
  assert.match(song.hint, /第7–8小节/);
  assert.match(song.hint, /全曲仍待复核/);
  assert.equal(current.status, "reviewed-cadence-only-rest-needs-review");
  assert.deepEqual(current.reviewedMeasures, [7, 8]);
  assert.deepEqual(current.reviewedBeatRanges, [[24, 32]]);
  assert.deepEqual(current.correctedPitchBeats, [...oldPitches.keys()]);
  assert.deepEqual(current.unresolvedBeatRanges, [[8, 16], [32, 64]]);
  assert.match(current.unresolvedReason, /Do not mirror/);
  assert.match(current.unresolvedReason, /paid second half/);
  assert.equal(current.sourceUrl, sourceUrl);
  assert.equal(song.sourceFeatures.sources[0].url, sourceUrl);
  assert.equal(current.previewUrl, "https://s2.guitarworld.com.cn/upload/pu_qupupic/791924/view/4e7aacc1901fe74235aa752033510542.png");
  assert.equal(current.sourceImageSha256, "1316e3ffb8e3ae391f184ec6881db13d380d3e12a566687532394644a15a5601");
  assert.deepEqual(current.cropBox, [630, 698, 1110, 830]);
  assert.equal(current.sourceBpm, null);
  assert.match(current.retainedPracticeTempo, /historical defaultSpeedFactor 0\.9 field is preserved/);
  assert.match(current.retainedPracticeTempo, /selected or remembered practice multiplier/);
  assert.match(current.retainedPracticeTempo, /0\.55x \(38\.5 BPM\)/);
  assert.equal(current.transpositionSemitones, 0);
  assert.equal(current.originalPrivatePhotosReverified, false);
  assert.equal(current.fullSongApproved, false);
  assert.deepEqual(song.sourceFeatures.unsureMeasures, [3, 4, 9, 10, 11, 12, 13, 14, 15, 16]);
  assert.equal(song.sourceFeatures.suitability.status, "needs-review");
  for (const check of ["browserAudio", "referenceListening", "physicalKalimba"]) {
    assert.equal(current[check], "not-performed");
  }
});

test("the original V2 melody, harmony and automatic backing stay byte-identical and are not copied into V1", async () => {
  const siblingBytes = await read("data/songs/song-bie-chord.json");
  assert.equal(fileHash(siblingBytes), siblingFileHash);
  assert.equal(current.preservedV2FileSha256, siblingFileHash);
  const sibling = JSON.parse(siblingBytes);
  const siblingMelody = sibling.events.map(event => {
    const notes = event.notes.filter(note => note.role === "melody");
    assert.equal(notes.length, 1);
    return [notes[0].name, event.beat, event.duration];
  });
  assert.deepEqual(siblingMelody, reconstructedSteps);
  assert.notDeepEqual(siblingMelody, song.steps,
    "same title does not make the preserved V2 support compatible with this corrected V1");
  assert.equal("autoAccompaniment" in song, false);
  assert.equal("practiceAccompaniment" in song, false);
  assert.match(current.limitations, /do not reuse its support/);
});
