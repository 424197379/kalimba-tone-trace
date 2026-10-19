import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { analyzeSongTiming } from "./song-report-analysis.mjs";
import { getCustomSongs, getPracticeSongs, getPracticeSongId, getSongArchiveDownload,
  getSongLibrary, hasMatchingPracticeMelody, parseImportedSongs, saveCustomSongs } from "../src/song-store.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const song = JSON.parse(await read("data/songs/ju-ci-lang-de-xia-tian.json"));
const archivePath = "data/archives/ju-ci-lang-de-xia-tian-v2.4.25.json";
const archiveBytes = await read(archivePath);
const archive = JSON.parse(archiveBytes);
const archiveHash = "d9217930906156ca047d542d1008cdcfe0c681fcdde829d8b71709275b078d3d";
const tupleHash = "6a0b1e514dc98d85a7d208439d24670f3dd5f5ce7b5c32f0d7f2c9860633e482";
const sourceFixtureHash = "480c750d7de42e0afaf61623fa67bd6b00c08377fc04e9da40ea04d04b5a2672";
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const sourceUrl = "https://www.everyonepiano.cn/Music-5457.html";

// These fingerprints were frozen from the source-authored pre-edit evidence,
// after the independent m22 A5 ledger-line resolution. They are not generated
// from production during the test and do not contain the private glyph map.
// They protect a recorded edition; they do not independently read notation.
const barDecisions = [
  [8,4,"68da1dc43d2ad3892301ba622bf6a58dee41b3504ba09729e953327deec5be3f"],
  [9,3,"9debd49082530414964aa59d9956169828cc0de2e145176475e8cae4389f230e"],
  [10,4,"5e59313180b7a18899ff9cf17751e2943da010a21d1a22697cf86043162903d1"],
  [11,4,"e6bcf15f514de760615e310585eb41afa8ac46a4c19369229df968a5c6676a3e"],
  [12,5,"fcb8e4fe142f4d4c9d0d0dc0dfa9cf06c25a2a313132fe8bf55326023683de46"],
  [13,3,"ad3f6daa917e3daccd49049b4d8e6da40dc1b0ead583125a98ea3f0be1d4a9a8"],
  [14,4,"f35bf5438f9eee287162c133bc35a2191a5b2fe9f0ee7701d325fe4798c40f52"],
  [15,4,"8395f31808319ea99217208316c28e4e2e121c851b7426abd2278b8db4f39df3"],
  [16,3,"be06dc08fbde1786900576e588fbc3e0b2f03107a87ca626d39747039442bb16"],
  [17,4,"61bec17962743502bd5ab642ba234eab43bb24731b0cb736e9a19ec9f20c2402"],
  [18,5,"f40d27059fdcd60a13b0b8fe6c81cbea32fcd268d64e95806f3094bb42910296"],
  [19,4,"72d258dc5ada7457eae4b16650c221b3cd33005f7d5718bf78164483fb4c6361"],
  [20,5,"c99ec5fb9043ca2b22f47cc29f1ee1e4cfc0c1a468ed6125d8359bbdcfb5a649"],
  [21,4,"571951fbb161eb7e42d544652e0c470e70a6e18c0402a4ed4db7c328c5f9fe80"],
  [22,4,"20015add35baf1e5c138a15ca45527621b759ca6bf5c021360fc3275682665c2"],
  [23,1,"90e3a1aa829f3d03a80dd9939312a2526178fdb1d106403548d917db4c8f623b"]
];
const rests = [[0,1],[4,1],[12,1],[21,.5],[25,.5]];
const tieDecisions = [[9,"C5",2.75,.25,1],[11,"D5",6.75,.25,.5],[13,"C5",10.75,.25,1],
  [15,"D5",14.75,.25,.5],[17,"G5",18.75,.25,.5],[19,"G5",22.75,.25,.5],[21,"E5",26.75,.25,.5]];
