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
const id = "hong-yan", archivePath = "data/archives/hong-yan-v2.4.36.json";
const song = JSON.parse(await read(`data/songs/${id}.json`));
const archiveBytes = await read(archivePath), archive = JSON.parse(archiveBytes);
const archiveHash = "a1793a1d4108dcc926f660bf65025d3958deb44b58baf762261fe53be7234b54";
const tupleHash = "0d288e95d7729f543461ad8b76040bb69fbaca3dffc5983b8678a5d4a9e6f6ac";
const sourceFixtureHash = "42ec562af6cef38acf71ec1a4d5628eba084e237e3f50d9ec09fedf03c2eaf74";
const firstFixtureHash = "609842bb9f76cfe69b1c3a45aeda9e75d5f9bac2474e607451104e932f467ed0";
const sourceUrl = "https://lywgyxx.szftedu.cn/xkjc/yinyue/202209/P020220910587728087297.pdf";
const review = song.sourceFeatures.sourceReview, current = review.currentScopeReview;
const scope = value => value.sourceFeatures.sourceReview.currentScopeReview;
const phrase = (value, from, to) => value.steps.filter(([, b]) => b >= from && b < to);
const span = (value, from, to) => value.steps.filter(([, b, d]) => b < to && b + d > from);
const overlap = (b, d, from, to) => Math.max(0, Math.min(to, b + d) - Math.max(from, b));
const at = (value, beat) => value.steps.find(([, b]) => b === beat);
const midi = name => { const [, letter, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(name);
  return 12 * (+octave + 1) + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0); };
const eventsFor = steps => steps.map(([name, beat, duration]) => ({ beat, duration, notes: [{ name, role: "melody", judge: true }] }));
const normalized = value => ({ ...structuredClone(value), baseSongId: value.id, source: "system",
  arrangementKind: "melody", judgementMode: "melody", events: eventsFor(value.steps) });
