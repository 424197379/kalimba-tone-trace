import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS } from "./build-song-library.mjs";
import { getSongBaseId, hasMatchingPracticeMelody } from "../src/song-store.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const song = JSON.parse(await read("data/songs/bie-kan-wo-zhi-shi-yi-zhi-yang.json"));
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const sourceUrl = "https://www.quputu.com/qiyuequpu/kouqin/10234.html";
const originalFileHash = "0b0a2b4cc768f2c3e2f0e36e536550ee23633fab9dc0a3253aa170ef90ef5a3b";
const originalStepsHash = "c057503da62fed876734291dc44531687a2a0277fe9a708cf9cc1759be500055";

// Compact decisions from the independently typed source-pixel fixture, made
// before this metadata change. Every row is a separately inspected two-bar
// phrase, beginning with a dotted-eighth rest; ^ denotes one upper octave dot.
// This is not generated from production steps. The final phrase ends at 63;
// its following rest and chorus pickup are outside the existing excerpt.
const sourcePhrases = [
  ["1^ 1^ 1^ 1^ 7 5 3 5", [.25,.75,.25,.75,.25,.75,.25,4]],
  ["1^ 1^ 1^ 1^ 7 5 3 5 2^", [.25,.75,.25,.75,.25,.75,.25,1,3]],
  ["3^ 3^ 3^ 3^ 2^ 1^ 6 4 2^", [.25,.75,.25,.75,.25,.75,.25,1,3]],
  ["7 7 7 7 6 5 3 3 5", [.25,.75,.25,.75,.25,.75,.25,1,3]],
  ["1^ 1^ 1^ 1^ 7 5 3 5", [.25,.75,.25,.75,.25,.75,.25,4]],
  ["1^ 1^ 1^ 1^ 7 5 3 5 2^", [.25,.75,.25,.75,.25,.75,.25,1,3]],
  ["3^ 3^ 3^ 3^ 2^ 1^ 6 4 2^", [.25,.75,.25,.75,.25,.75,.25,1,3]],
  ["7 7 7 7 1^ 2^ 1^", [.25,.75,.25,.75,.25,1,3]],
];
const pitches = {1:"C4",2:"D4",3:"E4",4:"F4",5:"G4",6:"A4",7:"B4","1^":"C5","2^":"D5","3^":"E5"};
const phrases = sourcePhrases.map(([text, durations], index) => {
  const degrees = text.split(" ");
  assert.equal(degrees.length, durations.length);
  let beat = index * 8 + .75;
  return degrees.map((degree, attack) => {
    const tuple = [pitches[degree], beat, durations[attack]];
    beat += durations[attack];
    return tuple;
  });
});
const expected = phrases.flat();
const rests = Array.from({length:8}, (_, index) => ({beat:8*index,duration:.75}));
const evidence = {
  songId:song.id,
  source:{reference:sourceUrl,scope:"All 68 attacks in editorial source measures 10–25, local [0,63); excludes the following eighth rest and chorus pickup."},
  melodySpans:phrases.map((attacks,index) => ({from:8*index,to:index === 7 ? 63 : 8*(index+1),attacks})),
  silentWindows:rests,
  sourceTotalBeats:63,
  pitchFit:{sourcePitchClasses:[0,2,4,5,7,9,11],semitoneShift:0},
};
const phrase = (from,to) => song.steps.filter(([,beat]) => beat >= from && beat < to);
const reconstructed = structuredClone(song);
for (const field of ["title","practiceTitle","scoreTitle","hint"]) reconstructed[field] = review.originalV1[field];
reconstructed.sourceFeatures = structuredClone(review.historicalReviewNotes);
const originalBytes = JSON.stringify(reconstructed,null,2) + "\n";

