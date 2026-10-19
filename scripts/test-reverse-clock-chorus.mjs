import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { getSongLibrary, getPracticeSongs, getSongAccompanimentProvider } from "../src/song-store.js";
import { getSongDisplayTitle } from "../src/song-presentation.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";
import { harness } from "./helpers/practice-startup-harness.mjs";

const song = JSON.parse(await readFile(new URL("../data/songs/fan-fang-xiang-de-zhong.json", import.meta.url), "utf8"));
const current = song.sourceFeatures.sourceReview.currentScopeReview;
const sourceUrl = "https://www.jianpujia.com/jianpu/354380.html";
const sourceHash = "5ec0212ec53e88facbfbdd0442df0dcd8db32422aa9806ff2cd6b85bc66e0304";
// Hand-entered from the independent, pre-candidate pixel reading of page 2's
// numbered vocal line. The explicit repeat/volta route, not the lyric rows,
// authorizes the second pass. This expectation is never generated from the song.
const firstPass = [
  ["A4",0,.5],["G4",.5,.5],["E4",1,.5],["D4",1.5,1.5],["E4",3,.5],["C4",3.5,1],
  ["D4",4.5,1],["E4",5.5,1],["G4",6.5,1.5],
  ["A4",8,.5],["G4",8.5,.5],["E4",9,.5],["D4",9.5,1.5],["E4",11,.5],["D4",11.5,1.5],
  ["C4",13,.5],["D4",13.5,1],["C4",14.5,1.5],
  ["A4",16,.5],["G4",16.5,.5],["E4",17,.5],["D4",17.5,1.5],["E4",19,.5],["C4",19.5,1],
  ["D4",20.5,1],["E4",21.5,1],["G4",22.5,1.5],
  ["A4",24,.5],["G4",24.5,.5],["E4",25,.5],["D4",25.5,1.5],["E4",27,.5],["A3",27.5,2.5]
];
const expected = [...firstPass, ...firstPass.map(([name,beat,duration]) => [name,beat+32,duration])];
const route = [26,27,28,29,30,31,32,33,26,27,28,29,30,31,32,34];
const rests = [[30,2],[62,2]];
const tieBeats = [2,4,5,6,7,10,12,14,15,18,20,21,22,23,26,28];
const pitch = { C:0,D:2,E:4,F:5,G:7,A:9,B:11 };
const midi = name => 12*(Number(name.slice(1))+1)+pitch[name[0]];
const noteName = number => `${["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][number%12]}${Math.floor(number/12)-1}`;
const events = value => value.steps.map(([name,beat,duration]) => ({beat,duration,notes:[{name,role:"melody",judge:true}]}));
const evidence = {
  songId: song.id,
  source: { reference: sourceUrl, scope: "Page 2 explicit vocal line: editorial m26–33, m26–32, m34; uniform -7 semitones." },
  melodySpans: [{from:0,to:64,attacks:expected}], sourceTotalBeats:64,
  // Vocal rests are not all-layer silence: the source guitar part is omitted.
  pitchFit: {sourcePitchClasses:[2,4,7,9,11],semitoneShift:-7}
};
const overlap = ([,beat,duration],start,end) => Math.max(0,Math.min(end,beat+duration)-Math.max(start,beat));
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

function libraryWithoutCustomSongs() {
  const previous=globalThis.localStorage;
  globalThis.localStorage={getItem:()=>null};
  try { return getSongLibrary(); }
  finally { if(previous===undefined) delete globalThis.localStorage; else globalThis.localStorage=previous; }
}

function fixture(speed=1) {
  const h = harness({range:null}), {c} = h;
  c.songLibrary = libraryWithoutCustomSongs(); c.setCurrentSong(song.id);
  c.speedSlider.value=String(speed); c.applySpeed();
  return h;
}

