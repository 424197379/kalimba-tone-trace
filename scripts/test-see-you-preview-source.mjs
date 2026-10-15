import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hasMatchingPracticeMelody, parseImportedSongs } from "../src/song-store.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const tupleHash = tuples => hash(JSON.stringify(tuples));
const fixture = JSON.parse(await read("scripts/fixtures/see-you-preview-source.json"));
const song = JSON.parse(await read("data/songs/see-you-again.json"));
const siblingBytes = await read("data/songs/see-you-again-chord.json");
const sibling = JSON.parse(siblingBytes);
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const original = fixture.history.originalV1;
const originalBytes = JSON.stringify(original, null, 2) + "\n";
const originalFileHash = "be4ac589564559cb43e4985257471902f4bf611b08d3652e7c56900383dd50bb";
const originalStepsHash = "0cea38494d9bce08649e825c8fb7def2a7a19e7e90025a0b70973a3a224497ba";
const reviewedStepsHash = "0bcaf2d5daed29e3c2d8420436910a5faa27306d4f13211a4a91d0ec554aa4ad";
const siblingHash = "f22f7a54d6ee3d9caa20dc21925470337bd43cf3d134e4e912b261ddcabe76fb";
const unchangedHash = "888023d0e39958a183b45c0d485f5874b1daf3dcd33a0b5c4bf25f7a192ed807";
const measure7Hash = "feedbea66a3ca1ace3ae34b40b3315f498ece6eeaa549ca822043c89c33ef0e5";
const phrase = (value, from, to) => value.steps.filter(([, beat]) => beat >= from && beat < to);

// The compact fixture comes from the separately entered pre-edit source reading,
// not from production steps. ~ records an observed tie, never equal-pitch inference.
const expected = [];
const fragments = [];
for (const [index, bar] of fixture.writtenBars.entries()) {
  assert.equal(bar.measure, index + 1);
  const pitches = bar.pitches.split(" ");
  assert.equal(pitches.length, bar.durations.length);
  assert.equal(bar.durations.reduce((sum, duration) => sum + duration, 0), 4);
  let beat = index * 4;
  for (const [position, token] of pitches.entries()) {
    const tied = token.startsWith("~");
    const note = token.replace(/^~/, "");
    const duration = bar.durations[position];
    fragments.push({ measure: index + 1, note, beat, duration, tied });
    if (tied) {
      const previous = expected.at(-1);
      assert.equal(previous[0], note, "a same-pitch tie preserves register");
      assert.equal(previous[1] + previous[2], beat, "tie endpoints are contiguous");
      previous[2] += duration;
    } else expected.push([note, beat, duration]);
    beat += duration;
  }
}
const evidence = {
  songId: fixture.songId,
  source: fixture.source,
  melodySpans: fixture.writtenBars.map(({ measure }) => ({
    from: (measure - 1) * 4, to: measure * 4,
    attacks: expected.filter(([, beat, duration]) => beat < measure * 4 && beat + duration > (measure - 1) * 4),
  })),
  sourceTotalBeats: fixture.sourceTotalBeats,
  silentWindows: [],
  pitchFit: fixture.pitchFit,
};
const reject = candidate => assert.throws(() => checkTranscriptionEvidence(candidate, evidence),
  /attack count differs|pitch differs|onset differs|duration differs|sourceTotalBeats|Source end cannot truncate/);

test("all twelve separately read bars match 86 attacks over the selected 48-beat preview", () => {
  assert.equal(fixture.writtenBars.length, 12);
  assert.equal(fragments.length, 99);
  assert.equal(fragments.filter(({ tied }) => tied).length, 13);
  assert.equal(expected.length, 86);
  assert.equal(fixture.expected.writtenFragmentCount, fragments.length);
  assert.equal(fixture.expected.tieContinuationCount, 13);
  assert.equal(fixture.expected.tieChainCount, 12);
  assert.equal(fixture.expected.attackCount, expected.length);
  assert.equal(tupleHash(expected), reviewedStepsHash);
  assert.equal(fixture.expected.tupleSha256, reviewedStepsHash);
  assert.deepEqual(song.steps, expected);
  const result = checkTranscriptionEvidence(song, evidence);
  assert.equal(result.reviewedSpans, 12);
  assert.equal(result.checkedAttacks, 86);
  assert.equal(result.checkedSilentWindows, 0);
  assert.ok(result.fittingTranspositions.includes(0));
  assert.equal(current.selectedMelody.tupleSha256, reviewedStepsHash);
  assert.equal(current.selectedMelody.attackCount, 86);
  assert.deepEqual(current.reviewedBeatRanges, [[0, 48]]);
  assert.deepEqual(evidence.melodySpans.map(({ attacks }) => attacks.length), [10, 10, 10, 7, 4, 6, 8, 7, 4, 6, 8, 6]);
});

