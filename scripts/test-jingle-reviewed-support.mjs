import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { readSongFiles } from "./build-song-library.mjs";
import { NOTE_INDEX } from "../src/songs.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { getPracticeSongs, getPracticeSongId, getSongBaseId, getSongVersionRank,
  getSongAccompanimentProvider, hasMatchingPracticeMelody, parseImportedSongs } from "../src/song-store.js";
import { readSongAccompaniment, saveSongAccompaniment } from "../src/practice-preferences.js";

const read = file => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
const plain = value => JSON.parse(JSON.stringify(value));
const melodyBytes = await read("data/songs/ling-er-xiang-ding-dang.json");
const legacyBytes = await read("data/songs/ling-er-xiang-ding-dang-chord.json");
const archiveBytes = await read("data/archives/ling-er-xiang-ding-dang-v2.4.15.json");
const melody = JSON.parse(melodyBytes);
const legacy = JSON.parse(legacyBytes);
const song = JSON.parse(await read("data/songs/ling-er-xiang-ding-dang-reviewed-support.json"));
const review = song.sourceFeatures.practiceAccompaniment;
const melodyHash = "08ef07a4891bb24811c232a2237a7885a3fd43b98d9ef8b2d8507c83130726ef";
const blockHash = "4a81081cf6a430d8e85ab4fc9380b7f22e01dbc68b027dcc572c730530a632ef";
const overlap = (a, b) => a.beat < b.beat + b.duration && a.beat + a.duration > b.beat;
const pitchClass = note => note.replace(/\d+$/, "");
const midi = note => 12 * (Number(note.at(-1)) + 1) + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[note[0]]);

// Bounded independent pixel-review decisions, not a pattern inferred from title
// or old app accompaniment. Similar later bars and both cadences were read anew.
const printed = [
  [1,1,0,"G","C"], [2,1,4,"G","C"], [3,1,8,"G","C"], [3,3,10,"C","F"],
  [4,1,12,"G","C"], [5,1,16,"C","F"], [6,1,20,"G","C"], [7,1,24,"A7","D7"], [8,1,28,"D","G"],
  [9,1,32,"G","C"], [10,1,36,"G","C"], [11,1,40,"G","C"], [11,3,42,"C","F"],
  [12,1,44,"G","C"], [13,1,48,"C","F"], [14,1,52,"G","C"], [15,1,56,"D7","G7"], [16,1,60,"G","C"]
];
const sourceIntervals = [
  [0,10,"C"], [10,2,"F"], [12,4,"C"], [16,4,"F"], [20,4,"C"], [24,4,"D7"], [28,4,"G"],
  [32,10,"C"], [42,2,"F"], [44,4,"C"], [48,4,"F"], [52,4,"C"], [56,4,"G7"], [60,4,"C"]
].map(([beat, duration, symbol]) => ({ beat, duration, symbol }));
const chordTones = { C: ["C","E","G"], F: ["F","A","C"], D7: ["D","F#","A","C"],
  G: ["G","B","D"], G7: ["G","B","D","F"] };
