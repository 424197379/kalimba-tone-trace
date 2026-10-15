import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { DISPLAY_KEYS } from "./build-song-library.mjs";

// Execute the production validator unchanged except imports/CLI entry, without
// touching the built-in corpus or introducing a test-only timing validator.
const url = new URL("./validate-songs.mjs", import.meta.url);
const source = (await readFile(url, "utf8"))
  .replace(/^import .*;\n/gm, "")
  .replaceAll("import.meta.url", JSON.stringify(url.href))
  .replace(/await main\(\);\s*$/, "");
const context = { DISPLAY_KEYS, URL };
runInNewContext(source, context);
const fixture = (pickupBeats = 1 / 3) => ({
  schemaVersion: 2, id: "fractional-fixture", title: "Timing fixture", uploader: "test",
  practiceTitle: "Fixture", scoreTitle: "Fixture", hint: "Structural fixture, not source approval",
  difficulty: "easy", bpm: 90, defaultSpeedFactor: 0.55, beatsPerMeasure: 4,
  key: "C", tuning: "21-key-c", arrangementKind: "melody", judgementMode: "melody",
  events: [0, 1 / 3, 2 / 3].map(beat => ({ beat, duration: 1 / 3,
    notes: [{ name: "C4", role: "melody", judge: true }] })),
  rhythm: { sourceStatus: "needs-review", pickupBeats, restWindows: [] }
});
const validate = song => {
  const errors = [], warnings = [];
  context.validateSongFile({ song, fileName: "fractional-fixture.json", filePath: "fixture",
    idFromFile: "fractional-fixture", duplicateIdCount: 1 }, errors, warnings, new Map());
  return { errors, warnings };
};

test("source-confirmed fractional pickups and tuplet timings are structurally legal", () => {
  const song = fixture();
  const before = JSON.stringify(song);
  const { errors, warnings } = validate(song);
  assert.deepEqual(errors, []);
  assert.equal(JSON.stringify(song), before, "validation must not rewrite timing");
  const grid = warnings.filter(message => message.includes("not a multiple"));
  assert.ok(grid.length > 0);
  assert.ok(grid.every(message => message.includes("do not quantize")));
});

test("fractional pickup acceptance does not accept invalid numbers", () => {
  for (const pickup of [-1, null, "0.333", NaN, Infinity]) {
    assert.ok(validate(fixture(pickup)).errors.some(message => message.includes("pickupBeats")));
  }
});

test("short source notes remain legal density notices without a quantization instruction", () => {
  const song = fixture(0);
  song.events = [{ beat: 0, duration: 0.125, notes: [{ name: "C4", role: "melody", judge: true }] }];
  const { errors, warnings } = validate(song);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some(message => message.includes("practice-density notice only, preserve source timing")));
});
