import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { analyzeSongTiming } from "./song-report-analysis.mjs";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { getCustomSongs, getPracticeSongs, getPracticeSongId, getSongArchiveDownload,
  getSongLibrary, hasMatchingPracticeMelody, parseImportedSongs, saveCustomSongs } from "../src/song-store.js";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const tupleHash = steps => hash(JSON.stringify(steps));
const song = JSON.parse(await read("data/songs/ping-fan-zhi-lu.json"));
const archivePath = "data/archives/ping-fan-zhi-lu-v2.4.23.json";
const archiveBytes = await read(archivePath);
const archive = JSON.parse(archiveBytes);
const archiveHash = "6098bdc9bffbc2c3e3097c6a7d4343556a679f52a2151564c0b99cd2bebcbd4b";
const archiveContentHash = "87471a8807c074046e8aacf1c38f551f0d8d4c4716f4e91b63b4158aff7e701b";
const archiveTupleHash = "8dfc3b39863ac0553aab04bfd983a8c112fc2e2a657f350e923525750f2f7544";
const selectedTupleHash = "8c269ecd68549a1218d75f80b6657b4fe96833924583a03f7f3d01bb1abe2ac9";
const chorusTupleHash = "67992088814177533203b4291705d883ff4f8cb013d3009e054f47d5653466b1";
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;
const sourceUrl = "https://www.jita5.cc/jitapu/7766.html";
const rests = [[0, .5], [6, 2.5], [14, 2.5], [22, 2.5], [30, .5], [64, 4]];
const eventsFor = steps => steps.map(([name, beat, duration]) => ({ beat, duration, notes: [{ name, role: "melody", judge: true }] }));
const normalized = value => ({ ...structuredClone(value), baseSongId: value.id, arrangementKind: "melody",
  judgementMode: "melody", source: "system", events: eventsFor(value.steps) });
const phrase = (from, to, steps = song.steps) => steps.filter(([, beat]) => beat >= from && beat < to);
const overlap = (from, to, steps = song.steps) => steps.filter(([, beat, duration]) => beat < to && beat + duration > from);

// Frozen BEFORE adoption from the independently source-reviewed candidate and
// per-bar evidence (SHA256 9862e69e...ade6795). These are encoding fingerprints,
// not another source reading. Raw glyph maps, lyrics, scans and omitted guitar
// notation stay private. Complete crossing attacks overlap both adjacent bars.
const barSpanHashes = [
  "07dfc41a7af3429e1a7bf18577215984560b0778616370b060698b2e780d9119",
  "e4a394e77c3c055df026dd128b91444dd6d44b1ed37342923e4785c8312ae83b",
  "d0b938b7698a953ac0c734ad009523f371393ea0e7fc1dddf25abd5aa2e9cb0b",
  "73af5f26ab919d163313c41bc562fc3dea4433d7311c5404f21c8456cb5f2653",
  "67090377edf9cfb674b21eddf598c70c994400fc79ea25b6c99c65fe871e8db3",
  "459251cde7be3cc15ae4b8a38f973eed22c5e8aab1cc92ba557675c4634f7f98",
  "805b6d38a63fb9adb30865f0afc619e4c98b8bdbd9fb6088c32dc6809c54efc3",
  "13a42f7c6b3ab8dc4f11c3c7d72a7ece7a31e2b21c7a99795c0ca9b39ebca835",
  "2357e79e5a73bb6f189c3db3c8876d9ef5bb5a3fb1ae1d086f8b085e53feeda4",
  "1b6a973a16d7dcc544a5e9d1a96ef87f1cf6f4578b204492c58026dd6814a82c",
  "78c897703418b4926655ced3fea085df32d02c2f9dcbbb6badd0917b687a1a16",
  "89b1bb4dc9a8be31be97ff64bb1c3bdc5c9485cc7b527ab91923b6b98ece21bb",
  "0870f909c52ce91f4b7db3136ad8065d0229bec1cc4258aea0dabe65f623e6b9",
  "e477945880527a2add7565f158e328dfc4440353d6da04d3d70fd9b89631d784",
  "6bb43567035ed9f56059b56aa9fbd81a1bc7c36bbbb7775e591c064dc28f66e8",
  "1d9a60a7d6c61fa1bffe33de2f6960c9b809a666b93c308c4a09f8fc2a5a033c",
  "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
];

