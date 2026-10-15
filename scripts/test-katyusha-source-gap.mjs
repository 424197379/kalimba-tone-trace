import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS } from "./build-song-library.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const song = JSON.parse(await read("data/songs/katyusha.json"));
const siblingBytes = await read("data/songs/katyusha-chord.json");
const sibling = JSON.parse(siblingBytes);
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const originalFileHash = "7de14e131a9055ff88a21310e8e6095496152b21034469eee851caec9458fbf3";
const originalStepsHash = "2da07ced7b54f17cf8fdabe793b354adf3bff7b4da635f3c8762904d727a55ac";
const siblingFileHash = "de452ca36de8add09257934ec3cb1e59f09c0f8b181ba14fb02fefe19367640c";
const sourceUrl = "https://www.jitabang.com/jiaoxue/8653.html";
const firstImageUrl = "https://www.jitabang.com/img/2022/03/2022031503441716.png";
const secondImageUrl = "https://www.jitabang.com/img/2022/03/2022031503445225.png";
const comparisonUrl = "https://www.barynya.com/balalaika/images/katyusha.pdf";

// These immutable fingerprints freeze legacy production data. They are NOT a
// source-derived expected melody and do not prove transcription correctness.
test("all 73 legacy pitch/onset/duration tuples and playback parameters stay unchanged", () => {
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.id, "katyusha");
  assert.equal(song.steps.length, 73);
  assert.equal(hash(JSON.stringify(song.steps)), originalStepsHash);
  assert.equal(review.originalV1.stepsSha256, originalStepsHash);
  assert.equal(song.bpm, 112);
  assert.equal(song.defaultSpeedFactor, .9);
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.key, "C");
  assert.equal(song.difficulty, "medium");
  assert.equal(song.practiceTitle, "《喀秋莎》练习轨道");
  assert.equal(song.scoreTitle, "《喀秋莎》简谱进度");
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 44);
  assert.equal(song.steps.reduce((sum, [, , duration]) => sum + duration, 0), 41);
  const gaps = song.steps.flatMap(([, beat, duration], index) => {
    const next = song.steps[index + 1];
    return next && next[1] > beat + duration ? [[beat + duration, next[1]]] : [];
  });
  assert.deepEqual(gaps, [[16,17], [25,26], [34,35]]);
  assert.deepEqual(song.steps.at(-1), ["A4",42,2]);
  assert.deepEqual(current.retainedEncoding, {
    attackCount:73, endBeat:44, soundingBeats:41, range:["E4","E5"],
    bpm:112, beatsPerMeasure:4, allTuplesUnchanged:true
  });
});

test("the complete old JSON bytes, including original title, hint and metadata, are reconstructible", () => {
  const reconstructed = structuredClone(song);
  reconstructed.title = review.originalV1.title;
  reconstructed.hint = review.originalV1.hint;
  reconstructed.sourceFeatures = structuredClone(review.historicalReviewNotes);
  assert.equal(hash(JSON.stringify(reconstructed, null, 2) + "\n"), originalFileHash);
  assert.equal(review.originalV1.fileSha256, originalFileHash);
  assert.equal(review.originalV1.file, "data/songs/katyusha.json");
  assert.equal(review.originalV1.title, "《喀秋莎》");
  assert.equal(review.originalV1.hint, "这里放的是适合 21 音卡林巴的《喀秋莎》简化主旋律练习版，按 4/4 推进，保留了民歌式上行和句尾停顿。");
  assert.deepEqual(review.historicalReviewNotes, {
    hasChords:true, hasArpeggio:true, hasRepeats:true,
    unsupported:[
      "V1 steps keep the 21-key kalimba 4/4 practice melody; Jitabang 1=C 2/4 guitar source is not fully expanded.",
      "The 2/4 source grouping differs from the current 4/4 practice grouping."
    ],
    unsureMeasures:["Current practice version and Jitabang 2/4 source need meter and repeat review."]
  });
  assert.match(review.historicalProvenance.status, /not renewed source verification/);
  assert.equal(review.historicalProvenance.firstVisibleRepositoryCommit, "fc8712e");
  assert.equal(review.historicalProvenance.sourceMetadataCommit, "c0df063");
  assert.equal(review.historicalProvenance.originalPrivatePhotosReverified, false);
});

