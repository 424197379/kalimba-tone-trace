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
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const id = "qing-cheng-shan-xia-bai-su-zhen";
const song = JSON.parse(await read(`data/songs/${id}.json`));
const archivePath = `data/archives/${id}-v2.4.35.json`;
const archiveBytes = await read(archivePath), archive = JSON.parse(archiveBytes);
const archiveHash = "60ef963602fd3a4a7cd83d340d60ff424af4e04d7ab5d69497f37c322c1df7c9";
const tupleHash = "f0e8609f9e93d42ebbb8558affcf6958581e717c2b517767dcfb399b29ae4cf5";
const sourceFixtureHash = "1777fdcc60b8b34727bb3d711cc3de63f35c9d5b66312bad6b77f5fc9149a96b";
const sourceUrl = "https://www.cnjpw.net/tongsu/88391.html";
const review = song.sourceFeatures.sourceReview, current = review.currentScopeReview;
const ornaments = [[14, 35], [20, 59], [26, 83], [30, 99], [34, 115]].map(([sourceMeasure, beat]) => ({
  sourceMeasure, beat, sourcePitch: "G4", principalPitch: "E4", principalDuration: 1, duration: null,
  decision: "omit-unquantified-grace-without-stealing-main-note-time"
}));
// Frozen at authoring from the second source-only pixel reading, before that
// reviewer opened the candidate. These are NOT generated from production at
// test time. [editorial page measure, principal attack count, exact tuple hash].
const barDecisions = [
  [6,8,"9e0830ff557db3d88e4510212a586c30eef86fe0bea4712b37a0a4e896c0e1bf"],
  [7,5,"827484028783f0260b4c9c86cf340a60ac20229db1d3f58da6020e5068e7b619"],
  [8,10,"a9c0e435b87889e3c530571d6092ce6bbe9936bf9d8527b8620ff34e3ebe1c10"],
  [9,5,"d4b1782f9384c88973f5fc1cd805de771629485bb790242e8e247f73d8d8cc76"],
  [10,5,"4b363b71ba05adef4b8b8ed1a4e18ae0ef3b45d6940a19dfc7047f5fa6ab749a"],
  [11,5,"34baa4a4a6615a01d957b757566c124376ab199c00a012a8746aa9ec9456d581"],
  [12,8,"a0c50e9a37501cb3f834361d82b9fe7d86bbb66a4df8c741d2c1e494e4411a21"],
  [13,5,"753feaddcd51fc58d9d16f1fea2730da6f0bfd16b9dd6955fea3785fc8f2167a"],
  [14,10,"cf9d612c7007ca66c6ab887d3ae31a6f671380d3f4a4373e5d637d6ae2fd794b"],
  [15,5,"152736fdc9614c8baf34243b5cd5713559dfa92f5709c77f2db857059a1210f4"],
  [16,5,"77462a2b2f085501b09ea1d303066aa4932fae5c18c92f6b7fbe3ab7fd04c89c"],
  [17,5,"3fa7ae64a27cd45344b1bec5acd971106a4820f31fd527baf3779b94648be388"],
  [18,8,"fdda77550803b4c7ead313aa932361d375fb6762bee209cab3a649da3be21b49"],
  [19,5,"7ef8a214789bd479df8d3ebb49b9c6c02f76539ac05760884a346372d48c0838"],
  [20,10,"c5187c51feee38225ffb04d53ddf53316af21a56e291b29d049e535d4350c400"],
  [21,5,"a559e2f15af7458e85e2b32014f4e65ef9e7344c542e689e0d7f34801d9ddaf7"],
  [22,5,"0aa4eaa24ff1fda0755a99afbc3d3c42b074b069b64112d735a22b73627facb1"],
  [23,5,"ec1eb7a1534de7de7595c1e6b9f2f0127a1ec6b333f1bc6905c260281e67f85f"],
  [24,8,"2152699f55159ce508a2e5c5ad18dcacf86186d144497273cc7b13e094dbaa63"],
  [25,5,"a9b6bbe92586a54aa129bdd2e6e6459daec39aa0715d92807ef0422461512ecf"],
  [26,10,"19bda4d3f7ab78679a1fcc23aaf6baf40ea5bb9b898adfaf2c2978ec5f64c8cc"],
  [27,5,"a1f10261e85779ef60b4673fbab4915e0a9c0ebe5d6776e5527d275fdb74ef5d"],
  [28,6,"aa46354a909490e291febe77cda34ea548063cb481bda8fdc96ca2df825ace92"],
  [29,6,"6e341ca4140dfa854c1facb69158373794746a37bd9eded0beedcd068414bfbb"],
  [30,10,"396b96c5cbc85f99718fc978b23fc1930525b362130c1fd258bfcdee3e547b65"],
  [31,5,"6fe0fc2db6c212a96f5d9153b6543d5bebb573845173e5cca64297c7ef43712b"],
  [32,6,"d69fcaf44365ca56142317aeec34d79a2b0376c6d46d25d138d1b9776cf6f2f5"],
  [33,6,"01402d5cebaf987c55570bfc0908d74e0897ac8fa25e8f5acc0ee73c6e8753bc"],
  [34,10,"decbfdc32f96e14e557ca9136912bc3051a206989e057c43746de15d0ad78dab"],
  [35,5,"120cb8d76e880969792bae3f7b1a5b0a2351d0daf640f54a37e74e49e0e4633d"]
];
const reattacks = [
  ["G4", 2, .25, 2.25, .5], ["G4", 9.75, .25, 10, .5],
  ["G4", 26, .25, 26.25, .5], ["G4", 33.75, .25, 34, .5],
  ["G4", 50, .25, 50.25, .5], ["G4", 57.75, .25, 58, .5],
  ["G4", 74, .25, 74.25, .5], ["G4", 81.75, .25, 82, .5],
  ["D4", 89.75, .25, 90, 2], ["G4", 93.75, .25, 94, 2],
  ["G4", 97.75, .25, 98, .5], ["C4", 101.5, .5, 102, 2],
  ["D4", 105.75, .25, 106, 2], ["G4", 109.75, .25, 110, 2],
  ["G4", 113.75, .25, 114, .5], ["C4", 117.5, .5, 118, 2]
];
const phrase = (value, from, to) => value.steps.filter(([, b]) => b >= from && b < to);
const at = (value, beat) => value.steps.find(([, b]) => b === beat);
const midi = name => 12 * (Number(name.slice(1)) + 1) + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[name[0]];
const eventsFor = steps => steps.map(([name, beat, duration]) => ({ beat, duration, notes: [{ name, role: "melody", judge: true }] }));
const normalized = value => ({ ...structuredClone(value), baseSongId: value.id, source: "system",
  arrangementKind: "melody", judgementMode: "melody", events: eventsFor(value.steps) });