const roots = { C: "C4", F: "F3", D7: "D4", G: "G3", G7: "G3" };
const expectedSupport = [
  ["C4",0,.75], ["C4",4,.75], ["C4",8,.75], ["C4",12,.75],
  ["F3",16,.75], ["C4",20,.75], ["D4",24,.75], ["G3",28,.75],
  ["C4",32,.75], ["C4",36,.75], ["C4",40,.75], ["C4",44,.75],
  ["F3",48,.75], ["C4",52,.75], ["G3",56,.75], ["C4",60,.75]
];
const bars = [
  [["E5",0,1],["E5",1,1],["E5",2,2]], [["E5",0,1],["E5",1,1],["E5",2,2]],
  [["E5",0,1],["G5",1,1],["C5",2,1],["D5",3,1]], [["E5",0,4]],
  [["F5",0,1],["F5",1,1],["F5",2,1],["F5",3,1]], [["F5",0,1],["E5",1,1],["E5",2,1],["E5",3,.5],["E5",3.5,.5]],
  [["E5",0,1],["D5",1,1],["D5",2,1],["E5",3,1]], [["D5",0,2],["G5",2,2]],
  [["E5",0,1],["E5",1,1],["E5",2,2]], [["E5",0,1],["E5",1,1],["E5",2,2]],
  [["E5",0,1],["G5",1,1],["C5",2,1],["D5",3,1]], [["E5",0,4]],
  [["F5",0,1],["F5",1,1],["F5",2,1],["F5",3,1]], [["F5",0,1],["E5",1,1],["E5",2,1],["E5",3,.5],["E5",3.5,.5]],
  [["G5",0,1],["G5",1,1],["F5",2,1],["D5",3,1]], [["C5",0,4]]
];
const expectedMelody = bars.flatMap((bar, index) => bar.map(([name, beat, duration]) => [name, index * 4 + beat, duration]));
const melodyTuples = entry => entry.events.map(e => [e.notes.find(n => n.role === "melody").name, e.beat, e.duration]);
function gaps(steps) {
  const result = [];
  let end = 0;
  for (const [, beat, duration] of steps) {
    if (beat > end) result.push({ beat: end, duration: beat - end });
    end = Math.max(end, beat + duration);
  }
  if (end < 64) result.push({ beat: end, duration: 64 - end });
  return result;
}
function checkSourceSpan(event) {
  const intervals = sourceIntervals.filter(s => overlap(event, s));
  let covered = 0;
  for (const interval of intervals) {
    assert.ok(chordTones[interval.symbol].includes(pitchClass(event.notes[0].name)), "whole written span needs chord membership");
    covered += Math.min(event.beat + event.duration, interval.beat + interval.duration) - Math.max(event.beat, interval.beat);
  }
  assert.equal(covered, event.duration, "whole written duration needs source coverage");
}
function checkCandidate(block, melodySteps = melody.steps, silentWindows = []) {
  assert.equal(block.enabledByDefault, false, "support must be opt-in");
  assert.equal(block.volume, .30, "retain trial volume");
  for (const event of block.events) {
    assert.ok(Number.isFinite(event.beat) && event.beat >= 0 && Number.isFinite(event.duration) && event.duration > 0);
    assert.ok(event.beat + event.duration <= 64, "keep end64");
    assert.equal(event.notes.length, 1, "one root only");
    const note = event.notes[0];
    assert.ok(NOTE_INDEX.has(note.name), "available natural pitch required");
    assert.equal(note.role, "bass", "root is app-only bass");
    assert.equal(Object.hasOwn(note, "judge"), false, "never a physical target, including judge:false");
    assert.equal(note.velocity, .32, "retain trial velocity");
    assert.equal(event.pattern, "source-chord-root-only-candidate");
    assert.ok(![...gaps(melodySteps), ...silentWindows].some(window => overlap(event, window)), "full duration must avoid even short silence");
    for (const [name, beat, duration] of melodySteps.filter(([, b, d]) => overlap(event, { beat: b, duration: d }))) {
      assert.ok(!(name === note.name && beat === event.beat), "no same-onset same-pitch duplicate");
      assert.ok(midi(note.name) < midi(name), "root remains below active melody");
    }
    checkSourceSpan(event);
    const source = printed.find(row => row[2] === event.beat);
    assert.ok(source && source[1] === 1, "only one bar-start root; omitted changes remain omitted");
    assert.equal(note.name, roots[source[4]], "exact disclosed root register");
    assert.equal(event.duration, .75, "inferred short duration unchanged");
  }
  assert.deepEqual(block.events.map(e => [e.notes[0].name, e.beat, e.duration]), expectedSupport, "all 16 roots exact");
}

