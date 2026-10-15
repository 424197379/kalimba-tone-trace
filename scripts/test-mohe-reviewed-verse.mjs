import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bytes = await readFile(new URL("../data/songs/mo-he-wu-ting-verse.json", import.meta.url));
const song = JSON.parse(bytes.toString("utf8"));
const originalHash = "68f63b9afd5695d381e323f7d37c1e90df6fac07873025b2fedab23eefe7d3a5";
const attackCounts = [8, 7, 6, 5, 8, 7, 5, 5, 5, 3, 5, 5, 5, 4, 9, 1];

// Bounded decisions from the 2026-10-12 source-pixel review of EOP m9–24.
// The full source-authored 88-attack fixture stays outside the repository.
// Numbered/staff previews are parallel exports of ONE edition. These checks
// preserve decisions; neither their success nor the hash is a new source review.
// Each tie is [pitch, excerpt onset, first printed duration, continuation].
const ties = [
  ["C4", 1.75, .25, .5],
  ["E4", 5.75, .25, 1.5],
  ["F4", 9.75, .25, 1.5],
  ["B3", 13.75, .25, 2],
  ["E4", 17.75, .25, .5],
  ["E4", 21.75, .25, 1.5],
  ["F4", 37.75, .25, 2],
  ["F4", 53.75, .25, 1.5],
];
const lowNotes = [
  ["G3", 11.5, .5], ["G3", 28, .5],
  ["A3", 34, 1], ["A3", 35, .5],
  ["G3", 42, 1], ["G3", 43, .5],
  ["A3", 50, 1], ["A3", 51, .5],
];
const phrase = (value, from, to) => value.steps.filter(([, beat]) => beat >= from && beat < to);
const attackAt = (value, beat) => value.steps.find(([, onset]) => onset === beat);

function checkTies(value) {
  for (const [note, beat, first, continuation] of ties) {
    assert.deepEqual(phrase(value, beat, beat + first + continuation),
      [[note, beat, first + continuation]], `tie at beat ${beat} must sustain once`);
  }
}

function checkRepeats(value) {
  for (const [note, beat] of [["A3", 0], ["E4", 4], ["D4", 8], ["E4", 20], ["D4", 24]]) {
    assert.deepEqual(phrase(value, beat, beat + 1.5),
      [0, .5, 1].map(offset => [note, beat + offset, .5]), `independent opening attacks at beat ${beat}`);
  }
  assert.deepEqual(attackAt(value, 55.5), ["F4", 55.5, .5], "m22 reattacks after the tie ends");
  assert.deepEqual(phrase(value, 57.25, 58),
    [["F4", 57.25, .5], ["F4", 57.75, .25]], "m23 adjacent F4 notes are not tied");
}

function checkSyncopation(value) {
  assert.deepEqual(phrase(value, 13, 16),
    [["E4", 13, .25], ["D4", 13.25, .5], ["B3", 13.75, 2.25]], "m12 syncopation then tied hold");
  assert.deepEqual(phrase(value, 57, 58),
    [["E4", 57, .25], ["F4", 57.25, .5], ["F4", 57.75, .25]], "m23 syncopation retains both F4 attacks");
}

function checkLowNotes(value) {
  for (const expected of lowNotes) {
    assert.deepEqual(attackAt(value, expected[1]), expected, `source low octave at beat ${expected[1]}`);
  }
}

function checkExtent(value) {
  assert.equal(value.sourceFeatures.sourceTotalBeats, 64, "reviewed extent");
  assert.deepEqual(value.steps.at(-1), ["E4", 60, 4], "m24 whole-note ending");
  assert.equal(value.steps.length, 88);
  let cursor = 0;
  for (const [note, beat, duration] of value.steps) {
    assert.match(note, /^[A-G][34]$/);
    assert.ok(duration > 0);
    assert.equal(beat, cursor, "source has no pickup, gap or overlap in the selected melody");
    cursor = beat + duration;
  }
  assert.equal(cursor, 64, "the selected verse ends exactly at beat 64");
  for (const [bar, count] of attackCounts.entries()) {
    const from = bar * 4;
    const attacks = phrase(value, from, from + 4);
    assert.equal(attacks.length, count, `m${bar + 9} attack count`);
    assert.equal(attacks[0][1], from, `m${bar + 9} begins on the barline`);
    assert.equal(attacks.reduce((sum, [, , duration]) => sum + duration, 0), 4, `m${bar + 9} fills four beats`);
    assert.equal(attacks.at(-1)[1] + attacks.at(-1)[2], from + 4, `m${bar + 9} has no cross-bar tie`);
  }
}

