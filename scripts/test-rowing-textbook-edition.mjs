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
const id = "rang-wo-men-dang-qi-shuang-jiang";
const song = JSON.parse(await read(`data/songs/${id}.json`));
const archivePath = `data/archives/${id}-v2.4.34.json`;
const archiveBytes = await read(archivePath), archive = JSON.parse(archiveBytes);
const archiveHash = "62a0aa1a5621116ebb8d0b10691f8aaeccc0ff90ee4291019ca95b40aa795052";
const tupleHash = "f24dc597902e95be98b3888ffa98a561a901762fab014b8fa83041851cb326e0";
const sourceFixtureHash = "8d162fcf5d44d92e5e04fd694775ed0f21dc12ba0604c7eefb8386cb1fb10ec3";
const sourceUrl = "https://v.sjs.com.cn/ebooks/58E2823C.pdf";
const review = song.sourceFeatures.sourceReview, current = review.currentScopeReview;
const rests = [[0, .5], [8, .5], [35, 1], [48, 1]];
const ties = [
  { bars: [8, 9], note: "E4", beat: 14, duration: 3 },
  { bars: [17, 18], note: "G4", beat: 32, duration: 3 },
  { bars: [29, 30], note: "A4", beat: 56, duration: 4 }
];
const ornament = [{ sourceMeasure: 7, beat: 12, sourceDegree: "small grace 5 before main 6",
  sourcePitch: "Bb4", compiledPitch: "G4", duration: null,
  decision: "omit-unquantified-grace-without-stealing-main-note-time" }];

// Frozen at authoring from the independent actual-pixel reading, made before
// that reviewer saw either candidate or production tuples. Never generated from
// production at test time. Each source bar fingerprint includes complete held
// attacks overlapping its span, so 30 spans compare 66 occurrences / 63 attacks.
// [editorially counted bar, overlapping attack count, exact tuples SHA-256]
const barDecisions = [
  [1, 3, "3d46e2741861f19ff9fc3f6cbdea43fc04199944fc1bcda319cc55046fcb9fd2"],
  [2, 2, "29d3fa1cd7edea042c1e9f1b24c60b7741e7a5c66d2af54ed1899149fa7046ea"],
  [3, 3, "afdc986e065586019d9d66f72fa61bde45be5f7109c918e51b49e8c4570155fa"],
  [4, 1, "fa16335b7c582deff002b1877b984a37f7dd039f405766f24085466e90c30ff2"],
  [5, 3, "089c481b749a580e37d7a9718428d4e28a3db008911f6691736b92b7016f2eee"],
  [6, 2, "cf33c4ae0669abe71c1a26c8db2d0a43e9e74ab5158bc44027c460ff5255d4a2"],
  [7, 2, "77dbddd832c8ba00bf3ce235a84bd7ba9ec9e8dd9a9a1d3770c0dc3149c7abf6"],
  [8, 1, "2220296559774f35e2bcfb131cb6ab5a1a3e6c0a3781344121beb6451b989bd8"],
  [9, 3, "920f4b549f8f0ce03ac535c7323a130ce262e2e07454f4687abbefafa347211e"],
  [10, 1, "971304baf8fc91f4f6a00ee92736047eb4e367093dd1b18b5dee50b13e971266"],
  [11, 2, "8a6f958f0afedee66f16bcb16b2614ed3b22b1d7ac4702b656a820966c2b191b"],
  [12, 5, "07d69c06bde71f299744c7d59d63e82826a4aeeb85cbc387d0b2fc1d961f5be9"],
  [13, 3, "fda35f41587526cbbb150db1b0d1c49ef277cc9befa4d5772bcc78a378cfbd0f"],
  [14, 2, "76bdc78336a5f390c35ede934622e14eb844992685159936a041607da03cf648"],
  [15, 2, "de1f93b4000110dc80993fc2db80a6b964b8940b7a2934abe679bb9cb687c267"],
  [16, 4, "cedab125090de4bac3b3a436e88f7cb2e851900fc44cbca7ad85cc783ee63679"],
  [17, 1, "3a1b68ad0745be29d15d2dc6451fadb3b9bdcb5abfe657465ef0fa7517e35c7c"],
  [18, 1, "3a1b68ad0745be29d15d2dc6451fadb3b9bdcb5abfe657465ef0fa7517e35c7c"],
  [19, 1, "52146cfa26b823c821b04e32c8ab5696a85dcf86532a5d875e658749a35bc688"],
  [20, 2, "f23e194c6d9efafef3ab986f2ef6717f745fd16c222dc193fe0c4ab4a89295fa"],
  [21, 3, "d812833c02a755ed6b7f085f9a28888e33ac652c226361a6acb78a5578ab26c2"],
  [22, 1, "126097265d97bbdd1fff8293c6c4b2987a70b89a56db47c4e1286c7de3924308"],
  [23, 2, "b28d935735cdaf647b0b2c6b79f6068062e3d7f49c002fd6d364bd069d3661fb"],
  [24, 3, "e74c2c724ba23a145c6c95110cdf140751e498ebb87cbdd861eb966b0380589e"],
  [25, 2, "5883bdb82582e6039843f7b83367b9d463e5351826b3450b3bb624b56510a08f"],
  [26, 3, "597260f640336208a95bc2d4831b2902baaea36ba13f138838cfefc7c2494c85"],
  [27, 2, "a639e49946f10c4289e5ede4be646baf6fac9872d6dac7cf3d37fb5db3043f27"],
  [28, 4, "00baf4d51130e74fbbbcd45621b32488644da6d37a27c58e520f8cac6e0b617e"],
  [29, 1, "462f55e18b8f433cbab3abc5b3df73b9686c72cfaf1d68927efb6fd1ecedab0b"],
  [30, 1, "462f55e18b8f433cbab3abc5b3df73b9686c72cfaf1d68927efb6fd1ecedab0b"]
];
const phrase = (value, from, to) => value.steps.filter(([, b]) => b >= from && b < to);
const span = (value, from, to) => value.steps.filter(([, b, d]) => b < to && b + d > from);
const overlap = (b, d, from, to) => Math.max(0, Math.min(to, b + d) - Math.max(from, b));
const at = (value, beat) => value.steps.find(([, b]) => b === beat);
const midi = name => 12 * (Number(name.slice(1)) + 1) + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[name[0]];
const eventsFor = steps => steps.map(([name, beat, duration]) => ({ beat, duration, notes: [{ name, role: "melody", judge: true }] }));
const normalized = value => ({ ...structuredClone(value), baseSongId: value.id, source: "system",
  arrangementKind: "melody", judgementMode: "melody", events: eventsFor(value.steps) });