function assertSelectedEdition(value) {
  assert.equal(value.steps.length, 196);
  assert.equal(hash(JSON.stringify(value.steps)), tupleHash, "196 independently source-authored pitch/onset/duration tuples");
  assert.equal(value.bpm, 82); assert.equal(value.defaultSpeedFactor, .9); assert.equal(value.difficulty, "medium");
  assert.equal(value.beatsPerMeasure, 4); assert.equal(value.key, "C");
  assert.equal(value.sourceFeatures.sourceTotalBeats, 120); assert.equal(value.sourceFeatures.sourceMeasureCount, 30);
  const scope = value.sourceFeatures.sourceReview.currentScopeReview;
  assert.deepEqual(scope.sourceMeasureRange, [6, 35]); assert.deepEqual(scope.reviewedBeatRanges, [[0, 120]]);
  assert.equal(scope.sourceVoice, "explicit-lyric-aligned-single-vocal-line");
  assert.equal(scope.sourceQuarterBpm, 82); assert.equal(scope.sourceNumericTempoPrinted, true);
  assert.equal(scope.sourceMeter, "4/4"); assert.equal(scope.beatUnit, "quarter-note");
  assert.equal(scope.sourceKey, "C"); assert.equal(scope.transpositionSemitones, 0);
  assert.equal(scope.globalOctaveShift, 0); assert.equal(scope.octaveFolding, false);
  assert.deepEqual(scope.localPitchAlterations, []); assert.deepEqual(scope.additionalMelodyAccidentals, []);
  assert.deepEqual(scope.ties, []); assert.equal(scope.tieContinuationCount, 0); assert.deepEqual(scope.tuplets, []);
  assert.deepEqual(scope.silentWindows, []); assert.equal(scope.pickupBeats, 0);
  assert.equal(scope.initialMelodyRestBeats, 0); assert.equal(scope.endingRestBeats, 0);
  assert.equal(scope.repeatSignsPresent, false); assert.equal(scope.repeatExpansion, "none-all-30-selected-bars-written-out");
  assert.equal(scope.omittedSectionsAreRests, false); assert.deepEqual(scope.omittedOrnaments, ornaments);
  for (const field of ["autoAccompaniment", "practiceAccompaniment"]) assert.equal(value[field], undefined);
  for (const [bar, count, fingerprint] of barDecisions) {
    const start = (bar - 6) * 4, actual = phrase(value, start, start + 4);
    assert.equal(actual.length, count, `source m${bar} attacks`);
    assert.equal(hash(JSON.stringify(actual)), fingerprint, `source m${bar} occurrence-specific tuples`);
    assert.equal(actual.reduce((sum, [, , d]) => sum + d, 0), 4, `source m${bar} exact 4/4 balance`);
    assert.equal(actual[0][1], start); assert.equal(actual.at(-1)[1] + actual.at(-1)[2], start + 4);
  }
}
function withIsolatedStorage(run) {
  const previous = globalThis.localStorage, values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  try { return run(values); }
  finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
}

