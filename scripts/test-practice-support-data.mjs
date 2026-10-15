import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Frozen JSON hashes from baseline 73041ef; also work in the portable ZIP without Git.
const originalHashes = {
  "birthday": "dc9ef58c5f8dd30520f81b971a7b45dc1e551efdce3a4fd659352bd982c3cb0f",
  "birthday-chord": "ee49e1c426c7417ec7581eb6f490a410c0bd2e38e249a68732b88590a9beb8b5",
  "xiao-xing-xing": "a0eb14da1ece9be7fa15941ba6be1591cf46e9b7b2de0b44ea92c7933adecea2",
  "xiao-xing-xing-chord": "19babbec0b375f4a8be1b867c7f6d568cc626848707fb3a8a1bbc54313f21347"
};
const hashBytes = value => createHash("sha256").update(value).digest("hex");
const hashSong = song => hashBytes(JSON.stringify(song));
const frozenFileHashes = {
  "birthday": "ffbf4fa0a7ed757e91da151e1a8132ec4f1800a30118a08b48919843fda1415a",
  "xiao-xing-xing": "2e8ec5df1af00f068d96ccf40289d5783c19a04c3178fddc52b6c3084e2b7a74",
  "xiao-xing-xing-chord": "124a61271dd0180be0b28ab15b598fb6eaffdf68af323b697562dd9a9d3f9d6e"
};
const EPSILON = 1e-8;
// Historical v2.4.2 intersection expectations are immutable, not rewritten to
// bless a later source correction that the original layers cannot establish.
const expectedIntersectionCandidates = {
  birthday: [
    [0, "G3", "C4"], [4, "G3", "D4"], [6, "G3", "D4"],
    [10, "G3", "C4"], [12, "G3", "C4"], [14, "F3", "C4"],
    [16, "G3", "C4"], [20, "G3", "D4"], [23, "G3", "C4"]
  ],
  "xiao-xing-xing": [
    [0, "G3", "C4"], [4, "F3", "C4"], [6, "G3", "C4"],
    [8, "F3", "C4"], [12, "G3", "D4"], [14, "G3", "C4"],
    [16, "G3", "C4"], [20, "C4"], [22, "G3", "D4"],
    [24, "G3", "C4"], [28, "G3"], [30, "G3"],
    [32, "G3", "C4"], [36, "F3", "C4"], [38, "G3", "C4"],
    [40, "F3", "C4"], [44, "G3", "D4"], [46, "G3", "C4"]
  ]
};
const expectedReviewedBirthday = [
  [0, "G3", "C4"], [4, "G3", "D4"], [6, "G3", "D4"],
  [10, "G3", "C4"], [12, "G3", "C4"], [14, "G3", "C4"],
  [16, "F3", "C4"], [20, "G3", "C4"], [23, "G3", "C4"]
];
// Read from the primary C-major lead sheet, with the retained +1 beat fermata
// realization after A4@17. Beat 0 has NO printed chord; C is separately inferred.
const birthdayPrintedChordTimeline = [
  [1, "C"], [4, "G7"], [10, "C"], [16, "F"],
  [20, "C/G"], [22, "G7"], [23, "C"]
];
const expectedBirthdayHarmonyAtSupport = [
  [0, "C", "inferred"], [4, "G7", "printed"], [6, "G7", "printed"],
  [10, "C", "printed"], [12, "C", "printed"], [14, "C", "printed"],
  [16, "F", "printed"], [20, "C/G", "printed"], [23, "C", "printed"]
];
const chordPitchClasses = { C: ["C", "E", "G"], G7: ["G", "B", "D", "F"], F: ["F", "A", "C"], "C/G": ["C", "E", "G"] };
const correctedBeats = [14, 16, 20];
const readSongBytes = id => readFile(new URL(`../data/songs/${id}.json`, import.meta.url));
const readSong = async id => JSON.parse(await readSongBytes(id));
const melodySteps = song => song.events.flatMap(event => event.notes
  .filter(note => note.role === "melody" && note.judge === true)
  .map(note => [note.name, event.beat, event.duration]));
const noteCount = events => events.reduce((total, event) => total + event.notes.length, 0);
const groups = events => events.map(event => [event.beat, ...event.notes.map(note => note.name)]);
const overlaps = (first, second) => first.beat < second.beat + second.duration - EPSILON
  && first.beat + first.duration > second.beat + EPSILON;

