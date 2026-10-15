import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";
import { getPracticeSongs, getPracticeSongId, hasMatchingPracticeMelody, parseImportedSongs } from "../src/song-store.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { checkTranscriptionEvidence } from "../skills/kalimba-tone-trace-compiler/scripts/check-transcription-evidence.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const songBytes = await read("data/songs/ling-er-xiang-ding-dang.json");
const song = JSON.parse(songBytes);
const archivePath = "data/archives/ling-er-xiang-ding-dang-v2.4.15.json";
const archiveBytes = await read(archivePath);
const archive = JSON.parse(archiveBytes);
const siblingBytes = await read("data/songs/ling-er-xiang-ding-dang-chord.json");
const sibling = JSON.parse(siblingBytes);
const archiveHash = "8309ad1fea7f60b373e204c2fb952b345999b9981e139b8db8c68fbc3782f9d9";
const siblingHash = "c28df5631e09a1dcce5e28fc7b32c3ec86d1ff858c2032daff9c91de888bafa8";
const sourceUrl = "https://www.christmasmusicsongs.com/PDFleadsheets/jingle-bells-easy-lead-sheet.pdf";
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;

// Recorded from independently reopened source pixels BEFORE the production edit.
// Coughlin's complete 16-bar short refrain, globally +5 semitones from G to C.
// Similar occurrences and the two cadences were read separately. This does not
// adjudicate the unavailable original source of the archived 49-attack edition.
const bars = [
  [["E5",0,1],["E5",1,1],["E5",2,2]],
  [["E5",4,1],["E5",5,1],["E5",6,2]],
  [["E5",8,1],["G5",9,1],["C5",10,1],["D5",11,1]],
  [["E5",12,4]],
  [["F5",16,1],["F5",17,1],["F5",18,1],["F5",19,1]],
  [["F5",20,1],["E5",21,1],["E5",22,1],["E5",23,.5],["E5",23.5,.5]],
  [["E5",24,1],["D5",25,1],["D5",26,1],["E5",27,1]],
  [["D5",28,2],["G5",30,2]],
  [["E5",32,1],["E5",33,1],["E5",34,2]],
  [["E5",36,1],["E5",37,1],["E5",38,2]],
  [["E5",40,1],["G5",41,1],["C5",42,1],["D5",43,1]],
  [["E5",44,4]],
  [["F5",48,1],["F5",49,1],["F5",50,1],["F5",51,1]],
  [["F5",52,1],["E5",53,1],["E5",54,1],["E5",55,.5],["E5",55.5,.5]],
  [["G5",56,1],["G5",57,1],["F5",58,1],["D5",59,1]],
  [["C5",60,4]]
];
const expected = bars.flat();
const phrase = (from, to) => song.steps.filter(([, beat]) => beat >= from && beat < to);
const evidence = {
  songId: song.id,
  source: { reference: sourceUrl, scope: "Complete selected 16-bar short refrain; global +5 semitones." },
  melodySpans: bars.map((attacks, index) => ({ from: index * 4, to: (index + 1) * 4, attacks })),
  silentWindows: [], sourceTotalBeats: 64,
  pitchFit: { sourcePitchClasses: [0,2,7,9,11], semitoneShift: 5 }
};
const eventsFor = steps => steps.map(([name, beat, duration]) => ({
  beat, duration, notes: [{ name, role: "melody", judge: true }]
}));

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test("all 51 source-authored tuples preserve the complete selected short refrain", () => {
  assert.equal(song.id, "ling-er-xiang-ding-dang", "retain canonical links and preferences");
  assert.equal(song.schemaVersion, 1);
  assert.equal(expected.length, 51);
  assert.deepEqual(song.steps, expected);
  assert.equal(song.title, "《铃儿响叮当》（短版副歌主题）");
  assert.equal(song.practiceTitle, `${song.title}练习轨道`);
  assert.equal(song.scoreTitle, `${song.title}简谱进度`);
  assert.match(song.hint, /Kyle Coughlin.*16小节短版副歌主题.*51.*64/);
  assert.match(song.hint, /80 BPM为练习速度.*可选同谱根音轻伴奏/);
  assert.doesNotMatch(song.hint, /旧49音版|导入还原/);
  assert.equal(checkTranscriptionEvidence(song, evidence).checkedAttacks, 51);
});

