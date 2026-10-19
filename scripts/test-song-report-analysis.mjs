import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyzeSongTiming, summarizeRhythm, summarizeArrangement, inferMelodyGaps,
  mergeWrittenSpans, overlapsWrittenSpan } from "./song-report-analysis.mjs";
import { readReportSongs } from "./read-report-songs.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const songsDir = fileURLToPath(new URL("../data/songs/", import.meta.url));
const readSong = async id => JSON.parse(await readFile(join(songsDir, `${id}.json`), "utf8"));
const m = (beat, duration, name = "C4") => ({ beat, duration, notes: [{ name, role: "melody", judge: true }] });
const b = (beat, duration, name = "G3") => ({ beat, duration, notes: [{ name, role: "bass" }] });
const base = (events = [m(0, 1), m(3, 1)]) => ({ id: "synthetic", title: "Synthetic", schemaVersion: 2,
  arrangementKind: "melody", judgementMode: "melody", events });
const support = events => ({ enabledByDefault: false, events });
const rest = (beat, duration, policy = "silent") => ({ beat, duration, policy });
const deepFreeze = object => { Object.freeze(object); for (const value of Object.values(object)) if (value && typeof value === "object") deepFreeze(value); return object; };

test("helpers and both summaries do not mutate frozen song objects", () => {
  const song = deepFreeze({ ...base(), practiceAccompaniment: support([b(0, 0.5)]) });
  const before = JSON.stringify(song);
  analyzeSongTiming(song); summarizeRhythm(song); summarizeArrangement(song);
  assert.equal(JSON.stringify(song), before);
});

test("initial, internal and declared-ending gaps include fractional durations", () => {
  const gaps = inferMelodyGaps([{ beat: 1 / 3, duration: 2 / 3 }, { beat: 2, duration: 1 }], 4);
  assert.deepEqual(gaps.map(({ beat, duration, position }) => [beat, duration, position]),
    [[0, 1 / 3, "initial"], [1, 1, "internal"], [3, 1, "declared-ending"]]);
});

test("nested written intervals cannot invent a gap after the shorter inner event", () => {
  assert.deepEqual(inferMelodyGaps([{ beat: 0, duration: 10 }, { beat: 1, duration: 1 }, { beat: 5, duration: 1 }]), []);
  assert.deepEqual(mergeWrittenSpans([{ beat: 0, duration: 1 }, { beat: 1, duration: 1 }]), [{ beat: 0, duration: 2 }]);
});

test("no declared end means no guessed final silence, even if support extends", () => {
  const a = analyzeSongTiming({ ...base([m(0, 1)]), practiceAccompaniment: support([b(0, 2)]) });
  assert.deepEqual(a.melodyGaps, []);
  assert.equal(a.declaredEnd, null);
});

test("written spans use half-open boundaries and stable triplet tolerance", () => {
  assert.equal(overlapsWrittenSpan({ beat: 0, duration: 1 }, { beat: 1, duration: 1 }), false);
  assert.equal(overlapsWrittenSpan({ beat: 0, duration: 1 + 5e-10 }, { beat: 1, duration: 1 }), false);
  assert.equal(overlapsWrittenSpan({ beat: 0, duration: 1.001 }, { beat: 1, duration: 1 }), true);
  assert.deepEqual(inferMelodyGaps([{ beat: 0, duration: 1 / 3 }, { beat: 1 / 3, duration: 2 / 3 }]), []);
});

test("both support layers are separate and inspect duration crossing into declared silence", () => {
  const song = { ...base(), rhythm: { sourceStatus: "verified", restWindows: [rest(1, 2)] },
    autoAccompaniment: support([b(0, 2)]), practiceAccompaniment: support([b(0.5, 1)]) };
  const result = summarizeRhythm(song);
  assert.equal(result.autoEvents, 1); assert.equal(result.practiceEvents, 1);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].autoEventCount, 1);
  assert.equal(result.conflicts[0].practiceEventCount, 1);
});

