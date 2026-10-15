import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS } from "./build-song-library.mjs";
import { getSongBaseId, hasMatchingPracticeMelody } from "../src/song-store.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const fileHash = bytes => createHash("sha256").update(bytes).digest("hex");
const hash = value => fileHash(JSON.stringify(value));
const song = JSON.parse(await read("data/songs/da-yu-xiao-yu.json"));
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const sourceUrl = "https://www.ccguitar.cn/cchtml/12894419.htm";
const originalFileHash = "e7a90499d051ed5afc10ec564f9bd6dbb870786119b3e9be8e8dc02344173ea0";

// Compact source-pixel decisions recorded before editing the song. Each row
// is one independently inspected vocal bar: degree string, then durations in
// quarter-note beats. This is not generated from production steps. Bar 12's
// parenthesized interlude is outside the selected practice scope.
const sourceBars = [
  ["53423", [.5,.5,.5,.5,2]],
  ["53423", [.5,.5,.5,.5,2]],
  ["53425342", [.5,.5,.5,.5,.5,.5,.5,.5]],
  ["5342111", [.5,.5,.5,.5,.5,.5,1]],
  ["665554", [1,1,.5,.5,.5,.5]],
  ["33345", [.5,.5,.5,.5,2]],
  ["665554", [1,1,.5,.5,.5,.5]],
  ["33342", [.5,.5,.5,.5,2]],
  ["55535553", [.5,.5,.5,.5,.5,.5,.5,.5]],
  ["44424442", [.5,.5,.5,.5,.5,.5,.5,.5]],
  ["5342111", [.5,.5,.5,.5,.5,.5,1]],
];
const mappedPitches = { 1:"C4", 2:"D4", 3:"E4", 4:"F4", 5:"G4", 6:"A4" };
const sourcePitches = { 1:"D4", 2:"E4", 3:"F#4", 4:"G4", 5:"A4", 6:"B4" };
const bars = sourceBars.map(([degrees, durations], index) => {
  assert.equal(degrees.length, durations.length);
  let beat = 4 * index;
  return [...degrees].map((degree, attack) => {
    const step = [mappedPitches[degree], beat, durations[attack]];
    beat += durations[attack];
    return step;
  });
});
const expected = bars.flat();
const evidence = {
  songId:"da-yu-xiao-yu",
  source:{reference:sourceUrl,scope:"Same-edition bars 1-11 vocal melody once; separate bar 12 interlude omitted."},
  melodySpans:bars.map((attacks, index) => ({from:4*index,to:4*(index+1),attacks})),
  sourceTotalBeats:44,
  pitchFit:{sourcePitchClasses:[2,4,6,7,9,11],semitoneShift:-2},
};
const phrase = (from, to) => song.steps.filter(([, beat]) => beat >= from && beat < to);

// Reverse ONLY the reviewed timing correction, retaining all current pitches
// and outside-scope tuples. A full-file fingerprint also protects every old
// property and its original ordering. The original used compact steps tuples.
const reconstructed = structuredClone(song);
reconstructed.hint = review.originalV1.hint;
reconstructed.sourceFeatures = structuredClone(review.historicalReviewNotes);
reconstructed.steps = song.steps.map(([pitch, beat, duration], index) => {
  if (index < 47) return [pitch, beat, duration];
  if (index >= 63) return [pitch, beat + 8, duration];
  const cell = Math.floor((index - 47) / 4), atom = (index - 47) % 4;
  return [pitch, 32 + 4 * cell + [0,1,1.5,2][atom], [1,.5,.5,2][atom]];
});
const originalBytes = JSON.stringify(reconstructed, null, 2)
  .replace(/\[\n      "([A-G][#b]?\d)",\n      ([\d.]+),\n      ([\d.]+)\n    \]/g, '["$1", $2, $3]') + "\n";