const route = [1,2,3,4,5,6,7,8,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16];
// The second independent source-only reader froze its music before reading
// production or a candidate. These fingerprints were derived solely from that
// immutable record at test authoring, never from the production song. They
// remain constants when the suite runs.
// [printed bar, attacks starting here, attacks overlapping here, printed heads,
//  SHA256 of complete overlapping tuples with onsets relative to this bar].
const printedBarDecisions = [
  [
    1,
    5,
    5,
    5,
    "c509efaed729aa79c6044c85c00b7924ff599396d0d2adfb907989362b0ec450"
  ],
  [
    2,
    4,
    4,
    4,
    "7b383bc1c3ec1c638c5bd5f29c8d1462d61cae6c25a2150429bc23b4c80504ce"
  ],
  [
    3,
    7,
    7,
    7,
    "1303337104f6610b7c5cbfea64b9b840c22cae031a89aebee100fb017f51f840"
  ],
  [
    4,
    1,
    2,
    3,
    "ec38bebb61c8583e4af2a6ba8055d040a34ca7e1803fd408f9671e9ce7614675"
  ],
  [
    5,
    4,
    4,
    4,
    "7b383bc1c3ec1c638c5bd5f29c8d1462d61cae6c25a2150429bc23b4c80504ce"
  ],
  [
    6,
    5,
    5,
    5,
    "c509efaed729aa79c6044c85c00b7924ff599396d0d2adfb907989362b0ec450"
  ],
  [
    7,
    6,
    6,
    6,
    "aa36ba2b6088d9ccc033891692f929d45236f1d0fc46e4324125650f2a6f280e"
  ],
  [
    8,
    1,
    1,
    1,
    "7e4fdd4ce3e07da3e57aa6f72552d5b32817b55fe7cd0a5449ddb622a8d3d4c4"
  ],
  [
    9,
    4,
    4,
    4,
    "7b383bc1c3ec1c638c5bd5f29c8d1462d61cae6c25a2150429bc23b4c80504ce"
  ],
  [
    10,
    5,
    5,
    5,
    "c509efaed729aa79c6044c85c00b7924ff599396d0d2adfb907989362b0ec450"
  ],
  [
    11,
    6,
    6,
    6,
    "aa36ba2b6088d9ccc033891692f929d45236f1d0fc46e4324125650f2a6f280e"
  ],
  [
    12,
    1,
    1,
    1,
    "7e4fdd4ce3e07da3e57aa6f72552d5b32817b55fe7cd0a5449ddb622a8d3d4c4"
  ],
  [
    13,
    4,
    4,
    4,
    "7b383bc1c3ec1c638c5bd5f29c8d1462d61cae6c25a2150429bc23b4c80504ce"
  ],
  [
    14,
    5,
    5,
    5,
    "c509efaed729aa79c6044c85c00b7924ff599396d0d2adfb907989362b0ec450"
  ],
  [
    15,
    6,
    6,
    6,
    "aa36ba2b6088d9ccc033891692f929d45236f1d0fc46e4324125650f2a6f280e"
  ],
  [
    16,
    1,
    1,
    1,
    "7e4fdd4ce3e07da3e57aa6f72552d5b32817b55fe7cd0a5449ddb622a8d3d4c4"
  ]
];
// [expanded route bar, printed bar, overlapping count, absolute tuple hash].
const expandedBarDecisions = [
  [
    1,
    1,
    5,
    "c509efaed729aa79c6044c85c00b7924ff599396d0d2adfb907989362b0ec450"
  ],
  [
    2,
    2,
    4,
    "f900f6f605f8801d460ae47cd1fad587cfe533403af61cb33f6e8270dbd153f1"
  ],
  [
    3,
    3,
    7,
    "01700c913b293b490e90c07e938085e67b7dd27b7b7b6899994eebe5f23c4d5e"
  ],
  [
    4,
    4,
    2,
    "8335b2fe032fffc75acbe1297062e95ecc0c2692dda750a1352f8826e278d3d7"
  ],
  [
    5,
    5,
    4,
    "08ea3ce3f7f322bf114a09cdfc0194364ebb0596fe12a156bf3fdfcc5f41cc30"
  ],
  [
    6,
    6,
    5,
    "c14d941ac9ff92d16491f7dd596fd2ded71e77695a965536c86e5c623f5dda3e"
  ],
  [
    7,
    7,
    6,
    "6b8d70c606d2d07c7a8bbc233d95c99d63cc19bd31b2bbe2e0b041571497f96e"
  ],
  [
    8,
    8,
    1,
    "dddb7b85dc2a4a15ae6c7340efb10a360d45f2f862d148759ceb13080371cb97"
  ],
  [
    9,
    1,
    5,
    "cdd6938e87fb22d501b58c52f5b3e780872f2fb06355e27321c8fae1d38e6f59"
  ],
  [
    10,
    2,
    4,
    "2c02e49953ffd1c1851513af8b2fd0eae1552700155ed5d77701c39cb7e60d0c"
  ],
  [
    11,
    3,
    7,
    "9b7f2633b4796426b8003a7c85d457de8f497447e28b496135e2d9bcc67ef337"
  ],
  [
    12,
    4,
    2,
    "2565991837ced0fae8eb1fb36ee0bf5b29b1a1705f206b31ce27bb3014a37d3a"
  ],
  [
    13,
    5,
    4,
    "dbe40f5111eb67a02ec8f5b5c8bb6b308bec5cdb33731dd1e9a92f92413b6aa7"
  ],
  [
    14,
    6,
    5,
    "aab8390c0b5ee9a948af99d68934f1f1d58dfb9ae3b022274d8d17366dd76333"
  ],
  [
    15,
    7,
    6,
    "247067434aaddc15f64c936fc0afd07e2e250a5c610f3c2dc884304f25ba66f5"
  ],
  [
    16,
    8,
    1,
    "086694b5c9f8a534845d2b871d125d49d583d0fe4ef0afb7447ce09cb7626213"
  ],
  [
    17,
    9,
    4,
    "7b301d5681ed292ccba33b86957febd67b6a710214c5f09dc17282cc5aec81e0"
  ],
  [
    18,
    10,
    5,
    "f3dac498c45963d64ce959b0acd6310edf9ab9d11b26d18165252babc046c271"
  ],
  [
    19,
    11,
    6,
    "925e85a6d3419b483ac3570fdfde55121ee2fc7e52c59a045f42437c2e4cbee1"
  ],
  [
    20,
    12,
    1,
    "4e52c5fb084cd891386a40f058c27f1da74d712479aa69556ad286e6220cf48b"
  ],
  [
    21,
    13,
    4,
    "70998da63b75317d76b9ca6431cb2517b6106149fb018aed4afe3c88c98afe24"
  ],
  [
    22,
    14,
    5,
    "b7a23725b426887dd8bc2b7f27ef64b95247fabdc29f2214743e7d9c82bdbb53"
  ],
  [
    23,
    15,
    6,
    "4cd71da6f571f7a160ac537fde18b91869414eb88351237a769fdf052dbaef02"
  ],
  [
    24,
    16,
    1,
    "926e4f1c7f5670b8e9128d5d1eb762c1c6eba553dd174c665d10415a70e8d8ff"
  ]
];
const sourceMidiTupleHash = "2d07d0356d78af4886f14367db6c17f1c8e438d8e414a0837c95d03d4e95ee77";
const ties = [
  { sourceHeads: ["m3.n7", "m4.n1"], routeMeasures: [3,4], note: "E4", beat: 11.5, duration: 1 },
  { sourceHeads: ["m4.n2", "m4.n3"], routeMeasures: [4,4], note: "D4", beat: 12.5, duration: 3.5 },
  { sourceHeads: ["m3.n7", "m4.n1"], routeMeasures: [11,12], note: "E4", beat: 43.5, duration: 1 },
  { sourceHeads: ["m4.n2", "m4.n3"], routeMeasures: [12,12], note: "D4", beat: 44.5, duration: 3.5 }
];
const ornaments = [[7,7,27],[8,8,28],[7,15,59],[8,16,60],[11,19,75],[12,20,76],[15,23,91],[16,24,92]].map(([sourceMeasure, routeMeasure, beat], i) => ({
  sourceMeasure, routeMeasure, beat, sourcePitches: i % 2 ? ["D4","E4","D4"] : ["B3"],
  compiledPitches: i % 2 ? ["C4","D4","C4"] : ["A3"], principalPitch: i % 2 ? "A3" : "E4",
  principalDuration: i % 2 ? 4 : 1, duration: null, decision: "omit-unquantified-grace-without-stealing-main-note-time"
}));
const fermata = { sourceMeasure: 15, sourceHead: 6, routeMeasure: 23, note: "E4", beat: 91,
  writtenDuration: 1, sourceExtraDuration: null, addedPracticeBeats: 0, decision: "fixed-beat-practice-with-no-extra-fermata-time" };