const phrase = (value, from, to) => value.steps.filter(([,beat]) => beat >= from && beat < to);
const eventsFor = steps => steps.map(([name,beat,duration]) => ({beat,duration,notes:[{name,role:"melody",judge:true}]}));
const normalized = value => ({...structuredClone(value),baseSongId:value.id,source:"system",
  arrangementKind:"melody",judgementMode:"melody",events:eventsFor(value.steps)});
const spanInside = ([,beat,duration],start,end) => Math.max(0,Math.min(end,beat+duration)-Math.max(start,beat));
const midi = name => 12 * (Number(name.slice(1)) + 1) + ({C:0,D:2,E:4,F:5,G:7,A:9,B:11})[name[0]];

function assertSelectedEdition(value) {
  assert.equal(value.steps.length,61);
  assert.equal(hash(JSON.stringify(value.steps)),tupleHash,"61 immutable source-decided tuples");
  assert.equal(value.bpm,96,"quarter-note tempo");
  assert.equal(value.beatsPerMeasure,2,"actual source 2/4");
  assert.equal(value.sourceFeatures.sourceTotalBeats,32);
  for (const [measure,count,fingerprint] of barDecisions) {
    const start=(measure-8)*2;
    const attacks=phrase(value,start,start+2);
    assert.equal(attacks.length,count,`source m${measure} attack count`);
    assert.equal(hash(JSON.stringify(attacks)),fingerprint,`source m${measure} exact rhythm and register`);
    const sounding=value.steps.reduce((sum,step)=>sum+spanInside(step,start,start+2),0);
    const resting=rests.reduce((sum,[beat,duration])=>sum+spanInside([null,beat,duration],start,start+2),0);
    assert.equal(sounding+resting,2,`source m${measure} accounted duration`);
  }
}
function withIsolatedStorage(run) {
  const previous=globalThis.localStorage, values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
  try { return run(values); }
  finally { if(previous===undefined) delete globalThis.localStorage; else globalThis.localStorage=previous; }
}

test("selected first theme keeps all 61 reviewed tuples and 16 actual 2/4 bars", () => {
  assertSelectedEdition(song);
  assert.equal(song.schemaVersion,1);
  assert.equal(song.id,"ju-ci-lang-de-xia-tian","preserve canonical links and per-song preferences");
  assert.equal(song.title,"《菊次郎的夏天》（首主题）");
  assert.equal(song.practiceTitle,`${song.title}练习轨道`);
  assert.equal(song.scoreTitle,`${song.title}简谱进度`);
  assert.match(song.hint,/第8–23小节.*上声部首主题.*61.*32/);
  assert.match(song.hint,/2\/4.*96 BPM.*七处.*五处/);
  assert.match(song.hint,/0\.4倍速.*省略前奏、伴奏及后续段落/);
  assert.doesNotMatch(song.hint,/旧版|还原|全曲|更容易/);
  assert.equal(song.sourceFeatures.sourceMeasureCount,16);
  assert.deepEqual(current.sourceMeasureRange,[8,23]);
  assert.deepEqual(current.sourceBeatRange,[14,46]);
  assert.equal(current.sourceToExcerptBeatOffset,-14);
  assert.deepEqual(current.reviewedBeatRanges,[[0,32]]);
});

test("seven confirmed ties remove only their continuation attacks, preserving genuine repeats", () => {
  assert.equal(current.ties.length,7);
  assert.equal(current.printedNoteheadCount,68);
  for(const [index,[measure,name,beat,first,second]] of tieDecisions.entries()) {
    const merged=[name,beat,first+second];
    assert.deepEqual(current.ties[index],{sourceMeasure:measure,mergedAttack:merged,
      segments:[[name,beat,first],[name,beat+first,second]]});
    assert.deepEqual(song.steps.find(([,onset])=>onset===beat),merged);
    assert.equal(song.steps.some(([,onset])=>onset===beat+first),false);
  }
  assert.deepEqual(phrase(song,2.5,4),[["C5",2.5,.25],["C5",2.75,1.25]]);
  assert.deepEqual(phrase(song,18,20),[["G5",18,.5],["G5",18.5,.25],["G5",18.75,.75],["G5",19.5,.5]]);
  assert.deepEqual(phrase(song,26,28),[["E5",26,.5],["E5",26.5,.25],["E5",26.75,.75],["E5",27.5,.5]]);
  assert.equal(song.sourceFeatures.hasRepeats,false,"no repeat signs in selected scope");
  assert.equal(current.repeatExpansion,"none-all-selected-bars-written-out");
  assert.equal(song.steps.filter(([name],i)=>i>0 && name===song.steps[i-1][0]).length,17);
});

