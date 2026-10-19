import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { selectKeyGuidance } from "../src/key-guidance.js";
import { NOTE_INDEX, SONG_LIBRARY } from "../src/songs.js";

const EPSILON = 1e-8;
const event = (id, beat, duration = 0.5, judgeLanes = [0]) => ({ id, beat, duration, judgeLanes });
const key = (result, lane) => result.keys.find(cue => cue.lane === lane);
const snapshot = result => ({
  keys: result.keys.map(({ lane, role, held, repeat, eventIds }) => ({ lane, role, held, repeat, eventIds })),
  heldEventIds: result.heldEventIds,
  nextEventIds: result.nextEventIds
});
const empty = result => {
  assert.deepEqual(result.keys, []);
  assert.deepEqual(result.heldEventIds, []);
  assert.deepEqual(result.nextEventIds, []);
  assert.deepEqual(result.darkEvents, []);
};
const freeze = value => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// Exercise the production builder rather than making a second song converter.
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const builder = appSource.match(/^    function buildSongEvents\(song\) \{[\s\S]*?^    \}/m);
assert.ok(builder, "Missing production buildSongEvents");
const context = { NOTE_INDEX };
runInNewContext(builder[0], context);
const corpus = Object.values(SONG_LIBRARY).filter(song => song.schemaVersion === 1)
  .map(song => ({ song, events: freeze(context.buildSongEvents(song)) }));

test("before preview, held interval, rest and song end have exact boundaries", () => {
  const events = [event("first", 0, 0.5, [2]), event("later", 4, 0.5, [5])];
  empty(selectKeyGuidance(events, -1.2 - EPSILON, 1));
  let result = selectKeyGuidance(events, -1.2, 1);
  assert.deepEqual(result.nextEventIds, ["first"]);
  assert.equal(key(result, 2).role, "primary");
  assert.equal(key(result, 2).held, false);
  result = selectKeyGuidance(events, 0, 1);
  assert.deepEqual(result.heldEventIds, ["first"]);
  assert.equal(key(result, 2).held, true);
  assert.equal(key(selectKeyGuidance(events, 0.5 - EPSILON, 1), 2).held, true);
  empty(selectKeyGuidance(events, 0.5, 1));
  empty(selectKeyGuidance(events, 2, 1));
  assert.deepEqual(selectKeyGuidance(events, 3, 1).nextEventIds, ["later"]);
  empty(selectKeyGuidance(events, 4.5, 1));
  empty(selectKeyGuidance(events, 500, 1));
});

test("preview outline changes to a half-open dark gap and then brighter active fill", () => {
  const events = [event("a", 1, 0.5, [2])];
  const justBeforeDark = selectKeyGuidance(events, 1 - 0.06 - EPSILON, 1);
  assert.equal(key(justBeforeDark, 2).phase, "preview-outline");
  assert.deepEqual(justBeforeDark.darkEvents, []);
  const atDarkStart = selectKeyGuidance(events, 1 - 0.06, 1);
  assert.equal(key(atDarkStart, 2).phase, "pre-onset-dark");
  assert.equal(key(atDarkStart, 2).held, false);
  assert.deepEqual(atDarkStart.nextEventIds, ["a"]);
  assert.deepEqual(atDarkStart.darkEvents, [{ id: "a", beat: 1, lanes: [2], startBeat: 1 - 0.06 }]);
  assert.equal(key(selectKeyGuidance(events, 1 - EPSILON, 1), 2).phase, "pre-onset-dark");
  const onset = selectKeyGuidance(events, 1, 1);
  assert.equal(key(onset, 2).phase, "active-fill");
  assert.deepEqual(onset.darkEvents, []);
  assert.equal(key(selectKeyGuidance(events, 1.5 - EPSILON, 1), 2).phase, "active-fill");
  empty(selectKeyGuidance(events, 1.5, 1));
});