test("twelve explicit tie chains suppress exactly thirteen source continuation attacks", () => {
  assert.equal(fixture.tieChains.length, 12);
  assert.equal(fixture.tieChains.reduce((sum, chain) => sum + chain.components.length - 1, 0), 13);
  assert.equal(current.tieChainCount, 12);
  assert.equal(current.tieContinuationCount, 13);
  for (const { measure, pitch, components, merged, preserveIndependentAttack } of fixture.tieChains) {
    const tuple = [pitch, ...merged];
    assert.deepEqual(song.steps.find(([, beat]) => beat === merged[0]), tuple);
    assert.equal(components.reduce((sum, [, duration]) => sum + duration, 0), merged[1]);
    if (preserveIndependentAttack) assert.deepEqual(song.steps.find(([, beat]) => beat === preserveIndependentAttack[1]), preserveIndependentAttack);
    let end = components[0][0];
    for (const [index, [beat, duration]] of components.entries()) {
      assert.equal(beat, end);
      assert.deepEqual(fragments.find(fragment => fragment.beat === beat),
        { measure, note: pitch, beat, duration, tied: index > 0 });
      if (index) assert.equal(song.steps.some(([, onset]) => onset === beat), false);
      end = beat + duration;
    }
    const falseReattacks = structuredClone(song);
    falseReattacks.steps = falseReattacks.steps.flatMap(step => step[1] === merged[0]
      ? components.map(([beat, duration]) => [pitch, beat, duration]) : [step]);
    reject(falseReattacks);
  }
  // m8's two continuation endpoints are each independently protected.
  for (const beat of [30, 31]) {
    const split = structuredClone(song);
    split.steps = split.steps.flatMap(step => step[1] === 29.5
      ? [["C5", 29.5, beat - 29.5], ["C5", beat, 31.25 - beat]] : [step]);
    reject(split);
  }
});

test("genuine adjacent same-pitch attacks survive; equal-pitch overmerging fails", () => {
  const separateStarts = [[20, 20.5], [21.5, 23.5], [26.5, 27], [28, 28.5],
    [29.5, 31.25], [36, 36.5], [37.5, 39], [44, 44.5], [45, 45.5]];
  for (const [firstBeat, secondBeat] of separateStarts) {
    const first = song.steps.find(([, beat]) => beat === firstBeat);
    const second = song.steps.find(([, beat]) => beat === secondBeat);
    assert.equal(first[0], second[0]);
    assert.equal(first[1] + first[2], second[1]);
    assert.equal(fragments.find(({ beat }) => beat === secondBeat).tied, false);
    const merged = structuredClone(song);
    merged.steps.find(([, beat]) => beat === firstBeat)[2] += second[2];
    merged.steps = merged.steps.filter(([, beat]) => beat !== secondBeat);
    reject(merged);
  }
  assert.deepEqual(phrase(song, 37.5, 40), [["E5", 37.5, 1.5], ["E5", 39, .5], ["G5", 39.5, .5]]);
  assert.deepEqual(phrase(song, 44, 45), [["D6", 44, .5], ["D6", 44.5, .5]]);
});

