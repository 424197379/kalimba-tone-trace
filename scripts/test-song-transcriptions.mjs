import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DISPLAY_KEYS } from "./build-song-library.mjs";

const allowedNotes = new Set(DISPLAY_KEYS.map(({ name }) => name));
const readSong = async (id) => JSON.parse(await readFile(new URL(`../data/songs/${id}.json`, import.meta.url), "utf8"));
const phrase = (song, start, end) => song.steps.filter(([, beat]) => beat >= start && beat < end);

function validateMelody(song) {
  let previousEnd = 0;
  for (const [name, beat, duration] of song.steps) {
    assert.ok(allowedNotes.has(name), `${song.id}: unsupported ${name}`);
    assert.ok(beat >= previousEnd, `${song.id}: overlapping melody at ${beat}`);
    assert.ok(duration > 0 && duration * 4 === Math.round(duration * 4));
    previousEnd = beat + duration;
  }
  assert.equal(song.key, "C");
  assert.ok(song.sourceFeatures.sources.length >= 2);
}

// The printed staff/numbered edition uses dotted eighths, not equal eighths.
const sheep = await readSong("bie-kan-wo-zhi-shi-yi-zhi-yang");
validateMelody(sheep);
assert.equal(sheep.steps.length, 68);
assert.equal(sheep.beatsPerMeasure, 4);
assert.deepEqual(phrase(sheep, 0, 8), [
  ["C5", 0.75, 0.25], ["C5", 1, 0.75], ["C5", 1.75, 0.25],
  ["C5", 2, 0.75], ["B4", 2.75, 0.25], ["G4", 3, 0.75],
  ["E4", 3.75, 0.25], ["G4", 4, 4]
]);
assert.deepEqual(phrase(sheep, 16, 24), [
  ["E5", 16.75, 0.25], ["E5", 17, 0.75], ["E5", 17.75, 0.25],
  ["E5", 18, 0.75], ["D5", 18.75, 0.25], ["C5", 19, 0.75],
  ["A4", 19.75, 0.25], ["F4", 20, 1], ["D5", 21, 3]
]);
assert.deepEqual(sheep.steps.at(-1), ["C5", 60, 3]);
assert.equal(sheep.sourceFeatures.transcriptionScope, "verse-excerpt");
assert.match(sheep.hint, /非全曲/);

// Transpose the entire choral melody up an octave, including the low cadence.
const oars = await readSong("rang-wo-men-dang-qi-shuang-jiang");
validateMelody(oars);
assert.equal(oars.steps.length, 63);
assert.equal(oars.beatsPerMeasure, 2);
assert.deepEqual(phrase(oars, 0, 8), [
  ["A4", 0.5, 0.5], ["C5", 1, 0.5], ["D5", 1.5, 0.5],
  ["E5", 2, 1.5], ["G5", 3.5, 0.5], ["E5", 4, 0.5],
  ["C5", 4.5, 0.5], ["D5", 5, 1], ["A4", 6, 2]
]);
assert.deepEqual(phrase(oars, 22, 24), [
  ["C6", 22, 0.5], ["B5", 22.5, 0.25], ["A5", 22.75, 0.25],
  ["G5", 23, 0.5], ["A5", 23.5, 0.5]
]);
assert.deepEqual(phrase(oars, 14, 17), [["E5", 14, 3]]);
assert.deepEqual(phrase(oars, 32, 36), [["G5", 32, 3]]);
assert.deepEqual(phrase(oars, 48, 52), [
  ["C5", 49, 0.5], ["D5", 49.5, 0.5], ["E5", 50, 1],
  ["G4", 51, 0.75], ["G4", 51.75, 0.25]
]);
assert.deepEqual(phrase(oars, 54, 60), [
  ["B4", 54, 0.5], ["A4", 54.5, 0.5], ["G4", 55, 0.5],
  ["E4", 55.5, 0.5], ["A4", 56, 4]
]);
assert.equal(oars.sourceFeatures.transcriptionScope, "one-strophe-and-refrain");

// These checks are anchored to the supplied sheet images, including rhythms
// finer than the quarter-beat grid used by the two older arrangements above.
const suppliedIds = ["ye-de-gang-qin-qu-wu", "one-summers-day", "sheng-sheng-man", "jie-wang", "gao-bai-qi-qiu", "mo-he-wu-ting-verse", "ping-fan-zhi-lu"];
const supplied = new Map();
for (const id of suppliedIds) {
  const song = await readSong(id);
  let previousEnd = 0;
  for (const [name, beat, duration] of song.steps) {
    assert.ok(allowedNotes.has(name), `${id}: unsupported ${name}`);
    assert.ok(beat >= previousEnd - 1e-8, `${id}: overlapping melody at ${beat}`);
    assert.ok(duration > 0);
    previousEnd = beat + duration;
  }
  assert.equal(song.key, "C");
  assert.equal(song.beatsPerMeasure, 4);
  supplied.set(id, song);
}

const night = supplied.get("ye-de-gang-qin-qu-wu");
assert.equal(night.bpm, 120);
assert.equal(night.sourceFeatures.sourceMeasureCount, 33);
assert.equal(night.sourceFeatures.transpositionSemitones, -7);
assert.deepEqual(phrase(night, 0, 4), [
  ["A3", 2, 0.5], ["B3", 2.5, 0.5], ["C4", 3, 0.5], ["E4", 3.5, 0.5]
]);
for (const start of [57.5, 121.5]) {
  const triplet = phrase(night, start, start + 0.5);
  assert.deepEqual(triplet.map(([name]) => name), ["C4", "E4", "G4"]);
  triplet.forEach(([, beat, duration], index) => {
    assert.ok(Math.abs(beat - start - index / 6) < 1e-8);
    assert.ok(Math.abs(duration - 1 / 6) < 1e-8);
  });
}
assert.deepEqual(phrase(night, 128, 132), [["A4", 128, 1]]);