function assertReviewedEncoding(value) {
  assert.equal(value.steps.length, 93);
  assert.equal(tupleHash(value.steps), selectedTupleHash, "exact independently reviewed 93-tuple encoding");
  assert.equal(value.sourceFeatures.sourceTotalBeats, 68);
  assert.equal(value.bpm, 80);
  assert.equal(value.beatsPerMeasure, 4);
  assert.deepEqual(analyzeSongTiming(value).melodyGaps.map(({ beat, duration }) => [beat, duration]), rests);
  for (const field of ["events", "rhythm", "autoAccompaniment", "practiceAccompaniment"]) assert.equal(value[field], undefined);
  assert.equal(value.sourceFeatures.sourceReview.currentScopeReview.silentWindows, undefined,
    "vocal rests must not become assertions that the source guitar was silent");
}

function withIsolatedStorage(run) {
  const before = globalThis.localStorage, values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
  try { return run(); } finally { if (before === undefined) delete globalThis.localStorage; else globalThis.localStorage = before; }
}

test("selected 93 attacks exactly retain the reviewed complete short-edition vocal line", () => {
  assertReviewedEncoding(song);
  assert.equal(song.schemaVersion, 1);
  assert.equal(song.id, "ping-fan-zhi-lu");
  assert.equal(song.title, "《平凡之路》（主歌＋副歌短版）");
  assert.equal(song.practiceTitle, `${song.title}练习轨道`);
  assert.equal(song.scoreTitle, `${song.title}简谱进度`);
  assert.match(song.hint, /破晓\/弹琴吧.*第5–21小节.*93.*68拍.*原谱80 BPM/);
  assert.match(song.hint, /开头、句间及末尾人声休止.*十六分音符.*A5.*慢速分段/);
  assert.doesNotMatch(song.hint, /候选|曲谱建议|0\.75|完整原唱|旧版|还原|更简单|更好听/);
});

test("all 17 source bars retain their own overlap fingerprints and exact source alignment", () => {
  let comparisons = 0;
  for (const [index, expected] of barSpanHashes.entries()) {
    const attacks = overlap(index * 4, index * 4 + 4);
    assert.equal(tupleHash(attacks), expected, `source m${index + 5}`);
    comparisons += attacks.length;
  }
  assert.equal(comparisons, 96, "three cross-bar holds overlap two bars without extra attacks");
  assert.equal(song.sourceFeatures.sourceMeasureCount, 17);
  assert.deepEqual(current.sourceMeasureRange, [5, 21]);
  assert.deepEqual(current.sourceBeatRange, [16, 84]);
  assert.equal(current.sourceToExcerptBeatOffset, -16);
  assert.deepEqual(current.reviewedBeatRanges, [[0, 68]]);
  assert.equal(current.pickupBeats, 0);
  assert.equal(current.firstFullMeasureAtBeat, 0);
  assert.deepEqual(song.steps[0], ["E4", .5, .5]);
  assert.equal(current.rawNoteheadCount, 131);
  assert.equal(current.tieContinuationCount, 38);
  assert.equal(current.selectedAttacks, 131 - 38);
  assert.equal(song.sourceFeatures.hasRepeats, false);
});

test("all 62 previously reviewed chorus attacks remain an exact +30.5 translation", () => {
  const chorus = phrase(30.5, 68).map(([name, beat, duration]) => [name, beat - 30.5, duration]);
  assert.equal(chorus.length, 62);
  assert.equal(tupleHash(chorus), chorusTupleHash);
  assert.equal(tupleHash(phrase(0, 30.5)), "bb966be39db792d03f6b1c29b278b9d3ef8e6eaee5fc5f0882e514970671086e");
  assert.deepEqual(phrase(30.5, 32), [["G4", 30.5, .5], ["A4", 31, .5], ["B4", 31.5, .5]]);
});

test("three cross-bar ties remain held while their preceding real repetitions stay separate", () => {
  const ties = [["E4", 3.75, 2.25], ["E4", 19.75, 2.25], ["C4", 27.75, 2.25]];
  assert.deepEqual(current.crossBarTies.map(({ note, attackBeat, duration }) => [note, attackBeat, duration]), ties);
  for (const expected of ties) assert.deepEqual(song.steps.find(([, beat]) => beat === expected[1]), expected);
  for (const beat of [4, 20, 28]) assert.equal(song.steps.some(([, onset]) => onset === beat), false);
  assert.deepEqual(phrase(3.5, 4), [["E4", 3.5, .25], ["E4", 3.75, 2.25]]);
  assert.deepEqual(phrase(27.5, 28), [["C4", 27.5, .25], ["C4", 27.75, 2.25]]);
});