function assertSelectedEdition(value) {
  assert.equal(value.steps.length, 63);
  assert.equal(hash(JSON.stringify(value.steps)), tupleHash, "all 63 source-authored pitch/onset/duration decisions");
  assert.equal(value.bpm, 96); assert.equal(value.defaultSpeedFactor, .9); assert.equal(value.beatsPerMeasure, 2);
  assert.equal(value.sourceFeatures.sourceTotalBeats, 60); assert.equal(value.sourceFeatures.sourceMeasureCount, 30);
  const scope = value.sourceFeatures.sourceReview.currentScopeReview;
  assert.deepEqual(scope.reviewedBeatRanges, [[0, 60]]);
  assert.deepEqual(scope.silentWindows.map(r => [r.beat, r.duration]), rests);
  assert.deepEqual(scope.ties, ties); assert.equal(scope.tieContinuationCount, 3); assert.equal(scope.metricNoteheadCount, 66);
  assert.deepEqual(scope.omittedOrnaments, ornament);
  assert.equal(scope.sourceVoice, "explicit-lyric-aligned-verse-and-bracketed-upper-chorus");
  assert.equal(scope.sourceQuarterBpm, null); assert.equal(scope.sourceNumericTempoPrinted, false);
  assert.equal(scope.sourceTempoPrinted, true); assert.equal(scope.sourceTempoText, "稍快 优美地");
  assert.equal(scope.repeatExpansion, "none-all-30-selected-bars-written-out"); assert.equal(scope.lyricRowsAuthorizeRepeat, false);
  assert.equal(scope.transpositionSemitones, -3); assert.equal(scope.globalOctaveShift, 0); assert.equal(scope.octaveFolding, false);
  assert.deepEqual(scope.localPitchAlterations, []);
  assert.deepEqual(scope.breathMarks, [{ sourceMeasure: 13, addsBeats: 0 }, { sourceMeasure: 21, addsBeats: 0 }]);
  for (const field of ["autoAccompaniment", "practiceAccompaniment"]) assert.equal(value[field], undefined);
  for (const [bar, count, fingerprint] of barDecisions) {
    const start = (bar - 1) * 2, actual = span(value, start, start + 2);
    assert.equal(actual.length, count, `m${bar} overlapping attacks`);
    assert.equal(hash(JSON.stringify(actual)), fingerprint, `m${bar} source-authored tuples`);
    const sound = value.steps.reduce((sum, [, b, d]) => sum + overlap(b, d, start, start + 2), 0);
    const silence = rests.reduce((sum, [b, d]) => sum + overlap(b, d, start, start + 2), 0);
    assert.equal(sound + silence, 2, `m${bar} exact 2/4 balance`);
  }
}
function withIsolatedStorage(run) {
  const previous = globalThis.localStorage, values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  try { return run(values); }
  finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
}