function withoutPracticeAdditions(song) {
  const original = structuredClone(song);
  delete original.practiceAccompaniment;
  if (original.sourceFeatures) delete original.sourceFeatures.practiceAccompaniment;
  return original;
}

function melodyGaps(song) {
  const gaps = [];
  let previousEnd = 0;
  for (const [, beat, duration] of melodySteps(song)) {
    if (beat > previousEnd + EPSILON) gaps.push({ beat: previousEnd, duration: beat - previousEnd });
    previousEnd = Math.max(previousEnd, beat + duration);
  }
  return gaps;
}

function assertIntersectionNote(event, note, source, anchorNotes) {
  assert.ok(source.notes.some(original => original.name === note.name && original.role === note.role),
    `beat ${event.beat}: ${note.name} must be in original backing`);
  assert.ok(anchorNotes.some(anchor => anchor.name === note.name && anchor.role === note.role),
    `beat ${event.beat}: ${note.name} must be in the judged non-melody anchor`);
}

function birthdayChordAt(beat) {
  if (beat === 0) return { symbol: "C", status: "inferred" };
  const entry = birthdayPrintedChordTimeline.filter(([start]) => start <= beat).at(-1);
  assert.ok(entry, `beat ${beat}: no source chord available`);
  return { symbol: entry[1], status: "printed" };
}

function assertBirthdayChordNote(event, note, source, anchorNotes) {
  const chord = birthdayChordAt(event.beat);
  const pitchClass = note.name.replace(/\d+$/, "");
  assert.ok(chordPitchClasses[chord.symbol].includes(pitchClass),
    `beat ${event.beat}: ${note.name} must belong to ${chord.status} ${chord.symbol} chord`);
  if (chord.symbol === "C/G" && note.role === "bass") {
    assert.equal(pitchClass, "G", "source C/G must retain its G bass");
  }
  // Six unchanged anchors must STILL satisfy the original intersection contract.
  if (!correctedBeats.includes(event.beat)) assertIntersectionNote(event, note, source, anchorNotes);
}

function assertSparseSupport(song, sourceReviewed = false) {
  const candidate = song.practiceAccompaniment;
  assert.ok(candidate && typeof candidate === "object", "practice support must exist");
  assert.equal(candidate.enabledByDefault, false, "practice support is opt-in");
  assert.equal(candidate.volume, 0.34, "support volume must remain quiet");
  assert.ok(Array.isArray(candidate.events) && candidate.events.length > 0);
  assert.ok(candidate.events.length <= song.autoAccompaniment.events.length, "do not add backing attacks");
  assert.ok(noteCount(candidate.events) < noteCount(song.autoAccompaniment.events), "light support must reduce density");

  const melodies = melodySteps(song).map(([name, beat, duration]) => ({ name, beat, duration }));
  const rests = [
    ...melodyGaps(song),
    ...(song.rhythm?.restWindows || []).filter(window => (window.policy || "silent") === "silent")
  ];
  const melodyEnd = Math.max(...melodies.map(event => event.beat + event.duration));
  let previousBeat = -Infinity;
  for (const event of candidate.events) {
    assert.ok(Number.isFinite(event.beat) && event.beat >= 0);
    assert.ok(event.beat > previousBeat, "support onsets must be sorted and unique");
    previousBeat = event.beat;
    assert.ok(Number.isFinite(event.duration) && event.duration > 0);
    assert.equal(event.pattern, sourceReviewed && correctedBeats.includes(event.beat)
      ? "source-chord-symbol-correction" : "conservative-anchor-intersection");

    const source = song.autoAccompaniment.events.find(original => original.beat === event.beat);
    assert.ok(source, `beat ${event.beat}: onset must exist in original backing`);
    const anchorNotes = song.events
      .filter(anchor => anchor.beat === event.beat)
      .flatMap(anchor => anchor.notes)
      .filter(note => note.judge === true && note.role !== "melody");
    assert.ok(anchorNotes.length, `beat ${event.beat}: support needs a judged non-melody anchor`);
    const nextRest = rests.filter(rest => rest.beat >= event.beat)
      .reduce((next, rest) => Math.min(next, rest.beat), melodyEnd);
    assert.equal(event.duration, Math.min(source.duration, nextRest - event.beat),
      `beat ${event.beat}: retain original duration, bounded by melody rests/end`);
    assert.ok(melodies.some(melody => melody.beat <= event.beat
      && melody.beat + melody.duration > event.beat), `beat ${event.beat}: no rest attacks`);
    assert.ok(!rests.some(rest => overlaps(event, rest)), `beat ${event.beat}: no rest overlap`);

    assert.ok(event.notes.length >= 1 && event.notes.length <= 2, "at most two support notes");
    assert.equal(new Set(event.notes.map(note => note.name)).size, event.notes.length);
    assert.ok(event.notes.filter(note => note.role === "bass").length <= 1, "at most one bass");
    assert.ok(event.notes.filter(note => note.role === "harmony").length <= 1, "at most one harmony");
    for (const note of event.notes) {
      assert.ok(["bass", "harmony"].includes(note.role), "no melody or ornamental support roles");
      assert.ok(!Object.hasOwn(note, "judge"), "backing notes are never judged");
      assert.equal(note.velocity, note.role === "bass" ? 0.4 : 0.34, "quiet role-specific velocity");
      (sourceReviewed ? assertBirthdayChordNote : assertIntersectionNote)(event, note, source, anchorNotes);
      assert.ok(!melodies.some(melody => melody.name === note.name && overlaps(event, melody)),
        `beat ${event.beat}: no active melody unison`);
    }
  }
}
const assertConservativeSupport = song => assertSparseSupport(song);
const assertBirthdaySourceSupport = song => assertSparseSupport(song, true);

