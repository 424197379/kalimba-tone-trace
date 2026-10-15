import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { DISPLAY_KEYS } from "./build-song-library.mjs";

// Exercise the production, monolithic validator without running its corpus CLI.
// No source score or private support candidate is copied into these fixtures.
const url = new URL("./validate-songs.mjs", import.meta.url);
const source = (await readFile(url, "utf8"))
  .replace(/^import .*;\n/gm, "")
  .replaceAll("import.meta.url", JSON.stringify(url.href))
  .replace(/await main\(\);\s*$/, "");
const context = { DISPLAY_KEYS, URL };
runInNewContext(source, context);

const main = (beat = 0, duration = 1, judge = true) => ({ beat, duration,
  notes: [{ name: "C4", role: judge ? "melody" : "harmony", judge }] });
const backing = (beat = 0, duration = 1) => ({ enabledByDefault: false, volume: 0.25,
  events: [{ beat, duration, notes: [{ name: "G3", role: "bass", velocity: 0.3 }] }] });
const rest = (beat = 1, duration = 1, policy = "silent") => ({ beat, duration, policy });
const rhythm = (restWindows = [], pickupBeats = 0) => ({ sourceStatus: "needs-review", pickupBeats, restWindows });
const fixture = (schemaVersion = 2) => ({
  schemaVersion, id: "source-extent-fixture", title: "Source extent fixture", uploader: "test",
  practiceTitle: "Fixture", scoreTitle: "Fixture", hint: "Structural fixture, not source approval",
  difficulty: "easy", bpm: 90, defaultSpeedFactor: 0.55, beatsPerMeasure: 4,
  arrangementKind: "melody", judgementMode: "melody",
  ...(schemaVersion === 1 ? { steps: [["C4", 0, 1]] } : { events: [main()] }),
  sourceFeatures: { sourceTotalBeats: 2 }
});
const declaredErrors = result => result.errors.filter(error => error.includes("sourceFeatures.sourceTotalBeats"));
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function validate(song) {
  const before = structuredClone(song);
  freeze(song);
  const errors = [], warnings = [];
  const stepCount = context.validateSongFile({ song, fileName: `${song.id}.json`,
    filePath: "fixture", idFromFile: song.id, duplicateIdCount: 1 }, errors, warnings, new Map());
  assert.deepEqual(song, before, "validation must not rewrite source timing, notes or metadata");
  return { errors, warnings, stepCount };
}

test("V1 and V2 allow an evidenced source ending beyond the final note", () => {
  for (const version of [1, 2]) {
    const song = fixture(version);
    if (version === 2) song.rhythm = rhythm([rest()]);
    const result = validate(song);
    assert.deepEqual(result.errors, []);
    // Keep the historical note-end/bar warning; a source claim is not a rewrite.
    assert.ok(result.warnings.some(error => error.includes("total length 1 beats does not align")));
  }
});

test("all present invalid source declarations are errors without coercion", () => {
  for (const version of [1, 2]) {
    for (const value of [undefined, null, "2", "", true, false, -1, NaN, Infinity, -Infinity, {}, []]) {
      const song = fixture(version);
      song.sourceFeatures.sourceTotalBeats = value;
      assert.ok(declaredErrors(validate(song)).some(error => error.includes("finite number >= 0")), `${version}: ${String(value)}`);
    }
  }
});

test("zero is a valid numeric declaration but cannot bypass written-content bounds", () => {
  for (const version of [1, 2]) {
    const song = fixture(version);
    song.sourceFeatures.sourceTotalBeats = 0;
    const errors = declaredErrors(validate(song));
    assert.ok(errors.some(error => error.includes("declared length 0 is shorter")));
    assert.ok(!errors.some(error => error.includes("must be a finite number")));
  }
  const song = fixture();
  song.sourceFeatures.sourceTotalBeats = 0;
  song.events = [];
  song.rhythm = rhythm([], 0);
  assert.deepEqual(declaredErrors(validate(song)), [], "an empty song is separately invalid, not an invalid zero declaration");
});