test("selected textbook edition preserves all 63 attacks, 30 source bars and stable practice identity", () => {
  assertSelectedEdition(song);
  assert.equal(song.id, id); assert.equal(song.schemaVersion, 1); assert.equal(song.uploader, "system");
  assert.equal(song.title, "《让我们荡起双桨》（教材版）");
  assert.equal(song.practiceTitle, `${song.title}练习轨道`); assert.equal(song.scoreTitle, `${song.title}简谱进度`);
  assert.match(song.hint, /完整30小节.*63次起音、60拍.*降E调.*C调.*三处延音线及四处休止/);
  assert.match(song.hint, /第7小节非定量倚音.*副歌下声部.*不按三行歌词增加反复.*96 BPM为练习设定/);
  assert.doesNotMatch(song.hint, /旧版|还原|更容易|原唱全曲/);
  assert.equal(current.distinctPrintedMelodyMeasures, 30); assert.deepEqual(current.sourceMeasureRange, [1, 30]);
  assert.deepEqual(current.selectedRoute, [
    { sourceMeasures: [1, 18], beats: [0, 36], voice: "lyric-aligned-single-verse" },
    { sourceMeasures: [19, 30], beats: [36, 60], voice: "lyric-aligned-upper-chorus" }
  ]);
  assert.deepEqual(current.excludedSections, []); assert.match(current.sourceMeasureNumbers, /Editorially counted/);
  assert.deepEqual(barDecisions.map(([bar]) => bar), Array.from({ length: 30 }, (_, i) => i + 1));
  assert.equal(barDecisions.reduce((sum, [, count]) => sum + count, 0), 66);
  assert.equal(song.sourceFeatures.hasRepeats, false); assert.equal(current.repeatSignsPresent, false);
  assert.match(current.formDecision, /three verse lyric rows do not authorize repeat expansion/);
  assert.equal(getSongMeterLabel(song), "2/4");
});

test("three genuine ties remain one attack each; independent repeats, slurs and sixteenths stay distinct", () => {
  for (const { beat, note, duration } of ties) assert.deepEqual(at(song, beat), [note, beat, duration]);
  for (const continuation of [16, 34, 58]) assert.equal(at(song, continuation), undefined);
  assert.deepEqual(phrase(song, 10, 12), [["G4", 10, 1.5], ["G4", 11.5, .5]]);
  assert.deepEqual(phrase(song, 14, 18), [["E4", 14, 3], ["E4", 17, .5], ["G4", 17.5, .5]]);
  assert.deepEqual(phrase(song, 38, 40), [["A4", 38, 1.5], ["A4", 39.5, .5]]);
  assert.deepEqual(phrase(song, 50, 52), [["E4", 50, 1], ["G4", 51, .75], ["G4", 51.75, .25]]);
  assert.deepEqual(phrase(song, 22, 24), [["C5", 22, .5], ["B4", 22.5, .25], ["A4", 22.75, .25], ["G4", 23, .5], ["A4", 23.5, .5]]);
  assert.deepEqual(phrase(song, 40, 42), [["G4", 40, .5], ["F4", 40.5, .5], ["E4", 41, 1]]);
  assert.deepEqual(current.tuplets, []);
});