test("without held notes the second onset uses secondary edge; with a hold next uses outline", () => {
  const events = [event("a", 1, 0.5, [1]), event("b", 1.5, 0.5, [2])];
  let result = selectKeyGuidance(events, 0.5, 1);
  assert.equal(key(result, 1).phase, "preview-outline");
  assert.equal(key(result, 2).phase, "secondary-edge");
  assert.equal(key(result, 2).role, "secondary");
  result = selectKeyGuidance(events, 1.1, 1);
  assert.equal(key(result, 1).phase, "active-fill");
  assert.equal(key(result, 2).phase, "preview-outline");
  assert.equal(key(result, 2).role, "secondary");
});

test("a repeated strike's dark gap overrides only its own still-held lane", () => {
  const events = [event("held", 0, 2, [1, 2]), event("repeat", 1, 0.5, [1])];
  let result = selectKeyGuidance(events, 0.9, 1);
  assert.equal(key(result, 1).phase, "active-fill");
  assert.equal(key(result, 1).repeat, true);
  result = selectKeyGuidance(events, 0.95, 1);
  assert.equal(key(result, 1).phase, "pre-onset-dark");
  assert.equal(key(result, 1).role, "primary");
  assert.equal(key(result, 1).held, true);
  assert.deepEqual(key(result, 1).eventIds, ["held", "repeat"]);
  assert.equal(key(result, 2).phase, "active-fill");
  assert.equal(key(result, 2).repeat, false);
  assert.deepEqual(result.heldEventIds, ["held"]);
  assert.deepEqual(result.nextEventIds, ["repeat"]);
  result = selectKeyGuidance(events, 1, 1);
  assert.equal(key(result, 1).phase, "active-fill");
  assert.equal(key(result, 1).repeat, false, "The repeated strike has arrived; no future re-strike remains");
  assert.deepEqual(result.heldEventIds, ["held", "repeat"]);
  assert.deepEqual(result.darkEvents, []);
});

test("same-lane preview priorities merge and dark never skips to a later cue", () => {
  const events = [event("a", 1, 0.1, [1]), event("b", 1.2, 0.1, [1]), event("c", 1.3, 0.1, [3])];
  let result = selectKeyGuidance(events, 0.5, 1);
  assert.equal(key(result, 1).phase, "preview-outline");
  assert.equal(key(result, 1).role, "primary");
  result = selectKeyGuidance(events, 0.95, 1);
  assert.equal(key(result, 1).phase, "pre-onset-dark");
  assert.deepEqual(result.nextEventIds, ["a", "b"]);
  assert.equal(key(result, 3), undefined);
});

for (const speed of [0.35, 1, 1.4]) {
  test(`dense dark gaps use 20 percent of the preceding onset interval and at most 60 ms at ${speed}x`, () => {
    const events = [event("a", 0, 0.125, [1]), event("b", 0.125, 0.125, [1]), event("c", 0.25, 1, [1])];
    const scaledBeatSeconds = 1 / speed;
    for (const e of events) {
      const onset = e.beat * scaledBeatSeconds;
      const lead = e.beat === 0 ? 0.06 : Math.min(0.06, 0.125 * scaledBeatSeconds * 0.2);
      const start = onset - lead;
      assert.notEqual(key(selectKeyGuidance(events, start - EPSILON, scaledBeatSeconds), 1)?.phase, "pre-onset-dark");
      const dark = selectKeyGuidance(events, start, scaledBeatSeconds);
      assert.equal(key(dark, 1).phase, "pre-onset-dark");
      const descriptor = dark.darkEvents.find(value => value.id === e.id);
      assert.ok(descriptor);
      assert.ok(Math.abs(descriptor.startBeat - (e.beat - lead / scaledBeatSeconds)) < EPSILON);
      assert.equal(key(selectKeyGuidance(events, onset, scaledBeatSeconds), 1).phase, "active-fill");
    }
  });
}

