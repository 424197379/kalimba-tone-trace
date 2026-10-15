import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { readSongFiles } from "./build-song-library.mjs";
import { NOTE_INDEX } from "../src/songs.js";
import { getPracticeSongs, getPracticeSongId, getSongBaseId, getSongVersionRank,
  getSongAccompanimentProvider, hasMatchingPracticeMelody, parseImportedSongs } from "../src/song-store.js";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
const plain = value => JSON.parse(JSON.stringify(value));
const melodyBytes = await read("data/songs/see-you-again.json");
const legacyBytes = await read("data/songs/see-you-again-chord.json");
const melody = JSON.parse(melodyBytes);
const legacy = JSON.parse(legacyBytes);
const song = JSON.parse(await read("data/songs/see-you-again-reviewed-support.json"));
const review = song.sourceFeatures.practiceAccompaniment;
const melodyHash = "0bcaf2d5daed29e3c2d8420436910a5faa27306d4f13211a4a91d0ec554aa4ad";
const supportHash = "ab4ffa30e7e6617ce5972ced8c1038c631e1d0ca1671fde3356a0522bb6a1382";
const overlap = (a, b) => a.beat < b.beat + b.duration && a.beat + a.duration > b.beat;
const melodyTuples = value => value.events.map(e => [e.notes.find(n => n.role === "melody").name, e.beat, e.duration]);

// Bounded decisions from the separately pixel-read bass fixture, checked again
// by an independent reviewer before the production companion existed. These are
// twelve explicit source rows, not a progression inferred from a song title or
// copied from the new JSON. The source prints dyads, not complete chord names.
const sourceRows = [
  [1, 0, "A3"], [2, 4, "F3"], [3, 8, "A3"], [4, 12, "F3"],
  [5, 16, "A3"], [6, 20, "F3"], [7, 24, "A3"], [8, 28, "F3"],
  [9, 32, "A3"], [10, 36, "F3"], [11, 40, "A3"], [12, 44, "F3"]
];
const sourceSpans = sourceRows.flatMap(([measure, beat, lower]) => [
  { measure, beat, duration: 1.5, pitches: [lower, "C4"], lower },
  { measure, beat: beat + 1.5, duration: 2.5, pitches: ["G3", "C4"], lower: "G3" }
]);
const expectedTuples = sourceSpans.map(s => [s.lower, s.beat, s.duration]);
function gaps(steps, end = 48) {
  const result = [];
  let previousEnd = 0;
  for (const [, beat, duration] of steps) {
    if (beat > previousEnd) result.push({ beat: previousEnd, duration: beat - previousEnd });
    previousEnd = Math.max(previousEnd, beat + duration);
  }
  if (previousEnd < end) result.push({ beat: previousEnd, duration: end - previousEnd });
  return result;
}

// This source-specific test oracle is deliberately stricter than the generic
// schema: it protects Candidate A, not arbitrary otherwise valid arrangements.
// It tests complete durations against both source changes and melody silence.
function checkCandidate(block, { melodySteps = melody.steps, sourceRests = [], melodyRests = gaps(melodySteps) } = {}) {
  assert.equal(block.enabledByDefault, false, "support must remain opt-in");
  assert.equal(block.volume, .30, "support volume must retain the reviewed trial setting");
  let previousEnd = 0;
  for (const event of block.events) {
    assert.ok(Number.isFinite(event.beat) && event.beat >= 0 && Number.isFinite(event.duration) && event.duration > 0, "finite positive timing");
    assert.ok(event.beat + event.duration <= 48, "support must not exceed preview boundary");
    assert.ok(event.beat >= previousEnd, "one support voice cannot overlap itself");
    previousEnd = event.beat + event.duration;
    assert.equal(event.pattern, "source-lower-voice-only", "no new backing pattern");
    assert.equal(event.notes.length, 1, "only one lower voice is retained");
    const note = event.notes[0];
    assert.ok(NOTE_INDEX.has(note.name), "literal source pitch must fit without octave folding");
    assert.equal(note.role, "bass", "only the source lower voice is app support");
    assert.equal(Object.hasOwn(note, "judge"), false, "support cannot be a physical target, even judge:false");
    assert.equal(note.velocity, .32, "support note velocity must retain the reviewed trial setting");
    assert.ok(!melodySteps.some(([name, beat]) => name === note.name && beat === event.beat), "no same-onset same-pitch melody duplication");
    assert.ok(!sourceRests.some(rest => overlap(event, rest)), "support duration overlaps source rest");
    assert.ok(!melodyRests.some(rest => overlap(event, rest)), "support duration overlaps melody rest or breath");
    const spans = sourceSpans.filter(span => overlap(event, span));
    let covered = 0;
    for (const span of spans) {
      assert.ok(span.pitches.includes(note.name), "unsupported pitch in a full-duration source span");
      covered += Math.min(event.beat + event.duration, span.beat + span.duration) - Math.max(event.beat, span.beat);
    }
    assert.equal(covered, event.duration, "whole support duration must have selected-source coverage");
    const origin = sourceSpans.find(span => span.beat === event.beat);
    assert.ok(origin && origin.duration === event.duration, "exact source attack and tie-merged duration required");
    assert.equal(note.name, origin.lower, "retain the literal lower voice, not the upper dyad member");
  }
  assert.deepEqual(block.events.map(e => [e.notes[0].name, e.beat, e.duration]), expectedTuples,
    "all 24 selected-source lower-voice attacks must remain exact");
  return true;
}

