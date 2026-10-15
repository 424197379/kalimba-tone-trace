import assert from "node:assert/strict";
import test from "node:test";
import { checkTranscriptionEvidence, fittingTranspositions, fraction } from "./check-transcription-evidence.mjs";

// Original synthetic teaching fixtures, not copied score excerpts. The fixture
// author supplies attack identities; the checker cannot read a tie or slur.
function fixture() {
  return {
    song: {
      id: "synthetic-reviewed-phrase", schemaVersion: 1,
      steps: [
        ["C4", 0, 1.5], // Reviewed tie: one attack, summed duration.
        ["C4", 1.5, 0.5], // Same pitch, independently attacked.
        ["D4", 2, 0.5], ["E4", 2.5, 0.5], // Different-pitch slur.
        ["F4", 3, 1 / 3], ["G4", 10 / 3, 1 / 3], ["A4", 11 / 3, 1 / 3],
        ["B4", 4, 8] // Legitimate long written sustain.
      ],
      sourceFeatures: { sourceTotalBeats: 14 }
    },
    evidence: {
      songId: "synthetic-reviewed-phrase",
      source: { reference: "synthetic fixture authored for this checker", scope: "one phrase and its ending rest" },
      melodySpans: [{ from: 0, to: 14, attacks: [
        ["C4", 0, "3/2"], ["C4", "3/2", "1/2"],
        ["D4", 2, "1/2"], ["E4", "5/2", "1/2"],
        ["F4", 3, "1/3"], ["G4", "10/3", "1/3"], ["A4", "11/3", "1/3"],
        ["B4", 4, 8]
      ] }],
      silentWindows: [{ beat: 12, duration: 2 }],
      sourceTotalBeats: 14,
      pitchFit: { sourcePitchClasses: [0, 2, 4, 5, 7, 9, 11], semitoneShift: 0 }
    }
  };
}
const check = ({ song, evidence }) => checkTranscriptionEvidence(song, evidence);

test("a disclosed nonmetric grace omission preserves principal timing without an invented target", () => {
  const input = {
    song: { id: "synthetic-omitted-grace", schemaVersion: 1,
      steps: [["A4", 0, 1], ["D4", 1, 1]], sourceFeatures: { sourceTotalBeats: 2 } },
    evidence: { songId: "synthetic-omitted-grace",
      source: { reference: "synthetic fixture authored for this checker", scope: "explicit ornament-omitted edition; unmeasured small G4 before principal A4" },
      melodySpans: [{ from: 0, to: 2, attacks: [["A4", 0, 1], ["D4", 1, 1]] }], sourceTotalBeats: 2 }
  };
  assert.equal(check(input).checkedAttacks, 2);
  const stolen = structuredClone(input);
  stolen.song.steps = [["G4", 0, 0.25], ["A4", 0.25, 0.75], ["D4", 1, 1]];
  assert.throws(() => check(stolen), /attack count differs/);
  const shifted = structuredClone(input);
  shifted.song.steps = [["A4", 0.25, 1], ["D4", 1.25, 0.75]];
  assert.throws(() => check(shifted), /differs/);
  const shortened = structuredClone(input); shortened.song.steps[0][2] = 0.75;
  assert.throws(() => check(shortened), /differs/);
});

test("a reviewed breath comma does not authorize shortening a note or inserting timed silence", () => {
  const input = {
    song: { id: "synthetic-breath-comma", schemaVersion: 1,
      steps: [["C4", 0, 4], ["D4", 4, 4]], sourceFeatures: { sourceTotalBeats: 8 } },
    evidence: { songId: "synthetic-breath-comma",
      source: { reference: "synthetic fixture authored for this checker", scope: "two whole notes with a phrase breath comma, no quantified rest" },
      melodySpans: [{ from: 0, to: 8, attacks: [["C4", 0, 4], ["D4", 4, 4]] }], sourceTotalBeats: 8 }
  };
  assert.equal(check(input).checkedAttacks, 2);
  const shortened = structuredClone(input); shortened.song.steps[0][2] = 3.5;
  assert.throws(() => check(shortened), /differs/);
  const extraGap = structuredClone(input); extraGap.song.steps[1][1] = 4.5;
  assert.throws(() => check(extraGap), /differs/);
});

