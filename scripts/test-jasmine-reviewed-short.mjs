import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const songBytes = await read("data/songs/jasmine.json");
const song = JSON.parse(songBytes);
const archiveBytes = await read("data/archives/jasmine-walter-v2.4.3.json");
const archive = JSON.parse(archiveBytes);
const archiveHash = "55ec47b07ff9ea6a5030d135043f85a8d381a42ba13e4268ca119c84e7353088";
const sourceUrl = "https://doc.quark.cn/preview/tongyongshenghuo-geciqupu-qupu%E3%80%81jianpu/6EF265ECBE7A8C6DEE28100CF4DA7113";
const review = song.sourceFeatures.sourceReview;
const current = review.currentScopeReview;

// Source-pixel decisions, independently re-read before editing the song:
// Huang Xiuquan's complete 14-bar SHORT arrangement on public preview page 1.
// These expectations describe that chosen edition, not the missing Walter sheet.
const bars = [
  [["E4",0,1],["E4",1,.5],["G4",1.5,.5],["A4",2,.5],["C5",2.5,.5],["C5",3,.5],["A4",3.5,.5]],
  [["G4",4,1],["G4",5,.5],["A4",5.5,.5],["G4",6,2]],
  [["E4",8,1],["E4",9,.5],["G4",9.5,.5],["A4",10,.5],["C5",10.5,.5],["C5",11,.5],["A4",11.5,.5]],
  [["G4",12,1],["G4",13,.5],["A4",13.5,.5],["G4",14,2]],
  [["G4",16,1],["G4",17,1],["G4",18,1],["E4",19,.5],["G4",19.5,.5]],
  [["A4",20,1],["A4",21,1],["G4",22,2]],
  [["E4",24,1],["D4",25,.5],["E4",25.5,.5],["G4",26,1],["E4",27,.5],["D4",27.5,.5]],
  [["C4",28,1],["C4",29,.5],["D4",29.5,.5],["C4",30,2]],
  [["E4",32,.5],["D4",32.5,.5],["C4",33,.5],["E4",33.5,.5],["D4",34,1.5],["E4",35.5,.5]],
  [["G4",36,1],["A4",37,.5],["C5",37.5,.5],["G4",38,2]],
  [["D4",40,1],["E4",41,.5],["G4",41.5,.5],["D4",42,.5],["E4",42.5,.5],["C4",43,.5],["A3",43.5,.5]],
  [["G3",44,2],["A3",46,1],["C4",47,1]],
  [["D4",48,1.5],["E4",49.5,.5],["C4",50,.5],["D4",50.5,.5],["C4",51,.5],["A3",51.5,.5]],
  [["G3",52,3]]
];
const expected = bars.flat();
const phrase = (from, to) => song.steps.filter(([, beat]) => beat >= from && beat < to);

test("all 67 pitches, onsets and durations match the explicitly selected 14-bar short source", () => {
  assert.equal(expected.length, 67);
  assert.equal(song.schemaVersion, 1);
  assert.deepEqual(song.steps, expected);
  assert.equal(song.id, "jasmine", "preserve built-in deep links and per-song preferences");
  assert.equal(song.title, "《茉莉花》（短版）");
  assert.equal(song.practiceTitle, "《茉莉花》（短版）练习轨道");
  assert.equal(song.scoreTitle, "《茉莉花》（短版）简谱进度");
  assert.match(song.hint, /黄秀泉.*14小节短版/);
  assert.match(song.hint, /末尾保留1拍休止/);
});

test("the UI simplification removes only the archive sentence from the frozen 2.4.18 score bytes", () => {
  const previousHint = "黄秀泉制谱14小节短版，67次拨音；完整采用所选公开谱页，末尾保留1拍休止。21音C调单音练习，不加伴奏；88 BPM沿用旧练习设定，非谱面标速。旧30小节版另存归档。";
  assert.equal(song.hint, previousHint.replace("旧30小节版另存归档。", ""));
  const restoredBytes = songBytes.toString().replace(`"hint": ${JSON.stringify(song.hint)}`, `"hint": ${JSON.stringify(previousHint)}`);
  assert.equal(hash(restoredBytes), "f18e4e21812292ee27ef51c9a0340130b1bd7a6c938d1beb92ee83d6a3bf34cf",
    "all music, source metadata, IDs, tempo, preferences and formatting remain unchanged");
});

test("each 4/4 bar balances with its actual internal rhythm and only the printed ending rest", () => {
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(current.pickupBeats, 0);
  for (let index = 0; index < bars.length; index += 1) {
    const start = index * 4;
    const notes = phrase(start, start + 4);
    assert.deepEqual(notes, bars[index], `m${index + 1}: internal rhythm and pitches`);
    assert.equal(notes[0][1], start, `m${index + 1}: no invented pickup or gap`);
    for (let position = 1; position < notes.length; position += 1) {
      assert.equal(notes[position - 1][1] + notes[position - 1][2], notes[position][1]);
    }
    const rest = index === 13 ? 1 : 0;
    assert.equal(notes.reduce((sum, [, , duration]) => sum + duration, 0) + rest, 4);
    assert.equal(notes.at(-1)[1] + notes.at(-1)[2] + rest, start + 4);
  }
  assert.deepEqual(phrase(34,36), [["D4",34,1.5],["E4",35.5,.5]], "m9 dotted quarter and eighth");
  assert.deepEqual(phrase(48,50), [["D4",48,1.5],["E4",49.5,.5]], "m13 dotted quarter and eighth");
  assert.equal(song.steps.some(([, , duration]) => duration === .75), false, "do not reuse the other edition's rhythm");
});