test("one rhythm annotation never hides a separate unannotated melody gap", () => {
  const song = { ...base([m(0, 1), m(2, 1), m(5, 1)]), rhythm: { sourceStatus: "inferred", restWindows: [rest(1, 1)] },
    practiceAccompaniment: support([b(3, 1)]) };
  const a = analyzeSongTiming(song);
  assert.equal(a.longGaps.length, 2);
  assert.deepEqual(a.unannotatedLongGaps, [{ beat: 3, duration: 2 }]);
  assert.equal(a.melodyGapSupportOverlaps.length, 1);
  assert.equal(a.declaredSilentConflicts.length, 0);
});

test("rest annotation coverage is geometric, not a misleading window-count comparison", () => {
  const song = { ...base(), rhythm: { sourceStatus: "inferred", restWindows: [rest(10, 1)] } };
  assert.deepEqual(analyzeSongTiming(song).unannotatedLongGaps, [{ beat: 1, duration: 2 }]);
  song.rhythm.restWindows = [rest(1, 1)];
  assert.deepEqual(analyzeSongTiming(song).unannotatedLongGaps, [{ beat: 2, duration: 1 }]);
  song.rhythm.restWindows = [rest(1, 1), rest(2, 1)];
  assert.deepEqual(analyzeSongTiming(song).unannotatedLongGaps, []);
});

test("explicit source harmony cannot fill the physical melody's gap", () => {
  const a = analyzeSongTiming(base([m(0, 1), b(1, 2), m(3, 1)]));
  assert.equal(a.melodyComplete, true);
  assert.deepEqual(a.longGaps.map(({ beat, duration }) => [beat, duration]), [[1, 2]]);
});

test("source extent is not an all-layer silence assertion", () => {
  const song = { ...base([m(0, 1)]), sourceFeatures: { sourceTotalBeats: 3 },
    practiceAccompaniment: support([b(0, 3)]) };
  const a = analyzeSongTiming(song);
  assert.equal(a.longGaps[0].position, "declared-ending");
  assert.equal(a.melodyGapSupportOverlaps.length, 1);
  assert.equal(a.allLayerSilenceConflicts.length, 0);
  assert.equal(a.beyondDeclaredEnd.length, 0);
});

test("explicit all-layer silence checks retained source harmony and both support layers", () => {
  const song = { ...base([m(0, 1), b(1, 1), m(3, 1)]),
    sourceFeatures: { sourceReview: { currentScopeReview: { silentWindows: [rest(1, 2)] } } },
    autoAccompaniment: support([b(0, 1.5)]), practiceAccompaniment: support([b(0.5, 1)]) };
  const conflict = analyzeSongTiming(song).allLayerSilenceConflicts[0];
  assert.equal(conflict.overlaps.sourceEvents.length, 1);
  assert.equal(conflict.overlaps.autoAccompaniment.length, 1);
  assert.equal(conflict.overlaps.practiceAccompaniment.length, 1);
});

test("source-authorized hold semantics are not replaced by inferred silence or label-only approval", () => {
  // A supplied score may authorize this hold. The report neither reads that
  // score nor claims the global verified label establishes this specific hold.
  const song = { ...base(), rhythm: { sourceStatus: "verified", restWindows: [rest(1, 2, "hold")] },
    practiceAccompaniment: support([b(0, 3)]) };
  const a = analyzeSongTiming(song);
  assert.equal(a.declaredSilentConflicts.length, 0);
  assert.equal(a.allLayerSilenceConflicts.length, 0);
  assert.equal(a.holdPolicies[0].sourceAuthorization, "not-established-by-report");
  assert.deepEqual(a.holdPolicies[0].layers.practiceAccompaniment.structuralViolations, []);
  assert.equal(a.melodyGapSupportOverlaps.length, 1);
});

