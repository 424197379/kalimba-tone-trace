import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getSongReviewNotice, getSongLibrary, parseImportedSongs, hasMatchingPracticeMelody, getSongAccompanimentProvider } from "../src/song-store.js";
import { DISPLAY_KEYS } from "./build-song-library.mjs";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
globalThis.localStorage = { getItem: () => null };
const archiveBytes = await readFile(new URL("../data/archives/tian-kong-zhi-cheng-v2.4.52.json", import.meta.url));
const song = JSON.parse(archiveBytes);
const selected = JSON.parse(await readFile(new URL("../data/songs/tian-kong-zhi-cheng.json", import.meta.url), "utf8"));

test("MV excerpt keeps printed tempo, source rests, tied attack and final cadence", () => {
  assert.equal(selected.bpm, 88);
  assert.equal(selected.defaultSpeedFactor, 1);
  assert.equal(selected.steps.length, 98);
  assert.equal(selected.sourceFeatures.sourceTotalBeats, 120);
  assert.ok(Math.abs(120 * 60 / selected.bpm - 81.818181818) < 1e-6);
  assert.deepEqual(selected.steps.slice(0, 2), [["A4",3,.5],["B4",3.5,.5]]);
  const phrase = (start,end) => selected.steps.filter(([,b]) => b>=start && b<end);
  assert.deepEqual(phrase(24,29), [["E4",24,1],["A4",27,.5],["B4",27.5,.5],["C5",28,1.5]]);
  assert.deepEqual(phrase(44,56), [["F4",44,1],["C5",45,.5],["B4",45.5,1.5],["C5",47,1],["D5",48,1],["E5",49,.5],["C5",49.5,2.5],["A4",52,3],["C5",55,.5],["D5",55.5,.5]]);
  assert.deepEqual(phrase(112,120), [["D5",112,1],["C5",113,.5],["D5",113.5,1.5],["B4",115,1],["A4",116,4]]);
  for (const [start,end] of [[0,3],[17,19],[25,27]]) assert.ok(selected.steps.every(([,b,d])=>b>=end||b+d<=start));
  const allowed=new Set(DISPLAY_KEYS.map(k=>k.name));
  assert.ok(selected.steps.every(([n])=>allowed.has(n)));
  assert.deepEqual(selected.sourceFeatures.excludedAlteredMeasures,[8,16]);
  assert.equal(selected.sourceFeatures.suitability.status,"conditional");
});

test("historical data restores independently and incompatible backing is excluded", () => {
  assert.equal(createHash("sha256").update(archiveBytes).digest("hex"),"87cec5397ef34eb01264939c1e15d3e2f2649ec28c678566a59968a9d783b1a6");
  const library=getSongLibrary(), before=JSON.stringify(library);
  const [restored]=parseImportedSongs(archiveBytes.toString(),library);
  assert.notEqual(restored.id,selected.id);
  assert.equal(restored.source,"local");
  assert.deepEqual(restored.steps,song.steps);
  assert.deepEqual(restored.sourceFeatures,song.sourceFeatures);
  assert.equal(JSON.stringify(library),before);
  const [imported]=parseImportedSongs(JSON.stringify(selected),library);
  assert.equal(getPracticeTotalBeats(imported.events,imported),120);
  const sibling=library["tian-kong-zhi-cheng-chord"];
  assert.equal(hasMatchingPracticeMelody(imported,sibling),false);
  assert.equal(getSongAccompanimentProvider(imported,[sibling]),null);
});
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