test("the historical V2 bytes and shared melody are preserved without new backing", () => {
  assert.equal(hash(siblingBytes), siblingFileHash);
  assert.equal(review.preservedV2.fileSha256, siblingFileHash);
  assert.equal(review.preservedV2.file, "data/songs/katyusha-chord.json");
  assert.equal(review.preservedV2.status, "historical-unchanged-source-mapping-unresolved");
  const siblingMelody = sibling.events.map(event => {
    const melody = event.notes.filter(note => note.role === "melody");
    assert.equal(melody.length, 1, `unique explicit historical melody at ${event.beat}`);
    return [melody[0].name, event.beat, event.duration];
  });
  assert.deepEqual(siblingMelody, song.steps);
  assert.equal(review.preservedV2.explicitMelodyMatchesCurrent, true);
  assert.match(review.preservedV2.independence, /not independent source corroboration/);
  assert.match(review.preservedV2.supportReview, /unchanged and unapproved.*No new support is added or borrowed/);
  for (const field of ["events", "rhythm", "autoAccompaniment", "practiceAccompaniment"]) {
    assert.equal(Object.hasOwn(song, field), false, field);
  }
});

test("current disclosure names an unresolved source mapping rather than a meter-only correction", () => {
  assert.equal(song.title, "《喀秋莎》（待核版）");
  assert.match(song.hint, /保留旧版73音、44拍/);
  assert.match(song.hint, /当前旋律与所列来源的对应关系尚未解决，未获来源校准/);
  assert.match(song.hint, /4\/4分组、音高和时值暂不改动/);
  assert.equal(current.status, "unresolved-melody-source-mapping");
  assert.equal(current.reviewedInVersion, "2.4.8");
  assert.equal(current.date, "2026-10-12");
  assert.equal(current.currentMelodySourceMapping, "unresolved");
  assert.deepEqual(current.reviewedBeatRanges, []);
  assert.deepEqual(current.unresolvedBeatRanges, [[0,44]]);
  assert.equal(current.sourceCalibrated, false);
  assert.equal(current.fullSongApproved, false);
  assert.match(current.openingComparison, /vocal opening m17–18.*instrumental start m9/);
  assert.match(current.openingComparison, /Changing meter.*cannot establish.*no safe isolated note correction/);
  assert.match(song.sourceFeatures.unsupported.join(" "), /pitches and rhythm, not only 4\/4 versus 2\/4/);
  assert.equal(song.sourceFeatures.suitability.status, "needs-review");
  assert.match(song.sourceFeatures.suitability.scope, /Retained 73-attack, 44-beat.*mapping unresolved/);
  assert.equal(Object.hasOwn(song.sourceFeatures, "sourceTotalBeats"), false,
    "the encoded end must not acquire another edition's source-ending claim");
  assert.equal(Object.hasOwn(song.sourceFeatures, "sourceMeasureCount"), false);
});

test("review provenance links the exact inspected sources and private evidence fingerprints", () => {
  assert.deepEqual(review.sources.map(({url}) => url), [sourceUrl,firstImageUrl,secondImageUrl,comparisonUrl]);
  assert.equal(current.sourceUrl, sourceUrl);
  assert.deepEqual(current.sourceImages, [
    {page:1, url:firstImageUrl, sha256:"1e735786aa5fa396c236be5c281e2ed1282bfbed8c89985590bd5f6c5b3058f0", dimensions:[1200,1604]},
    {page:2, url:secondImageUrl, sha256:"4e428b9d15282fc1d09b98a0a5ae9b9d474534a13676515aaf3e40cb4cc93c65", dimensions:[1200,1704]}
  ]);
  assert.equal(current.independentComparison.url, comparisonUrl);
  assert.equal(current.independentComparison.sha256, "1879259b25a95c095b3f8febb08ecb62fbbf7e6e21f2c52cae01d2b49175d108");
  assert.match(current.independentComparison.scope, /different edition.*not adopted or spliced/);
  assert.deepEqual(current.sourceHeader, {
    key:"C", meter:"2/4", bpm:112,
    pitchBasis:"Printed note names without capo transposition; male capo 5 sounding pitch is not mixed into this review."
  });
  assert.deepEqual(current.evidenceFingerprints, {
    privateAuditSha256:"e83f20f87cf98f9c1d59f5aa0253ba5c8d9f6f6b9ae2ef1b0a0a66d1d18405c6",
    privateFixtureSha256:"ca63dba40cf0b6f828e735b34fc450afca67850c66e87fa4236b027e719959ea",
    comparisonSha256:"3319b9fe753ca88a30b3b29ed6a1da11e5e64a6ed5c8bbcb120e87fc4da02b8f"
  });
});