const songs = new Map();
for (const id of Object.keys(expectedIntersectionCandidates)) songs.set(id, await readSong(`${id}-chord`));

function historicalBirthday() {
  const song = structuredClone(songs.get("birthday"));
  const historical = song.sourceFeatures.practiceAccompaniment.historicalCandidates
    .find(candidate => candidate.id === "conservative-layer-intersection-v2.4.2");
  assert.ok(historical, "keep a recoverable v2.4.2 candidate");
  song.practiceAccompaniment = historical.practiceAccompaniment;
  song.sourceFeatures.practiceAccompaniment = historical.review;
  return song;
}

for (const [id, expected] of Object.entries(expectedIntersectionCandidates)) {
  const song = songs.get(id);
  const intersectionSong = id === "birthday" ? historicalBirthday() : song;

  test(`${id}: original melody, chord targets, backing and metadata remain unchanged`, async () => {
    const melody = await readSong(id);
    assert.equal(hashSong(melody), originalHashes[id], "V1 melody must match frozen baseline");
    assert.deepEqual(melodySteps(song), melody.steps, "V2 melody must match the V1 melody exactly");
    assert.equal(hashSong(withoutPracticeAdditions(song)), originalHashes[id + "-chord"],
      "all original targets, backing and metadata must match frozen baseline");
    assert.equal(hashBytes(await readSongBytes(id)), frozenFileHashes[id], "V1 file bytes remain frozen");
    if (id === "xiao-xing-xing") {
      assert.equal(hashBytes(await readSongBytes(`${id}-chord`)), frozenFileHashes[`${id}-chord`],
        "all Twinkle V2 file bytes, including its candidate and provenance, remain frozen");
    }
  });

  test(`${id}: historical intersection retains exact sparse inventory and both-layer membership`, () => {
    assert.deepEqual(groups(intersectionSong.practiceAccompaniment.events), expected);
    assertConservativeSupport(intersectionSong);
    assert.ok(intersectionSong.practiceAccompaniment.events.length / melodySteps(intersectionSong).length < 0.5,
      "fewer than half the melody attacks receive support");
    assert.equal(noteCount(intersectionSong.practiceAccompaniment.events), id === "birthday" ? 18 : 33);
  });

  test(`${id}: intersection provenance does not claim independent harmonic verification`, () => {
    const review = intersectionSong.sourceFeatures.practiceAccompaniment;
    assert.equal(review.status, "needs-review");
    assert.equal(review.independentlyVerified, false);
    assert.equal(review.confidence, "conservative-existing-layer-intersection");
    assert.match(review.provenance, /not independently verified new harmony/);
    assert.match(review.method, /Conservative intersection/);
    assert.deepEqual(review.unresolvedConflictBeats, id === "xiao-xing-xing" ? [20, 28, 30] : []);
    assert.ok(review.reviewRequired.some(note => /Independent source comparison/.test(note)));
    if (id === "xiao-xing-xing") assert.ok(review.reviewRequired.some(note => /does not resolve/.test(note)));
  });
}