test("all 66 independently read attacks encode the explicitly repeated chorus only", () => {
  assert.equal(song.schemaVersion,1); assert.equal(song.steps.length,66);
  assert.deepEqual(song.steps,expected);
  assert.equal(checkTranscriptionEvidence(song,evidence).checkedAttacks,66);
  assert.deepEqual(current.expandedSourceMeasures,route);
  assert.equal(song.sourceFeatures.sourceWrittenMeasureCount,9);
  assert.equal(song.sourceFeatures.sourceMeasureCount,16);
  assert.equal(current.metricNoteheadOccurrences,98);
  assert.equal(current.principalAttackCount,66);
  assert.equal(current.repeatExpansion,"explicit-repeat-with-first-and-second-endings");
  assert.equal(current.repeatSignsPresent,true); assert.equal(current.lyricRowsAuthorizeRepeat,false);
  assert.equal(current.pickupBeats,0);
});

test("every four-beat bar accounts for incoming ties, local attacks and vocal rests", () => {
  assert.equal(song.beatsPerMeasure,4);
  for(let bar=0;bar<16;bar++) {
    const start=bar*4, end=start+4;
    const actual=song.steps.filter(([,beat])=>beat>=start&&beat<end);
    assert.deepEqual(actual,expected.filter(([,beat])=>beat>=start&&beat<end),`source m${route[bar]}, expanded bar ${bar+1}`);
    const sounding=song.steps.reduce((sum,step)=>sum+overlap(step,start,end),0);
    const resting=rests.reduce((sum,[beat,duration])=>sum+overlap([null,beat,duration],start,end),0);
    assert.equal(sounding+resting,4,`bar ${bar+1}: incoming and outgoing spans included`);
  }
});

test("32 same-pitch ties are held once, while the different-pitch phrase slur stays articulated", () => {
  const all=[...tieBeats,...tieBeats.map(beat=>beat+32)];
  assert.equal(current.tieContinuationCount,32);
  assert.deepEqual(current.tieContinuations.map(t=>t.continuationBeat),all);
  for(const {continuationBeat,note} of current.tieContinuations) {
    assert.equal(song.steps.some(([,beat])=>beat===continuationBeat),false);
    assert.equal(song.steps.filter(([name,beat,duration])=>name===note&&beat<continuationBeat&&beat+duration>continuationBeat).length,1);
  }
  for(const shift of [0,32]) {
    assert.deepEqual(song.steps.filter(([,beat])=>beat>=11.5+shift&&beat<16+shift),
      [["D4",11.5+shift,1.5],["C4",13+shift,.5],["D4",13.5+shift,1],["C4",14.5+shift,1.5]]);
    assert.deepEqual(song.steps.find(([,beat])=>beat===27.5+shift),["A3",27.5+shift,2.5]);
  }
});

test("both two-beat vocal rests and the 64-beat source extent survive normalization", () => {
  let cursor=0; const gaps=[];
  for(const [,beat,duration] of song.steps) {
    assert.ok(beat>=cursor); if(beat>cursor) gaps.push([cursor,beat-cursor]); cursor=beat+duration;
  }
  if(cursor<64) gaps.push([cursor,64-cursor]);
  assert.deepEqual(gaps,rests); assert.deepEqual(current.vocalRestWindows,rests);
  assert.equal(cursor,62); assert.equal(current.endingRestBeats,2);
  assert.equal(song.sourceFeatures.sourceTotalBeats,64);
  assert.equal(getPracticeTotalBeats(events(song),song),64);
  assert.equal(current.silentWindows,undefined);
  assert.match(current.restScope,/vocal-only.*guitar.*omitted/);
});

test("one uniform transposition fits A3–A4 without accidental substitution or local octave folds", () => {
  const allowed=new Set(DISPLAY_KEYS.map(({name})=>name));
  for(const [name] of song.steps) assert.ok(allowed.has(name));
  assert.deepEqual([...new Set(song.steps.map(([name])=>name))].sort(),["A3","A4","C4","D4","E4","G4"]);
  assert.deepEqual([Math.min(...song.steps.map(([name])=>midi(name))),Math.max(...song.steps.map(([name])=>midi(name)))],[57,69]);
  assert.deepEqual(current.sourceRange,["E4","E5"]); assert.deepEqual(current.compiledRange,["A3","A4"]);
  assert.equal(current.transpositionSemitones,-7); assert.equal(song.sourceFeatures.sourceKey,"G");
  assert.equal(song.key,"C"); assert.equal(song.tuning,"21-key-c");
  assert.deepEqual(current.localPitchAlterations,[]); assert.deepEqual(current.additionalMelodyAccidentals,[]);
  assert.equal(current.octaveFolding,false);
  assert.equal(Math.min(...song.steps.slice(1).map(([,beat],i)=>beat-song.steps[i][1])),.5);
  assert.equal(song.difficulty,"medium"); assert.equal(song.sourceFeatures.suitability.status,"conditional");
});