test("similar verse occurrences preserve different A4 articulation and literal C4 register", () => {
  assert.deepEqual(phrase(1.5, 2.5), [["A4", 1.5, .25], ["A4", 1.75, .75]]);
  assert.deepEqual(phrase(17.5, 18.5), [["A4", 17.5, 1]]);
  assert.deepEqual(phrase(10.5, 12), [["G4", 10.5, .25], ["G4", 10.75, 1.25]]);
  for (const beat of [2.5, 18.5, 19, 25.5, 27.5, 27.75]) assert.equal(song.steps.find(([, b]) => b === beat)[0], "C4");
  assert.deepEqual(phrase(26, 27), [["F4", 26, .5], ["F4", 26.5, .5]]);
});

test("six exact written vocal gaps survive without an all-layer source-silence claim", () => {
  assert.deepEqual(current.melodyOnlyRestWindows.map(({ beat, duration }) => [beat, duration]), rests);
  assert.ok(current.melodyOnlyRestWindows.every(({ voice }) => voice === "selected-vocal-only"));
  assert.equal(rests.reduce((sum, [, duration]) => sum + duration, 0), 12.5);
  for (const [beat, duration] of rests) assert.deepEqual(overlap(beat, beat + duration), []);
  assert.match(current.restScope, /guitar.*C strum.*no source-all-layer silence/i);
  assert.equal(current.silentWindows, undefined);
  const report = analyzeSongTiming(song);
  assert.equal(report.allLayerSilenceConflicts.length, 0);
  assert.equal(report.claims.allLayerSilent.length, 0);
  assert.equal(report.claims.melodyOnly.length, 6);
  assert.equal(report.unannotatedLongGaps.length, 0);
  assert.ok(report.melodyGaps.every(({ declarations }) => declarations.length === 1 &&
    declarations[0].meaning === "declared-melody-only-rest"));
  assert.deepEqual(song.steps.at(-1), ["C5", 62, 2]);
  assert.deepEqual(phrase(61.75, 68), [["C5", 61.75, .25], ["C5", 62, 2]]);
  assert.equal(getPracticeTotalBeats(eventsFor(song.steps), song), 68);
  assert.equal(current.endingRestBeats, 4);
  assert.equal(current.selectedEndIsFullSongEnding, false);
  assert.equal(current.selectedEndIsShortEditionVocalEnding, true);
});

test("natural C4–A5, literal octave dots and zero transposition remain conditional in difficulty", () => {
  const allowed = new Set(DISPLAY_KEYS.map(({ name }) => name));
  const pitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = name => 12 * (Number(name.slice(1)) + 1) + pitch[name[0]];
  for (const [name] of song.steps) assert.ok(allowed.has(name));
  const numbers = song.steps.map(([name]) => midi(name));
  assert.deepEqual([Math.min(...numbers), Math.max(...numbers)], [60, 81]);
  assert.deepEqual([...new Set(song.steps.map(([name]) => pitch[name[0]]))].sort((a, b) => a - b), [0, 2, 4, 5, 7, 9, 11]);
  assert.equal(Math.min(...song.steps.slice(1).map(([, beat], i) => beat - song.steps[i][1])), .25);
  assert.equal(Math.max(...numbers.slice(1).map((note, i) => Math.abs(note - numbers[i]))), 9);
  assert.deepEqual(phrase(49.5, 52), [["E5", 49.5, .5], ["A5", 50, .75], ["G5", 50.75, .75], ["F5", 51.5, .5]]);
  assert.equal(song.difficulty, "medium");
  assert.equal(song.key, "C"); assert.equal(song.tuning, "21-key-c");
  assert.equal(current.transpositionSemitones, 0); assert.equal(current.globalOctaveShift, 0);
  assert.equal(current.octaveFolding, false); assert.deepEqual(current.localPitchAlterations, []);
  assert.match(current.registerConvention, /Unmarked 1=C4/);
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  assert.match(song.sourceFeatures.suitability.reason, /不保证新手容易/);
});

test("selected edition metadata retains printed80 tempo, unchanged speed suggestion and bounded provenance", () => {
  assert.equal(current.status, "reviewed-selected-short-vocal-edition");
  assert.equal(current.selectedEdition, "poxiao-tanqinba-short-vocal-m5-21");
  assert.equal(current.adoptedInVersion, "2.4.24");
  assert.equal(current.sourceUrl, sourceUrl);
  assert.equal(current.sourceVoice, "explicit-lyric-aligned-numbered-vocal-line");
  assert.equal(current.sourceQuarterBpm, 80); assert.equal(current.sourceTempoPrinted, true);
  assert.equal(song.sourceFeatures.tempoStatus, "printed-quarter-note-80");
  assert.equal(song.defaultSpeedFactor, 1); assert.equal(song.defaultSpeedFactor, archive.defaultSpeedFactor);
  assert.equal(current.oldEditionReverified, false); assert.equal(current.historicalSourceImageIdentityVerified, false);
  assert.equal(current.independentSourcesVerified, false);
  assert.match(current.versionDecision, /not proof.*old235.*wrong/);
  assert.equal(current.publicDistributionRights, "unestablished-local-preview-only");
  assert.equal(current.evidenceFingerprints.selectedTupleSha256, selectedTupleHash);
  assert.deepEqual(review.historicalSourceFeatures, archive.sourceFeatures);
});