test("five melody-only rests remain scoped and the final D5 reaches the excerpt boundary exactly", () => {
  assert.deepEqual(current.melodyOnlyRestWindows.map(({beat,duration})=>[beat,duration]),rests);
  assert.ok(current.melodyOnlyRestWindows.every(({voice,reason})=>voice==="selected-piano-upper-staff-only" && /not all-layer silence/.test(reason)));
  assert.equal(current.silentWindows,undefined);
  assert.equal(current.melodyRestWindows,undefined,"use the report-recognized melodyOnlyRestWindows path");
  const analysis=analyzeSongTiming(song);
  assert.deepEqual(analysis.melodyGaps.map(({beat,duration})=>[beat,duration]),rests);
  assert.equal(analysis.claims.melodyOnly.length,5);
  assert.equal(analysis.claims.allLayerSilent.length,0);
  assert.ok(analysis.melodyGaps.every(({declarations})=>declarations.length===1 && declarations[0].meaning==="declared-melody-only-rest"));
  assert.deepEqual(analysis.unannotatedLongGaps,[]);
  assert.deepEqual(analysis.issues,[]);
  assert.equal(rests.reduce((sum,[,duration])=>sum+duration,0),4);
  assert.equal(current.pickupBeats,0,"all of the first source bar is retained");
  assert.equal(current.initialMelodyRestBeats,1);
  assert.deepEqual(song.steps[0],["G4",1,.25]);
  assert.deepEqual(song.steps.at(-1),["D5",30,2]);
  assert.equal(current.endingRestBeats,0);
  assert.equal(getPracticeTotalBeats(eventsFor(song.steps),song),32);
  assert.equal(current.sourceEndingCertified,false,"this is a theme boundary, not the composition ending");
  for(const field of ["events","rhythm","autoAccompaniment","practiceAccompaniment"]) assert.equal(song[field],undefined);
});

test("unchanged fixed-C register and layout metrics support conditional slow-practice advice only", () => {
  const allowed=new Set(DISPLAY_KEYS.map(({name})=>name));
  for(const [name] of song.steps) assert.ok(allowed.has(name));
  assert.deepEqual([...new Set(song.steps.map(([name])=>name))].sort(),["A5","C5","D5","E5","F5","G4","G5"]);
  assert.deepEqual([Math.min(...song.steps.map(([name])=>midi(name))),Math.max(...song.steps.map(([name])=>midi(name)))],[67,81]);
  assert.deepEqual(song.steps.find(([,beat])=>beat===28.5),["A5",28.5,.5],"first above-staff ledger line is A5");
  assert.equal(current.transpositionSemitones,0);
  assert.equal(current.octaveShift,0);
  assert.equal(current.octaveFolding,false);
  assert.deepEqual(current.localPitchAlterations,[]);
  assert.deepEqual(current.melodyAccidentals,[]);
  assert.equal(song.key,"C");
  assert.equal(song.tuning,"21-key-c");
  const positions=new Map(DISPLAY_KEYS.map(({name},index)=>[name,index]));
  const side=name=>Math.sign(positions.get(name)-10);
  assert.equal(song.steps.slice(1).filter(([name],i)=>side(name)===side(song.steps[i][0])).length,24);
  let run=1, longest=1;
  for(let i=1;i<song.steps.length;i+=1) {
    run=side(song.steps[i][0])===side(song.steps[i-1][0])?run+1:1;
    longest=Math.max(longest,run);
  }
  assert.equal(longest,8);
  assert.equal(Math.max(...song.steps.slice(1).map(([name],i)=>Math.abs(midi(name)-midi(song.steps[i][0])))),9);
  assert.equal(Math.max(...song.steps.slice(1).map(([name],i)=>Math.abs(positions.get(name)-positions.get(song.steps[i][0])))),15);
  assert.equal(Math.min(...song.steps.slice(1).map(([,beat],i)=>beat-song.steps[i][1])),.25);
  assert.equal(.25*60000/song.bpm,156.25);
  assert.ok(Math.abs(.25*60000/(song.bpm*.55)-284.09090909090907)<1e-9);
  assert.ok(Math.abs(.25*60000/(song.bpm*.4)-390.625)<1e-9);
  assert.equal(song.defaultSpeedFactor,.4,"explicit button suggestion, never proof of the live speed");
  assert.equal(song.difficulty,"medium");
  assert.match(current.difficultyDecision,/editorial conditional slow-practice.*not a source marking/);
  assert.match(current.tempoDecision,/not a printed marking.*current\/remembered speed.*first-visit 0\.55/);
  assert.equal(song.sourceFeatures.suitability.status,"conditional");
});

