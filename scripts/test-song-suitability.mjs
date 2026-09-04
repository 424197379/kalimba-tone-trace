import assert from "node:assert/strict";
import { inspectSuitability } from "./report-song-suitability.mjs";
import { readSongFiles } from "./build-song-library.mjs";

const song = (steps, extra = {}) => ({ id: "test", title: "Test", schemaVersion: 1, bpm: 90, steps, ...extra });
const review = { suitability: { status: "conditional", scope: "theme", reviewRequired: ["Physical play-through pending."] } };
const sustained = inspectSuitability(song([["C4", 0, 4], ["E4", 4, 4]], { sourceFeatures: review }));
assert.equal(sustained.longNotes, 2);
assert.equal(sustained.recordedDecision, "conditional");
assert.equal(sustained.signals.length, 1);
assert.deepEqual(sustained.gaps, []);
assert.equal(inspectSuitability(song([["C4", 0, 1]])).recordedDecision, "needs-review");
assert.deepEqual(inspectSuitability(song([["F#4", 0, 1], ["E3", 1, 1]])).unsupported, ["F#4", "E3"]);
assert.deepEqual(inspectSuitability(song([["C4", 2, 1], ["D4", 4, 1]])).gaps, [
  { beat: 0, duration: 2 }, { beat: 3, duration: 1 }
]);
const chord = inspectSuitability({ schemaVersion: 2, bpm: 90, events: [
  { beat: 0, duration: 4, notes: [{ name: "C5", role: "melody" }, { name: "G3", role: "bass" }] }
] });
assert.equal(chord.melodyNotes, 1);
assert.equal(chord.range, "C5-C5");
assert.equal(chord.maxLeapSemitones, 0);
assert.equal(inspectSuitability(song([["C4", 0, 1], ["D4", 0.5, 1]])).signals.some((s) => s.includes("overlapping")), true);
assert.equal(inspectSuitability(song(Array.from({ length: 8 }, (_, i) => ["C4", i * 0.75, 0.75]))).signals.some((s) => s.includes("0.75")), true);

const files = await readSongFiles();
const ids = new Set(files.map(({ song: data }) => data.id));
// These withdrawn transcriptions need source-backed recompilation before reinstatement.
for (const id of ["chilege", "an-he-qiao", "cang-hai-yi-sheng-xiao", "hai-kuo-tian-kong", "ke-neng-fou", "na-xie-hua-er", "ye-qu", "yin-wei-ai-qing", "zhi-duan-qing-chang"]) {
  assert.ok(!ids.has(id) && !ids.has(`${id}-chord`), `Unreviewed arrangement returned: ${id}`);
}
for (const id of ["bie-kan-wo-zhi-shi-yi-zhi-yang", "rang-wo-men-dang-qi-shuang-jiang"]) {
  const entry = files.find(({ song: data }) => data.id === id).song;
  const result = inspectSuitability(entry);
  assert.equal(result.recordedDecision, "conditional");
  assert.equal(result.scope, entry.sourceFeatures.transcriptionScope);
  assert.equal(result.unsupported.length, 0);
  assert.ok(result.signals.length > 0, "Do not erase disclosed arrangement limitations.");
}
console.log("Suitability checks passed: evidence states, long notes, range, gaps, V2 melody isolation and library withdrawals.");
