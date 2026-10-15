import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Compares encoded events with explicitly reviewed expectations. Never reads
// score pixels, guesses a melody, edits a song, merges ties, or approves music.
const EPSILON = 1e-9;
const NATURALS = new Set([0, 2, 4, 5, 7, 9, 11]);
const near = (a, b) => Math.abs(a - b) <= EPSILON;
const overlap = (a, b) => a.beat < b.beat + b.duration - EPSILON
  && a.beat + a.duration > b.beat + EPSILON;

export function fraction(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+\/\d+$/.test(value)) {
    const [numerator, denominator] = value.split("/").map(Number);
    if (Number.isSafeInteger(numerator) && Number.isSafeInteger(denominator) && denominator > 0) {
      return numerator / denominator;
    }
  }
  throw new Error(`Expected a finite number or integer fraction, received ${JSON.stringify(value)}`);
}

export function fittingTranspositions(sourcePitchClasses) {
  assert.ok(Array.isArray(sourcePitchClasses) && sourcePitchClasses.length > 0,
    "sourcePitchClasses must contain the independently reviewed source vocabulary");
  assert.ok(sourcePitchClasses.every((pitch) => Number.isInteger(pitch) && pitch >= 0 && pitch < 12),
    "source pitch classes must be integers 0–11");
  return Array.from({ length: 12 }, (_, shift) => shift)
    .filter((shift) => sourcePitchClasses.every((pitch) => NATURALS.has((pitch + shift) % 12)));
}

function melodyAttacks(song) {
  if (song.schemaVersion === 1) {
    assert.ok(Array.isArray(song.steps), "V1 steps are required");
    return song.steps.map(([name, beat, duration]) => ({ name, beat, duration }));
  }
  assert.equal(song.schemaVersion, 2, "Only V1/V2 song data is supported");
  assert.ok(Array.isArray(song.events), "V2 events are required");
  return song.events.map((event, index) => {
    assert.ok(Array.isArray(event.notes) && event.notes.length > 0, `event ${index}: notes are required`);
    const explicit = event.notes.filter((note) => note.role === "melody");
    const melody = explicit.length === 1 ? explicit[0]
      : event.notes.length === 1 && event.notes[0].role === undefined ? event.notes[0] : null;
    assert.ok(melody, `event ${index}: identify one explicit melody; never guess highest/first note`);
    return { name: melody.name, beat: event.beat, duration: event.duration };
  });
}

function assertTiming(event, context) {
  assert.ok(Number.isFinite(event.beat) && event.beat >= 0, `${context}: invalid beat`);
  assert.ok(Number.isFinite(event.duration) && event.duration > 0
    && Number.isFinite(event.beat + event.duration), `${context}: invalid duration`);
}