test("Birthday v2.4.2 candidate, provenance and complete song remain exactly reconstructable", () => {
  const historical = historicalBirthday();
  assert.equal(hashSong(historical.practiceAccompaniment), "b33a1e34caf60ede60923feaa41213bbe45bedde936339922592957312fe91ad");
  assert.equal(hashSong(historical.sourceFeatures.practiceAccompaniment), "6be0b0d3f9951a3f17ea835f5bd8577dabc542f0e7cc0745d7a3d7d514a8fb40");
  assert.equal(hashSong(historical), "079703c6d30d5ed9a822f43e589f0b66f6ff9c22dde8a323e7a73f89221ef71b");
});

test("Birthday reviewed support changes exactly three pitches and their descriptive pattern labels", () => {
  const song = songs.get("birthday");
  const expected = structuredClone(historicalBirthday().practiceAccompaniment);
  expected.events.find(event => event.beat === 14).notes[0].name = "G3";
  expected.events.find(event => event.beat === 16).notes[0].name = "F3";
  expected.events.find(event => event.beat === 20).notes[1].name = "C4";
  for (const event of expected.events) {
    if (correctedBeats.includes(event.beat)) event.pattern = "source-chord-symbol-correction";
  }
  assert.deepEqual(song.practiceAccompaniment, expected);
  assert.deepEqual(groups(song.practiceAccompaniment.events), expectedReviewedBirthday);
  assertBirthdaySourceSupport(song);
  assert.equal(song.practiceAccompaniment.events.length, 9);
  assert.equal(noteCount(song.practiceAccompaniment.events), 18);
  assert.ok(9 / melodySteps(song).length < 0.5);
});

test("Birthday all nine support events follow reviewed chord membership, with pickup explicitly inferred", () => {
  const song = songs.get("birthday");
  assert.deepEqual(song.practiceAccompaniment.events.map(event => {
    const chord = birthdayChordAt(event.beat);
    return [event.beat, chord.symbol, chord.status];
  }), expectedBirthdayHarmonyAtSupport);
  assertBirthdaySourceSupport(song);
  const review = song.sourceFeatures.practiceAccompaniment;
  assert.deepEqual(review.sourceReview.printedChordTimeline.map(chord => [chord.beat, chord.symbol]), birthdayPrintedChordTimeline);
  assert.deepEqual(review.correctedConflictBeats, correctedBeats);
  assert.deepEqual(review.unresolvedConflictBeats, []);
  assert.equal(review.sourceReview.pickupHarmony.beat, 0);
  assert.equal(review.sourceReview.pickupHarmony.symbol, "C");
  assert.equal(review.sourceReview.pickupHarmony.status, "inferred");
  assert.match(review.sourceReview.pickupHarmony.reason, /No chord symbol is printed above the pickup/);
  assert.equal(review.status, "needs-review");
  assert.equal(review.confidence, "source-chord-reviewed-voicing-candidate");
  assert.equal(review.independentlyVerified, false);
  assert.match(review.method, /not an exact written accompaniment score/);
  assert.match(review.provenance, /not independently verified/);
  assert.match(review.sourceReview.url, /^https:\/\/michaelkravchuk\.com\/free-lead-sheet-happy-birthday\/$/);
  assert.equal(review.sourceReview.page, 1);
  assert.ok(review.reviewRequired.some(note => /Fresh audible A\/B/.test(note)));
  assert.ok(review.reviewRequired.some(note => /Physical 21-key/.test(note)));
});