test("current provenance distinguishes the selected instrumental edition from historical claims and missing acceptance", () => {
  assert.equal(current.status,"reviewed-selected-piano-first-theme");
  assert.equal(current.selectedEdition,"eop-5457-c-piano-upper-staff-m8-23");
  assert.equal(current.adoptedInVersion,"2.4.26");
  assert.equal(current.sourceUrl,sourceUrl);
  assert.equal(current.sourceImageSha256,"23450167f24de4804bac3446155c8b9a119644b943ac615a85c5ccab0766f906");
  assert.equal(current.sourceVoice,"explicit-monophonic-piano-upper-staff");
  assert.equal(current.vocalLineCertified,false);
  assert.equal(current.sourceMeter,"2/4");
  assert.equal(current.beatUnit,"quarter-note");
  assert.equal(current.sourceQuarterBpm,96);
  assert.equal(current.oldEditionReverified,false);
  assert.match(current.independentReview,/first independent m22 reading was G5.*resolved it to A5.*not identical/);
  assert.match(current.versionDecision,/not proof that the old edition is wrong.*not recovered or reverified/);
  assert.match(current.timebaseDecision,/does not mean that half/);
  assert.deepEqual(review.historicalReviewNotes,archive.sourceFeatures);
  assert.deepEqual(song.sourceFeatures.unsureMeasures,[]);
  assert.equal(song.sourceFeatures.tempoStatus,"printed-quarter-note-tempo");
  assert.equal(current.publicDistributionRights,"unestablished-private-preview-only");
  assert.match(current.rightsNotice,/not permission to publish.*private preview/);
  for(const field of ["referenceListening","browserAudio","physicalKalimba"]) assert.equal(current[field],"not-performed");
});

test("archive preserves all original bytes, history and 68 attacks without UI, HTTP or precache exposure", async () => {
  assert.equal(hash(archiveBytes),archiveHash);
  assert.equal(hash(JSON.stringify(archive,null,2)+"\n"),archiveHash,"parsed original reconstructs every original byte");
  assert.equal(archive.id,song.id);
  assert.equal(archive.steps.length,68);
  assert.equal(hash(JSON.stringify(archive.steps)),"de91c080e38daa3c46e2d8d97bd343245088b70b8959900fa2dbe094811995dd");
  assert.equal(archive.bpm,80);
  assert.equal(archive.beatsPerMeasure,4);
  assert.equal(archive.defaultSpeedFactor,.9);
  assert.deepEqual(archive.steps.at(-1),["D5",60,4]);
  assert.equal(review.archivedEdition.file,archivePath);
  assert.equal(review.archivedEdition.fileSha256,archiveHash);
  assert.equal(current.archiveImportPath,undefined);
  assert.equal(getSongArchiveDownload(song),null);
  const files=await readSongFiles();
  assert.equal(files.filter(({song:item})=>item.id===song.id).length,1);
  assert.ok(files.every(({fileName})=>fileName!=="ju-ci-lang-de-xia-tian-v2.4.25.json"));
  assert.ok(files.every(({song:item})=>item.baseSongId!==song.id),"do not invent an accompaniment sibling");
  for(const file of ["service-worker.js","serve-kalimba.js","src/app.js","src/song-library.js"]) {
    assert.ok(!(await read(file)).toString().includes("ju-ci-lang-de-xia-tian-v2.4.25.json"),`${file} must not expose or precache archive`);
  }
});