test("only explicitly judged onsets and the current loop affect dark timing", () => {
  const events = [event("outside", 1.99, 1, [0]), event("A", 2, 1, [2]),
    event("support", 2.99, 0.2, []), event("inside", 3, 0.5, [3]), event("B", 4, 1, [4])];
  const options = { range: { startBeat: 2, endBeat: 4 } };
  const first = selectKeyGuidance(events, 1.95, 1, options);
  assert.equal(key(first, 2).phase, "pre-onset-dark");
  assert.equal(first.darkEvents[0].startBeat, 1.94);
  const later = selectKeyGuidance(events, 2.95, 1, options);
  assert.equal(key(later, 3).phase, "pre-onset-dark");
  assert.equal(later.darkEvents[0].startBeat, 2.94);
  empty(selectKeyGuidance(events, 3.95, 1, options));
});

test("held and tied notes never create another dark gap or catch-up signal", () => {
  const events = [event("tie", 0, 8, [4])];
  for (const time of [0, 0.01, 0.5, 1, 3.95, 4, 7.95, 7.99]) {
    const result = selectKeyGuidance(events, time, 1);
    assert.equal(key(result, 4).phase, "active-fill");
    assert.deepEqual(result.darkEvents, []);
    assert.ok(!Object.hasOwn(key(result, 4), "pulse"));
    assert.ok(!Object.hasOwn(key(result, 4), "attack"));
  }
  assert.ok(!Object.hasOwn(selectKeyGuidance(events, 0, 1), "pulseEvents"));
});

test("each of the next two onsets checks its own preview boundary", () => {
  const events = [event("next", 1, 0.5, [2]), event("second", 2, 0.5, [4]), event("third", 2.1, 0.5, [6])];
  let result = selectKeyGuidance(events, 0, 1, { previewSeconds: 1.2 });
  assert.deepEqual(result.nextEventIds, ["next"]);
  assert.equal(key(result, 4), undefined);
  result = selectKeyGuidance(events, 0.8, 1, { previewSeconds: 1.2 });
  assert.deepEqual(result.nextEventIds, ["next", "second"]);
  assert.equal(key(result, 2).role, "primary");
  assert.equal(key(result, 4).role, "secondary");
  assert.equal(key(result, 6), undefined);
  empty(selectKeyGuidance(events, -1, 1, { previewSeconds: 1.2 }));
});

test("held notes stay primary and only the first future onset is secondary", () => {
  const events = [event("held", 0, 4, [7]), event("next", 1, 0.25, [2]), event("later", 1.1, 0.25, [3])];
  const result = selectKeyGuidance(events, 0.5, 1);
  assert.deepEqual(result.heldEventIds, ["held"]);
  assert.deepEqual(result.nextEventIds, ["next"]);
  assert.equal(key(result, 7).role, "primary");
  assert.equal(key(result, 7).held, true);
  assert.equal(key(result, 2).role, "secondary");
  assert.equal(key(result, 3), undefined);
});

test("all imported overlapping holds stay primary until their individual ends", () => {
  const events = [event("long", 0, 4, [7]), event("overlap", 1, 2, [2]), event("next", 2, 0.25, [3])];
  let result = selectKeyGuidance(events, 1.5, 1);
  assert.deepEqual(result.heldEventIds, ["long", "overlap"]);
  assert.equal(key(result, 7).role, "primary");
  assert.equal(key(result, 2).role, "primary");
  assert.equal(key(result, 3).role, "secondary");
  result = selectKeyGuidance(events, 3, 1);
  assert.deepEqual(result.heldEventIds, ["long"]);
  assert.equal(key(result, 2), undefined);
  empty(selectKeyGuidance(events, 4, 1));
});

test("same-lane primary and secondary merge without losing the next strike", () => {
  const events = [event("a", 1, 0.1, [3]), event("b", 1.2, 0.1, [3])];
  const result = selectKeyGuidance(events, 0.5, 1);
  assert.equal(result.keys.length, 1);
  assert.equal(key(result, 3).role, "primary");
  assert.equal(key(result, 3).repeat, true);
  assert.deepEqual(key(result, 3).eventIds, ["a", "b"]);
  for (const e of events) assert.deepEqual(selectKeyGuidance(events, e.beat, 1).heldEventIds, [e.id]);
});