test("accepts a tie, independent repeated pitch, slur, triplet, long sustain and silent ending without mutation", () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = check(input);
  assert.equal(result.checkedAttacks, 8);
  assert.deepEqual(result.fittingTranspositions, [0]);
  assert.deepEqual(input, before);
});

test("rejects an extra tied continuation attack", () => {
  const input = fixture();
  input.song.steps[0][2] = 1;
  input.song.steps.splice(1, 0, ["C4", 1, 0.5]);
  assert.throws(() => check(input), /attack count differs/);
});

test("rejects automatic merging of an independent same-pitch repeat", () => {
  const input = fixture();
  input.song.steps[0][2] = 2;
  input.song.steps.splice(1, 1);
  assert.throws(() => check(input), /attack count differs/);
});

test("rejects quarter-grid replacement even when the triplet still totals one beat", () => {
  const input = fixture();
  input.song.steps.splice(4, 3, ["F4", 3, 0.25], ["G4", 3.25, 0.25], ["A4", 3.5, 0.5]);
  assert.throws(() => check(input), /duration differs/);
});

test("rejects lost source extent, a fake final hold and a rest fill", () => {
  const lost = fixture();
  delete lost.song.sourceFeatures.sourceTotalBeats;
  assert.throws(() => check(lost), /sourceTotalBeats/);
  const fakeHold = fixture();
  fakeHold.song.steps.at(-1)[2] = 10;
  assert.throws(() => check(fakeHold), /duration differs/);
  const fill = fixture();
  fill.song.practiceAccompaniment = { events: [{ beat: 12, duration: 0.5, notes: [{ name: "C4" }] }] };
  assert.throws(() => check(fill), /practiceAccompaniment overlaps/);
  const relabeledRest = fixture();
  relabeledRest.song.rhythm = { restWindows: [{ beat: 12, duration: 2, policy: "hold" }] };
  assert.throws(() => check(relabeledRest), /hold policy contradicts/);
});

test("source extent alone does not invent all-layer silence over an evidenced accompaniment hold", () => {
  const input = fixture();
  input.evidence.silentWindows = [];
  input.song.autoAccompaniment = { events: [{ beat: 12, duration: 2, notes: [{ name: "G3" }] }] };
  input.song.rhythm = { restWindows: [{ beat: 12, duration: 2, policy: "hold" }] };
  assert.equal(check(input).checkedSilentWindows, 0);
  input.song.autoAccompaniment.events[0].duration = 3;
  assert.throws(() => check(input), /extends beyond reviewed sourceTotalBeats/);
});

test("checks support duration overlap, not just whether its onset lies in the rest", () => {
  const input = fixture();
  input.song.autoAccompaniment = { events: [{ beat: 11.5, duration: 1, notes: [{ name: "G3" }] }] };
  assert.throws(() => check(input), /autoAccompaniment overlaps/);
});

test("accepts a unique explicit melody even when it is neither first nor highest", () => {
  const input = fixture();
  input.song.schemaVersion = 2;
  input.song.events = input.song.steps.map(([name, beat, duration]) => ({ beat, duration, notes: [
    { name: "C6", role: "harmony", judge: false }, { name, role: "melody", judge: true }
  ] }));
  delete input.song.steps;
  assert.equal(check(input).checkedAttacks, 8);
  input.song.events[0].notes.forEach((note) => delete note.role);
  assert.throws(() => check(input), /identify one explicit melody/);
});

