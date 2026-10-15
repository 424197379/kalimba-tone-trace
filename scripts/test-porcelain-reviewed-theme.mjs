import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { getCustomSongs, getPracticeSongs, getPracticeSongId, getSongArchiveDownload,
  getSongLibrary, hasMatchingPracticeMelody, parseImportedSongs, saveCustomSongs } from "../src/song-store.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const song = JSON.parse(await read("data/songs/qing-hua-ci.json"));
const archivePath = "data/archives/qing-hua-ci-v2.4.19.json";
const archiveBytes = await read(archivePath);
const archive = JSON.parse(archiveBytes);
const archiveHash = "ae805daffe79f68916a8c88afe0b931b45fd14ec6bc65eb06761c7993e918b21";
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const sourceUrl = "https://www.everyonepiano.cn/Number-1676.html";

// Hand-entered from the independent pre-edit source-pixel reading of EOP #1676
// m25–40, then checked against all four numbered and five staff crops. Never
// generated from production JSON. Each repeated occurrence was read separately.
// Coordinates below are excerpt-global quarter beats; source beat 96 is zero.
const bars = [
  [["G5",2.5,.5],["G5",3,.5],["E5",3.5,.5]],
  [["D5",4,.5],["E5",4.5,.5],["A4",5,1],["D5",6,.5],["E5",6.5,.5],["G5",7,.5],["E5",7.5,.5]],
  [["D5",8,2],["G5",10.5,.5],["G5",11,.5],["E5",11.5,.5]],
  [["D5",12,.5],["E5",12.5,.5],["G4",13,1],["D5",14,.5],["E5",14.5,.5],["G5",15,.5],["D5",15.5,.5]],
  [["C5",16,2],["C5",18.5,.5],["D5",19,.5],["E5",19.5,.5]],
  [["G5",20,.5],["A5",20.5,.5],["G5",21,.5],["E5",21.5,.5],["G5",22,.5],["E5",22.5,.5],["E5",23,.5],["D5",23.5,.5]],
  [["D5",24,2],["C5",26.5,.5],["D5",27,.5],["C5",27.5,.5]],
  [["D5",28,1],["C5",29,.5],["D5",29.5,1],["E5",30.5,1],["G5",31.5,.5]],
  [["G5",32,.5],["E5",32.5,1.5],["G5",34.5,.5],["G5",35,.5],["E5",35.5,.5]],
  [["D5",36,.5],["E5",36.5,.5],["A4",37,1],["D5",38,.5],["E5",38.5,.5],["G5",39,.5],["E5",39.5,.5]],
  [["D5",40,2],["G5",42.5,.5],["G5",43,.5],["E5",43.5,.5]],
  [["D5",44,.5],["E5",44.5,.5],["G4",45,1],["D5",46,.5],["E5",46.5,.5],["G5",47,.5],["D5",47.5,.5]],
  [["C5",48,2],["C5",50.5,.5],["D5",51,.5],["E5",51.5,.5]],
  [["G5",52,.5],["A5",52.5,.5],["G5",53,.5],["E5",53.5,.5],["G5",54,.5],["E5",54.5,.5],["E5",55,.5],["D5",55.5,.5]],
  [["D5",56,1],["G4",57.5,.5],["E5",58,1],["D5",59,.5],["D5",59.5,1]],
  [["C5",60.5,3.5]]
];
const expected = bars.flat();
const melodyRests = [[0,2.5],[10,.5],[18,.5],[26,.5],[34,.5],[42,.5],[50,.5],[57,.5]];
const phrase = (from, to) => song.steps.filter(([, beat]) => beat >= from && beat < to);
const evidence = {
  songId: "qing-hua-ci",
  source: { reference: sourceUrl, scope: "Explicit single-note piano upper staff m25–40 only, no transposition." },
  melodySpans: [{ from: 0, to: 64, attacks: expected }],
  // No all-layer silence assertion: source lower-staff accompaniment is omitted.
  sourceTotalBeats: 64,
  pitchFit: { sourcePitchClasses: [0,2,4,7,9], semitoneShift: 0 }
};
const eventsFor = steps => steps.map(([name, beat, duration]) => ({
  beat, duration, notes: [{ name, role: "melody", judge: true }]
}));
const normalized = value => ({ ...structuredClone(value), baseSongId: value.id,
  arrangementKind: "melody", judgementMode: "melody", source: "system", events: eventsFor(value.steps) });