test("same-lane held plus future preserves held primary and repeat identity", () => {
  const events = [event("a", 0, 2, [3]), event("b", 1, 0.25, [3])];
  const result = selectKeyGuidance(events, 0.9, 1);
  assert.equal(result.keys.length, 1);
  assert.equal(key(result, 3).role, "primary");
  assert.equal(key(result, 3).held, true);
  assert.equal(key(result, 3).repeat, true);
  assert.deepEqual(key(result, 3).eventIds, ["a", "b"]);
  assert.deepEqual(result.heldEventIds, ["a"]);
  assert.deepEqual(result.nextEventIds, ["b"]);
});

test("past same-lane overlapping holds do not announce a pending repeated strike", () => {
  const events = [event("long", 0, 4, [2]), event("short", 1, 1, [2])];
  const result = selectKeyGuidance(events, 1.5, 1);
  assert.deepEqual(result.heldEventIds, ["long", "short"]);
  assert.deepEqual(result.nextEventIds, []);
  assert.equal(key(result, 2).held, true);
  assert.equal(key(result, 2).phase, "active-fill");
  assert.equal(key(result, 2).repeat, false);
  assert.deepEqual(key(result, 2).eventIds, ["long", "short"]);
});

test("simultaneous future or held events on one lane are one onset, not a repeat", () => {
  const events = [event("same-a", 1, 1, [2]), event("same-b", 1, 2, [2])];
  for (const seconds of [0.5, 0.95, 1, 1.5]) {
    const result = selectKeyGuidance(events, seconds, 1);
    assert.equal(key(result, 2).repeat, false);
    assert.deepEqual(key(result, 2).eventIds, ["same-a", "same-b"]);
  }
});

test("overlapping holds plus a distinct future onset still announce one pending repeat", () => {
  const events = [event("long", 0, 4, [2]), event("short", 1, 1, [2]), event("future", 2, 1, [2])];
  const before = selectKeyGuidance(events, 1.5, 1);
  assert.equal(key(before, 2).repeat, true);
  assert.deepEqual(before.heldEventIds, ["long", "short"]);
  assert.deepEqual(before.nextEventIds, ["future"]);
  const onset = selectKeyGuidance(events, 2, 1);
  assert.equal(key(onset, 2).repeat, false);
  assert.deepEqual(onset.heldEventIds, ["long", "future"]);
});

test("simultaneous duplicates do not hide a later genuine repeated onset", () => {
  const events = [event("same-a", 1, 0.5, [2]), event("same-b", 1, 0.5, [2]), event("later", 1.2, 0.5, [2])];
  const result = selectKeyGuidance(events, 0.5, 1);
  assert.equal(key(result, 2).repeat, true);
  assert.deepEqual(result.nextEventIds, ["same-a", "same-b", "later"]);
});

test("a true long hold does not invent repeated event identities", () => {
  const events = [event("tie", 0, 8, [4])];
  for (const time of [0, 0.5, 1, 3, 4, 7.99]) {
    const result = selectKeyGuidance(events, time, 1);
    assert.equal(key(result, 4).repeat, false);
    assert.equal(key(result, 4).held, true);
    assert.deepEqual(key(result, 4).eventIds, ["tie"]);
  }
  empty(selectKeyGuidance(events, 8, 1));
});

test("simultaneous explicit judge lanes share onset roles and retain ids", () => {
  const events = [event("a", 1, 1, [3, 3, 1]), event("b", 1, 1, [5]), event("c", 2, 1, [7])];
  const result = selectKeyGuidance(events, 0.8, 1);
  assert.deepEqual(result.keys.map(cue => cue.lane), [1, 3, 5, 7]);
  for (const lane of [1, 3, 5]) assert.equal(key(result, lane).role, "primary");
  assert.equal(key(result, 7).role, "secondary");
  assert.equal(key(result, 3).repeat, false);
  assert.deepEqual(result.nextEventIds, ["a", "b", "c"]);
  assert.deepEqual(selectKeyGuidance(events, 1, 1).heldEventIds, ["a", "b"]);
});