test("all four source rests include the weak start; final A4 tie ends exactly at 60 without invented silence", () => {
  const analysis = analyzeSongTiming(song);
  assert.deepEqual(analysis.melodyGaps.map(({ beat, duration }) => [beat, duration]), rests);
  assert.equal(analysis.claims.allLayerSilent.length, 4); assert.equal(analysis.claims.melodyOnly.length, 0);
  assert.deepEqual(analysis.unannotatedLongGaps, []); assert.deepEqual(analysis.issues, []);
  assert.ok(analysis.melodyGaps.every(({ declarations }) => declarations.length === 1 && declarations[0].meaning === "declared-all-layer-silence"));
  assert.equal(current.allLayerSilenceClaim, true); assert.match(current.restScope, /single-melody adaptation/);
  assert.equal(current.initialMelodyRestBeats, .5); assert.equal(current.pickupBeats, 0); assert.equal(current.endingRestBeats, 0);
  for (const [beat, duration] of rests) assert.ok(song.steps.every(([, b, d]) => b >= beat + duration || b + d <= beat));
  assert.equal(song.steps.reduce((sum, [, , d]) => sum + d, 0), 57);
  assert.deepEqual(song.steps.at(-1), ["A4", 56, 4]);
  const events = eventsFor(song.steps);
  assert.equal(getPracticeTotalBeats(events, song), 60);
  const endLoop = createLoopRange(events, 60, 60, 4);
  assert.deepEqual(endLoop, { startBeat: 56, endBeat: 60 }); assert.equal(isBeatInLoop(60, endLoop), false);
  assert.equal(current.selectedEndIsSelectedEditionEnding, true); assert.equal(current.selectedEndIsFullSongEnding, false);
  for (const field of ["events", "rhythm", "autoAccompaniment", "practiceAccompaniment"]) assert.equal(song[field], undefined);
});

test("unquantified grace omission is explicit and neither it nor breath marks steal metric time", () => {
  assert.deepEqual(phrase(song, 12, 14), [["A4", 12, 1], ["D4", 13, 1]]);
  assert.deepEqual(at(song, 24), ["E4", 24, 1]); assert.deepEqual(at(song, 41), ["E4", 41, 1]);
  assert.match(current.ornamentDecision, /deliberately omitted.*No guessed duration.*not an ornament-complete/);
  assert.match(current.voiceDecision, /lyrics align.*not the highest note.*lower chorus voice is omitted/i);
  assert.deepEqual(at(song, 36), ["E4", 36, 2]);
});

test("one Eb-to-C transposition preserves all scale intervals and A3–C5 register; practice demands remain conditional", () => {
  const keys = new Set(DISPLAY_KEYS.map(k => k.name)); for (const [name] of song.steps) assert.ok(keys.has(name));
  assert.deepEqual(current.sourcePitchClasses, [0, 2, 3, 5, 7, 8, 10]);
  assert.deepEqual(fittingTranspositions(current.sourcePitchClasses), [9]);
  assert.deepEqual([...new Set(song.steps.map(([name]) => midi(name) % 12))].sort((a, b) => a - b), [0, 2, 4, 5, 7, 9, 11]);
  assert.deepEqual(current.sourceRange, ["C4", "Eb5"]); assert.deepEqual(current.compiledRange, ["A3", "C5"]);
  assert.deepEqual([Math.min(...song.steps.map(([name]) => midi(name))), Math.max(...song.steps.map(([name]) => midi(name)))], [57, 72]);
  assert.deepEqual(current.sourceKeySignatureAccidentals, ["Bb", "Eb", "Ab"]); assert.deepEqual(current.additionalMelodyAccidentals, []);
  assert.equal(song.key, "C"); assert.equal(song.tuning, "21-key-c");
  const positions = new Map(DISPLAY_KEYS.map(({ name }, i) => [name, i])), side = name => Math.sign(positions.get(name) - 10);
  const pairs = song.steps.slice(1).map(([name, beat], i) => ({ name, beat, previous: song.steps[i] }));
  assert.equal(Math.min(...pairs.map(p => p.beat - p.previous[1])), .25);
  assert.equal(Math.min(...pairs.filter(p => side(p.name) === side(p.previous[0])).map(p => p.beat - p.previous[1])), .5);
  assert.equal(Math.max(...pairs.map(p => Math.abs(positions.get(p.name) - positions.get(p.previous[0])))), 11);
  assert.deepEqual(phrase(song, 45.5, 46.5), [["G4", 45.5, .5], ["A3", 46, .5]]);
  assert.equal(midi("G4") - midi("A3"), 10); assert.equal(Math.abs(positions.get("G4") - positions.get("A3")), 3);
  assert.equal(.25 * 60000 / song.bpm, 156.25); assert.ok(Math.abs(.25 * 60000 / (song.bpm * .9) - 173.61111111111111) < 1e-9);
  assert.equal(song.bpm, archive.bpm); assert.equal(song.defaultSpeedFactor, archive.defaultSpeedFactor);
  assert.equal(song.difficulty, "medium"); assert.equal(song.sourceFeatures.suitability.status, "conditional");
});