test("all 70 vocal attacks match the 11 source-derived bars through the actual evidence checker", () => {
  assert.equal(sourceBars.length, 11);
  assert.equal(expected.length, 70);
  assert.deepEqual(song.steps, expected);
  const result = checkTranscriptionEvidence(song, evidence);
  assert.equal(result.reviewedSpans, 11);
  assert.equal(result.checkedAttacks, 70);
  assert.equal(result.checkedSilentWindows, 0);
  // The same fixture reproduces the precise old-data failure at source bar 9.
  assert.throws(() => checkTranscriptionEvidence(reconstructed, evidence), /span 8: attack count differs/);
});

test("all 70 pitches and the first 47 complete tuples remain exactly frozen", () => {
  assert.equal(song.steps.length, 70);
  assert.equal(hash(song.steps.map(([pitch]) => pitch)), "02c4f0ea23377974e3d7da3cfbb8290838be2910ff5f293f186ea4c40717afd6");
  assert.equal(phrase(0,32).length, 47);
  assert.deepEqual(song.steps.slice(0,47), reconstructed.steps.slice(0,47));
  assert.equal(hash(song.steps.slice(0,47)), "900a4d2e73c55c4c326e6d5e5e9822f82da442acf84b35f3ad7c903666cf068a");
  assert.deepEqual(current.unchangedOpening, {measures:[1,8],beatRange:[0,32],attackCount:47,status:"all-pitch-onset-duration-tuples-unchanged"});
  const changedIndices = song.steps.flatMap((step, index) => JSON.stringify(step) === JSON.stringify(reconstructed.steps[index]) ? [] : [index]);
  assert.deepEqual(changedIndices, Array.from({length:23}, (_, index) => 47 + index));
  for (const index of changedIndices) assert.equal(song.steps[index][0], reconstructed.steps[index][0]);
  assert.equal(current.timingCorrection.changedTupleCount, 23);
  assert.equal(current.timingCorrection.changedPitchCount, 0);
});

test("bars 9 and 10 contain eight eighths each; the seven-note final bar only moves eight beats earlier", () => {
  for (const bar of [8,9]) {
    const notes = phrase(4*bar,4*(bar+1));
    assert.equal(notes.length, 8);
    assert.deepEqual(notes.map(([, beat, duration]) => [beat,duration]), Array.from({length:8}, (_, index) => [4*bar+index/2,.5]));
  }
  assert.deepEqual(song.steps.slice(63), reconstructed.steps.slice(63).map(([pitch,beat,duration]) => [pitch,beat-8,duration]));
  assert.deepEqual(current.timingCorrection.previousMeasureBeatRanges, [[32,40],[40,48],[48,52]]);
  assert.deepEqual(current.timingCorrection.correctedMeasureBeatRanges, [[32,36],[36,40],[40,44]]);
  assert.equal(current.timingCorrection.finalMeasureShiftBeats, -8);
  assert.equal(current.timingCorrection.finalMeasureDurations, "unchanged");
});

test("each 4/4 vocal bar balances without inserted holds, rests, merged repeats or slurred-attack loss", () => {
  assert.equal(song.beatsPerMeasure, 4);
  for (let bar = 0; bar < 11; bar += 1) {
    const notes = phrase(4*bar,4*(bar+1));
    assert.deepEqual(notes, bars[bar], `source bar ${bar+1}`);
    assert.equal(notes.reduce((sum, [, , duration]) => sum + duration, 0), 4);
    assert.equal(notes[0][1], 4*bar);
    assert.equal(notes.at(-1)[1]+notes.at(-1)[2], 4*(bar+1));
    for (let index = 1; index < notes.length; index += 1) assert.equal(notes[index-1][1]+notes[index-1][2], notes[index][1]);
  }
  assert.deepEqual(phrase(32,34), [["G4",32,.5],["G4",32.5,.5],["G4",33,.5],["E4",33.5,.5]]);
  assert.deepEqual(phrase(36,38), [["F4",36,.5],["F4",36.5,.5],["F4",37,.5],["D4",37.5,.5]]);
  assert.match(current.notationDecision, /different pitches as slurs and retain both attacks/);
  assert.match(current.notationDecision, /no same-pitch ties/);
  assert.equal(song.sourceFeatures.hasRepeats, false);
  assert.equal(current.sourceForm.lyricRows, 2);
  assert.equal(current.sourceForm.repeatSignsPrinted, false);
  assert.equal(current.sourceForm.expandedRepeats, false);
});

