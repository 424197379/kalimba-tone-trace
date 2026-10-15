import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hasMatchingPracticeMelody } from "../src/song-store.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const tupleHash = tuples => hash(JSON.stringify(tuples));
const song = JSON.parse(await read("data/songs/tai-yang-zhao-chang-sheng-qi.json"));
const siblingBytes = await read("data/songs/tai-yang-zhao-chang-sheng-qi-chord.json");
const sibling = JSON.parse(siblingBytes);
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const originalFileHash = "33b31f030d96cd09a1a682c9dd40c9e12d44d80a098c4f2037bf1ac6fc78f698";
const originalStepsHash = "8cee368e7bffb1851c26ec14d665f0f3cd84bc4859a8b43accb6bb46d09a4481";
const untouchedHash = "b05957e591931bc0c1dedb7b86e3e8ae1a1341a74090cc2e38f9da00723944cb";
const reviewedStepsHash = "4952d08ef81cf1b3e59ccede3d10f90f75d4247e5ea04b5e6708e6c6d4c50517";
const siblingHash = "32dea134fc4a85418044dac13b7014d594fcf879f2874d8c4bbe421f1f894199";
const sourceUrl = "https://www.everyonepiano.cn/Music-1896.html";

// Compact transcription decisions from the independently entered pre-edit
// source-pixel fixture, not from production steps. One row per inspected bar;
// L = one lower octave dot, ~ = an explicit same-pitch tie continuation.
// These are parallel exports of ONE selected short arrangement, not two
// independent sources. Raw score images remain outside the repository.
const sourceBars = [
  ["L6 3 3 3 4", [1, 1, 1, .75, .25]],
  ["3 ~3 3 4 5", [2, .5, .5, .5, .5]],
  ["6 6 5 5", [1.5, .5, 1, 1]],
  ["3", [4]],
  ["L6 2 2 2 3", [1, 1, 1, .75, .25]],
  ["2 3", [2, 2]],
  ["5 3 5 L7 1", [.75, .25, 2, .75, .25]],
  ["L6", [4]],
  ["~L6 L6 1 3", [1, 1, 1, 1]],
  ["6 5 6 ~6 5", [.75, .25, 2, .75, .25]],
  ["6 5 6 5 5", [.75, .25, 2, .75, .25]],
  ["3", [4]],
  ["~3 2 6 5", [1, 1, 1, 1]],
  ["3 2 3", [.75, .25, 3]],
  ["~3 2 6 4", [1, 1, 1, 1]],
  ["3 2 3 5 L7 1", [.75, .25, 1, 1, .75, .25]],
  ["L6", [4]],
];
const sourcePitches = { L6: "D4", L7: "E4", 1: "F4", 2: "G4", 3: "A4", 4: "Bb4", 5: "C5", 6: "D5" };
const compiledPitches = { L6: "A3", L7: "B3", 1: "C4", 2: "D4", 3: "E4", 4: "F4", 5: "G4", 6: "A4" };
const fragments = [];
const expected = [];
for (const [index, [text, durations]] of sourceBars.entries()) {
  const degrees = text.split(" ");
  assert.equal(degrees.length, durations.length);
  assert.equal(durations.reduce((sum, value) => sum + value, 0), 4);
  let beat = index * 4;
  for (const [position, token] of degrees.entries()) {
    const tied = token.startsWith("~");
    const degree = token.replace(/^~/, "");
    const duration = durations[position];
    const note = compiledPitches[degree];
    assert.ok(note && sourcePitches[degree]);
    fragments.push({ measure: index + 1, sourcePitch: sourcePitches[degree], note, beat, duration, tied });
    if (tied) {
      const previous = expected.at(-1);
      assert.equal(previous[0], note);
      assert.equal(previous[1] + previous[2], beat);
      previous[2] += duration;
    } else expected.push([note, beat, duration]);
    beat += duration;
  }
}

