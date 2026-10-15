import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hasMatchingPracticeMelody } from "../src/song-store.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const tupleHash = tuples => hash(JSON.stringify(tuples));
// Freeze the earlier two-tie-only decision against its complete archived bytes.
// The newly selected full teaching edition has its own source-derived suite.
const song = JSON.parse(await read("data/archives/tong-nian-v2.4.37.json"));
const siblingBytes = await read("data/songs/tong-nian-chord.json");
const sibling = JSON.parse(siblingBytes);
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const originalFileHash = "9689322aa12a8744b4236ab7ab514028819b7078644d014aacb2e17c9d1257b3";
const originalStepsHash = "2d10a570f331f54c4225db4a6e417352aa9806182112f664c6329a1f44634ee6";
const untouchedHash = "ec64ef22799d4aa784f768eca5fb45f85736bdbceae83a7079d129bf2e8f0ad6";
const laterHash = "8f624a73ec7a525b5ba2052ca4563e3a03bc17baa2fec73ddb7d5f3593b8e5be";
const siblingHash = "f370fb5ddb5e936afd7c16f5c8f9eaa4dab789b4ce5e052b071c6200a4fe8260";
const sourceUrl = "https://www.guitarworld.com.cn/pu/q36774";
const comparisonUrl = "https://music.hgnu.edu.cn/_upload/article/files/09/d4/faf43ffb4e08b61cf64ee0adaf16/ec5df379-7cae-4b24-9ece-880a54ee478b.pdf";