// Exercise the real stored/built-in normalization against source JSON without
// regenerating songs.js here. No browser storage is read or changed. This also
// lets the focused test run before the integration owner runs build:songs.
const storeText = await read("src/song-store.js");
function normalizedLibrary(rawSongs) {
  const context = {
    NOTE_INDEX, SONG_LIBRARY: Object.fromEntries(rawSongs.map(s => [s.id, s])),
    localStorage: { getItem: () => null, setItem() { throw new Error("test must not persist storage"); } },
    console
  };
  runInNewContext(storeText.replace(/^import[^\n]+\n/, "").replace(/^export /gm, ""), context);
  return context.getSongLibrary();
}
const rawSongs = (await readSongFiles()).map(({ song: entry }) => entry);
const library = normalizedLibrary(rawSongs);
const appText = await read("src/app.js");
function appSupportContext() {
  const context = { songLibrary: library, getSongBaseId, getSongVersionRank, getSongAccompanimentProvider, hasMatchingPracticeMelody };
  for (const name of ["getSongVariants", "getPracticeAccompanimentSource", "getPracticeAccompanimentConfig", "getAccompanimentConfig", "getDefaultAccompanimentEnabled"]) {
    const body = appText.match(new RegExp(`^    function ${name}\\([^]*?^    }`, "m"))?.[0];
    assert.ok(body, `actual app helper ${name} is present`);
    runInNewContext(body, context);
  }
  return context;
}

// The importer uses autoAccompaniment for new uploads; the built-in-specific
// practiceAccompaniment field is not claimed to round-trip through that path.
const uploadForm = block => {
  const result = structuredClone(song);
  delete result.practiceAccompaniment;
  result.autoAccompaniment = block;
  return result;
};

test("the new companion freezes the existing V1 and complete historical V2 bytes", () => {
  assert.equal(hash(melodyBytes), "2b456fbbc7d1862be5bd9e5e06f02e443e4da43dcfcb1c53a590f7a31709e2e5");
  assert.equal(hash(legacyBytes), "f22f7a54d6ee3d9caa20dc21925470337bd43cf3d134e4e912b261ddcabe76fb");
  assert.equal(legacy.events.length, 99);
  assert.equal(legacy.autoAccompaniment.events.length, 12);
  for (const field of ["events", "practiceAccompaniment", "autoAccompaniment", "rhythm"]) assert.equal(Object.hasOwn(melody, field), false);
});

test("all 86 physical targets are identical single judged melody events at the original timebase", () => {
  assert.equal(song.schemaVersion, 2);
  assert.equal(song.baseSongId, "see-you-again");
  assert.equal(song.arrangementKind, "melody");
  assert.equal(song.judgementMode, "melody");
  assert.equal(song.events.length, 86);
  for (const event of song.events) {
    assert.equal(event.notes.length, 1);
    assert.deepEqual(event.notes[0], { name: event.notes[0].name, role: "melody", judge: true, velocity: 1 });
  }
  assert.deepEqual(melodyTuples(song), melody.steps);
  assert.equal(hash(JSON.stringify(melodyTuples(song))), melodyHash);
  assert.equal(review.melodyCompatibility.tupleSha256, melodyHash);
  assert.deepEqual([song.bpm, song.defaultSpeedFactor, song.beatsPerMeasure, song.key, song.tuning], [80, .88, 4, "C", "21-key-c"]);
  assert.equal(song.sourceFeatures.sourceTotalBeats, 48);
  assert.equal(Object.hasOwn(song, "autoAccompaniment"), false);
});