test("slurs retain all attacks, repeated notes stay separate and the cadence keeps its low octave", () => {
  assert.deepEqual(phrase(16,19), [["G4",16,1],["G4",17,1],["G4",18,1]]);
  assert.deepEqual(phrase(2,4), [["A4",2,.5],["C5",2.5,.5],["C5",3,.5],["A4",3.5,.5]]);
  assert.deepEqual(phrase(43.5,48), [["A3",43.5,.5],["G3",44,2],["A3",46,1],["C4",47,1]]);
  assert.deepEqual(phrase(51.5,56), [["A3",51.5,.5],["G3",52,3]]);
  const allowed = new Set(DISPLAY_KEYS.map(({ name }) => name));
  assert.equal(allowed.size, 21);
  for (const [name] of song.steps) assert.ok(allowed.has(name), name);
  assert.deepEqual([...new Set(song.steps.map(([name]) => name))].sort(), ["A3","A4","C4","C5","D4","E4","G3","G4"]);
  assert.equal(song.key, "C");
  assert.equal(song.tuning, "21-key-c");
  assert.equal(current.transpositionSemitones, 0);
  assert.equal(current.octaveFolding, false);
});

test("the exact 56-beat source extent preserves [55,56) silence without chords or filled tails", () => {
  assert.deepEqual(song.steps.at(-1), ["G3",52,3]);
  assert.equal(Math.max(...song.steps.map(([, beat, duration]) => beat + duration)), 55);
  assert.equal(song.sourceFeatures.sourceMeasureCount, 14);
  assert.equal(song.sourceFeatures.sourceTotalBeats, 56);
  assert.deepEqual(current.silentWindows, [{ beat: 55, duration: 1 }]);
  assert.equal(song.steps.some(([, beat, duration]) => beat < 56 && beat + duration > 55), false);
  for (const [, beat, duration] of song.steps) {
    assert.ok(Number.isFinite(beat) && Number.isFinite(duration) && beat >= 0 && duration > 0);
    assert.ok(beat + duration <= 56);
  }
  for (const field of ["events", "autoAccompaniment", "practiceAccompaniment"]) assert.equal(song[field], undefined);
  assert.deepEqual(song.sourceFeatures.sourceChordSymbols, ["C","F","Am","G","Dm"]);
  assert.match(song.sourceFeatures.unsupported.join(" "), /chord symbols.*only as source information/);
});

test("selected-source metadata separates notation evidence, old provenance and pending listening", () => {
  assert.equal(song.sourceFeatures.transcriptionScope, "complete-selected-short-arrangement");
  assert.equal(current.status, "reviewed-selected-short-arrangement");
  assert.equal(current.selectedEdition, "huang-xiuquan-14-bar-short");
  assert.equal(current.contentRevision, "jasmine-huang-xiuquan-14bars-2026-10-12");
  assert.equal(current.adoptedInVersion, "2.4.4");
  assert.deepEqual(current.reviewedBeatRanges, [[0,56]]);
  assert.equal(current.sourceUrl, sourceUrl);
  assert.equal(current.sourceImageSha256, "15a14cd2dc354c6212d914ee860700317bd5fa14bd4c2a1bf64083c53f8c667c");
  assert.deepEqual(song.sourceFeatures.sources.map(({ url }) => url), [sourceUrl]);
  assert.equal(song.sourceFeatures.sourceImages, undefined, "the unavailable Walter photo is historical evidence only");
  assert.deepEqual(review.historicalReviewNotes, archive.sourceFeatures);
  assert.equal(current.oldWalterReverified, false);
  assert.match(current.versionDecision, /not.*proof that the old edition is wrong/);
  assert.deepEqual(song.sourceFeatures.unsureMeasures, [], "old m25-m30 claims do not describe this 14-bar edition");
  assert.equal(song.bpm, archive.bpm);
  assert.equal(song.bpm, 88);
  assert.equal(song.defaultSpeedFactor, archive.defaultSpeedFactor);
  assert.equal(song.defaultSpeedFactor, .95);
  assert.equal(current.sourceTempo, "unmarked");
  assert.equal(song.sourceFeatures.tempoStatus, "retained-practice-choice-source-unmarked");
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  for (const field of ["referenceListening", "browserAudio", "physicalKalimba"]) assert.equal(current[field], "not-performed");
});

test("the exact archived 145-note V1 remains restorable without a private image or Git history", async () => {
  assert.equal(hash(archiveBytes), archiveHash);
  assert.equal(archive.id, "jasmine");
  assert.equal(archive.schemaVersion, 1);
  assert.equal(archive.steps.length, 145);
  assert.deepEqual(archive.steps.at(-1), ["G4",116,4]);
  assert.equal(Math.max(...archive.steps.map(([, beat, duration]) => beat + duration)), 120);
  assert.equal(review.archivedEdition.file, "data/archives/jasmine-walter-v2.4.3.json");
  assert.equal(current.archiveImportPath, review.archivedEdition.file);
  assert.equal(review.archivedEdition.fileSha256, archiveHash);
  const builtIns = await readSongFiles();
  assert.equal(builtIns.filter(({ song: item }) => item.id === "jasmine").length, 1);
  assert.ok(builtIns.every(({ fileName }) => fileName !== "jasmine-walter-v2.4.3.json"), "archive must not become a second built-in");
});

test("the separate old V2 source and accompaniment file remains byte-identical", async () => {
  assert.equal(hash(await read("data/songs/jasmine-chord.json")), "ebbf3d54f58c4d4dd374114ab66d06d651841e85e020d84a408ac6787a17f721");
});