test("all 68 unchanged attacks match the independent eight-span source fixture", () => {
  assert.equal(expected.length, 68);
  assert.deepEqual(song.steps, expected);
  assert.equal(hash(JSON.stringify(song.steps)), originalStepsHash);
  assert.deepEqual(song.steps, reconstructed.steps);
  const result = checkTranscriptionEvidence(song, evidence);
  assert.equal(result.reviewedSpans, 8);
  assert.equal(result.checkedAttacks, 68);
  assert.equal(result.checkedSilentWindows, 8);
  assert.deepEqual(current.unchangedMelody, {attackCount:68,changedPitchCount:0,changedOnsetCount:0,changedDurationCount:0,status:"all-pitch-onset-duration-tuples-unchanged"});
});

test("all eight dotted-eighth opening rests and exact internal rhythms survive", () => {
  assert.deepEqual(current.selectedMelodyRests, rests);
  const actualGaps = [];
  let cursor = 0;
  for (const [,beat,duration] of song.steps) {
    if (beat > cursor) actualGaps.push({beat:cursor,duration:beat-cursor});
    assert.ok(beat >= cursor, "the physical melody stays monophonic");
    cursor = beat + duration;
  }
  assert.deepEqual(actualGaps, rests);
  for (let index = 0; index < 8; index += 1) {
    assert.deepEqual(phrase(index*8,index === 7 ? 63 : (index+1)*8), phrases[index]);
    assert.equal(phrases[index][0][1], index*8 + .75);
    assert.equal(phrases[index].reduce((sum,[,,duration]) => sum+duration, .75), index === 7 ? 7 : 8);
  }
  const missingRest = structuredClone(song);
  missingRest.steps.unshift(["C5",0,.75]);
  assert.throws(() => checkTranscriptionEvidence(missingRest, evidence), /attack count differs/);
  assert.throws(() => checkTranscriptionEvidence(missingRest, {...evidence,melodySpans:evidence.melodySpans.slice(1)}), /silence|silent|overlap/i);
});

test("same-pitch reattacks remain separate, with no inferred ties or repeats", () => {
  assert.deepEqual(phrase(.75,2.75), [["C5",.75,.25],["C5",1,.75],["C5",1.75,.25],["C5",2,.75]]);
  assert.deepEqual(phrase(27.75,29), [["E4",27.75,.25],["E4",28,1]]);
  assert.deepEqual(phrase(56.75,60), [["B4",56.75,.25],["B4",57,.75],["B4",57.75,.25],["B4",58,.75],["C5",58.75,.25],["D5",59,1]]);
  assert.equal(song.sourceFeatures.hasRepeats, false);
  assert.equal(current.sourceForm.repeatSignsInSelectedVerse, false);
  assert.equal(current.sourceForm.writtenOutRecurringMaterial, true);
  assert.equal(current.sourceForm.omittedOutroHasRepeatSigns, true);
  assert.match(current.notationDecision, /no same-pitch ties/);
  const merged = structuredClone(song);
  const repeatedIndex = merged.steps.findIndex(([,beat]) => beat === 27.75);
  merged.steps[repeatedIndex][2] += merged.steps[repeatedIndex+1][2];
  merged.steps.splice(repeatedIndex+1,1);
  assert.throws(() => checkTranscriptionEvidence(merged, evidence), /attack count differs/);
});