function assertSelectedEdition(value) {
  assert.equal(value.steps.length, 98);
  assert.equal(hash(JSON.stringify(value.steps)), tupleHash, "all independently source-authored principal tuples");
  assert.equal(value.bpm, 56); assert.equal(value.defaultSpeedFactor, 1); assert.equal(value.difficulty, "easy");
  assert.equal(value.beatsPerMeasure, 4); assert.equal(value.key, "C"); assert.equal(value.tuning, "21-key-c");
  assert.equal(value.sourceFeatures.sourceTotalBeats, 96); assert.equal(value.sourceFeatures.sourceMeasureCount, 24);
  assert.equal(value.sourceFeatures.sourceKey, "D"); assert.equal(value.sourceFeatures.transpositionSemitones, -2);
  const s = scope(value);
  assert.equal(s.status, "reviewed-selected-school-fixed-beat-edition");
  assert.deepEqual(s.sourceMeasureRange, [1,16]); assert.deepEqual(s.reviewedBeatRanges, [[0,96]]);
  assert.deepEqual(s.expandedSourceMeasures, route); assert.equal(s.distinctPrintedMelodyMeasures, 16);
  assert.equal(s.expandedMeasureCount, 24); assert.equal(s.printedMetricNoteheadCount, 67);
  assert.equal(s.metricNoteheadCount, 102); assert.equal(s.principalAttackCount, 98);
  assert.equal(s.sourceVoice, "explicit-lyric-aligned-single-vocal-line");
  assert.equal(s.repeatSignsPresent, true); assert.equal(s.lyricRowsAuthorizeRepeat, false);
  assert.equal(s.repeatExpansion, "m1-8-twice-then-both-written-ending-phrases-m9-16");
  assert.equal(s.sourceQuarterBpm, null); assert.equal(s.sourceNumericTempoPrinted, false);
  assert.equal(s.sourceTempoText, "慢 歌唱地"); assert.equal(s.sourceMeter, "4/4"); assert.equal(s.beatUnit, "quarter-note");
  assert.equal(s.sourceKey, "D"); assert.equal(s.transpositionSemitones, -2);
  assert.equal(s.globalOctaveShift, 0); assert.equal(s.octaveFolding, false); assert.deepEqual(s.localPitchAlterations, []);
  assert.deepEqual(s.ties, ties); assert.equal(s.tieContinuationCount, 4); assert.deepEqual(s.tuplets, []);
  assert.deepEqual(s.omittedOrnaments, ornaments); assert.deepEqual(s.fermata, fermata);
  assert.deepEqual(s.silentWindows, []); assert.equal(s.pickupBeats, 0); assert.equal(s.endingRestBeats, 0);
  for (const field of ["autoAccompaniment", "practiceAccompaniment"]) assert.equal(value[field], undefined);
  for (const [bar, sourceBar, count, fingerprint] of expandedBarDecisions) {
    const from = (bar - 1) * 4, to = from + 4, actual = span(value, from, to);
    assert.equal(route[bar - 1], sourceBar); assert.equal(actual.length, count, `route m${bar} overlapping attacks`);
    assert.equal(hash(JSON.stringify(actual)), fingerprint, `route m${bar} from printed m${sourceBar}`);
    const [, starts, overlaps, , localHash] = printedBarDecisions[sourceBar - 1];
    assert.equal(phrase(value, from, to).length, starts); assert.equal(actual.length, overlaps);
    assert.equal(hash(JSON.stringify(actual.map(([n,b,d]) => [n,b-from,d]))), localHash);
    // Count sounding intersection, not whole duration charged to onset bar.
    assert.equal(actual.reduce((sum, [,b,d]) => sum + overlap(b,d,from,to), 0), 4);
  }
}
function withIsolatedStorage(run) {
  const previous = globalThis.localStorage, values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,String(value)) };
  try { return run(values); }
  finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
}
function asV2(value) { const result = { ...structuredClone(value), schemaVersion: 2, arrangementKind: "melody", judgementMode: "melody", events: eventsFor(value.steps), rhythm: { sourceStatus: "verified", pickupBeats: 0, restWindows: [] } }; delete result.steps; return result; }