test("source and history claims preserve edition boundaries and separate unperformed acceptance gates", () => {
  assert.equal(current.status, "reviewed-selected-complete-textbook-melody"); assert.equal(current.adoptedInVersion, "2.4.35");
  assert.equal(current.sourceUrl, sourceUrl); assert.deepEqual(current.printedPages, [36, 37]); assert.deepEqual(current.pdfPages, [41, 42]);
  assert.equal(current.sourcePdfSha256, "07cc8f5d3815c0e481e72cf31e843d24735875b7bb2cecf1b9911375f7ff9d37");
  assert.equal(current.sourceKey, "Eb"); assert.equal(current.sourceMeter, "2/4"); assert.equal(current.beatUnit, "quarter-note");
  assert.match(current.tempoDecision, /96 BPM is an editorial practice choice/);
  assert.equal(current.oldEditionReverified, false); assert.equal(current.historicalSourceImageIdentityVerified, false);
  assert.equal(current.independentSourcesVerified, false); assert.match(current.versionDecision, /does not prove.*wrong/);
  assert.deepEqual(review.historicalSourceFeatures, archive.sourceFeatures);
  assert.equal(current.publicDistributionRights, "unestablished-private-preview-only");
  assert.equal(current.referenceListening, "not-performed"); assert.equal(current.browserAudio, "not-performed-at-data-adoption");
  assert.equal(current.physicalKalimba, "not-performed"); assert.equal(current.independentSourceTupleSha256, tupleHash);
});

test("prior 63-attack archive retains every exact byte and mixed register without a new card, route or restore UI", async () => {
  assert.equal(hash(archiveBytes), archiveHash);
  assert.equal(archive.id, song.id); assert.equal(archive.steps.length, 63); assert.equal(archive.title, "《让我们荡起双桨》");
  assert.equal(archive.bpm, 96); assert.equal(archive.beatsPerMeasure, 2); assert.equal(archive.defaultSpeedFactor, .9);
  assert.deepEqual(archive.steps.map(([, b, d]) => [b, d]), song.steps.map(([, b, d]) => [b, d]));
  assert.deepEqual(archive.steps.map(([name], i) => midi(name) - midi(song.steps[i][0])), [...Array(54).fill(12), ...Array(9).fill(0)]);
  assert.equal(archive.steps[53][1], 50); assert.equal(archive.steps[54][1], 51);
  assert.equal(review.archivedEdition.file, archivePath); assert.equal(review.archivedEdition.fileSha256, archiveHash);
  assert.equal(current.archiveImportPath, undefined); assert.equal(getSongArchiveDownload(song), null);
  const files = await readSongFiles();
  assert.equal(files.length, 58); assert.equal(files.filter(({ song: s }) => s.schemaVersion === 1).length, 37);
  assert.equal(files.filter(({ song: s }) => s.schemaVersion === 2).length, 21);
  assert.equal(files.filter(({ song: s }) => s.id === id).length, 1);
  assert.equal(files.filter(({ song: s }) => s.id.startsWith(`${id}-`)).length, 0);
  assert.ok(files.every(({ fileName }) => fileName !== `${id}-v2.4.34.json`));
  for (const file of ["service-worker.js", "serve-kalimba.js", "src/app.js", "src/song-library.js"])
    assert.ok(!(await read(file)).toString().includes(`${id}-v2.4.34.json`), `${file} must not expose or precache archive`);
});