test("the 63-beat cut excludes the printed following rest and chorus pickup", () => {
  assert.equal(song.beatsPerMeasure, 4);
  assert.deepEqual(song.steps.at(-1), ["C5",60,3]);
  assert.equal(Math.max(...song.steps.map(([,beat,duration]) => beat+duration)), 63);
  assert.equal(song.sourceFeatures.sourceTotalBeats, 63);
  assert.equal(song.sourceFeatures.sourceMeasureCount, undefined, "do not label the cut as 16 complete bars");
  assert.deepEqual(current.ending, {localMeasure:16,editorialSourceMeasure:25,note:"C5",beat:60,duration:3,totalBeats:63,finalRestBeats:0});
  assert.deepEqual(current.excludedBoundaryEvents, [
    {beat:63,duration:.5,type:"written-eighth-rest",outsideSelectedScope:true},
    {beat:63.5,duration:.5,type:"chorus-pickup",note:"C5",outsideSelectedScope:true},
  ]);
  assert.equal(current.sourceForm.selectedCompleteMeasureCount, 15);
  assert.equal(current.sourceForm.selectedTerminalMeasureBeats, 3);
  assert.equal(current.sourceForm.selectedMeasureSpan, 16);
  assert.match(current.sourceTotalBeatsMeaning, /not the full-score extent, sixteen complete bars or an ending-rest claim/);
  assert.match(song.hint, /主歌选段.*68个单音、63拍.*不含其后的八分休止与副歌弱起/);
  const rounded = structuredClone(song);
  rounded.sourceFeatures.sourceTotalBeats = 64;
  assert.throws(() => checkTranscriptionEvidence(rounded,evidence), /sourceTotalBeats/);
  const stretched = structuredClone(song);
  stretched.steps.at(-1)[2] = 4;
  assert.throws(() => checkTranscriptionEvidence(stretched,evidence), /duration|extent|end/i);
});

test("the original full JSON, four display strings and all historical metadata reconstruct exactly", () => {
  assert.equal(hash(originalBytes), originalFileHash);
  assert.equal(review.originalV1.fileSha256, originalFileHash);
  assert.equal(review.originalV1.stepsSha256, originalStepsHash);
  assert.equal(hash(JSON.stringify(reconstructed.steps)), originalStepsHash);
  assert.equal(reconstructed.title, "《别看我只是一只羊》");
  assert.equal(reconstructed.practiceTitle, "《别看我只是一只羊》练习轨道");
  assert.equal(reconstructed.scoreTitle, "《别看我只是一只羊》简谱进度");
  assert.equal(reconstructed.hint, "主歌选段；依据线简谱混排谱保留附点节奏。副歌含升4，不纳入21音自然音版本；非全曲。");
  assert.equal(review.historicalReviewNotes.hasChords, false);
  assert.equal(review.historicalReviewNotes.sourceTotalBeats, undefined);
  assert.equal(review.historicalReviewNotes.sources.length, 4);
  assert.equal(review.historicalReviewNotes.sources[0].url, "https://www.qupu123.com/qiyue/kouqin/p89823.html");
  assert.match(review.historicalReviewNotes.sources[0].label, /最易上手！口琴独奏超精选/);
  assert.match(review.historicalReviewNotes.suitability.reviewRequired[1], /浏览器发声与时序已检查/);
  assert.match(current.historicalBrowserClaim, /retained only in historicalReviewNotes and was not rerun/);
});