// Compact expectations copied from an independently entered source-pixel
// fixture made before production edits. Only two tie decisions are adopted;
// the complete third-party score and comparison fixture remain private.
const groups = [
  { span: [2, 3.5], original: [["G4", 2, 1], ["G4", 3, .5]], merged: ["G4", 2, 1.5] },
  { span: [5.5, 6.5], original: [["A4", 5.5, .5], ["A4", 6, .5]], merged: ["A4", 5.5, 1] },
];
const affectedBeats = new Set(groups.flatMap(({ original }) => original.map(([, beat]) => beat)));
const evidence = {
  songId: "tong-nian",
  source: {
    reference: `${sourceUrl} public preview m5–6; independently compared with ${comparisonUrl}, PDF p46 / printed p42, vocal bars 1–2.`,
    scope: "Only the common same-pitch ties G4[2,3.5) and A4[5.5,6.5); no other melody, rest, register, tempo, ending or form decision.",
  },
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

test("exactly two confirmed same-pitch tie groups become single attacks", () => {
  assert.equal(song.steps.length, 81);
  for (const { span: [from, to], original, merged } of groups) {
    assert.deepEqual(phrase(from, to), [merged]);
    assert.deepEqual(phrase(from, to, reconstructed), original);
    assert.equal(merged[2], original[0][2] + original[1][2]);
    assert.equal(merged[1] + merged[2], original[1][1] + original[1][2]);
    assert.equal(song.steps.some(([, beat]) => beat === original[1][1]), false);
  }
  assert.deepEqual(current.tieCorrections.map(({ span, original, merged }) => ({ span, original, merged })), groups);
  assert.deepEqual(current.reviewedBeatRanges, [[2, 3.5], [5.5, 6.5]]);
});

test("the old retrigger counterexample fails source evidence and the corrected scope passes", () => {
  assert.throws(() => checkTranscriptionEvidence(reconstructed, evidence), /attack count differs/);
  const result = checkTranscriptionEvidence(song, evidence);
  assert.equal(result.reviewedSpans, 2);
  assert.equal(result.checkedAttacks, 2);
  assert.equal(result.checkedSilentWindows, 0, "no disputed rest is adopted");
  assert.equal(Object.hasOwn(evidence, "sourceTotalBeats"), false, "64 is a legacy extent, not a reviewed ending");
  for (const group of groups) {
    const oneTieUndone = structuredClone(song);
    oneTieUndone.steps = oneTieUndone.steps.flatMap(step => step[1] === group.merged[1] ? group.original : [step]);
    assert.throws(() => checkTranscriptionEvidence(oneTieUndone, evidence), /attack count differs/);
  }
});

test("all 79 other tuples and all 70 attacks from beat 8 onward are frozen", () => {
  const untouched = song.steps.filter(([, beat]) => !affectedBeats.has(beat));
  assert.equal(untouched.length, 79);
  assert.equal(tupleHash(untouched), untouchedHash);
  assert.deepEqual(untouched, reconstructed.steps.filter(([, beat]) => !affectedBeats.has(beat)));
  const later = phrase(8, Infinity);
  assert.equal(later.length, 70);
  assert.equal(tupleHash(later), laterHash);
  assert.deepEqual(later, phrase(8, Infinity, reconstructed));
  assert.deepEqual(current.unchangedMelody, {
    untouchedAttackCount: 79, untouchedTuplesSha256: untouchedHash,
    laterBeatOrigin: 8, laterAttackCount: 70, laterTuplesSha256: laterHash,
  });
  // A similar later occurrence is not evidence that its ties were reviewed.
  assert.deepEqual(phrase(18, 19.5), [["G4", 18, 1], ["G4", 19, .5]]);
  assert.deepEqual(phrase(21.5, 22.5), [["A4", 21.5, .5], ["A4", 22, .5]]);
});

test("true repeated attacks and different-pitch following notes are never merged by adjacency", () => {
  assert.deepEqual(phrase(1.5, 4), [["G4", 1.5, .5], ["G4", 2, 1.5], ["E4", 3.5, .5]]);
  assert.deepEqual(phrase(4, 8), [
    ["A4", 4, .5], ["A4", 4.5, .5], ["B4", 5, .5], ["A4", 5.5, 1],
    ["A4", 6.5, .5], ["A4", 7, .5], ["G4", 7.5, .5],
  ]);
  const overmerged = structuredClone(song);
  overmerged.steps.find(([, beat]) => beat === 5.5)[2] = 1.5;
  overmerged.steps = overmerged.steps.filter(([, beat]) => beat !== 6.5);
  assert.throws(() => checkTranscriptionEvidence(overmerged, evidence), /duration differs/);
  assert.match(current.notationDecision, /E4@3.5 and A4@6.5 are separate following attacks/);
});

test("the unresolved C5 articulation and final-quarter-rest conflicts keep legacy values", () => {
  assert.deepEqual(phrase(8, 12), [
    ["C5", 8, 1], ["C5", 9, 1], ["C5", 10, .5], ["A4", 10.5, .5], ["C5", 11, .5], ["A4", 11.5, .5],
  ]);
  assert.deepEqual(phrase(12, 17), [["G4", 12, 4]]);
  assert.deepEqual(current.excludedEditionConflicts.map(({ span, retainedLegacy }) => ({ span, retainedLegacy })), [
    { span: [9, 10], retainedLegacy: ["C5", 9, 1] },
    { span: [15, 16], retainedLegacy: ["G4", 12, 4] },
  ]);
  assert.match(current.excludedEditionConflicts[0].hgnu, /separately attacked at 9 and 9.5/);
  assert.match(current.excludedEditionConflicts[1].guitarworld, /quarter rest/);
  assert.ok(current.excludedEditionConflicts.every(({ decision }) => /Unresolved.*no change/i.test(decision)));
  const gaps = [];
  let end = 0;
  for (const [, beat, duration] of song.steps) {
    assert.ok(beat >= end, "the practice melody remains monophonic");
    if (beat > end) gaps.push([end, beat]);
    end = beat + duration;
  }
  assert.deepEqual(gaps, [[0, 1], [16, 17]]);
});

test("the original full JSON and all historical source metadata reconstruct byte-for-byte", () => {
  assert.equal(hash(originalBytes), originalFileHash);
  assert.equal(review.originalV1.fileSha256, originalFileHash);
  assert.equal(reconstructed.steps.length, 83);
  assert.equal(tupleHash(reconstructed.steps), originalStepsHash);
  assert.equal(review.originalV1.stepsSha256, originalStepsHash);
  assert.equal(review.originalV1.attackCount, 83);
  assert.equal(review.originalV1.melodyEndBeat, 64);
  assert.equal(reconstructed.hint, "依据网上完整谱面重新校对的主旋律练习段，修正旧版低音点与中音区混读问题。");
  assert.equal(review.historicalReviewNotes.sourceImages.length, 6);
  assert.deepEqual(review.historicalReviewNotes.sources.map(({ url }) => url), [
    "https://www.qupu123.com/Mobile-view-id-290148.html", sourceUrl,
    "https://www.sohu.com/a/531241905_121124710",
  ]);
  assert.deepEqual(review.historicalReviewNotes.unsureMeasures, []);
  assert.match(review.originalV1.restoration, /full original file byte-for-byte/);
});

test("BPM 105, practice suggestion, meter, key and the 64-beat legacy extent are unchanged", () => {
  assert.equal(song.bpm, 105);
  assert.equal(song.defaultSpeedFactor, .9);
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.key, "C");
  assert.deepEqual(song.steps.at(-1), ["C5", 60, 4]);
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 64);
  assert.equal(song.steps.reduce((sum, [,, duration]) => sum + duration, 0), 62);
  assert.equal(current.encodedExtentBeats, 64);
  assert.equal(Object.hasOwn(song.sourceFeatures, "sourceTotalBeats"), false);
  assert.match(current.encodedExtentMeaning, /not a newly verified source ending/);
  assert.match(current.retainedPracticeTempo, /105 BPM.*GuitarWorld prints quarter=120.*HGNU prints no tempo/);
  assert.match(current.retainedPracticeTempo, /0.9 default suggests 94.5 BPM.*not the actual selected/);
  const stableTopLevel = value => Object.fromEntries(Object.entries(value).filter(([key]) => !["hint", "steps", "sourceFeatures"].includes(key)));
  assert.deepEqual(stableTopLevel(song), stableTopLevel(reconstructed));
});