const spanInside = ([, beat, duration], start, end) => Math.max(0, Math.min(end,beat + duration) - Math.max(start,beat));
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function withIsolatedStorage(run) {
  const before = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,String(value)) };
  try { return run(values); }
  finally { if (before === undefined) delete globalThis.localStorage; else globalThis.localStorage = before; }
}

test("all 83 independently source-authored tuples describe the selected piano theme", () => {
  assert.equal(expected.length, 83);
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.id, "qing-hua-ci");
  assert.deepEqual(song.steps, expected);
  assert.equal(song.title, "《青花瓷》（主题短版）");
  assert.equal(song.practiceTitle, `${song.title}练习轨道`);
  assert.equal(song.scoreTitle, `${song.title}简谱进度`);
  assert.match(song.hint, /EOP简易钢琴谱第25–40小节.*上声部.*83.*64/);
  assert.match(song.hint, /96 BPM.*谱面/);
  assert.match(song.hint, /同音连拨.*跳进/);
  assert.doesNotMatch(song.hint, /旧版|还原|完整人声|更简单|更好听/);
  assert.equal(checkTranscriptionEvidence(song, evidence).checkedAttacks, 83);
});

test("every adopted bar preserves its internal onset, rest and cross-bar tie accounting", () => {
  assert.equal(song.beatsPerMeasure, 4);
  for (const [index, attacks] of bars.entries()) {
    const start = index * 4, end = start + 4;
    assert.deepEqual(phrase(start,end), attacks, `source m${index + 25}`);
    const sounding = song.steps.reduce((sum, step) => sum + spanInside(step,start,end), 0);
    const resting = melodyRests.reduce((sum,[beat,duration]) => sum + spanInside([null,beat,duration],start,end),0);
    assert.equal(sounding + resting, 4, `source m${index + 25} must include incoming/outgoing tie spans`);
  }
  assert.equal(song.sourceFeatures.sourceMeasureCount,16);
  assert.deepEqual(current.sourceMeasureRange,[25,40]);
  assert.deepEqual(current.sourceBeatRange,[96,160]);
  assert.equal(current.sourceToExcerptBeatOffset,-96);
  assert.equal(current.pickupBeats,0,"retain the first full bar and its written rest");
  assert.equal(current.repeatExpansion,"none-all-selected-bars-written-out");
  assert.equal(song.sourceFeatures.hasRepeats,false);
  assert.deepEqual(current.reviewedBeatRanges,[[0,64]]);
});

test("three ties stay single attacks and the neighboring same-pitch repetitions remain separate", () => {
  assert.deepEqual(current.ties.map(({ mergedAttack }) => mergedAttack), [["D5",29.5,1],["D5",59.5,1],["C5",60.5,3.5]]);
  assert.deepEqual(current.ties.map(({ segments }) => segments), [
    [["D5",29.5,.5],["D5",30,.5]],
    [["D5",59.5,.5],["D5",60,.5]],
    [["C5",60.5,1.5],["C5",62,2]]
  ]);
  for (const beat of [30,60,62]) assert.equal(song.steps.some(([, onset]) => onset === beat),false);
  assert.deepEqual(phrase(31.5,32.5),[["G5",31.5,.5],["G5",32,.5]]);
  assert.deepEqual(phrase(59,60.5),[["D5",59,.5],["D5",59.5,1]]);
  assert.deepEqual(phrase(22.5,23.5),[["E5",22.5,.5],["E5",23,.5]]);
  assert.deepEqual(phrase(54.5,55.5),[["E5",54.5,.5],["E5",55,.5]]);
  assert.deepEqual(song.steps.at(-1),["C5",60.5,3.5]);
  assert.equal(song.sourceFeatures.sourceTotalBeats,64);
  assert.equal(getPracticeTotalBeats(eventsFor(song.steps),song),64);
  assert.equal(current.endingRestBeats,0);
});