test("school fixed-beat selection locks every printed and expanded bar, principal tuple and canonical identity", () => {
  assertSelectedEdition(song); assert.equal(song.id, id); assert.equal(song.schemaVersion, 1); assert.equal(song.uploader, "system");
  assert.equal(song.title, "《鸿雁》（教材定拍版）");
  assert.equal(song.practiceTitle, `${song.title}练习轨道`); assert.equal(song.scoreTitle, `${song.title}简谱进度`);
  assert.match(song.hint, /8小节主题两遍.*完整8小节结束句.*98次起音、96拍/);
  assert.match(song.hint, /D调整体降2半音至C调.*四处真实延音.*8组无定量倚音.*延长记号不另加拍/);
  assert.match(song.hint, /56 BPM为练习设定.*无伴奏/); assert.doesNotMatch(song.hint, /旧版|原唱全曲|更容易/);
  assert.equal(printedBarDecisions.length, 16); assert.equal(expandedBarDecisions.length, 24);
  assert.equal(printedBarDecisions.reduce((sum, [,,,heads]) => sum + heads, 0), 67);
  assert.equal(route.reduce((sum, bar) => sum + printedBarDecisions[bar - 1][3], 0), 102);
  assert.equal(expandedBarDecisions.reduce((sum, [,,count]) => sum + count, 0), 100);
  assert.equal(getSongMeterLabel(song), "4/4");
});

test("both true ties merge on both passes; cross-system occupancy is 4/4 without forced attack-duration sums", () => {
  for (const {note,beat,duration} of ties) assert.deepEqual(at(song,beat), [note,beat,duration]);
  for (const continuation of [12,13,44,45]) assert.equal(at(song,continuation), undefined);
  for (const offset of [0,32]) {
    assert.equal(phrase(song,8+offset,12+offset).reduce((sum,[,,d]) => sum+d,0), 4.5);
    assert.equal(phrase(song,12+offset,16+offset).reduce((sum,[,,d]) => sum+d,0), 3.5);
    assert.deepEqual(span(song,12+offset,16+offset), [["E4",11.5+offset,1],["D4",12.5+offset,3.5]]);
    assert.deepEqual(phrase(song,11+offset,13+offset), [["G4",11+offset,.5],["E4",11.5+offset,1],["D4",12.5+offset,3.5]]);
  }
  // Different-pitch slurs retain attacks; they do not authorize a held G4.
  assert.deepEqual(phrase(song,0,2), [["D4",0,.5],["E4",.5,.5],["C4",1,.5],["A3",1.5,.5]]);
  assert.match(current.slurEvidence, /first reader has no complete slur registry.*Do not claim every slur endpoint/);
});

test("real repeat and both separately printed closing phrases retain every dotted cell and final four beats", () => {
  assert.deepEqual(phrase(song,32,64).map(([n,b,d]) => [n,b-32,d]), phrase(song,0,32));
  assert.deepEqual(current.selectedRoute, [{sourceMeasures:[1,8],beats:[0,32],pass:1},{sourceMeasures:[1,8],beats:[32,64],pass:2},{sourceMeasures:[9,16],beats:[64,96],pass:1}]);
  for (const start of [4,16,36,48,64,80]) assert.deepEqual(phrase(song,start,start+4).map(([n,b,d]) => [n,b-start,d]), [["G4",0,1],["A4",1,.75],["C5",1.75,.25],["A4",2,2]]);
  assert.deepEqual(phrase(song,88,96), [["E4",88,1],["C4",89,.5],["A3",89.5,.5],["G3",90,.5],["A3",90.5,.5],["E4",91,1],["A3",92,4]]);
  assert.deepEqual(current.excludedSections, []); assert.equal(current.omittedSectionsAreRests, false);
  assert.equal(current.selectedEndIsSelectedEditionEnding, true); assert.equal(current.selectedEndIsFullSongEnding, false);
});