const summer = supplied.get("one-summers-day");
assert.equal(summer.bpm, 70);
assert.equal(summer.sourceFeatures.sourceMeasureCount, 59);
assert.deepEqual(phrase(summer, 0, 4), [["E5", 0, 1.5], ["D5", 1.5, 1.5], ["G5", 3, 1]]);
assert.deepEqual(phrase(summer, 72, 76), [
  ["C6", 72, 0.5], ["C6", 72.5, 0.5], ["D6", 73, 0.5], ["C6", 73.5, 0.5],
  ["B5", 74, 1], ["E5", 75, 0.5], ["G5", 75.5, 0.5]
]);
assert.deepEqual(phrase(summer, 124.75, 128.5), [["D5", 124.75, 3.75]]);
assert.deepEqual(summer.steps.at(-1), ["E5", 232, 4]);

const sheng = supplied.get("sheng-sheng-man");
assert.equal(sheng.bpm, 62);
assert.equal(sheng.sourceFeatures.sourceMeasureCount, 16);
assert.deepEqual(phrase(sheng, 32, 36), [
  ["A4", 32, 0.75], ["A4", 32.75, 0.75], ["E5", 33.5, 0.5], ["D5", 34, 2]
]);
assert.deepEqual(sheng.steps.at(-1), ["C5", 60, 4]);

const jie = supplied.get("jie-wang");
assert.equal(jie.bpm, 75);
assert.equal(jie.sourceFeatures.sourceMeasureCount, 18);
assert.deepEqual(phrase(jie, 0, 4), [["A4", 3, 0.5], ["B4", 3.5, 0.5]]);
for (const start of [15.5, 47.5]) {
  assert.deepEqual(phrase(jie, start, start + 1), [["E6", start, 1]]);
}
assert.deepEqual(phrase(jie, 18, 18.5), []);
assert.deepEqual(jie.steps.at(-1), ["A4", 68, 4]);

const balloon = supplied.get("gao-bai-qi-qiu");
assert.equal(balloon.bpm, 90);
assert.equal(balloon.sourceFeatures.sourceMeasureCount, 33);
assert.deepEqual(phrase(balloon, 36, 38), [
  ["A4", 36, 0.5], ["C5", 36.5, 0.125], ["C5", 36.625, 0.375],
  ["B4", 37, 0.125], ["C5", 37.125, 0.75], ["B4", 37.875, 0.125]
]);
assert.deepEqual(balloon.steps.at(-1), ["C5", 127.5, 1.5]);
assert.deepEqual(phrase(balloon, 128, 132), []);

const mohe = supplied.get("mo-he-wu-ting-verse");
assert.equal(mohe.steps.length, 88);
assert.equal(mohe.bpm, 71);
assert.deepEqual(mohe.sourceFeatures.sourceMeasureRange, [9, 24]);
assert.equal(mohe.sourceFeatures.transpositionSemitones, -4);
assert.deepEqual(phrase(mohe, 0, 4), [
  ["A3", 0, 0.5], ["A3", 0.5, 0.5], ["A3", 1, 0.5], ["B3", 1.5, 0.25],
  ["C4", 1.75, 0.75], ["D4", 2.5, 0.5], ["E4", 3, 0.5], ["C4", 3.5, 0.5]
]);
assert.deepEqual(phrase(mohe, 11.5, 16), [
  ["G3", 11.5, 0.5], ["E4", 12, 0.5], ["E4", 12.5, 0.5],
  ["E4", 13, 0.25], ["D4", 13.25, 0.5], ["B3", 13.75, 2.25]
]);
assert.deepEqual(phrase(mohe, 56, 58), [
  ["E4", 56, 0.5], ["F4", 56.5, 0.5], ["E4", 57, 0.25],
  ["F4", 57.25, 0.5], ["F4", 57.75, 0.25]
]);
assert.deepEqual(mohe.steps.at(-1), ["E4", 60, 4]);

const pingfan = supplied.get("ping-fan-zhi-lu");
assert.equal(pingfan.steps.length, 235);
assert.equal(pingfan.sourceFeatures.sourceMeasureCount, 28);
assert.equal(pingfan.sourceFeatures.tempoStatus, "reference-practice-tempo-source-image-unmarked");
assert.deepEqual(phrase(pingfan, 0, 4), [
  ["A4", 0, 0.5], ["A4", 0.5, 0.5], ["E5", 1, 0.5], ["C5", 1.5, 0.5],
  ["C5", 2, 0.5], ["F4", 2.5, 0.5], ["F5", 3, 0.5], ["C5", 3.5, 0.5]
]);
assert.deepEqual(phrase(pingfan, 48, 50), [
  ["C6", 48, 0.5], ["B5", 48.5, 0.25], ["C6", 48.75, 0.5],
  ["G5", 49.25, 0.25], ["A5", 49.5, 0.5]
]);
assert.deepEqual(phrase(pingfan, 54, 54.5), [["D4", 54, 0.5]]);
assert.deepEqual(phrase(pingfan, 65.5, 66), [["E6", 65.5, 0.5]]);
assert.deepEqual(phrase(pingfan, 73, 74), [
  ["C6", 73, 0.25], ["D6", 73.25, 0.5], ["C6", 73.75, 0.25]
]);
assert.deepEqual(pingfan.steps.at(-1), ["B4", 110, 2]);

console.log("Song transcription regression checks passed (9 melodies, source phrases, rests, ties, tuplets and range).");