test("selected Rollins/Ju Jingyi vocal edition freezes 196 attacks in all 30 source bars and retains one canonical identity", () => {
  assertSelectedEdition(song);
  assert.equal(song.id, id); assert.equal(song.schemaVersion, 1); assert.equal(song.uploader, "system");
  assert.equal(song.title, "《青城山下白素贞》（鞠婧祎版人声）");
  assert.equal(song.practiceTitle, `${song.title}练习轨道`); assert.equal(song.scoreTitle, `${song.title}简谱进度`);
  assert.match(song.hint, /罗林斯.*鞠婧祎版完整30小节人声.*196次起音、120拍/);
  assert.match(song.hint, /谱面82 BPM.*省略前奏、尾奏和5个非定量倚音.*两遍写明的收尾.*无伴奏/);
  assert.doesNotMatch(song.hint, /旧版|还原|更容易|原唱全曲/);
  assert.deepEqual(barDecisions.map(([m]) => m), Array.from({ length: 30 }, (_, i) => i + 6));
  assert.equal(barDecisions.reduce((sum, [, count]) => sum + count, 0), 196);
  assert.equal(current.sourcePrintedMeasureCount, 40); assert.equal(current.distinctPrintedMelodyMeasures, 30);
  assert.deepEqual(current.selectedRoute, [{ sourceMeasures: [6, 35], beats: [0, 120], voice: "lyric-aligned-single-vocal-line" }]);
  assert.deepEqual(current.excludedSections, [{ sourceMeasures: [1, 5], kind: "instrumental-intro" }, { sourceMeasures: [36, 40], kind: "instrumental-outro" }]);
  assert.deepEqual(current.sourcePageBeatRange, [20, 140]); assert.match(current.sourceMeasureNumbers, /Editorially counted/);
  assert.equal(current.allPrintedOccurrencesReviewed, true); assert.equal(song.sourceFeatures.hasRepeats, false);
  assert.equal(getSongMeterLabel(song), "4/4");
});

test("all 16 adjacent repeated pitches attack separately, including both closing C4 pairs; multi-pitch slurs are not ties", () => {
  const found = song.steps.slice(1).flatMap(([name, beat, duration], i) => {
    const [prior, priorBeat, priorDuration] = song.steps[i];
    return prior === name ? [[name, priorBeat, priorDuration, beat, duration]] : [];
  });
  assert.deepEqual(found, reattacks); assert.equal(current.independentSamePitchReattackPairs, 16);
  assert.deepEqual(phrase(song, 34, 36), [["G4", 34, .5], ["A4", 34.5, .25], ["G4", 34.75, .25], ["E4", 35, 1]]);
  assert.deepEqual(phrase(song, 116, 120), [["D4", 116, .5], ["C4", 116.5, .5], ["A3", 117, .5], ["C4", 117.5, .5], ["C4", 118, 2]]);
  assert.equal(current.metricNoteheadCount, 196); assert.equal(current.principalAttackCount, 196);
});