test("hold restrictions are checked independently per optional layer", () => {
  const song = { ...base(), rhythm: { sourceStatus: "inferred", restWindows: [rest(1, 2, "hold")] },
    autoAccompaniment: support([b(1, 2)]), practiceAccompaniment: support([b(1, 0.5), b(2, 1)]) };
  const hold = analyzeSongTiming(song).holdPolicies[0];
  assert.deepEqual(hold.layers.autoAccompaniment.structuralViolations, []);
  assert.deepEqual(hold.layers.practiceAccompaniment.structuralViolations,
    ["more-than-one-event", "attack-after-rest-start-tolerance"]);
});

test("a hold policy contradicting explicit all-layer silence is reported even without support", () => {
  const song = { ...base(), rhythm: { sourceStatus: "verified", restWindows: [rest(1, 2, "hold")] },
    sourceFeatures: { sourceReview: { currentScopeReview: { silentWindows: [rest(1, 2)] } } } };
  assert.deepEqual(analyzeSongTiming(song).allLayerSilenceConflicts[0].contradictoryHoldPaths, ["rhythm.restWindows[0]"]);
});

test("sub-beat source silence and overlaps are never discarded by the long-gap threshold", () => {
  const song = { ...base([m(0, 0.5), m(0.75, 1)]), rhythm: { sourceStatus: "verified", restWindows: [rest(0.5, 0.25)] },
    practiceAccompaniment: support([b(0.4, 0.3)]) };
  const a = analyzeSongTiming(song);
  assert.equal(a.longGaps.length, 0);
  assert.equal(a.melodyGaps.length, 1);
  assert.equal(a.declaredSilentConflicts.length, 1);
});

test("malformed/ambiguous melody reports unknown gaps rather than choosing first/highest", () => {
  for (const notes of [
    [{ name: "C4", role: "melody", judge: true }, { name: "E4", role: "melody", judge: false }],
    [{ name: "C4", judge: true }], ["C4"], [{ name: "C4", role: "melody" }]
  ]) {
    const a = analyzeSongTiming(base([{ beat: 0, duration: 1, notes }]));
    assert.equal(a.melodyComplete, false); assert.equal(a.melodyGaps, null);
    assert.ok(a.issues.length);
  }
});

test("malformed numeric data is not silently coerced into successful coverage", () => {
  const song = { ...base([m("0", 1), m(3, 1)]),
    sourceFeatures: { sourceTotalBeats: "4" }, practiceAccompaniment: support([b(null, 1)]) };
  const a = analyzeSongTiming(song);
  assert.equal(a.melodyGaps, null);
  assert.equal(a.declaredEnd, null);
  assert.equal(a.support.practiceAccompaniment.events, 0);
  assert.equal(a.support.practiceAccompaniment.rawEvents, 1);
  assert.ok(a.issues.some(issue => issue.code === "invalid-support-event"));
});

test("all layers extending past declared extent are surfaced, never trimmed or hidden", () => {
  const song = { ...base([m(0, 3)]), sourceFeatures: { sourceTotalBeats: 2 },
    autoAccompaniment: support([b(0, 4)]), practiceAccompaniment: support([b(0, 5)]) };
  const a = analyzeSongTiming(song);
  assert.deepEqual(new Set(a.beyondDeclaredEnd.map(value => value.layer)),
    new Set(["melody", "sourceEvents", "autoAccompaniment", "practiceAccompaniment"]));
  assert.equal(song.practiceAccompaniment.events[0].duration, 5);
});

test("single-melody records never receive fewMulti; dense legacy chord warning remains", () => {
  assert.ok(!summarizeArrangement(base()).risk.includes("fewMulti"));
  const song = base([m(0, 1)]); song.arrangementKind = "chord"; song.judgementMode = "chord";
  song.events[0].notes.push({ name: "E4", role: "harmony", judge: true });
  assert.ok(summarizeArrangement(song).risk.includes("manyMulti"));
  song.arrangementKind = "melody"; song.judgementMode = "melody";
  assert.ok(summarizeArrangement(song).risk.includes("multiJudgeMelody=1"));
});