test("frozen235 archive retains exact bytes, complete old metadata and original112-beat ending", () => {
  assert.equal(hash(archiveBytes), archiveHash);
  assert.equal(hash(JSON.stringify(archive)), archiveContentHash);
  assert.equal(tupleHash(archive.steps), archiveTupleHash);
  assert.equal(archive.id, song.id); assert.equal(archive.title, "《平凡之路》");
  assert.equal(archive.steps.length, 235); assert.equal(archive.bpm, 84);
  assert.equal(archive.sourceFeatures.sourceTotalBeats, 112);
  assert.deepEqual(archive.steps.at(-1), ["B4", 110, 2]);
  assert.equal(archive.sourceFeatures.arranger, "石头（趣弹音乐）");
  assert.match(archive.sourceFeatures.unsupported.join(" "), /最高声部/);
  assert.equal(review.archivedEdition.file, archivePath);
  assert.equal(review.archivedEdition.fileSha256, archiveHash);
  assert.equal(current.archiveImportPath, undefined); assert.equal(getSongArchiveDownload(song), null);
});

test("archive remains developer-only with one canonical card and no inherited guitar backing", async () => {
  const files = await readSongFiles();
  assert.equal(files.length, 57);
  assert.equal(files.filter(({ song: value }) => value.id === song.id).length, 1);
  assert.ok(files.every(({ fileName }) => fileName !== "ping-fan-zhi-lu-v2.4.23.json"));
  assert.ok(files.every(({ fileName }) => fileName !== "ping-fan-zhi-lu-chord.json"));
  for (const value of [song, archive]) for (const field of ["autoAccompaniment", "practiceAccompaniment"]) assert.equal(value[field], undefined);
  assert.equal(hasMatchingPracticeMelody(song, archive), false);
  assert.equal(hasMatchingPracticeMelody(song, { ...archive, bpm: 80 }), false);
  for (const file of ["service-worker.js", "serve-kalimba.js", "src/song-library.js", "src/app.js"]) {
    assert.ok(!(await read(file)).toString().includes("ping-fan-zhi-lu-v2.4.23.json"), `${file} must not expose/precache the archive`);
  }
});

test("real importer preserves all93 selected tuples and exact68-beat ending without touching the canonical song", () => {
  const selected = normalized(song), library = { [song.id]: selected }, before = JSON.stringify(library);
  const [parsed] = parseImportedSongs(JSON.stringify(song), library);
  assert.notEqual(parsed.id, song.id); assert.equal(parsed.source, "local"); assert.equal(parsed.schemaVersion, 2);
  assert.deepEqual(parsed.steps, song.steps); assert.deepEqual(parsed.sourceFeatures, song.sourceFeatures);
  assert.deepEqual(parsed.events.map(({ beat, duration, notes }) => [notes[0].name, beat, duration]), song.steps);
  assert.ok(parsed.events.every(({ notes }) => notes.length === 1 && notes[0].role === "melody" && notes[0].judge));
  assert.equal(parsed.bpm, 80); assert.equal(getPracticeTotalBeats(parsed.events, parsed), 68);
  assert.deepEqual(parsed.steps[0], ["E4", .5, .5]); assert.deepEqual(parsed.steps.at(-1), ["C5", 62, 2]);
  assert.equal(JSON.stringify(library), before);
});

