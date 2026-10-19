import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { analyzeSongTiming, summarizeArrangement, summarizeRhythm } from "./song-report-analysis.mjs";
import { NOTE_INDEX } from "../src/songs.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { getPracticeSongs, getPracticeSongId, getSongBaseId, getSongVersionRank,
  getSongAccompanimentProvider, getSongPracticeHint, hasMatchingPracticeMelody,
  parseImportedSongs } from "../src/song-store.js";
import { readSongAccompaniment, saveSongAccompaniment,
  SONG_SPEED_STORAGE_KEY, readSongSpeed } from "../src/practice-preferences.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
const plain = value => JSON.parse(JSON.stringify(value));
const melodyBytes = await read("data/songs/xuan-cao-hua.json");
const legacyBytes = await read("data/songs/xuan-cao-hua-chord.json");
const archiveBytes = await read("data/archives/xuan-cao-hua-v2.4.27.json");
const melody = JSON.parse(melodyBytes), legacy = JSON.parse(legacyBytes);
const song = JSON.parse(await read("data/songs/xuan-cao-hua-reviewed-support.json"));
const review = song.sourceFeatures.practiceAccompaniment;
const melodyHash = "cae668aa9911d5ce06d4d3d69dae051ccb270631402a23d9eb72c7472fac22cd";
const supportHash = "7afe06e85a5cfde0cf52bd4c1a7fa2e28b5ac25690128ab8076b0af121b1c8a7";
const rests = [14,17,35,38,47,53,59,71,77,83,110,113,131,134,143,158,161,179,182,191];
// These bounded selections were recorded in the independent source review,
// before integration. Complete score/chord maps and source images stay private.
const selected = [
  [0,17,"C","C4"], [12,21,"Fmaj7","F3"], [24,25,"C","C4"], [36,29,"Fmaj7","F3"],
  [48,33,"Am","A3"], [60,37,"Am","A3"], [72,41,"Am","A3"], [84,45,"Fmaj7","F3"],
  [96,17,"C","C4"], [108,21,"Fmaj7","F3"], [120,25,"C","C4"], [132,29,"Fmaj7","F3"],
  [144,49,"C","C4"], [156,53,"Fmaj7","F3"], [168,57,"C","C4"], [180,61,"Fmaj7","F3"]
];
const chordMembers = { C:["C","E","G"], Fmaj7:["F","A","C","E"], Am:["A","C","E"] };
const expectedSupport = selected.map(([beat,,,name]) => [name,beat,.75]);
const tuples = value => value.events.map(e => [e.notes.find(n => n.role === "melody").name,e.beat,e.duration]);
const overlap = (a,b) => a.beat < b.beat+b.duration && a.beat+a.duration > b.beat;
const midi = name => 12*(Number(name.slice(1))+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[name[0]];

function checkMelody(value) {
  assert.equal(value.schemaVersion,2);
  assert.equal(value.arrangementKind,"melody"); assert.equal(value.judgementMode,"melody");
  assert.equal(value.events.length,183);
  assert.deepEqual(tuples(value),melody.steps);
  assert.equal(hash(JSON.stringify(tuples(value))),melodyHash);
  for (const event of value.events) assert.deepEqual(event.notes,[{name:event.notes[0].name,role:"melody",judge:true,velocity:1}]);
  assert.deepEqual([value.bpm,value.defaultSpeedFactor,value.beatsPerMeasure,value.key,value.tuning],[84,.9,3,"C","21-key-c"]);
  assert.equal(value.sourceFeatures.sourceTotalBeats,192);
  assert.deepEqual(tuples(value).at(-1),["C4",189,2]);
  assert.equal(getPracticeTotalBeats(value.events,value),192);
}
function checkWrittenSourceSpan(event) {
  const anchor=selected.find(([beat]) => beat===event.beat);
  assert.ok(anchor,"reviewed four-bar source anchor required");
  assert.ok(event.duration>0 && event.duration<=3,"full written span must stay in the selected source chord interval");
  assert.ok(chordMembers[anchor[2]].includes(event.notes[0].name.replace(/\d+$/, "")),"whole-span source chord membership");
}
function checkSupport(value) {
  const block=value.practiceAccompaniment;
  assert.equal(block.enabledByDefault,false); assert.equal(block.volume,.28);
  assert.equal(block.events.length,16);
  assert.equal(Object.hasOwn(value,"autoAccompaniment"),false);
  assert.deepEqual(value.rhythm.restWindows.map(({beat,duration,policy})=>[beat,duration,policy]),rests.map(beat=>[beat,1,"silent"]));
  for (const event of block.events) {
    assert.equal(event.pattern,"source-chord-root-sparse-four-bar-anchor");
    assert.equal(event.duration,.75); assert.equal(event.notes.length,1);
    const note=event.notes[0];
    assert.ok(NOTE_INDEX.has(note.name)); assert.equal(note.role,"bass"); assert.equal(note.velocity,.30);
    assert.equal(Object.hasOwn(note,"judge"),false,"app support never acquires a physical target flag");
    checkWrittenSourceSpan(event);
    assert.ok(!value.rhythm.restWindows.some(window=>overlap(event,window)),"no written span enters a vocal rest");
    const active=value.events.filter(m=>overlap(event,m)); assert.ok(active.length>0);
    for (const m of active) assert.ok(midi(note.name)<midi(m.notes[0].name),"below every overlapping melody pitch, never a unison");
  }
  assert.deepEqual(block.events.map(e=>[e.notes[0].name,e.beat,e.duration]),expectedSupport);
  assert.equal(hash(JSON.stringify(block)),supportHash);
}

const rawFiles=await readSongFiles(), rawSongs=rawFiles.map(({song:s})=>s);
const storeText=await read("src/song-store.js"), appText=await read("src/app.js");
function normalizedLibrary(entries=rawSongs) {
  const context={NOTE_INDEX,SONG_LIBRARY:Object.fromEntries(entries.map(s=>[s.id,s])),console,
    localStorage:{getItem:()=>null,setItem(){throw new Error("test must not persist browser state");}}};
  runInNewContext(storeText.replace(/^import[^\n]+\n/,"").replace(/^export /gm,""),context);
  return context.getSongLibrary();
}
const library=normalizedLibrary();
function appContext(entries=rawSongs) {
  const context={songLibrary:normalizedLibrary(entries),getSongBaseId,getSongVersionRank,getSongAccompanimentProvider,
    hasMatchingPracticeMelody,NOTE_INDEX,getPracticeTotalBeats};
  for (const name of ["getSongVariants","buildSongEvents","getPracticeAccompanimentSource","getPracticeAccompanimentConfig",
    "getAccompanimentConfig","getDefaultAccompanimentEnabled","getSongAccompanimentSignature"]) {
    const body=appText.match(new RegExp(`^    function ${name}\\([^]*?^    }`,"m"))?.[0];
    assert.ok(body,`actual app helper ${name}`); runInNewContext(body,context);
  }
  return context;
}
const signatureFor = entries => { const app=appContext(entries); return app.getSongAccompanimentSignature(app.songLibrary[melody.id]); };
const validatorUrl=new URL("./validate-songs.mjs",import.meta.url), validatorContext={DISPLAY_KEYS,URL};
runInNewContext((await readFile(validatorUrl,"utf8")).replace(/^import .*;\n/gm,"")
  .replaceAll("import.meta.url",JSON.stringify(validatorUrl.href)).replace(/await main\(\);\s*$/,""),validatorContext);
function validate(value) {
  const errors=[],warnings=[];
  validatorContext.validateSongFile({song:value,fileName:`${value.id}.json`,filePath:"fixture",idFromFile:value.id,duplicateIdCount:1},errors,warnings,new Map());
  return {errors,warnings};
}
function externalRepresentation() {
  const result=structuredClone(song);
  result.autoAccompaniment=result.practiceAccompaniment; delete result.practiceAccompaniment;
  return result;
}

test("all 56 prior 2.4.31 song JSON payloads stay byte-exact, including historical source/backing",async()=>{
  // Sorted [filename,SHA-256(bytes)] manifest independently computed from the
  // delivered 2.4.31 ZIP, not refreshed from today's production files.
  const rowingArchive=await read("data/archives/rang-wo-men-dang-qi-shuang-jiang-v2.4.34.json");
  const qingchengArchive=await read("data/archives/qing-cheng-shan-xia-bai-su-zhen-v2.4.35.json");
  const hongyanArchive=await read("data/archives/hong-yan-v2.4.36.json");
  const childhoodArchive=await read("data/archives/tong-nian-v2.4.37.json");
  const shengArchive=await read("data/archives/sheng-sheng-man-v2.4.40.json");
  const castleArchive=await read("data/archives/tian-kong-zhi-cheng-v2.4.52.json");
  // Recover only the new disclosure metadata; keep the original whole-file hashes.
  const priorRaw = (fileName, raw) => {
    if (fileName === "tian-kong-zhi-cheng.json") return castleArchive;
    if (fileName !== "jue-bie-shu.json") return raw;
    const historical = JSON.parse(raw);
    delete historical.sourceFeatures.sourceReview.currentScopeReview;
    return Buffer.from(`${JSON.stringify(historical, null, 2)}\n`);
  };
  // The new melody is outside the frozen 2.4.31 payload snapshot.
  assert.equal(rawFiles.length,58);
  const prior=rawFiles.filter(({song:s})=>s.id!==song.id&&s.id!=="fan-fang-xiang-de-zhong").map(({fileName,raw})=>[fileName,hash(fileName==="rang-wo-men-dang-qi-shuang-jiang.json"?rowingArchive:fileName==="qing-cheng-shan-xia-bai-su-zhen.json"?qingchengArchive:fileName==="hong-yan.json"?hongyanArchive:fileName==="tong-nian.json"?childhoodArchive:fileName==="sheng-sheng-man.json"?shengArchive:priorRaw(fileName,raw))])
    .sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  assert.equal(prior.length,56);
  assert.equal(hash(JSON.stringify(prior)),"b367d1fc31c1be4a5e63911ae39fb1e4bc68701a31ddad8ae26a2db23bf918bc");
  assert.equal(hash(melodyBytes),"a8925ffba2e97e579f5fce4be9847c258542fad5ff64920ca986775775c4b4ad");
  assert.equal(hash(legacyBytes),"82f43ef27df396c1af0235750a5ea070dbed7997ab821b956d0a1e829a705b57");
  assert.equal(hash(archiveBytes),"e9cd5a2a7ec4912fb208983a279b4f40f05eb524422c2bf5914e77fc4f1e9798");
  assert.ok(legacy.autoAccompaniment.events.length>0); assert.equal(Object.hasOwn(legacy,"practiceAccompaniment"),false);
  for (const field of ["events","rhythm","autoAccompaniment","practiceAccompaniment"]) assert.equal(Object.hasOwn(melody,field),false);
});
test("companion preserves all 183 single targets, 192-beat extent and editorial practice tempo",()=>{
  checkMelody(song); assert.equal(song.id,"xuan-cao-hua-reviewed-support"); assert.equal(song.baseSongId,melody.id);
  assert.equal(review.candidate,"sparse16-four-bar-chord-root");
  assert.equal(review.sourceSymbolReview.sourceQuarterBpm,null);
  assert.match(review.sourceSymbolReview.tempoDecision,/editorial practice tempo/);
  assert.equal(song.sourceFeatures.tempoStatus,"editorial-practice-choice-no-printed-bpm");
});
test("exact frozen 16-root block has legal, fully source-covered, low, unjudged spans",()=>{
  checkSupport(song); assert.equal(review.evidenceFingerprints.candidateBlockSha256,supportHash);
  assert.deepEqual(review.sourceSymbolReview.selectedIntervals,selected.map(([beat,sourceMeasure,symbol,root])=>({beat,duration:3,sourceMeasure,symbol,members:chordMembers[symbol],root})));
  assert.equal(song.practiceAccompaniment.events.reduce((n,e)=>n+e.duration,0),12);
  assert.deepEqual(review.reduction.retainedRootCounts,{C4:6,F3:7,A3:3});
});
test("all 20 vocal rests and final rest remain written omissions without a source-wide silence claim",()=>{
  const timing=analyzeSongTiming(song), rhythm=summarizeRhythm(song), arrangement=summarizeArrangement(song);
  assert.deepEqual(timing.melodyGaps.map(({beat,duration})=>[beat,duration]),rests.map(beat=>[beat,1]));
  assert.equal(timing.claims.allLayerSilent.length,0);
  assert.deepEqual(timing.unannotatedLongGaps,[]); assert.deepEqual(rhythm.conflicts,[]);
  assert.equal(rhythm.rhythmRestWindows,20); assert.equal(arrangement.practiceEvents,16);
  assert.equal(arrangement.practiceWrittenCoverage,12/192);
  assert.equal(arrangement.multiEvents,0); assert.equal(arrangement.judgeMultiEvents,0);
  assert.equal(review.restAndEnding.allLayerSourceSilenceClaim,false);
  assert.deepEqual(review.restAndEnding.holdExceptions,[]);
  assert.deepEqual(review.restAndEnding.lastSupportTuple,["F3",180,.75]);
  assert.deepEqual(review.restAndEnding.endingVocalRest,[191,192]);
});
test("literal chord summary preserves A7 C-sharp and omissions without pretending a literal bass",()=>{
  const source=review.sourceSymbolReview;
  assert.deepEqual([source.printedVocalBars,source.printedSymbolCount,source.expandedSymbolCount],[48,51,68]);
  assert.deepEqual(source.a7Occurrences,[33,129,177]); assert.deepEqual(source.a7Members,["A","C#","E","G"]);
  assert.deepEqual(source.dm7ToGChanges,[[42,44],[90,92],[138,140],[186,188]]);
  assert.equal(source.slashChordsPrinted,false); assert.equal(source.independentEditions,false);
  assert.equal(review.retainedAttacks+review.omittedPrintedSymbolOnsetsAfterExpansion,68);
  assert.equal(review.sourceVoice,"derived-chord-root-not-literal-scored-bass");
  assert.equal(review.sourceLiteralBassTranscribed,false); assert.equal(review.sourceGuitarAttackCount,"not-transcribed");
  for (const flag of ["accidentalNaturalization","literalBassTranscription","completeChordFidelity","octaveFolding","addedCadenceRootAt189"]) assert.equal(review.reduction[flag],false);
  assert.equal(review.reduction.allA7AttacksOmitted,true);
});

const negativeCandidates={
  "changed melody pitch":s=>s.events[0].notes[0].name="D4",
  "invented opening tie":s=>{s.events[0].duration=3;s.events.splice(1,2);},
  "missing repeat":s=>s.events=s.events.filter(e=>e.beat<96),
  "stretched final C4":s=>s.events.at(-1).duration=3,
  "truncated final rest":s=>s.sourceFeatures.sourceTotalBeats=191,
  "old meter":s=>s.beatsPerMeasure=4,
  "new physical chord target":s=>s.events[0].notes.push({name:"C4",role:"bass",judge:true,velocity:1}),
  "default on":s=>s.practiceAccompaniment.enabledByDefault=true,
  "louder volume":s=>s.practiceAccompaniment.volume=.4,
  "louder velocity":s=>s.practiceAccompaniment.events[0].notes[0].velocity=.5,
  "judge false on backing":s=>s.practiceAccompaniment.events[0].notes[0].judge=false,
  "backing melody role":s=>s.practiceAccompaniment.events[0].notes[0].role="melody",
  "added chord tone":s=>s.practiceAccompaniment.events[0].notes.push({name:"E4",role:"harmony",velocity:.3}),
  "rest onset fill":s=>s.practiceAccompaniment.events[1].beat=14,
  "written span crossing rest":s=>s.practiceAccompaniment.events[1].duration=3,
  "unsupported hold label":s=>s.rhythm.restWindows[0].policy="hold",
  "lost final rest policy":s=>s.rhythm.restWindows.pop(),
  "unavailable bass octave":s=>s.practiceAccompaniment.events[0].notes[0].name="C3",
  "chromatic substitute":s=>s.practiceAccompaniment.events[0].notes[0].name="C#4",
  "unison duplicate":s=>s.practiceAccompaniment.events[0].notes[0].name="E4",
  "undisclosed raised register":s=>s.practiceAccompaniment.events[1].notes[0].name="F4",
  "missing anchor":s=>s.practiceAccompaniment.events.pop(),
  "invented closing root":s=>s.practiceAccompaniment.events.push({beat:189,duration:.75,pattern:"source-chord-root-sparse-four-bar-anchor",notes:[{name:"C4",role:"bass",velocity:.3}]}),
  "inherited old auto layer":s=>s.autoAccompaniment=legacy.autoAccompaniment
};
for (const [label,mutate] of Object.entries(negativeCandidates)) test(`exact candidate rejects ${label}`,()=>{
  const changed=structuredClone(song); mutate(changed);
  assert.throws(()=>{checkMelody(changed);checkSupport(changed);});
});
test("membership tests require a complete supported span, not just a legal root attack",()=>{
  const crossed=structuredClone(song.practiceAccompaniment.events[0]); crossed.duration=4;
  assert.throws(()=>checkWrittenSourceSpan(crossed),/full written span/);
  const wrong=structuredClone(song.practiceAccompaniment.events[0]); wrong.notes[0].name="F3";
  assert.throws(()=>checkWrittenSourceSpan(wrong),/membership/);
});
test("actual corrected validator accepts all20 rests and rejects conflicting spans without repairing data",()=>{
  const before=JSON.stringify(song); assert.deepEqual(validate(song).errors,[]); assert.equal(JSON.stringify(song),before);
  const late=structuredClone(song); late.practiceAccompaniment.events[1].duration=3;
  assert.ok(validate(late).errors.some(e=>/silent rest window/.test(e)));
  const tooShort=structuredClone(song); tooShort.sourceFeatures.sourceTotalBeats=191;
  assert.ok(validate(tooShort).errors.length>0);
});
test("normalization and all three deep links keep58 source records but37 canonical single-melody cards",()=>{
  assert.equal(Object.keys(library).length,58); assert.equal(getPracticeSongs(library).length,37);
  assert.deepEqual(plain(library[song.id].steps),melody.steps);
  assert.deepEqual(plain(library[song.id].practiceAccompaniment),song.practiceAccompaniment);
  assert.deepEqual(plain(library[song.id].rhythm),song.rhythm);
  assert.deepEqual(plain(library[song.id].sourceFeatures),song.sourceFeatures);
  for (const id of [melody.id,legacy.id,song.id]) assert.equal(getPracticeSongId(library,id),melody.id);
  for (const entries of [[song,legacy,melody],[melody,song,legacy]])
    assert.deepEqual(getPracticeSongs(normalizedLibrary(entries)).map(s=>s.id),[melody.id]);
  const absent=normalizedLibrary(rawSongs.filter(s=>s.id!==song.id));
  assert.equal(Object.keys(absent).length,57); assert.equal(getPracticeSongs(absent).length,37);
});
test("provider borrows only compatible optional support and never the retained old V2 backing",()=>{
  assert.equal(hasMatchingPracticeMelody(melody,song),true); assert.equal(hasMatchingPracticeMelody(melody,legacy),false);
  const app=appContext(), canonical=app.songLibrary[melody.id];
  assert.equal(app.getPracticeAccompanimentSource(canonical).id,song.id);
  assert.deepEqual(plain(app.getAccompanimentConfig(canonical,"light")),song.practiceAccompaniment);
  assert.equal(app.getAccompanimentConfig(canonical,"original"),null); assert.equal(app.getDefaultAccompanimentEnabled(canonical),false);
  const absent=appContext(rawSongs.filter(s=>s.id!==song.id));
  assert.equal(absent.getPracticeAccompanimentSource(absent.songLibrary[melody.id]),null);
  assert.equal(getSongAccompanimentProvider(library[melody.id],[library[legacy.id]],true),null);
  for (const mutate of [s=>s.events[0].notes[0].name="D4",s=>s.events[0].beat=.25,s=>s.events[0].duration=.5,
    s=>s.events.pop(),s=>s.bpm=85,s=>s.sourceFeatures.sourceTotalBeats=193,s=>s.events[0].notes[0].judge=false,
    s=>s.events[0].notes.push({name:"D4",role:"melody",judge:true})]) {
    const changed=structuredClone(song); mutate(changed);
    assert.equal(hasMatchingPracticeMelody(melody,changed),false);
    assert.equal(getSongAccompanimentProvider(melody,[changed,legacy]),null);
  }
});
test("derived current hint advertises optional support only for exact identified compatible source",()=>{
  const current=library[melody.id], provider=library[song.id];
  assert.equal(getSongPracticeHint(current,provider),song.hint);
  assert.match(song.hint,/183.*可选轻伴奏.*默认关闭.*自然余响.*84 BPM为练习设定/);
  assert.equal(getSongPracticeHint(current),melody.hint);
  assert.equal(getSongPracticeHint(current,library[legacy.id]),melody.hint);
  for (const mutate of [s=>s.id="impostor",s=>s.baseSongId="other",s=>s.sourceFeatures.practiceAccompaniment.candidate="other",
    s=>s.practiceAccompaniment.events=[],s=>s.events[0].duration=.5,s=>s.bpm=85,s=>s.hint=" "]) {
    const changed=plain(provider); mutate(changed); assert.equal(getSongPracticeHint(current,changed),melody.hint);
  }
  const changed=plain(current); changed.sourceFeatures.sourceReview.currentScopeReview.selectedEdition="other";
  assert.equal(getSongPracticeHint(changed,provider),melody.hint);
});
test("default-off memory restores only exact content; real support changes invalidate while prose changes do not",()=>{
  const signature=signatureFor(rawSongs); assert.ok(signature?.length>0);
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const speedBytes=JSON.stringify({schemaVersion:1,songs:{[melody.id]:{speed:.65}}}); values.set(SONG_SPEED_STORAGE_KEY,speedBytes);
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature),{});
  assert.deepEqual(saveSongAccompaniment(storage,melody.id,"light",signature),{saved:true,choice:"light"});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature),{choice:"light"});
  for (const mutate of [s=>s.practiceAccompaniment.volume=.27,s=>s.practiceAccompaniment.events[0].notes[0].velocity=.29,
    s=>s.practiceAccompaniment.events[0].beat=.25,s=>s.practiceAccompaniment.events[0].duration=.5,
    s=>s.practiceAccompaniment.events[0].notes[0].name="G3",s=>s.practiceAccompaniment.events[0].notes[0].role="harmony",
    s=>s.events[0].notes[0].name="D4",s=>s.bpm=85,s=>s.sourceFeatures.sourceTotalBeats=193]) {
    const changed=structuredClone(song); mutate(changed);
    const next=signatureFor(rawSongs.map(s=>s.id===song.id?changed:s));
    assert.notEqual(next,signature); assert.deepEqual(readSongAccompaniment(storage,melody.id,next),{choice:"off",stale:true});
  }
  const prose=structuredClone(song); prose.hint+=" Updated review wording."; prose.sourceFeatures.practiceAccompaniment.reviewedOn="2026-10-13";
  assert.equal(signatureFor(rawSongs.map(s=>s.id===song.id?prose:s)),signature);
  assert.equal(signatureFor(rawSongs.filter(s=>s.id!==song.id)),null);
  assert.deepEqual(saveSongAccompaniment(storage,melody.id,"off",signature),{saved:true,choice:"off"});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature),{choice:"off"});
  assert.equal(values.get(SONG_SPEED_STORAGE_KEY),speedBytes); assert.deepEqual(readSongSpeed(storage,melody.id),{speed:.65});
});
test("raw built-in import rejects reserved support rather than silently losing its16 attacks",()=>{
  assert.throws(()=>parseImportedSongs(JSON.stringify(song),{}),/顶层 practiceAccompaniment.*外部导入不支持.*autoAccompaniment.*不要仅删除字段而丢失伴奏/);
});
test("deliberately prepared external form preserves melody, support, rests, settings and source payload",()=>{
  const uploaded=externalRepresentation(), original=JSON.stringify(uploaded);
  const imported=parseImportedSongs(original,{}), importedLibrary=Object.fromEntries(imported.map(s=>[s.id,s]));
  assert.equal(getPracticeSongs(importedLibrary).length,1);
  assert.deepEqual(getPracticeSongs(importedLibrary)[0].steps,melody.steps);
  const backing=imported.find(s=>s.autoAccompaniment);
  assert.deepEqual(backing.autoAccompaniment,song.practiceAccompaniment); assert.deepEqual(backing.rhythm,song.rhythm);
  assert.deepEqual(backing.sourceFeatures,song.sourceFeatures); assert.equal(getPracticeTotalBeats(backing.events,backing),192);
  assert.equal(JSON.stringify(uploaded),original);
  const filled=externalRepresentation(); filled.autoAccompaniment.events[1].duration=3;
  assert.throws(()=>parseImportedSongs(JSON.stringify(filled),{}),/静音.*自动伴奏重叠/);
});
test("numerical observations explicitly preserve natural tails without listening or source-tempo approval",()=>{
  const audio=review.numericalAudioReview;
  assert.deepEqual([audio.configuredBpm,audio.sampleRate,audio.renderCount,audio.scheduledSources,audio.endedSources],[84,44100,9,1194,1194]);
  assert.deepEqual(audio.speedMultipliers,[1,.55,1.4]); assert.equal(audio.suggestedSpeedFactorAutomaticallyApplied,false);
  assert.deepEqual(audio.backingResidualRestBeats,[14,38,110,134,158,182]);
  assert.deepEqual(audio.backingOnlyRestNonzeroCounts,[6,0,6]);
  assert.deepEqual(audio.backingOnlyPostChordBoundaryNonzeroCounts,[16,0,16]);
  assert.equal(audio.sampleClippingCount,0); assert.equal(audio.nonfiniteSampleCount,0);
  assert.equal(audio.liveRafSchedulerTested,false); assert.equal(audio.subjectiveListening,false); assert.equal(audio.independentPcmRegeneration,false);
  assert.match(audio.rmsRatioMeaning,/not a perceived-loudness percentage/);
  assert.match(review.acousticTailBoundary,/not PCM cutoffs.*natural tails.*residuals/);
  assert.equal(review.referenceListening,"not-performed"); assert.equal(review.physicalKalimba,"not-performed");
  assert.equal(review.status,"needs-review"); assert.equal(review.independentlyVerified,false);
  assert.equal(review.publicDistributionRights,"unestablished-local-preview-only");
});

