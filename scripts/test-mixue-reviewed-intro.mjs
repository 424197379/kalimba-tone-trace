import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS } from "./build-song-library.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const song = JSON.parse(await read("data/songs/mi-xue-bing-cheng-theme.json"));
const siblingBytes = await read("data/songs/mi-xue-bing-cheng-theme-chord.json");
const sibling = JSON.parse(siblingBytes);
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const originalV1Hash = "354e2a8a878c519c0e581450872041f9a0b69bdfc680c5666501a2d7c9dfec14";
const originalV2Hash = "df1100d1587c3b297ab0f6cc60a6a78696f00bf0b8c37e98e26bebcacf7b247e";
const numberUrl = "https://www.everyonepiano.cn/Number-13218-1.html";
const staffUrl = "https://www.everyonepiano.cn/Stave-13218-1.html";

// Independently read from Jeanie's one-page numbered preview, corroborated by
// the same edition's staff preview. Each atom is [degree, local beat, duration]
// with one upper octave dot. No array is derived from the production song.
// m5's rolled chord is omitted as a whole; its last beat is NOT a source rest.
const sourceBars = [
  [[3,1.5,.25],[4,1.75,.25]],
  [[5,0,.5],[5,.5,.5],[5,1,.75],[6,1.75,.25]],
  [[5,0,.5],[3,.5,.5],[1,1,.5],[1,1.5,.25],[2,1.75,.25]],
  [[3,0,.5],[3,.5,.5],[2,1,.5],[2,1.5,.5]],
  [[1,0,1]],
  [[3,0,.5],[5,.5,.5],[5,1,.75],[6,1.75,.25]],
  [[5,0,.5],[3,.5,.5],[1,1,.5],[1,1.5,.25],[2,1.75,.25]],
  [[3,0,.5],[3,.5,.5],[2,1,.5],[1,1.5,.5]],
  [[2,0,2]],
  [[3,0,.5],[5,.5,.5],[5,1,.75],[6,1.75,.25]],
  [[5,0,.5],[3,.5,.5],[1,1,.5],[1,1.5,.25],[2,1.75,.25]],
  [[3,0,.5],[3,.5,.5],[2,1,.5],[2,1.5,.5]],
  [[1,0,2]],
  [[4,0,1],[4,1,1]],
  [[4,0,.5],[6,.5,1.5]],
  [[5,0,1],[5,1,.5],[3,1.5,.5]],
  [[2,0,2]],
  [[3,0,.5],[5,.5,.5],[5,1,.75],[6,1.75,.25]],
  [[5,0,.5],[3,.5,.5],[1,1,.5],[1,1.5,.25],[2,1.75,.25]],
  [[3,0,.5],[3,.5,.5],[2,1,.5],[2,1.5,.5]],
  [[1,0,2]]
];
const sourcePitches = { 1: "D5", 2: "E5", 3: "F#5", 4: "G5", 5: "A5", 6: "B5" };
const mappedPitches = { 1: "C5", 2: "D5", 3: "E5", 4: "F5", 5: "G5", 6: "A5" };
const bars = sourceBars.map((atoms, bar) => atoms.map(([degree, beat, duration]) => [mappedPitches[degree], 2 * bar + beat, duration]));
const expected = bars.flat();
const phrase = (from, to) => song.steps.filter(([, beat]) => beat >= from && beat < to);
const midi = name => {
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(name);
  return (Number(octave) + 1) * 12 + { C:0,D:2,E:4,F:5,G:7,A:9,B:11 }[letter] + (sharp ? 1 : 0);
};

// Reconstruct the original byte stream using preserved historical fields and
// only the approved duration reversal, without a private file or Git checkout.
const reconstructed = structuredClone(song);
reconstructed.hint = review.originalV1.hint;
reconstructed.sourceFeatures = structuredClone(review.historicalReviewNotes);
reconstructed.steps.find(([, beat]) => beat === 8)[2] = 2;
const reconstructedBytes = JSON.stringify(reconstructed, null, 2) + "\n";
const siblingMelody = sibling.events.map(event => {
  const notes = event.notes.filter(note => note.role === "melody");
  assert.equal(notes.length, 1, `Historical V2 melody role at ${event.beat}`);
  return [notes[0].name, event.beat, event.duration];
});

test("the 66 selected single-line attacks match all 21 reviewed source bars", () => {
  assert.equal(sourceBars.length, 21);
  assert.equal(expected.length, 66);
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.id, "mi-xue-bing-cheng-theme");
  assert.deepEqual(song.steps, expected);
  assert.equal(current.selectedAttackCount, 66);
  assert.equal(phrase(10,42).length, 50);
  assert.deepEqual(phrase(10,42), siblingMelody.filter(([, beat]) => beat >= 10), "all 50 Chinese-section tuples stay intact");
  assert.deepEqual(current.chineseLyricSection, { measures:[6,21],beatRange:[10,42],attackCount:50,status:"all-pitch-onset-duration-tuples-unchanged" });
  assert.match(song.hint, /Jeanie.*21小节.*D调.*2半音.*C调/);
  assert.match(song.hint, /完整中文主旋律.*第5小节滚奏和弦整段省略.*1拍改编空隙/);
});

