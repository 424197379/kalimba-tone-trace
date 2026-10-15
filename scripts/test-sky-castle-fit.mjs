import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getSongReviewNotice } from "../src/song-store.js";
const song = JSON.parse(await readFile(new URL("../data/songs/tian-kong-zhi-cheng.json", import.meta.url), "utf8"));
test("The altered Sky Castle source is disclosed without rewriting its 79 notes", () => {
  assert.equal(song.steps.length, 79);
  assert.equal(createHash("sha256").update(JSON.stringify(song.steps)).digest("hex"), "f3c61981e459dc048de5dbb7152a2a96dc3e5e4613998b22d5df05b9c5ed06c8");
  assert.match(song.title, /改音版/);
  assert.match(getSongReviewNotice(song), /不作为原旋律保真练习/);
  assert.equal(song.sourceFeatures.suitability.status, "not-recommended");
  assert.match(song.sourceFeatures.sourceReview.confidence, /needs-review/);
  assert.equal(song.sourceFeatures.sourceReview.previousConfidence, "high-for-melody-medium-for-harmony");
});
test("The independently inspected nine-class theme has no global natural-note transposition", () => {
  const natural = new Set([0, 2, 4, 5, 7, 9, 11]);
  const inspectedTheme = [0, 2, 4, 5, 6, 7, 8, 9, 11];
  for (let shift = 0; shift < 12; shift += 1) {
    assert.equal(inspectedTheme.every(pitch => natural.has((pitch + shift) % 12)), false);
  }
  // This does not substitute the independent textbook's rhythm for the old arrangement.
  assert.deepEqual(song.steps[22], ["F4", 29.5, .5]);
  assert.deepEqual(song.steps[52], ["G4", 63, 1]);
});