test("later printed occurrences preserve low cadences, contrasting final tonics and their own sixteenth-note rhythm", () => {
  for (const beat of [14, 38, 62, 86]) assert.deepEqual(at(song, beat), ["G3", beat, 2]);
  assert.deepEqual(song.steps.filter(([name]) => name === "G3").map(([, b]) => b), [14, 38, 62, 86]);
  assert.deepEqual(song.steps.filter(([name]) => name === "A3").map(([, b]) => b), [13, 16, 37, 40, 61, 64, 85, 101, 117]);
  for (const beat of [102, 118]) assert.deepEqual(at(song, beat), ["C4", beat, 2]);
  for (const start of [8, 32, 56, 80, 96, 112]) {
    assert.deepEqual(phrase(song, start, start + 4).map(([n, b, d]) => [n, b - start, d]), [
      ["A4", 0, .75], ["C5", .75, .25], ["D5", 1, .25], ["C5", 1.25, .25], ["A4", 1.5, .25],
      ["G4", 1.75, .25], ["G4", 2, .5], ["A4", 2.5, .25], ["G4", 2.75, .25], ["E4", 3, 1]
    ]);
  }
  for (const start of [88, 104]) assert.deepEqual(phrase(song, start, start + 4).map(([n, b, d]) => [n, b - start, d]),
    [["D4", 0, .75], ["E4", .75, .25], ["D4", 1, .5], ["E4", 1.5, .25], ["D4", 1.75, .25], ["D4", 2, 2]]);
});

test("five disclosed unmeasured grace omissions leave all principal E4 attacks and main time untouched", () => {
  assert.deepEqual(current.omittedOrnaments, ornaments);
  for (const { beat } of ornaments) assert.deepEqual(at(song, beat), ["E4", beat, 1]);
  // The same principal figure in m8 has no small grace: do not infer a sixth.
  assert.deepEqual(at(song, 11), ["E4", 11, 1]);
  assert.match(current.ornamentDecision, /deliberately omitted.*No guessed duration.*no main-note time.*not an ornament-complete/);
});

test("120 quarter beats stay continuous with no invented rests, pickup, extra repeat or instrumental tail", () => {
  const analysis = analyzeSongTiming(song);
  assert.deepEqual(analysis.melodyGaps, []); assert.deepEqual(analysis.unannotatedLongGaps, []); assert.deepEqual(analysis.issues, []);
  assert.equal(song.steps.reduce((sum, [, , d]) => sum + d, 0), 120);
  assert.deepEqual(song.steps[0], ["C5", 0, 1]); assert.deepEqual(song.steps.at(-1), ["C4", 118, 2]);
  for (let i = 1; i < song.steps.length; i++) assert.equal(song.steps[i - 1][1] + song.steps[i - 1][2], song.steps[i][1]);
  const events = eventsFor(song.steps); assert.equal(getPracticeTotalBeats(events, song), 120);
  const endLoop = createLoopRange(events, 120, 120, 4);
  assert.deepEqual(endLoop, { startBeat: 116, endBeat: 120 }); assert.equal(isBeatInLoop(120, endLoop), false);
  assert.equal(current.selectedEndIsSelectedEditionEnding, true); assert.equal(current.selectedEndIsFullSongEnding, false);
  for (const field of ["events", "rhythm", "autoAccompaniment", "practiceAccompaniment"]) assert.equal(song[field], undefined);
});