test("unmarked accompaniment and fallback lane/name/notes never generate guidance", () => {
  const unmarked = [
    { id: "bass", beat: 0, duration: 4, judgeLanes: [], lane: 0, notes: [{ lane: 0, role: "bass" }] },
    { id: "highest", beat: 1, duration: 1, lane: 20, name: "D6", notes: [{ lane: 20 }] }
  ];
  for (const time of [-0.5, 0, 0.5, 1, 1.5]) empty(selectKeyGuidance(unmarked, time, 1));
  const melody = event("melody", 1, 0.5, [4]);
  assert.deepEqual(selectKeyGuidance([...unmarked, melody], 0.5, 1).nextEventIds, ["melody"]);
  assert.deepEqual(selectKeyGuidance([...unmarked, melody], 1, 1).heldEventIds, ["melody"]);
});

test("loop A includes its own onset and excludes notes carried in from before A", () => {
  const events = [event("before", 0, 10, [0]), event("A", 2, 1, [2]), event("B", 4, 1, [4])];
  const options = { range: { startBeat: 2, endBeat: 4 } };
  let result = selectKeyGuidance(events, 1.5, 1, options);
  assert.deepEqual(result.nextEventIds, ["A"]);
  assert.equal(key(result, 0), undefined);
  result = selectKeyGuidance(events, 2, 1, options);
  assert.deepEqual(result.heldEventIds, ["A"]);
  assert.equal(key(result, 0), undefined);
  empty(selectKeyGuidance(events, 3, 1, options));
  empty(selectKeyGuidance(events, 4, 1, options));
});

test("loop B clips a hold, clears all cues and creates no wrap preview", () => {
  const events = [event("A", 2, 4, [2]), event("B", 4, 1, [4])];
  const options = { range: { startBeat: 2, endBeat: 4 } };
  const before = selectKeyGuidance(events, 4 - EPSILON, 1, options);
  assert.deepEqual(before.heldEventIds, ["A"]);
  assert.deepEqual(before.nextEventIds, []);
  empty(selectKeyGuidance(events, 4, 1, options));
  empty(selectKeyGuidance(events, 40, 1, options));
  assert.deepEqual(selectKeyGuidance(events, 2, 1, options).heldEventIds, ["A"]);
});

test("loop restart at the same position is independent of previous loop history", () => {
  const events = [event("A", 2, 0.5, [2]), event("end", 3, 0.5, [4])];
  const options = { range: { startBeat: 2, endBeat: 4 } };
  const firstPass = selectKeyGuidance(events, 1.95, 1, options);
  selectKeyGuidance(events, 2.1, 1, options);
  selectKeyGuidance(events, 4, 1, options);
  assert.deepEqual(selectKeyGuidance(events, 1.95, 1, options), firstPass);
});

test("explicit preview controls when a long-rest note becomes visible", () => {
  const events = [event("old", 0, 0.25, [0]), event("next", 8, 0.5, [1])];
  for (const previewSeconds of [0.1, 0.45, 0.8, 1.2]) {
    const options = { previewSeconds };
    empty(selectKeyGuidance(events, 8 - previewSeconds - EPSILON, 1, options));
    assert.deepEqual(selectKeyGuidance(events, 8 - previewSeconds + EPSILON, 1, options).nextEventIds, ["next"]);
  }
});

test("zero or invalid preview disables anticipation without suppressing held notes", () => {
  const events = [event("a", 1)];
  for (const previewSeconds of [0, -1, NaN, Infinity, "1", null]) {
    empty(selectKeyGuidance(events, 0.99, 1, { previewSeconds }));
    assert.deepEqual(selectKeyGuidance(events, 1, 1, { previewSeconds }).heldEventIds, ["a"]);
  }
});

test("empty and invalid timing/ranges fail closed without exceptions", () => {
  const events = [event("a", 1)];
  for (const source of [null, undefined, {}, 2, "events", []]) empty(selectKeyGuidance(source, 1, 1));
  for (const time of [undefined, null, NaN, Infinity, -Infinity, "1"]) empty(selectKeyGuidance(events, time, 1));
  for (const beatSeconds of [undefined, null, NaN, Infinity, -Infinity, 0, -1, "1"]) {
    empty(selectKeyGuidance(events, 1, beatSeconds));
  }
  for (const range of [{}, { startBeat: 2, endBeat: 1 }, { startBeat: 1, endBeat: 1 },
    { startBeat: -1, endBeat: 2 }, { startBeat: "0", endBeat: 2 }, { startBeat: 0, endBeat: Infinity }]) {
    empty(selectKeyGuidance(events, 1, 1, { range }));
  }
  assert.doesNotThrow(() => selectKeyGuidance(events, 1, 1, null));
});