test("Candidate A retains exactly 24 source lower-voice attacks and twelve tie merges", () => {
  assert.equal(checkCandidate(song.practiceAccompaniment), true);
  assert.equal(hash(JSON.stringify(song.practiceAccompaniment)), supportHash);
  assert.equal(review.evidenceFingerprints.candidateBlockSha256, supportHash);
  assert.equal(song.practiceAccompaniment.events.length, 24);
  assert.deepEqual([...new Set(song.practiceAccompaniment.events.map(e => e.notes[0].name))].sort(), ["A3", "F3", "G3"]);
  assert.equal(song.practiceAccompaniment.events.reduce((sum, e) => sum + e.duration, 0), 48);
  for (const [, beat] of sourceRows) {
    assert.deepEqual(song.practiceAccompaniment.events.filter(e => e.beat >= beat && e.beat < beat + 4)
      .map(e => [e.beat - beat, e.duration]), [[0, 1.5], [1.5, 2.5]]);
    assert.equal(song.practiceAccompaniment.events.some(e => e.beat === beat + 2), false);
  }
  assert.deepEqual(song.practiceAccompaniment.events.at(-1), {
    beat: 45.5, duration: 2.5, pattern: "source-lower-voice-only", notes: [{ name: "G3", role: "bass", velocity: .32 }]
  });
});

test("whole support spans agree with the source while overlapping the exact unchanged melody", () => {
  let overlapDuration = 0;
  for (const event of song.practiceAccompaniment.events) {
    const overlappingMelody = melody.steps.filter(([, beat, duration]) => overlap(event, { beat, duration }));
    assert.ok(overlappingMelody.length > 0);
    const covered = overlappingMelody.reduce((sum, [, beat, duration]) =>
      sum + Math.min(event.beat + event.duration, beat + duration) - Math.max(event.beat, beat), 0);
    assert.equal(covered, event.duration, "every backing span stays aligned with the actual corrected melody");
    overlapDuration += covered;
  }
  assert.equal(overlapDuration, 48);
  assert.deepEqual(gaps(melody.steps), []);
  assert.deepEqual(song.rhythm.restWindows, []);
  assert.deepEqual(review.rests.melodyRestWindows, []);
  assert.deepEqual(review.rests.sourceLowerVoiceRestWindows, []);
  assert.deepEqual(review.rests.allLayerSilentWindows, []);
  assert.equal(song.rhythm.pickupBeats, 0);
});

test("unsupported source bass, isolated octaves, upper C4, added tones, and old backing fail", () => {
  for (const pitch of ["F3", "A2", "A4", "C4", "E4"]) {
    const changed = structuredClone(song.practiceAccompaniment);
    changed.events[0].notes[0].name = pitch;
    assert.throws(() => checkCandidate(changed), /source span|source pitch|literal lower voice/);
  }
  const dyads = structuredClone(song.practiceAccompaniment);
  dyads.events[0].notes.push({ name: "C4", role: "harmony", velocity: .24 });
  assert.throws(() => checkCandidate(dyads), /one lower voice/);
  const old = structuredClone(song.practiceAccompaniment);
  old.events = structuredClone(legacy.autoAccompaniment.events);
  assert.throws(() => checkCandidate(old), /pattern|one lower voice|trial setting|source span|source attack/);
  // Even thinning/relabeling the old downbeats cannot stand in for the source.
  old.events = legacy.autoAccompaniment.events.map(e => ({ beat: e.beat, duration: e.duration,
    pattern: "source-lower-voice-only", notes: [{ name: e.notes.find(n => n.role === "bass").name, role: "bass", velocity: .32 }] }));
  assert.throws(() => checkCandidate(old), /source attack/);
});

test("crossing source changes and retriggering any of the twelve tied beat-2 notes fail", () => {
  for (const [, beat] of sourceRows) {
    const stretched = structuredClone(song.practiceAccompaniment);
    stretched.events.find(e => e.beat === beat).duration = 4;
    assert.throws(() => checkCandidate(stretched), /source span/);
    const retriggered = structuredClone(song.practiceAccompaniment);
    const index = retriggered.events.findIndex(e => e.beat === beat + 1.5);
    retriggered.events[index].duration = .5;
    retriggered.events.splice(index + 1, 0, { ...structuredClone(retriggered.events[index]), beat: beat + 2, duration: 2 });
    assert.throws(() => checkCandidate(retriggered), /source attack and tie-merged duration/);
  }
  for (const change of [block => block.events.pop(), block => block.events.at(-1).duration = 3,
    block => block.events.push({ ...structuredClone(block.events.at(-1)), beat: 48 })]) {
    const changed = structuredClone(song.practiceAccompaniment); change(changed);
    assert.throws(() => checkCandidate(changed), /24 selected-source|preview boundary/);
  }
});