test("m10–12 remain their own visible source occurrences rather than copied m6–8", () => {
  for (const [from, to] of [[20, 36], [24, 40], [28, 44]]) {
    const copied = phrase(song, from, from + 4).map(([note, beat, duration]) => [note, beat + to - from, duration]);
    assert.notDeepEqual(phrase(song, to, to + 4), copied);
    const candidate = structuredClone(song);
    candidate.steps = [...phrase(song, 0, to), ...copied, ...phrase(song, to + 4, 48)];
    reject(candidate);
  }
  const copiedWholePhrase = structuredClone(song);
  copiedWholePhrase.steps = [...phrase(song, 0, 32),
    ...phrase(song, 16, 32).map(([note, beat, duration]) => [note, beat + 16, duration])];
  reject(copiedWholePhrase);
  // m9 really does repeat m5 in this source; resemblance is checked, not banned.
  assert.deepEqual(phrase(song, 32, 36), phrase(song, 16, 20).map(([note, beat, duration]) => [note, beat + 16, duration]));
  assert.deepEqual(phrase(song, 40, 44), [["A5", 40, .5], ["C6", 40.5, .5], ["D6", 41, .5], ["E6", 41.5, .5],
    ["D6", 42, .5], ["C6", 42.5, .5], ["A5", 43, .5], ["C6", 43.5, .5]]);
});

test("m7 and all 27 exactly unchanged pitch/onset/duration tuples stay frozen", () => {
  const oldTuples = new Set(original.steps.map(step => JSON.stringify(step)));
  const retained = song.steps.filter(step => oldTuples.has(JSON.stringify(step)));
  assert.equal(retained.length, 27);
  assert.deepEqual(retained, fixture.expected.unchangedTuples);
  assert.equal(tupleHash(retained), unchangedHash);
  assert.equal(current.unchangedMelody.untouchedTuplesSha256, unchangedHash);
  assert.deepEqual(phrase(song, 24, 28), phrase(original, 24, 28));
  assert.equal(tupleHash(phrase(song, 24, 28)), measure7Hash);
  assert.equal(current.unchangedMelody.measure7TuplesSha256, measure7Hash);
  assert.deepEqual(current.unchangedMelody.completeUnchangedMeasures, [7]);
});

test("old data and mixed-register opening restoration fail the selected source evidence", () => {
  reject(original);
  const mixedRegister = structuredClone(song);
  mixedRegister.steps = mixedRegister.steps.map(([note, beat, duration]) =>
    [beat < 16 && ["C6", "D6", "E6"].includes(note) ? note.replace("6", "5") : note, beat, duration]);
  reject(mixedRegister);
  const allUntied = structuredClone(song);
  allUntied.steps = fragments.map(({ note, beat, duration }) => [note, beat, duration]);
  reject(allUntied);
});

test("selected m8 has continuous ties; another edition's quarter-beat rest is rejected", () => {
  assert.deepEqual(phrase(song, 29.5, 32), [["C5", 29.5, 1.75], ["C5", 31.25, .25], ["E5", 31.5, .25], ["G5", 31.75, .25]]);
  const borrowedRest = structuredClone(song);
  borrowedRest.steps.find(([, beat]) => beat === 29.5)[2] = 1.5;
  reject(borrowedRest);
  assert.equal(current.comparisonEdition.status, "comparison-only-not-adopted");
  assert.deepEqual(current.comparisonEdition.agreementMeasures, [1, 2, 3, 4, 6, 7, 11, 12]);
  assert.deepEqual(current.comparisonEdition.conflictingMeasures, [5, 8, 9, 10]);
  assert.equal(current.comparisonEdition.sourceKey, "Bb");
  assert.equal(current.comparisonEdition.comparisonSemitoneShift, 2);
  assert.match(current.comparisonEdition.independence, /independent underlying ancestry is not established/);
});