test("source and practice review metadata remain separate despite verified rhythm", async () => {
  const song = await readSong("xiao-xing-xing-chord");
  const a = analyzeSongTiming(song);
  assert.equal(song.rhythm.sourceStatus, "verified");
  assert.equal(a.support.practiceAccompaniment.review.declared.status, "needs-review");
  assert.equal(a.support.practiceAccompaniment.review.declared.independentlyVerified, false);
  assert.deepEqual(a.support.practiceAccompaniment.review.declared.unresolvedConflictBeats, [20, 28, 30]);
  assert.equal(a.support.autoAccompaniment.review.metadataPath, "sourceFeatures.autoAccompaniment");
});

test("See You's 24 support attacks and 48 written beats are visible without claiming musical approval", async () => {
  const song = await readSong("see-you-again-reviewed-support");
  const row = summarizeArrangement(song);
  const a = analyzeSongTiming(song);
  assert.equal(row.events, 86); assert.equal(row.autoEvents, 0);
  assert.equal(row.practiceEvents, 24); assert.equal(row.practiceDensity, 0.5);
  assert.equal(row.practiceWrittenCoverage, 1); assert.ok(!row.risk.includes("fewMulti"));
  assert.equal(a.support.practiceAccompaniment.writtenBeats, 48);
  assert.equal(a.support.practiceAccompaniment.review.declared.browserAudio, "not-performed-in-data-stage");
  assert.equal(a.support.practiceAccompaniment.review.assessment, "not-assessed-by-report");
});

test("Mixue omitted rolled-chord gap is not called a written source rest", async () => {
  const a = analyzeSongTiming(await readSong("mi-xue-bing-cheng-theme"));
  const gap = a.melodyGaps.find(gap => gap.beat === 9);
  assert.equal(gap.duration, 1);
  assert.ok(gap.declarations.some(declaration => declaration.meaning === "omitted-source-gesture"));
  assert.ok(gap.declarations.some(declaration => declaration.meaning === "declared-adaptation-gap"));
  assert.ok(!gap.declarations.some(declaration => declaration.meaning === "declared-all-layer-silence"));
  assert.equal(a.claims.allLayerSilent[0].beat, 0);
});

test("Rain's omitted out-of-scope interlude cannot invent four beats of final silence", async () => {
  const a = analyzeSongTiming(await readSong("da-yu-xiao-yu"));
  assert.equal(a.declaredEnd, 44);
  assert.equal(a.claims.omittedGestures[0].declaration.outsideSelectedScope, true);
  assert.ok(!a.melodyGaps.some(gap => gap.position === "declared-ending"));
});

test("Yun Yan final melody-only rest and Jasmine declared final silence remain distinct", async () => {
  const yun = analyzeSongTiming(await readSong("yun-yan-cheng-yu"));
  const jasmine = analyzeSongTiming(await readSong("jasmine"));
  const tail = yun.melodyGaps.find(gap => gap.beat === 120);
  assert.equal(tail.duration, 4);
  assert.ok(tail.declarations.some(declaration => declaration.meaning === "declared-melody-only-rest"));
  assert.ok(!tail.declarations.some(declaration => declaration.meaning === "declared-all-layer-silence"));
  const ending = jasmine.melodyGaps.find(gap => gap.beat === 55);
  assert.equal(ending.duration, 1);
  assert.ok(ending.declarations.some(declaration => declaration.meaning === "declared-all-layer-silence"));
});

test("historical metadata is not recursively promoted into current source claims", () => {
  const song = { ...base(), sourceFeatures: { practiceAccompaniment: { historicalCandidates: [
    { rests: { allLayerSilentWindows: [rest(0, 4)] }, status: "verified" }
  ] } } };
  assert.deepEqual(analyzeSongTiming(song).claims.allLayerSilent, []);
});

test("no support provenance remains unspecified, never approved", () => {
  const song = { ...base(), rhythm: { sourceStatus: "verified", restWindows: [] }, practiceAccompaniment: support([b(0, 0.5)]) };
  const row = summarizeArrangement(song);
  assert.equal(row.practiceSourceStatus, "unspecified");
  assert.ok(row.risk.includes("practiceReview=unspecified"));
  assert.equal(analyzeSongTiming(song).support.practiceAccompaniment.review.assessment, "not-assessed-by-report");
});

