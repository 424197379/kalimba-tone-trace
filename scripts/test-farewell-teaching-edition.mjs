import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { analyzeSongTiming } from "./song-report-analysis.mjs";
import { getCustomSongs, getPracticeSongs, getPracticeSongId, getSongArchiveDownload,
  getSongLibrary, getSongAccompanimentProvider, hasMatchingPracticeMelody,
  parseImportedSongs, saveCustomSongs } from "../src/song-store.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { SONG_SPEED_STORAGE_KEY, readSongSpeed } from "../src/practice-preferences.js";
import { checkTranscriptionEvidence, fittingTranspositions } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const song = JSON.parse(await read("data/songs/song-bie.json"));
const archivePath = "data/archives/song-bie-v2.4.28.json";
const archiveBytes = await read(archivePath), archive = JSON.parse(archiveBytes);
const siblingBytes = await read("data/songs/song-bie-chord.json"), sibling = JSON.parse(siblingBytes);
const archiveHash = "31042a1c640d60dbf2cabfd880aa451d6d2f142916c169fa5bc5eabca19c0a26";
const siblingHash = "dd575f1e2db95a54b010d3e9eca6e1f273f58190743fec68e7db55490e61c35c";
const tupleHash = "ad944edad48e74b6a3bfa6c80d47bc5deaf3f72dc079331c4183ee8a26727180";
const sourceFixtureHash = "577988d8890ac8c55ae147a01b231a3f746e3ea3bf7025235979408a8805f316";
const sourceUrl = "https://cxqx.jyc.edu.cn/__local/3/D5/71/B7A1BD225359A39D710C8C3021A_A9C90F62_167DC01.pdf#page=238";
const review = song.sourceFeatures.sourceReview, current = review.currentScopeReview;
const rests = [14,30,46,62,78,94];

// Frozen from the private pre-adoption, staff-authored evidence, independently
// checked against all source pixels before adoption. These absolute-tuple
// fingerprints protect the reviewed decisions without publishing a second full
// source fixture or glyph map. Tests do not themselves read or approve notation.
// Each entry is [source measure, attack count, exact tuple SHA-256].
const barDecisions = [
  [1,4,"bfb6402fcd2b82a4ce7a51254ef78d4f7c1930707c44a4aa695fa2ff3b11222f"],
  [2,3,"32fd85dd424e141145329c55e99e5d299e0870bfb7db0cfa8be28c3b7941cdf9"],
  [3,6,"40841c7f4bf72da129e21998c865be62fb7792b3ba2019e49c78ff2314dd0d7f"],
  [4,1,"382120f590463fb1f845ef14e6e33d1f18aad5a22183851d67614cf9f405c680"],
  [5,5,"04b8f82c2608b48fc5d5c5ad4c71a8b6e64950a03503f3f4d84089172a20a418"],
  [6,3,"5d439a1ecf0d067ce46388cd3e1877780e6946d31d4f72b6626c3cd9e043c45f"],
  [7,5,"0e6156b0c54f6647dfc202992a47d625d55d87b8c6af6e9d6528a4ea12e086f5"],
  [8,1,"1a3f55f22ced37206fac707c154ee0f7d68c8244609a2264f6419572fe3bcb52"],
  [9,3,"316ffd08f7bacebb2207fd3c25d3ecb50b3533e71ccc0bb22f119226c4339b47"],
  [10,4,"dc21281c82df353fb200f62ddafaa0cb85474b7daaffca6c045f0ddb651caf45"],
  [11,8,"eb7e427c1022ffa216699d102eb576ebbdc18423a6001c807fbe393262c59c68"],
  [12,1,"dc1cba5ad61a8ec2c1fa8006c75bd804fbcdb546ffb6b81c8fba82a66e5fa8b4"],
  [13,5,"8f7b9e8e7b3fc2135e6a8db273450d1346bd4b55c153d98cc4cc836cc7fd8dd9"],
  [14,3,"2dbda9e2d6664199a56a4aa18d85ccca2f6ae06811d142fed73355c7a21f7b05"],
  [15,5,"daa86342bbb9dbb58faf9ee8098d39b6c58a5942190b0e4e3a46b4970bd1b43f"],
  [16,1,"3647f8cda2db9b8a203f9e3c7a3393914f16e2041e3dbdb16ab7c3ae3c4af17e"],
  [17,4,"579fd242925432ae3b27d5d3d2d538600dfec1696fca4972497c7ee3ee4b08e3"],
  [18,3,"b4db106f1ce1219f1c532312388597fdab717edbfb5fd77a1d40b82cdf083595"],
  [19,6,"45430065e2ea27314fa0ef999129c3bb982fce48f884e6f32ddf70e9c0714c1d"],
  [20,1,"d7127e088c8dec5e9654a42ca5ae6683108c478b748efb3fa85098a2faecae3c"],
  [21,5,"aa41762c09a6432917ab21d439cdb9c0bb5dc9082fbafe56ba3c1bd804f3cb06"],
  [22,3,"681439247df737690451790e14a4b893909c97379e9dca427bfd5638e34abef9"],
  [23,5,"51a6c7b41b873c56e3eb17c540d7fe5496df95df80b6469c0a7da025ab0fba33"],
  [24,1,"d4f08ccd85c3bf88f7c2195c2750a029537ad1a0fd06e7f160ae413d0daaa2af"]
];
const phrase = (value, from, to) => value.steps.filter(([,beat]) => beat >= from && beat < to);
const eventsFor = steps => steps.map(([name,beat,duration]) => ({beat,duration,notes:[{name,role:"melody",judge:true}]}));
const normalized = value => ({...structuredClone(value),baseSongId:value.id,source:"system",
  arrangementKind:"melody",judgementMode:"melody",events:eventsFor(value.steps)});