test("source mapping, crop fingerprints and only the adopted tie ranges remain explicit", () => {
  assert.equal(current.status, "reviewed-opening-common-ties");
  assert.equal(current.adoptedInVersion, "2.4.9");
  assert.equal(current.reviewedOn, "2026-10-12");
  assert.deepEqual(song.sourceFeatures.sources.map(({ url }) => url), [sourceUrl, comparisonUrl]);
  const [primary, comparison] = current.sourceEditions;
  assert.equal(primary.url, sourceUrl);
  assert.equal(primary.sourceKey, "C");
  assert.equal(primary.sourceTempo, 120);
  assert.equal(primary.sourceTempoBeatUnit, "quarter");
  assert.equal(primary.sourceBeatOrigin, 16);
  assert.equal(primary.comparisonSemitoneShift, 0);
  assert.deepEqual(primary.adoptedMeasures, [5, 6]);
  assert.deepEqual(primary.cropBounds, [100, 560, 1100, 810]);
  assert.equal(primary.imageSha256, "0d8f21d7777836dcc04877ff1a54d15ee3effffdf77dd5c841c76bbca41ccbdc");
  assert.equal(primary.cropSha256, "e645fbacef9256871031f90e9ce5669c6b8a5d4de087da3ef67fffb27c6c70a6");
  assert.match(primary.mapping, /minus 16 = app beat.*lyric-aligned numbered melody/);
  assert.match(primary.accessLimit, /full two-page score requires login\/purchase and was not accessed/);
  assert.equal(comparison.url, comparisonUrl);
  assert.equal(comparison.sourceKey, "G");
  assert.equal(comparison.sourceTempo, null);
  assert.equal(comparison.sourceBeatOrigin, 0);
  assert.equal(comparison.comparisonSemitoneShift, -7);
  assert.equal(comparison.pdfPage, 46);
  assert.equal(comparison.printedPage, 42);
  assert.deepEqual(comparison.adoptedVocalMeasures, [1, 2]);
  assert.deepEqual(comparison.cropBounds, [240, 1430, 1200, 1580]);
  assert.equal(comparison.pdfSha256, "bee5c8a881de14db9b9c53f8a3f1273ac617f31ef4bad14b6d84597ff987235b");
  assert.equal(comparison.cropSha256, "4f9960268f5b432e41543da688884a645ebfbee02323c928b8395f78992f8ba6");
  assert.match(comparison.mapping, /every octave dot for comparison only/);
  assert.equal(current.productionTranspositionSemitones, 0);
  assert.equal(current.octaveFolding, false);
  assert.equal(current.evidenceFingerprints.privateOpeningFixtureSha256, "1f4343971a840761af392bb06399949d9a50b220102ddb9c7ae61fc833d79e21");
  assert.equal(current.evidenceFingerprints.privateCommonTiesEvidenceSha256, "49f8ad35e854b45629ee66174f2e746e977430332368eb953becca26fa242e5e");
});