const groups = [
  { span: [4, 6.5], original: [["E4", 4, 2], ["E4", 6, .5]], merged: ["E4", 4, 2.5] },
  { span: [37, 39.75], original: [["A4", 37, 2], ["A4", 39, .75]], merged: ["A4", 37, 2.75] },
  { span: [44, 49], original: [["E4", 44, 4], ["E4", 48, 1]], merged: ["E4", 44, 5] },
  { span: [53, 57], original: [["E4", 53, 3], ["E4", 56, 1]], merged: ["E4", 53, 4] },
];
const affectedBeats = new Set(groups.flatMap(({ original }) => original.map(([, beat]) => beat)));
const evidence = {
  songId: "tai-yang-zhao-chang-sheng-qi",
  source: { reference: sourceUrl, scope: "Complete selected 17-bar EOP right-hand melody, globally transposed -5 semitones; no harmony or recording claim." },
  melodySpans: [{ from: 0, to: 68, attacks: expected }],
  sourceTotalBeats: 68,
  pitchFit: { sourcePitchClasses: [0, 2, 4, 5, 7, 9, 10], semitoneShift: -5 },
};
const tieEvidence = {
  songId: song.id,
  source: { reference: sourceUrl, scope: "Only the four newly merged explicit same-pitch ties." },
  melodySpans: groups.map(({ span: [from, to], merged }) => ({ from, to, attacks: [merged] })),
};
const reconstructed = structuredClone(song);
for (const field of ["title", "practiceTitle", "scoreTitle", "hint"]) reconstructed[field] = review.originalV1[field];
reconstructed.steps = reconstructed.steps.flatMap(step => {
  const correction = current.tieCorrections.find(({ merged }) => merged[1] === step[1]);
  return correction ? correction.original : [step];
});
reconstructed.sourceFeatures = structuredClone(review.historicalReviewNotes);
const originalBytes = JSON.stringify(reconstructed, null, 2) + "\n";
const phrase = (from, to, value = song) => value.steps.filter(([, beat]) => beat >= from && beat < to);

test("all 56 attacks match the independent complete 17-bar source fixture", () => {
  assert.equal(sourceBars.length, 17);
  assert.equal(fragments.length, 61);
  assert.equal(fragments.filter(({ tied }) => tied).length, 5);
  assert.equal(expected.length, 56);
  assert.equal(tupleHash(expected), reviewedStepsHash);
  assert.deepEqual(song.steps, expected);
  const result = checkTranscriptionEvidence(song, evidence);
  assert.equal(result.reviewedSpans, 1);
  assert.equal(result.checkedAttacks, 56);
  assert.equal(result.checkedSilentWindows, 0);
  assert.deepEqual(result.fittingTranspositions, [7], "-5 semitones has pitch-class shift 7");
  assert.deepEqual(current.reviewedBeatRanges, [[0, 68]]);
  assert.equal(current.selectedMelody.tupleSha256, reviewedStepsHash);
});

test("exactly four proven tie pairs replace eight fragments with four attacks", () => {
  assert.equal(reconstructed.steps.length, 60);
  assert.equal(song.steps.length, 56);
  for (const { span: [from, to], original, merged } of groups) {
    assert.deepEqual(phrase(from, to), [merged]);
    assert.deepEqual(phrase(from, to, reconstructed), original);
    assert.equal(merged[2], original[0][2] + original[1][2]);
    assert.equal(merged[1] + merged[2], to);
    assert.equal(song.steps.some(([, beat]) => beat === original[1][1]), false);
  }
  assert.deepEqual(current.tieCorrections.map(({ span, original, merged }) => ({ span, original, merged })), groups);
  assert.deepEqual(current.changedBeatRanges, groups.map(({ span }) => span));
  assert.deepEqual(current.tieCorrections.map(({ sourceMeasures }) => sourceMeasures), [[2], [10], [12, 13], [14, 15]]);
});

test("old data and each individually restored false reattack fail; corrected ties pass", () => {
  assert.throws(() => checkTranscriptionEvidence(reconstructed, tieEvidence), /attack count differs/);
  assert.throws(() => checkTranscriptionEvidence(reconstructed, evidence), /attack count differs/);
  const result = checkTranscriptionEvidence(song, tieEvidence);
  assert.equal(result.reviewedSpans, 4);
  assert.equal(result.checkedAttacks, 4);
  for (const group of groups) {
    const oldTie = structuredClone(song);
    oldTie.steps = oldTie.steps.flatMap(step => step[1] === group.merged[1] ? group.original : [step]);
    assert.throws(() => checkTranscriptionEvidence(oldTie, tieEvidence), /attack count differs/);
  }
});