test("the selected seven natural classes fit without shifting; the chorus's eighth class cannot", () => {
  const allowed = new Set(DISPLAY_KEYS.map(({name}) => name));
  for (const [pitch] of song.steps) assert.ok(allowed.has(pitch));
  const naturalClasses = new Set([0,2,4,5,7,9,11]);
  const classOf = note => ({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[note[0]];
  assert.deepEqual([...new Set(song.steps.map(([note]) => classOf(note)))].sort((a,b) => a-b), [...naturalClasses]);
  assert.deepEqual([...new Set(song.steps.map(([note]) => note))].sort(), ["A4","B4","C5","D5","E4","E5","F4","G4"]);
  assert.deepEqual(current.pitchFit.selectedRange, ["E4","E5"]);
  assert.deepEqual(current.pitchFit.selectedSourcePitchClasses, [...naturalClasses]);
  assert.equal(current.pitchFit.omittedEssentialPitch, "F#");
  assert.equal(current.pitchFit.combinedPitchClassCount, 8);
  const combined = [...naturalClasses,6];
  const possibleShifts = Array.from({length:12},(_,n) => n).filter(shift => combined.every(pc => naturalClasses.has((pc+shift)%12)));
  assert.deepEqual(possibleShifts, []);
  assert.equal(current.pitchFit.fullSongNaturalNoteFit, false);
  assert.equal(song.key, "C");
  assert.equal(current.sourceKey, "C");
  assert.equal(current.transpositionSemitones, 0);
  assert.equal(current.octaveFolding, false);
});

test("tempo, source attribution and acceptance limits remain scoped and honest", () => {
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.id, "bie-kan-wo-zhi-shi-yi-zhi-yang");
  assert.equal(song.title, "《别看我只是一只羊》（主歌选段）");
  assert.equal(song.difficulty, "medium");
  assert.equal(song.bpm, 120);
  assert.equal(song.defaultSpeedFactor, .8);
  assert.equal(current.sourceTempo, null);
  assert.match(current.retainedPracticeTempo, /numeric tempo is not printed.*0.8 default is only a suggestion.*not the actual selected/);
  assert.match(song.hint, /120 BPM 为沿用的练习设定/);
  assert.equal(current.status, "reviewed-selected-verse-excerpt");
  assert.equal(current.adoptedInVersion, "2.4.8");
  assert.equal(current.sourceUrl, sourceUrl);
  assert.deepEqual(song.sourceFeatures.sources.map(({url}) => url), [sourceUrl]);
  assert.equal(current.sourceBeatOrigin, 36);
  assert.deepEqual(current.reviewedMeasures, [10,25]);
  assert.deepEqual(current.reviewedBeatRanges, [[0,63]]);
  assert.equal(current.selectedAttackCount, 68);
  assert.deepEqual(current.sourceImages.map(({dimensions}) => dimensions), [[1015,1275],[972,1302]]);
  assert.deepEqual(current.sourceImages.map(({sha256}) => sha256), ["1045752a16a6eb6ea20f48cdae0e714093130a7313de54985135f993562b9dd3","9931f94a9d41945a14e5a439259da256a3d1b2a6a0522e00ddbac698c4a500fd"]);
  assert.match(current.provenanceLimit, /not an independent musical arrangement.*claimed book attribution were not reverified/);
  assert.deepEqual(current.alternateEditionReview.map(({status}) => status), ["different-f-major-vocal-edition","different-f-major-piano-edition","public-preview-not-recovered"]);
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  assert.equal(song.sourceFeatures.suitability.scope, "verse-excerpt");
  for (const field of ["referenceListening","browserAudio","physicalKalimba"]) assert.equal(current[field], "not-performed");
  assert.match(current.limitations, /public-distribution rights remain unapproved/);
});

test("printed chord symbols add no physical chord targets, sibling or accompaniment", async () => {
  assert.equal(song.sourceFeatures.hasChords, true);
  assert.equal(song.sourceFeatures.hasArpeggio, false);
  assert.match(current.chordSymbolDecision, /source features only.*one main-melody note at a time/);
  assert.deepEqual(current.accompanimentReview, {status:"no-existing-v2-sibling",addedSupport:false,physicalTarget:"single-melody"});
  for (const field of ["events","rhythm","autoAccompaniment","practiceAccompaniment"]) assert.equal(song[field], undefined);
  const files = await readdir(new URL("../data/songs/", import.meta.url));
  const songs = await Promise.all(files.filter(file => file.endsWith(".json")).map(async file => JSON.parse(await read(`data/songs/${file}`))));
  assert.deepEqual(songs.filter(candidate => getSongBaseId(candidate) === song.id).map(({id}) => id), [song.id]);
  const asV2 = value => ({...value,schemaVersion:2,steps:undefined,events:value.steps.map(([name,beat,duration]) => ({beat,duration,notes:[{name,role:"melody",judge:true}]}))});
  assert.equal(hasMatchingPracticeMelody(song,asV2(reconstructed)), true, "unchanged melody/BPM/effective extent; this is not harmony approval");
  const wrongExtent = asV2(song);
  wrongExtent.sourceFeatures = {...song.sourceFeatures,sourceTotalBeats:64};
  assert.equal(hasMatchingPracticeMelody(song,wrongExtent), false, "do not borrow support for the chorus pickup or a rounded full bar");
});