test("real archive import and isolated save recover235 as an independent local song with frozen reconstruction hash", () => {
  withIsolatedStorage(() => {
    const library = getSongLibrary(); library[song.id] = normalized(song);
    const before = JSON.stringify(library), canonicalIds = getPracticeSongs(library).map(({ id }) => id).sort();
    assert.equal(canonicalIds.length, 36);
    const [restored] = parseImportedSongs(archiveBytes.toString(), library);
    assert.notEqual(restored.id, song.id); assert.notEqual(restored.baseSongId, song.id);
    assert.equal(restored.source, "local"); assert.equal(restored.schemaVersion, 2);
    assert.equal(restored.title, archive.title); assert.equal(restored.hint, archive.hint);
    assert.equal(restored.practiceTitle, `${archive.title}主旋律版练习轨道`);
    assert.equal(restored.scoreTitle, `${archive.title}主旋律版简谱进度`);
    for (const field of ["bpm", "defaultSpeedFactor", "difficulty", "beatsPerMeasure", "key"]) assert.equal(restored[field], archive[field]);
    assert.deepEqual(restored.steps, archive.steps); assert.deepEqual(restored.sourceFeatures, archive.sourceFeatures);
    assert.equal(getPracticeTotalBeats(restored.events, restored), 112);
    assert.ok(restored.events.every(({ notes }) => notes.length === 1 && notes[0].role === "melody" && notes[0].judge));
    saveCustomSongs([restored]); const [saved] = getCustomSongs();
    assert.deepEqual(saved.steps, archive.steps); assert.deepEqual(saved.sourceFeatures, archive.sourceFeatures);
    const reconstructed = { ...archive, steps: saved.steps, sourceFeatures: saved.sourceFeatures };
    for (const field of ["title", "hint", "bpm", "defaultSpeedFactor", "difficulty", "beatsPerMeasure", "key"]) reconstructed[field] = saved[field];
    assert.equal(hash(JSON.stringify(reconstructed)), archiveContentHash);
    assert.equal(JSON.stringify(library), before); assert.equal(library[song.id].steps.length, 93);
    assert.deepEqual(getPracticeSongs(library).map(({ id }) => id).sort(), canonicalIds);
    const merged = { ...library, [saved.id]: saved };
    assert.equal(getPracticeSongs(merged).length, 37); assert.equal(getPracticeSongId(merged, saved.id), saved.id);
    assert.equal(getPracticeSongId(merged, song.id), song.id);
    const [again] = parseImportedSongs(archiveBytes.toString(), merged);
    assert.notEqual(again.id, saved.id); assert.deepEqual(again.steps, archive.steps);
  });
});

const mutations = {
  "split-m5-to-m6-tie": value => { const i = value.steps.findIndex(([, b]) => b === 3.75); value.steps.splice(i, 1, ["E4", 3.75, .25], ["E4", 4, 2]); },
  "split-m9-to-m10-tie": value => { const i = value.steps.findIndex(([, b]) => b === 19.75); value.steps.splice(i, 1, ["E4", 19.75, .25], ["E4", 20, 2]); },
  "split-m11-to-m12-tie": value => { const i = value.steps.findIndex(([, b]) => b === 27.75); value.steps.splice(i, 1, ["C4", 27.75, .25], ["C4", 28, 2]); },
  "merge-m5-genuine-A4-repeat": value => { const i = value.steps.findIndex(([, b]) => b === 1.5); value.steps.splice(i, 2, ["A4", 1.5, 1]); },
  "copy-m5-articulation-into-m9": value => { const i = value.steps.findIndex(([, b]) => b === 17.5); value.steps.splice(i, 1, ["A4", 17.5, .25], ["A4", 17.75, .75]); },
  "erase-opening-eighth-rest": value => { value.steps[0] = ["E4", 0, 1]; },
  "fill-internal-vocal-rest": value => { value.steps.push(["E4", 6.5, .5]); value.steps.sort((a, b) => a[1] - b[1]); },
  "add-unprinted-verse-C4-octave-dot": value => { value.steps.find(([, b]) => b === 2.5)[0] = "C5"; },
  "lose-m17-upper-octave-dot": value => { value.steps.find(([, b]) => b === 50)[0] = "A4"; },
  "merge-final-real-repluck": value => { const i = value.steps.findIndex(([, b]) => b === 61.75); value.steps.splice(i, 2, ["C5", 61.75, 2.25]); },
  "stretch-final-C5-through-vocal-rest": value => { value.steps.at(-1)[2] = 6; },
  "truncate-final-source-extent": value => { value.sourceFeatures.sourceTotalBeats = 64; },
  "retain-historical84-tempo": value => { value.bpm = 84; },
  "invent-source-all-layer-silence": value => { value.sourceFeatures.sourceReview.currentScopeReview.silentWindows = [{ beat: 64, duration: 4 }]; },
  "insert-guitar-backing": value => { value.autoAccompaniment = { enabledByDefault: false, events: [] }; }
};
for (const [label, mutate] of Object.entries(mutations)) test(`reviewed encoding contract rejects ${label}`, () => {
  const changed = structuredClone(song); mutate(changed); assert.throws(() => assertReviewedEncoding(changed));
});