// Optional private fixtures are never a package dependency. A skip is reported
// honestly and does not count as source inspection or fresh audio rendering.
const evidenceDir=process.env.DAYLILY_SUPPORT_EVIDENCE_DIR;
test("optional frozen source/candidate fixtures retain all literal changes and exact production payload",{skip:!evidenceDir},async()=>{
  const fixtures={"candidate-built-in-shape.private.json":"13888538b2b784d6bdd2846fee22d3ebb98c33799d89536ae483c10c815cd5b6",
    "literal-chord-timeline.private.json":"a333286d4ef22e7fdb19653c64d05bfc214f40c0d854692912165d5cbaba75a4",
    "selection-and-omissions.private.json":"878173a8b4f63540af9ec3571cb9d4274a65887eb99df805b3f73f988ea542d5",
    "melody-source-expectations.private.json":"100b33b62444c6802ca37153874a6c7e53eb9b8dbd1c9f0d5889930be44b30af"};
  const loaded={}; for (const [name,fingerprint] of Object.entries(fixtures)) {
    const bytes=await readFile(join(evidenceDir,name)); assert.equal(hash(bytes),fingerprint,name); loaded[name]=JSON.parse(bytes);
  }
  const frozen=loaded["candidate-built-in-shape.private.json"];
  for (const field of ["events","practiceAccompaniment","rhythm"]) assert.deepEqual(song[field],frozen[field],`${field} exact frozen payload`);
  const literal=loaded["literal-chord-timeline.private.json"];
  assert.deepEqual([literal.printedBars.length,literal.printedSymbolCount,literal.expandedSymbolCount],[48,51,68]);
  assert.equal(literal.timeline.reduce((n,t)=>n+t.to-t.beat,0),192);
  assert.deepEqual(literal.timeline.filter(t=>t.symbol==="A7").map(t=>t.beat),[33,129,177]);
  assert.deepEqual(literal.chordTheory.A7.members,["A","C#","E","G"]);
  assert.deepEqual(literal.timeline.filter(t=>t.localBeat===2).map(t=>t.beat),[44,92,140,188]);
  assert.deepEqual(literal.timeline.filter(t=>t.beat%12===0).map(t=>[t.beat,t.countedPrintedMeasure,t.symbol]),selected.map(r=>r.slice(0,3)));
  const decisions=loaded["selection-and-omissions.private.json"].decisions;
  assert.equal(decisions.length,68); assert.equal(decisions.filter(d=>d.selected).length,16);
  assert.equal(decisions.filter(d=>!d.selected).length,52);
  assert.ok(decisions.filter(d=>d.symbol==="A7").every(d=>!d.selected&&d.omittedChordMembers.includes("C#")));
  const evidence=loaded["melody-source-expectations.private.json"];
  assert.equal(evidence.songId,frozen.id); evidence.songId=song.id;
  assert.equal(checkTranscriptionEvidence(song,evidence).checkedAttacks,183);
});