test("declared extent covers V1 melody and every V2 main event including unjudged harmony", () => {
  const v1 = fixture(1);
  v1.steps = [["C4", 0, 1], ["D4", 2, 1]];
  assert.ok(declaredErrors(validate(v1)).some(error => error.includes("steps[1] ending at beat 3")));
  const v2 = fixture();
  v2.events.push(main(2, 1, false));
  assert.ok(declaredErrors(validate(v2)).some(error => error.includes("events[1] ending at beat 3")));
});

test("both backing alternatives, rest windows and pickup independently obey the declaration", () => {
  const cases = [
    ["autoAccompaniment.events[0]", song => { song.autoAccompaniment = backing(2, 1); }],
    ["practiceAccompaniment.events[0]", song => { song.practiceAccompaniment = backing(2, 1); }],
    ["rhythm.restWindows[0]", song => { song.rhythm = rhythm([rest(2, 1)]); }],
    ["rhythm.pickupBeats", song => { song.rhythm = rhythm([], 3); }]
  ];
  for (const [path, change] of cases) {
    const song = fixture();
    change(song);
    assert.ok(declaredErrors(validate(song)).some(error => error.includes(`${path} ending at beat 3`)), path);
  }
  const song = fixture();
  song.autoAccompaniment = backing(0, 1.5);
  song.practiceAccompaniment = backing(1, 2);
  const errors = declaredErrors(validate(song));
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("practiceAccompaniment.events[0]"), "do not choose a backing layer to approve the extent");
});

test("declaration errors survive empty, missing and malformed main timing", () => {
  for (const version of [1, 2]) {
    const key = version === 1 ? "steps" : "events";
    for (const malformed of [undefined, null, [], {}, [null]]) {
      const song = fixture(version);
      song[key] = malformed;
      song.sourceFeatures.sourceTotalBeats = "2";
      assert.ok(declaredErrors(validate(song)).some(error => error.includes("finite number >= 0")));
    }
  }
  const song = fixture();
  song.events = null;
  song.practiceAccompaniment = backing(2, 1);
  assert.ok(declaredErrors(validate(song)).some(error => error.includes("practiceAccompaniment.events[0]")));
});

test("malformed notes and timing siblings cannot hide a short source declaration", () => {
  const v1 = fixture(1);
  v1.steps = [["invalid", 2, 1], ["C4", "not-a-beat", 1]];
  assert.ok(declaredErrors(validate(v1)).some(error => error.includes("steps[0] ending at beat 3")));
  const song = fixture();
  song.events = [{ ...main(2, 1), notes: [] }, main("not-a-beat", 1)];
  song.practiceAccompaniment = { events: [{ beat: 2, duration: 1, notes: [] }] };
  song.rhythm = rhythm([{ ...rest(2, 1), policy: "invalid" }], 3);
  const errors = declaredErrors(validate(song));
  for (const path of ["events[0]", "practiceAccompaniment.events[0]", "rhythm.restWindows[0]", "rhythm.pickupBeats"]) {
    assert.ok(errors.some(error => error.includes(`${path} ending at beat 3`)), path);
  }
});

test("fractional source endings, tuplets and pickups retain their exact values", () => {
  for (const version of [1, 2]) {
    const song = fixture(version);
    song.sourceFeatures.sourceTotalBeats = 2 / 3;
    if (version === 1) song.steps = [["C4", 0, 1 / 3]];
    else {
      song.events = [main(0, 1 / 3)];
      song.rhythm = rhythm([rest(1 / 3, 1 / 3)], 2 / 3);
    }
    assert.deepEqual(validate(song).errors, []);
    assert.equal(song.sourceFeatures.sourceTotalBeats, 2 / 3);
  }
});

test("the existing 1e-9 comparison tolerance applies without quantization or source repair", () => {
  for (const version of [1, 2]) {
    for (const excess of [0.5e-9, 2e-9]) {
      const song = fixture(version);
      song.sourceFeatures.sourceTotalBeats = 1;
      if (version === 1) song.steps[0][2] = 1 + excess;
      else song.events[0].duration = 1 + excess;
      assert.equal(declaredErrors(validate(song)).length > 0, excess > 1e-9);
    }
  }
  for (const excess of [0.5e-9, 2e-9]) {
    const song = fixture();
    song.rhythm = rhythm([rest(1, 1 + excess)], 2 + excess);
    song.autoAccompaniment = backing(0, 2 + excess);
    // No rest overlaps: compare source bounds in a separate fixture below.
    delete song.rhythm.restWindows;
    assert.equal(declaredErrors(validate(song)).length, excess > 1e-9 ? 2 : 0);
    const windowSong = fixture();
    windowSong.rhythm = rhythm([rest(1, 1 + excess)]);
    assert.equal(validate(windowSong).errors.length > 0, excess > 1e-9);
  }
});