test("actual importer and storage recover the historical song separately and allow byte reconstruction after documented normalization", () => {
  withIsolatedStorage(() => {
    const library=getSongLibrary();
    const previousIds=getPracticeSongs(library).map(({id})=>id).sort();
    library[song.id]=normalized(song); // Valid before the lead regenerates src/songs.js.
    const before=JSON.stringify(library);
    assert.equal(previousIds.length,37);
    assert.deepEqual(getPracticeSongs(library).map(({id})=>id).sort(),previousIds);
    const [restored]=parseImportedSongs(archiveBytes.toString(),library);
    assert.deepEqual(restored.steps,archive.steps);
    assert.deepEqual(restored.sourceFeatures,review.historicalReviewNotes);
    assert.equal(restored.source,"local");
    assert.equal(restored.schemaVersion,2);
    assert.notEqual(restored.id,song.id);
    assert.notEqual(restored.baseSongId,song.id);
    assert.equal(restored.bpm,80);
    assert.equal(restored.beatsPerMeasure,4);
    assert.equal(restored.defaultSpeedFactor,.9);
    assert.equal(getPracticeTotalBeats(restored.events,restored),64);
    saveCustomSongs([restored]);
    const [saved]=getCustomSongs();
    assert.deepEqual(saved.steps,archive.steps);
    assert.deepEqual(saved.sourceFeatures,archive.sourceFeatures);
    const normalizedFields=new Set(["schemaVersion","id","uploader","practiceTitle","scoreTitle"]);
    const reconstructed=Object.fromEntries(Object.keys(archive).map(key=>[key,normalizedFields.has(key)?archive[key]:saved[key]]));
    assert.equal(hash(JSON.stringify(reconstructed,null,2)+"\n"),archiveHash,
      "only explicit identity/schema/display normalization is reversed; parsed music and provenance reconstruct old bytes");
    assert.equal(JSON.stringify(library),before);
    assert.equal(library[song.id].steps.length,61);
    const merged={...library,[restored.id]:restored};
    assert.equal(getPracticeSongs(merged).length,38);
    assert.equal(getPracticeSongId(merged,restored.id),restored.id);
    const [again]=parseImportedSongs(archiveBytes.toString(),merged);
    assert.notEqual(again.id,restored.id);
    assert.deepEqual(again.steps,archive.steps);
    assert.ok(restored.events.every(event=>event.notes.length===1 && event.notes[0].role==="melody" && event.notes[0].judge));
    const [selectedImport]=parseImportedSongs(JSON.stringify(song),merged);
    assertSelectedEdition(selectedImport);
    assert.deepEqual(selectedImport.sourceFeatures,song.sourceFeatures);
    assert.equal(getPracticeTotalBeats(selectedImport.events,selectedImport),32);
  });
});

test("unfolded source ties explain the shared 68 pitch heads while six rhythm differences remain edition-specific", () => {
  const byBeat=new Map(tieDecisions.map(([,name,beat,first,second])=>[beat,[[name,beat,first],[name,beat+first,second]]]));
  const unfolded=song.steps.flatMap(step=>byBeat.get(step[1])??[step]);
  const halvedOld=archive.steps.map(([name,beat,duration])=>[name,beat/2,duration/2]);
  assert.equal(unfolded.length,68);
  assert.deepEqual(unfolded.map(([name])=>name),halvedOld.map(([name])=>name));
  const different=unfolded.filter((step,index)=>JSON.stringify(step)!==JSON.stringify(halvedOld[index]));
  assert.equal(different.length,6);
  assert.deepEqual(different.map(([,beat])=>beat),[20,20.5,20.75,24,24.5,24.75]);
  assert.equal(hasMatchingPracticeMelody(song,archive),false);
  assert.equal(hasMatchingPracticeMelody(song,{...archive,bpm:96,beatsPerMeasure:2}),false);
});