test("malformed records cannot poison finite valid cues", () => {
  const invalid = [null, {}, event("nan", NaN), event("negative", -1), event("zero", 0, 0),
    event("infinite", 0, Infinity), event("missing-lanes", 0, 1, null), event("strings", "0"),
    event("invalid-lanes", 0, 1, [-1, 0.5, Infinity, NaN, "3"]), event("overflow", Number.MAX_VALUE, Number.MAX_VALUE)];
  empty(selectKeyGuidance(invalid, 0, 1));
  const result = selectKeyGuidance([...invalid, event("valid", 0, 1, [3, NaN, -1, 3, "4"])], 0, 1);
  assert.deepEqual(result.heldEventIds, ["valid"]);
  assert.deepEqual(result.keys.map(cue => cue.lane), [3]);
  assert.equal(key(result, 3).repeat, false);
});

test("selection is deterministic across paused frames, seeks and skipped frames", () => {
  const events = [event("a", 0, 1, [1]), event("b", 1, 0.1, [2]), event("c", 1.125, 0.1, [2]), event("d", 5, 1, [4])];
  const times = [-2, -0.03, 0, 0.5, 0.99, 1, 1.125, 1.8, 3, 4.99, 5, 6];
  const expected = times.map(time => selectKeyGuidance(events, time, 1));
  for (const index of [10, 0, 6, 3, 11, 1, 7, 7, 9, 2, 5, 8, 4]) {
    assert.deepEqual(selectKeyGuidance(events, times[index], 1), expected[index]);
  }
});

test("frozen inputs and options stay unchanged; returned data is owned", () => {
  const events = freeze([event("a", 0, 2, [3, 1]), event("b", 1, 1, [3])]);
  const options = freeze({ range: { startBeat: 0, endBeat: 3 }, previewSeconds: 1.2 });
  const beforeEvents = structuredClone(events);
  const beforeOptions = structuredClone(options);
  const first = selectKeyGuidance(events, 0.98, 1, options);
  const expected = structuredClone(first);
  first.keys[0].eventIds.push("changed result");
  first.heldEventIds.push("changed result");
  first.nextEventIds.push("changed result");
  first.darkEvents[0].lanes.push(99);
  assert.deepEqual(events, beforeEvents);
  assert.deepEqual(options, beforeOptions);
  assert.deepEqual(selectKeyGuidance(events, 0.98, 1, options), expected);
});

test("unsorted inputs are interpreted chronologically without reordering input", () => {
  const events = [event("third", 3, 0.5, [3]), event("first", 1, 0.5, [1]), event("second", 2, 0.5, [2])];
  const before = structuredClone(events);
  assert.deepEqual(selectKeyGuidance(events, 0.9, 1).nextEventIds, ["first", "second"]);
  assert.deepEqual(events, before);
});

test("36-song production V1 corpus contains every expected real melody onset", () => {
  assert.equal(corpus.length, 36);
  assert.equal(corpus.reduce((count, { events }) => count + events.length, 0), 4440);
  for (const { song, events } of corpus) {
    assert.equal(events.length, song.steps.length, song.id);
    assert.ok(events.every(e => e.judgeLanes.length === 1), song.id);
  }
});