test("the 61-note source excerpt is explicitly unadopted and has no playable production data", () => {
  const candidate = current.inspectedAlternativeExcerpt;
  assert.equal(candidate.status, "inspected-not-adopted");
  assert.deepEqual(candidate.measures, [17,40]);
  assert.equal(candidate.attackCount, 61);
  assert.equal(candidate.measureCount, 24);
  assert.deepEqual(candidate.printedRange, ["E3","A4"]);
  assert.equal(candidate.candidateGlobalOctaveShiftSemitones, 12);
  assert.deepEqual(candidate.candidateRange, ["E4","A5"]);
  assert.match(candidate.naturalPitchFit, /Only this selected first vocal pass.*not the complete printed arrangement or the current production melody/);
  assert.match(candidate.remainingDecision, /verify low-E engraving\/register intent/);
  assert.match(candidate.remainingDecision, /Do not replace those notes from Barynya or encode this candidate/);
  const playableArrays = [];
  function findPlayableArrays(value, path = "song") {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (["steps", "events", "notation", "attacks"].includes(key) && Array.isArray(child)) playableArrays.push(`${path}.${key}`);
      findPlayableArrays(child, `${path}.${key}`);
    }
  }
  findPlayableArrays(song);
  assert.deepEqual(playableArrays, ["song.steps"]);
});

test("the full Jitabang chromatic constraint is scoped separately from the natural legacy melody", () => {
  const full = current.completePrintedEditionConstraint;
  assert.match(full.scope, /Complete Jitabang printed edition.*fifth-ending melody at m41–42/);
  assert.deepEqual(full.melodyAccidentals, ["F#","G#"]);
  assert.deepEqual(full.melodyPitchClasses, [0,2,4,5,6,7,8,9,11]);
  const natural = new Set([0,2,4,5,7,9,11]);
  const validShifts = Array.from({length:12}, (_, i) => i)
    .filter(shift => full.melodyPitchClasses.every(pc => natural.has((pc + shift) % 12)));
  assert.deepEqual(validShifts, []);
  assert.deepEqual(full.validGlobalPitchClassTranspositions, validShifts);
  const allowed = new Set(DISPLAY_KEYS.map(({name}) => name));
  for (const [pitch] of song.steps) assert.ok(allowed.has(pitch), pitch);
  assert.match(full.currentEncodingVerdict, /not a chromatic rejection of the current all-natural 73-note encoding/);
  assert.match(full.currentEncodingVerdict, /proof that its notes were naturalized, or a verdict on every Katyusha edition/);
  assert.match(song.sourceFeatures.suitability.reason, /not a blanket rejection of this song/);
});

test("listening, original-photo verification and publication remain outside the completed review", () => {
  for (const field of ["browserAudio", "referenceListening", "physicalKalimba"]) assert.equal(current[field], "not-performed");
  assert.equal(current.originalPrivatePhotosReverified, false);
  assert.match(current.limitations, /No current-note source mapping.*source-confirmed ending.*A\/B listening or physical play-through is claimed/);
  assert.match(current.limitations, /does not establish public-distribution rights/);
  assert.match(current.limitations, /raw scans and the complete independent fixture stay outside the public repository/);
  assert.match(current.limitations, /44-beat encoded end is not a verified source ending/);
});