test("finite input spans with overflowed endpoints fail in every supported timing layer", () => {
  for (const withDeclaration of [true, false]) {
    const v1 = fixture(1);
    v1.steps = [["C4", Number.MAX_VALUE, Number.MAX_VALUE]];
    if (withDeclaration) v1.sourceFeatures.sourceTotalBeats = Number.MAX_VALUE;
    else delete v1.sourceFeatures;
    assert.ok(validate(v1).errors.some(error => error.includes("steps[0]: beat + duration must be finite")));
    for (const layer of ["events", "autoAccompaniment", "practiceAccompaniment", "rhythm"]) {
      const song = fixture();
      if (withDeclaration) song.sourceFeatures.sourceTotalBeats = Number.MAX_VALUE;
      else delete song.sourceFeatures;
      if (layer === "events") song.events = [main(Number.MAX_VALUE, Number.MAX_VALUE)];
      else if (layer === "rhythm") song.rhythm = rhythm([rest(Number.MAX_VALUE, Number.MAX_VALUE)]);
      else song[layer] = backing(Number.MAX_VALUE, Number.MAX_VALUE);
      assert.ok(validate(song).errors.some(error => error.includes("beat + duration must be finite")), layer);
    }
  }
});

test("finite large endpoints are not rejected merely for being large", () => {
  const song = fixture();
  song.sourceFeatures.sourceTotalBeats = Number.MAX_VALUE;
  song.events = [main(0, Number.MAX_VALUE)];
  assert.deepEqual(validate(song).errors, []);
});

test("missing metadata keeps the legacy main-event fallback, never backing or bar rounding", () => {
  for (const metadata of [undefined, {}]) {
    const song = fixture();
    if (metadata === undefined) delete song.sourceFeatures;
    else song.sourceFeatures = metadata;
    song.autoAccompaniment = backing(0, 4);
    song.practiceAccompaniment = backing(0, 8);
    song.rhythm = rhythm([rest(1, 1)], 8);
    const errors = validate(song).errors;
    assert.ok(errors.some(error => error.includes("ends at beat 2 beyond song length 1")));
    assert.ok(!errors.some(error => error.includes("sourceFeatures.sourceTotalBeats")));
  }
  const song = fixture();
  delete song.sourceFeatures;
  song.events.push(main(4, 1, false));
  song.rhythm = rhythm([rest(1, 1)]);
  assert.deepEqual(validate(song).errors, [], "legacy fallback includes unjudged main events");
});

test("invalid declarations never fall back to an event maximum", () => {
  const song = fixture();
  song.sourceFeatures.sourceTotalBeats = null;
  song.rhythm = rhythm([rest(1, 1)]);
  const result = validate(song);
  assert.equal(declaredErrors(result).length, 1);
  assert.ok(!result.errors.some(error => error.includes("beyond song length 1")));
});

test("too-short declarations remain errors even when an event maximum would cover the rest", () => {
  const song = fixture();
  song.sourceFeatures.sourceTotalBeats = 1;
  song.events.push(main(3, 1, false));
  song.rhythm = rhythm([rest(1, 1)]);
  const errors = validate(song).errors;
  assert.ok(errors.some(error => error.includes("events[1] ending at beat 4")));
  assert.ok(errors.some(error => error.includes("ends at beat 2 beyond song length 1")));
});