test("V2 bytes and all 83 old explicit-melody tuples survive while the support guard rejects reuse", () => {
  assert.equal(hash(siblingBytes), siblingHash);
  assert.equal(current.accompanimentReview.siblingFileSha256, siblingHash);
  const oldMelody = sibling.events.map(({ beat, duration, notes }) => {
    const melody = notes.filter(({ role }) => role === "melody");
    assert.equal(melody.length, 1);
    assert.equal(melody[0].judge, true);
    return [melody[0].name, beat, duration];
  });
  assert.equal(oldMelody.length, 83);
  assert.deepEqual(oldMelody, reconstructed.steps);
  assert.equal(hasMatchingPracticeMelody(reconstructed, sibling), true, "shared legacy data is not independent source evidence");
  assert.equal(hasMatchingPracticeMelody(song, sibling), false);
  assert.equal(current.accompanimentReview.contentCompatible, false);
  assert.equal(current.accompanimentReview.status, "legacy-sibling-preserved-incompatible");
  assert.equal(current.accompanimentReview.addedSupport, false);
  assert.equal(current.accompanimentReview.physicalTarget, "single-melody");
  assert.equal(sibling.autoAccompaniment.events.length, 16);
  assert.equal(sibling.rhythm.sourceStatus, "verified", "historical label is preserved, not endorsed");
  for (const field of ["events", "rhythm", "autoAccompaniment", "practiceAccompaniment"]) assert.equal(Object.hasOwn(song, field), false);
});

test("archived opening-only hint and acceptance limits never promote a two-tie review to whole-opening approval", () => {
  assert.match(song.hint, /64拍主歌练习段，非全曲.*仅校正开头两处同音延音.*81个单音/);
  assert.match(song.hint, /其余音符与版本差异待核.*105 BPM 沿用练习设定.*旧伴奏暂不使用/);
  assert.doesNotMatch(song.hint, /完整谱面重新校对/);
  assert.equal(song.sourceFeatures.suitability.status, "needs-review");
  for (const key of ["fullOpeningApproved", "fullExcerptApproved", "fullSongApproved", "originalPrivateImagesReverified"]) assert.equal(current[key], false);
  for (const key of ["referenceListening", "browserAudio", "physicalKalimba"]) assert.equal(current[key], "not-performed");
  assert.match(current.limitations, /No complete opening, 64-beat excerpt/);
  assert.match(current.limitations, /Public access does not establish public-distribution rights/);
  assert.match(current.limitations, /raw source images and the complete comparison fixture stay outside the repository/);
  assert.match(current.originalSourceLimits, /Qupu was not reverified.*Sohu returned HTTP 403 and was not bypassed/);
  assert.match(current.sourceForm, /no newly approved repeat expansion or full-song form/);
});