test("the only legacy tuple change is C5@8 duration 2 to 1", () => {
  assert.equal(siblingMelody.length, 66);
  assert.deepEqual(reconstructed.steps, siblingMelody);
  const differences = song.steps.flatMap((step, index) => JSON.stringify(step) === JSON.stringify(siblingMelody[index]) ? [] : [{index,before:siblingMelody[index],after:step}]);
  assert.deepEqual(differences, [{index:15,before:["C5",8,2],after:["C5",8,1]}]);
  assert.equal(song.steps.filter((step,index) => JSON.stringify(step) === JSON.stringify(siblingMelody[index])).length, 65);
  assert.deepEqual(current.correction, {measure:5,beat:8,note:"C5",previousDuration:2,duration:1,evidence:"The upper tonic is a quarter note, followed by a separate rolled chord on beat 9. Neither preview shows a tie, half note or continuation of this C5 into the chord."});
});

test("each 2/4 bar balances with its written opening rest or disclosed chord omission", () => {
  assert.equal(song.beatsPerMeasure, 2);
  for (let bar = 0; bar < 21; bar += 1) {
    const start = 2 * bar;
    const notes = phrase(start, start + 2);
    assert.deepEqual(notes, bars[bar], `m${bar + 1} pitches and internal rhythm`);
    const writtenRest = bar === 0 ? 1.5 : 0;
    const omittedChord = bar === 4 ? 1 : 0;
    assert.equal(notes.reduce((sum, [, , duration]) => sum + duration, 0) + writtenRest + omittedChord, 2);
    assert.equal(notes[0][1], start + writtenRest);
    assert.equal(notes.at(-1)[1] + notes.at(-1)[2] + omittedChord, start + 2);
    for (let index = 1; index < notes.length; index += 1) assert.equal(notes[index - 1][1] + notes[index - 1][2], notes[index][1]);
  }
  assert.equal(current.initialWrittenRestBeats, 1.5);
  assert.equal(current.audiblePickupBeats, .5);
  assert.match(current.legacyPickupFieldMeaning, /lead-in silence.*0.5-beat audible pickup/);
  assert.deepEqual(current.silentWindows, [{beat:0,duration:1.5}], "only actual all-layer source silence is labeled silent");
});

test("[9,10) is a single-melody adaptation gap, never a source-written all-layer rest", () => {
  assert.deepEqual(current.melodyOnlyAdaptationGaps, [{beat:9,duration:1,reason:"omitted-instrumental-rolled-chord",sourceWrittenRest:false,sourceAllLayerSilence:false}]);
  assert.deepEqual(current.omittedSourceGestures, [{measure:5,beat:9,duration:1,type:"rolled-chord",sourceNotes:["F#5","A5","D6"],transposedNotes:["E5","G5","C6"],melodyMember:"not-assigned",withinRollOffsets:"not-quantified-by-arpeggio-sign"}]);
  assert.equal(song.steps.some(([, beat, duration]) => beat < 10 && beat + duration > 9), false);
  assert.deepEqual(phrase(8,10), [["C5",8,1]], "no guessed highest chord note, tonic retrigger or fill");
  assert.match(song.sourceFeatures.unsupported.join(" "), /adaptation gap is not a source-written rest or all-layer silence/);
  for (const field of ["events", "rhythm", "autoAccompaniment", "practiceAccompaniment"]) assert.equal(song[field], undefined);
  assert.equal(song.sourceFeatures.hasChords, true, "source has harmony, even though practice omits it");
  assert.equal(song.sourceFeatures.hasArpeggio, true);
});

test("source rhythm preserves dotted figures, separate attacks and the m15 same-pitch tie", () => {
  for (const onset of [3,11,19,35]) {
    assert.deepEqual(phrase(onset,onset+1), [["G5",onset,.75],["A5",onset+.75,.25]]);
  }
  assert.deepEqual(phrase(2,4), [["G5",2,.5],["G5",2.5,.5],["G5",3,.75],["A5",3.75,.25]]);
  assert.deepEqual(phrase(28,30), [["F5",28,.5],["A5",28.5,1.5]]);
  assert.equal(song.steps.some(([, beat]) => beat === 29), false);
  assert.deepEqual(current.preservedTie, {measure:15,note:"A5",beat:28.5,duration:1.5,continuationBeat:29});
  assert.deepEqual(song.steps.at(-1), ["C5",40,2]);
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 42);
  assert.equal(song.sourceFeatures.sourceTotalBeats, 42);
  assert.equal(song.sourceFeatures.sourceMeasureCount, 21);
  assert.deepEqual(current.ending, {measure:21,note:"C5",beat:40,duration:2,totalBeats:42,finalRestBeats:0});
});