test("real importer and storage recover every old value independently, preserve canonical links, selection and saved speed", () => {
  withIsolatedStorage(values => {
    const speedBytes = JSON.stringify({ schemaVersion: 1, songs: { [id]: { speed: .65 } } });
    values.set(SONG_SPEED_STORAGE_KEY, speedBytes); values.set(CURRENT_SONG_STORAGE_KEY, id);
    // Install the actual changed source in this in-memory library so adoption
    // tests also run before the separate integration owner rebuilds src/songs.js.
    const library = getSongLibrary(); library[id] = normalized(song);
    const before = JSON.stringify(library), previousIds = getPracticeSongs(library).map(s => s.id).sort();
    assert.equal(Object.keys(library).length, 58); assert.equal(previousIds.length, 37);
    assert.equal(getPracticeSongId(library, id), id);
    const [restored] = parseImportedSongs(archiveBytes.toString(), library);
    assert.deepEqual(restored.steps, archive.steps); assert.deepEqual(restored.sourceFeatures, archive.sourceFeatures);
    assert.equal(restored.schemaVersion, 2); assert.equal(restored.source, "local");
    assert.notEqual(restored.id, id); assert.notEqual(restored.baseSongId, id);
    assert.equal(restored.bpm, 96); assert.equal(restored.beatsPerMeasure, 2); assert.equal(restored.defaultSpeedFactor, .9);
    assert.equal(getPracticeTotalBeats(restored.events, restored), 60);
    saveCustomSongs([restored]); const [saved] = getCustomSongs();
    const normalizedFields = new Set(["schemaVersion", "id", "uploader", "practiceTitle", "scoreTitle"]);
    const reconstructed = Object.fromEntries(Object.keys(archive).map(key => [key, normalizedFields.has(key) ? archive[key] : saved[key]]));
    assert.deepEqual(reconstructed, archive, "all old values survive after reversing only documented identity/schema/display normalization");
    assert.equal(JSON.stringify(library), before); assert.deepEqual(library[id].steps, song.steps);
    assert.deepEqual(getPracticeSongs(library).map(s => s.id).sort(), previousIds);
    const merged = { ...library, [restored.id]: restored };
    assert.equal(getPracticeSongs(merged).length, 38); assert.equal(getPracticeSongId(merged, id), id);
    assert.equal(getPracticeSongId(merged, restored.id), restored.id);
    const [again] = parseImportedSongs(archiveBytes.toString(), merged);
    assert.notEqual(again.id, restored.id); assert.deepEqual(again.steps, archive.steps);
    const [selected] = parseImportedSongs(JSON.stringify(song), merged); assertSelectedEdition(selected);
    assert.deepEqual(selected.events.map(e => [e.notes[0].name, e.beat, e.duration]), song.steps);
    assert.ok(selected.events.every(e => e.notes.length === 1 && e.notes[0].role === "melody" && e.notes[0].judge === true));
    assert.equal(values.get(SONG_SPEED_STORAGE_KEY), speedBytes); assert.deepEqual(readSongSpeed(globalThis.localStorage, id), { speed: .65 });
    assert.equal(values.get(CURRENT_SONG_STORAGE_KEY), id);
  });
});

test("explicit-melody V2 import preserves the selected source; structure alone cannot approve an in-range wrong octave", () => {
  withIsolatedStorage(() => {
    const v2 = { ...structuredClone(song), schemaVersion: 2, arrangementKind: "melody", judgementMode: "melody",
      events: eventsFor(song.steps), rhythm: { sourceStatus: "verified", restWindows: rests.map(([beat, duration]) => ({ beat, duration, policy: "silent" })) } };
    delete v2.steps;
    const [imported] = parseImportedSongs(JSON.stringify(v2), getSongLibrary());
    assert.deepEqual(imported.events.map(e => [e.notes[0].name, e.beat, e.duration]), song.steps);
    assert.equal(getPracticeTotalBeats(imported.events, imported), 60); assert.equal(getSongMeterLabel(imported), "2/4");
    const unsafe = structuredClone(v2); unsafe.practiceAccompaniment = null;
    assert.throws(() => parseImportedSongs(JSON.stringify(unsafe), getSongLibrary()), /practiceAccompaniment/);
    const ambiguous = structuredClone(v2); ambiguous.events[0].notes.push({ name: "C4", role: "melody", judge: false });
    assert.throws(() => parseImportedSongs(JSON.stringify(ambiguous), getSongLibrary()));
    const outOfRange = structuredClone(v2); outOfRange.events[0].notes[0].name = "E3";
    assert.throws(() => parseImportedSongs(JSON.stringify(outOfRange), getSongLibrary()));
    const wrong = structuredClone(v2); wrong.events.find(e => e.beat === 22).notes[0].name = "C4";
    const [structurallyValid] = parseImportedSongs(JSON.stringify(wrong), getSongLibrary());
    assert.throws(() => assertSelectedEdition(structurallyValid));
  });
});