test("original C range and printed 82 BPM preserve pitch and quarter-note timebase while playability stays conditional", () => {
  const keys = new Set(DISPLAY_KEYS.map(k => k.name)); for (const [name] of song.steps) assert.ok(keys.has(name));
  assert.deepEqual(current.sourcePitchClasses, [0, 2, 4, 7, 9]);
  assert.deepEqual([...new Set(song.steps.map(([name]) => midi(name) % 12))].sort((a, b) => a - b), [0, 2, 4, 7, 9]);
  assert.deepEqual(current.sourceRange, ["G3", "D5"]); assert.deepEqual(current.compiledRange, ["G3", "D5"]);
  assert.deepEqual([Math.min(...song.steps.map(([n]) => midi(n))), Math.max(...song.steps.map(([n]) => midi(n)))], [55, 74]);
  assert.match(current.absoluteOctaveConvention, /Undotted 1 = C4/); assert.equal(song.tuning, "21-key-c");
  const positions = new Map(DISPLAY_KEYS.map(({ name }, i) => [name, i])), side = n => Math.sign(positions.get(n) - 10);
  const pairs = song.steps.slice(1).map(([name, beat], i) => ({ name, beat, previous: song.steps[i] }));
  assert.equal(Math.min(...pairs.map(p => p.beat - p.previous[1])), .25);
  assert.equal(Math.min(...pairs.filter(p => side(p.name) === side(p.previous[0])).map(p => p.beat - p.previous[1])), .25);
  assert.equal(Math.max(...pairs.map(p => Math.abs(midi(p.name) - midi(p.previous[0])))), 7);
  assert.equal(Math.max(...pairs.map(p => Math.abs(positions.get(p.name) - positions.get(p.previous[0])))), 12);
  assert.ok(Math.abs(.25 * 60000 / song.bpm - 182.9268292682927) < 1e-9);
  assert.ok(Math.abs(120 * 60 / song.bpm - 87.80487804878048) < 1e-9);
  assert.ok(Math.abs(120 * 60 / (song.bpm * .9) - 97.5609756097561) < 1e-9);
  assert.equal(archive.bpm, 80); assert.equal(song.defaultSpeedFactor, archive.defaultSpeedFactor);
  assert.equal(song.difficulty, archive.difficulty); assert.equal(song.sourceFeatures.suitability.status, "conditional");
});

test("edition identity follows the fixed image; historic claims and unfinished acceptance gates stay separate", () => {
  assert.equal(current.status, "reviewed-selected-complete-vocal-edition"); assert.equal(current.adoptedInVersion, "2.4.36");
  assert.equal(current.sourceUrl, sourceUrl); assert.match(current.sourceLabel, /ROLLINS.*鞠婧祎版/);
  assert.match(current.identityDecision, /image explicitly identifies 鞠婧祎版.*directory labels 庄惠茹.*not used/);
  assert.equal(current.sourceImageSha256, "8cd195fb40ad63a2ebbb21af1e18b079ef47b0289bd3934a7e492de37cb11224");
  assert.match(current.tempoDecision, /82 BPM is the printed quarter-note tempo.*prior 80 BPM/);
  assert.equal(current.oldEditionReverified, false); assert.equal(current.historicalSourceImageIdentityVerified, false);
  assert.equal(current.independentSourcesVerified, false); assert.equal(current.independentSourceReaders, 2);
  assert.match(current.versionDecision, /does not prove the prior edition wrong/);
  assert.deepEqual(review.historicalSourceFeatures, archive.sourceFeatures);
  assert.equal(current.publicDistributionRights, "unestablished-private-preview-only");
  assert.equal(current.referenceListening, "not-performed"); assert.equal(current.browserAudio, "not-performed-at-data-adoption");
  assert.equal(current.physicalKalimba, "not-performed"); assert.equal(current.independentSourceTupleSha256, tupleHash);
  assert.equal(current.independentSourceFixtureSha256, sourceFixtureHash);
});

test("prior 116-attack, 72-beat edition survives byte for byte without an extra card, archive route or restore UI", async () => {
  assert.equal(hash(archiveBytes), archiveHash); assert.equal(archive.id, song.id);
  assert.equal(archive.steps.length, 116); assert.deepEqual(archive.steps.at(-1), ["C4", 70, 2]);
  assert.equal(archive.title, "《青城山下白素贞》"); assert.equal(archive.bpm, 80);
  assert.equal(archive.beatsPerMeasure, 4); assert.equal(archive.defaultSpeedFactor, .9);
  assert.equal(review.archivedEdition.file, archivePath); assert.equal(review.archivedEdition.fileSha256, archiveHash);
  assert.equal(current.archiveImportPath, undefined); assert.equal(getSongArchiveDownload(song), null);
  const files = await readSongFiles(); assert.equal(files.length, 58);
  assert.equal(files.filter(({ song: s }) => s.schemaVersion === 1).length, 37);
  assert.equal(files.filter(({ song: s }) => s.schemaVersion === 2).length, 21);
  assert.equal(files.filter(({ song: s }) => s.id === id).length, 1);
  assert.equal(files.filter(({ song: s }) => s.id.startsWith(`${id}-`)).length, 0);
  for (const file of ["service-worker.js", "serve-kalimba.js", "src/app.js", "src/song-library.js"])
    assert.ok(!(await read(file)).toString().includes(`${id}-v2.4.35.json`), `${file} must not expose or precache archive`);
});

