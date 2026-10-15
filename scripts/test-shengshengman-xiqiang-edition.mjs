import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { analyzeSongTiming } from "./song-report-analysis.mjs";
import { CURRENT_SONG_STORAGE_KEY, getCustomSongs, getPracticeSongs, getPracticeSongId,
  getSongArchiveDownload, getSongLibrary, getSongMeterLabel, getSongAccompanimentProvider,
  getSongReviewNotice, shouldExpandSongReviewNotice, parseImportedSongs, saveCustomSongs } from "../src/song-store.js";
import { createLoopRange, getPracticeTotalBeats, isBeatInLoop } from "../src/practice-loop.js";
import { SONG_SPEED_STORAGE_KEY, readSongSpeed } from "../src/practice-preferences.js";
import { checkTranscriptionEvidence, fittingTranspositions } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const id = "sheng-sheng-man", archivePath = "data/archives/sheng-sheng-man-v2.4.40.json";
const song = JSON.parse(await read(`data/songs/${id}.json`));
const archiveBytes = await read(archivePath), archive = JSON.parse(archiveBytes);
const archiveHash = "3409453b57ca4c84bc62657bb54f8f3afaca34309664006834220d5a9ffdc7e8";
const firstFixtureHash = "efa0bee71b9789bc077aeb88d296b1e8dfd982dda7c9cfdb2b16e90f65fab079";
const graceCorrectionHash = "aa301605556dd05d52638e6f3fffd5cb092efc52535995f7772a403fa1a854bc";
const sourceFixtureHash = "46dc801b1ed4d2a46a89d8adb62f4e68334bfea414ab03db82515fd0bdf31eed";
const imageHash = "65d088eec9babf4d6c22dcfff8c7a5833ec11e9e40157a6aa01727d972dd2277";
const tupleHash = "91b94ec970bbb71be0d84ed58aad5ded16006c38a2ec7fcac8a83b84081b002e";
const writtenTupleHash = "02b501a8d4b5ba0680b101b8ab84bb9958a39202f31f3378a7791e8a4ab15824";
const sourceMidiTupleHash = "652b0f3083d4d41bbd93bb51147f77319c076ccbcfae311a430dac3c69102e87";
const printedHeadsHash = "80a4630c62814e02f2c9cae040540a4f5bf71924ac0ea852a5259798d726cfde";
const sourceUrl = "https://www.cangqiang.com.cn/bofang/56707.html";
const review = song.sourceFeatures.sourceReview, current = review.currentScopeReview;
const scope = value => value.sourceFeatures.sourceReview.currentScopeReview;