test("eight omitted grace groups and unextended fermata keep exact principal timing and 96-beat nominal practice extent", () => {
  assert.deepEqual(current.omittedOrnaments, ornaments); assert.equal(ornaments.reduce((n,o) => n+o.compiledPitches.length,0),16);
  for (const o of ornaments) assert.deepEqual(at(song,o.beat), [o.principalPitch,o.beat,o.principalDuration]);
  assert.deepEqual(current.fermata, fermata); assert.deepEqual(at(song,91), ["E4",91,1]); assert.deepEqual(at(song,92), ["A3",92,4]);
  assert.match(current.fixedBeatDecision, /not an exact original-singing duration.*adds zero practice beats/);
  assert.match(current.ornamentDecision, /No guessed duration.*no principal-note time is stolen/);
  const analysis = analyzeSongTiming(song);
  assert.deepEqual(analysis.melodyGaps, []); assert.deepEqual(analysis.issues, []); assert.deepEqual(analysis.unannotatedLongGaps, []);
  assert.equal(song.steps.reduce((n,[,,d]) => n+d,0), 96);
  for (let i=1;i<song.steps.length;i++) assert.equal(song.steps[i-1][1]+song.steps[i-1][2],song.steps[i][1]);
  const events=eventsFor(song.steps); assert.equal(getPracticeTotalBeats(events,song),96);
  const loop=createLoopRange(events,96,96,4); assert.deepEqual(loop,{startBeat:92,endBeat:96}); assert.equal(isBeatInLoop(96,loop),false);
});

test("one global minus-two conversion preserves all source intervals and fits G3-C5 without octave folding", () => {
  const keys=new Set(DISPLAY_KEYS.map(k=>k.name)); for(const [n] of song.steps) assert.ok(keys.has(n));
  assert.deepEqual(current.sourcePitchClasses,[2,4,6,9,11]); assert.deepEqual(fittingTranspositions(current.sourcePitchClasses),[3,5,10]);
  assert.deepEqual(current.sourceRange,["A3","D5"]); assert.deepEqual(current.compiledRange,["G3","C5"]);
  assert.deepEqual([Math.min(...song.steps.map(([n])=>midi(n))),Math.max(...song.steps.map(([n])=>midi(n)))],[55,72]);
  assert.equal(hash(JSON.stringify(song.steps.map(([n,b,d])=>[midi(n)+2,b,d]))),sourceMidiTupleHash,"every source pitch recovered by the same +2, no isolated octave edits");
  assert.deepEqual(current.sourceKeySignatureAccidentals,["F#","C#"]); assert.deepEqual(current.additionalMelodyAccidentals,[]);
  assert.match(current.absoluteOctaveConvention,/Undotted source 1 = D4 and target 1 = C4/);
  assert.equal(Math.min(...song.steps.slice(1).map(([,b],i)=>b-song.steps[i][1])),.25);
  assert.ok(Math.abs(.25*60000/56-267.85714285714283)<1e-9);
  assert.ok(Math.abs(96*60/56-102.85714285714286)<1e-9);
  assert.equal(song.bpm,archive.bpm); assert.equal(song.defaultSpeedFactor,archive.defaultSpeedFactor); assert.equal(song.difficulty,archive.difficulty);
  assert.equal(song.sourceFeatures.suitability.status,"conditional");
});

test("book identity, same-source reader scope, unavailable historical source and acceptance limits remain explicit", () => {
  assert.equal(current.adoptedInVersion,"2.4.37"); assert.equal(current.reviewedInVersion,"2.4.37");
  assert.equal(current.sourceUrl,sourceUrl); assert.deepEqual(current.pdfPages,[41]); assert.deepEqual(current.printedPages,[40]);
  assert.deepEqual(current.publishers,["广东教育出版社","花城出版社"]); assert.equal(current.isbn,"978-7-5548-4120-4");
  assert.equal(current.edition,"2021年6月第1版，第1次印刷");
  assert.equal(current.sourcePdfSha256,"b7debe04803aed2637f68f56b081ad35848bc929f1b978e1c5be6a187729b66f");
  assert.equal(current.sourcePageImageSha256,"b3a5471ced0093ef5d143a1d93e4230b920cf94ec7f32013234ba6c3aa201162");
  assert.equal(current.sourceNumericTempoPrinted,false); assert.match(current.tempoDecision,/56 BPM is a retained editorial practice choice/);
  assert.equal(current.oldEditionReverified,false); assert.equal(current.historicalSourceImageIdentityVerified,false);
  assert.equal(current.independentSourcesVerified,false); assert.equal(current.independentSourceReaders,2);
  assert.match(current.sourceReviewMethod,/two readers, not two independent published sources; full slur-endpoint agreement is not claimed/);
  assert.match(current.versionDecision,/does not prove the prior edition wrong/);
  assert.equal(current.firstFrozenSourceReadingSha256,firstFixtureHash); assert.equal(current.independentSourceFixtureSha256,sourceFixtureHash);
  assert.equal(current.comparisonSha256,"5c16ca9717ef438e1d93314c0c4ca60cf037f7146dba59bee5685e1be2efcda5");
  assert.equal(current.independentSourceTupleSha256,tupleHash); assert.deepEqual(review.historicalSourceFeatures,archive.sourceFeatures);
  assert.equal(current.referenceListening,"not-performed"); assert.equal(current.browserAudio,"not-performed-at-data-adoption");
  assert.equal(current.physicalKalimba,"not-performed"); assert.equal(current.publicDistributionRights,"unestablished-private-preview-only");
});