test("all eight rests are melody-only evidence, with six rest beats in the melody-only source", () => {
  assert.deepEqual(current.melodyRestWindows.map(({ beat,duration }) => [beat,duration]),melodyRests);
  assert.equal(melodyRests.reduce((sum,[,duration]) => sum + duration,0),6);
  assert.equal(current.melodyRestScope,"upper-staff-only-lower-source-accompaniment-omitted");
  assert.equal(current.silentWindows,undefined,"do not relabel these as written all-layer silence");
  const actualGaps = [];
  let cursor = 0;
  for (const [,beat,duration] of song.steps) {
    assert.ok(beat >= cursor,"no overlapping single-note targets");
    if (beat > cursor) actualGaps.push([cursor,beat-cursor]);
    cursor = beat + duration;
  }
  assert.deepEqual(actualGaps,melodyRests);
  for (const field of ["events","rhythm","autoAccompaniment","practiceAccompaniment"]) assert.equal(song[field],undefined);
});

test("no-transposition G4–A5 fit does not lower the retained hard difficulty", () => {
  const allowed = new Set(DISPLAY_KEYS.map(({name}) => name));
  const pitch = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  const midi = name => 12 * (Number(name.slice(1)) + 1) + pitch[name[0]];
  for (const [name] of song.steps) assert.ok(allowed.has(name));
  assert.deepEqual([...new Set(song.steps.map(([name]) => name))].sort(),["A4","A5","C5","D5","E5","G4","G5"]);
  assert.deepEqual([...new Set(song.steps.map(([name]) => pitch[name[0]]))].sort((a,b)=>a-b),[0,2,4,7,9]);
  const range = steps => [Math.min(...steps.map(([name]) => midi(name))),Math.max(...steps.map(([name]) => midi(name)))];
  const fastest = steps => Math.min(...steps.slice(1).map(([,beat],i) => beat - steps[i][1]));
  const jump = steps => Math.max(...steps.slice(1).map(([name],i) => Math.abs(midi(name)-midi(steps[i][0]))));
  assert.deepEqual(range(song.steps),[67,81]);
  assert.deepEqual(range(song.steps),range(archive.steps));
  assert.equal(fastest(song.steps),.5);
  assert.equal(fastest(archive.steps),.5);
  assert.equal(jump(song.steps),9);
  assert.equal(jump(archive.steps),9);
  assert.equal(song.difficulty,"hard");
  assert.equal(song.difficulty,archive.difficulty);
  assert.equal(song.key,"C");
  assert.equal(song.tuning,"21-key-c");
  assert.equal(current.transpositionSemitones,0);
  assert.deepEqual(current.sourceRange,["G4","A5"]);
  assert.deepEqual(current.compiledRange,["G4","A5"]);
  assert.deepEqual(current.melodyAccidentals,[]);
  assert.deepEqual(current.localPitchAlterations,[]);
  assert.equal(current.octaveFolding,false);
  assert.equal(song.sourceFeatures.suitability.status,"conditional");
  assert.match(song.sourceFeatures.suitability.reason,/更短.*不代表.*简单/);
});