test("all 52 other pitch/onset/duration tuples remain exact", () => {
  const untouched = song.steps.filter(([, beat]) => !affectedBeats.has(beat));
  assert.equal(untouched.length, 52);
  assert.equal(tupleHash(untouched), untouchedHash);
  assert.deepEqual(untouched, reconstructed.steps.filter(([, beat]) => !affectedBeats.has(beat)));
  assert.deepEqual(current.unchangedMelody, {
    untouchedAttackCount: 52, untouchedTuplesSha256: untouchedHash,
    changedPitchCount: 0, changedOnsetCount: 0, extendedDurationCount: 4, removedTieContinuationCount: 4,
  });
});

test("existing long tie, separate same-pitch attacks and different-pitch slurs survive", () => {
  assert.deepEqual(phrase(28, 36), [["A3", 28, 5], ["A3", 33, 1], ["C4", 34, 1], ["E4", 35, 1]]);
  assert.deepEqual(phrase(4, 8), [["E4", 4, 2.5], ["E4", 6.5, .5], ["F4", 7, .5], ["G4", 7.5, .5]]);
  assert.deepEqual(phrase(43, 44), [["G4", 43, .75], ["G4", 43.75, .25]]);
  assert.deepEqual(phrase(27, 28), [["B3", 27, .75], ["C4", 27.75, .25]]);
  assert.deepEqual(phrase(1, 4), [["E4", 1, 1], ["E4", 2, 1], ["E4", 3, .75], ["F4", 3.75, .25]]);
  assert.deepEqual(phrase(8, 12), [["A4", 8, 1.5], ["A4", 9.5, .5], ["G4", 10, 1], ["G4", 11, 1]]);
  for (const [start, removed] of [[4, 6.5], [28, 33], [43, 43.75], [27, 27.75]]) {
    const overmerged = structuredClone(song);
    const next = overmerged.steps.find(([, beat]) => beat === removed);
    overmerged.steps.find(([, beat]) => beat === start)[2] += next[2];
    overmerged.steps = overmerged.steps.filter(([, beat]) => beat !== removed);
    assert.throws(() => checkTranscriptionEvidence(overmerged, evidence), /attack count differs/);
  }
  assert.match(current.notationDecision, /different-pitch slur keeps both attacks/);
});

test("the full 68-beat short-arrangement ending has no pickup, rest or repeat expansion", () => {
  assert.equal(song.sourceFeatures.sourceTotalBeats, 68);
  assert.equal(song.sourceFeatures.sourceMeasureCount, 17);
  assert.equal(song.sourceFeatures.hasRepeats, false);
  assert.deepEqual(song.steps.at(-1), ["A3", 64, 4]);
  let cursor = 0;
  for (const [, beat, duration] of song.steps) {
    assert.equal(beat, cursor, "every next attack follows the last hold; no melody gaps or overlaps");
    cursor = beat + duration;
  }
  assert.equal(cursor, 68);
  assert.equal(song.steps.reduce((sum, [,, duration]) => sum + duration, 0), 68);
  assert.deepEqual(current.selectedMelody.melodyRestWindows, []);
  assert.deepEqual(current.ending, { note: "A3", beat: 64, duration: 4, totalBeats: 68, finalRestBeats: 0 });
  assert.equal(current.sourceForm.pickupBeats, 0);
  assert.equal(current.sourceForm.repeatExpansion, false);
  assert.equal(current.sourceForm.finalBarline, "double final barline");
  for (const extent of [64, 72]) {
    const changed = structuredClone(song);
    changed.sourceFeatures.sourceTotalBeats = extent;
    assert.throws(() => checkTranscriptionEvidence(changed, evidence), /sourceTotalBeats/);
  }
  const shortened = structuredClone(song);
  shortened.steps.at(-1)[2] = 3;
  assert.throws(() => checkTranscriptionEvidence(shortened, evidence), /duration differs/);
});