test("real importer and storage recover every archived value independently without replacing canonical song, selection or speed", () => {
  withIsolatedStorage(values => {
    const speedBytes = JSON.stringify({ schemaVersion: 1, songs: { [id]: { speed: .65 } } });
    values.set(SONG_SPEED_STORAGE_KEY, speedBytes); values.set(CURRENT_SONG_STORAGE_KEY, id);
    // Install the selected source in memory: this suite also runs before the
    // integration owner regenerates src/songs.js; it never edits that module.
    const library = getSongLibrary(); library[id] = normalized(song);
    const before = JSON.stringify(library), previousIds = getPracticeSongs(library).map(s => s.id).sort();
    assert.equal(Object.keys(library).length, 58); assert.equal(previousIds.length, 37);
    const [restored] = parseImportedSongs(archiveBytes.toString(), library);
    assert.deepEqual(restored.steps, archive.steps); assert.deepEqual(restored.sourceFeatures, archive.sourceFeatures);
    assert.equal(restored.schemaVersion, 2); assert.equal(restored.source, "local");
    assert.notEqual(restored.id, id); assert.notEqual(restored.baseSongId, id);
    assert.equal(getPracticeTotalBeats(restored.events, restored), 72);
    saveCustomSongs([restored]); const [saved] = getCustomSongs();
    const normalizedFields = new Set(["schemaVersion", "id", "uploader", "practiceTitle", "scoreTitle"]);
    const reconstructed = Object.fromEntries(Object.keys(archive).map(key => [key, normalizedFields.has(key) ? archive[key] : saved[key]]));
    assert.deepEqual(reconstructed, archive, "all original values survive after reversing only documented identity/schema/display normalization");
    assert.equal(JSON.stringify(library), before); assert.deepEqual(library[id].steps, song.steps);
    assert.deepEqual(getPracticeSongs(library).map(s => s.id).sort(), previousIds);
    const merged = { ...library, [restored.id]: restored };
    assert.equal(getPracticeSongs(merged).length, 38); assert.equal(getPracticeSongId(merged, id), id);
    assert.equal(getPracticeSongId(merged, restored.id), restored.id);
    const [again] = parseImportedSongs(archiveBytes.toString(), merged); assert.notEqual(again.id, restored.id);
    assert.deepEqual(again.steps, archive.steps);
    const [selected] = parseImportedSongs(JSON.stringify(song), merged); assertSelectedEdition(selected);
    assert.deepEqual(selected.events.map(e => [e.notes[0].name, e.beat, e.duration]), song.steps);
    assert.ok(selected.events.every(e => e.notes.length === 1 && e.notes[0].role === "melody" && e.notes[0].judge === true));
    assert.equal(values.get(SONG_SPEED_STORAGE_KEY), speedBytes); assert.deepEqual(readSongSpeed(globalThis.localStorage, id), { speed: .65 });
    assert.equal(values.get(CURRENT_SONG_STORAGE_KEY), id);
  });
});

test("supported explicit-melody V2 import preserves all selected music; valid structure alone cannot certify low-dot fidelity", () => {
  withIsolatedStorage(() => {
    const v2 = { ...structuredClone(song), schemaVersion: 2, arrangementKind: "melody", judgementMode: "melody",
      events: eventsFor(song.steps), rhythm: { sourceStatus: "verified", pickupBeats: 0, restWindows: [] } };
    delete v2.steps;
    const [imported] = parseImportedSongs(JSON.stringify(v2), getSongLibrary());
    assertSelectedEdition(imported); assert.deepEqual(imported.events.map(e => [e.notes[0].name, e.beat, e.duration]), song.steps);
    assert.equal(getPracticeTotalBeats(imported.events, imported), 120); assert.equal(getSongMeterLabel(imported), "4/4");
    const unsafe = structuredClone(v2); unsafe.practiceAccompaniment = null;
    assert.throws(() => parseImportedSongs(JSON.stringify(unsafe), getSongLibrary()), /practiceAccompaniment/);
    const ambiguous = structuredClone(v2); ambiguous.events[0].notes.push({ name: "C4", role: "melody", judge: false });
    assert.throws(() => parseImportedSongs(JSON.stringify(ambiguous), getSongLibrary()));
    const wrong = structuredClone(v2); wrong.events.find(e => e.beat === 14).notes[0].name = "G4";
    const [structurallyValid] = parseImportedSongs(JSON.stringify(wrong), getSongLibrary());
    assert.throws(() => assertSelectedEdition(structurallyValid));
  });
});