test("44 beats is the selected vocal extent, not the full 48-beat page or a final four-beat rest", () => {
  assert.deepEqual(song.steps.at(-1), ["C4",43,1]);
  assert.equal(Math.max(...song.steps.map(([,beat,duration]) => beat+duration)), 44);
  assert.equal(song.sourceFeatures.sourceTotalBeats, 44);
  assert.equal(song.sourceFeatures.sourceMeasureCount, 11);
  assert.deepEqual(current.ending, {measure:11,note:"C4",beat:43,duration:1,totalBeats:44,finalRestBeats:0});
  assert.equal(current.sourceForm.printedLinearScoreBeats, 48);
  assert.equal(current.sourceForm.printedMeasureCount, 12);
  assert.equal(current.sourceForm.selectedVocalBeats, 44);
  assert.equal(current.sourceForm.selectedVocalMeasureCount, 11);
  assert.equal(current.sourceForm.writtenRestBeats, 0);
  assert.deepEqual(current.omittedSourceGestures, [{measure:12,beat:44,duration:4,type:"parenthesized-interlude",attackCount:7,outsideSelectedScope:true,sourceWrittenRest:false,sourceAllLayerSilence:false}]);
  assert.equal(current.silentWindows, undefined);
  assert.equal(current.sourceConfirmedRestWindows, undefined);
  assert.match(current.sourceTotalBeatsMeaning, /omitted four beats are not ending silence/);
  assert.match(song.hint, /11小节.*单遍44拍.*省略末尾4拍括号间奏/);
  for (const field of ["events","rhythm","autoAccompaniment","practiceAccompaniment"]) assert.equal(song[field], undefined);
});

test("the complete original JSON and metadata reconstruct byte-for-byte without private inputs", () => {
  assert.equal(fileHash(originalBytes), originalFileHash);
  assert.equal(review.originalV1.fileSha256, originalFileHash);
  assert.equal(hash(reconstructed.steps), "e29625cce2931b8506e92f3e171b879c9d360790ee9fede1e061ef38fb93ea34");
  assert.equal(reconstructed.steps.at(-1)[1]+reconstructed.steps.at(-1)[2], 52);
  assert.equal(reconstructed.hint, "主旋律练习版；按 1=D、4/4 来源谱转为 C 调。");
  assert.deepEqual(review.historicalReviewNotes, {
    hasChords:false,hasArpeggio:false,hasRepeats:false,
    sourceImages:["private/sheets/raw/da-yu-xiao-yu/ccguitar-da-yu-xiao-yu.jpg"],
    unsupported:["括号标注的间奏未作为主旋律练习段展开。"],unsureMeasures:[],
    sources:[{label:"虫虫乐谱《大雨小雨》简谱",url:sourceUrl},{label:"百度文库《儿童趣味发声练声曲谱》搜索摘录",url:"https://set.baidu.com/view/87e3e95c551252d380eb6294dd88d0d233d43c11.html"}],
  });
  assert.equal(song.sourceFeatures.sourceImages, undefined, "the old local path stays historical, not current asset provenance");
});