test("the proposed CLI keeps rhythm JSON array and arrangement V2 table formats", async () => {
  const dir = await mkdtemp(join(tmpdir(), "support-report-test-"));
  try {
    await writeFile(join(dir, "v2.json"), JSON.stringify({ ...base(), practiceAccompaniment: support([b(0, 0.5)]) }));
    await writeFile(join(dir, "v1.json"), JSON.stringify({ id: "v1-only", schemaVersion: 1, steps: [["C4", 0, 1]] }));
    const rhythm = spawnSync(process.execPath, [join(root, "scripts/report-rhythm-gaps.mjs"), "--songs-dir", dir], { encoding: "utf8" });
    assert.equal(rhythm.status, 0, rhythm.stderr);
    const rows = JSON.parse(rhythm.stdout);
    assert.equal(rows.length, 2); assert.equal(rows.find(row => row.id === "synthetic").practiceEvents, 1);
    const arrangement = spawnSync(process.execPath, [join(root, "scripts/report-arrangement-quality.mjs"), "--songs-dir", dir], { encoding: "utf8" });
    assert.equal(arrangement.status, 0, arrangement.stderr);
    assert.match(arrangement.stdout, /practiceEvents/); assert.doesNotMatch(arrangement.stdout, /v1-only/);
    const bad = spawnSync(process.execPath, [join(root, "scripts/report-rhythm-gaps.mjs"), "--wrong"], { encoding: "utf8" });
    assert.notEqual(bad.status, 0); assert.match(bad.stderr, /Usage/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("alternative support layers do not combine to create a false two-event hold violation", () => {
  const song = { ...base(), rhythm: { sourceStatus: "verified", restWindows: [rest(1, 2, "hold")] },
    autoAccompaniment: support([b(0, 3)]), practiceAccompaniment: support([b(0, 3)]) };
  const hold = analyzeSongTiming(song).holdPolicies[0];
  assert.deepEqual(hold.layers.autoAccompaniment.structuralViolations, []);
  assert.deepEqual(hold.layers.practiceAccompaniment.structuralViolations, []);
});

test("an empty explicit silence list does not declare the entire review span silent", () => {
  const song = { ...base(), practiceAccompaniment: support([b(1, 1)]),
    sourceFeatures: { practiceAccompaniment: { reviewedBeatRanges: [[0, 4]], rests: { allLayerSilentWindows: [] } } } };
  const a = analyzeSongTiming(song);
  assert.deepEqual(a.claims.allLayerSilent, []);
  assert.deepEqual(a.allLayerSilenceConflicts, []);
  assert.equal(a.melodyGapSupportOverlaps.length, 1);
});

test("unknown rhythm policies remain unknown instead of becoming a silence declaration", () => {
  const song = { ...base(), rhythm: { sourceStatus: "verified", restWindows: [rest(1, 2, "guess")] } };
  const a = analyzeSongTiming(song);
  assert.ok(a.issues.some(issue => issue.code === "invalid-rest-policy"));
  assert.equal(a.melodyGaps[0].declarations[0].meaning, "unknown-support-policy");
  assert.deepEqual(a.declaredSilentConflicts, []);
});

test("58 current records keep 403 auto events and expose 98 optional practice events", async () => {
  const songs = await Promise.all((await readdir(songsDir)).filter(file => file.endsWith(".json"))
    .map(async file => JSON.parse(await readFile(join(songsDir, file), "utf8"))));
  const rows = songs.map(summarizeRhythm);
  assert.equal(rows.length, 58);
  assert.equal(rows.reduce((sum, row) => sum + row.autoEvents, 0), 403);
  assert.equal(rows.reduce((sum, row) => sum + row.practiceEvents, 0), 98);
  assert.equal(rows.reduce((sum, row) => sum + row.conflicts.length, 0), 0);
  assert.equal(rows.reduce((sum, row) => sum + row.analysis.issues.length, 0), 0);
});

test("density warning threshold uses raw ratio rather than rounded display precision", () => {
  const song = { ...base([m(0, 99.5)]), autoAccompaniment: support(Array.from({ length: 85 }, (_, index) => b(index, 0.25))) };
  const row = summarizeArrangement(song);
  assert.equal(row.autoDensity, 0.85);
  assert.ok(row.risk.includes("denseAuto=0.85"));
});

test("Farewell's scoped sourceConfirmedRestWindows annotate melody only, not unseen harmony", async () => {
  const a = analyzeSongTiming(JSON.parse(await readFile(new URL("../data/archives/song-bie-v2.4.28.json", import.meta.url), "utf8")));
  const gap = a.melodyGaps.find(gap => gap.beat === 30);
  assert.ok(gap.declarations.some(declaration => declaration.path ===
    "sourceFeatures.sourceReview.currentScopeReview.sourceConfirmedRestWindows[0]"
    && declaration.meaning === "declared-melody-only-rest"));
  assert.ok(!a.unannotatedLongGaps.some(gap => gap.beat === 30));
  assert.ok(!gap.declarations.some(declaration => declaration.meaning === "declared-all-layer-silence"));
  assert.equal(a.declaredEnd, null);
});

test("declared final extent intentionally changes density denominator but grants no approval", () => {
  const song = { ...base([m(0, 1)]), sourceFeatures: { sourceTotalBeats: 2 }, autoAccompaniment: support([b(0, 1)]) };
  const row = summarizeArrangement(song);
  assert.equal(row.autoDensity, 0.5); // Original report used source end 1, yielding 1.
  assert.ok(!row.risk.includes("denseAuto"));
  assert.equal(row.assessment, "descriptive-only-not-approval");
  assert.equal(analyzeSongTiming(song).claims.allLayerSilent.length, 0);
});

test("optional arrangement fields use the validator's effective judgement defaults", () => {
  const song = base([m(0, 1)]);
  song.events[0].notes.push({ name: "E4", role: "harmony", judge: true });
  delete song.arrangementKind; delete song.judgementMode;
  assert.ok(summarizeArrangement(song).risk.includes("multiJudgeMelody=1"));
  song.judgementMode = "chord";
  assert.ok(summarizeArrangement(song).risk.includes("manyMulti"));
  assert.ok(!summarizeArrangement(song).risk.includes("multiJudgeMelody"));
  delete song.judgementMode; song.arrangementKind = "chord";
  assert.ok(summarizeArrangement(song).risk.includes("manyMulti"));
});

test("declared lower-voice rests review only the explicitly mapped practice layer", () => {
  const song = { ...base([m(0, 4)]), autoAccompaniment: support([b(0, 4)]),
    practiceAccompaniment: support([b(0.5, 1), b(2, 1)]),
    sourceFeatures: { practiceAccompaniment: { sourceVoice: "literal-bass-clef-lower-voice",
      rests: { sourceLowerVoiceRestWindows: [{ beat: 1, duration: 1 }] } } } };
  const a = analyzeSongTiming(deepFreeze(song));
  const path = "sourceFeatures.practiceAccompaniment.rests.sourceLowerVoiceRestWindows[0]";
  assert.equal(a.claims.sourceLowerVoice[0].path, path);
  assert.deepEqual(a.claims.sourceLowerVoice[0].declaration, { beat: 1, duration: 1 });
  assert.equal(a.sourceLowerVoiceRestReview.practiceApplicability, "declared-literal-lower-voice");
  const review = a.sourceLowerVoiceRestReview.overlaps[0];
  assert.equal(review.path, path);
  assert.deepEqual(Object.keys(review.overlaps), ["practiceAccompaniment"]);
  assert.deepEqual(review.overlaps.practiceAccompaniment.map(event => event.path), ["practiceAccompaniment.events[0]"]);
  assert.equal(review.overlaps.practiceAccompaniment[0].beat, 0.5); // Earlier attack crosses the rest.
  assert.equal(a.sourceLowerVoiceRestReview.assessment, "review-only-not-source-approval");
  assert.deepEqual(a.claims.allLayerSilent, []);
  assert.deepEqual(a.claims.melodyOnly, []);
  assert.deepEqual(a.allLayerSilenceConflicts, []);
  assert.deepEqual(summarizeRhythm(song).conflicts, []);
});

test("unmapped lower-voice rest declarations do not silently constrain either backing layer", () => {
  const song = { ...base(), autoAccompaniment: support([b(0, 4)]), practiceAccompaniment: support([b(0, 4)]),
    sourceFeatures: { practiceAccompaniment: { rests: { sourceLowerVoiceRestWindows: [{ beat: 1, duration: 2 }] } } } };
  for (const sourceVoice of [undefined, "unreviewed-adapted-voices"]) {
    song.sourceFeatures.practiceAccompaniment.sourceVoice = sourceVoice;
    const a = analyzeSongTiming(song);
    assert.equal(a.claims.sourceLowerVoice.length, 1);
    assert.equal(a.sourceLowerVoiceRestReview.practiceApplicability, "not-established");
    assert.equal(a.sourceLowerVoiceRestReview.overlaps, null);
    assert.deepEqual(a.unannotatedLongGaps, [{ beat: 1, duration: 2 }]);
    assert.deepEqual(a.allLayerSilenceConflicts, []);
    assert.deepEqual(summarizeRhythm(song).conflicts, []);
  }
});

test("actual See You empty lower-voice rests stay empty and historical claims stay excluded", async () => {
  const song = await readSong("see-you-again-reviewed-support");
  song.sourceFeatures.practiceAccompaniment.historicalCandidates = [
    { rests: { sourceLowerVoiceRestWindows: [{ beat: 0, duration: 48 }] } }
  ];
  const a = analyzeSongTiming(song);
  assert.deepEqual(a.claims.sourceLowerVoice, []);
  assert.deepEqual(a.sourceLowerVoiceRestReview.overlaps, []);
  assert.equal(a.sourceLowerVoiceRestReview.assessment, "review-only-not-source-approval");
});

test("report loader preserves literal special filenames and ignores non-file/non-json entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "support-report-#%-"));
  // '?' is a legal filename on POSIX, but Windows disallows it.
  const names = ["plain.json", "sharp#name.json", "percent%name.json", "encoded%23name.json", "encoded%2Fname.json",
    ...(process.platform === "win32" ? [] : ["query?name.json"])];
  try {
    for (const [index, name] of names.entries()) {
      await writeFile(join(dir, name), JSON.stringify({ id: `literal-${index}`, schemaVersion: 1, steps: [["C4", 0, 1]] }));
    }
    await mkdir(join(dir, "directory.json"));
    await writeFile(join(dir, "ignored.txt"), "Not JSON");
    const expected = names.map((_, index) => `literal-${index}`).sort();
    const rows = await readReportSongs(["--songs-dir", dir]);
    assert.deepEqual(rows.map(row => row.id).sort(), expected);
    const cli = spawnSync(process.execPath, [join(root, "scripts/report-rhythm-gaps.mjs"), "--songs-dir", dir], { encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout).map(row => row.id).sort(), expected);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test("Farewell selected single-voice teaching edition declares six source rests including its ending",async()=>{
 const a=analyzeSongTiming(await readSong("song-bie"));
 assert.equal(a.declaredEnd,96);
 for(const beat of [14,30,46,62,78,94]){
  const gap=a.melodyGaps.find(g=>g.beat===beat);assert.ok(gap);assert.equal(gap.duration,2);
  assert.ok(gap.declarations.some(d=>d.meaning==="declared-all-layer-silence"));
  assert.ok(!a.unannotatedLongGaps.some(g=>g.beat===beat));
 }
 assert.deepEqual(a.issues,[]);
});