const mutations={
  "ledger-A5-wrong-G5":value=>{value.steps.find(([,beat])=>beat===28.5)[0]="G5";},
  "local-octave-fold":value=>{value.steps.find(([,beat])=>beat===28.5)[0]="A4";},
  "split-confirmed-tie":value=>{const i=value.steps.findIndex(([,beat])=>beat===2.75);value.steps.splice(i,1,["C5",2.75,.25],["C5",3,1]);},
  "merge-real-repeat":value=>{const i=value.steps.findIndex(([,beat])=>beat===2.5);value.steps.splice(i,2,["C5",2.5,1.5]);},
  "erase-opening-rest":value=>{value.steps[0][1]=0;value.steps[0][2]=1.25;},
  "fill-short-melody-rest":value=>{value.steps.find(([,beat])=>beat===20.75)[2]=.75;},
  "borrow-old-m18-rhythm":value=>{value.steps.find(([,beat])=>beat===20)[2]=.25;value.steps.find(([,beat])=>beat===20.5)[1]=20.25;const c=value.steps.find(([,beat])=>beat===20.75);c[1]=20.5;c[2]=.5;},
  "invent-final-extension":value=>{value.sourceFeatures.sourceTotalBeats=34;},
  "retain-old-tempo":value=>{value.bpm=80;},
  "retain-old-meter":value=>{value.beatsPerMeasure=4;}
};
for(const [label,mutate] of Object.entries(mutations)) {
  test(`frozen source decisions reject ${label}`,()=>{
    const changed=structuredClone(song);mutate(changed);
    assert.throws(()=>assertSelectedEdition(changed));
  });
}

// The private source-authored fixture was made from actual notation before the
// candidate/production file. Optional explicit path keeps the full glyph/attack
// record out of source packages. An unavailable fixture is SKIPPED, never a
// fabricated independent pass. Public hash/mutation checks still always run.
const sourceEvidencePath=process.env.SUMMER_SOURCE_EVIDENCE_PATH;
test("explicit private source fixture independently matches all 61 attacks across 16 spans",{skip:!sourceEvidencePath},async()=>{
  const bytes=await readFile(sourceEvidencePath);
  assert.equal(hash(bytes),sourceFixtureHash,"fixture is the pre-edit source-authored record");
  const evidence=JSON.parse(bytes);
  assert.equal(evidence.songId,"summer-eop5457-first-theme-candidate");
  assert.equal(evidence.source.reference,sourceUrl);
  assert.equal(evidence.melodySpans.length,16);
  assert.equal(hash(JSON.stringify(evidence.melodySpans.flatMap(({attacks})=>attacks))),tupleHash);
  const mapped={...evidence,songId:song.id}; // Identity change only; no expected tuple comes from production.
  assert.equal(checkTranscriptionEvidence(song,mapped).checkedAttacks,61);
  assert.equal(evidence.source.printedMeter,`${song.beatsPerMeasure}/4`);
  assert.equal(evidence.source.printedTempo.bpm,song.bpm);
  assert.deepEqual(evidence.melodyRestWindows.map(({beat,duration})=>[beat,duration]),rests);
  for(const [label,mutate] of Object.entries(mutations)) {
    const changed=structuredClone(song);mutate(changed);
    assert.throws(()=>{
      checkTranscriptionEvidence(changed,mapped);
      assert.equal(changed.bpm,evidence.source.printedTempo.bpm);
      assert.equal(`${changed.beatsPerMeasure}/4`,evidence.source.printedMeter);
    },label);
  }
});