const rawSongs = (await readSongFiles()).map(({ song: entry }) => entry);
const storeText = await read("src/song-store.js");
function normalizedLibrary(entries) {
  const context = { NOTE_INDEX, SONG_LIBRARY: Object.fromEntries(entries.map(s => [s.id, s])), console,
    localStorage: { getItem: () => null, setItem() { throw new Error("no browser persistence"); } } };
  runInNewContext(storeText.replace(/^import[^\n]+\n/, "").replace(/^export /gm, ""), context);
  return context.getSongLibrary();
}
const library = normalizedLibrary(rawSongs);
const appText = await read("src/app.js");
function appContext() {
  const context = { songLibrary: library, getSongBaseId, getSongVersionRank, getSongAccompanimentProvider, hasMatchingPracticeMelody,
    NOTE_INDEX, getPracticeTotalBeats };
  for (const name of ["getSongVariants", "buildSongEvents", "getPracticeAccompanimentSource", "getPracticeAccompanimentConfig",
    "getAccompanimentConfig", "getDefaultAccompanimentEnabled", "getSongAccompanimentSignature"]) {
    const body = appText.match(new RegExp(`^    function ${name}\\([^]*?^    }`, "m"))?.[0];
    assert.ok(body, `actual app helper ${name} present`);
    runInNewContext(body, context);
  }
  return context;
}