test("duration-only rest overlap, short silence, and a one-beat melody breath cannot gain fills", () => {
  assert.throws(() => checkCandidate(song.practiceAccompaniment, { sourceRests: [{ beat: 1, duration: .25 }] }), /source rest/);
  assert.throws(() => checkCandidate(song.practiceAccompaniment, { melodyRests: [{ beat: .5, duration: 1 }] }), /melody rest or breath/);
  const shortenedMelody = structuredClone(melody.steps);
  shortenedMelody[0][2] = .25;
  assert.throws(() => checkCandidate(song.practiceAccompaniment, { melodySteps: shortenedMelody }), /melody rest or breath/);
  const doubleAttack = structuredClone(song.practiceAccompaniment);
  doubleAttack.events[0].notes[0].name = "G5";
  assert.throws(() => checkCandidate(doubleAttack), /melody duplication/);
});

test("off-by-default, volume, velocity, roles and absence of judge are strict candidate invariants", () => {
  for (const value of [true, undefined, "false"]) {
    const changed = structuredClone(song.practiceAccompaniment); changed.enabledByDefault = value;
    assert.throws(() => checkCandidate(changed), /opt-in/);
  }
  for (const value of [.38, .31, 1, 0, undefined, ".3", NaN]) {
    const changed = structuredClone(song.practiceAccompaniment); changed.volume = value;
    assert.throws(() => checkCandidate(changed), /volume/);
  }
  for (const value of [.8, .33, 0, undefined, ".32", NaN]) {
    const changed = structuredClone(song.practiceAccompaniment); changed.events[0].notes[0].velocity = value;
    assert.throws(() => checkCandidate(changed), /velocity/);
  }
  for (const judge of [true, false]) {
    const changed = structuredClone(song.practiceAccompaniment); changed.events[0].notes[0].judge = judge;
    assert.throws(() => checkCandidate(changed), /physical target/);
  }
  const role = structuredClone(song.practiceAccompaniment); role.events[0].notes[0].role = "melody";
  assert.throws(() => checkCandidate(role), /lower voice/);
});

test("historical voice mismatches stay recorded and do not become selected-source evidence", () => {
  const bassMismatches = events => events.filter(e => e.notes.some(n => n.role === "bass" &&
    !sourceSpans.filter(s => overlap(e, s)).every(s => s.pitches.includes(n.name)))).map(e => e.beat / 4 + 1);
  assert.deepEqual(bassMismatches(legacy.autoAccompaniment.events), [6, 7, 8, 10, 11, 12]);
  assert.deepEqual(bassMismatches(legacy.events), [2, 6, 7, 8, 10, 11, 12]);
  assert.deepEqual(review.historicalSibling.autoBassMismatchMeasures, [6, 7, 8, 10, 11, 12]);
  assert.deepEqual(review.historicalSibling.eventAnchorBassMismatchMeasures, [2, 6, 7, 8, 10, 11, 12]);
  assert.equal(legacy.autoAccompaniment.events.filter(e => e.notes.some(n =>
    !sourceSpans.filter(s => overlap(e, s)).every(s => s.pitches.includes(n.name)))).length, 12);
  assert.equal(legacy.autoAccompaniment.events.some(e => e.beat % 4 === 1.5), false);
});

test("actual content guard accepts the new companion and rejects the old melody and changed content", () => {
  assert.equal(hasMatchingPracticeMelody(melody, song), true);
  assert.equal(hasMatchingPracticeMelody(melody, legacy), false);
  for (const change of [c => c.events[0].notes[0].name = "G4", c => c.events[0].beat += .25,
    c => c.events[0].duration += .25, c => c.events.pop(), c => c.bpm = 81,
    c => c.sourceFeatures.sourceTotalBeats = 49, c => c.events[0].notes[0].judge = false]) {
    const changed = structuredClone(song); change(changed);
    assert.equal(hasMatchingPracticeMelody(melody, changed), false);
  }
});