test("the UI simplification changes only the active hint from the frozen 2.4.18 score bytes", () => {
  const previousHint = "Kyle Coughlin 16小节短版副歌主题，51个单音、64拍；G调整体升5半音到C调。80 BPM为练习速度；旧49音版可导入还原，旧伴奏不沿用。";
  assert.equal(song.hint, "Kyle Coughlin 16小节短版副歌主题，51个单音、64拍；G调整体升5半音到C调。80 BPM为练习速度，可选同谱根音轻伴奏。");
  const restoredBytes = songBytes.toString().replace(`"hint": ${JSON.stringify(song.hint)}`, `"hint": ${JSON.stringify(previousHint)}`);
  assert.equal(hash(restoredBytes), "cc47ad84caa82006e403afad6d7a1fcd73860681c95e25bea1e97a265f5cf2e8",
    "all music, source metadata, IDs, tempo, preferences and formatting remain unchanged");
});

test("all 16 bars retain their internal rhythm, separate repeats and different cadences", () => {
  assert.equal(song.beatsPerMeasure, 4);
  for (let index = 0; index < bars.length; index += 1) {
    const start = index * 4;
    const actual = phrase(start, start + 4);
    assert.deepEqual(actual, bars[index], `m${index + 1}`);
    assert.equal(actual[0][1], start);
    assert.equal(actual.reduce((sum, [, , duration]) => sum + duration, 0), 4);
    assert.equal(actual.at(-1)[1] + actual.at(-1)[2], start + 4);
  }
  for (let index = 1; index < song.steps.length; index += 1) {
    const previous = song.steps[index - 1];
    assert.equal(previous[1] + previous[2], song.steps[index][1], "no invented rest or overlap");
  }
  assert.deepEqual(phrase(23,25), [["E5",23,.5],["E5",23.5,.5],["E5",24,1]]);
  assert.deepEqual(phrase(55,57), [["E5",55,.5],["E5",55.5,.5],["G5",56,1]]);
  assert.deepEqual(phrase(28,32), [["D5",28,2],["G5",30,2]]);
  assert.deepEqual(phrase(56,64), [["G5",56,1],["G5",57,1],["F5",58,1],["D5",59,1],["C5",60,4]]);
  assert.equal(song.sourceFeatures.hasRepeats, false);
  assert.equal(current.repeatExpansion, "none-all-16-bars-written-out");
});

test("breath commas create no guessed silence and the final whole C ends exactly at 64", () => {
  assert.equal(current.pickupBeats, 0);
  assert.deepEqual(current.breathMarksAfterMeasures, [4,8,12]);
  assert.deepEqual(current.silentWindows, []);
  assert.deepEqual(song.steps.at(-1), ["C5",60,4]);
  assert.equal(song.sourceFeatures.sourceMeasureCount, 16);
  assert.equal(song.sourceFeatures.sourceTotalBeats, 64);
  assert.equal(getPracticeTotalBeats(eventsFor(song.steps), song), 64);
  assert.match(current.rhythmDecisions.join(" "), /unmeasured phrasing signs.*No guessed rest/);
  assert.match(current.rhythmDecisions.join(" "), /No final rest/);
});