test("complete old bytes and parsed metadata remain recoverable internally without another card, archive route or restore UI", async () => {
  assert.equal(hash(archiveBytes),archiveHash); assert.equal(archive.id,id); assert.equal(archive.steps.length,82);
  assert.equal(archive.title,"《鸿雁》"); assert.equal(archive.sourceFeatures.sourceTotalBeats,80); assert.equal(archive.sourceFeatures.sourceKey,"G");
  assert.deepEqual(archive.steps.at(-1),["A3",76,4]); assert.equal(archive.sourceFeatures.transpositionSemitones,-7);
  assert.equal(review.archivedEdition.file,archivePath); assert.equal(review.archivedEdition.fileSha256,archiveHash);
  assert.equal(getSongArchiveDownload(song),null); assert.equal(current.archiveImportPath,undefined);
  const files=await readSongFiles(); assert.equal(files.length,57); assert.equal(files.filter(({song:s})=>s.schemaVersion===1).length,36);
  assert.equal(files.filter(({song:s})=>s.id===id).length,1); assert.equal(files.filter(({song:s})=>s.id.startsWith(`${id}-`)).length,0);
  for(const file of ["service-worker.js","serve-kalimba.js","src/app.js","src/song-library.js"])
    assert.ok(!(await read(file)).toString().includes("hong-yan-v2.4.36.json"),`${file}: no archive route/precache`);
});

test("actual importer and storage preserve every archived value, canonical links, remembered 0.65 speed and independent local ids", () => {
  withIsolatedStorage(values=>{
    const speedBytes=JSON.stringify({schemaVersion:1,songs:{[id]:{speed:.65}}});
    values.set(SONG_SPEED_STORAGE_KEY,speedBytes); values.set(CURRENT_SONG_STORAGE_KEY,id);
    // This data-only test may run before the integration owner rebuilds songs.
    // The separate generated-module test below checks that integration explicitly.
    const library=getSongLibrary(); library[id]=normalized(song);
    const before=JSON.stringify(library), ids=getPracticeSongs(library).map(s=>s.id).sort();
    const [restored]=parseImportedSongs(archiveBytes.toString(),library);
    assert.notEqual(restored.id,id); assert.notEqual(restored.baseSongId,id); assert.equal(restored.source,"local"); assert.equal(restored.schemaVersion,2);
    assert.deepEqual(restored.steps,archive.steps); assert.deepEqual(restored.sourceFeatures,archive.sourceFeatures);
    assert.equal(getPracticeTotalBeats(restored.events,restored),80);
    saveCustomSongs([restored]); const [saved]=getCustomSongs();
    const normalizedFields=new Set(["schemaVersion","id","uploader","practiceTitle","scoreTitle"]);
    const reconstructed=Object.fromEntries(Object.keys(archive).map(key=>[key,normalizedFields.has(key)?archive[key]:saved[key]]));
    assert.deepEqual(reconstructed,archive,"all original fields after reversing only documented identity/schema/display normalization");
    assert.equal(JSON.stringify(library),before); assert.deepEqual(getPracticeSongs(library).map(s=>s.id).sort(),ids);
    const merged={...library,[saved.id]:saved}; assert.equal(getPracticeSongs(merged).length,37);
    assert.equal(getPracticeSongId(merged,id),id); assert.equal(getPracticeSongId(merged,saved.id),saved.id);
    const [again]=parseImportedSongs(archiveBytes.toString(),merged); assert.notEqual(again.id,saved.id); assert.deepEqual(again.steps,archive.steps);
    const [selected]=parseImportedSongs(JSON.stringify(song),merged); assertSelectedEdition(selected);
    assert.deepEqual(selected.events.map(e=>[e.notes[0].name,e.beat,e.duration]),song.steps);
    assert.equal(values.get(SONG_SPEED_STORAGE_KEY),speedBytes); assert.deepEqual(readSongSpeed(globalThis.localStorage,id),{speed:.65});
    assert.equal(values.get(CURRENT_SONG_STORAGE_KEY),id);
  });
});