test("old melody cannot supply either backing path; matching timings and identity are insufficient", () => {
  assert.equal(hasMatchingPracticeMelody(song, archive), false);
  assert.equal(getSongAccompanimentProvider(normalized(song), []), null);
  // Synthetic backing only exercises provider safety; no such arrangement is
  // added to the library and these notes are not musical/source evidence.
  const backing = { enabledByDefault: false, volume: .3, events: [{ beat: 2, duration: 1, notes: [{ name: "C4", role: "bass", velocity: .3 }] }] };
  const oldBacked = { ...normalized(archive), id: `${id}-synthetic-old-backing`, baseSongId: id, schemaVersion: 2,
    autoAccompaniment: structuredClone(backing), practiceAccompaniment: structuredClone(backing) };
  assert.equal(getSongAccompanimentProvider(normalized(song), [oldBacked]), null);
  assert.equal(getSongAccompanimentProvider(normalized(song), [oldBacked], true), null);
  const control = { ...oldBacked, steps: structuredClone(song.steps), events: eventsFor(song.steps), sourceFeatures: structuredClone(song.sourceFeatures) };
  assert.equal(getSongAccompanimentProvider(normalized(song), [control]).kind, "light");
  assert.equal(getSongAccompanimentProvider(normalized(song), [control], true).kind, "original");
});

const remove = (value, beat) => { value.steps = value.steps.filter(([, b]) => b !== beat); };
const splitTie = (value, beat, continuation) => {
  const step = at(value, beat), remaining = step[1] + step[2] - continuation; step[2] = continuation - beat;
  value.steps.push([step[0], continuation, remaining]); value.steps.sort((a, b) => a[1] - b[1]);
};
const mergeRepeat = (value, beat, nextBeat) => { const next = at(value, nextBeat); at(value, beat)[2] = nextBeat + next[2] - beat; remove(value, nextBeat); };
const scope = value => value.sourceFeatures.sourceReview.currentScopeReview;
const mutations = {
  "split-m8-m9-tie": s => splitTie(s, 14, 16),
  "split-m17-m18-tie": s => splitTie(s, 32, 34),
  "split-final-m29-m30-tie": s => splitTie(s, 56, 58),
  "merge-m6-independent-repeat": s => mergeRepeat(s, 10, 11.5),
  "merge-m9-post-tie-reattack": s => mergeRepeat(s, 14, 17),
  "merge-m20-independent-repeat": s => mergeRepeat(s, 38, 39.5),
  "merge-m26-dotted-repeat": s => mergeRepeat(s, 51, 51.75),
  "merge-different-pitch-chorus-slur": s => { at(s, 40)[2] = 1; remove(s, 40.5); },
  "invent-timed-verse-breath": s => { at(s, 24)[2] = .75; },
  "invent-timed-chorus-breath": s => { at(s, 41)[2] = .75; },
  "erase-weak-half-beat-start": s => { at(s, .5)[1] = 0; },
  "lose-upper-tonic-dot": s => { at(s, 22)[0] = "C4"; },
  "copy-wrong-later-low-six-register": s => { at(s, 46)[0] = "A4"; },
  "select-lower-chorus-voice": s => { at(s, 36)[0] = "C4"; },
  "replace-source-sixteenths-with-even-eighths": s => {
    s.steps = s.steps.filter(([, b]) => b < 22 || b >= 24);
    s.steps.push(["C5", 22, .5], ["B4", 22.5, .5], ["A4", 23, .5], ["G4", 23.5, .5]); s.steps.sort((a, b) => a[1] - b[1]);
  },
  "quantize-grace-by-stealing-main-time": s => { at(s, 12)[1] = 12.25; at(s, 12.25)[2] = .75; s.steps.push(["G4", 12, .25]); s.steps.sort((a, b) => a[1] - b[1]); },
  "erase-grace-disclosure": s => { scope(s).omittedOrnaments = []; },
  "claim-grace-has-source-duration": s => { scope(s).omittedOrnaments[0].duration = .25; },
  "clip-final-tie": s => { at(s, 56)[2] = 2; },
  "invent-final-rest": s => { s.sourceFeatures.sourceTotalBeats = 62; },
  "erase-rest-declaration": s => { scope(s).silentWindows.pop(); },
  "double-quarter-beat-timebase": s => { s.steps.forEach(t => { t[1] *= 2; t[2] *= 2; }); s.sourceFeatures.sourceTotalBeats = 120; },
  "invent-three-lyric-traversals": s => { const original = structuredClone(s.steps); for (const shift of [60, 120]) s.steps.push(...original.map(([n, b, d]) => [n, b + shift, d])); s.sourceFeatures.sourceTotalBeats = 180; },
  "retain-legacy-mixed-register": s => { s.steps = structuredClone(archive.steps); },
  "lower-entire-old-file-including-final-nine": s => { s.steps = archive.steps.map(([n, b, d]) => [n[0] + (Number(n.slice(1)) - 1), b, d]); },
  "invent-printed-metronome-mark": s => { scope(s).sourceQuarterBpm = 96; },
  "replace-practice-bpm": s => { s.bpm = 84; },
  "overwrite-speed-suggestion": s => { s.defaultSpeedFactor = .55; },
  "change-melody-role-to-highest-note": s => { scope(s).sourceVoice = "highest-note-heuristic"; },
  "allow-local-octave-folding": s => { scope(s).octaveFolding = true; },
  "add-automatic-backing": s => { s.autoAccompaniment = { events: [{ beat: 2, duration: 1, notes: ["C4"] }] }; },
  "add-practice-backing": s => { s.practiceAccompaniment = { events: [{ beat: 2, duration: 1, notes: ["C4"] }] }; }
};
for (const [beat, duration] of rests) mutations[`fill-source-rest-at-${beat}`] = s => {
  s.steps.push(["C4", beat, duration]); s.steps.sort((a, b) => a[1] - b[1]);
};
for (const [name, mutate] of Object.entries(mutations)) test(`source-decision locks reject ${name}`, () => {
  const changed = structuredClone(song); mutate(changed); assert.throws(() => assertSelectedEdition(changed));
});

