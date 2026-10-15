import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { NOTE_INDEX } from "../src/songs.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { getPracticeSongs, getPracticeSongId, getSongBaseId, getSongVersionRank,
  getSongArchiveDownload, getSongAccompanimentProvider, hasMatchingPracticeMelody, parseImportedSongs } from "../src/song-store.js";
import { readSongAccompaniment, saveSongAccompaniment } from "../src/practice-preferences.js";

const read = file => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
const plain = value => JSON.parse(JSON.stringify(value));
const melodyBytes = await read("data/songs/qing-hua-ci.json");
const melody = JSON.parse(melodyBytes);
const song = JSON.parse(await read("data/songs/qing-hua-ci-reviewed-support.json"));
const archiveBytes = await read("data/archives/qing-hua-ci-v2.4.19.json");
const archive = JSON.parse(archiveBytes);
const review = song.sourceFeatures.practiceAccompaniment;
const melodyHash = "fffdfef74853e1f23ed27be6fa95609750c2f0ed10f7496f5aa6cb274912fa54";
const blockHash = "3d146c15f97b3a61c89153caabb8018ab862ad1eaf3f148ada314248ae0d4a69";
const overlap = (a,b) => a.beat < b.beat + b.duration && a.beat + a.duration > b.beat;
const midi = name => 12 * (Number(name.slice(1)) + 1) + ({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[name[0]]);
const melodyTuples = entry => entry.events.map(e => [e.notes.find(n => n.role === "melody").name,e.beat,e.duration]);

// Independent, bounded source-review decisions. The chord labels are analytical,
// not printed; later occurrences were read separately. This is not reconstructed
// from the production support, and full copied lower-score files stay private.
const chordVoicings = { F:["F2","A2","C3"], G:["G2","B2","D3"], Em:["E3","G3","B3"],
  Am:["A2","C3","E3"], Dm:["D3","F3","A3"], C:["C3","E3","G3"] };
const sourceRoots = [
  [26,4,"F2","F"], [27,8,"G2","G"], [28,12,"E3","Em"], [29,16,"A2","Am"],
  [30,20,"D3","Dm"], [31,24,"G2","G"], [32,28,"C3","C"], [33,32,"C3","C"],
  [34,36,"F2","F"], [35,40,"G2","G"], [36,44,"E3","Em"], [37,48,"A2","Am"],
  [38,52,"D3","Dm"], [39,56,"G2","G"], [40,60,"C3","C"]
];
const expectedSupport = [
  ["F3",4,2], ["G3",8,2], ["E4",12,2], ["A3",16,2], ["D4",20,2],
  ["G3",24,2], ["C4",28,2], ["C4",32,2], ["F3",36,2], ["G3",40,2],
  ["E4",44,2], ["A3",48,2], ["D4",52,2], ["G3",56,2], ["C4",60,.5]
];
const expectedRestPairs = [[0,2.5],[10,.5],[18,.5],[26,.5],[34,.5],[42,.5],[50,.5],[57,.5]];
const expectedPolicies = expectedRestPairs.map(([beat,duration]) => ({beat,duration,policy:beat===57?"hold":"silent"}));
const silentReductionBeats = [10,18,26,34,42,50];
const omittedSecondBeats = [6,10,14,18,22,26,30,34,38,42,46,50,54,58];
// Same independently recorded upper-staff fixture as the preceding melody review.
// These exact 83 attacks include every distinct later bar and all three ties.
const expectedMelody = [
  ["G5",2.5,.5],["G5",3,.5],["E5",3.5,.5],
  ["D5",4,.5],["E5",4.5,.5],["A4",5,1],["D5",6,.5],["E5",6.5,.5],["G5",7,.5],["E5",7.5,.5],
  ["D5",8,2],["G5",10.5,.5],["G5",11,.5],["E5",11.5,.5],
  ["D5",12,.5],["E5",12.5,.5],["G4",13,1],["D5",14,.5],["E5",14.5,.5],["G5",15,.5],["D5",15.5,.5],
  ["C5",16,2],["C5",18.5,.5],["D5",19,.5],["E5",19.5,.5],
  ["G5",20,.5],["A5",20.5,.5],["G5",21,.5],["E5",21.5,.5],["G5",22,.5],["E5",22.5,.5],["E5",23,.5],["D5",23.5,.5],
  ["D5",24,2],["C5",26.5,.5],["D5",27,.5],["C5",27.5,.5],
  ["D5",28,1],["C5",29,.5],["D5",29.5,1],["E5",30.5,1],["G5",31.5,.5],
  ["G5",32,.5],["E5",32.5,1.5],["G5",34.5,.5],["G5",35,.5],["E5",35.5,.5],
  ["D5",36,.5],["E5",36.5,.5],["A4",37,1],["D5",38,.5],["E5",38.5,.5],["G5",39,.5],["E5",39.5,.5],
  ["D5",40,2],["G5",42.5,.5],["G5",43,.5],["E5",43.5,.5],
  ["D5",44,.5],["E5",44.5,.5],["G4",45,1],["D5",46,.5],["E5",46.5,.5],["G5",47,.5],["D5",47.5,.5],
  ["C5",48,2],["C5",50.5,.5],["D5",51,.5],["E5",51.5,.5],
  ["G5",52,.5],["A5",52.5,.5],["G5",53,.5],["E5",53.5,.5],["G5",54,.5],["E5",54.5,.5],["E5",55,.5],["D5",55.5,.5],
  ["D5",56,1],["G4",57.5,.5],["E5",58,1],["D5",59,.5],["D5",59.5,1],["C5",60.5,3.5]
];
const gaps = steps => {
  const result=[]; let end=0;
  for (const [,beat,duration] of steps) { if(beat>end) result.push([end,beat-end]); end=Math.max(end,beat+duration); }
  if(end<64) result.push([end,64-end]);
  return result;
};
function checkSourceSpan(event) {
  const source=sourceRoots.find(([,beat])=>beat===event.beat);
  assert.ok(source,"must retain a real sounding-bar downbeat");
  const [measure,beat,root]=source;
  assert.equal(event.notes.length,1,"root only");
  assert.equal(midi(event.notes[0].name)-midi(root),12,"all roots use the same +12 shift");
  assert.equal(event.beat,beat);
  assert.equal(event.duration,measure===40?.5:2,"retain exact source duration, including final eighth");
}
function checkCandidate(block) {
  assert.equal(block.enabledByDefault,false); assert.equal(block.volume,.30);
  let previousEnd=0;
  for(const event of block.events) {
    assert.equal(event.pattern,"source-downbeat-root-octave-candidate");
    assert.ok(event.beat>=previousEnd,"support events never overlap");
    assert.ok(event.beat+event.duration<=64);
    previousEnd=event.beat+event.duration;
    checkSourceSpan(event);
    const note=event.notes[0];
    assert.ok(NOTE_INDEX.has(note.name),"sample-set pitch");
    assert.equal(note.role,"bass"); assert.equal(note.velocity,.32);
    assert.equal(Object.hasOwn(note,"judge"),false,"no additional physical target");
    for(const [name,beat,duration] of expectedMelody.filter(([,beat,duration])=>overlap(event,{beat,duration}))) {
      assert.ok(midi(note.name)<midi(name),"root below every overlapping melody span");
      assert.ok(!(note.name===name&&event.beat===beat),"no same-onset duplication");
    }
    assert.ok(!overlap(event,{beat:0,duration:4}),"keep complete lower-source opening rest");
    for(const {beat,duration,policy} of expectedPolicies) {
      if(policy==="silent") assert.ok(!overlap(event,{beat,duration}),"no fill even in half-beat rests");
      else if(overlap(event,{beat,duration})) assert.deepEqual([note.name,event.beat,event.duration],["G3",56,2]);
    }
  }
  assert.deepEqual(block.events.map(e=>[e.notes[0].name,e.beat,e.duration]),expectedSupport);
}
function checkRestEvidence(entry) {
  const rests=entry.sourceFeatures.practiceAccompaniment.restAndEnding;
  assert.deepEqual(entry.rhythm.restWindows.map(({beat,duration,policy})=>({beat,duration,policy})),expectedPolicies,"only exact evidenced window may hold");
  assert.deepEqual(gaps(melodyTuples(entry)),expectedRestPairs);
  assert.deepEqual(rests.sourceLowerRestWindows,[{beat:0,duration:4}]);
  assert.deepEqual(rests.allLayerSilentWindows,[{beat:0,duration:2.5}],"all-layer silence ends when upper voice starts");
  assert.deepEqual(rests.silentReductionRestBeats,silentReductionBeats);
  assert.deepEqual(rests.retainedHold.sourceChord,["G2","B2","D3"]);
  assert.deepEqual(rests.retainedHold.sourceSpan,{beat:56,duration:2});
  assert.deepEqual(rests.retainedHold.retainedTuple,["G3",56,2]);
  assert.deepEqual([rests.retainedHold.beat,rests.retainedHold.duration,rests.retainedHold.sourceMeasure],[57,.5,39]);
  const sounding=entry.practiceAccompaniment.events.filter(e=>overlap(e,{beat:57,duration:.5}));
  assert.deepEqual(sounding.map(e=>[e.notes[0].name,e.beat,e.duration]),[["G3",56,2]]);
  assert.ok(sounding.every(e=>e.beat<57),"a held preexisting attack, never a rest fill");
}

const rawSongs=(await readSongFiles()).map(({song:entry})=>entry);
const storeText=await read("src/song-store.js");
function normalizedLibrary(entries) {
  const context={NOTE_INDEX,SONG_LIBRARY:Object.fromEntries(entries.map(s=>[s.id,s])),console,
    localStorage:{getItem:()=>null,setItem(){throw new Error("no browser persistence");}}};
  runInNewContext(storeText.replace(/^import[^\n]+\n/,"").replace(/^export /gm,""),context);
  return context.getSongLibrary();
}
const library=normalizedLibrary(rawSongs);
const appText=await read("src/app.js");
function appContext() {
  const context={songLibrary:library,getSongBaseId,getSongVersionRank,getSongAccompanimentProvider, hasMatchingPracticeMelody,NOTE_INDEX,getPracticeTotalBeats};
  for(const name of ["getSongVariants","buildSongEvents","getPracticeAccompanimentSource","getPracticeAccompanimentConfig",
    "getAccompanimentConfig","getDefaultAccompanimentEnabled","getSongAccompanimentSignature"]) {
    const body=appText.match(new RegExp(`^    function ${name}\\([^]*?^    }`,"m"))?.[0];
    assert.ok(body,`actual app helper ${name}`);runInNewContext(body,context);
  }
  return context;
}
const validatorUrl=new URL("./validate-songs.mjs",import.meta.url);
const validatorContext={DISPLAY_KEYS,URL};
runInNewContext((await readFile(validatorUrl,"utf8")).replace(/^import .*;\n/gm,"")
  .replaceAll("import.meta.url",JSON.stringify(validatorUrl.href)).replace(/await main\(\);\s*$/,""),validatorContext);
const validate=entry=>{
  const errors=[],warnings=[];
  validatorContext.validateSongFile({song:entry,fileName:`${entry.id}.json`,filePath:"fixture",idFromFile:entry.id,duplicateIdCount:1},errors,warnings,new Map());
  return {errors,warnings};
};
const externalRepresentation=()=>{
  const upload=structuredClone(song);delete upload.practiceAccompaniment;upload.autoAccompaniment=structuredClone(song.practiceAccompaniment);return upload;
};

test("the prior 55-song and three-archive snapshot remains byte-exactly recoverable",async()=>{
  assert.equal(hash(melodyBytes),"1c7162c13e5d4e843016dba7f37acaa725a98870a304ce6b649f7269f041e64e");
  assert.equal(hash(archiveBytes),"ae805daffe79f68916a8c88afe0b931b45fd14ec6bc65eb06761c7993e918b21");
  const files=[];
  for(const dir of ["data/songs","data/archives"]) for(const name of (await readdir(new URL(`../${dir}/`,import.meta.url))).filter(x=>x.endsWith(".json")&&x!=="qing-hua-ci-reviewed-support.json"&&x!=="xuan-cao-hua-reviewed-support.json"&&x!=="da-yu-v2.4.21.json"&&x!=="ping-fan-zhi-lu-v2.4.23.json"&&x!=="ju-ci-lang-de-xia-tian-v2.4.25.json"&&x!=="xuan-cao-hua-v2.4.27.json"&&x!=="song-bie-v2.4.28.json"&&x!=="rang-wo-men-dang-qi-shuang-jiang-v2.4.34.json"&&x!=="qing-cheng-shan-xia-bai-su-zhen-v2.4.35.json"&&x!=="hong-yan-v2.4.36.json"&&x!=="tong-nian-v2.4.37.json"&&x!=="sheng-sheng-man-v2.4.40.json").sort()) {
    // Later deliberate Bigfish and Ordinary Road editions preserves the exact former bytes in
    // an internal archive; reconstruct the prior snapshot without weakening it.
    const sourcePath = dir === "data/songs" && name === "da-yu.json"
      ? "data/archives/da-yu-v2.4.21.json"
      : dir === "data/songs" && name === "ping-fan-zhi-lu.json"
        ? "data/archives/ping-fan-zhi-lu-v2.4.23.json"
        : dir === "data/songs" && name === "ju-ci-lang-de-xia-tian.json"
          ? "data/archives/ju-ci-lang-de-xia-tian-v2.4.25.json"
          : dir === "data/songs" && name === "xuan-cao-hua.json"
            ? "data/archives/xuan-cao-hua-v2.4.27.json"
            : dir === "data/songs" && name === "song-bie.json"
              ? "data/archives/song-bie-v2.4.28.json"
              : dir === "data/songs" && name === "rang-wo-men-dang-qi-shuang-jiang.json"
                ? "data/archives/rang-wo-men-dang-qi-shuang-jiang-v2.4.34.json"
                : dir === "data/songs" && name === "qing-cheng-shan-xia-bai-su-zhen.json"
                  ? "data/archives/qing-cheng-shan-xia-bai-su-zhen-v2.4.35.json"
                  : dir === "data/songs" && name === "hong-yan.json"
                    ? "data/archives/hong-yan-v2.4.36.json"
                    : dir === "data/songs" && name === "tong-nian.json"
                      ? "data/archives/tong-nian-v2.4.37.json"
                      : dir === "data/songs" && name === "sheng-sheng-man.json"
                        ? "data/archives/sheng-sheng-man-v2.4.40.json" : `${dir}/${name}`;
    let historicalBytes = await read(sourcePath);
    if (dir === "data/songs" && name === "interstellar-main-theme.json") {
      const historical = JSON.parse(historicalBytes);
      delete historical.sourceFeatures.meterDisplay;
      delete historical.sourceFeatures.meterDisplayReview;
      historicalBytes = Buffer.from(`${JSON.stringify(historical, null, 2)}\n`);
    }
    // Disclosure-only2.4.43 metadata is not part of this older frozen snapshot.
    if (name === "jue-bie-shu.json") {
      const historical = JSON.parse(historicalBytes);
      delete historical.sourceFeatures.sourceReview.currentScopeReview;
      historicalBytes = Buffer.from(`${JSON.stringify(historical, null, 2)}\n`);
    }
    files.push([`${dir}/${name}`,hash(historicalBytes)]);
  }
  assert.equal(files.length,58);
  assert.equal(hash(JSON.stringify(files)),"771c31c26cd15553b0be4bcef460d45799d82ee2498c36414721df798e8cdaeb");
  for(const field of ["events","practiceAccompaniment","autoAccompaniment","rhythm"]) assert.equal(Object.hasOwn(melody,field),false);
});
test("83 independently recorded melody tuples, three ties, 96 BPM and end64 stay exact",()=>{
  assert.equal(song.schemaVersion,2);assert.equal(song.baseSongId,melody.id);
  assert.equal(song.arrangementKind,"melody");assert.equal(song.judgementMode,"melody");
  assert.equal(expectedMelody.length,83);assert.deepEqual(melody.steps,expectedMelody);assert.deepEqual(melodyTuples(song),expectedMelody);
  assert.equal(hash(JSON.stringify(melodyTuples(song))),melodyHash);
  assert.deepEqual([song.bpm,song.defaultSpeedFactor,song.beatsPerMeasure,song.key,song.tuning,song.difficulty],[96,1,4,"C","21-key-c","hard"]);
  for(const e of song.events) assert.deepEqual(e.notes,[{name:e.notes[0].name,role:"melody",judge:true,velocity:1}]);
  for(const beat of [30,60,62]) assert.equal(song.events.some(e=>e.beat===beat),false,"no tie retrigger");
  assert.deepEqual(melodyTuples(song).at(-1),["C5",60.5,3.5]);assert.equal(song.sourceFeatures.sourceTotalBeats,64);
  assert.equal(getPracticeTotalBeats(song.events,song),64);
});
test("source roots use written root-position triads, not printed symbols or a highest-note guess",()=>{
  assert.equal(review.sourceRootReview.printedChordLabels,false);
  assert.deepEqual(review.sourceRootReview.retainedDownbeats.map(x=>[x.measure,x.beat,x.sourceRoot,x.analyticalChord]),sourceRoots);
  for(const [measure,beat,root,chord] of sourceRoots) {
    assert.equal(beat,(measure-25)*4);
    assert.equal(chordVoicings[chord][0],root);
    const distances=chordVoicings[chord].map(name=>midi(name)-midi(root));
    assert.deepEqual(distances,chord.endsWith("m")?[0,3,7]:[0,4,7]);
    assert.ok(midi(root)<midi("F3"),"every literal retained downbeat root is below range");
  }
  assert.deepEqual(review.sourceRootReview.retainedDownbeats.map(x=>x.basis),[...Array(14).fill("written-root-position-triad"),"first-note-of-written-tonic-arpeggio"]);
});
test("exact 15 roots preserve all sounding-bar downbeats with one uniform +12 transform",()=>{
  checkCandidate(song.practiceAccompaniment);
  assert.equal(hash(JSON.stringify(song.practiceAccompaniment)),blockHash);
  assert.equal(review.evidenceFingerprints.candidateBlockSha256,blockHash);
  assert.equal(song.practiceAccompaniment.events.reduce((sum,e)=>sum+e.duration,0),28.5);
  assert.equal(Object.hasOwn(song,"autoAccompaniment"),false);
  assert.deepEqual(review.reduction.retainedRange,["F3","E4"]);
  assert.equal(review.reduction.semitoneShift,12);assert.equal(review.reduction.melodySemitoneShift,0);
  for(const field of ["octaveFolding","accidentalNaturalization","addedNotes","addedAttacks","completeChordFidelity","literalRegisterPreserved"]) assert.equal(review.reduction[field],false);
});
test("15 retained and 76 deliberately omitted pitch attacks account for the source reduction",()=>{
  assert.equal(review.sourceRootReview.literalLowerEventCount,35);assert.equal(review.sourceRootReview.literalLowerPitchAttacks,91);
  assert.deepEqual(review.sourceRootReview.literalLowerRange,["F2","C5"]);
  assert.deepEqual(review.sourceRootReview.literalLowerAccidentals,[]);assert.equal(review.sourceRootReview.literalLowerTies,0);
  assert.deepEqual([review.reduction.omittedFirstChordTones,review.reduction.omittedSecondChordAttacks,review.reduction.omittedFinalArpeggioAttacks],[28,42,6]);
  assert.equal(15+28+42+6,91);assert.equal(review.reduction.totalOmittedPitchAttacks,76);
  assert.deepEqual(review.reduction.secondChordOmittedBeats,omittedSecondBeats);
  assert.ok(omittedSecondBeats.every(beat=>!song.practiceAccompaniment.events.some(e=>e.beat===beat)));
  assert.deepEqual(song.practiceAccompaniment.events.filter(e=>e.beat===28||e.beat===32).map(e=>[e.notes[0].name,e.beat,e.duration]),[["C4",28,2],["C4",32,2]]);
});
test("source lower rest, six reduction silences and precise m39 lower hold remain distinct",()=>{
  checkRestEvidence(song);
  assert.deepEqual(song.rhythm.restWindows.filter(w=>w.policy==="hold").map(({beat,duration})=>[beat,duration]),[[57,.5]]);
  assert.ok(song.rhythm.restWindows.every(w=>typeof w.reason==="string"&&w.reason.length>40));
  assert.equal(song.practiceAccompaniment.events.some(e=>overlap(e,{beat:0,duration:4})),false);
  assert.equal(song.events.some(e=>overlap(e,{beat:2.5,duration:1.5})),true,"m25 is not four all-layer silent beats");
});
test("final root is one source eighth and remaining 3.5 beats are omission, never an ending rest",()=>{
  assert.deepEqual(song.practiceAccompaniment.events.slice(-2).map(e=>[e.notes[0].name,e.beat,e.duration]),[["G3",56,2],["C4",60,.5]]);
  assert.deepEqual(review.restAndEnding.finalReductionOmission,{beat:60.5,duration:3.5,sourceSilent:false,omittedSequentialAttacks:6});
  assert.equal(review.restAndEnding.supportWrittenEnd,60.5);assert.equal(review.restAndEnding.scoreEnd,64);assert.equal(review.restAndEnding.endingRestBeats,0);
  assert.deepEqual(review.restAndEnding.lastMelodyTuple,["C5",60.5,3.5]);
  assert.equal(song.practiceAccompaniment.events.some(e=>e.beat>60),false);
  assert.equal(song.rhythm.restWindows.some(w=>w.beat>=60),false);
});
test("negative candidates cannot fold, replace, densify, retrigger, truncate holds or stretch endings",()=>{
  const mutations=[b=>b.events[2].notes[0].name="E3",b=>b.events[2].notes[0].name="E5",b=>b.events[2].notes[0].name="F4",
    b=>b.events[2].notes[0].name="F#4",b=>b.events[2].notes.push({name:"G4",role:"harmony",velocity:.32}),
    b=>b.events[0].beat=0,b=>b.events[13].beat=57,b=>b.events[13].duration=1,b=>b.events[13].duration=4,
    b=>b.events.at(-1).duration=2,b=>b.events.at(-1).duration=4.5,b=>b.events.at(-1).beat=60.5,
    b=>b.events.pop(),b=>b.events.splice(7,1),b=>b.events[6].duration=6,
    b=>b.events.splice(2,0,{...structuredClone(b.events[1]),beat:10}),
    b=>b.events.push({...structuredClone(b.events.at(-1)),beat:62})];
  for(const mutate of mutations){const changed=structuredClone(song.practiceAccompaniment);mutate(changed);assert.throws(()=>checkCandidate(changed));}
});
test("negative policies cannot broadly permit holds or reclassify lower activity as all-layer silence",()=>{
  const mutations=[s=>s.rhythm.restWindows.at(-1).policy="silent",s=>s.rhythm.restWindows[1].policy="hold",
    s=>s.rhythm.restWindows.at(-1).duration=1,s=>s.rhythm.restWindows.pop(),
    s=>s.sourceFeatures.practiceAccompaniment.restAndEnding.allLayerSilentWindows[0].duration=4,
    s=>s.sourceFeatures.practiceAccompaniment.restAndEnding.allLayerSilentWindows.push({beat:57,duration:.5}),
    s=>s.sourceFeatures.practiceAccompaniment.restAndEnding.retainedHold.sourceChord=["C3","E3","G3"],
    s=>s.practiceAccompaniment.events[13].duration=1,s=>s.practiceAccompaniment.events[13].beat=57];
  for(const mutate of mutations){const changed=structuredClone(song);mutate(changed);assert.throws(()=>checkRestEvidence(changed));}
});
test("quiet opt-in data never becomes judged, louder, or an original parallel layer",()=>{
  for(const mutate of [b=>b.enabledByDefault=true,b=>b.volume=.4,b=>b.events[0].notes[0].velocity=.4,
    b=>b.events[0].notes[0].judge=false,b=>b.events[0].notes[0].judge=true,b=>b.events[0].notes[0].role="melody"]){
    const changed=structuredClone(song.practiceAccompaniment);mutate(changed);assert.throws(()=>checkCandidate(changed));
  }
  assert.equal(review.settings.enabledByDefault,false);assert.equal(review.settings.volume,.3);assert.equal(review.settings.noteVelocity,.32);
  assert.equal(review.historicalSibling.exists,false);assert.equal(review.historicalSibling.automaticAccompanimentAdded,false);
});
test("actual unchanged validator accepts the evidenced hold and rejects silent, multi-attack and late hold overlaps",()=>{
  assert.deepEqual(validate(song).errors,[]);
  const silent=structuredClone(song);silent.rhythm.restWindows.at(-1).policy="silent";
  assert.ok(validate(silent).errors.some(x=>/silent rest window/.test(x)));
  const second=structuredClone(song);second.practiceAccompaniment.events.splice(14,0,{beat:57.25,duration:.25,notes:[{name:"G3",role:"bass",velocity:.32}]});
  assert.ok(validate(second).errors.some(x=>/hold rest window contains 2/.test(x)));
  const late=structuredClone(song);late.practiceAccompaniment.events[13].beat=57.375;late.practiceAccompaniment.events[13].duration=.125;
  assert.ok(validate(late).errors.some(x=>/near the rest start/.test(x)));
  const original=JSON.stringify(song);validate(song);assert.equal(JSON.stringify(song),original,"validator never repairs the candidate");
});
test("content guard accepts exactly this melody and rejects archived or changed timebases",()=>{
  assert.equal(hasMatchingPracticeMelody(melody,song),true);assert.equal(hasMatchingPracticeMelody(melody,archive),false);
  assert.equal(hasMatchingPracticeMelody(melody,{...archive,bpm:96}),false);
  for(const mutate of [s=>s.events[0].notes[0].name="E5",s=>s.events[0].beat=2,s=>s.events[0].duration=1,
    s=>s.events.pop(),s=>s.bpm=94,s=>s.sourceFeatures.sourceTotalBeats=65,s=>s.events[0].notes[0].judge=false,
    s=>s.events[0].notes.push({name:"E5",role:"melody",judge:true})]){
    const changed=structuredClone(song);mutate(changed);assert.equal(hasMatchingPracticeMelody(melody,changed),false);
  }
});
test("actual normalization keeps 57 records, 36 cards, two real ids and no fictitious chord route",()=>{
  assert.equal(Object.keys(library).length,57);assert.equal(getPracticeSongs(library).length,36);
  assert.deepEqual(plain(library[song.id].practiceAccompaniment),song.practiceAccompaniment);
  assert.deepEqual(plain(library[song.id].steps),expectedMelody);
  assert.deepEqual(plain(library[song.id].rhythm),song.rhythm);
  assert.equal(getPracticeSongs(library).filter(s=>getSongBaseId(s)===melody.id).length,1);
  for(const id of [melody.id,song.id]) assert.equal(getPracticeSongId(library,id),melody.id);
  assert.equal(getPracticeSongId(library,"qing-hua-ci-chord"),null);
  assert.deepEqual(getPracticeSongs(normalizedLibrary([song,melody])).map(s=>s.id),[melody.id]);
  assert.deepEqual(getPracticeSongs(normalizedLibrary([melody,song])).map(s=>s.id),[melody.id]);
  const absent=normalizedLibrary(rawSongs.filter(s=>s.id!==song.id));
  assert.equal(Object.keys(absent).length,56);assert.equal(getPracticeSongs(absent).length,36);
});
test("actual app borrows the light candidate with its retained hold and no original auto layer",()=>{
  const app=appContext(),canonical=library[melody.id];
  assert.deepEqual(plain(app.getPracticeAccompanimentConfig(canonical)),song.practiceAccompaniment);
  assert.deepEqual(plain(app.getAccompanimentConfig(canonical,"light")),song.practiceAccompaniment);
  assert.equal(app.getAccompanimentConfig(canonical,"original"),null);assert.equal(app.getDefaultAccompanimentEnabled(canonical),false);
  assert.deepEqual(plain(app.getAccompanimentConfig(canonical,"light").events[13]),song.practiceAccompaniment.events[13]);
});
test("only explicit exact-content saved light settings restore; no browser state is changed",()=>{
  const app=appContext(),signature=app.getSongAccompanimentSignature(library[melody.id]);
  assert.ok(typeof signature==="string"&&signature.length>0);
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature),{});
  assert.deepEqual(saveSongAccompaniment(storage,melody.id,"light",signature),{saved:true,choice:"light"});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature),{choice:"light"});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature+"changed"),{choice:"off",stale:true});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,null),{choice:"off",stale:true});
  assert.deepEqual(saveSongAccompaniment(storage,melody.id,"off",signature),{saved:true,choice:"off"});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature),{choice:"off"});
});
test("raw built-in import clearly rejects the unsupported playback field instead of silently losing 15 roots",()=>{
  assert.throws(()=>parseImportedSongs(JSON.stringify(song),{}),/顶层 practiceAccompaniment.*外部导入不支持.*autoAccompaniment.*不要仅删除字段而丢失伴奏/);
  assert.match(review.importBoundary,/not a lossless external import representation/);
});
test("supported external auto representation preserves all 83 targets, 15 roots and exact source hold",()=>{
  const imported=parseImportedSongs(JSON.stringify(externalRepresentation()),{});
  const importedLibrary=Object.fromEntries(imported.map(s=>[s.id,s]));
  assert.equal(getPracticeSongs(importedLibrary).length,1);
  assert.deepEqual(getPracticeSongs(importedLibrary)[0].steps,expectedMelody);
  const backing=imported.find(s=>s.autoAccompaniment);
  assert.ok(backing);assert.deepEqual(backing.autoAccompaniment,song.practiceAccompaniment);
  assert.deepEqual(backing.rhythm,song.rhythm);assert.equal(hasMatchingPracticeMelody(melody,backing),true);
  assert.equal(backing.autoAccompaniment.events.length,15);
  const silent=externalRepresentation();silent.rhythm.restWindows.at(-1).policy="silent";
  assert.throws(()=>parseImportedSongs(JSON.stringify(silent),{}),/静音.*自动伴奏重叠/);
  const opening=externalRepresentation();opening.autoAccompaniment.events.unshift({beat:0,duration:1,notes:[{name:"C4",role:"bass",velocity:.32}]});
  assert.throws(()=>parseImportedSongs(JSON.stringify(opening),{}),/静音.*自动伴奏重叠/);
});
test("source hashes and disclosure keep source reading separate from sound, full-score and publishing claims",()=>{
  assert.equal(song.rhythm.sourceStatus,"verified");assert.equal(review.status,"needs-review");assert.equal(review.independentlyVerified,false);
  assert.equal(review.sourceVoice,"written-lower-staff-root-reduction-with-uniform-octave-shift");
  assert.deepEqual(review.sourceMeasureRange,[25,40]);assert.deepEqual(review.sourceBeatRange,[96,160]);assert.equal(review.sourceToExcerptBeatOffset,-96);
  assert.equal(review.parallelExportsAreIndependentSources,false);
  assert.deepEqual(review.sourceAssetHashes,{
    "eop-staff2.png":"3156d9269f9a5e61d7eda009ec90897e6e129d70ef1a1a6a2350b05e37682f51",
    "eop-number2.png":"3ebedd2a975d6408fffd11dfe341b1a0f8a847aec50ad6aa4e4b544c96b5b283",
    "eop-number3.png":"01525afd9dafecc8121e9cb5787c463928d463c99a3efbb94c075fc65b08eba4"});
  assert.equal(review.melodyCompatibility.tupleSha256,melodyHash);
  assert.equal(review.melodyCompatibility.fileSha256,hash(melodyBytes));
  assert.equal(review.browserAudio,"not-performed-in-data-stage");assert.equal(review.referenceListening,"not-performed");assert.equal(review.physicalKalimba,"not-performed");
  assert.equal(review.publicDistributionRights,"unestablished-local-preview-only");
  assert.match(review.acousticTailBoundary,/full original PCM/);assert.match(review.acousticTailBoundary,/nonzero/);
  assert.equal(getSongArchiveDownload(song),null);assert.equal(getSongArchiveDownload(melody),null);
  assert.equal(song.sourceFeatures.sourceReview,undefined,"new companion does not rewrite old melody-adoption claims");
});