test("neither old backing provider path can be borrowed even after relabeling its tempo; compatible control exercises both paths", () => {
  assert.equal(hasMatchingPracticeMelody(song, archive), false);
  assert.equal(getSongAccompanimentProvider(normalized(song), []), null);
  // Synthetic provider controls, not source-backed musical arrangements.
  const backing = { enabledByDefault: false, volume: .3, events: [{ beat: 2, duration: 1, notes: [{ name: "C4", role: "bass", velocity: .3 }] }] };
  const oldBacked = { ...normalized(archive), id: `${id}-synthetic-old-backing`, baseSongId: id, schemaVersion: 2,
    autoAccompaniment: structuredClone(backing), practiceAccompaniment: structuredClone(backing) };
  for (const candidate of [oldBacked, { ...oldBacked, bpm: 82 }]) {
    assert.equal(getSongAccompanimentProvider(normalized(song), [candidate]), null);
    assert.equal(getSongAccompanimentProvider(normalized(song), [candidate], true), null);
  }
  const control = { ...oldBacked, bpm: 82, steps: structuredClone(song.steps), events: eventsFor(song.steps), sourceFeatures: structuredClone(song.sourceFeatures) };
  assert.equal(getSongAccompanimentProvider(normalized(song), [control]).kind, "light");
  assert.equal(getSongAccompanimentProvider(normalized(song), [control], true).kind, "original");
});

const remove = (value, beat) => { value.steps = value.steps.filter(([, b]) => b !== beat); };
const mergeRepeat = (value, beat, nextBeat) => { const next = at(value, nextBeat); at(value, beat)[2] = nextBeat + next[2] - beat; remove(value, nextBeat); };
const scope = value => value.sourceFeatures.sourceReview.currentScopeReview;
const mutations = {
  "erase-low-five-dot-in-first-cadence": s => { at(s, 14)[0] = "G4"; },
  "erase-low-six-dot-in-final-occurrence": s => { at(s, 117)[0] = "A4"; },
  "borrow-old-opening-low-six": s => { at(s, 8)[0] = "A3"; },
  "copy-earlier-G3-cadence-over-first-closing-C4": s => { at(s, 102)[0] = "G3"; },
  "copy-earlier-G3-cadence-over-final-C4": s => { at(s, 118)[0] = "G3"; },
  "flatten-local-sixteenths-to-eighths": s => { at(s, 9)[2] = .5; remove(s, 9.25); },
  "merge-opening-G4-reattack": s => mergeRepeat(s, 2, 2.25),
  "merge-sixteenth-to-eighth-G4-reattack": s => mergeRepeat(s, 9.75, 10),
  "merge-closing-vocable-D4-reattack": s => mergeRepeat(s, 89.75, 90),
  "merge-final-C4-reattack": s => mergeRepeat(s, 117.5, 118),
  "mistake-G-A-G-slur-for-tie": s => { at(s, 34)[2] = 1; remove(s, 34.5); remove(s, 34.75); },
  "quantize-grace-by-stealing-principal-time": s => {
    const principal = at(s, 35); principal[1] = 35.25; principal[2] = .75;
    s.steps.push(["G4", 35, .25]); s.steps.sort((a, b) => a[1] - b[1]);
  },
  "erase-fifth-grace-disclosure": s => { scope(s).omittedOrnaments.pop(); },
  "invent-quantified-grace-source-duration": s => { scope(s).omittedOrnaments[0].duration = .25; },
  "omit-second-separately-written-closing-sequence": s => { s.steps = s.steps.filter(([, b]) => b < 104); s.sourceFeatures.sourceTotalBeats = 104; },
  "copy-a-vocable-bar-over-the-last-lyric-cadence": s => { s.steps = s.steps.filter(([, b]) => b < 116); s.steps.push(...phrase(song, 104, 108).map(([n, b, d]) => [n, b + 12, d])); },
  "trim-final-half-note": s => { at(s, 118)[2] = 1; },
  "mislabel-omitted-outro-as-ending-rest": s => { s.sourceFeatures.sourceTotalBeats = 140; scope(s).omittedSectionsAreRests = true; },
  "invent-quarter-beat-pickup": s => { s.steps.forEach(t => { t[1] += .25; }); scope(s).pickupBeats = .25; },
  "double-quarter-note-timebase": s => { s.steps.forEach(t => { t[1] *= 2; t[2] *= 2; }); s.sourceFeatures.sourceTotalBeats = 240; },
  "reuse-legacy-116-attack-selection": s => { s.steps = structuredClone(archive.steps); s.sourceFeatures.sourceTotalBeats = 72; },
  "retain-legacy-80-BPM-as-selected-source": s => { s.bpm = 80; },
  "overwrite-speed-suggestion": s => { s.defaultSpeedFactor = .55; },
  "replace-vocal-role-with-highest-note-heuristic": s => { scope(s).sourceVoice = "highest-note-heuristic"; },
  "allow-local-octave-folds": s => { scope(s).octaveFolding = true; },
  "add-unreviewed-automatic-backing": s => { s.autoAccompaniment = { events: [{ beat: 2, duration: 1, notes: ["C4"] }] }; },
  "add-unreviewed-practice-backing": s => { s.practiceAccompaniment = { events: [{ beat: 2, duration: 1, notes: ["C4"] }] }; }
};
for (const [name, mutate] of Object.entries(mutations)) test(`source-decision locks reject ${name}`, () => {
  const changed = structuredClone(song); mutate(changed); assert.throws(() => assertSelectedEdition(changed));
});