// The actual frozen blind-review fixture stays private. Absence is an explicit
// portable skip, never a claim that source inspection or this check occurred.
// It has no songId because it predates the candidate: add only the canonical
// identity in memory for the checker; never rewrite its bytes or musical data.
const evidencePath = process.env.ROWING_SOURCE_EVIDENCE_PATH;
test("explicit private independent source fixture checks 63 attacks across 30 overlapping bar spans", {
  skip: evidencePath ? false : "Set ROWING_SOURCE_EVIDENCE_PATH to the private independent-source-evidence.json; source-fixture check not performed"
}, async () => {
  const bytes = await readFile(evidencePath); assert.equal(hash(bytes), sourceFixtureHash);
  const source = JSON.parse(bytes); assert.equal(source.songId, undefined); assert.equal(source.source.reference, sourceUrl);
  assert.equal(source.melodySpans.length, 30); assert.equal(source.sourceTotalBeats, 60);
  assert.deepEqual(source.melodySpans.map(s => [s.bar, s.from, s.to]), Array.from({ length: 30 }, (_, i) => [i + 1, i * 2, (i + 1) * 2]));
  assert.equal(hash(JSON.stringify(source.attacks)), tupleHash);
  assert.deepEqual(source.melodySpans.map(s => [s.bar, s.attacks.length, hash(JSON.stringify(s.attacks))]), barDecisions);
  assert.deepEqual(source.silentWindows.map(r => [r.beat, r.duration]), rests);
  assert.deepEqual(source.pitchFit, { sourcePitchClasses: [0, 2, 3, 5, 7, 8, 10], semitoneShift: -3 });
  assert.deepEqual(source.sourceTies, ties); assert.equal(source.omittedOrUnquantified.length, 1);
  const evidence = { ...source, songId: id }, result = checkTranscriptionEvidence(song, evidence);
  assert.equal(result.checkedAttacks, 66); assert.equal(result.reviewedSpans, 30);
  for (const [name, mutate] of Object.entries(mutations)) {
    const changed = structuredClone(song); mutate(changed);
    assert.throws(() => { checkTranscriptionEvidence(changed, evidence); assertSelectedEdition(changed); }, name);
  }
});