test("valid ending rests do not relax silent, hold or rest-window overlap checks", () => {
  for (const field of ["autoAccompaniment", "practiceAccompaniment"]) {
    const silent = fixture();
    silent.rhythm = rhythm([rest()]);
    silent[field] = backing(0.5, 1);
    assert.ok(validate(silent).errors.some(error => error.includes(`silent rest window contains 1 ${field} event(s)`)));

    const held = fixture();
    held.rhythm = rhythm([rest(1, 1, "hold")]);
    held[field] = backing(0.5, 1.5);
    assert.deepEqual(validate(held).errors, []);

    const late = fixture();
    late.rhythm = rhythm([rest(1, 1, "hold")]);
    late[field] = backing(1.5, 0.5);
    assert.ok(validate(late).errors.some(error => error.includes("may only contain an event near the rest start")));

    const repeated = fixture();
    repeated.rhythm = rhythm([rest(1, 1, "hold")]);
    repeated[field] = backing(0.5, 1);
    repeated[field].events.push(backing(1, 1).events[0]);
    assert.ok(validate(repeated).errors.some(error => error.includes(`hold rest window contains 2 ${field} events`)));
  }
  const overlapping = fixture();
  overlapping.rhythm = rhythm([rest(1, 0.75), rest(1.5, 0.5)]);
  assert.ok(validate(overlapping).errors.some(error => error.includes("overlaps previous rest window")));
});

test("practice backing still uses the established schema with its own error path", () => {
  const song = fixture();
  song.practiceAccompaniment = backing(0, 1);
  song.practiceAccompaniment.events[0].notes[0].velocity = 4;
  const errors = validate(song).errors;
  assert.ok(errors.some(error => error.includes("practiceAccompaniment.events[0].notes[0].velocity")));
  assert.ok(!errors.some(error => error.includes("autoAccompaniment")));
});

test("source declarations do not enable V2 rhythm or auto backing fields on V1", () => {
  const song = fixture(1);
  song.autoAccompaniment = backing();
  song.rhythm = rhythm([rest()]);
  const errors = validate(song).errors;
  assert.ok(errors.some(error => error.includes("autoAccompaniment: is only supported by schemaVersion 2")));
  assert.ok(errors.some(error => error.includes("rhythm: is only supported by schemaVersion 2")));
});

test("V1 cannot silently retain unsupported practice backing, regardless of its value or extent", () => {
  for (const value of [undefined, null, {}, { events: [] }, backing(0, 1), backing(2, 1)]) {
    const song = fixture(1);
    song.practiceAccompaniment = value;
    assert.ok(validate(song).errors.some(error => error.includes("practiceAccompaniment: is only supported by schemaVersion 2")));
  }
  const metadata = fixture(1);
  metadata.sourceFeatures.practiceAccompaniment = { status: "needs-review", sourceTotalBeats: 99 };
  assert.deepEqual(validate(metadata).errors, [], "descriptive or historical metadata is not a playback layer");
});

test("real Daylily melody converts in memory with its 191–192 terminal rest intact", async () => {
  const raw = JSON.parse(await readFile(new URL("../data/songs/xuan-cao-hua.json", import.meta.url), "utf8"));
  assert.equal(raw.steps.length, 183);
  assert.equal(Math.max(...raw.steps.map(([, beat, duration]) => beat + duration)), 191);
  assert.equal(raw.sourceFeatures.sourceTotalBeats, 192);
  const song = { ...raw, schemaVersion: 2, arrangementKind: "melody", judgementMode: "melody",
    events: raw.steps.map(([name, beat, duration]) => ({ beat, duration,
      notes: [{ name, role: "melody", judge: true }] })),
    rhythm: rhythm([rest(191, 1)]) };
  delete song.steps;
  const result = validate(song);
  assert.deepEqual(result.errors, []);
  assert.equal(result.stepCount, 183);
  assert.deepEqual(song.events.map(event => [event.notes[0].name, event.beat, event.duration]), raw.steps);
  const missing = structuredClone(song);
  delete missing.sourceFeatures.sourceTotalBeats;
  assert.ok(validate(missing).errors.some(error => error.includes("ends at beat 192 beyond song length 191")));
  const beyond = structuredClone(song);
  beyond.rhythm.restWindows[0].duration = 1.25;
  assert.ok(declaredErrors(validate(beyond)).some(error => error.includes("rhythm.restWindows[0] ending at beat 192.25")));
});