test("new source identity and printed tempo never recertify the absent historical photo", () => {
  assert.equal(current.status,"reviewed-selected-piano-theme-excerpt");
  assert.equal(current.adoptedInVersion,"2.4.20");
  assert.equal(current.selectedEdition,"eop-1676-simple-piano-upper-staff-m25-40");
  assert.equal(current.sourceUrl,sourceUrl);
  assert.equal(current.sourceVoice,"explicit-monophonic-upper-staff");
  assert.equal(current.vocalLineCertified,false);
  assert.equal(current.parallelExportsAreIndependentSources,false);
  assert.equal(current.oldEditionReverified,false);
  assert.match(current.versionDecision,/not proof that the old edition is wrong/);
  assert.match(review.historicalEditionStatus,/missing.*highest-note.*unresolved/);
  assert.deepEqual(song.sourceFeatures.sources.map(({url})=>url),[sourceUrl,"https://www.everyonepiano.cn/Stave-1676.html"]);
  assert.equal(song.sourceFeatures.arranger,undefined,"the historical arranger is not this new edition's credit");
  assert.equal(song.bpm,96);
  assert.equal(current.sourceQuarterBpm,96);
  assert.equal(archive.bpm,94);
  assert.equal(song.sourceFeatures.tempoStatus,"printed-quarter-note-tempo");
  assert.equal(song.defaultSpeedFactor,archive.defaultSpeedFactor);
  assert.equal(song.defaultSpeedFactor,1);
  assert.equal(current.publicDistributionRights,"unestablished-local-preview-only");
  assert.match(current.rightsNotice,/禁止转载/);
  for (const field of ["referenceListening","browserAudio","physicalKalimba"]) assert.equal(current[field],"not-performed");
});

test("the 131-note historical edition remains byte-identical and its first 42 tuples agree locally", async () => {
  assert.equal(hash(archiveBytes),archiveHash);
  assert.equal(archive.id,song.id);
  assert.equal(archive.title,"《青花瓷》");
  assert.equal(archive.steps.length,131);
  assert.equal(archive.sourceFeatures.sourceTotalBeats,96);
  assert.deepEqual(archive.steps.at(-1),["C5",91.5,4.5]);
  assert.equal(archive.sourceFeatures.arranger,"羊阿宝工作室");
  assert.match(archive.sourceFeatures.unsupported.join(" "),/最高音/);
  assert.deepEqual(song.steps.slice(0,42),archive.steps.slice(0,42));
  assert.equal(phrase(0,32).length,42);
  assert.equal(archive.steps.filter(([,beat])=>beat>=32).length,89);
  assert.equal(phrase(32,64).length,41);
  assert.notDeepEqual(song.steps.slice(42),archive.steps.slice(42));
  assert.equal(review.archivedEdition.file,archivePath);
  assert.equal(review.archivedEdition.fileSha256,archiveHash);
  assert.equal(current.archiveImportPath,undefined);
  assert.equal(getSongArchiveDownload(song),null);
  const files = await readSongFiles();
  assert.equal(files.filter(({song:item})=>item.id===song.id).length,1);
  assert.ok(files.every(({fileName})=>fileName!=="qing-hua-ci-v2.4.19.json"));
  assert.ok(files.every(({song:item})=>item.id!=="qing-hua-ci-chord"));
  assert.deepEqual(files.filter(({song:item})=>item.schemaVersion===2 && item.baseSongId===song.id).map(({song:item})=>item.id),["qing-hua-ci-reviewed-support"],"only the later explicitly matching support companion exists; no old V2 is invented");
  for (const file of ["service-worker.js","serve-kalimba.js","src/song-library.js","src/app.js"]) {
    assert.ok(!(await read(file)).toString().includes("qing-hua-ci-v2.4.19.json"),`${file} must not expose/precache the archive`);
  }
});