test("one global -5-semitone shift preserves source pitches and fits A3–A4", () => {
  const midi = note => {
    const [, letter, accidental, octave] = /^([A-G])([b#]?)(\d)$/.exec(note);
    return (Number(octave) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
      + (accidental === "b" ? -1 : accidental === "#" ? 1 : 0);
  };
  for (const { sourcePitch, note } of fragments) assert.equal(midi(note) - midi(sourcePitch), -5);
  assert.equal(Math.min(...fragments.map(({ sourcePitch }) => midi(sourcePitch))), midi("D4"));
  assert.equal(Math.max(...fragments.map(({ sourcePitch }) => midi(sourcePitch))), midi("D5"));
  assert.equal(Math.min(...song.steps.map(([note]) => midi(note))), midi("A3"));
  assert.equal(Math.max(...song.steps.map(([note]) => midi(note))), midi("A4"));
  assert.deepEqual([...new Set(fragments.map(({ sourcePitch }) => midi(sourcePitch) % 12))].sort((a, b) => a - b), [0, 2, 4, 5, 7, 9, 10]);
  assert.equal(current.transposition.semitoneShift, -5);
  assert.equal(current.transposition.octaveFolding, false);
  assert.equal(current.transposition.accidentalNaturalization, false);
  assert.equal(compiledPitches[4], "F4", "source Bb is transposed faithfully, not naturalized before shifting");
});

test("the complete original V1 JSON and original source notes reconstruct byte-for-byte", () => {
  assert.equal(hash(originalBytes), originalFileHash);
  assert.equal(review.originalV1.fileSha256, originalFileHash);
  assert.equal(tupleHash(reconstructed.steps), originalStepsHash);
  assert.equal(review.originalV1.stepsSha256, originalStepsHash);
  assert.equal(review.originalV1.attackCount, 60);
  assert.equal(review.originalV1.melodyEndBeat, 68);
  assert.equal(reconstructed.hint, "主旋律练习版；据1=F钢琴简谱转为C调21音卡林巴，保留句尾长音与跨小节连音。");
  assert.deepEqual(reconstructed.sourceFeatures, {
    hasChords: true, hasArpeggio: false, hasRepeats: false,
    unsupported: ["钢琴谱下方伴奏未进入主旋律版；原谱1=F已整体转为C调。"],
    unsureMeasures: ["用户提供手写骨架第9小节写作6低7低1，在线谱源为6低6低1 3，本曲库以在线谱源为准。"],
  });
  assert.deepEqual(song.sourceFeatures.unsureMeasures, reconstructed.sourceFeatures.unsureMeasures);
  assert.deepEqual(song.sourceFeatures.unsupported, reconstructed.sourceFeatures.unsupported);
  assert.match(review.originalV1.restoration, /full original file byte-for-byte/);
  assert.equal(current.historicalConflict.originalNote, reconstructed.sourceFeatures.unsureMeasures[0]);
  assert.equal(current.historicalConflict.status, "preserved-original-source-conflict");
  assert.match(current.historicalConflict.decision, /original handwritten image and Qupu editions were not reverified/);
});

test("112 BPM, 0.82 speed suggestion, meter, key and other top-level data stay unchanged", () => {
  assert.equal(song.bpm, 112);
  assert.equal(song.defaultSpeedFactor, .82);
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.key, "C");
  const stableTopLevel = value => Object.fromEntries(Object.entries(value).filter(([key]) => !["hint", "steps", "sourceFeatures"].includes(key)));
  assert.deepEqual(stableTopLevel(song), stableTopLevel(reconstructed));
  assert.match(current.retainedPracticeTempo, /112 BPM agrees with.*quarter=112/);
  assert.match(current.retainedPracticeTempo, /0.82 default suggests 91.84 BPM, not the actual selected/);
});

test("one selected source edition, actual page fingerprints and pre-edit evidence stay explicit", () => {
  assert.equal(current.status, "reviewed-selected-eop-melody");
  assert.equal(current.adoptedInVersion, "2.4.10");
  assert.equal(current.reviewedOn, "2026-10-12");
  assert.equal(current.sourceEditions.length, 1);
  const [edition] = current.sourceEditions;
  assert.equal(edition.url, sourceUrl);
  assert.equal(edition.numberPage, "https://www.everyonepiano.cn/Number-1896-1.html");
  assert.equal(edition.staffPage, "https://www.everyonepiano.cn/Stave-1896-1.html");
  assert.equal(edition.numberImageSha256, "ad0ca57e223c17f054f469201097de219506834baf79fb4adcfa1117d363e5e0");
  assert.equal(edition.staffImageSha256, "0e1f1554d98fbaefbefb187de8a71ef3a039d879685af29f4b971ffc7a2cb223");
  assert.deepEqual(edition.inspectedMeasures, [1, 17]);
  assert.equal(edition.inspectedPages, 1);
  assert.equal(edition.sourceKey, "F");
  assert.equal(edition.sourceMeter, "4/4");
  assert.equal(edition.sourceTempo, 112);
  assert.equal(edition.sourceTempoBeatUnit, "quarter");
  assert.equal(edition.sourceBeatOrigin, 0);
  assert.match(edition.tempoEvidence, /staff page.*prints no numeric tempo/);
  assert.match(edition.mapping, /Right-hand\/upper melody.*not the highest note/);
  assert.match(edition.independence, /same arrangement, not two independent/);
  assert.deepEqual(current.evidenceFingerprints, {
    sourceReadingSha256: "da27e5b6c96e258f219f50c2eaac8012ef08fb4a032e5ec1b6cdeab4ebe1d844",
    fullMelodyEvidenceSha256: "7aabe343da96b054c33a92b940fca65db722246142e370b440b4f87b88aa908c",
    fourTiesEvidenceSha256: "f3935e1214d9a35f1bb4249afc20b4aadc00c86ccf4a75e1308f17021e3f82ee",
    preEditComparisonSha256: "8db344efa0a141edaafac5dbaf69bee322dfeb3e925a7b1fea7a6e8e77696629",
  });
});

test("V2 bytes, source history and all 60 legacy melody attacks survive; support reuse fails", () => {
  assert.equal(hash(siblingBytes), siblingHash);
  assert.equal(current.accompanimentReview.siblingFileSha256, siblingHash);
  const oldMelody = sibling.events.map(({ beat, duration, notes }) => {
    const melody = notes.filter(({ role }) => role === "melody");
    assert.equal(melody.length, 1);
    assert.equal(melody[0].judge, true);
    return [melody[0].name, beat, duration];
  });
  assert.equal(oldMelody.length, 60);
  assert.deepEqual(oldMelody, reconstructed.steps);
  assert.equal(hasMatchingPracticeMelody(reconstructed, sibling), true, "shared old data is not independent evidence");
  assert.equal(hasMatchingPracticeMelody(song, sibling), false);
  assert.equal(current.accompanimentReview.contentCompatible, false);
  assert.equal(current.accompanimentReview.status, "legacy-sibling-preserved-incompatible");
  assert.equal(current.accompanimentReview.sourceHarmonyApproved, false);
  assert.equal(current.accompanimentReview.addedSupport, false);
  assert.equal(current.accompanimentReview.physicalTarget, "single-melody");
  assert.equal(sibling.autoAccompaniment.events.length, 26);
  assert.equal(sibling.rhythm.sourceStatus, "verified", "historical label is preserved, not endorsed");
  assert.deepEqual(review.historicalV2SourceHistory.sources, sibling.rhythm.sources);
  assert.equal(review.historicalV2SourceHistory.sourceStatus, "verified");
  assert.deepEqual(review.historicalV2SourceHistory.sources.map(({ url }) => url), [
    "https://qupu123.com/Mobile-view-id-378530.html", "https://www.qupu123.com/Mobile-view-id-256604.html", sourceUrl,
  ]);
  for (const field of ["events", "rhythm", "autoAccompaniment", "practiceAccompaniment"]) assert.equal(Object.hasOwn(song, field), false);
});

test("current labels limit acceptance to the selected monophonic short arrangement", () => {
  assert.match(song.hint, /EOP 17小节短编配右手主旋律，56个单音、68拍/);
  assert.match(song.hint, /整体降5半音.*112 BPM.*4处同音延音.*无结尾休止/);
  assert.match(song.hint, /旧伴奏暂不使用.*录音对听与实体琴检查待完成/);
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  assert.equal(song.sourceFeatures.suitability.scope, "selected-eop-17-measure-right-hand-melody");
  assert.equal(current.selectedMelody.physicalTarget, "single-melody");
  assert.equal(current.selectedMelody.voice, "explicit-right-hand-melody");
  assert.equal(current.selectedMelodyNotationReviewed, true);
  for (const key of ["fullOriginalSongApproved", "exactRecordingApproved", "originalHandwrittenImageReverified", "independentEditionCorroborated"]) assert.equal(current[key], false);
  for (const key of ["referenceListening", "browserAudio", "physicalKalimba"]) assert.equal(current[key], "not-performed");
  assert.match(current.limitations, /not approval of the complete original film work, an exact recording, source harmony or physical ease/);
  assert.match(current.limitations, /Public access does not establish public-distribution rights/);
  assert.match(current.limitations, /raw source images stay outside the repository/);
});