test("one disclosed -2-semitone transposition preserves pitch intervals and leaves practice tempo unchanged", () => {
  const midi = name => {
    const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(name);
    return (Number(octave)+1)*12 + {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[letter] + (sharp ? 1 : 0);
  };
  for (const degree of Object.keys(mappedPitches)) assert.equal(midi(mappedPitches[degree])-midi(sourcePitches[degree]), -2);
  const allowed = new Set(DISPLAY_KEYS.map(({name}) => name));
  for (const [pitch] of song.steps) assert.ok(allowed.has(pitch));
  assert.deepEqual([...new Set(song.steps.map(([pitch]) => pitch))].sort(), ["A4","C4","D4","E4","F4","G4"]);
  assert.equal(current.sourceKey, "D");
  assert.equal(current.sourceMeter, "4/4");
  assert.equal(current.transpositionSemitones, -2);
  assert.equal(current.octaveFolding, false);
  assert.equal(song.key, "C");
  assert.equal(song.bpm, 92);
  assert.equal(song.defaultSpeedFactor, .9);
  assert.equal(current.sourceTempo, null);
  assert.match(current.retainedPracticeTempo, /92 BPM is a practice choice.*0.9 is a historical suggestion/);
  assert.match(song.hint, /92 BPM 为练习设定/);
});

test("scope metadata names the primary evidence and retains honest unperformed acceptance limits", () => {
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.id, "da-yu-xiao-yu");
  assert.equal(song.difficulty, "easy");
  assert.equal(current.status, "reviewed-vocal-melody-interlude-omitted");
  assert.equal(current.adoptedInVersion, "2.4.6");
  assert.equal(current.sourceUrl, sourceUrl);
  assert.equal(current.sourceImageSha256, "20f666fdba68000b80f72d0254d561e81189742804d2b5f906f22ec8464cde03");
  assert.deepEqual(current.sourceImageDimensions, [1000,1430]);
  assert.deepEqual(current.reviewedMeasures, [1,11]);
  assert.deepEqual(current.reviewedBeatRanges, [[0,44]]);
  assert.equal(current.selectedAttackCount, 70);
  assert.equal(current.selectedVocalScopeBeats, 44);
  assert.deepEqual(song.sourceFeatures.sources.map(({url}) => url), [sourceUrl]);
  assert.equal(current.secondarySourceReview.status, "notation-not-recovered");
  assert.equal(current.secondarySourceReview.url, review.historicalReviewNotes.sources[1].url);
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  for (const field of ["referenceListening","browserAudio","physicalKalimba"]) assert.equal(current[field], "not-performed");
  assert.match(current.limitations, /public-distribution rights remain unapproved/);
});

test("no V2 sibling or accompaniment is introduced, and legacy 52-beat timing cannot supply support", async () => {
  const files = await readdir(new URL("../data/songs/", import.meta.url));
  const songs = await Promise.all(files.filter(file => file.endsWith(".json")).map(async file => JSON.parse(await read(`data/songs/${file}`))));
  assert.deepEqual(songs.filter(candidate => getSongBaseId(candidate) === song.id).map(({id}) => id), [song.id]);
  assert.equal(current.accompanimentReview.status, "no-existing-v2-sibling");
  for (const id of ["da-yu","da-yu-chord"]) {
    const unrelated = songs.find(candidate => candidate.id === id);
    assert.ok(unrelated);
    assert.notEqual(getSongBaseId(unrelated), song.id, "a similar title is not a source sibling");
    assert.equal(hasMatchingPracticeMelody(song, unrelated), false);
  }
  const asV2 = value => ({...value,schemaVersion:2,steps:undefined,events:value.steps.map(([name,beat,duration]) => ({beat,duration,notes:[{name,role:"melody",judge:true}]}))});
  assert.equal(hasMatchingPracticeMelody(song, asV2(reconstructed)), false);
  assert.equal(hasMatchingPracticeMelody(song, asV2(song)), true, "content-compatible synthetic control only; not a harmony approval");
  const incorrectExtent = asV2(song);
  incorrectExtent.sourceFeatures = {...song.sourceFeatures,sourceTotalBeats:48};
  assert.equal(hasMatchingPracticeMelody(song, incorrectExtent), false, "the full printed-page extent cannot become selected vocal ending silence");
});