test("actual archive import and simulated save keep the selected card independent and all 36 canonical cards intact", () => {
  withIsolatedStorage(() => {
    const library = getSongLibrary();
    const previousIds = getPracticeSongs(library).map(({id})=>id).sort();
    const selected = deepFreeze(normalized(song));
    library[song.id] = selected; // Allows data regression before lead rebuilds generated src/songs.js.
    const before = JSON.stringify(library);
    assert.equal(previousIds.length,36);
    assert.deepEqual(getPracticeSongs(library).map(({id})=>id).sort(),previousIds);
    assert.equal(getPracticeSongId(library,song.id),song.id);
    const [restored] = parseImportedSongs(archiveBytes.toString(),library);
    assert.deepEqual(restored.steps,archive.steps);
    assert.deepEqual(restored.sourceFeatures,archive.sourceFeatures);
    assert.equal(restored.title,archive.title);
    assert.equal(restored.bpm,94);
    assert.equal(restored.defaultSpeedFactor,archive.defaultSpeedFactor);
    assert.equal(restored.sourceFeatures.sourceTotalBeats,96);
    assert.equal(restored.source,"local");
    assert.notEqual(restored.id,selected.id);
    assert.notEqual(restored.baseSongId,selected.id);
    assert.equal(restored.schemaVersion,2);
    saveCustomSongs([restored]);
    const [saved] = getCustomSongs();
    assert.deepEqual(saved.steps,archive.steps);
    assert.deepEqual(saved.sourceFeatures,archive.sourceFeatures);
    assert.equal(JSON.stringify(library),before);
    assert.equal(library[song.id].steps.length,83);
    const merged = {...library,[restored.id]:restored};
    assert.equal(getPracticeSongs(merged).length,37);
    assert.equal(getPracticeSongId(merged,restored.id),restored.id);
    const [again] = parseImportedSongs(archiveBytes.toString(),merged);
    assert.notEqual(again.id,restored.id);
    assert.deepEqual(again.steps,archive.steps);
    assert.ok(restored.events.every(event=>event.notes.length===1 && event.notes[0].role==="melody" && event.notes[0].judge));
  });
});

test("actual strict compatibility rejects historical timing independently of later matching support", () => {
  assert.equal(hasMatchingPracticeMelody(song,song),true);
  assert.equal(hasMatchingPracticeMelody(song,archive),false);
  assert.equal(hasMatchingPracticeMelody(song,{...archive,bpm:96}),false,"tempo normalization cannot hide different form");
  const identicalMelodyOldTempo = {...structuredClone(song),bpm:94};
  assert.equal(hasMatchingPracticeMelody(song,identicalMelodyOldTempo),false);
  const oldExtent = structuredClone(song);
  oldExtent.sourceFeatures.sourceTotalBeats = 96;
  assert.equal(hasMatchingPracticeMelody(song,oldExtent),false);
  for (const field of ["autoAccompaniment","practiceAccompaniment"]) assert.equal(archive[field],undefined);
  const oldV2 = {...structuredClone(archive),schemaVersion:2,events:eventsFor(archive.steps)};
  assert.equal(hasMatchingPracticeMelody(song,oldV2),false,"synthetic old V2 is only a strict guard fixture, not a real source");
});

const mutations = {
  "split-m32-tie": value => { const i=value.steps.findIndex(([,beat])=>beat===29.5); value.steps.splice(i,1,["D5",29.5,.5],["D5",30,.5]); },
  "split-crossbar-tie": value => { const i=value.steps.findIndex(([,beat])=>beat===59.5); value.steps.splice(i,1,["D5",59.5,.5],["D5",60,.5]); },
  "retrigger-final-tie": value => { const i=value.steps.findIndex(([,beat])=>beat===60.5); value.steps.splice(i,1,["C5",60.5,1.5],["C5",62,2]); },
  "merge-independent-repeat": value => { const i=value.steps.findIndex(([,beat])=>beat===59); value.steps.splice(i,2,["D5",59,1.5]); },
  "copy-m25-into-m33": value => { value.steps=value.steps.filter(([,beat])=>beat<32 || beat>=36).concat([["G5",34.5,.5],["G5",35,.5],["E5",35.5,.5]]).sort((a,b)=>a[1]-b[1]); },
  "erase-opening-rest": value => value.steps.unshift(["C5",0,2.5]),
  "fold-high-A5-locally": value => { value.steps.find(([name])=>name==="A5")[0]="A4"; }
};
for (const [label,mutate] of Object.entries(mutations)) {
  test(`independent source fixture rejects ${label}`, () => {
    const changed = structuredClone(song);
    mutate(changed);
    assert.throws(()=>checkTranscriptionEvidence(changed,evidence));
  });
}