test("96 BPM is disclosed as a practice choice, with no invented printed or recording tempo", () => {
  assert.equal(song.bpm,96); assert.equal(song.defaultSpeedFactor,.85);
  assert.equal(current.sourceNumericTempoPrinted,false); assert.equal(current.sourceQuarterBpm,null);
  assert.equal(current.practiceQuarterBpm,96);
  assert.match(current.tempoDecision,/practice setting.*not.*printed.*measurement/);
  assert.match(song.hint,/96 BPM为练习设定/); assert.match(song.hint,/非全曲/);
  near(64*60/song.bpm,40); near(.5*60/song.bpm,.3125);
  assert.equal(current.referenceListening,"not-performed"); assert.equal(current.physicalKalimba,"not-performed");
});

test("source attribution and rights disclosure do not claim a second score or completed listening", () => {
  assert.equal(current.sourceUrl,sourceUrl); assert.equal(current.sourcePage,2);
  assert.equal(current.selectedEdition,"jianpujia-354380-lyric-aligned-vocal-chorus");
  assert.equal(current.independentSourceFixtureSha256,sourceHash);
  assert.match(current.sourcePixelReview,/same three-page edition.*not a second/);
  assert.equal(current.publicationRights,"project-owner-confirmed-licensed-Jay-Chou-song-package");
  assert.match(current.rightsScope,/license itself was not independently inspected/);
  assert.equal(song.sourceFeatures.sources[0].url,sourceUrl);
});

test("exactly one built-in monophonic card is added, with no automatic or judged chord layer", async () => {
  const files=await readSongFiles(), library=libraryWithoutCustomSongs(), built=library[song.id];
  assert.equal(files.filter(({song:item})=>item.id===song.id).length,1);
  assert.equal(getPracticeSongs(library).filter(item=>item.id===song.id).length,1);
  assert.equal(built.schemaVersion,1); assert.deepEqual(built.steps,song.steps);
  assert.equal(getSongDisplayTitle(built),"《反方向的钟》");
  assert.equal(getSongDisplayTitle({...built,source:"local"}),song.title);
  assert.equal(built.events.length,66);
  assert.ok(built.events.every(event=>event.notes.length===1&&event.notes[0].role==="melody"&&event.notes[0].judge));
  for(const field of ["events","rhythm","autoAccompaniment","practiceAccompaniment"]) assert.equal(song[field],undefined);
  assert.equal(getSongAccompanimentProvider(built,Object.values(library)),null);
});

test("fresh entry uses 1.0x and a remembered choice survives re-entry", () => {
  const h=fixture(), {c}=h;
  assert.equal(c.speedFactor,1); assert.equal(c.songTotalBeats,64);
  assert.equal(c.songEvents.length,66); assert.equal(c.accompanimentEvents.length,0);
  c.speedSlider.value=".65"; c.applySpeed(); c.setCurrentSong(song.id);
  assert.equal(c.speedFactor,.65); assert.equal(song.defaultSpeedFactor,.85);
});

for(const speed of [1,.85,.35,1.4]) test(`production demo schedules all 66 attacks once and retains the ending rest at ${speed}x`,async()=>{
  const h=fixture(speed),{c}=h;
  await c.playDemo();
  h.healthy(c.getSessionLeadSeconds()+30.2*c.getScaledBeatSeconds());
  assert.deepEqual(h.names(),firstPass.map(([name])=>name));
  h.healthy(1.5*c.getScaledBeatSeconds()); assert.equal(h.sounds.length,33,"no attack in first vocal rest");
  h.healthy((62.2-31.7)*c.getScaledBeatSeconds());
  assert.deepEqual(h.names(),expected.map(([name])=>name));
  assert.equal(c.statusText.textContent,"示范中");
  h.healthy(c.getSongEndSeconds()-c.currentPracticeTime()+.05);
  assert.equal(c.statusText.textContent,"示范结束"); assert.equal(c.songProgressFill.style.width,"100.000%");
  assert.equal(c.songRemaining.textContent,"剩余 0:00"); assert.equal(c.shouldLoop(),false);
  assert.equal(h.sounds.length,66); assert.equal(h.frames.size,0);
  h.advance(2); h.tick(); assert.equal(h.sounds.length,66);
});