// Fixed solely from reader B's immutable, independently completed source-only
// reading BEFORE this test author consulted production. Never regenerate these
// expectations from the song. Public regressions retain hashes and focused
// decisions; the complete private score/fixture stays outside the repository.
// [written bar, printed heads, starting attacks, overlapping attacks,
//  SHA256 of full overlapping [pitch, bar-relative onset, duration] tuples].
const barDecisions = [
  [1,6,6,6,"8bbaee7a3931cda736b8de369a4c18de37fd2a441b3744f141edc151aa5d104a"],
  [2,5,5,5,"ee21c74cafc8e6d194dbca1edc586b4d8b6beb9499fda5891d416105fb1362e7"],
  [3,7,7,7,"b49c65055ff629cd64a40c891c96b00ff42724f05761f88790e07e65a082c15d"],
  [4,3,3,3,"a307395e78b367133714ead2eade153082cc8a260bf35e5cf2bfbc7a40d984e6"],
  [5,6,6,6,"8bbaee7a3931cda736b8de369a4c18de37fd2a441b3744f141edc151aa5d104a"],
  [6,5,5,5,"ee21c74cafc8e6d194dbca1edc586b4d8b6beb9499fda5891d416105fb1362e7"],
  [7,8,8,8,"f1f2df215173db61c13ab1b756922a517aa735c3acbe6060fedc712cd8155feb"],
  [8,4,4,4,"6b35edece09f36c90455d033d23f5f6651a443474b3d72a06b39894bd9e1a671"],
  [9,5,5,5,"28cfd4903c1a039b96a7a0a52c89eb4a7d9965772e2e57b3e976d679baa65022"],
  [10,5,5,5,"cbf3b8736d8e1705a78df13287902ecb1645d5b932d84c980de10f50aa58eccc"],
  [11,8,8,8,"d95359f35a726eb07bfd90e44d913b7f17db25de66a19304f483627c88003912"],
  [12,3,1,2,"931d4802713d804704db24230e45b733b8bde28f984605e4d3a7d093f653b03a"],
  [13,5,5,5,"28cfd4903c1a039b96a7a0a52c89eb4a7d9965772e2e57b3e976d679baa65022"],
  [14,5,5,5,"cbf3b8736d8e1705a78df13287902ecb1645d5b932d84c980de10f50aa58eccc"],
  [15,8,8,8,"2e855b6d0a22db01d69eb21e7f92aac776f37544ac814363b044b95d8bb9d47e"],
  [16,3,1,2,"c162b30ce7f7db0217e17befc42a3ddb1e2c70a0f3e7d95e4513aa39bbc6ad6e"],
  [17,6,6,6,"8bbaee7a3931cda736b8de369a4c18de37fd2a441b3744f141edc151aa5d104a"],
  [18,5,5,5,"ee21c74cafc8e6d194dbca1edc586b4d8b6beb9499fda5891d416105fb1362e7"],
  [19,7,7,7,"b49c65055ff629cd64a40c891c96b00ff42724f05761f88790e07e65a082c15d"],
  [20,3,3,3,"a307395e78b367133714ead2eade153082cc8a260bf35e5cf2bfbc7a40d984e6"],
  [21,5,5,5,"fc8e04eba0ce1b4802ff86def2b13fd40164ea783ebf5d62e1c4d8842d397742"],
  [22,5,5,5,"ee21c74cafc8e6d194dbca1edc586b4d8b6beb9499fda5891d416105fb1362e7"],
  [23,9,9,9,"090e817b83c0b031d0a4c56641dae3270a72b3037595acbd373ee65c07099328"],
  [24,4,4,4,"fdbfc9b9f5649882b45b554708914eb12132d677b6a2b9692a1e0ca29142be26"]
];
// Endpoint tuples are in the selected uniform +8 realization, written pass only.
const tieEndpoints = [
  ["m11h08","m12h01",["G5",43.5,0.5],["G5",44,0.5]],
  ["m12h02","m12h03",["E5",44.5,0.5],["E5",45,3]],
  ["m15h08","m16h01",["D5",59.5,0.5],["D5",60,0.5]],
  ["m16h02","m16h03",["C5",60.5,0.5],["C5",61,3]]
];
const slurEndpoints = [
  ["m01h05","m01h06",["D5",2,1.5],["C5",3.5,0.5]],
  ["m08h02","m08h03",["A4",29.5,0.25],["C5",29.75,0.25]],
  ["m09h03","m09h04",["E5",33.5,0.25],["D5",33.75,0.25]],
  ["m10h03","m10h04",["D5",37.5,0.25],["C5",37.75,0.25]],
  ["m13h03","m13h04",["E5",49.5,0.25],["D5",49.75,0.25]],
  ["m14h03","m14h04",["D5",53.5,0.25],["C5",53.75,0.25]],
  ["m17h05","m17h06",["D5",66,1.5],["C5",67.5,0.5]],
  ["m23h04","m23h05",["C5",89.5,0.25],["A4",89.75,0.25]],
  ["m24h02","m24h03",["A4",93.5,0.25],["B4",93.75,0.25]]
];
const untiedEndpoints = [
  ["m01h02","m01h03",["G5",0.5,0.5],["G5",1,0.5]],
  ["m02h02","m02h03",["C5",4.5,0.5],["C5",5,0.5]],
  ["m05h02","m05h03",["G5",16.5,0.5],["G5",17,0.5]],
  ["m06h02","m06h03",["C5",20.5,0.5],["C5",21,0.5]],
  ["m08h03","m08h04",["C5",29.75,0.25],["C5",30,2]],
  ["m09h01","m09h02",["A4",32,0.5],["A4",32.5,1]],
  ["m09h04","m09h05",["D5",33.75,0.25],["D5",34,2]],
  ["m10h01","m10h02",["G4",36,0.5],["G4",36.5,1]],
  ["m10h04","m10h05",["C5",37.75,0.25],["C5",38,2]],
  ["m11h02","m11h03",["C5",40.5,0.5],["C5",41,0.5]],
  ["m13h01","m13h02",["A4",48,0.5],["A4",48.5,1]],
  ["m13h04","m13h05",["D5",49.75,0.25],["D5",50,2]],
  ["m14h01","m14h02",["G4",52,0.5],["G4",52.5,1]],
  ["m14h04","m14h05",["C5",53.75,0.25],["C5",54,2]],
  ["m15h02","m15h03",["C5",56.5,0.5],["C5",57,0.5]],
  ["m17h02","m17h03",["G5",64.5,0.5],["G5",65,0.5]],
  ["m18h02","m18h03",["C5",68.5,0.5],["C5",69,0.5]],
  ["m21h02","m21h03",["G5",80.5,0.5],["G5",81,0.5]],
  ["m22h02","m22h03",["C5",84.5,0.5],["C5",85,0.5]],
  ["m23h03","m23h04",["C5",89,0.5],["C5",89.5,0.25]]
];
const graceDecisions = [
  [1,"m01h02",3,-1,"G#3",0.5],
  [2,"m02h05",3,0,"G#4",6],
  [3,"m03h04",7,-1,"D#4",9.5],
  [4,"m04h03",3,-1,"G#3",14],
  [5,"m05h02",3,-1,"G#3",16.5],
  [6,"m06h05",3,-1,"G#3",22],
  [9,"m09h05",3,-1,"G#3",34],
  [10,"m10h05",2,-1,"F#3",38],
  [13,"m13h05",3,-1,"G#3",50],
  [14,"m14h05",2,-1,"F#3",54],
  [15,"m15h02",7,0,"D#5",56.5],
  [15,"m15h04",7,-1,"D#4",57.5],
  [18,"m18h05",3,-1,"G#3",70],
  [21,"m21h05",3,-1,"G#3",82]
];
const waveDecisions = [
  [4,"m04h01","F#4"],
  [8,"m08h01","F#4"],
  [20,"m20h01","F#4"],
  [24,"m24h01","F#4"]
];