test("the selected global +5 transposition fits C5-G5 without octave folding or new harmony", () => {
  const sourceToCompiled = { G4: "C5", A4: "D5", B4: "E5", C5: "F5", D5: "G5" };
  const pitch = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  const midi = name => 12 * (Number(name.slice(1)) + 1) + pitch[name[0]];
  for (const [source, compiled] of Object.entries(sourceToCompiled)) assert.equal(midi(compiled) - midi(source), 5);
  const allowed = new Set(DISPLAY_KEYS.map(({ name }) => name));
  for (const [name] of song.steps) assert.ok(allowed.has(name));
  assert.deepEqual([...new Set(song.steps.map(([name]) => name))].sort(), ["C5","D5","E5","F5","G5"]);
  assert.equal(song.key, "C");
  assert.equal(song.tuning, "21-key-c");
  assert.equal(current.sourceKey, "G");
  assert.deepEqual(current.sourceRange, ["G4","D5"]);
  assert.deepEqual(current.compiledRange, ["C5","G5"]);
  assert.equal(current.transpositionSemitones, 5);
  assert.equal(song.sourceFeatures.transpositionSemitones, 5);
  assert.equal(current.octaveFolding, false);
  for (const field of ["events", "autoAccompaniment", "practiceAccompaniment"]) assert.equal(song[field], undefined);
  assert.deepEqual(song.sourceFeatures.sourceChordSymbols, ["G","C","A7","D","D7"]);
  assert.deepEqual(song.sourceFeatures.transposedChordSymbols, ["C","F","D7","G","G7"]);
  assert.match(current.supportDecision, /A7 becomes D7 containing F#/);
  assert.match(current.supportDecision, /do not naturalize/);
});

test("source scope, unmarked tempo and historical claims remain distinct", () => {
  assert.equal(song.sourceFeatures.transcriptionScope, "complete-selected-short-refrain");
  assert.equal(current.status, "reviewed-selected-short-refrain");
  assert.equal(current.selectedEdition, "coughlin-16-bar-short-refrain");
  assert.equal(current.adoptedInVersion, "2.4.16");
  assert.equal(current.contentRevision, "jingle-coughlin-16bars-2026-10-12");
  assert.deepEqual(current.reviewedBeatRanges, [[0,64]]);
  assert.equal(current.sourceUrl, sourceUrl);
  assert.equal(current.sourcePdfSha256, "6938f9d76dc4be1daf4cdc12b128bba0916bde6cdcc86a86829fda460018ae70");
  assert.equal(current.sourceImageSha256, "83ef33ff7ec86a6852ba4dce5cb83da8187475971b8a7758dfef9c4f2193944f");
  assert.deepEqual(song.sourceFeatures.sources.map(({ url }) => url), [sourceUrl]);
  assert.equal(song.sourceFeatures.sourceImages, undefined);
  assert.deepEqual(review.historicalReviewNotes, archive.sourceFeatures);
  assert.equal(current.oldEditionReverified, false);
  assert.match(current.versionDecision, /not proof that the old edition is wrong/);
  assert.equal(song.bpm, 80);
  assert.equal(song.bpm, archive.bpm);
  assert.equal(song.defaultSpeedFactor, .9);
  assert.equal(song.defaultSpeedFactor, archive.defaultSpeedFactor);
  assert.equal(current.sourceTempo, "unmarked");
  assert.equal(song.sourceFeatures.tempoStatus, "retained-practice-choice-source-unmarked");
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  assert.deepEqual(song.sourceFeatures.unsureMeasures, []);
  for (const field of ["referenceListening", "browserAudio", "physicalKalimba"]) {
    assert.equal(current[field], "not-performed", "update this gate only with actual scoped evidence");
  }
});

test("the exact old 49-note archive and its historical V2 remain byte-identical", async () => {
  assert.equal(hash(archiveBytes), archiveHash);
  assert.equal(hash(siblingBytes), siblingHash);
  assert.equal(archive.id, song.id);
  assert.equal(archive.title, "《铃儿响叮当》");
  assert.equal(archive.schemaVersion, 1);
  assert.equal(archive.steps.length, 49);
  assert.equal(hash(JSON.stringify(archive.steps)), "bb2946608ade26de3f6b9c67dabb6f9a6e2f651488280f5a3e6129d2310c452f");
  assert.deepEqual(archive.steps.at(-1), ["C5",31,1]);
  assert.equal(Math.max(...archive.steps.map(([, beat, duration]) => beat + duration)), 32);
  assert.equal(review.archivedEdition.file, archivePath);
  assert.equal(review.archivedEdition.fileSha256, archiveHash);
  assert.equal(current.archiveImportPath, archivePath);
  const files = await readSongFiles();
  assert.equal(files.filter(({ song: item }) => item.id === song.id).length, 1);
  assert.ok(files.every(({ fileName }) => fileName !== "ling-er-xiang-ding-dang-v2.4.15.json"));
});

test("the real importer restores all 49 old tuples as an independent local song without replacing the new built-in", () => {
  // Model the selected normalized built-in directly, so this test can run before
  // src/songs.js is regenerated. Import and practice resolution are real exports.
  const selected = deepFreeze({ ...structuredClone(song), baseSongId: song.id,
    arrangementKind: "melody", judgementMode: "melody", source: "system",
    events: eventsFor(song.steps) });
  const library = { [song.id]: selected, [sibling.id]: sibling };
  const before = JSON.stringify(library);
  const [restored] = parseImportedSongs(archiveBytes.toString(), library);
  assert.deepEqual(restored.steps, archive.steps);
  assert.deepEqual(restored.sourceFeatures, archive.sourceFeatures);
  assert.equal(restored.bpm, archive.bpm);
  assert.equal(restored.defaultSpeedFactor, archive.defaultSpeedFactor);
  assert.notEqual(restored.id, selected.id);
  assert.notEqual(restored.baseSongId, selected.id);
  assert.equal(restored.source, "local");
  assert.equal(restored.schemaVersion, 2, "legacy import normalizes the record without changing its melody");
  assert.equal(JSON.stringify(library), before);
  assert.equal(library[song.id].steps.length, 51);
  const merged = { ...library, [restored.id]: restored };
  const [secondImport] = parseImportedSongs(archiveBytes.toString(), merged);
  assert.notEqual(secondImport.id, restored.id);
  assert.deepEqual(secondImport.steps, archive.steps);
  assert.equal(getPracticeSongId(merged, restored.id), restored.id);
  assert.equal(getPracticeSongId(merged, sibling.id), selected.id);
  assert.deepEqual(getPracticeSongs(library).map(({ id }) => id), [selected.id]);
  assert.equal(getPracticeSongs(merged).length, 2);
  assert.ok(restored.events.every(event => event.notes.length === 1 && event.notes[0].role === "melody" && event.notes[0].judge));
});

test("old support compatibility is denied by the actual pitch/onset/duration/timebase guard", () => {
  assert.equal(hasMatchingPracticeMelody(archive, sibling), true, "shared old data is not independent source evidence");
  assert.equal(hasMatchingPracticeMelody(song, sibling), false);
  assert.equal(hasMatchingPracticeMelody(song, archive), false);
  assert.equal(hasMatchingPracticeMelody(song, song), true);
});

test("source-authored expectations reject merged attacks, copied endings, old scaling and invented rests", () => {
  const mutations = {
    mergedEighth: value => { value.steps.find(([, beat]) => beat === 23)[2] = 1; value.steps = value.steps.filter(([, beat]) => beat !== 23.5); },
    omittedLaterEighth: value => { value.steps = value.steps.filter(([, beat]) => beat !== 55.5); },
    copiedFirstCadence: value => { value.steps.find(([, beat]) => beat === 56)[0] = "E5"; },
    doubledOldTimebase: value => { value.steps = archive.steps.map(([name, beat, duration]) => [name, beat * 2, duration * 2]); },
    inventedBreathRest: value => { value.steps.find(([, beat]) => beat === 12)[2] = 3.5; },
    shortenedFinalNote: value => { value.steps.at(-1)[2] = 3; },
    extendedFinalNote: value => { value.steps.at(-1)[2] = 5; },
    unadoptedLowerRegister: value => { value.steps = value.steps.map(([name, beat, duration]) => [name[0] + (Number(name.slice(1)) - 1), beat, duration]); }
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const changed = structuredClone(song);
    mutate(changed);
    assert.throws(() => checkTranscriptionEvidence(changed, evidence), undefined, label);
  }
});
