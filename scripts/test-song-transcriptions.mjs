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

console.log("Song transcription regression checks passed (2 melodies, source phrases, rests, ties and range).");