test("Mohe's complete reviewed original JSON stays byte-for-byte unchanged", () => {
  assert.equal(createHash("sha256").update(bytes).digest("hex"), originalHash);
  assert.equal(song.steps.length, 88, "96 printed symbols minus eight tie continuations");
});

test("all eight source ties stay one attacked note each", () => checkTies(song));
test("genuine repeated opening and later F4 attacks remain separate", () => checkRepeats(song));
test("m12 and m23 retain their different tie/repeat treatment and exact syncopation", () => checkSyncopation(song));
test("the source-authored low degrees retain their register and repeated attacks", () => checkLowNotes(song));
test("each bar and the full 64-beat melody retain exact coverage and attack counts", () => checkExtent(song));

test("the selected E-to-C adaptation keeps its key, register, tempo and limited suitability", () => {
  const sourceToAdapted = [
    ["B3", "G3"], ["C#4", "A3"], ["D#4", "B3"], ["E4", "C4"], ["F#4", "D4"],
    ["G#4", "E4"], ["A4", "F4"], ["B4", "G4"], ["C#5", "A4"],
  ];
  const midi = note => {
    const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(note);
    return (Number(octave) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter] + Number(sharp === "#");
  };
  for (const [source, adapted] of sourceToAdapted) assert.equal(midi(adapted) - midi(source), -4);
  assert.deepEqual([...new Set(song.steps.map(([note]) => note))].sort(), sourceToAdapted.map(([, note]) => note).sort());
  assert.equal(Math.min(...song.steps.map(([note]) => midi(note))), midi("G3"));
  assert.equal(Math.max(...song.steps.map(([note]) => midi(note))), midi("A4"));
  assert.equal(song.key, "C");
  assert.equal(song.bpm, 71);
  assert.equal(song.beatsPerMeasure, 4);
  assert.equal(song.defaultSpeedFactor, 1, "stored suggestion, not proof of actual browser speed");
  assert.equal(song.sourceFeatures.sourceKey, "E");
  assert.equal(song.sourceFeatures.transpositionSemitones, -4);
  assert.deepEqual(song.sourceFeatures.sourceMeasureRange, [9, 24]);
  assert.equal(song.sourceFeatures.sourceMeasureCount, 16);
  assert.equal(song.sourceFeatures.hasRepeats, false);
  assert.equal(song.sourceFeatures.transcriptionScope, "first-verse-source-measures-9-24");
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  assert.equal(song.sourceFeatures.suitability.scope, "first-verse-source-measures-9-24");
  assert.deepEqual(song.sourceFeatures.suitability.reviewRequired,
    ["实体琴试听及与原演唱的主观辨识度对比尚未进行。"]);
});

test("synthetically splitting any real tie is rejected by the tie assertion itself", () => {
  for (const [note, beat, first, continuation] of ties) {
    const split = structuredClone(song);
    split.steps = split.steps.flatMap(step => step[1] === beat
      ? [[note, beat, first], [note, beat + first, continuation]] : [step]);
    assert.throws(() => checkTies(split), /must sustain once/);
  }
});

test("synthetic repeated-note merges, low-octave folding and straightened rhythms fail without the hash", () => {
  for (const [from, removed] of [[0, .5], [53.75, 55.5], [57.25, 57.75]]) {
    const merged = structuredClone(song);
    attackAt(merged, from)[2] += attackAt(merged, removed)[2];
    merged.steps = merged.steps.filter(([, beat]) => beat !== removed);
    assert.throws(() => checkRepeats(merged));
  }
  for (const [, beat] of lowNotes) {
    const folded = structuredClone(song);
    attackAt(folded, beat)[0] = attackAt(folded, beat)[0].replace("3", "4");
    assert.throws(() => checkLowNotes(folded), /source low octave/);
  }
  for (const from of [13, 57]) {
    const straightened = structuredClone(song);
    attackAt(straightened, from)[2] = .5;
    const middle = attackAt(straightened, from + .25);
    middle[1] = from + .5;
    middle[2] = .25;
    assert.throws(() => checkSyncopation(straightened), /syncopation/);
  }
});

test("a synthetic clipped final hold or changed source extent fails without the hash", () => {
  const clipped = structuredClone(song);
  clipped.steps.at(-1)[2] = 3;
  assert.throws(() => checkExtent(clipped), /whole-note ending/);
  for (const extent of [60, 68]) {
    const changed = structuredClone(song);
    changed.sourceFeatures.sourceTotalBeats = extent;
    assert.throws(() => checkExtent(changed), /reviewed extent/);
  }
});