export function checkTranscriptionEvidence(song, evidence) {
  assert.equal(evidence.songId, song.id, "Evidence must identify this song/version");
  assert.ok(typeof evidence.source?.reference === "string" && evidence.source.reference.trim(),
    "Record the source reference (or synthetic fixture identity)");
  assert.ok(typeof evidence.source?.scope === "string" && evidence.source.scope.trim(),
    "Record exactly which measures/decisions were reviewed");
  assert.ok(Array.isArray(evidence.melodySpans) && evidence.melodySpans.length > 0,
    "At least one reviewed melody span is required");
  const melody = melodyAttacks(song);
  assert.ok(melody.length > 0, "A melody is required");
  melody.forEach((event, index) => {
    assertTiming(event, `melody ${index}`);
    assert.ok(typeof event.name === "string" && event.name.length, `melody ${index}: missing pitch`);
    if (index) assert.ok(event.beat >= melody[index - 1].beat, "Melody attacks must be sorted");
  });
  let checkedAttacks = 0;
  for (const [index, span] of evidence.melodySpans.entries()) {
    const start = fraction(span.from);
    const end = fraction(span.to);
    assert.ok(start >= 0 && end > start, `span ${index}: invalid bounds`);
    assert.ok(Array.isArray(span.attacks), `span ${index}: expected attacks are required`);
    const window = { beat: start, duration: end - start };
    const actual = melody.filter((event) => overlap(event, window));
    assert.equal(actual.length, span.attacks.length, `span ${index}: attack count differs`);
    span.attacks.forEach(([name, beat, duration], attackIndex) => {
      const expected = { name, beat: fraction(beat), duration: fraction(duration) };
      assertTiming(expected, `span ${index} expected attack ${attackIndex}`);
      assert.ok(overlap(expected, window), `span ${index}: expected attack is outside review scope`);
      const event = actual[attackIndex];
      assert.equal(event.name, name, `span ${index}, attack ${attackIndex}: pitch differs`);
      assert.ok(near(event.beat, expected.beat), `span ${index}, attack ${attackIndex}: onset differs`);
      assert.ok(near(event.duration, expected.duration), `span ${index}, attack ${attackIndex}: duration differs`);
    });
    checkedAttacks += actual.length;
  }
  const rests = (evidence.silentWindows || []).map(({ beat, duration }) => ({
    beat: fraction(beat), duration: fraction(duration)
  }));
  if (Object.hasOwn(evidence, "sourceTotalBeats")) {
    const total = fraction(evidence.sourceTotalBeats);
    const lastEnd = Math.max(...melody.map((event) => event.beat + event.duration));
    assert.ok(total >= 0 && total + EPSILON >= lastEnd, "Source end cannot truncate a sounding melody note");
    assert.ok(typeof song.sourceFeatures?.sourceTotalBeats === "number"
      && near(song.sourceFeatures.sourceTotalBeats, total), "Preserve the reviewed sourceTotalBeats");
  }
  const layers = [["melody", melody]];
  for (const key of ["autoAccompaniment", "practiceAccompaniment"]) {
    if (song[key]) {
      assert.ok(Array.isArray(song[key].events), `${key}: events are required`);
      song[key].events.forEach((event, index) => assertTiming(event, `${key} ${index}`));
      layers.push([key, song[key].events]);
    }
  }
  if (Object.hasOwn(evidence, "sourceTotalBeats")) {
    const total = fraction(evidence.sourceTotalBeats);
    for (const [name, events] of layers) {
      assert.ok(events.every((event) => event.beat + event.duration <= total + EPSILON),
        `${name} extends beyond reviewed sourceTotalBeats`);
    }
    assert.ok(rests.every((rest) => rest.beat + rest.duration <= total + EPSILON),
      "A reviewed rest extends beyond sourceTotalBeats");
  }
  rests.forEach((rest, index) => {
    assertTiming(rest, `silent window ${index}`);
    for (const [name, events] of layers) {
      assert.ok(!events.some((event) => overlap(event, rest)), `${name} overlaps reviewed silent window ${index}`);
    }
    assert.ok(!(song.rhythm?.restWindows || []).some((window) => window.policy === "hold" && overlap(window, rest)),
      `A hold policy contradicts reviewed silent window ${index}`);
  });
  let transpositions;
  if (evidence.pitchFit) {
    transpositions = fittingTranspositions(evidence.pitchFit.sourcePitchClasses);
    if (Object.hasOwn(evidence.pitchFit, "semitoneShift")) {
      const shift = evidence.pitchFit.semitoneShift;
      assert.ok(Number.isInteger(shift), "The disclosed semitoneShift must be an integer");
      assert.ok(transpositions.includes(((shift % 12) + 12) % 12),
        "Declared global transposition does not fit: do not naturalize essential accidentals");
    }
  }
  return { songId: song.id, reviewedSpans: evidence.melodySpans.length, checkedAttacks,
    checkedSilentWindows: rests.length, fittingTranspositions: transpositions,
    limitation: "Checks encoding against supplied expectations only; source pixels, harmony, listening and physical playability still need review." };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [songPath, evidencePath] = process.argv.slice(2);
  if (!songPath || !evidencePath) {
    console.error("Usage: node check-transcription-evidence.mjs <song.json> <reviewed-evidence.json>");
    process.exitCode = 2;
  } else {
    try {
      const [song, evidence] = await Promise.all([songPath, evidencePath]
        .map(async (path) => JSON.parse(await readFile(path, "utf8"))));
      console.log(JSON.stringify(checkTranscriptionEvidence(song, evidence), null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