test("48 beats is an excerpt cut with no invented rest, ending hold or paid continuation", () => {
  assert.equal(song.sourceFeatures.sourceTotalBeats, 48);
  assert.equal(song.sourceFeatures.sourceMeasureCount, 12);
  assert.deepEqual(song.steps.at(-1), ["C6", 47.5, .5]);
  let cursor = 0;
  for (const [, beat, duration] of song.steps) {
    assert.equal(beat, cursor, "selected melody has no written gaps or overlaps");
    cursor = beat + duration;
  }
  assert.equal(cursor, 48);
  assert.equal(song.steps.reduce((sum, [,, duration]) => sum + duration, 0), 48);
  assert.equal(current.sourceForm.endingKind, "preview-excerpt-boundary");
  assert.equal(current.sourceForm.fullSongEndingEstablished, false);
  assert.equal(current.sourceForm.pickupBeats, 0);
  assert.equal(current.sourceForm.repeatExpansion, false);
  assert.equal(song.sourceFeatures.hasRepeats, false);
  assert.deepEqual(current.ending, { note: "C6", beat: 47.5, duration: .5, totalBeats: 48,
    finalRestBeats: 0, kind: "preview-excerpt-boundary" });
  assert.deepEqual(current.selectedMelody.melodyRestWindows, []);
  for (const extent of [47.5, 52, undefined]) {
    const changed = structuredClone(song);
    changed.sourceFeatures.sourceTotalBeats = extent;
    reject(changed);
  }
  for (const duration of [.25, 1]) {
    const changed = structuredClone(song);
    changed.steps.at(-1)[2] = duration;
    reject(changed);
  }
  const continuation = structuredClone(song);
  continuation.steps.push(["C6", 48, .5]);
  reject(continuation);
  assert.match(current.sourceTotalBeatsMeaning, /not a proven full-song ending/);
});

test("literal C5–E6 pitches use zero transposition without octave folding or naturalization", () => {
  const midi = note => {
    const [, letter, octave] = /^([A-G])(\d)$/.exec(note);
    return (Number(octave) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
  };
  const sourceAttacks = fragments.filter(({ tied }) => !tied);
  for (const [index, step] of song.steps.entries()) assert.equal(midi(step[0]) - midi(sourceAttacks[index].note), 0);
  assert.equal(Math.min(...song.steps.map(([note]) => midi(note))), midi("C5"));
  assert.equal(Math.max(...song.steps.map(([note]) => midi(note))), midi("E6"));
  assert.deepEqual([...new Set(sourceAttacks.map(({ note }) => midi(note) % 12))].sort((a, b) => a - b), [0, 2, 4, 7, 9, 11]);
  assert.equal(current.transposition.semitoneShift, 0);
  assert.equal(current.transposition.octaveFolding, false);
  assert.equal(current.transposition.accidentalNaturalization, false);
  assert.deepEqual(current.transposition.sourceRange, ["C5", "E6"]);
  assert.deepEqual(current.transposition.compiledRange, ["C5", "E6"]);
  assert.equal(song.bpm, 80);
  assert.equal(song.defaultSpeedFactor, .88);
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.key, "C");
  assert.match(current.retainedPracticeTempo, /0.88 default suggests 70.4 BPM, not the actual selected/);
});

test("complete prior V1 bytes and source history reconstruct, then import without replacing the correction", () => {
  assert.equal(hash(originalBytes), originalFileHash);
  assert.equal(tupleHash(original.steps), originalStepsHash);
  assert.equal(original.steps.length, 99);
  assert.equal(fixture.history.originalV1Sha256, originalFileHash);
  assert.equal(fixture.history.originalV1StepsSha256, originalStepsHash);
  assert.equal(review.originalV1.fileSha256, originalFileHash);
  assert.equal(review.originalV1.stepsSha256, originalStepsHash);
  assert.deepEqual(review.historicalReviewNotes, original.sourceFeatures);
  const stableTopLevel = value => Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["title", "practiceTitle", "scoreTitle", "hint", "steps", "sourceFeatures"].includes(key)));
  assert.deepEqual(stableTopLevel(song), stableTopLevel(original));
  const library = { [song.id]: song };
  const before = JSON.stringify(library);
  const [restored] = parseImportedSongs(originalBytes, library);
  assert.deepEqual(restored.steps, original.steps);
  assert.equal(restored.bpm, original.bpm);
  assert.notEqual(restored.id, song.id);
  assert.notEqual(restored.baseSongId, song.id);
  assert.equal(JSON.stringify(library), before);
});