test("actual production practice reaches the final rest without inventing a target or backing",async()=>{
  const h=fixture(),{c}=h;
  await c.startPractice(); h.healthy(c.getSessionLeadSeconds()+62.2*c.getScaledBeatSeconds());
  assert.equal(c.statusText.textContent,"练习中"); assert.equal(c.getExpectedEvent(c.currentPracticeTime()),null);
  assert.equal(h.sounds.length,0); h.healthy(c.getSongEndSeconds()-c.currentPracticeTime()+.05);
  assert.equal(c.statusText.textContent,"练习结束"); assert.equal(c.songProgressFill.style.width,"100.000%");
});

const mutations={
  "retrigger-cross-system-tie":value=>{const i=value.steps.findIndex(([,beat])=>beat===11.5);value.steps.splice(i,1,["D4",11.5,.5],["D4",12,1]);},
  "merge-different-pitch-slur":value=>{const i=value.steps.findIndex(([,beat])=>beat===13.5);value.steps.splice(i,2,["D4",13.5,2.5]);},
  "retrigger-final-tie":value=>value.steps.splice(-1,1,["A3",59.5,.5],["A3",60,2]),
  "fold-cadence-octave":value=>{value.steps.at(-1)[0]="A4";},
  "flatten-syncopated-hold":value=>{value.steps.find(([,beat])=>beat===1.5)[2]=.5;},
  "fill-vocal-rest":value=>{value.steps.splice(33,0,["A3",30,2]);},
  "stretch-over-final-rest":value=>{value.steps.at(-1)[2]=4.5;},
  "trim-ending-rest":value=>{value.sourceFeatures.sourceTotalBeats=62;},
  "omit-second-pass":value=>{value.steps=value.steps.slice(0,33);},
  "invent-third-pass":value=>{value.steps.push(...firstPass.map(([name,beat,duration])=>[name,beat+64,duration]));value.sourceFeatures.sourceTotalBeats=96;}
};
for(const [label,mutate] of Object.entries(mutations)) test(`independent score expectations reject ${label}`,()=>{
  const changed=structuredClone(song); mutate(changed);
  assert.throws(()=>checkTranscriptionEvidence(changed,evidence));
});

const privatePath=process.env.REVERSE_CLOCK_SOURCE_EVIDENCE_PATH;
test("frozen external source-only reading independently derives every compiled pitch, onset and tie",{
  skip:!privatePath&&"Private source-pixel fixture absent; public frozen assertions above are not a fresh pixel review."
},async()=>{
  const bytes=await readFile(privatePath);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),sourceHash);
  const reviewed=JSON.parse(bytes);
  assert.equal(reviewed.independence.candidateSongFilesRead,false); assert.equal(reviewed.independence.candidateTuplesRead,false);
  assert.equal(reviewed.source.url,sourceUrl); assert.equal(reviewed.source.numericTempoPrinted,false);
  const selected=reviewed.routes[1];
  assert.deepEqual(selected.editorialMeasures,route); assert.equal(selected.totalBeats,64);
  assert.equal(selected.printedHeadOccurrences,98); assert.equal(selected.confirmedTieJoins,32);
  assert.equal(selected.distinctAttacks,66); assert.equal(selected.melodyEndBeat,62);
  const derived=selected.noteAttacks.map(({sourceMidi,beat,duration})=>[noteName(sourceMidi-7),beat,duration]);
  assert.deepEqual(derived,expected); assert.deepEqual(song.steps,derived);
  assert.deepEqual(selected.notatedVocalRests.map(({beat,duration})=>[beat,duration]),[[30,1],[31,1],[62,1],[63,1]]);
  for(const image of reviewed.source.images) {
    const raw=await readFile(new URL(`../${image.localPath}`,import.meta.url));
    assert.equal(createHash("sha256").update(raw).digest("hex"),image.sha256);
  }
});