// Real private evidence is read only when explicitly supplied. Portable runs
// skip this gate honestly; they do not claim to have inspected source pixels.
// The blind record predates a song identity. Add only canonical id in memory,
// without rewriting its bytes, musical tuples or original pending-state claims.
const evidencePath = process.env.QINGCHENG_SOURCE_EVIDENCE_PATH;
test("explicit private independent source fixture verifies 196 attacks across every selected bar", {
  skip: evidencePath ? false : "Set QINGCHENG_SOURCE_EVIDENCE_PATH to the actual private source-only-frozen-evidence.json; independent fixture check not performed"
}, async () => {
  const bytes = await readFile(evidencePath); assert.equal(hash(bytes), sourceFixtureHash);
  const source = JSON.parse(bytes); assert.equal(source.songId, undefined); assert.equal(source.source.reference, sourceUrl);
  assert.equal(source.sourceTotalBeats, 120); assert.equal(source.melodySpans.length, 30);
  assert.equal(hash(JSON.stringify(source.attacks)), tupleHash);
  assert.deepEqual(source.melodySpans.map(s => [s.sourcePageMeasure, s.attacks.length, hash(JSON.stringify(s.attacks))]), barDecisions);
  assert.deepEqual(source.melodySpans.map(s => [s.from, s.to]), Array.from({ length: 30 }, (_, i) => [i * 4, (i + 1) * 4]));
  assert.ok(source.bars.every(b => b.sourceOccurrenceInspected));
  assert.deepEqual(source.selectedVocalRests, []); assert.deepEqual(source.ties, []);
  assert.deepEqual(source.ornaments.map(o => [o.pageMeasure, o.principalSelectedBeat, o.duration]), [[14, 35, null], [20, 59, null], [26, 83, null], [30, 99, null], [34, 115, null]]);
  assert.equal(source.meter.printedTempoBpm, 82); assert.equal(source.key.globalSemitoneShift, 0);
  assert.deepEqual(source.ending.selectedFinalAttack, ["C4", 118, 2]);
  const evidence = { ...source, songId: id }, result = checkTranscriptionEvidence(song, evidence);
  assert.equal(result.checkedAttacks, 196); assert.equal(result.reviewedSpans, 30);
  assert.equal(result.checkedSilentWindows, 0);
  for (const [name, mutate] of Object.entries(mutations)) {
    const changed = structuredClone(song); mutate(changed);
    assert.throws(() => { checkTranscriptionEvidence(changed, evidence); assertSelectedEdition(changed); }, name);
  }
});