// The selected V1 hash includes the 2.4.19 hint-only wording change, whose
// exact 2.4.18 preimage is independently locked in test-jingle-reviewed-short.
test("complete current V1, historical V2 and importable archive remain byte-exact", () => {
  assert.equal(hash(melodyBytes), "42802e264082e1ee8812b0c8110c96b31908320310999de749ec8ad07157abfc");
  assert.equal(hash(legacyBytes), "c28df5631e09a1dcce5e28fc7b32c3ec86d1ff858c2032daff9c91de888bafa8");
  assert.equal(hash(archiveBytes), "8309ad1fea7f60b373e204c2fb952b345999b9981e139b8db8c68fbc3782f9d9");
  assert.equal(legacy.events.length, 49);
  for (const field of ["events", "practiceAccompaniment", "autoAccompaniment", "rhythm"]) assert.equal(Object.hasOwn(melody, field), false);
});
test("51 independently recorded melody tuples, roles, source end and practice tempo stay exact", () => {
  assert.equal(song.schemaVersion, 2); assert.equal(song.baseSongId, melody.id);
  assert.equal(song.arrangementKind, "melody"); assert.equal(song.judgementMode, "melody");
  assert.deepEqual(melody.steps, expectedMelody); assert.deepEqual(melodyTuples(song), expectedMelody);
  assert.equal(hash(JSON.stringify(melodyTuples(song))), melodyHash);
  for (const event of song.events) assert.deepEqual(event.notes, [{ name: event.notes[0].name, role: "melody", judge: true, velocity: 1 }]);
  assert.deepEqual([song.bpm, song.defaultSpeedFactor, song.beatsPerMeasure, song.key, song.tuning], [80, .9, 4, "C", "21-key-c"]);
  assert.equal(song.sourceFeatures.sourceTotalBeats, 64); assert.deepEqual(melodyTuples(song).at(-1), ["C5",60,4]);
});
test("18 printed symbols and 14 true intervals retain m8 plain D and later D7", () => {
  assert.deepEqual(review.sourceSymbolReview.printedChordTimeline.map(x => [x.measure,x.beatInMeasure,x.beat,x.printedSymbol,x.transposedSymbol]), printed);
  assert.deepEqual(review.sourceSymbolReview.harmonicIntervals.map(({ beat,duration,symbol }) => ({ beat,duration,symbol })), sourceIntervals);
  for (const interval of review.sourceSymbolReview.harmonicIntervals) assert.deepEqual(interval.pitchClasses, chordTones[interval.symbol]);
  assert.deepEqual(review.reduction.omittedChangeBeats, [10,42]);
  assert.deepEqual(review.sourceSymbolReview.printedChordTimeline.filter(x => !x.retainedInCandidate).map(x => x.beat), [10,42]);
  assert.equal(review.sourceSymbolReview.semitoneShift, 5);
});
test("exact 16 single-root block is fully source-covered, quiet and unjudged", () => {
  checkCandidate(song.practiceAccompaniment);
  assert.equal(hash(JSON.stringify(song.practiceAccompaniment)), blockHash);
  assert.equal(review.evidenceFingerprints.candidateBlockSha256, blockHash);
  assert.equal(song.practiceAccompaniment.events.reduce((sum,e) => sum + e.duration,0),12);
  assert.equal(Object.hasOwn(song,"autoAccompaniment"),false);
  assert.deepEqual(review.reduction.rootRegister,roots);
});
test("each complete support span needs chord membership, not just a legal onset", () => {
  for (const event of song.practiceAccompaniment.events) {
    const wrong = structuredClone(event);
    const chord = sourceIntervals.find(interval => overlap(event, interval)).symbol;
    wrong.notes[0].name = ["C4", "D4", "E4", "F4", "G3", "A3", "B3"].find(note => !chordTones[chord].includes(pitchClass(note)));
    assert.throws(() => checkSourceSpan(wrong), /membership/);
  }
  const crossed = structuredClone(song.practiceAccompaniment.events[4]); crossed.duration = 4.5;
  assert.throws(() => checkSourceSpan(crossed), /membership/);
  const beyond = structuredClone(song.practiceAccompaniment.events.at(-1)); beyond.duration = 4.5;
  assert.throws(() => checkSourceSpan(beyond), /coverage/);
});
test("negative mutations cannot invent/naturalize harmony, change register, density or timeline", () => {
  const mutations = [b => b.events[6].notes[0].name="F4", b => b.events[6].notes[0].name="F#4",
    b => b.events[6].notes[0].name="D5", b => b.events[6].notes[0].name="E5", b => b.events[6].beat=23.5,
    b => b.events[7].notes[0].name="D4", b => b.events.forEach(e => e.beat/=2), b => b.events.pop(),
    b => b.events[4].duration=4.5, b => b.events.at(-1).duration=4.5,
    b => b.events[6].notes.push({name:"F4",role:"harmony",velocity:.32}),
    b => b.events.splice(3,0,{beat:10,duration:.75,pattern:"source-chord-root-only-candidate",notes:[{name:"F3",role:"bass",velocity:.32}]})];
  for (const mutate of mutations) { const changed=structuredClone(song.practiceAccompaniment); mutate(changed); assert.throws(() => checkCandidate(changed)); }
});
test("support cannot fill new short rests or become a judged/louder/default-on layer", () => {
  assert.deepEqual(song.rhythm.restWindows,[]); assert.deepEqual(gaps(melody.steps),[]);
  assert.throws(() => checkCandidate(song.practiceAccompaniment,melody.steps,[{beat:.5,duration:.1}]),/silence/);
  const shortened=structuredClone(melody.steps); shortened[0][2]=.5;
  assert.throws(() => checkCandidate(song.practiceAccompaniment,shortened),/silence/);
  for (const mutate of [b=>b.enabledByDefault=true,b=>b.volume=.34,b=>b.events[0].notes[0].velocity=.4,
    b=>b.events[0].notes[0].judge=false,b=>b.events[0].notes[0].judge=true,b=>b.events[0].notes[0].role="melody"]) {
    const changed=structuredClone(song.practiceAccompaniment); mutate(changed); assert.throws(() => checkCandidate(changed));
  }
});
test("content guard accepts this companion and rejects historical or changed melody/timebase", () => {
  assert.equal(hasMatchingPracticeMelody(melody,song),true); assert.equal(hasMatchingPracticeMelody(melody,legacy),false);
  for (const mutate of [s=>s.events[0].notes[0].name="D5",s=>s.events[0].beat=.25,s=>s.events[0].duration=.5,
    s=>s.events.pop(),s=>s.bpm=81,s=>s.sourceFeatures.sourceTotalBeats=65,s=>s.events[0].notes[0].judge=false]) {
    const changed=structuredClone(song); mutate(changed); assert.equal(hasMatchingPracticeMelody(melody,changed),false);
  }
});
test("actual normalization and deep links keep 57 source records and 36 single-melody cards", () => {
  assert.equal(Object.keys(library).length,57); assert.equal(getPracticeSongs(library).length,36);
  assert.deepEqual(plain(library[song.id].practiceAccompaniment),song.practiceAccompaniment);
  assert.deepEqual(plain(library[song.id].steps),melody.steps);
  assert.equal(getPracticeSongs(library).filter(s=>getSongBaseId(s)===melody.id).length,1);
  for (const id of [melody.id,legacy.id,song.id]) assert.equal(getPracticeSongId(library,id),melody.id);
  const reordered=normalizedLibrary([song,legacy,melody]);
  assert.deepEqual(getPracticeSongs(reordered).map(s=>s.id),[melody.id]);
  const absent=normalizedLibrary(rawSongs.filter(s=>s.id!==song.id));
  assert.equal(Object.keys(absent).length,56); assert.equal(getPracticeSongs(absent).length,36);
});
test("actual app borrows only compatible light support, never historical automatic backing", () => {
  const app=appContext(); const canonical=library[melody.id];
  assert.deepEqual(plain(app.getPracticeAccompanimentConfig(canonical)),song.practiceAccompaniment);
  assert.deepEqual(plain(app.getAccompanimentConfig(canonical,"light")),song.practiceAccompaniment);
  assert.equal(app.getAccompanimentConfig(canonical,"original"),null);
  assert.equal(app.getDefaultAccompanimentEnabled(canonical),false);
});
test("new support starts off; only exact-content saved light can be restored", () => {
  const app=appContext();const signature=app.getSongAccompanimentSignature(library[melody.id]);
  assert.equal(typeof signature,"string");assert.ok(signature.length>0);
  const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature),{});
  assert.deepEqual(saveSongAccompaniment(storage,melody.id,"light",signature),{saved:true,choice:"light"});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature),{choice:"light"});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature+"changed"),{choice:"off",stale:true});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,null),{choice:"off",stale:true});
  assert.deepEqual(saveSongAccompaniment(storage,melody.id,"off",signature),{saved:true,choice:"off"});
  assert.deepEqual(readSongAccompaniment(storage,melody.id,signature),{choice:"off"});
});
test("raw built-in import rejects the unsupported field rather than silently losing 16 roots", () => {
  assert.throws(() => parseImportedSongs(JSON.stringify(song), {}), /顶层 practiceAccompaniment.*外部导入不支持.*autoAccompaniment.*不要仅删除字段而丢失伴奏/);
});
test("existing upload representation preserves all 51 targets and 16 app-only notes without persistence", () => {
  const upload=structuredClone(song);delete upload.practiceAccompaniment;upload.autoAccompaniment=song.practiceAccompaniment;
  const imported=parseImportedSongs(JSON.stringify(upload),{});
  const importedLibrary=Object.fromEntries(imported.map(s=>[s.id,s]));
  assert.equal(getPracticeSongs(importedLibrary).length,1);
  assert.deepEqual(getPracticeSongs(importedLibrary)[0].steps,melody.steps);
  assert.deepEqual(imported.find(s=>s.autoAccompaniment).autoAccompaniment,song.practiceAccompaniment);
});
test("metadata separates source symbols, inferred voicing, accidental omission and audio boundaries", () => {
  assert.equal(song.rhythm.sourceStatus,"inferred");assert.equal(review.status,"needs-review");
  assert.equal(review.sourceVoice,"derived-chord-root-not-literal-scored-bass");
  assert.equal(review.reduction.accidentalNaturalization,false);
  assert.equal(review.reduction.completeChordFidelity,false);assert.equal(review.reduction.literalBassTranscription,false);
  assert.deepEqual(review.reduction.omittedChordPitchClasses.D7,["F#","A","C"]);
  assert.deepEqual(review.restAndEnding.breathMarksAfterMeasures,[4,8,12]);
  assert.equal(review.restAndEnding.scoreEnd,64);assert.equal(review.restAndEnding.supportWrittenEnd,60.75);
  assert.equal(review.melodyCompatibility.tupleSha256,melodyHash);assert.equal(review.historicalSibling.contentCompatible,false);
  assert.equal(review.browserAudio,"not-performed-in-data-stage");assert.equal(review.referenceListening,"not-performed");
  assert.equal(review.physicalKalimba,"not-performed");assert.match(review.acousticTailBoundary,/0\.55-second convolution/);
  assert.match(review.acousticTailBoundary,/Buffer membership alone cannot certify/);
});