for (const speed of [0.35, 0.55, 1, 1.4]) {
  test(`all 4,440 V1 onsets and note ends obey held intervals at ${speed}x`, () => {
    for (const { song, events } of corpus) {
      const scaledBeatSeconds = 60 / song.bpm / speed;
      for (const e of events) {
        const onset = e.beat * scaledBeatSeconds;
        const end = (e.beat + e.duration) * scaledBeatSeconds;
        const result = selectKeyGuidance(events, onset, scaledBeatSeconds);
        assert.ok(result.heldEventIds.includes(e.id), `${song.id}, ${e.id}: missing onset`);
        for (const lane of e.judgeLanes) {
          assert.equal(key(result, lane).role, "primary", `${song.id}, ${e.id}: onset role`);
          assert.equal(key(result, lane).held, true, `${song.id}, ${e.id}: onset hold`);
          assert.equal(key(result, lane).phase, "active-fill", `${song.id}, ${e.id}: onset fill`);
        }
        const previous = events.filter(candidate => candidate.beat < e.beat).at(-1);
        const lead = Math.min(0.06, previous ? (e.beat - previous.beat) * scaledBeatSeconds * 0.2 : Infinity);
        const before = selectKeyGuidance(events, onset - lead / 2, scaledBeatSeconds);
        for (const lane of e.judgeLanes) {
          assert.equal(key(before, lane).phase, "pre-onset-dark", `${song.id}, ${e.id}: pre-onset dark`);
        }
        assert.ok(before.darkEvents.some(dark => dark.id === e.id), `${song.id}, ${e.id}: missing dark descriptor`);
        assert.ok(selectKeyGuidance(events, onset + (end - onset) / 2, scaledBeatSeconds).heldEventIds.includes(e.id),
          `${song.id}, ${e.id}: hold midpoint`);
        const expired = selectKeyGuidance(events, end, scaledBeatSeconds);
        assert.ok(!expired.heldEventIds.includes(e.id), `${song.id}, ${e.id}: exact end`);
        assert.ok(!expired.keys.some(cue => cue.eventIds.includes(e.id)), `${song.id}, ${e.id}: expired cue`);
      }
      const end = Math.max(...events.map(e => (e.beat + e.duration) * scaledBeatSeconds));
      empty(selectKeyGuidance(events, end, scaledBeatSeconds));
      const sourceEnd = (song.sourceFeatures?.sourceTotalBeats || 0) * scaledBeatSeconds;
      if (sourceEnd > end) empty(selectKeyGuidance(events, end + (sourceEnd - end) / 2, scaledBeatSeconds));
    }
  });

  test(`every V1 song respects loop A/B and clipped holds at ${speed}x`, () => {
    for (const { song, events } of corpus) {
      const scaledBeatSeconds = 60 / song.bpm / speed;
      const firstIndex = Math.floor(events.length / 3);
      const endIndex = Math.min(events.length - 1, firstIndex + 8);
      const range = { startBeat: events[firstIndex].beat, endBeat: events[endIndex].beat };
      const options = { range };
      for (const e of events.slice(firstIndex, endIndex)) {
        const result = selectKeyGuidance(events, e.beat * scaledBeatSeconds, scaledBeatSeconds, options);
        assert.ok(result.heldEventIds.includes(e.id), `${song.id}: loop onset ${e.id}`);
        for (const id of [...result.heldEventIds, ...result.nextEventIds]) {
          const source = events.find(candidate => candidate.id === id);
          assert.ok(source.beat >= range.startBeat && source.beat < range.endBeat, `${song.id}: escaped loop`);
        }
      }
      empty(selectKeyGuidance(events, range.endBeat * scaledBeatSeconds, scaledBeatSeconds, options));
      assert.ok(selectKeyGuidance(events, range.startBeat * scaledBeatSeconds, scaledBeatSeconds, options)
        .heldEventIds.includes(events[firstIndex].id), `${song.id}: next loop A`);
    }
  });
}

test("speed scaling preserves musical key roles at the same beat", () => {
  const events = [event("a", 0, 1, [1]), event("b", 1, 1, [2]), event("c", 2, 1, [3])];
  for (const beat of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
    const reference = snapshot(selectKeyGuidance(events, beat, 1, { previewSeconds: 10 }));
    for (const speed of [0.35, 0.55, 1, 1.4]) {
      assert.deepEqual(snapshot(selectKeyGuidance(events, beat / speed, 1 / speed, { previewSeconds: 10 })), reference);
    }
  }
});