test("Birthday retained melody and ending use the primary fermata edition without a secondary rest", () => {
  const song = songs.get("birthday");
  const melody = melodySteps(song);
  assert.equal(melody.length, 25);
  assert.deepEqual(melody.slice(18), [
    ["A4", 17, 2], ["F5", 19, 0.75], ["F5", 19.75, 0.25],
    ["E5", 20, 1], ["C5", 21, 1], ["D5", 22, 1], ["C5", 23, 2]
  ]);
  const { fermata, ending } = song.sourceFeatures.practiceAccompaniment.sourceReview;
  assert.deepEqual([fermata.melodyNote, fermata.beat, fermata.writtenDuration, fermata.retainedDuration, fermata.extraPracticeBeats],
    ["A4", 17, 1, 2, 1]);
  assert.match(fermata.reason, /not a duration prescribed by the notation/);
  assert.deepEqual([ending.melodyNote, ending.beat, ending.duration, ending.soundingEnd, ending.finalRestBeats],
    ["C5", 23, 2, 25, 0]);
  assert.equal(Math.max(...melody.map(([, beat, duration]) => beat + duration)), 25);
  assert.deepEqual(song.rhythm.restWindows, []);
});

test("historical candidate guard rejects a backing onset without a judged chord anchor", () => {
  const song = structuredClone(songs.get("xiao-xing-xing"));
  const event = structuredClone(song.practiceAccompaniment.events[0]);
  event.beat = 2;
  song.practiceAccompaniment.events.splice(1, 0, event);
  assert.throws(() => assertConservativeSupport(song), /judged non-melody anchor/);
});

test("historical candidate guard still rejects pitches absent from either original source layer", () => {
  const song = historicalBirthday();
  song.practiceAccompaniment.events[1].notes[1].name = "F4";
  assert.throws(() => assertConservativeSupport(song), /judged non-melody anchor/);
  song.practiceAccompaniment.events[1].notes[1].name = "E4";
  assert.throws(() => assertConservativeSupport(song), /original backing/);
});

test("source-reviewed guard rejects a non-chord tone at every one of the nine anchors", () => {
  for (const event of songs.get("birthday").practiceAccompaniment.events) {
    const song = structuredClone(songs.get("birthday"));
    song.practiceAccompaniment.events.find(candidate => candidate.beat === event.beat).notes[1].name = "A3";
    // A is in F, so use D at beat 16 instead.
    if (event.beat === 16) song.practiceAccompaniment.events.find(candidate => candidate.beat === 16).notes[1].name = "D4";
    assert.throws(() => assertBirthdaySourceSupport(song), /must belong to .* chord/);
  }
});

test("source-reviewed guard rejects all three old harmonic conflicts and a wrong slash-chord bass", () => {
  for (const beat of correctedBeats) {
    const song = structuredClone(songs.get("birthday"));
    song.practiceAccompaniment.events.find(event => event.beat === beat).notes =
      historicalBirthday().practiceAccompaniment.events.find(event => event.beat === beat).notes;
    assert.throws(() => assertBirthdaySourceSupport(song), /must belong to .* chord/);
  }
  const song = structuredClone(songs.get("birthday"));
  song.practiceAccompaniment.events.find(event => event.beat === 20).notes[0].name = "E4";
  assert.throws(() => assertBirthdaySourceSupport(song), /source C\/G must retain its G bass/);
});

for (const [label, makeSong, guard] of [
  ["historical", historicalBirthday, assertConservativeSupport],
  ["source-reviewed", () => structuredClone(songs.get("birthday")), assertBirthdaySourceSupport]
]) {
  test(`${label} candidate guard rejects a third note, active melody unison, or louder support`, () => {
    const dense = makeSong();
    dense.practiceAccompaniment.events[0].notes.push({ name: "E4", role: "harmony", velocity: 0.34 });
    assert.throws(() => guard(dense), /at most two/);
    const unison = makeSong();
    unison.events[0].notes.find(note => note.role === "melody").name = "C4";
    assert.throws(() => guard(unison), /active melody unison/);
    const loud = makeSong();
    loud.practiceAccompaniment.events[0].notes[0].velocity = 0.8;
    assert.throws(() => guard(loud), /quiet role-specific velocity/);
  });

  test(`${label} candidate guard rejects attacks in implicit gaps and overlaps with silent rests`, () => {
    const gap = makeSong();
    gap.events[0].notes = gap.events[0].notes.filter(note => note.role !== "melody");
    assert.throws(() => guard(gap), /bounded by melody rests\/end|no rest attacks/);
    const silent = makeSong();
    silent.rhythm.restWindows.push({ beat: 0.5, duration: 0.25, policy: "silent" });
    assert.throws(() => guard(silent), /bounded by melody rests\/end|no rest overlap/);
  });
}
