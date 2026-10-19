import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectSuitability as inspectCurrentSuitability } from "./report-song-suitability.mjs";
import { inspectSuitability as inspectLegacy } from "./fixtures/suitability-legacy-v2.4.29.mjs";
import { readSongFiles } from "./build-song-library.mjs";

const song = (steps = [["C4", 0, 4]], extra = {}) => ({
  id: "extent-fixture", title: "Extent fixture", schemaVersion: 1, bpm: 90, steps, ...extra
});
const melodyEvent = (beat, duration) => ({ beat, duration,
  notes: [{ name: "C4", role: "melody", judge: true }, { name: "G3", role: "bass", judge: false }] });
const bassEvent = (beat, duration) => ({ beat, duration, notes: [{ name: "G3", role: "bass" }] });
const v2 = (events = [melodyEvent(0, 4)], extra = {}) => ({
  id: "extent-v2", title: "V2 extent fixture", schemaVersion: 2, bpm: 90, events, ...extra
});
const source = sourceTotalBeats => ({ sourceFeatures: { sourceTotalBeats } });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const legacyProjection = (candidate, production) => Object.fromEntries(Object.keys(production).map(key => [key, candidate[key]]));
// Every synthetic and current-library inspection also checks the independent
// frozen v2.4.29 fields; the oracle must never import the migrated report.
function inspectSuitability(fixture) {
  const previous = inspectLegacy(fixture);
  const result = inspectCurrentSuitability(fixture);
  assert.deepEqual(legacyProjection(result, previous), previous, fixture.id);
  return result;
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("v2.4.29 compatibility oracle retains its frozen pure function", () => {
  assert.equal(createHash("sha256").update(inspectLegacy.toString()).digest("hex"),
    "ba85a36b95635b9d235a46cc889c5ce6f67f8ee20a16d00dd8954315074856aa");
});

for (const schemaVersion of [1, 2]) {
  for (const tail of [0.5, 1, 4]) {
    test(`V${schemaVersion}: exposes a ${tail}-beat tail without altering legacy fields`, () => {
      const fixture = schemaVersion === 1 ? song(undefined, source(4 + tail)) : v2(undefined, source(4 + tail));
      const result = inspectSuitability(freeze(fixture));
      assert.equal(result.totalBeats, 4);
      assert.equal(result.melodyEndBeat, 4);
      assert.equal(result.sourceEventEndBeat, 4);
      assert.equal(result.declaredSourceTotalBeats, 4 + tail);
      assert.equal(result.selectedSourceExtentBeats, 4 + tail);
      assert.equal(result.sourceExtentStatus, "covers-written-content");
      assert.equal(result.sourceExtentSelection, "declared-source-total");
      assert.deepEqual(result.sourceExtentIssues, []);
      assert.deepEqual(result.gaps, []);
      assert.deepEqual(result.endingMelodyGap, { beat: 4, duration: tail, position: "ending",
        meaning: "inferred-melody-gap", extentBasis: "declared-source-total" });
      assert.deepEqual(result.melodyGaps, [result.endingMelodyGap]);
      assert.deepEqual(legacyProjection(result, inspectLegacy(fixture)), inspectLegacy(fixture));
    });
  }
}

test("initial, internal and ending fractional gaps remain distinct", () => {
  const fixture = song([["D4", 3.5, 0.5], ["C4", 0.5, 1], ["E4", 2, 0.5]], source(5));
  const result = inspectSuitability(freeze(fixture));
  assert.deepEqual(result.gaps, [{ beat: 2.5, duration: 1 }]);
  assert.deepEqual(result.melodyGaps.map(({ beat, duration, position }) => ({ beat, duration, position })), [
    { beat: 0, duration: 0.5, position: "initial" },
    { beat: 1.5, duration: 0.5, position: "internal" },
    { beat: 2.5, duration: 1, position: "internal" },
    { beat: 4, duration: 1, position: "ending" }
  ]);
});

test("held notes use maximum note end, not last onset or a later short event end", () => {
  const result = inspectSuitability(song([["C4", 0, 6], ["E4", 4, 1]], source(6.5)));
  assert.equal(result.totalBeats, 6);
  assert.equal(result.longNotes, 1);
  assert.deepEqual(result.gaps, []);
  assert.deepEqual(result.melodyGaps.map(gap => [gap.beat, gap.duration]), [[6, 0.5]]);
  assert.ok(result.signals.some(signal => signal.includes("overlapping")));
});

test("a held final note through the selected end is not a melody tail gap", () => {
  const result = inspectSuitability(song([["C4", 0, 8]], source(8)));
  assert.equal(result.melodyEndBeat, 8);
  assert.equal(result.longNotes, 1);
  assert.equal(result.endingMelodyGap, null);
  assert.deepEqual(result.melodyGaps, []);
});

test("missing source extent uses a labeled main-event fallback without inventing a rest", () => {
  const result = inspectSuitability(song());
  assert.equal(result.declaredSourceTotalBeats, null);
  assert.equal(result.selectedSourceExtentBeats, 4);
  assert.equal(result.sourceExtentStatus, "missing");
  assert.equal(result.sourceExtentSelection, "encoded-main-event-fallback");
  assert.equal(result.endingMelodyGap, null);
});

test("own invalid values, including explicit undefined, never masquerade as missing or selected", () => {
  for (const invalid of [undefined, null, -1, NaN, Infinity, -Infinity, "8", "", true, false, {}, []]) {
    const fixture = song(undefined, source(invalid));
    const result = inspectSuitability(fixture);
    assert.equal(result.totalBeats, 4);
    assert.equal(result.declaredSourceTotalBeats, null);
    assert.equal(result.selectedSourceExtentBeats, null);
    assert.equal(result.sourceExtentStatus, "invalid-value");
    assert.equal(result.sourceExtentSelection, "unresolved");
    assert.equal(result.endingMelodyGap, null);
    assert.equal(result.sourceExtentIssues[0].code, "invalid-source-total-beats");
    assert.deepEqual(legacyProjection(result, inspectLegacy(fixture)), inspectLegacy(fixture));
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
  }
});

test("shorter numeric source extent is retained as a declaration and blocked as a selection", () => {
  for (const end of [0, 2, 3.5]) {
    const result = inspectSuitability(song(undefined, source(end)));
    assert.equal(result.declaredSourceTotalBeats, end);
    assert.equal(result.selectedSourceExtentBeats, null);
    assert.equal(result.sourceExtentStatus, "shorter-than-written-content");
    assert.equal(result.totalBeats, 4);
    assert.equal(result.endingMelodyGap, null);
    assert.deepEqual(result.sourceExtentIssues[0].beyond, [{ path: "steps[0]", endBeat: 4 }]);
  }
});

test("zero extent is numeric but no melody still yields unknown gaps", () => {
  const result = inspectSuitability(song([], source(0)));
  assert.equal(result.declaredSourceTotalBeats, 0);
  assert.equal(result.selectedSourceExtentBeats, 0);
  assert.equal(result.melodyEndBeat, 0);
  assert.equal(result.melodyGaps, null);
  assert.equal(result.endingMelodyGap, null);
  assert.ok(result.signals.includes("No melody available to review."));
});

test("positive declared extent with no melody does not assert entire-song silence", () => {
  for (const fixture of [song([], source(8)), v2([bassEvent(1, 4)], source(8)), v2([], source(8))]) {
    const result = inspectSuitability(fixture);
    assert.equal(result.selectedSourceExtentBeats, 8);
    assert.equal(result.melodyEndBeat, 0);
    assert.equal(result.melodyGaps, null);
    assert.equal(result.endingMelodyGap, null);
  }
});

test("source harmony-only main events can outlast melody without being called silence", () => {
  for (const extra of [{}, source(8)]) {
    const result = inspectSuitability(v2([melodyEvent(0, 4), bassEvent(4, 4)], extra));
    assert.equal(result.melodyEndBeat, 4);
    assert.equal(result.sourceEventEndBeat, 8);
    assert.equal(result.selectedSourceExtentBeats, 8);
    assert.equal(result.endingMelodyGap.duration, 4);
    assert.equal(result.endingMelodyGap.meaning, "inferred-melody-gap");
    assert.equal(result.endingMelodyGap.extentBasis,
      extra.sourceFeatures ? "declared-source-total" : "encoded-main-event-fallback");
    assert.equal(result.range, "C4-C4");
    assert.equal(result.melodyNotes, 1);
  }
});

test("independent backing endpoints are separate, never merged or confused with melody duration", () => {
  const fixture = v2(undefined, { ...source(8), autoAccompaniment: { events: [bassEvent(3, 5)] },
    practiceAccompaniment: { events: [bassEvent(3, 3)] } });
  const before = structuredClone(fixture);
  const result = inspectSuitability(freeze(fixture));
  assert.equal(result.totalBeats, 4);
  assert.equal(result.sourceEventEndBeat, 4);
  assert.deepEqual(result.accompanimentEndBeats, { autoAccompaniment: 8, practiceAccompaniment: 6 });
  assert.equal(result.selectedSourceExtentBeats, 8);
  assert.equal(result.endingMelodyGap.duration, 4);
  assert.equal(result.endingMelodyGap.meaning, "inferred-melody-gap");
  assert.deepEqual(fixture, before);
});

for (const layer of ["autoAccompaniment", "practiceAccompaniment"]) {
  test(`${layer} cannot authorize a longer fallback source extent`, () => {
    const result = inspectSuitability(v2(undefined, { [layer]: { events: [bassEvent(3, 5)] } }));
    assert.equal(result.selectedSourceExtentBeats, 4);
    assert.equal(result.declaredSourceTotalBeats, null);
    assert.equal(result.endingMelodyGap, null);
    assert.equal(result.accompanimentEndBeats[layer], 8);
    assert.equal(result.sourceExtentIssues[0].code, "content-beyond-undeclared-main-event-fallback");
  });

  test(`${layer} beyond a declared ending cannot silently pass or lengthen the selected scope`, () => {
    const result = inspectSuitability(v2(undefined, { ...source(6), [layer]: { events: [bassEvent(3, 5)] } }));
    assert.equal(result.declaredSourceTotalBeats, 6);
    assert.equal(result.selectedSourceExtentBeats, null);
    assert.equal(result.sourceExtentStatus, "shorter-than-written-content");
    assert.equal(result.endingMelodyGap, null);
    assert.deepEqual(result.sourceExtentIssues[0].beyond, [{ path: `${layer}.events[0]`, endBeat: 8 }]);
  });
}

test("declared extent must cover retained source harmony, rest windows and pickup", () => {
  const fixtures = [
    [v2([melodyEvent(0, 4), bassEvent(4, 4)], source(6)), "events[1]"],
    [song(undefined, { ...source(6), rhythm: { restWindows: [{ beat: 4, duration: 4 }] } }), "rhythm.restWindows[0]"],
    [song(undefined, { ...source(6), rhythm: { pickupBeats: 8 } }), "rhythm.pickupBeats"]
  ];
  for (const [fixture, path] of fixtures) {
    const result = inspectSuitability(fixture);
    assert.equal(result.sourceExtentStatus, "shorter-than-written-content");
    assert.equal(result.selectedSourceExtentBeats, null);
    assert.deepEqual(result.sourceExtentIssues[0].beyond, [{ path, endBeat: 8 }]);
  }
});

test("missing source extent diagnoses fractional pickup beyond main end without growing the fallback", () => {
  for (const schemaVersion of [1, 2]) {
    const fixture = schemaVersion === 1
      ? song([["C4", 0, 1 / 3]], { rhythm: { pickupBeats: 2 / 3 } })
      : v2([melodyEvent(0, 1 / 3)], { rhythm: { pickupBeats: 2 / 3 } });
    const result = inspectSuitability(freeze(fixture));
    assert.equal(result.sourceExtentStatus, "missing");
    assert.equal(result.sourceExtentSelection, "encoded-main-event-fallback");
    assert.equal(result.declaredSourceTotalBeats, null);
    assert.equal(result.selectedSourceExtentBeats, 1 / 3);
    assert.equal(result.sourceEventEndBeat, 1 / 3);
    assert.equal(result.endingMelodyGap, null);
    assert.deepEqual(result.melodyGaps, []);
    assert.deepEqual(result.sourceExtentIssues, [{ code: "content-beyond-undeclared-main-event-fallback",
      beyond: [{ path: "rhythm.pickupBeats", endBeat: 2 / 3 }] }]);
  }
});

test("missing-extent diagnostics retain both backing alternatives, rest window and pickup", () => {
  const result = inspectSuitability(song(undefined, {
    autoAccompaniment: { events: [bassEvent(4, 0.25)] },
    practiceAccompaniment: { events: [bassEvent(4, 0.5)] },
    rhythm: { pickupBeats: 4.75, restWindows: [{ beat: 4, duration: 0.625 }] }
  }));
  assert.equal(result.selectedSourceExtentBeats, 4);
  assert.equal(result.endingMelodyGap, null);
  assert.deepEqual(result.sourceExtentIssues, [{ code: "content-beyond-undeclared-main-event-fallback",
    beyond: [
      { path: "autoAccompaniment.events[0]", endBeat: 4.25 },
      { path: "practiceAccompaniment.events[0]", endBeat: 4.5 },
      { path: "rhythm.restWindows[0]", endBeat: 4.625 },
      { path: "rhythm.pickupBeats", endBeat: 4.75 }
    ] }]);
});

test("pickup at or within the main fallback and floating tolerance causes no false diagnostic", () => {
  for (const pickupBeats of [0, 1 / 6, 1 / 3, 1 / 3 + 0.5e-8]) {
    const result = inspectSuitability(song([["C4", 0, 1 / 3]], { rhythm: { pickupBeats } }));
    assert.equal(result.selectedSourceExtentBeats, 1 / 3);
    assert.equal(result.sourceExtentStatus, "missing");
    assert.deepEqual(result.sourceExtentIssues, []);
    assert.equal(result.endingMelodyGap, null);
  }
  const result = inspectSuitability(song([["C4", 0, 1 / 3]], { rhythm: { pickupBeats: 1 / 3 + 2e-8 } }));
  assert.equal(result.selectedSourceExtentBeats, 1 / 3);
  assert.deepEqual(result.sourceExtentIssues[0].beyond,
    [{ path: "rhythm.pickupBeats", endBeat: 1 / 3 + 2e-8 }]);
});

test("a fractional pickup fits only a sufficiently long declaration, without changing encoded timing", () => {
  const fixture = song([["C4", 0, 1 / 3]], { ...source(2 / 3), rhythm: { pickupBeats: 2 / 3 } });
  const valid = inspectSuitability(freeze(fixture));
  assert.equal(valid.selectedSourceExtentBeats, 2 / 3);
  assert.equal(valid.endingMelodyGap.duration, 1 / 3);
  assert.deepEqual(valid.sourceExtentIssues, []);
  const invalid = inspectSuitability({ ...fixture, ...source(0.5) });
  assert.equal(invalid.declaredSourceTotalBeats, 0.5);
  assert.equal(invalid.sourceExtentStatus, "shorter-than-written-content");
  assert.equal(invalid.selectedSourceExtentBeats, null);
  assert.equal(invalid.endingMelodyGap, null);
  assert.deepEqual(invalid.sourceExtentIssues[0].beyond,
    [{ path: "rhythm.pickupBeats", endBeat: 2 / 3 }]);
});

test("negative, nonfinite and nonnumeric pickup values are unresolved, never coerced or guessed", () => {
  for (const pickupBeats of [-1 / 3, -Number.MIN_VALUE, NaN, Infinity, -Infinity, undefined, null, "0.5", true, false, {}, []]) {
    for (const extent of [{}, source(8)]) {
      const result = inspectSuitability(song(undefined, { ...extent, rhythm: { pickupBeats } }));
      assert.equal(result.sourceExtentStatus, "unresolved-timing");
      assert.equal(result.sourceExtentSelection, "unresolved");
      assert.equal(result.selectedSourceExtentBeats, null);
      assert.equal(result.melodyGaps, null);
      assert.equal(result.endingMelodyGap, null);
      assert.deepEqual(result.sourceExtentIssues,
        [{ code: "invalid-pickup-extent", path: "rhythm.pickupBeats" }]);
    }
  }
});

test("malformed and overflowed written spans cannot quietly establish an extent", () => {
  const invalidSpans = [
    { beat: -1 / 3, duration: 1 / 6 }, { beat: 0, duration: -1 / 3 },
    { beat: 0, duration: 0 }, { beat: Infinity, duration: 1 },
    { beat: 0, duration: NaN }, { beat: 0, duration: -Infinity },
    { beat: Number.MAX_VALUE, duration: Number.MAX_VALUE },
    { beat: "0", duration: 1 / 3 }, { beat: 0, duration: "0.5" }
  ];
  for (const span of invalidSpans) {
    const fixtures = [
      [song([["C4", span.beat, span.duration]], source(8)), "steps[0]"],
      [v2([melodyEvent(span.beat, span.duration)], source(8)), "events[0]"],
      [song(undefined, { ...source(8), autoAccompaniment: { events: [span] } }), "autoAccompaniment.events[0]"],
      [song(undefined, { ...source(8), practiceAccompaniment: { events: [span] } }), "practiceAccompaniment.events[0]"],
      [song(undefined, { ...source(8), rhythm: { restWindows: [span] } }), "rhythm.restWindows[0]"]
    ];
    for (const [fixture, path] of fixtures) {
      const result = inspectSuitability(fixture);
      assert.equal(result.sourceExtentStatus, "unresolved-timing");
      assert.equal(result.selectedSourceExtentBeats, null);
      assert.equal(result.melodyGaps, null);
      assert.equal(result.endingMelodyGap, null);
      assert.deepEqual(result.sourceExtentIssues, [{ code: "invalid-written-span", path }]);
    }
  }
});

test("malformed inspected backing timing leaves source extent unresolved", () => {
  const result = inspectSuitability(v2(undefined, { ...source(8), autoAccompaniment: { events: [bassEvent(3, Infinity)] } }));
  assert.equal(result.sourceExtentStatus, "unresolved-timing");
  assert.equal(result.selectedSourceExtentBeats, null);
  assert.equal(result.melodyGaps, null);
  assert.equal(result.endingMelodyGap, null);
});

test("malformed backing and rest arrays remain unresolved rather than empty successes", () => {
  for (const raw of [null, false, 4, "events", {}]) {
    const fixtures = [
      [song(undefined, { autoAccompaniment: { events: raw } }), "autoAccompaniment.events"],
      [song(undefined, { practiceAccompaniment: { events: raw } }), "practiceAccompaniment.events"],
      [song(undefined, { rhythm: { restWindows: raw } }), "rhythm.restWindows"]
    ];
    for (const [fixture, path] of fixtures) {
      const result = inspectSuitability(fixture);
      assert.equal(result.sourceExtentStatus, "unresolved-timing");
      assert.equal(result.selectedSourceExtentBeats, null);
      assert.equal(result.melodyGaps, null);
      assert.deepEqual(result.sourceExtentIssues, [{ code: "invalid-timing-array", path }]);
    }
  }
});

test("fractional timing is not quantized and roundoff cannot invent an ending gap", () => {
  const precise = inspectSuitability(song([["C4", 0, 1 / 3]], source(2 / 3)));
  assert.equal(precise.endingMelodyGap.duration, 1 / 3);
  const roundoff = inspectSuitability(song([["C4", 0, 0.1 + 0.2]], source(0.3)));
  assert.equal(roundoff.sourceExtentStatus, "covers-written-content");
  assert.equal(roundoff.declaredSourceTotalBeats, 0.3);
  assert.equal(roundoff.selectedSourceExtentBeats, 0.3);
  assert.equal(roundoff.melodyEndBeat, 0.1 + 0.2);
  assert.equal(roundoff.endingMelodyGap, null);
});

test("omitted or historical printed extents are not promoted into the selected melody scope", () => {
  const result = inspectSuitability(song(undefined, { sourceFeatures: { sourceTotalBeats: 4,
    fullPrintedExtent: 12, sourceReview: { currentScopeReview: { omittedSourceGestures: [
      { beat: 4, duration: 8, outsideSelectedScope: true }
    ] }, historicalCandidates: [{ sourceTotalBeats: 20 }] } } }));
  assert.equal(result.selectedSourceExtentBeats, 4);
  assert.equal(result.endingMelodyGap, null);
});

test("melody-only versus all-layer-silence metadata cannot upgrade an inferred gap", () => {
  const declarations = [
    { melodyOnlyRestWindows: [[4, 4]] },
    { sourceReview: { currentScopeReview: { silentWindows: [{ beat: 4, duration: 4 }] } } }
  ];
  for (const declaration of declarations) {
    const result = inspectSuitability(song(undefined, { sourceFeatures: { sourceTotalBeats: 8, ...declaration } }));
    assert.equal(result.endingMelodyGap.meaning, "inferred-melody-gap");
    assert.equal(Object.hasOwn(result.endingMelodyGap, "policy"), false);
    assert.equal(Object.hasOwn(result.endingMelodyGap, "silenceApproved"), false);
  }
});

const songs = (await readSongFiles()).map(({ song: data }) => data);
const expectedTails = {
  "fan-fang-xiang-de-zhong": [62, 64, 2],
  "song-bie": [94, 96, 2], "xuan-cao-hua-reviewed-support": [191,192,1],
  jasmine: [55, 56, 1], "gao-bai-qi-qiu": [129, 132, 3], "ping-fan-zhi-lu": [64, 68, 4],
  "qi-feng-le": [77, 80, 3], "xuan-cao-hua": [191, 192, 1], "ye-de-gang-qin-qu-wu": [129, 132, 3],
  "yun-yan-cheng-yu": [120, 124, 4]
};

for (const [id, [melodyEnd, extent, tail]] of Object.entries(expectedTails)) {
  test(`${id}: current encoded ${melodyEnd} / selected ${extent} / ending gap ${tail}`, () => {
    const fixture = songs.find(item => item.id === id);
    assert.ok(fixture, id);
    const result = inspectSuitability(freeze(fixture));
    assert.equal(result.totalBeats, melodyEnd);
    assert.equal(result.melodyEndBeat, melodyEnd);
    assert.equal(result.selectedSourceExtentBeats, extent);
    assert.equal(result.declaredSourceTotalBeats, extent);
    assert.equal(result.endingMelodyGap.duration, tail);
    assert.equal(result.endingMelodyGap.meaning, "inferred-melody-gap");
    assert.equal(result.sourceExtentStatus, "covers-written-content");
    assert.deepEqual(result.sourceExtentIssues, []);
  });
}

test("Daylily and Farewell keep legacy gap counts while separately reporting their endings", () => {
  for (const [id, legacyCount, completeCount] of [["xuan-cao-hua", 19, 20], ["song-bie", 5, 6]]) {
    const result = inspectSuitability(songs.find(item => item.id === id));
    assert.equal(result.gaps.length, legacyCount, id);
    assert.equal(result.melodyGaps.filter(gap => gap.duration >= 1 - 1e-8).length, completeCount, id);
    assert.equal(result.melodyGaps.filter(gap => gap.position === "ending").length, 1, id);
  }
});

test("all 58 current records preserve every legacy metric, signal, decision and input byte value", () => {
  assert.equal(songs.length, 58);
  for (const fixture of songs) {
    const before = structuredClone(fixture);
    const previous = inspectLegacy(fixture);
    const result = inspectSuitability(freeze(fixture));
    assert.deepEqual(legacyProjection(result, previous), previous, fixture.id);
    assert.deepEqual(fixture, before, fixture.id);
    assert.deepEqual(result.sourceExtentIssues, [], fixture.id);
    assert.equal(result.melodyEndBeat, previous.totalBeats, fixture.id);
  }
});

test("the other 48 current records gain no ending melody gap", () => {
  const others = songs.filter(fixture => !Object.hasOwn(expectedTails, fixture.id));
  assert.equal(others.length, 48);
  for (const fixture of others) {
    const result = inspectSuitability(fixture);
    assert.equal(result.endingMelodyGap, null, fixture.id);
    near(result.selectedSourceExtentBeats, result.melodyEndBeat);
  }
  assert.deepEqual(songs.filter(fixture => inspectSuitability(fixture).endingMelodyGap).map(fixture => fixture.id).sort(),
    Object.keys(expectedTails).sort());
});

test("JSON and human CLI output expose units and do not require builds or generate files", () => {
  const script = fileURLToPath(new URL("./report-song-suitability.mjs", import.meta.url));
  const json = spawnSync(process.execPath, [script, "--json"], { encoding: "utf8" });
  assert.equal(json.status, 0, json.stderr);
  const rows = JSON.parse(json.stdout);
  assert.equal(rows.length, 58);
  assert.deepEqual(rows, songs.map(fixture => JSON.parse(JSON.stringify(inspectSuitability(fixture)))));
  const table = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(table.status, 0, table.stderr);
  for (const label of ["Read-only suitability review", "melodyEndBeat", "selectedExtentBeats", "endingMelodyGapBeats", "initialInternalGaps>=1b", "endings are excluded", "not all-layer silence or PCM tails", "legacy initial/internal"])
    assert.ok(table.stdout.includes(label), label);
});