test("V2 bytes remain frozen and existing content matching rejects all old backing reuse", () => {
  assert.equal(hash(siblingBytes), siblingHash);
  assert.equal(fixture.history.originalV2Sha256, siblingHash);
  assert.equal(current.accompanimentReview.siblingFileSha256, siblingHash);
  const oldMelody = sibling.events.map(({ beat, duration, notes }) => {
    const melody = notes.filter(({ role }) => role === "melody");
    assert.equal(melody.length, 1);
    assert.equal(melody[0].judge, true);
    return [melody[0].name, beat, duration];
  });
  assert.deepEqual(oldMelody, original.steps);
  assert.equal(hasMatchingPracticeMelody(original, sibling), true, "shared old data is not independent musical evidence");
  assert.equal(hasMatchingPracticeMelody(song, sibling), false);
  assert.equal(sibling.autoAccompaniment.events.length, 12);
  assert.equal(sibling.rhythm.sourceStatus, "inferred");
  assert.equal(current.accompanimentReview.status, "legacy-sibling-preserved-incompatible");
  assert.equal(current.accompanimentReview.contentCompatible, false);
  assert.equal(current.accompanimentReview.sourceHarmonyApproved, false);
  assert.equal(current.accompanimentReview.addedSupport, false);
  for (const field of ["events", "rhythm", "autoAccompaniment", "practiceAccompaniment"]) assert.equal(Object.hasOwn(song, field), false);
});

test("selected source identity, pre-edit evidence and bounded acceptance stay explicit", () => {
  assert.equal(current.status, "reviewed-selected-guitarworld-preview");
  assert.equal(current.reviewedOn, "2026-10-12");
  assert.equal(current.sourceEditions.length, 1);
  const [edition] = current.sourceEditions;
  assert.equal(edition.url, "https://www.guitarworld.com.cn/pu/q79160");
  assert.equal(edition.arranger, "乐星人");
  assert.equal(edition.staffImage, fixture.source.imageUrl);
  assert.equal(edition.staffImageSha256, "8ba82cb8c119bb739bc44a3e433fd8804aa8dc6eb2752c13f42671aa8ec198c7");
  assert.deepEqual(edition.staffImageSize, [1200, 831]);
  assert.deepEqual(edition.inspectedMeasures, [1, 12]);
  assert.equal(edition.sourceKey, "C");
  assert.equal(edition.sourceMeter, "4/4");
  assert.equal(edition.sourceTempo, 80);
  assert.equal(edition.sourceTempoBeatUnit, "quarter");
  assert.equal(edition.numberedPixelsInspected, false);
  assert.match(edition.mapping, /monophonic.*no highest-note or first-array-note selection/);
  assert.match(edition.independence, /one edition, not independent sources/);
  assert.deepEqual(current.evidenceFingerprints, {
    preEditSourceFixtureSha256: "5b10ccd20451c135ab1343abf4222398374c1c1ce95c4c96944a3230b3792989",
    tieEndpointsSha256: "801abc0cce0d7884316e03da39c2bb93dad3bfac4043fda56008c45cad895583",
    preEditComparisonSha256: "b0da7f062ae2bcf6fba5484d961c26c4e694976da4d6b96ed675e2480f9653d0",
  });
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  assert.equal(song.sourceFeatures.suitability.scope, "selected-guitarworld-12-measure-treble-preview");
  assert.equal(current.selectedMelodyNotationReviewed, true);
  for (const key of ["fullOriginalSongApproved", "exactRecordingApproved"]) assert.equal(current[key], false);
  for (const key of ["referenceListening", "browserAudio", "physicalKalimba"]) assert.equal(current[key], "not-performed");
  assert.match(song.title, /12小节预览/);
  assert.match(song.hint, /12小节五线谱预览上声部，86个单音、48拍，非全曲/);
  assert.match(song.hint, /80 BPM 原音高录入，不移调/);
  assert.match(song.hint, /48拍是预览截点，不是全曲终止/);
  assert.match(song.hint, /C5–E6高音快句宜慢练，旧伴奏暂不使用/);
  assert.match(current.limitations, /Public access does not establish public-distribution rights/);
  assert.match(current.limitations, /raw source images and private review artifacts stay outside the repository/);
});