test("one disclosed -2-semitone transposition preserves source intervals and printed tempo", () => {
  const allowed = new Set(DISPLAY_KEYS.map(({name}) => name));
  for (const [degree, sourcePitch] of Object.entries(sourcePitches)) assert.equal(midi(mappedPitches[degree]) - midi(sourcePitch), -2);
  for (const [pitch] of song.steps) assert.ok(allowed.has(pitch));
  assert.deepEqual([...new Set(song.steps.map(([pitch]) => pitch))].sort(), ["A5","C5","D5","E5","F5","G5"]);
  assert.equal(song.key, "C");
  assert.equal(current.sourceKey, "D");
  assert.equal(current.sourceMeter, "2/4");
  assert.equal(current.transpositionSemitones, -2);
  assert.equal(current.octaveFolding, false);
  assert.equal(song.bpm, 115);
  assert.equal(current.sourceTempo, 115);
  assert.equal(current.sourceTempoBeatUnit, "quarter");
  assert.equal(song.defaultSpeedFactor, .9);
  assert.match(current.practiceSpeed, /0.9 is a legacy suggestion.*0.55x.*remembered per-song speed/);
});

test("current metadata scopes the complete melody review and preserves unsupported old claims as history", () => {
  assert.equal(current.status, "reviewed-melody-with-intro-chord-omission");
  assert.equal(current.selectedEdition, "jeanie-21-bar-one-page");
  assert.equal(current.adoptedInVersion, "2.4.5");
  assert.deepEqual(current.reviewedBeatRanges, [[0,42]]);
  assert.deepEqual(current.reviewedMeasures, [1,21]);
  assert.equal(current.sourceUrl, numberUrl);
  assert.equal(current.corroboratingSourceUrl, staffUrl);
  assert.deepEqual(review.sources.map(({url}) => url), [numberUrl,staffUrl]);
  assert.equal(current.sourceImageSha256, "c4243d0d65455d71f7b2774fcfc287680ecfff50255132431eff3240cb83db35");
  assert.equal(current.corroboratingImageSha256, "5528d825785582b686222ecfe795940345506c857c0e4bf58fd54215dcad0ee3");
  assert.deepEqual(current.sourceImageDimensions, [2381,3368]);
  assert.match(current.corroborationScope, /Not a second independent arrangement/);
  assert.equal(song.sourceFeatures.hasRepeats, false);
  assert.deepEqual(current.sourceForm, {measureCount:21,englishSectionPrinted:false,repeatSignsPrinted:false,endingRestBeats:0});
  assert.equal(song.sourceFeatures.sourceImages, undefined, "unavailable historical raw path is not current provenance");
  assert.deepEqual(review.historicalReviewNotes, {
    hasChords:true,hasArpeggio:true,hasRepeats:true,
    sourceImages:["private/sheets/raw/mi-xue-bing-cheng-theme/everyonepiano-number-01.png"],
    unsupported:["谱面英文段与循环播放结构未重复展开；本版本保留完整中文主题段。"],
    unsureMeasures:[],sourceReview:{confidence:"high",sources:[{label:"人人钢琴网《蜜雪冰城甜蜜蜜》双手简谱",url:numberUrl}]}
  });
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  for (const field of ["referenceListening","browserAudio","physicalKalimba"]) assert.equal(current[field], "not-performed");
  assert.match(current.limitations, /Not a literal complete two-hand piano transcription/);
});

test("the complete original V1 bytes are reconstructible and the old V2 stays byte-identical", () => {
  assert.equal(hash(reconstructedBytes), originalV1Hash);
  assert.equal(review.originalV1.fileSha256, originalV1Hash);
  assert.equal(hash(siblingBytes), originalV2Hash);
  assert.equal(review.preservedV2.fileSha256, originalV2Hash);
  assert.equal(review.preservedV2.file, "data/songs/mi-xue-bing-cheng-theme-chord.json");
  assert.equal(review.preservedV2.status, "historical-unchanged-incompatible-melody");
  assert.match(review.preservedV2.limitation, /Do not borrow its support/);
  assert.equal(reconstructed.steps.length, 66);
  assert.equal(reconstructed.hint, "主旋律版按 1=D、2/4 双手简谱转写为 C 调，保留弱起、附点和完整中文段落。");
  assert.deepEqual(reconstructed.steps.at(-1), ["C5",40,2]);
});