test("real normalization preserves the support; all old/new links select only the canonical 86-note card", () => {
  assert.deepEqual(plain(library[song.id].practiceAccompaniment), song.practiceAccompaniment);
  assert.deepEqual(plain(library[song.id].steps), melody.steps);
  const withoutCompanion = normalizedLibrary(rawSongs.filter(s => s.id !== song.id));
  assert.equal(Object.keys(library).length, Object.keys(withoutCompanion).length + 1);
  assert.equal(getPracticeSongs(library).length, getPracticeSongs(withoutCompanion).length);
  assert.equal(getPracticeSongs(library).filter(s => getSongBaseId(s) === "see-you-again").length, 1);
  for (const id of [melody.id, legacy.id, song.id]) assert.equal(getPracticeSongId(library, id), melody.id);
  assert.equal(getPracticeSongs(library).find(s => s.id === melody.id).steps.length, 86);
  // Canonical preference is stable even when the new companion is enumerated first.
  const reversed = normalizedLibrary([song, legacy, melody]);
  assert.deepEqual(getPracticeSongs(reversed).map(s => s.id), [melody.id]);
  const app = appSupportContext();
  assert.deepEqual(plain(app.getPracticeAccompanimentConfig(library[melody.id])), song.practiceAccompaniment);
  assert.deepEqual(plain(app.getAccompanimentConfig(library[melody.id], "light")), song.practiceAccompaniment);
  assert.equal(app.getAccompanimentConfig(library[melody.id], "original"), null);
  assert.equal(app.getDefaultAccompanimentEnabled(library[melody.id]), false);
});

test("raw built-in import rejects the unsupported field rather than silently losing 24 support attacks", () => {
  assert.throws(() => parseImportedSongs(JSON.stringify(song), {}), /顶层 practiceAccompaniment.*外部导入不支持.*autoAccompaniment.*不要仅删除字段而丢失伴奏/);
});

test("supported upload representation preserves all targets and exact app-only support without persistence", () => {
  const imported = parseImportedSongs(JSON.stringify(uploadForm(song.practiceAccompaniment)), {});
  const importedLibrary = Object.fromEntries(imported.map(s => [s.id, s]));
  const practice = getPracticeSongs(importedLibrary);
  const source = imported.find(s => s.autoAccompaniment);
  assert.equal(practice.length, 1);
  assert.deepEqual(practice[0].steps, melody.steps);
  assert.equal(practice[0].events.every(e => e.notes.length === 1 && e.notes[0].role === "melody" && e.notes[0].judge === true), true);
  assert.deepEqual(source.autoAccompaniment, song.practiceAccompaniment);
  assert.equal(hasMatchingPracticeMelody(practice[0], source), true);
  for (const change of [c => c.autoAccompaniment.events[0].notes[0].name = "A2",
    c => c.autoAccompaniment.events[0].notes[0].judge = false,
    c => c.autoAccompaniment.events[0].notes[0].velocity = "0.32",
    c => c.autoAccompaniment.events.at(-1).duration = 3]) {
    const changed = uploadForm(structuredClone(song.practiceAccompaniment)); change(changed);
    assert.throws(() => parseImportedSongs(JSON.stringify(changed), {}));
  }
});

test("source metadata bounds rhythm, reduction, rest semantics and unperformed listening claims", () => {
  assert.equal(song.rhythm.sourceStatus, "verified");
  assert.equal(song.rhythm.sources[0].url, "https://www.guitarworld.com.cn/pu/q79160");
  assert.equal(review.sourceImageSha256, "8ba82cb8c119bb739bc44a3e433fd8804aa8dc6eb2752c13f42671aa8ec198c7");
  assert.deepEqual(review.reviewedBeatRanges, [[0, 48]]);
  assert.equal(review.reduction.omittedPitch, "C4");
  for (const field of ["octaveFolding", "accidentalNaturalization", "addedNotes", "addedAttacks", "completeChordNamesInferred"]) assert.equal(review.reduction[field], false);
  assert.equal(review.reduction.semitoneShift, 0);
  assert.match(review.sourceSpanMembership, /full duration/);
  assert.match(review.rests.meaning, /no written rests.*not permission to fill a future gap/);
  assert.match(review.sourcePixels, /one source edition/);
  assert.equal(review.referenceListening, "not-performed");
  assert.equal(review.physicalKalimba, "not-performed");
  assert.equal(review.browserAudio, "not-performed-in-data-stage");
  assert.equal(song.sourceFeatures.suitability.status, "conditional");
  assert.match(review.limits, /Timbre, balance, headroom/);
  assert.match(review.limits, /Public reproduction rights remain unestablished/);
});