const overlap = (beat,duration,start,end) => Math.max(0,Math.min(end,beat+duration)-Math.max(start,beat));
const midi = name => 12*(Number(name.slice(1))+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[name[0]];
function assertSelectedEdition(value) {
  assert.equal(value.steps.length,86);
  assert.equal(hash(JSON.stringify(value.steps)),tupleHash,"all 86 fixed source-decided tuples");
  assert.equal(value.bpm,70,"editorial practice BPM");
  assert.equal(value.defaultSpeedFactor,.9,"historical suggestion, not live speed");
  assert.equal(value.beatsPerMeasure,4);
  assert.equal(value.sourceFeatures.sourceTotalBeats,96);
  assert.equal(value.sourceFeatures.sourceMeasureCount,24);
  const scope = value.sourceFeatures.sourceReview.currentScopeReview;
  assert.deepEqual(scope.reviewedBeatRanges,[[0,96]]);
  assert.deepEqual(scope.silentWindows.map(r=>[r.beat,r.duration]),rests.map(beat=>[beat,2]));
  assert.equal(scope.sourceTempoPrinted,false);
  assert.equal(scope.sourceQuarterBpm,null);
  assert.equal(scope.repeatExpansion,"none-all-24-selected-bars-written-out");
  assert.equal(scope.lyricRowsAuthorizeRepeat,false);
  for(const field of ["autoAccompaniment","practiceAccompaniment"]) assert.equal(value[field],undefined);
  for(const [measure,count,fingerprint] of barDecisions) {
    const start=(measure-1)*4, attacks=phrase(value,start,start+4);
    assert.equal(attacks.length,count,`source m${measure} attack count`);
    assert.equal(hash(JSON.stringify(attacks)),fingerprint,`source m${measure} exact tuples`);
    const sounding=value.steps.reduce((sum,[,beat,duration])=>sum+overlap(beat,duration,start,start+4),0);
    const silence=rests.reduce((sum,beat)=>sum+overlap(beat,2,start,start+4),0);
    assert.equal(sounding+silence,4,`source m${measure} complete 4/4 balance`);
  }
}
function withIsolatedStorage(run) {
  const previous=globalThis.localStorage, values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
  try { return run(values); }
  finally { if(previous===undefined) delete globalThis.localStorage; else globalThis.localStorage=previous; }
}

test("selected teaching edition retains 86 source-decided attacks across all 24 printed 4/4 bars",()=>{
  assertSelectedEdition(song);
  assert.equal(song.id,"song-bie"); assert.equal(song.schemaVersion,1);
  assert.equal(song.title,"《送别》（教学版）");
  assert.equal(song.practiceTitle,`${song.title}练习轨道`); assert.equal(song.scoreTitle,`${song.title}简谱进度`);
  assert.match(song.hint,/中国诗乐二十品.*完整24小节.*86.*96.*降E调.*C调.*六处两拍休止/);
  assert.match(song.hint,/70 BPM为练习设定/); assert.doesNotMatch(song.hint,/旧版|还原|更容易|原唱全曲/);
  assert.equal(current.distinctPrintedMelodyMeasures,24);
  assert.deepEqual(current.sourceMeasureRange,[1,24]);
  assert.deepEqual(current.selectedRoute,[{sourceMeasures:[1,24],beats:[0,96],attacks:86}]);
  assert.deepEqual(current.excludedSections,[]);
  assert.deepEqual(barDecisions.map(([m])=>m),Array.from({length:24},(_,i)=>i+1));
  assert.equal(phrase(song,0,64).length,58); assert.equal(phrase(song,64,96).length,28);
});

test("different-pitch slurs, true reattacks and every separately printed register occurrence survive",()=>{
  assert.deepEqual(current.ties,[]); assert.equal(current.tieContinuationCount,0); assert.deepEqual(current.tuplets,[]);
  assert.deepEqual(phrase(song,32,36),[["A4",32,1],["C5",33,1],["C5",34,2]]);
  assert.deepEqual(phrase(song,41.5,42.5),[["A4",41.5,.5],["A4",42,.5]]);
  assert.equal(phrase(song,40,44).length,8); assert.ok(phrase(song,40,44).every(([,,d])=>d===.5));
  for(const start of [8,72]) assert.deepEqual(phrase(song,start,start+6),[
    ["G4",start,1],["C4",start+1,.5],["D4",start+1.5,.5],
    ["E4",start+2,1],["D4",start+3,.5],["C4",start+3.5,.5],["D4",start+4,2]
  ]);
  for(const start of [24,56,88]) assert.deepEqual(phrase(song,start,start+6),[
    ["G4",start,1],["D4",start+1,.5],["E4",start+1.5,.5],
    ["F4",start+2,1.5],["B3",start+3.5,.5],["C4",start+4,2]
  ]);
  for(const beat of [18,50,82]) assert.deepEqual(song.steps.find(([,b])=>b===beat),["C5",beat,1.5]);
  assert.equal(song.sourceFeatures.hasRepeats,false); assert.equal(current.repeatSignsPresent,false);
  assert.match(current.formDecision,/Alternate lyric rows do not authorize another traversal/);
  assert.deepEqual(song.steps.reduce((counts,[,,d])=>(counts[d]=(counts[d]||0)+1,counts),{}),{"0.5":40,"1":25,"1.5":6,"2":15});
});

test("all six two-beat rests, including the final [94,96), stay silent in this single-voice edition",()=>{
  const analysis=analyzeSongTiming(song);
  assert.deepEqual(analysis.melodyGaps.map(({beat,duration})=>[beat,duration]),rests.map(b=>[b,2]));
  assert.equal(analysis.claims.allLayerSilent.length,6); assert.equal(analysis.claims.melodyOnly.length,0);
  assert.ok(analysis.melodyGaps.every(({declarations})=>declarations.length===1&&declarations[0].meaning==="declared-all-layer-silence"));
  assert.deepEqual(analysis.unannotatedLongGaps,[]); assert.deepEqual(analysis.issues,[]);
  assert.equal(current.allLayerSilenceClaim,true); assert.equal(current.melodyOnlyRestWindows,undefined);
  assert.equal(current.endingRestBeats,2); assert.equal(current.pickupBeats,0); assert.equal(current.initialMelodyRestBeats,0);
  for(const beat of rests) assert.ok(song.steps.every(([,b,d])=>b>=beat+2||b+d<=beat));
  assert.equal(song.steps.reduce((sum,[,,d])=>sum+d,0),84);
  assert.deepEqual(song.steps.at(-1),["C4",92,2]);
  assert.equal(getPracticeTotalBeats(eventsFor(song.steps),song),96);
  assert.equal(current.selectedEndIsSelectedEditionEnding,true); assert.equal(current.selectedEndIsFullSongEnding,false);
  for(const field of ["events","rhythm","autoAccompaniment","practiceAccompaniment"]) assert.equal(song[field],undefined);
});

test("one global Eb-to-C transposition fits B3–C5 without naturalization or octave folding",()=>{
  const keys=new Set(DISPLAY_KEYS.map(k=>k.name)); for(const[n]of song.steps) assert.ok(keys.has(n));
  assert.deepEqual([...new Set(song.steps.map(([n])=>midi(n)%12))].sort((a,b)=>a-b),[0,2,4,5,7,9,11]);
  assert.deepEqual(current.sourcePitchClasses,[0,2,3,5,7,8,10]);
  assert.deepEqual(fittingTranspositions(current.sourcePitchClasses),[9]);
  assert.equal(current.transpositionSemitones,-3); assert.equal(current.globalOctaveShift,0);
  assert.equal(current.octaveFolding,false); assert.deepEqual(current.localPitchAlterations,[]);
  assert.deepEqual(current.sourceKeySignatureAccidentals,["Bb","Eb","Ab"]); assert.deepEqual(current.additionalMelodyAccidentals,[]);
  assert.deepEqual([Math.min(...song.steps.map(([n])=>midi(n))),Math.max(...song.steps.map(([n])=>midi(n)))],[59,72]);
  assert.deepEqual(current.sourceRange,["D4","Eb5"]); assert.deepEqual(current.compiledRange,["B3","C5"]);
  assert.equal(song.key,"C"); assert.equal(song.tuning,"21-key-c");
  const positions=new Map(DISPLAY_KEYS.map(({name},i)=>[name,i])),side=n=>Math.sign(positions.get(n)-10);
  assert.equal(Math.max(...song.steps.slice(1).map(([n],i)=>Math.abs(midi(n)-midi(song.steps[i][0])))),9);
  assert.equal(Math.max(...song.steps.slice(1).map(([n],i)=>Math.abs(positions.get(n)-positions.get(song.steps[i][0])))),11);
  assert.equal(song.steps.slice(1).filter(([n,b],i)=>b-song.steps[i][1]===.5&&side(n)===side(song.steps[i][0])).length,9);
  assert.equal(Math.min(...song.steps.slice(1).map(([,b],i)=>b-song.steps[i][1])),.5);
  assert.ok(Math.abs(.5*60000/song.bpm-428.57142857142856)<1e-9);
  assert.ok(Math.abs(.5*60000/(song.bpm*song.defaultSpeedFactor)-476.1904761904762)<1e-9);
  assert.equal(song.bpm,archive.bpm); assert.equal(song.defaultSpeedFactor,archive.defaultSpeedFactor);
  assert.equal(song.difficulty,"easy"); assert.equal(song.sourceFeatures.suitability.status,"conditional");
  assert.match(current.difficultyDecision,/editorial conditional practice suggestion/);
});

test("current source claims preserve edition boundaries, historical uncertainty and separate acceptance gates",()=>{
  assert.equal(current.status,"reviewed-selected-complete-teaching-edition"); assert.equal(current.adoptedInVersion,"2.4.29");
  assert.equal(current.sourceUrl,sourceUrl); assert.equal(current.printedPage,222); assert.equal(current.pdfPage,238);
  assert.equal(current.sourcePdfSha256,"ca4f41c909d255dfa1817d3988ccb404fc2ed39a96c3682b8814810a29c64e6c");
  assert.equal(current.sourceVoice,"explicit-lyric-aligned-monophonic-staff-and-numbered-line");
  assert.equal(current.sourceKey,"Eb"); assert.equal(current.sourceMeter,"4/4"); assert.equal(current.beatUnit,"quarter-note");
  assert.match(current.tempoDecision,/70 BPM is an editorial practice choice/);
  assert.equal(current.oldEditionReverified,false); assert.equal(current.historicalSourceImageIdentityVerified,false);
  assert.equal(current.independentSourcesVerified,false);
  assert.match(current.versionDecision,/not proof that the old 58-attack \/ 64-beat edition is wrong/);
  assert.deepEqual(review.historicalSourceFeatures,archive.sourceFeatures);
  assert.equal(review.historicalSourceFeatures.sourceReview.currentScopeReview.status,"reviewed-cadence-only-rest-needs-review");
  assert.equal(current.publicDistributionRights,"unestablished-private-preview-only");
  assert.equal(current.referenceListening,"not-performed"); assert.equal(current.browserAudio,"not-performed-at-data-adoption");
  assert.equal(current.physicalKalimba,"not-performed");
});

test("historical 58-attack archive preserves its entire exact byte stream without adding a card, route or restore UI",async()=>{
  assert.equal(hash(archiveBytes),archiveHash,"full byte hash includes every old root field, metadata and whitespace");
  assert.equal(archive.id,song.id); assert.equal(archive.steps.length,58);
  assert.equal(hash(JSON.stringify(archive.steps)),"5251bb3c04b59b259ad29bd1206e7549f16a1035c6e9674e76d47bb3422b46cf");
  assert.equal(archive.title,"《送别》"); assert.equal(archive.bpm,70); assert.equal(archive.beatsPerMeasure,4); assert.equal(archive.defaultSpeedFactor,.9);
  assert.deepEqual(archive.steps.at(-1),["C5",60,4]);
  assert.equal(review.archivedEdition.file,archivePath); assert.equal(review.archivedEdition.fileSha256,archiveHash);
  assert.equal(current.archiveImportPath,undefined); assert.equal(getSongArchiveDownload(song),null);
  const files=await readSongFiles(); assert.equal(files.length,57);
  assert.equal(files.filter(({song:s})=>s.schemaVersion===1).length,36);
  assert.equal(files.filter(({song:s})=>s.schemaVersion===2).length,21);
  assert.equal(files.filter(({song:s})=>s.id===song.id).length,1);
  assert.ok(files.every(({fileName})=>fileName!=="song-bie-v2.4.28.json"));
  for(const file of ["service-worker.js","serve-kalimba.js","src/app.js","src/song-library.js"])
    assert.ok(!(await read(file)).toString().includes("song-bie-v2.4.28.json"),`${file} must not expose or precache archive`);
});

test("real importer and storage recover every old JSON value independently without replacing the reviewed built-in",()=>{
  withIsolatedStorage(values=>{
    const speedBytes=JSON.stringify({schemaVersion:1,songs:{"song-bie":{speed:.65}}});
    values.set(SONG_SPEED_STORAGE_KEY,speedBytes);
    const library=getSongLibrary(); library[song.id]=normalized(song);
    const before=JSON.stringify(library), previousIds=getPracticeSongs(library).map(s=>s.id).sort();
    assert.equal(Object.keys(library).length,57); assert.equal(previousIds.length,36);
    const imported=parseImportedSongs(archiveBytes.toString(),library); assert.equal(imported.length,1);
    const restored=imported[0]; assert.deepEqual(restored.steps,archive.steps);
    assert.deepEqual(restored.sourceFeatures,archive.sourceFeatures); assert.equal(restored.schemaVersion,2);
    assert.equal(restored.source,"local"); assert.notEqual(restored.id,song.id); assert.notEqual(restored.baseSongId,song.id);
    assert.equal(restored.bpm,70); assert.equal(restored.beatsPerMeasure,4); assert.equal(restored.defaultSpeedFactor,.9);
    assert.equal(getPracticeTotalBeats(restored.events,restored),64);
    saveCustomSongs([restored]); const [saved]=getCustomSongs();
    assert.deepEqual(saved.steps,archive.steps); assert.deepEqual(saved.sourceFeatures,archive.sourceFeatures);
    const normalizedFields=new Set(["schemaVersion","id","uploader","practiceTitle","scoreTitle"]);
    const reconstructed=Object.fromEntries(Object.keys(archive).map(key=>[key,normalizedFields.has(key)?archive[key]:saved[key]]));
    assert.deepEqual(reconstructed,archive,"every old JSON value survives after reversing only documented identity/schema/display normalization");
    assert.equal(JSON.stringify(library),before); assert.equal(library[song.id].steps.length,86);
    assert.deepEqual(getPracticeSongs(library).map(s=>s.id).sort(),previousIds);
    const merged={...library,[restored.id]:restored}; assert.equal(getPracticeSongs(merged).length,37);
    assert.equal(getPracticeSongId(merged,restored.id),restored.id);
    const [again]=parseImportedSongs(archiveBytes.toString(),merged); assert.notEqual(again.id,restored.id); assert.deepEqual(again.steps,archive.steps);
    const [selected]=parseImportedSongs(JSON.stringify(song),merged); assertSelectedEdition(selected);
    assert.deepEqual(selected.events.map(e=>[e.notes[0].name,e.beat,e.duration]),song.steps);
    assert.ok(selected.events.every(e=>e.notes.length===1&&e.notes[0].role==="melody"&&e.notes[0].judge===true));
    assert.equal(getPracticeTotalBeats(selected.events,selected),96);
    assert.equal(values.get(SONG_SPEED_STORAGE_KEY),speedBytes); assert.deepEqual(readSongSpeed(globalThis.localStorage,song.id),{speed:.65});
  });
});

test("byte-frozen old V2 cannot supply either backing layer to the selected teaching edition",()=>{
  assert.equal(hash(siblingBytes),siblingHash); assert.equal(sibling.schemaVersion,2);
  assert.equal(hasMatchingPracticeMelody(song,sibling),false);
  assert.equal(hasMatchingPracticeMelody(song,archive),false);
  assert.equal(getSongAccompanimentProvider(normalized(song),[sibling]),null);
  assert.equal(getSongAccompanimentProvider(normalized(song),[sibling],true),null);
});

const mutations={
  "old-high-register-first-phrase":s=>{s.steps.find(([,b])=>b===9)[0]="C5";},
  "copy-old-high-register-final-return":s=>{s.steps.find(([,b])=>b===73)[0]="C5";},
  "lose-lower-dot-in-middle-cadence":s=>{s.steps.find(([,b])=>b===59.5)[0]="B4";},
  "fold-final-return-octave":s=>{s.steps.find(([,b])=>b===91.5)[0]="B4";},
  "invent-m9-tonic-tie":s=>{const i=s.steps.findIndex(([,b])=>b===33);s.steps.splice(i,2,["C5",33,3]);},
  "invent-m11-degree-six-tie":s=>{const i=s.steps.findIndex(([,b])=>b===41.5);s.steps.splice(i,2,["A4",41.5,1]);},
  "erase-dotted-quarter-rhythm":s=>{s.steps.find(([,b])=>b===18)[2]=1;s.steps.find(([,b])=>b===19.5)[1]=19;},
  "retain-only-old-16-bar-form":s=>{s.steps=s.steps.filter(([,b])=>b<64);s.sourceFeatures.sourceTotalBeats=64;},
  "invent-lyric-row-repeat":s=>{s.steps.push(...s.steps.map(([n,b,d])=>[n,b+96,d]));s.sourceFeatures.sourceTotalBeats=192;},
  "stretch-final-tonic-through-rest":s=>{s.steps.at(-1)[2]=4;},
  "insert-final-rest-attack":s=>{s.steps.push(["C4",94,2]);},
  "truncate-final-rest":s=>{s.sourceFeatures.sourceTotalBeats=94;},
  "erase-rest-declaration":s=>{s.sourceFeatures.sourceReview.currentScopeReview.silentWindows.pop();},
  "invent-printed-tempo":s=>{s.sourceFeatures.sourceReview.currentScopeReview.sourceQuarterBpm=70;},
  "replace-editorial-tempo":s=>{s.bpm=84;},
  "overwrite-speed-suggestion":s=>{s.defaultSpeedFactor=.55;},
  "borrow-unapproved-backing":s=>{s.autoAccompaniment={events:[{beat:94,duration:2,notes:["C4"]}]};}
};
for(const [name,mutate] of Object.entries(mutations)) test(`source-decision locks reject ${name}`,()=>{
  const changed=structuredClone(song); mutate(changed); assert.throws(()=>assertSelectedEdition(changed));
});

// Explicit optional private fixture, not a silently generated expectation.
// Keep its candidate id and bytes intact. Only the checked song's identity is
// aliased in memory to that reviewed candidate; all melody/metadata stay real.
const sourceEvidencePath=process.env.FAREWELL_SOURCE_EVIDENCE_PATH;
test("explicit private source-authored fixture matches all 86 attacks in 24 spans",{skip:!sourceEvidencePath},async()=>{
  const bytes=await readFile(sourceEvidencePath); assert.equal(hash(bytes),sourceFixtureHash);
  const evidence=JSON.parse(bytes); assert.equal(evidence.songId,"song-bie-teaching-candidate");
  assert.equal(evidence.source.reference,sourceUrl);
  assert.equal(evidence.melodySpans.length,24); assert.equal(evidence.sourceTotalBeats,96);
  assert.deepEqual(evidence.melodySpans.map(s=>[s.sourceMeasure,s.from,s.to]),Array.from({length:24},(_,i)=>[i+1,i*4,(i+1)*4]));
  assert.equal(hash(JSON.stringify(evidence.melodySpans.flatMap(s=>s.attacks))),tupleHash);
  assert.deepEqual(evidence.silentWindows.map(r=>[r.beat,r.duration]),rests.map(b=>[b,2]));
  assert.deepEqual(evidence.pitchFit,{sourcePitchClasses:[0,2,3,5,7,8,10],semitoneShift:-3});
  const result=checkTranscriptionEvidence({...song,id:evidence.songId},evidence); assert.equal(result.checkedAttacks,86);
  for(const [name,mutate] of Object.entries(mutations)) {
    const changed=structuredClone(song); mutate(changed);
    assert.throws(()=>{checkTranscriptionEvidence({...changed,id:evidence.songId},evidence);assertSelectedEdition(changed);},name);
  }
});