const phrase = (value, from, to) => value.steps.filter(([,b]) => b >= from && b < to);
const span = (value, from, to) => value.steps.filter(([,b,d]) => b < to && b+d > from);
const at = (value, beat) => value.steps.find(([,b]) => b === beat);
const midi = name => { const [,letter,accidental,octave] = /^([A-G])([#b]?)(\d)$/.exec(name);
  return 12*(+octave+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[letter]+(accidental==="#"?1:accidental==="b"?-1:0); };
const noteName = value => ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][value%12]+(Math.floor(value/12)-1);
const offset = (tuple, delta) => [tuple[0],tuple[1]+delta,tuple[2]];
const overlap = (b,d,from,to) => Math.max(0,Math.min(b+d,to)-Math.max(b,from));
const eventsFor = steps => steps.map(([name,beat,duration]) => ({beat,duration,notes:[{name,role:"melody",judge:true}]}));
function asV2(value) {
  const result={...structuredClone(value),schemaVersion:2,arrangementKind:"melody",judgementMode:"melody",events:eventsFor(value.steps)};
  delete result.steps; return result;
}
function withIsolatedStorage(run) {
  const previous=globalThis.localStorage,values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
  try{return run(values);}finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
}
// Musical source predicate is separate from the import schema and prose claims.
// Negative controls must first survive parseImportedSongs, then fail this gate.
function assertSourceMusic(value) {
  assert.equal(value.steps.length,252,"the actual paired repeat gives exactly two passes");
  assert.equal(hash(JSON.stringify(value.steps)),tupleHash,"all252 independently source-authored principal tuples");
  assert.equal(value.bpm,72,"printed quarter-note tempo, not a guessed practice BPM");
  assert.equal(value.beatsPerMeasure,4); assert.equal(value.key,"C");
  assert.equal(value.sourceFeatures.sourceTotalBeats,192,"selected ending, no extra tail rest");
  for(const delta of [0,96])for(const [bar,,starts,overlaps,fingerprint]of barDecisions){
    const from=(bar-1)*4+delta,tuples=span(value,from,from+4);
    assert.equal(phrase(value,from,from+4).length,starts,`pass${delta/96+1} m${bar} attack count`);
    assert.equal(tuples.length,overlaps,`pass${delta/96+1} m${bar} includes cross-bar sustain`);
    assert.equal(hash(JSON.stringify(tuples.map(([n,b,d])=>[n,b-from,d]))),fingerprint,`pass${delta/96+1} m${bar} occurrence-specific source hash`);
    assert.equal(tuples.reduce((sum,[,b,d])=>sum+overlap(b,d,from,from+4),0),4,`pass${delta/96+1} m${bar} preserves all principal beats`);
  }
}
function assertSelectedPolicy(value){
  const f=value.sourceFeatures,s=scope(value);
  assert.equal(value.defaultSpeedFactor,1);assert.equal(value.difficulty,"medium");
  assert.equal(f.sourceKey,"E");assert.equal(f.transpositionSemitones,8);
  assert.equal(f.sourceWrittenMeasureCount,24);assert.equal(f.sourceMeasureCount,48);
  assert.equal(f.hasRepeats,true);assert.equal(f.hasChords,false);assert.equal(f.hasArpeggio,false);
  assert.equal(s.status,"reviewed-selected-xiqiang-principal-edition");
  assert.equal(s.sourceWrittenMeasureCount,24);assert.equal(s.sourceExpandedMeasureCount,48);
  assert.equal(s.sourceWrittenTotalBeats,96);assert.equal(s.sourceTotalBeats,192);
  assert.deepEqual(s.literalRoute,Array.from({length:24},(_,i)=>i+1));
  assert.deepEqual(s.expandedRoute,[...s.literalRoute,...s.literalRoute]);assert.equal(s.repeatCount,2);
  assert.equal(s.sourceMeter,"4/4");assert.equal(s.beatUnit,"quarter-note");
  assert.equal(s.sourceQuarterBpm,72);assert.equal(s.sourceNumericTempoPrinted,true);
  assert.equal(s.sourceKey,"E");assert.equal(s.transpositionSemitones,8);assert.equal(s.globalOctaveShift,1);
  assert.equal(s.octaveFolding,false);assert.deepEqual(s.localPitchAlterations,[]);assert.deepEqual(s.additionalMelodyAccidentals,[]);
  assert.equal(s.principalWrittenHeadCount,130);assert.equal(s.principalWrittenAttackCount,126);
  assert.equal(s.principalExpandedHeadCount,260);assert.equal(s.principalExpandedAttackCount,252);
  assert.equal(s.writtenTieJoins,4);assert.equal(s.expandedTieJoins,8);
  assert.deepEqual(s.samePitchTies.map(t=>[...t.sourceHeads,t.from,t.to]),tieEndpoints);
  assert.equal(s.samePitchTies[0].location,"cross-system");
  assert.equal(s.writtenDifferentPitchSlurs,9);assert.deepEqual(s.differentPitchSlurs.map(t=>[t.from,t.to]),slurEndpoints.map(t=>t.slice(0,2)));
  assert.equal(s.writtenUntiedSamePitchPairs,20);assert.deepEqual(s.untiedSamePitchPairs.map(t=>[t.from,t.to]),untiedEndpoints.map(t=>t.slice(0,2)));
  assert.ok(s.untiedSamePitchPairs.every(t=>t.merge===false));
  const o=s.ornaments;assert.equal(o.decision,"explicitly-omitted-nonmetric-ornaments");
  assert.deepEqual([o.writtenGraceCount,o.expandedGraceCount,o.writtenWaveCount,o.expandedWaveCount],[14,28,4,8]);
  assert.deepEqual(o.graces.map(g=>[g.sourceMeasure,g.beforeHead,g.sourceDegree,g.sourceOctave,g.sourcePitch,g.principalBeat]),graceDecisions);
  assert.ok(o.graces.every(g=>g.quantifiedDuration===null&&g.principalTimingChanged===false));
  assert.deepEqual(o.waves.map(w=>[w.sourceMeasure,w.onHead,w.sourcePrincipalPitch]),waveDecisions);
  assert.ok(o.waves.every(w=>w.quantifiedDuration===null&&w.auxiliaryNotesSpecified===false));
  assert.deepEqual(s.rests,[]);assert.equal(s.pickupBeats,0);assert.equal(s.endingRestBeats,0);assert.deepEqual(s.fermatas,[]);
  assert.deepEqual(s.finalAttack,["C5",190,2]);
  assert.equal(s.fullSelectedPrincipalMelodyReviewed,true);assert.equal(s.fullOrnamentedPerformanceApproved,false);assert.equal(s.fullSongApproved,false);
  assert.equal(s.addedSupport,false);assert.equal(s.sourcePerformer,null);
  for(const field of ["autoAccompaniment","practiceAccompaniment"])assert.equal(value[field],undefined);
}

test("the full 24-bar xiqiang selection follows two actual passes,252 attacks and one canonical identity",()=>{
  assertSourceMusic(song);assertSelectedPolicy(song);
  assert.equal(song.id,id);assert.equal(song.schemaVersion,1);assert.equal(song.uploader,"system");
  assert.equal(song.title,"《声声慢》（戏腔简谱版）");
  assert.equal(song.practiceTitle,`${song.title}练习轨道`);assert.equal(song.scoreTitle,`${song.title}简谱进度`);
  assert.equal(getSongMeterLabel(song),"4/4");
  assert.equal(barDecisions.reduce((sum,[,n])=>sum+n,0),130);assert.equal(barDecisions.reduce((sum,[,,n])=>sum+n,0),126);
  assert.equal(hash(JSON.stringify(phrase(song,0,96))),writtenTupleHash);
  assert.deepEqual(phrase(song,96,192).map(t=>offset(t,-96)),phrase(song,0,96));
  assert.deepEqual(song.steps.slice(0,3),[["E5",0,.5],["G5",.5,.5],["G5",1,.5]]);
  assert.deepEqual(song.steps.at(-1),["C5",190,2]);
  assert.match(song.hint,/逸兔.*24.*两遍.*252.*192/);assert.match(song.hint,/72 BPM.*14.*4.*无伴奏/);
});

test("all four same-pitch ties, nine slurs and twenty untied pairs survive in both passes",()=>{
  for(const delta of [0,96]){
    for(const [a,b,from,to]of tieEndpoints){
      assert.equal(from[0],to[0]);assert.equal(from[1]+from[2],to[1]);
      assert.deepEqual(at(song,from[1]+delta),[from[0],from[1]+delta,from[2]+to[2]],`${a}→${b}`);
      assert.equal(at(song,to[1]+delta),undefined,"tie continuation is never a physical target");
    }
    for(const [, ,from,to]of slurEndpoints){assert.notEqual(from[0],to[0]);assert.deepEqual(at(song,from[1]+delta),offset(from,delta));assert.deepEqual(at(song,to[1]+delta),offset(to,delta));}
    for(const [a,b,from,to]of untiedEndpoints){assert.equal(from[0],to[0]);assert.deepEqual(at(song,from[1]+delta),offset(from,delta),a);assert.deepEqual(at(song,to[1]+delta),offset(to,delta),b);}
  }
  assert.deepEqual(at(song,43.5),["G5",43.5,1]);assert.deepEqual(at(song,44.5),["E5",44.5,3.5]);
  assert.deepEqual(at(song,59.5),["D5",59.5,1]);assert.deepEqual(at(song,60.5),["C5",60.5,3.5]);
});

test("later separately written returns and sixteenth pairs retain their own source decisions",()=>{
  assert.deepEqual(phrase(song,76,80),[["D5",76,1.5],["C5",77.5,.5],["D5",78,2]]);
  assert.deepEqual(phrase(song,80,84),[["E5",80,.5],["G5",80.5,.5],["G5",81,.5],["C5",81.5,.5],["D5",82,2]]);
  assert.deepEqual(phrase(song,88,92),[["A4",88,.5],["B4",88.5,.5],["C5",89,.5],["C5",89.5,.25],["A4",89.75,.25],["G4",90,.5],["A4",90.5,.5],["C5",91,.5],["E5",91.5,.5]]);
  assert.deepEqual(phrase(song,92,96),[["D5",92,1.5],["A4",93.5,.25],["B4",93.75,.25],["C5",94,2]]);
  assert.notDeepEqual(phrase(song,80,84).map(t=>offset(t,-80)),phrase(song,16,20).map(t=>offset(t,-16)));
  assert.notDeepEqual(phrase(song,88,92).map(t=>offset(t,-88)),phrase(song,24,28).map(t=>offset(t,-24)));
  assert.notDeepEqual(phrase(song,92,96).map(t=>offset(t,-92)),phrase(song,28,32).map(t=>offset(t,-28)));
  // m20 shares m4 principals, but m4 has a grace before its last principal and
  // m20 does not. Similar principal music must not copy source ornament metadata.
  assert.ok(graceDecisions.some(([bar])=>bar===4));assert.ok(!graceDecisions.some(([bar])=>bar===20));
});

test("one uniform plus8 shift preserves literal octaves and all source intervals within E4–G5",()=>{
  const keyNames=new Set(DISPLAY_KEYS.map(k=>k.name)),keyMidi=new Set([...keyNames].map(midi));
  const recovered=song.steps.map(([n,b,d])=>[midi(n)-8,b,d]);
  assert.equal(hash(JSON.stringify(recovered)),sourceMidiTupleHash);
  assert.deepEqual([...new Set(recovered.map(([m])=>m%12))].sort((a,b)=>a-b),[1,3,4,6,8,11]);
  assert.deepEqual(fittingTranspositions([1,3,4,6,8,11]),[1,8]);
  const validShifts=Array.from({length:97},(_,i)=>i-48).filter(shift=>recovered.every(([m])=>keyMidi.has(m+shift)));
  assert.deepEqual(validShifts,[1,8,13]);
  assert.deepEqual([Math.min(...recovered.map(([m])=>m)),Math.max(...recovered.map(([m])=>m))],[56,71]);
  assert.deepEqual([Math.min(...song.steps.map(([n])=>midi(n))),Math.max(...song.steps.map(([n])=>midi(n)))],[64,79]);
  assert.deepEqual(current.sourcePrincipalRange,["G#3","B4"]);assert.deepEqual(current.compiledRange,["E4","G5"]);
  assert.ok(song.steps.every(([n])=>keyNames.has(n)));
  assert.equal(Math.min(...song.steps.slice(1).map(([,b],i)=>b-song.steps[i][1])),.25);
  assert.ok(Math.abs(.25*60000/72-208.33333333333334)<1e-9);
  assert.equal(song.defaultSpeedFactor,archive.defaultSpeedFactor);assert.equal(song.difficulty,archive.difficulty);
  assert.equal(song.sourceFeatures.suitability.status,"conditional");
});

test("no written rest, fermata or guessed breathing gap is added and the final C5 ends at192",()=>{
  const report=analyzeSongTiming(song);
  assert.deepEqual(report.melodyGaps,[]);assert.deepEqual(report.issues,[]);assert.deepEqual(report.unannotatedLongGaps,[]);
  assert.equal(song.steps.reduce((sum,[,,d])=>sum+d,0),192);
  assert.equal(report.declaredEnd,192);assert.equal(report.sourceEnd,192);assert.equal(report.scoreExtent,192);
  const events=eventsFor(song.steps);assert.equal(getPracticeTotalBeats(events,song),192);
  const lastLoop=createLoopRange(events,192,192,4);assert.deepEqual(lastLoop,{startBeat:188,endBeat:192});assert.equal(isBeatInLoop(192,lastLoop),false);
  assert.match(current.breathDecision,/Punctuation does not authorize a new rest/);
});

test("selected identity, omitted ornaments and independent-reader limits remain explicit",()=>{
  assert.equal(current.adoptedInVersion,"2.4.41");assert.equal(current.sourceUrl,sourceUrl);assert.equal(current.sourceImageSha256,imageHash);
  assert.deepEqual(current.sourceImageDimensions,[615,1246]);
  assert.deepEqual([current.sourceTitle,current.sourceSubtitle,current.sourceComposer,current.sourceLyricist,current.sourceEngraver,current.sourcePerformer],["声声慢","戏腔","刘洋","崔开潮","逸兔",null]);
  assert.equal(current.independentSourceReaders,2);assert.equal(current.independentPublishedSources,1);
  assert.equal(current.firstFrozenSourceReadingSha256,firstFixtureHash);assert.equal(current.independentSourceFixtureSha256,sourceFixtureHash);
  assert.equal(current.postFreezeGraceCorrectionSha256,graceCorrectionHash);assert.equal(current.sourceMidiTupleSha256,sourceMidiTupleHash);assert.equal(current.compiledTupleSha256,tupleHash);
  assert.match(current.sourceReviewMethod,/all130 principal heads.*126 written attacks.*4 ties.*9 slurs.*20 untied.*252 expanded/);
  assert.match(current.sourceReviewMethod,/one nonmetric grace octave.*later addendum/);
  assert.match(current.ornaments.registerReconciliation,/A initially read lower3.*corrected.*undotted3/);
  assert.match(current.ornaments.registerReconciliation,/not initial independent agreement on every ornament/);
  assert.equal(current.oldEditionReverified,false);assert.equal(current.historicalSourceImageIdentityVerified,false);
  assert.equal(current.referenceListening,"not-performed");assert.equal(current.browserAudio,"not-performed-at-data-adoption");
  assert.equal(current.physicalKalimba,"not-performed");assert.equal(current.publicDistributionRights,"unestablished-private-preview-only");
  assert.deepEqual(review.historicalSourceFeatures,archive.sourceFeatures);
});

test("complete old76/64 bytes remain recoverable internally without a sibling, extra card or archive UI",async()=>{
  assert.equal(hash(archiveBytes),archiveHash);assert.equal(archive.steps.length,76);assert.equal(archive.id,id);
  assert.equal(getPracticeTotalBeats(eventsFor(archive.steps),archive),64);
  assert.equal(review.archivedEdition.file,archivePath);assert.equal(review.archivedEdition.fileSha256,archiveHash);
  assert.equal(review.archivedEdition.attackCount,76);assert.equal(review.archivedEdition.melodyEndBeat,64);
  for(const value of [archive,song])for(const field of ["autoAccompaniment","practiceAccompaniment"])assert.equal(value[field],undefined,"no real old backing is fabricated");
  const files=await readSongFiles();assert.equal(files.length,57);assert.equal(files.filter(({song:s})=>s.schemaVersion===1).length,36);
  assert.deepEqual(files.filter(({song:s})=>s.id===id||s.id.startsWith(`${id}-`)).map(({song:s})=>s.id),[id]);
  assert.equal(getSongArchiveDownload(song),null);assert.equal(current.archiveImportPath,undefined);
  for(const file of ["service-worker.js","serve-kalimba.js","src/app.js","src/song-library.js"])
    assert.ok(!(await read(file)).toString().includes("sheng-sheng-man-v2.4.40.json"),`${file}: no archive route or precache`);
});

test("real archive import/save/read preserves every original value and does not change canonical selection or saved speed",()=>withIsolatedStorage(values=>{
  const speedBytes=JSON.stringify({schemaVersion:1,songs:{[id]:{speed:.65}}});values.set(SONG_SPEED_STORAGE_KEY,speedBytes);values.set(CURRENT_SONG_STORAGE_KEY,id);
  const library=getSongLibrary(),before=JSON.stringify(library),ids=getPracticeSongs(library).map(s=>s.id).sort();
  const [restored]=parseImportedSongs(archiveBytes.toString(),library);
  assert.notEqual(restored.id,id);assert.notEqual(restored.baseSongId,id);assert.equal(restored.schemaVersion,2);assert.equal(restored.source,"local");
  assert.deepEqual(restored.steps,archive.steps);assert.deepEqual(restored.sourceFeatures,archive.sourceFeatures);
  saveCustomSongs([restored]);const [saved]=getCustomSongs();
  const normalizedFields=new Set(["schemaVersion","id","uploader","practiceTitle","scoreTitle"]);
  const recovered=Object.fromEntries(Object.keys(archive).map(key=>[key,normalizedFields.has(key)?archive[key]:saved[key]]));
  assert.deepEqual(recovered,archive,"every archived field after reversing documented normalization only");
  assert.equal(JSON.stringify(library),before);assert.deepEqual(getPracticeSongs(library).map(s=>s.id).sort(),ids);
  const merged={...library,[saved.id]:saved};assert.equal(getPracticeSongs(merged).length,37);
  assert.equal(getPracticeSongId(merged,id),id);assert.equal(getPracticeSongId(merged,saved.id),saved.id);
  const [again]=parseImportedSongs(archiveBytes.toString(),merged);assert.notEqual(again.id,saved.id);assert.deepEqual(again.steps,archive.steps);
  assert.equal(values.get(SONG_SPEED_STORAGE_KEY),speedBytes);assert.deepEqual(readSongSpeed(globalThis.localStorage,id),{speed:.65});assert.equal(values.get(CURRENT_SONG_STORAGE_KEY),id);
}));

test("actual V1 and explicit-melody V2 imports and storage preserve the complete selected source",()=>withIsolatedStorage(()=>{
  const library=getSongLibrary();
  for(const value of [song,asV2(song)]){
    const [imported]=parseImportedSongs(JSON.stringify(value),library);assertSourceMusic(imported);assertSelectedPolicy(imported);
    assert.ok(imported.events.every(e=>e.notes.length===1&&e.notes[0].role==="melody"&&e.notes[0].judge===true));
    saveCustomSongs([imported]);const [saved]=getCustomSongs();assertSourceMusic(saved);assertSelectedPolicy(saved);
    assert.deepEqual(saved.events.map(e=>[e.notes[0].name,e.beat,e.duration]),song.steps);
  }
  const forbidden=asV2(song);forbidden.practiceAccompaniment=null;
  assert.throws(()=>parseImportedSongs(JSON.stringify(forbidden),library),/practiceAccompaniment/);
}));

test("generated canonical module retains one card, the complete reviewed metadata and no accompaniment on either provider path",()=>withIsolatedStorage(()=>{
  const library=getSongLibrary();assert.deepEqual(library[id].steps,song.steps,"integration owner must build generated module");
  assert.equal(library[id].title,song.title);assert.deepEqual(library[id].sourceFeatures,song.sourceFeatures);
  assertSourceMusic(library[id]);assertSelectedPolicy(library[id]);
  assert.equal(getPracticeSongs(library).length,36);assert.equal(getPracticeSongId(library,id),id);
  assert.equal(getSongArchiveDownload(library[id]),null);
  for(const originalOnly of [false,true])assert.equal(getSongAccompanimentProvider(library[id],Object.values(library),originalOnly),null);
}));

test("the informational review disclosure identifies the selected extent, source tempo and omitted ornaments without an old-version action",()=>{
  const notice=getSongReviewNotice(song);assert.ok(notice);
  for(const term of [/逸兔/,/戏腔/,/24/,/两遍|2遍/,/252/,/192/,/72/,/倚音/,/波音/,/无伴奏|不添加伴奏/])assert.match(notice,term);
  assert.doesNotMatch(notice,/旧版.*(?:下载|恢复|还原|导入)|原版错误|原唱全曲已核实/);
  assert.equal(shouldExpandSongReviewNotice(song),false);
});

const remove=(value,beat)=>{value.steps=value.steps.filter(([,b])=>b!==beat);};
const splitTie=(value,beat,split)=>{const t=at(value,beat),end=t[1]+t[2];t[2]=split-beat;value.steps.push([t[0],split,end-split]);value.steps.sort((a,b)=>a[1]-b[1]);};
const copyBar=(value,from,to)=>{const replacement=phrase(value,from,from+4).map(t=>offset(t,to-from));value.steps=value.steps.filter(([,b])=>b<to||b>=to+4).concat(replacement).sort((a,b)=>a[1]-b[1]);};
const musicalMutations={
  "omit-actual-second-pass":s=>{s.steps=phrase(s,0,96);s.sourceFeatures.sourceTotalBeats=96;},
  "invent-third-pass-from-lyrics":s=>{s.steps.push(...phrase(s,0,96).map(t=>offset(t,192)));s.sourceFeatures.sourceTotalBeats=288;},
  "split-cross-system-G5-tie":s=>splitTie(s,43.5,44),
  "split-within-bar-E5-tie":s=>splitTie(s,44.5,45),
  "split-cross-bar-D5-tie":s=>splitTie(s,59.5,60),
  "split-within-bar-C5-tie":s=>splitTie(s,60.5,61),
  "split-second-pass-cross-system-tie":s=>splitTie(s,139.5,140),
  "merge-independent-opening-G5-pair":s=>{at(s,.5)[2]=1;remove(s,1);},
  "merge-independent-m23-C5-pair":s=>{at(s,89)[2]=.75;remove(s,89.5);},
  "absorb-different-pitch-slur":s=>{at(s,2)[2]=2;remove(s,3.5);},
  "copy-earlier-m5-into-m21":s=>copyBar(s,16,80),
  "copy-earlier-m7-into-m23":s=>copyBar(s,24,88),
  "copy-earlier-m8-into-m24":s=>copyBar(s,28,92),
  "local-octave-drop-at-opening":s=>{at(s,0)[0]="E4";},
  "naturalize-source-leading-tone":s=>{at(s,8.5)[0]="A4";},
  "invent-grace-by-stealing-principal-time":s=>{const t=at(s,.5);t[1]=.75;t[2]=.25;s.steps.push(["E4",.5,.25]);s.steps.sort((a,b)=>a[1]-b[1]);},
  "invent-wave-auxiliary-attack":s=>{at(s,12)[2]=.25;s.steps.push(["E5",12.25,1.25]);s.steps.sort((a,b)=>a[1]-b[1]);},
  "cut-long-tie-for-fake-breath":s=>{at(s,44.5)[2]=3;},
  "flatten-later-sixteenth-pair":s=>{at(s,93.5)[2]=.125;at(s,93.75)[1]=93.625;at(s,93.625)[2]=.375;},
  "replace-printed72-with-practice90-BPM":s=>{s.bpm=90;},
  "truncate-last-C5":s=>{at(s,190)[2]=1;},
  "append-unwritten-ending-rest":s=>{s.sourceFeatures.sourceTotalBeats=196;},
  "reuse-old76-tuple-edition":s=>{s.steps=structuredClone(archive.steps);s.sourceFeatures.sourceTotalBeats=64;}
};
for(const [name,mutate]of Object.entries(musicalMutations))test(`schema-valid musical mutation fails independent source expectations: ${name}`,()=>withIsolatedStorage(()=>{
  const changed=structuredClone(song);mutate(changed);
  const [structurallyValid]=parseImportedSongs(JSON.stringify(asV2(changed)),getSongLibrary());
  assert.ok(structurallyValid.events.length>0,"actual importer accepted this negative control");
  assert.throws(()=>assertSourceMusic(structurallyValid));
}));
const metadataMutations={
  "erase-actual-repeat":s=>{scope(s).repeatCount=1;},
  "invent-grace-duration":s=>{scope(s).ornaments.graces[0].quantifiedDuration=.25;},
  "pretend-grace-leaves-principal-unchanged":s=>{scope(s).ornaments.graces[0].principalTimingChanged=true;},
  "misread-m2-dotless-grace-octave":s=>{scope(s).ornaments.graces[1].sourceOctave=-1;},
  "copy-m4-grace-into-separate-m20":s=>{scope(s).ornaments.graces.push({...scope(s).ornaments.graces[3],sourceMeasure:20,beforeHead:"m20h03",principalBeat:78});},
  "claim-measured-wave-auxiliary":s=>{scope(s).ornaments.waves[0].auxiliaryNotesSpecified=true;},
  "allow-local-octave-folding":s=>{scope(s).octaveFolding=true;},
  "lose-cross-system-tie-decision":s=>{scope(s).samePitchTies.shift();},
  "forget-one-different-pitch-slur":s=>{scope(s).differentPitchSlurs.pop();},
  "claim-full-decorated-performance":s=>{scope(s).fullOrnamentedPerformanceApproved=true;},
  "invent-named-performer":s=>{scope(s).sourcePerformer="崔开潮";},
  "overwrite-retained-default-speed":s=>{s.defaultSpeedFactor=.55;},
  "hide-printed-tempo":s=>{scope(s).sourceNumericTempoPrinted=false;},
  "add-unreviewed-backing":s=>{s.autoAccompaniment={events:[]};}
};
for(const [name,mutate]of Object.entries(metadataMutations))test(`selected edition policy rejects ${name}`,()=>{
  const changed=structuredClone(song);mutate(changed);assert.throws(()=>assertSelectedPolicy(changed));
});

const evidencePath=process.env.SHENGSHENGMAN_SOURCE_EVIDENCE_PATH;
test("optional immutable reader-B fixture verifies all130 heads,126 written/252 expanded attacks,24 bars,arcs and unmeasured ornaments",{
  skip:evidencePath?false:"Set SHENGSHENGMAN_SOURCE_EVIDENCE_PATH to the actual private source-only-frozen.json; ninth private source gate not performed"
},async()=>{
  const bytes=await readFile(evidencePath);assert.equal(hash(bytes),sourceFixtureHash,"check actual immutable private bytes before trusting expectations");
  const source=JSON.parse(bytes);assert.equal(source.reader,"B");assert.equal(source.source.url,sourceUrl);assert.equal(source.source.sha256,imageHash);
  assert.equal(source.source.pixelSourcesOnly,true);assert.match(source.source.independence,/No existing song data, candidate transcription, other reader or source SVG consulted/);
  assert.equal(source.status.sourceOnly,true);assert.equal(source.status.songDataGenerated,false);assert.equal(source.status.comparisonToOtherReaderPerformed,false);
  assert.equal(source.status.ornamentOmissionAdopted,false,"source reading preceded the selected reduction decision");
  assert.deepEqual([source.source.title,source.source.subtitle,source.source.composer,source.source.lyricist,source.source.engraver],["声声慢","戏腔","刘洋","崔开潮","逸兔"]);
  assert.equal(source.notation.key,"1=E");assert.equal(source.notation.meter,"4/4");assert.equal(source.notation.beatUnit,"quarter");assert.equal(source.notation.tempo,72);
  assert.equal(source.notation.pickup,false);assert.equal(source.notation.fermata,false);assert.deepEqual(source.notation.principalRests,[]);assert.deepEqual(source.notation.tuplets,[]);
  assert.equal(source.form.beginRepeat,"before m1");assert.equal(source.form.endRepeat,"after m24");assert.equal(source.form.repeatBoundaryTie,false);
  assert.deepEqual(source.form.route,[{pass:1,bars:[1,24]},{pass:2,bars:[1,24]}]);assert.deepEqual(source.form.firstSecondEndings,[]);
  assert.equal(source.bars.length,24);assert.equal(source.literalWritten.totalBeats,96);assert.equal(source.repeatExpanded.totalBeats,192);assert.equal(source.repeatExpanded.barCount,48);
  assert.deepEqual([source.literalWritten.principalHeadCount,source.literalWritten.principalAttackCount,source.literalWritten.tieJoinCount,source.literalWritten.differentPitchSlurCount,source.literalWritten.graceHeadCount,source.literalWritten.waveOrnamentCount,source.literalWritten.restCount],[130,126,4,9,14,4,0]);
  assert.deepEqual([source.repeatExpanded.principalHeadCount,source.repeatExpanded.principalAttackCount,source.repeatExpanded.tieJoinCount,source.repeatExpanded.differentPitchSlurCount,source.repeatExpanded.graceHeadCount,source.repeatExpanded.waveOrnamentCount,source.repeatExpanded.restCount],[260,252,8,18,28,8,0]);
  assert.equal(source.literalWritten.heads.length,130);assert.equal(source.literalWritten.principalAttacks.length,126);assert.equal(source.repeatExpanded.principalAttacks.length,252);
  assert.equal(hash(JSON.stringify(source.literalWritten.heads.map(h=>[h.id,h.degree,h.octaveDisplacement,h.midi,h.absoluteWrittenBeat,h.duration]))),printedHeadsHash);
  for(const h of source.literalWritten.heads)assert.equal(h.midi,64+[0,2,4,5,7,9,11][h.degree-1]+12*h.octaveDisplacement);
  const sourceMidi=source.repeatExpanded.principalAttacks.map(a=>[a.midi,a.beat,a.duration]);assert.equal(hash(JSON.stringify(sourceMidi)),sourceMidiTupleHash);
  const expected=sourceMidi.map(([m,b,d])=>[noteName(m+8),b,d]);assert.equal(hash(JSON.stringify(expected)),tupleHash);assert.deepEqual(song.steps,expected);
  assert.deepEqual(source.literalWritten.principalAttacks.map(a=>[noteName(a.midi+8),a.absoluteWrittenBeat,a.duration]),expected.slice(0,126));
  const head=id=>source.literalWritten.heads.find(h=>h.id===id),endpoint=id=>{const h=head(id);return[noteName(h.midi+8),h.absoluteWrittenBeat,h.duration];};
  const pairs=values=>values.map(t=>[t.from,t.to,endpoint(t.from),endpoint(t.to)]);
  assert.deepEqual(pairs(source.samePitchTies),tieEndpoints);assert.deepEqual(pairs(source.differentPitchSlurs),slurEndpoints);assert.deepEqual(pairs(source.untiedAdjacentSamePitchHeads),untiedEndpoints);
  assert.deepEqual(source.graceNotes.map(g=>[g.bar,g.before,g.degree,g.octaveDisplacement,g.literalPitch,(g.bar-1)*4+g.principalOnsetInBar]),graceDecisions);
  assert.ok(source.graceNotes.every(g=>g.quantifiedBeatDuration===null&&g.principalTimingChanged===false));
  assert.deepEqual(source.waveOrnaments.map(w=>[w.bar,w.on,w.principalPitch.literalPitch]),waveDecisions);
  assert.ok(source.waveOrnaments.every(w=>w.quantifiedBeatDuration===null&&w.principalTimingChanged===false&&w.literalAuxiliaryPitchHeads.length===0));
  assert.deepEqual(source.pitchAssessment.allPrincipalGlobalFits.map(f=>f.semitones),[1,8,13]);assert.equal(source.pitchAssessment.adoptionDecision,null);
  for(const bar of source.bars){
    const from=(bar.bar-1)*4,tuples=expected.filter(([,b,d])=>b<from+4&&b+d>from).map(t=>offset(t,-from));
    assert.deepEqual([bar.bar,bar.heads.length,bar.principalAttacksStartingHere.length,tuples.length,hash(JSON.stringify(tuples))],barDecisions[bar.bar-1]);
    assert.equal(bar.sumBarBeats,4);assert.equal(bar.principalAttackOccupancyIncludingCrossBarTies,4);
  }
  const evidence={songId:id,source:{reference:sourceUrl,scope:"all24 written principal bars repeated twice; unmeasured graces and waves explicitly omitted without retiming"},sourceTotalBeats:192,pitchFit:{sourcePitchClasses:[1,3,4,6,8,11],semitoneShift:8},melodySpans:Array.from({length:48},(_,i)=>({from:i*4,to:(i+1)*4,attacks:expected.filter(([,b,d])=>b<(i+1)*4&&b+d>i*4)}))};
  const result=checkTranscriptionEvidence(song,evidence);assert.equal(result.reviewedSpans,48);assert.equal(result.checkedAttacks,256,"four expanded cross-bar sustains appear in two overlapping spans");assert.equal(result.checkedSilentWindows,0);
  for(const [name,mutate]of Object.entries(musicalMutations)){
    const changed=structuredClone(song);mutate(changed);
    if(name==="replace-printed72-with-practice90-BPM")assert.throws(()=>assert.equal(changed.bpm,source.notation.tempo));
    else assert.throws(()=>checkTranscriptionEvidence(changed,evidence),name);
  }
});