test("explicit-melody V2 round-trip preserves all attacks and fixed-beat decisions; structure alone cannot validate source rhythm", () => {
  withIsolatedStorage(()=>{
    const [imported]=parseImportedSongs(JSON.stringify(asV2(song)),getSongLibrary()); assertSelectedEdition(imported);
    assert.ok(imported.events.every(e=>e.notes.length===1&&e.notes[0].role==="melody"&&e.notes[0].judge===true));
    saveCustomSongs([imported]); const [saved]=getCustomSongs(); assertSelectedEdition(saved);
    assert.deepEqual(saved.events.map(e=>[e.notes[0].name,e.beat,e.duration]),song.steps);
    const invalid=asV2(song); invalid.practiceAccompaniment=null;
    assert.throws(()=>parseImportedSongs(JSON.stringify(invalid),getSongLibrary()),/practiceAccompaniment/);
  });
});

test("incompatible old backing cannot be borrowed through either provider path; compatible synthetic control exercises both", () => {
  assert.equal(hasMatchingPracticeMelody(song,archive),false); assert.equal(getSongAccompanimentProvider(normalized(song),[]),null);
  // Synthetic provider controls are not source-backed musical arrangements.
  const backing={enabledByDefault:false,volume:.3,events:[{beat:2,duration:1,notes:[{name:"C4",role:"bass",velocity:.3}]}]};
  const oldBacked={...normalized(archive),id:`${id}-synthetic-old-backing`,baseSongId:id,schemaVersion:2,autoAccompaniment:structuredClone(backing),practiceAccompaniment:structuredClone(backing)};
  assert.equal(getSongAccompanimentProvider(normalized(song),[oldBacked]),null);
  assert.equal(getSongAccompanimentProvider(normalized(song),[oldBacked],true),null);
  const control={...oldBacked,steps:structuredClone(song.steps),events:eventsFor(song.steps),sourceFeatures:structuredClone(song.sourceFeatures)};
  assert.equal(getSongAccompanimentProvider(normalized(song),[control]).kind,"light");
  assert.equal(getSongAccompanimentProvider(normalized(song),[control],true).kind,"original");
});

test("generated canonical song matches selected source after integration build", () => withIsolatedStorage(() => {
  const library=getSongLibrary(); assert.deepEqual(library[id].steps,song.steps,"integration owner must run npm run build:songs");
  assert.equal(library[id].title,song.title); assert.equal(getPracticeSongId(library,id),id);
  assert.equal(getSongArchiveDownload(library[id]),null); assert.equal(getSongAccompanimentProvider(library[id],Object.values(library)),null);
}));

const remove=(value,beat)=>{value.steps=value.steps.filter(([,b])=>b!==beat);};
const splitTie=(s,beat,split)=>{const t=at(s,beat),end=t[1]+t[2];t[2]=split-beat;s.steps.push([t[0],split,end-split]);s.steps.sort((a,b)=>a[1]-b[1]);};
const musicalMutations={
  "erase-low-five-dot":s=>{at(s,2)[0]="G4";},
  "mistake-fermata-dot-for-high-octave":s=>{at(s,91)[0]="E5";},
  "flatten-dotted-eighth-sixteenth":s=>{at(s,5)[2]=.5;at(s,5.75)[1]=5.5;at(s,5.5)[2]=.5;},
  "retrigger-cross-system-E4":s=>splitTie(s,11.5,12),
  "retrigger-in-bar-D4":s=>splitTie(s,12.5,13),
  "wrongly-force-attack-bar-duration-to-four":s=>{at(s,11.5)[2]=.5;at(s,12.5)[1]=12;at(s,12)[2]=4;},
  "erase-different-pitch-slur-attack":s=>{at(s,11)[2]=1.5;remove(s,11.5);},
  "invent-grace-duration-by-stealing-main-time":s=>{const t=at(s,27);t[1]=27.25;t[2]=.75;s.steps.push(["A3",27,.25]);s.steps.sort((a,b)=>a[1]-b[1]);},
  "append-invented-fermata-beat":s=>{at(s,91)[2]=2;at(s,92)[1]=93;s.sourceFeatures.sourceTotalBeats=97;},
  "omit-second-written-ending-phrase":s=>{s.steps=s.steps.filter(([,b])=>b<80);s.sourceFeatures.sourceTotalBeats=80;},
  "skip-second-main-pass":s=>{s.steps=s.steps.filter(([,b])=>b<32||b>=64).map(([n,b,d])=>[n,b>=64?b-32:b,d]);s.sourceFeatures.sourceTotalBeats=64;},
  "trim-final-four-beat-cadence":s=>{at(s,92)[2]=2;},
  "append-invented-ending-rest":s=>{s.sourceFeatures.sourceTotalBeats=100;},
  "reuse-old-G-source-version":s=>{s.steps=structuredClone(archive.steps);s.sourceFeatures.sourceTotalBeats=80;}
};
for(const [name,mutate] of Object.entries(musicalMutations)) test(`structurally importable music mutation is rejected by source decisions: ${name}`,()=>withIsolatedStorage(()=>{
  const changed=structuredClone(song);mutate(changed);
  const [structurallyValid]=parseImportedSongs(JSON.stringify(asV2(changed)),getSongLibrary());
  assert.throws(()=>assertSelectedEdition(structurallyValid));
}));
const metadataMutations={
  "claim-56-is-printed-source-BPM":s=>{scope(s).sourceNumericTempoPrinted=true;scope(s).sourceQuarterBpm=56;},
  "lose-unmeasured-grace-disclosure":s=>{scope(s).omittedOrnaments.pop();},
  "invent-measured-grace-field":s=>{scope(s).omittedOrnaments[0].duration=.25;},
  "silently-add-fermata-beat":s=>{scope(s).fermata.addedPracticeBeats=1;},
  "switch-to-historical-transposition":s=>{s.sourceFeatures.transpositionSemitones=-7;},
  "allow-octave-folding":s=>{scope(s).octaveFolding=true;},
  "infer-repeat-from-lyrics":s=>{scope(s).lyricRowsAuthorizeRepeat=true;},
  "overwrite-default-speed":s=>{s.defaultSpeedFactor=.55;},
  "add-unreviewed-backing":s=>{s.autoAccompaniment={events:[]};}
};
for(const [name,mutate] of Object.entries(metadataMutations)) test(`selected policy rejects ${name}`,()=>{
  const changed=structuredClone(song);mutate(changed);assert.throws(()=>assertSelectedEdition(changed));
});

