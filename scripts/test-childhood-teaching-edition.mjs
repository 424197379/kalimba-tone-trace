import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { analyzeSongTiming } from "./song-report-analysis.mjs";
import { CURRENT_SONG_STORAGE_KEY, getCustomSongs, getPracticeSongs, getPracticeSongId,
  getSongArchiveDownload, getSongLibrary, getSongMeterLabel, getSongAccompanimentProvider,
  hasMatchingPracticeMelody, parseImportedSongs, saveCustomSongs } from "../src/song-store.js";
import { createLoopRange, getPracticeTotalBeats, isBeatInLoop } from "../src/practice-loop.js";
import { SONG_SPEED_STORAGE_KEY, readSongSpeed } from "../src/practice-preferences.js";
import { checkTranscriptionEvidence, fittingTranspositions } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const id = "tong-nian", archivePath = "data/archives/tong-nian-v2.4.37.json";
const song = JSON.parse(await read(`data/songs/${id}.json`));
const archiveBytes = await read(archivePath), archive = JSON.parse(archiveBytes);
const siblingBytes = await read("data/songs/tong-nian-chord.json"), sibling = JSON.parse(siblingBytes);
const archiveHash = "1261f31f6d1194b07fdff52a4bd5ec35b44c4426262575a01698b5fad6bb1ce4";
const siblingHash = "f370fb5ddb5e936afd7c16f5c8f9eaa4dab789b4ce5e052b071c6200a4fe8260";
const firstFixtureHash = "fd1ba4ce5d046dc57372f6eeb89787252621cb83ef019e5404c0e5227f6b733e";
const sourceFixtureHash = "62d7c7efda7f505edc9b676e2713b1449fd61fa83955a39f27113c0c2cebc8de";
const tupleHash = "b8ab6f84080f3db2d10cd324ac7f91347e05a4d2eb244f025e5b3940973ea5e8";
const sourceMidiTupleHash = "a7cc380db137270ee1f516dfa5ec0d07ba6cce5c9a60738eaa764b00d7f31e92";
const printedHeadsHash = "c35abbd0f9996dfca0b8eda52b85ad41c1b0ff702488c55fce5f67efbe487976";
const sourceUrl = "https://music.hgnu.edu.cn/_upload/article/files/09/d4/faf43ffb4e08b61cf64ee0adaf16/ec5df379-7cae-4b24-9ece-880a54ee478b.pdf";
const review = song.sourceFeatures.sourceReview, current = review.currentScopeReview;
const scope = value => value.sourceFeatures.sourceReview.currentScopeReview;
const rests = [[0,1],[16,1],[34,.5]];
// Authored solely from the second immutable source-only reading, after its
// independent freeze and before any test execution. These constants are never
// regenerated from production. Full source images and the private fixture are
// not copied into this repository. [bar, printed heads, attacks, rest beats, hash]
const barDecisions = [
  [1,5,4,1,"d8fca2dce297859b744f12bf7feaaa52945ded4d88ab290338cc79af6bbc8a5f"],
  [2,8,7,0,"5e2d21c62b4a7acdde942dbd2a834b9cb3f54ffcef7e5dc3d4bb736a0a0c71ad"],
  [3,7,7,0,"566cca46797b34fe28ae306a6bcd1b5f44ea45e8d7bd682a1035256a14323ab1"],
  [4,1,1,0,"f1d95102f2cb657f8b899ddf9183022d8fc414b2a3dfdc5281605815056d312c"],
  [5,5,4,1,"4273144c3aed86b5c86e89a5c89336bbf4dd406da86f181bff99c6c325df3085"],
  [6,8,7,0,"6128142356acf6ca6e428f93d21fa6062391b233bb1cd677750536f16b8c1671"],
  [7,7,7,0,"e967d4e879bfeb6de9e3070e01909af911e6f58226e0626142457dad9c79e55d"],
  [8,1,1,0,"ef17889c9abc6f04698487ad6e3f0e5b957d009ea6e5dba9d1f370938834e1be"],
  [9,7,6,0.5,"0e55cf07b12537f5a36f0e1394a3ec21abb337e4b77de8f7f506f00b313c0340"],
  [10,8,6,0,"ea21a4338ee99d78abc2b96b55bcd267177b2313427d47ac64ceda4a0c831241"],
  [11,8,8,0,"bf8d28128c02bd53b0c1f447ad831fc25a5c58b617ae6080e6b33c50abe46f0e"],
  [12,1,1,0,"3c1ee471070a1593f510988bf322578e06ca70503b78871588683ce2d9a72e80"],
  [13,5,5,0,"fd1b75557e6016141b92249fb75c44cdac412f8ce66d713fb1113b8ab6de7c4e"],
  [14,7,7,0,"6fca6a63b6b74944c11af1c1761be239763834cebc0fe3ac5aa69ffd4aa53636"],
  [15,7,7,0,"ba035c3753053e209e3b26978d95a106aeb862244f891828ed7482d7f1bf2673"],
  [16,1,1,0,"3ff285aff121702fb6db31a2613b26c16bef63b826045ece4e8d959545e61ce2"]
];
const ties = [
  {"sourceMeasure":1,"sourceHeads":["m01-h03","m01-h04"],"from":["G4",2,1],"to":["G4",3,0.5],"mergedAttack":["G4",2,1.5]},
  {"sourceMeasure":2,"sourceHeads":["m02-h04","m02-h05"],"from":["A4",5.5,0.5],"to":["A4",6,0.5],"mergedAttack":["A4",5.5,1]},
  {"sourceMeasure":5,"sourceHeads":["m05-h03","m05-h04"],"from":["G4",18,1],"to":["G4",19,0.5],"mergedAttack":["G4",18,1.5]},
  {"sourceMeasure":6,"sourceHeads":["m06-h04","m06-h05"],"from":["A4",21.5,0.5],"to":["A4",22,0.5],"mergedAttack":["A4",21.5,1]},
  {"sourceMeasure":9,"sourceHeads":["m09-h02","m09-h03"],"from":["G5",32.5,0.5],"to":["G5",33,0.5],"mergedAttack":["G5",32.5,1]},
  {"sourceMeasure":10,"sourceHeads":["m10-h02","m10-h03"],"from":["C5",36.5,0.5],"to":["C5",37,0.5],"mergedAttack":["C5",36.5,1.5]},
  {"sourceMeasure":10,"sourceHeads":["m10-h03","m10-h04"],"from":["C5",37,0.5],"to":["C5",37.5,0.5],"mergedAttack":["C5",36.5,1.5]}
];
const slurs = [
  {"sourceMeasure":2,"sourceHeads":["m02-h02","m02-h03"],"from":["A4",4.5,0.5],"to":["B4",5,0.5],"separateAttacksRetained":true},
  {"sourceMeasure":3,"sourceHeads":["m03-h06","m03-h07"],"from":["C5",11,0.5],"to":["A4",11.5,0.5],"separateAttacksRetained":true},
  {"sourceMeasure":6,"sourceHeads":["m06-h02","m06-h03"],"from":["A4",20.5,0.5],"to":["B4",21,0.5],"separateAttacksRetained":true},
  {"sourceMeasure":6,"sourceHeads":["m06-h07","m06-h08"],"from":["A4",23,0.5],"to":["G4",23.5,0.5],"separateAttacksRetained":true},
  {"sourceMeasure":7,"sourceHeads":["m07-h06","m07-h07"],"from":["A4",27,0.5],"to":["C5",27.5,0.5],"separateAttacksRetained":true},
  {"sourceMeasure":11,"sourceHeads":["m11-h07","m11-h08"],"from":["E5",43,0.5],"to":["D5",43.5,0.5],"separateAttacksRetained":true},
  {"sourceMeasure":14,"sourceHeads":["m14-h04","m14-h05"],"from":["D5",54,0.5],"to":["C5",54.5,0.5],"separateAttacksRetained":true},
  {"sourceMeasure":14,"sourceHeads":["m14-h06","m14-h07"],"from":["A4",55,0.5],"to":["G4",55.5,0.5],"separateAttacksRetained":true},
  {"sourceMeasure":15,"sourceHeads":["m15-h06","m15-h07"],"from":["D5",59,0.5],"to":["E5",59.5,0.5],"separateAttacksRetained":true}
];
const phrase = (value, from, to) => value.steps.filter(([,b]) => b >= from && b < to);
const at = (value, beat) => value.steps.find(([,b]) => b === beat);
const midi = name => { const [,letter,accidental,octave] = /^([A-G])([#b]?)(\d)$/.exec(name);
  return 12 * (+octave+1) + ({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0); };
const noteName = value => ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][value%12] + (Math.floor(value/12)-1);
const overlap = (b,d,from,to) => Math.max(0,Math.min(b+d,to)-Math.max(b,from));
const eventsFor = steps => steps.map(([name,beat,duration]) => ({beat,duration,notes:[{name,role:"melody",judge:true}]}));
const normalized = value => ({...structuredClone(value),baseSongId:value.id,source:"system",arrangementKind:"melody",judgementMode:"melody",events:eventsFor(value.steps)});
function asV2(value) {
  const result = {...structuredClone(value),schemaVersion:2,arrangementKind:"melody",judgementMode:"melody",events:eventsFor(value.steps)};
  delete result.steps; return result;
}
function withIsolatedStorage(run) {
  const previous = globalThis.localStorage, values = new Map();
  globalThis.localStorage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
  try { return run(values); }
  finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
}
function assertSelectedEdition(value) {
  assert.equal(value.steps.length,79);
  assert.equal(hash(JSON.stringify(value.steps)),tupleHash,"all 79 independently source-authored tuples");
  assert.equal(value.bpm,105); assert.equal(value.defaultSpeedFactor,.9); assert.equal(value.difficulty,"medium");
  assert.equal(value.beatsPerMeasure,4); assert.equal(value.key,"C"); assert.equal(value.tuning,"21-key-c");
  assert.equal(value.sourceFeatures.sourceTotalBeats,64); assert.equal(value.sourceFeatures.sourceMeasureCount,16);
  assert.equal(value.sourceFeatures.sourceKey,"G"); assert.equal(value.sourceFeatures.transpositionSemitones,-7);
  assert.equal(value.sourceFeatures.hasRepeats,false);
  const s = scope(value);
  assert.equal(s.status,"reviewed-selected-teaching-vocal-strophe");
  assert.deepEqual(s.sourceMeasureRange,[1,16]); assert.deepEqual(s.reviewedBeatRanges,[[0,64]]);
  assert.deepEqual(s.expandedSourceMeasures,Array.from({length:16},(_,i)=>i+1));
  assert.deepEqual(s.selectedRoute,[{sourceMeasures:[1,16],beats:[0,64],pass:1,voice:"lyric-aligned-single-vocal-line"}]);
  assert.equal(s.sourcePrintedMeasureCount,16); assert.equal(s.distinctPrintedMelodyMeasures,16);
  assert.equal(s.metricNoteheadCount,86); assert.equal(s.principalAttackCount,79);
  assert.equal(s.sourceVoice,"explicit-lyric-aligned-single-vocal-line");
  assert.equal(s.repeatSignsPresent,false); assert.equal(s.lyricRowsAuthorizeRepeat,false); assert.equal(s.lyricRowCount,5);
  assert.equal(s.repeatExpansion,"none-all-16-selected-vocal-bars-written-once");
  assert.equal(s.sourceQuarterBpm,null); assert.equal(s.sourceNumericTempoPrinted,false); assert.equal(s.sourceTempoText,null);
  assert.equal(s.sourceMeter,"4/4"); assert.equal(s.beatUnit,"quarter-note"); assert.equal(s.sourceKey,"G");
  assert.equal(s.transpositionSemitones,-7); assert.equal(s.globalOctaveShift,0); assert.equal(s.octaveFolding,false);
  assert.deepEqual(s.localPitchAlterations,[]); assert.deepEqual(s.additionalMelodyAccidentals,[]);
  assert.deepEqual(s.ties,ties); assert.equal(s.tieContinuationCount,7); assert.deepEqual(s.slurs,slurs); assert.equal(s.slurCount,9);
  for (const field of ["tuplets","unmeasuredOrnaments","omittedOrnaments","fermatas","breathMarks","augmentationDots","silentWindows"]) assert.deepEqual(s[field],[]);
  assert.deepEqual(s.melodyOnlyRestWindows,rests);
  assert.deepEqual(s.vocalRests,rests.map(([beat,duration],i)=>({sourceMeasure:[1,5,9][i],beat,duration,scope:"vocal-only; guitar remains active in the source"})));
  assert.equal(s.pickupBeats,0); assert.equal(s.initialMelodyRestBeats,1); assert.equal(s.endingRestBeats,0);
  assert.equal(s.sourceTotalBeats,64); assert.deepEqual(s.finalAttack,["C5",60,4]);
  for (const field of ["autoAccompaniment","practiceAccompaniment"]) assert.equal(value[field],undefined);
  for (const [bar,heads,attacks,restDuration,fingerprint] of barDecisions) {
    const from=(bar-1)*4, actual=phrase(value,from,from+4);
    assert.equal(actual.length,attacks,`m${bar} attack count`);
    assert.equal(hash(JSON.stringify(actual)),fingerprint,`m${bar} occurrence-specific source tuples`);
    assert.equal(heads-attacks,ties.filter(t=>t.sourceMeasure===bar).length);
    const restOccupancy=rests.reduce((sum,[b,d])=>sum+overlap(b,d,from,from+4),0);
    assert.equal(restOccupancy,restDuration);
    assert.equal(actual.reduce((sum,[,b,d])=>sum+overlap(b,d,from,from+4),0)+restOccupancy,4,`m${bar} notes plus actual rests tile four beats`);
  }
}

test("complete printed teaching vocal cycle locks all 16 bars and 79 tuples under one canonical identity",()=>{
  assertSelectedEdition(song); assert.equal(song.id,id); assert.equal(song.schemaVersion,1); assert.equal(song.uploader,"system");
  assert.equal(song.title,"《童年》（教材人声版）"); assert.equal(song.practiceTitle,`${song.title}练习轨道`); assert.equal(song.scoreTitle,`${song.title}简谱进度`);
  assert.match(song.hint,/完整16小节单遍人声.*79次起音、64个四分拍.*m1–16一次.*不按5排歌词扩为5遍/);
  assert.match(song.hint,/G调整体降7半音至C调.*7处延音连接.*3处人声休止.*105 BPM为练习设定.*无伴奏/);
  assert.doesNotMatch(song.hint,/原唱全曲|原版错误|更容易/);
  assert.equal(barDecisions.reduce((sum,[,heads])=>sum+heads,0),86);
  assert.equal(barDecisions.reduce((sum,[,,attacks])=>sum+attacks,0),79);
  assert.equal(current.sourceSystemCount,4); assert.equal(getSongMeterLabel(song),"4/4");
});

test("all seven tie joins keep one attack per chain while all nine different-pitch slurs retain both endpoints",()=>{
  for (const t of ties) {
    assert.equal(t.from[0],t.to[0]); assert.equal(t.from[1]+t.from[2],t.to[1]);
    assert.deepEqual(at(song,t.mergedAttack[1]),t.mergedAttack);
    assert.equal(at(song,t.to[1]),undefined,`${t.sourceHeads.join(' -> ')} has no continuation attack`);
  }
  assert.equal(new Set(ties.map(t=>t.mergedAttack[1])).size,6,"m10 has two joins in one three-head chain");
  for (const s of slurs) { assert.notEqual(s.from[0],s.to[0]); assert.deepEqual(at(song,s.from[1]),s.from); assert.deepEqual(at(song,s.to[1]),s.to); }
  assert.match(current.arcEvidence,/all 7 same-pitch tie joins and 9 different-pitch slur endpoints/);
  assert.match(current.arcEvidence,/coordinates were measured by reader A only/);
  assert.equal(slurs.some(s=>s.sourceMeasure===2&&s.from[1]===7),false,"m2 final pair has no slur");
  assert.equal(slurs.some(s=>s.sourceMeasure===6&&s.from[1]===23),true,"m6 separately printed pair has a slur");
});

test("m9 high register and rest, m10 two-arc chain, m11 five independent eighths and later syncopations remain distinct",()=>{
  assert.deepEqual(phrase(song,32,36),[["G5",32,.5],["G5",32.5,1],["G5",33.5,.5],["G5",34.5,.5],["E5",35,.5],["D5",35.5,.5]]);
  assert.deepEqual(phrase(song,36,40),[["C5",36,.5],["C5",36.5,1.5],["A4",38,.5],["C5",38.5,.5],["A4",39,.5],["C5",39.5,.5]]);
  assert.deepEqual(phrase(song,40,42.5),[40,40.5,41,41.5,42].map(b=>["D5",b,.5]));
  assert.deepEqual(phrase(song,48,52),[["E5",48,.5],["E5",48.5,1],["E5",49.5,.5],["E5",50,1],["D5",51,1]]);
  for (const b of [52,56]) assert.deepEqual(phrase(song,b,b+2).map(([n,beat,d])=>[beat-b,d]),[[0,.5],[.5,1],[1.5,.5]]);
  assert.deepEqual(phrase(song,11,12),[["C5",11,.5],["A4",11.5,.5]]);
  assert.deepEqual(phrase(song,27,28),[["A4",27,.5],["C5",27.5,.5]],"m7 is separately engraved, not copied from m3");
  for (const b of [1.5,6.5,7,17.5,22.5,23]) assert.equal(at(song,b)[2],.5,"adjacent untied same-pitch attacks survive");
  assert.match(current.repeatedAttackDecision,/single underlines, not two separate sixteenth-note lines/);
});

test("the initial full-beat vocal rest and internal half-beat survive; final C5 lasts four beats to64 with no invented tail",()=>{
  const report=analyzeSongTiming(song);
  assert.deepEqual(report.melodyGaps.map(({beat,duration})=>[beat,duration]),rests);
  assert.deepEqual(report.issues,[]); assert.deepEqual(report.unannotatedLongGaps,[]);
  assert.deepEqual(report.claims.allLayerSilent,[]); assert.equal(report.claims.melodyOnly.length,3);
  assert.ok(report.melodyGaps.every(g=>g.declarations.some(d=>d.meaning==="declared-melody-only-rest")));
  assert.equal(song.steps.reduce((sum,[,,d])=>sum+d,0),61.5);
  assert.equal(song.steps[0][1],1); assert.deepEqual(song.steps.at(-1),["C5",60,4]);
  assert.equal(report.declaredEnd,64); assert.equal(report.sourceEnd,64); assert.equal(report.scoreExtent,64);
  const events=eventsFor(song.steps); assert.equal(getPracticeTotalBeats(events,song),64);
  const finalLoop=createLoopRange(events,64,64,4); assert.deepEqual(finalLoop,{startBeat:60,endBeat:64}); assert.equal(isBeatInLoop(64,finalLoop),false);
  // Loop A uses actual attacks; the full-song rest is not a claim that loops snap to a barline.
  assert.equal(createLoopRange(events,64,0,4).startBeat,1);
  assert.match(current.restDecision,/first full 4\/4 bar starts at0, not at the first attack/);
  assert.match(current.restDecision,/not source-wide silence/);
  assert.deepEqual(current.excludedSections,[]); assert.equal(current.omittedSectionsAreRests,false);
  assert.equal(current.selectedEndIsSelectedEditionEnding,true); assert.equal(current.selectedEndIsFullSongEnding,false);
});

test("all12 pitch-class shifts and register bounds select uniform minus7 with F sharp preserved before transposition",()=>{
  const keys=new Set(DISPLAY_KEYS.map(k=>k.name)), keyMidi=new Set([...keys].map(midi));
  assert.deepEqual(current.sourcePitchClasses,[2,4,6,7,9,11]); assert.deepEqual(fittingTranspositions(current.sourcePitchClasses),[5,10]);
  assert.deepEqual(current.allowedPitchClassShifts,[5,10]);
  const recovered=song.steps.map(([n,b,d])=>[midi(n)+7,b,d]);
  assert.equal(hash(JSON.stringify(recovered)),sourceMidiTupleHash,"every source pitch recovered with the same +7, never a local octave edit");
  const allShifts=Array.from({length:97},(_,i)=>i-48).filter(shift=>recovered.every(([m])=>keyMidi.has(m+shift)));
  assert.deepEqual(allShifts,[-14,-7,-2]); assert.deepEqual(current.registerValidGlobalSemitoneShifts,allShifts);
  assert.deepEqual([Math.min(...recovered.map(([m])=>m)),Math.max(...recovered.map(([m])=>m))],[71,86]);
  assert.deepEqual([Math.min(...song.steps.map(([n])=>midi(n))),Math.max(...song.steps.map(([n])=>midi(n)))],[64,79]);
  assert.deepEqual(current.sourceRange,["B4","D6"]); assert.deepEqual(current.compiledRange,["E4","G5"]);
  for (const [n] of song.steps) assert.ok(keys.has(n));
  assert.deepEqual(current.sourceKeySignatureAccidentals,["F#"]); assert.deepEqual(song.steps.filter(([n])=>n==="B4"),[["B4",5,.5],["B4",21,.5]]);
  assert.match(current.absoluteOctaveConvention,/Undotted source 1 = G4 and target 1 = C4/);
  assert.match(current.absoluteOctaveConvention,/not proof of a singer's concert octave/);
  assert.equal(Math.min(...song.steps.slice(1).map(([,b],i)=>b-song.steps[i][1])),.5);
  assert.ok(Math.abs(.5*60000/105-285.7142857142857)<1e-9);
  assert.equal(song.bpm,archive.bpm); assert.equal(song.defaultSpeedFactor,archive.defaultSpeedFactor); assert.equal(song.difficulty,archive.difficulty);
  assert.equal(song.sourceFeatures.suitability.status,"conditional");
});

test("identity, same-source double reading, no source tempo and separate acceptance gates are stated accurately",()=>{
  assert.equal(current.adoptedInVersion,"2.4.38"); assert.equal(current.reviewedInVersion,"2.4.38");
  assert.equal(current.sourceUrl,sourceUrl); assert.deepEqual(current.pdfPages,[46,47]); assert.deepEqual(current.printedPages,[42,43]);
  assert.equal(current.sourceBook,"普通高中教科书 音乐 必修 演奏·下篇（吉他）"); assert.equal(current.publisher,"人民音乐出版社·北京");
  assert.equal(current.sourceTitle,"童年"); assert.equal(current.sourceSubtitle,"民谣吉他曲"); assert.equal(current.sourceCredit,"罗大佑词曲");
  assert.equal(current.sourcePdfSha256,"bee5c8a881de14db9b9c53f8a3f1273ac617f31ef4bad14b6d84597ff987235b");
  assert.deepEqual(current.sourcePageImageSha256,["f0783380fd2442fd45cd10e3876d12dce1e8944b8de9e83c83d8663e0be3d31a","168aeb7cd0bc429480995a905210d76a108ade9791a2588e010cbcbeb11608a2"]);
  assert.match(current.voiceEvidence,/separate numbered melody beneath guitar TAB.*not inferred from the highest guitar note/);
  assert.deepEqual(current.excludedLayers,["guitar chord diagrams and TAB strumming"]);
  assert.match(current.tempoDecision,/105 BPM is a retained editorial practice choice.*neither numeric nor verbal tempo/);
  assert.equal(current.oldEditionReverified,false); assert.equal(current.historicalSourceImageIdentityVerified,false);
  assert.equal(current.independentSourcesVerified,false); assert.equal(current.independentSourceReaders,2);
  assert.match(current.sourceReviewMethod,/two readers of one published source, not two independent published sources/);
  assert.match(current.versionDecision,/does not prove the prior edition wrong/);
  assert.equal(current.firstFrozenSourceReadingSha256,firstFixtureHash); assert.equal(current.independentSourceFixtureSha256,sourceFixtureHash);
  assert.equal(current.comparisonSha256,"714f7b6b30931d2bea469baf8ee75a8915f9d039fa211a62a6898d90c8e38921");
  assert.equal(current.independentSourceTupleSha256,tupleHash); assert.equal(current.sourceMidiTupleSha256,sourceMidiTupleHash);
  assert.equal(current.referenceListening,"not-performed"); assert.equal(current.browserAudio,"not-performed-at-data-adoption");
  assert.equal(current.physicalKalimba,"not-performed"); assert.equal(current.publicDistributionRights,"unestablished-private-preview-only");
  assert.deepEqual(review.historicalSourceFeatures,archive.sourceFeatures);
});

test("full old81 bytes, earlier83 reconstruction and original V2 sibling are preserved without another card or archive route",async()=>{
  assert.equal(hash(archiveBytes),archiveHash); assert.equal(archive.steps.length,81); assert.equal(archive.id,id); assert.equal(archive.title,"《童年》");
  assert.equal(archive.sourceFeatures.sourceTotalBeats,undefined,"old64 was an encoded endpoint, not an old verified source extent");
  const historical=archive.sourceFeatures.sourceReview, earlier=structuredClone(archive);
  assert.equal(historical.currentScopeReview.status,"reviewed-opening-common-ties");
  for (const field of ["title","practiceTitle","scoreTitle","hint"]) earlier[field]=historical.originalV1[field];
  earlier.steps=earlier.steps.flatMap(step=>historical.currentScopeReview.tieCorrections.find(c=>c.merged[1]===step[1])?.original??[step]);
  earlier.sourceFeatures=structuredClone(historical.historicalReviewNotes);
  assert.equal(earlier.steps.length,83); assert.equal(hash(JSON.stringify(earlier.steps)),"2d10a570f331f54c4225db4a6e417352aa9806182112f664c6329a1f44634ee6");
  assert.equal(hash(JSON.stringify(earlier,null,2)+"\n"),"9689322aa12a8744b4236ab7ab514028819b7078644d014aacb2e17c9d1257b3");
  assert.equal(hash(siblingBytes),siblingHash); assert.equal(sibling.events.length,83);
  assert.equal(review.archivedEdition.file,archivePath); assert.equal(review.archivedEdition.fileSha256,archiveHash);
  assert.equal(getSongArchiveDownload(song),null); assert.equal(current.archiveImportPath,undefined);
  const files=await readSongFiles(); assert.equal(files.length,57); assert.equal(files.filter(({song:s})=>s.schemaVersion===1).length,36);
  assert.equal(files.filter(({song:s})=>s.id===id).length,1); assert.deepEqual(files.filter(({song:s})=>s.id.startsWith(`${id}-`)).map(({song:s})=>s.id),["tong-nian-chord"]);
  for (const file of ["service-worker.js","serve-kalimba.js","src/app.js","src/song-library.js"])
    assert.ok(!(await read(file)).toString().includes("tong-nian-v2.4.37.json"),`${file}: no dedicated archive route or precache`);
});

test("real archive import and save/read recover every old field without changing canonical links, selection or0.65 speed",()=>withIsolatedStorage(values=>{
  const speedBytes=JSON.stringify({schemaVersion:1,songs:{[id]:{speed:.65}}}); values.set(SONG_SPEED_STORAGE_KEY,speedBytes); values.set(CURRENT_SONG_STORAGE_KEY,id);
  // Data-only suite can precede the integration owner's generated-module build.
  const library=getSongLibrary(); library[id]=normalized(song);
  const before=JSON.stringify(library), ids=getPracticeSongs(library).map(s=>s.id).sort();
  const [restored]=parseImportedSongs(archiveBytes.toString(),library);
  assert.notEqual(restored.id,id); assert.notEqual(restored.baseSongId,id); assert.equal(restored.schemaVersion,2); assert.equal(restored.source,"local");
  assert.deepEqual(restored.steps,archive.steps); assert.deepEqual(restored.sourceFeatures,archive.sourceFeatures); assert.equal(getPracticeTotalBeats(restored.events,restored),64);
  saveCustomSongs([restored]); const [saved]=getCustomSongs();
  const normalizedFields=new Set(["schemaVersion","id","uploader","practiceTitle","scoreTitle"]);
  const recovered=Object.fromEntries(Object.keys(archive).map(key=>[key,normalizedFields.has(key)?archive[key]:saved[key]]));
  assert.deepEqual(recovered,archive,"all original values after reversing only documented identity/schema/display normalization");
  assert.equal(JSON.stringify(library),before); assert.deepEqual(getPracticeSongs(library).map(s=>s.id).sort(),ids);
  const merged={...library,[saved.id]:saved}; assert.equal(getPracticeSongs(merged).length,37);
  assert.equal(getPracticeSongId(merged,id),id); assert.equal(getPracticeSongId(merged,"tong-nian-chord"),id); assert.equal(getPracticeSongId(merged,saved.id),saved.id);
  const [again]=parseImportedSongs(archiveBytes.toString(),merged); assert.notEqual(again.id,saved.id); assert.deepEqual(again.steps,archive.steps);
  const [selected]=parseImportedSongs(JSON.stringify(song),merged); assertSelectedEdition(selected);
  assert.equal(values.get(SONG_SPEED_STORAGE_KEY),speedBytes); assert.deepEqual(readSongSpeed(globalThis.localStorage,id),{speed:.65}); assert.equal(values.get(CURRENT_SONG_STORAGE_KEY),id);
}));

test("explicit-melody V2 importer and storage preserve all79 attacks and voice-specific rests, while reserved backing stays rejected",()=>withIsolatedStorage(()=>{
  const v2=asV2(song);
  v2.rhythm={sourceStatus:"verified",pickupBeats:0,restWindows:rests.map(([beat,duration])=>({beat,duration,policy:"silent",reason:"Selected melody-only practice omits source guitar during a source vocal rest."}))};
  const [imported]=parseImportedSongs(JSON.stringify(v2),getSongLibrary()); assertSelectedEdition(imported);
  assert.ok(imported.events.every(e=>e.notes.length===1&&e.notes[0].role==="melody"&&e.notes[0].judge===true));
  saveCustomSongs([imported]); const [saved]=getCustomSongs(); assertSelectedEdition(saved);
  assert.deepEqual(saved.events.map(e=>[e.notes[0].name,e.beat,e.duration]),song.steps); assert.deepEqual(saved.rhythm.restWindows,v2.rhythm.restWindows);
  const forbidden=structuredClone(v2); forbidden.practiceAccompaniment=null;
  assert.throws(()=>parseImportedSongs(JSON.stringify(forbidden),getSongLibrary()),/practiceAccompaniment/);
}));

test("actual old83 backing and synthetic old81 backing fail both providers; matching positive controls exercise both paths",()=>{
  assert.equal(hasMatchingPracticeMelody(song,sibling),false); assert.equal(hasMatchingPracticeMelody(song,archive),false);
  const actual={...structuredClone(sibling),source:"system",baseSongId:id};
  assert.ok(actual.autoAccompaniment.events.length>0); assert.equal(actual.practiceAccompaniment,undefined);
  for (const originalOnly of [false,true]) assert.equal(getSongAccompanimentProvider(normalized(song),[actual],originalOnly),null);
  // The real old sibling has only auto backing. Adding a cloned synthetic light
  // layer exercises the other compatibility branch without changing old bytes.
  const old83Dual={...actual,practiceAccompaniment:structuredClone(actual.autoAccompaniment)};
  for (const originalOnly of [false,true]) assert.equal(getSongAccompanimentProvider(normalized(song),[old83Dual],originalOnly),null);
  const backing={enabledByDefault:false,volume:.3,events:[{beat:2,duration:1,notes:[{name:"C4",role:"bass",velocity:.3}]}]};
  const old={...normalized(archive),id:`${id}-synthetic-old`,baseSongId:id,schemaVersion:2,autoAccompaniment:structuredClone(backing),practiceAccompaniment:structuredClone(backing)};
  for (const originalOnly of [false,true]) assert.equal(getSongAccompanimentProvider(normalized(song),[old],originalOnly),null);
  const positive={...old,steps:structuredClone(song.steps),events:eventsFor(song.steps),sourceFeatures:structuredClone(song.sourceFeatures)};
  assert.equal(getSongAccompanimentProvider(normalized(song),[positive]).kind,"light");
  assert.equal(getSongAccompanimentProvider(normalized(song),[positive],true).kind,"original");
  assert.equal(getSongAccompanimentProvider(normalized(song),[]),null);
});

test("generated canonical module matches current selection after integration build",()=>withIsolatedStorage(()=>{
  const library=getSongLibrary(); assert.deepEqual(library[id].steps,song.steps,"integration owner must run npm run build:songs");
  assert.equal(library[id].title,song.title);
  assert.deepEqual(library[id].sourceFeatures,song.sourceFeatures,"integration build must include the complete current source metadata");
  assert.equal(getPracticeSongId(library,id),id); assert.equal(getPracticeSongId(library,"tong-nian-chord"),id);
  assert.equal(getSongArchiveDownload(library[id]),null); assert.equal(getSongAccompanimentProvider(library[id],Object.values(library)),null);
  assert.equal(getSongAccompanimentProvider(library[id],Object.values(library),true),null);
}));

const remove=(value,beat)=>{value.steps=value.steps.filter(([,b])=>b!==beat);};
const splitTie=(value,beat,split)=>{const t=at(value,beat),end=t[1]+t[2];t[2]=split-beat;value.steps.push([t[0],split,end-split]);value.steps.sort((a,b)=>a[1]-b[1]);};
const musicalMutations={
  "retrigger-first-m10-chain-link":s=>splitTie(s,36.5,37),
  "retrigger-second-m10-chain-link":s=>splitTie(s,36.5,37.5),
  "merge-independent-m10-leading-C5":s=>{at(s,36)[2]=2;remove(s,36.5);},
  "swallow-independent-A4-after-tie":s=>{at(s,5.5)[2]=1.5;remove(s,6.5);},
  "merge-five-independent-m11-D5-attacks":s=>{at(s,40)[2]=2.5;for(const b of [40.5,41,41.5,42])remove(s,b);},
  "misread-thick-single-underline-as-sixteenths":s=>{for(let i=0;i<5;i++){const t=at(s,40+i*.5);t[1]=40+i*.25;t[2]=.25;}},
  "erase-internal-half-beat-vocal-rest":s=>{at(s,33.5)[2]=1;},
  "trim-initial-full-beat-rest":s=>{s.steps=s.steps.map(([n,b,d])=>[n,b-1,d]);s.sourceFeatures.sourceTotalBeats=63;},
  "invent-five-passes-from-five-lyric-rows":s=>{s.steps=Array.from({length:5},(_,i)=>s.steps.map(([n,b,d])=>[n,b+i*64,d])).flat();s.sourceFeatures.sourceTotalBeats=320;},
  "erase-m9-octave-dots-locally":s=>{for(const t of phrase(s,32,36))t[0]=noteName(midi(t[0])-12);},
  "change-source-degree7-into-degree6":s=>{for(const b of [5,21])at(s,b)[0]="A4";},
  "copy-m3-ending-into-separately-written-m7":s=>{at(s,27)[0]="C5";at(s,27.5)[0]="A4";},
  "flatten-m13-eighth-quarter-syncopation":s=>{at(s,48)[2]=1;const t=at(s,48.5);t[1]=49;t[2]=.5;},
  "borrow-other-edition-m4-final-quarter-rest":s=>{at(s,12)[2]=3;},
  "merge-different-pitch-m11-slur":s=>{at(s,43)[2]=1;remove(s,43.5);},
  "truncate-final-four-beat-tonic":s=>{at(s,60)[2]=2;},
  "append-invented-ending-rest":s=>{s.sourceFeatures.sourceTotalBeats=68;},
  "reuse-retained81-attack-edition":s=>{s.steps=structuredClone(archive.steps);}
};
for(const [name,mutate] of Object.entries(musicalMutations)) test(`structurally valid music mutation is rejected by selected source: ${name}`,()=>withIsolatedStorage(()=>{
  const changed=structuredClone(song);mutate(changed);
  const [structurallyValid]=parseImportedSongs(JSON.stringify(asV2(changed)),getSongLibrary());
  assert.throws(()=>assertSelectedEdition(structurallyValid));
}));
const metadataMutations={
  "claim105-is-printed-source-BPM":s=>{scope(s).sourceNumericTempoPrinted=true;scope(s).sourceQuarterBpm=105;},
  "invent-source-tempo-text":s=>{scope(s).sourceTempoText="中速";},
  "promote-vocal-rest-to-all-layer-silence":s=>{scope(s).silentWindows=[{beat:34,duration:.5}];},
  "call-initial-rest-a-pickup":s=>{scope(s).pickupBeats=1;},
  "authorize-five-passes-from-lyrics":s=>{scope(s).lyricRowsAuthorizeRepeat=true;},
  "drop-second-m10-tie-join":s=>{scope(s).ties.pop();},
  "drop-one-slur-endpoint-pair":s=>{scope(s).slurs.pop();},
  "allow-local-octave-folding":s=>{scope(s).octaveFolding=true;},
  "overwrite-historical-default-speed":s=>{s.defaultSpeedFactor=.55;},
  "add-unreviewed-backing":s=>{s.autoAccompaniment={events:[]};}
};
for(const [name,mutate] of Object.entries(metadataMutations)) test(`selected policy rejects ${name}`,()=>{
  const changed=structuredClone(song);mutate(changed);assert.throws(()=>assertSelectedEdition(changed));
});

const evidencePath=process.env.CHILDHOOD_SOURCE_EVIDENCE_PATH;
test("optional immutable source-only reader compares all79 tuples,86 heads,16 bars,7 ties,9 slurs and source scope",{
  skip:evidencePath?false:"Set CHILDHOOD_SOURCE_EVIDENCE_PATH to the actual private source-only-frozen.json; private source fixture gate not performed"
},async()=>{
  const bytes=await readFile(evidencePath); assert.equal(hash(bytes),sourceFixtureHash,"check immutable private bytes before consulting expectations");
  const source=JSON.parse(bytes);
  assert.equal(source.independence.productionSongStepsRead,false); assert.equal(source.independence.otherTranscriptionsOrCandidatesRead,false); assert.equal(source.independence.priorReviewsOrFixturesRead,false);
  assert.equal(source.source.url,sourceUrl); assert.equal(source.source.sha256,current.sourcePdfSha256);
  assert.deepEqual(source.source.pagesOneBased,current.pdfPages); assert.deepEqual(source.source.printedPages,current.printedPages);
  assert.equal(source.source.bookIdentity,current.sourceBook); assert.equal(source.source.publisherOnTitlePage,current.publisher);
  assert.equal(source.source.title,current.sourceTitle); assert.equal(source.source.subtitle,current.sourceSubtitle); assert.equal(source.source.credit,current.sourceCredit);
  assert.equal(source.voice.notInferredFromPitchHeight,true); assert.equal(source.scope.beatUnit,"quarter note");
  assert.deepEqual(source.scope.route,current.expandedSourceMeasures); assert.equal(source.scope.sourceTotalBeats,64); assert.equal(source.scope.firstAttackBeat,1);
  assert.deepEqual([source.scope.lastAttackBeat,source.scope.lastAttackDuration,source.scope.finalMelodyEndBeat,source.scope.finalRestDuration],[60,4,64,0]);
  assert.equal(source.scope.pickupBeats,0); assert.deepEqual(source.scope.repeatSigns,[]); assert.equal(source.scope.repeatExpansionApplied,false);
  assert.equal(source.notation.key,"1=G"); assert.equal(source.notation.meter,"4/4"); assert.equal(source.notation.numericTempo,null); assert.equal(source.notation.tempoText,null);
  for(const field of ["meterChanges","writtenAccidentals","augmentationDots","tuplets","unmeasuredOrnaments","fermatas","breathMarks"])assert.deepEqual(source.notation[field],[]);
  assert.equal(source.notation.principalNoteheadCount,86); assert.equal(source.notation.distinctAttackCount,79); assert.equal(source.notation.tieJoinCount,7); assert.equal(source.notation.slurCount,9);
  assert.equal(source.principalNoteheads.length,86); assert.equal(source.attacks.length,79);
  assert.equal(hash(JSON.stringify(source.principalNoteheads.map(h=>[h.id,h.degree,h.octaveDotsAbove,h.octaveDotsBelow,h.beat,h.duration,h.sourceMidiUnderDeclaredConvention]))),printedHeadsHash);
  const sourceMidi=source.attackTuplesDegreeOctaveBeatDuration.map(([d,o,b,t])=>[67+[0,2,4,5,7,9,11][d-1]+12*o,b,t]);
  assert.equal(hash(JSON.stringify(sourceMidi)),sourceMidiTupleHash);
  assert.deepEqual(sourceMidi,source.attacks.map(a=>[a.sourceMidiUnderDeclaredConvention,a.beat,a.duration]));
  assert.deepEqual(sourceMidi.map(([m,b,d])=>[noteName(m),b,d]),source.attackTuplesSourcePitchBeatDuration);
  const expected=sourceMidi.map(([m,b,d])=>[noteName(m-7),b,d]); assert.equal(hash(JSON.stringify(expected)),tupleHash); assert.deepEqual(song.steps,expected);
  assert.deepEqual(source.vocalRests.map(r=>[r.beat,r.duration]),rests);
  assert.deepEqual(source.pitchFit.sourcePitchClassesC0,current.sourcePitchClasses); assert.deepEqual(source.pitchFit.allowedGlobalPitchClassShiftsModulo12,[5,10]);
  assert.deepEqual(source.pitchFit.allRegisterValidGlobalSemitoneShifts.map(s=>s.semitones),[-14,-7,-2]);
  const hid=(m,n)=>`m${String(m).padStart(2,"0")}-h${String(n).padStart(2,"0")}`;
  const head=id=>source.principalNoteheads.find(h=>h.id===id);
  const endpoint=id=>{const h=head(id);return[noteName(h.sourceMidiUnderDeclaredConvention-7),h.beat,h.duration]};
  const derivedTies=source.notation.ties.map(t=>{const sourceHeads=[hid(t.measure,t.fromHeadIndex),hid(t.measure,t.toHeadIndex)],a=source.attacks.find(a=>a.headIds.includes(sourceHeads[0]));return{sourceMeasure:t.measure,sourceHeads,from:endpoint(sourceHeads[0]),to:endpoint(sourceHeads[1]),mergedAttack:[noteName(a.sourceMidiUnderDeclaredConvention-7),a.beat,a.duration]};});
  const derivedSlurs=source.notation.differentPitchSlurs.map(t=>{const sourceHeads=[hid(t.measure,t.fromHeadIndex),hid(t.measure,t.toHeadIndex)];return{sourceMeasure:t.measure,sourceHeads,from:endpoint(sourceHeads[0]),to:endpoint(sourceHeads[1]),separateAttacksRetained:t.separateAttacksRetained};});
  assert.deepEqual(derivedTies,ties); assert.deepEqual(derivedSlurs,slurs);
  assert.deepEqual(source.measures.map(m=>[m.editorialMeasure,m.principalNoteheadCount,expected.filter(([,b])=>b>=m.beat&&b<m.beat+4).length,m.restDuration]),barDecisions.map(b=>b.slice(0,4)));
  const evidence={songId:id,source:{reference:sourceUrl,scope:"all sixteen once-written vocal bars; guitar omitted, source rests are vocal only"},sourceTotalBeats:64,pitchFit:{sourcePitchClasses:[2,4,6,7,9,11],semitoneShift:-7},melodySpans:source.measures.map(m=>({from:m.beat,to:m.beat+4,attacks:expected.filter(([,b,d])=>b<m.beat+4&&b+d>m.beat)}))};
  // Do not put source vocal rests into the reusable checker's all-layer silentWindows.
  const result=checkTranscriptionEvidence(song,evidence);assert.equal(result.reviewedSpans,16);assert.equal(result.checkedAttacks,79);assert.equal(result.checkedSilentWindows,0);
  for(const [name,mutate] of Object.entries(musicalMutations)){const changed=structuredClone(song);mutate(changed);assert.throws(()=>checkTranscriptionEvidence(changed,evidence),name);}
});