test("rejects multiple explicit melody roles or an explicitly non-melody event", () => {
  const input = fixture();
  input.song.schemaVersion = 2;
  input.song.events = input.song.steps.map(([name, beat, duration]) => ({ beat, duration, notes: [
    { name, role: "melody", judge: true }, { name: "C6", role: "melody", judge: false }
  ] }));
  delete input.song.steps;
  assert.throws(() => check(input), /identify one explicit melody/);
  input.song.events[0].notes = [{ name: "C4", role: "bass", judge: true }];
  assert.throws(() => check(input), /identify one explicit melody/);
});

test("tests all 12 global shifts; chromatic source scope may be impossible but other transpositions can fit", () => {
  assert.deepEqual(fittingTranspositions([0, 2, 4, 5, 6, 7, 8, 9, 11]), []);
  assert.ok(fittingTranspositions([1, 3, 5, 6, 8, 10, 0]).includes(11));
  const input = fixture();
  input.evidence.pitchFit.sourcePitchClasses.push(6);
  assert.throws(() => check(input), /do not naturalize essential accidentals/);
});

test("evidence must match the version and provide meaningful, bounded expectations", () => {
  const input = fixture();
  input.evidence.songId = "another-song";
  assert.throws(() => check(input), /identify this song/);
  input.evidence.songId = input.song.id;
  input.evidence.melodySpans = [];
  assert.throws(() => check(input), /At least one reviewed melody span/);
  assert.throws(() => fraction("1/0"), /Expected a finite number/);
  assert.throws(() => fraction("0.333"), /Expected a finite number/);
  assert.throws(() => fittingTranspositions([]), /reviewed source vocabulary/);
});

test("rejects an octave-dot mismatch despite a legal natural pitch and unchanged timing", () => {
  const input = fixture();
  input.song.steps[2][0] = "D5";
  assert.throws(() => check(input), /pitch differs/);
});


test("sixteenth-note triplets preserve 24 attacks per four-beat bar without rounded accumulation", () => {
  const notes = ["C5", "A4", "E4"];
  const input = {
    song: { id: "synthetic-sixteenth-triplets", schemaVersion: 1,
      steps: Array.from({ length: 24 }, (_, i) => [notes[i % 3], 5 + i / 6, 1 / 6]) },
    evidence: { songId: "synthetic-sixteenth-triplets",
      source: { reference: "synthetic fixture authored for this checker", scope: "one 4/4 bar" },
      melodySpans: [{ from: 5, to: 9, attacks: Array.from({ length: 24 }, (_, i) =>
        [notes[i % 3], `${30 + i}/6`, "1/6"]) }] }
  };
  assert.equal(check(input).checkedAttacks, 24);
  const rounded = structuredClone(input);
  rounded.song.steps = rounded.song.steps.map(([note], i) => [note, 5 + i * 0.167, 0.167]);
  assert.throws(() => check(rounded), /differs/);
  const regular = structuredClone(input);
  regular.song.steps = Array.from({ length: 16 }, (_, i) => [notes[i % 3], 5 + i / 4, 1 / 4]);
  assert.throws(() => check(regular), /attack count differs/);
});


test("source-confirmed cross-bar hold does not retrigger at a barline or absorb the next true repeat", () => {
  const input = {
    song: { id: "synthetic-cross-bar-tie", schemaVersion: 1, beatsPerMeasure: 4,
      steps: [["C4", 0, 5], ["C4", 5, 1]], sourceFeatures: { sourceTotalBeats: 6 } },
    evidence: { songId: "synthetic-cross-bar-tie",
      source: { reference: "synthetic fixture authored for this checker", scope: "confirmed five-beat tie then independently attacked same pitch" },
      melodySpans: [{ from: 0, to: 6, attacks: [["C4", 0, 5], ["C4", 5, 1]] }] }
  };
  assert.equal(check(input).checkedAttacks, 2);
  const barRetrigger = structuredClone(input);
  barRetrigger.song.steps = [["C4", 0, 4], ["C4", 4, 1], ["C4", 5, 1]];
  assert.throws(() => check(barRetrigger), /attack count differs/);
  const overmerged = structuredClone(input); overmerged.song.steps = [["C4", 0, 6]];
  assert.throws(() => check(overmerged), /attack count differs/);
});