const evidencePath=process.env.HONGYAN_SCHOOL_EVIDENCE_PATH;
test("optional actual frozen independent reader verifies all 98 tuples, 24 overlapping spans, source pitches, route and ornaments",{
  skip:evidencePath?false:"Set HONGYAN_SCHOOL_EVIDENCE_PATH to the actual private independent-frozen.json; private source fixture check not performed"
},async()=>{
  const bytes=await readFile(evidencePath);assert.equal(hash(bytes),sourceFixtureHash,"verify immutable private bytes before using their expectations");
  const source=JSON.parse(bytes);assert.equal(source.source.url,sourceUrl);assert.equal(source.source.pdfPage,41);assert.equal(source.source.printedPage,40);
  assert.equal(source.printedNormalNoteheads.length,67);assert.equal(source.expandedPrintedOccurrences.length,102);
  assert.equal(source.expandedAttackTuplesTiesMerged.length,98);assert.deepEqual(source.route.standardFullRoute,route);assert.equal(source.route.nominalQuarterBeats,96);
  const names=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const sourceMidi=source.expandedAttackTuplesTiesMerged.map(({tuple:[d,o,b,t]})=>[62+[0,2,4,5,7,9,11][d-1]+12*o,b,t]);
  assert.equal(hash(JSON.stringify(sourceMidi)),sourceMidiTupleHash);
  const expected=sourceMidi.map(([m,b,d])=>[names[(m-2)%12]+(Math.floor((m-2)/12)-1),b,d]);
  assert.equal(hash(JSON.stringify(expected)),tupleHash);assert.deepEqual(song.steps,expected);
  assert.deepEqual(source.ties,[["m3.n7","m4.n1"],["m4.n2","m4.n3"]]);
  assert.deepEqual(source.expandedGraceOccurrences.map(g=>[g.source.bar,g.performedBar,g.nominalPrincipalOnsetQ,g.relativePitchSequence.length,g.metricDurationQ]),ornaments.map(o=>[o.sourceMeasure,o.routeMeasure,o.beat,o.compiledPitches.length,null]));
  const held=source.expandedAttackTuplesTiesMerged.filter(a=>a.fermata);assert.equal(held.length,1);assert.deepEqual(held[0].tuple,[3,0,91,1]);
  assert.equal(source.notation.numericBpm,null);assert.equal(source.notation.tempoText,"慢 歌唱地");assert.deepEqual(source.notation.rests,[]);
  const evidence={songId:id,source:{reference:sourceUrl,scope:"all 24 expanded bars; unmeasured grace attacks omitted and fermata unextended by explicit edition decision"},sourceTotalBeats:96,pitchFit:{sourcePitchClasses:[2,4,6,9,11],semitoneShift:-2},melodySpans:route.map((_,i)=>({from:i*4,to:(i+1)*4,attacks:expected.filter(([,b,d])=>b<(i+1)*4&&b+d>i*4)}))};
  const result=checkTranscriptionEvidence(song,evidence);assert.equal(result.reviewedSpans,24);assert.equal(result.checkedAttacks,100);assert.equal(result.checkedSilentWindows,0);
  for(const [name,mutate] of Object.entries(musicalMutations)){const changed=structuredClone(song);mutate(changed);assert.throws(()=>checkTranscriptionEvidence(changed,evidence),name);}
});
