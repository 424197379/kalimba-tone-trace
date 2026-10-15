import assert from "node:assert/strict";
import test from "node:test";
import { createLoopBoundaryPreviewIndex, selectLoopBoundaryPreview } from "../src/phrase-boundary-preview.js";

const event = (beat, duration = 1, id = beat, lane = 10) => ({ id, beat, duration, lane, demoPlayed: false });
const notes = Array.from({ length: 12 }, (_, beat) => event(beat));
const indexed = createLoopBoundaryPreviewIndex(notes, 12);
const range = { startBeat: 4, endBeat: 8 };

test("起 includes its own onset and shows recognizable context on both sides", () => {
  const view = selectLoopBoundaryPreview(indexed, range, "start");
  assert.equal(view.boundaryBeat, 4);
  assert.deepEqual(view.groups.map(group => group.beat), [2, 3, 4, 5, 6]);
  assert.deepEqual(view.groups.map(group => group.selected), [false, false, true, true, true]);
  assert.equal(view.groups.find(group => group.atBoundary).firstIncluded, true);
  assert.equal(view.firstIncluded.events[0], notes[4]);
});

test("终 identifies the last included attack separately from its excluded boundary attack", () => {
  const view = selectLoopBoundaryPreview(indexed, range, "end");
  assert.deepEqual(view.groups.map(group => group.beat), [5, 6, 7, 8, 9]);
  assert.equal(view.lastIncluded.beat, 7);
  assert.equal(view.lastIncluded.selected, true);
  assert.equal(view.firstExcluded.beat, 8);
  assert.equal(view.firstExcluded.selected, false);
  assert.equal(view.groups.find(group => group.atBoundary).firstExcluded, true);
  assert.equal(view.tails.find(tail => tail.event === notes[8]).selectedEndBeat, null);
});

test("compact context keeps one outside onset and prioritizes the chosen side", () => {
  assert.deepEqual(selectLoopBoundaryPreview(indexed, range, "start", { maxOnsets: 3 }).groups.map(g => g.beat), [3, 4, 5]);
  assert.deepEqual(selectLoopBoundaryPreview(indexed, range, "end", { maxOnsets: 3 }).groups.map(g => g.beat), [6, 7, 8]);
});

test("same-key repeats remain separate attacks, while simultaneous chord events stay grouped", () => {
  const source = [event(0, .5, "a"), event(.5, .5, "b"), event(1, 1, "c"), event(1, 1, "chord", 3), event(2, 1, "d")];
  const view = selectLoopBoundaryPreview(createLoopBoundaryPreviewIndex(source, 3), { startBeat: .5, endBeat: 2 }, "start");
  assert.deepEqual(view.groups.map(g => g.events.map(note => note.id)), [["a"], ["b"], ["c", "chord"], ["d"]]);
  assert.equal(view.tails.filter(tail => tail.onsetVisible).length, source.length);
});

test("fractional onsets and durations keep exact source beats", () => {
  const beats = [.25, 1 / 3 + .25, 2 / 3 + .25, 1.25];
  const source = beats.map(beat => event(beat, 1 / 3));
  const view = selectLoopBoundaryPreview(createLoopBoundaryPreviewIndex(source, 2), { startBeat: beats[1], endBeat: beats[3] }, "end");
  assert.equal(view.boundaryBeat, beats[3]);
  assert.equal(view.lastIncluded.beat, beats[2]);
  assert.equal(view.firstExcluded.beat, beats[3]);
  assert.equal(view.tails[1].sourceEndBeat, beats[1] + 1 / 3);
});

test("a tied/held note is one attack and one natural tail, clipped at exclusive 终 only for selection", () => {
  const held = event(0, 10, "tied");
  const source = [held, event(4, 1, "next"), event(6, 1, "excluded")];
  const view = selectLoopBoundaryPreview(createLoopBoundaryPreviewIndex(source, 12), { startBeat: 0, endBeat: 6 }, "end");
  const tail = view.tails.find(tail => tail.event === held);
  assert.equal(view.groups.filter(g => g.events.includes(held)).length, 1);
  assert.equal(tail.sourceEndBeat, 10);
  assert.equal(tail.selectedEndBeat, 6);
  assert.equal(tail.crossesBoundary, true);
  assert.equal(tail.continuesAfterWindow, true);
  assert.equal(held.duration, 10);
  assert.deepEqual(view.rests, []);
});

test("a hold starting before 起 stays outside the selected phrase even when its tail crosses 起", () => {
  const old = event(0, 8, "old");
  const source = [old, event(2), event(3), event(4), event(5), event(6), event(7), event(8)];
  const view = selectLoopBoundaryPreview(createLoopBoundaryPreviewIndex(source, 10), { startBeat: 5, endBeat: 8 }, "start", { maxOnsets: 3 });
  const tail = view.tails.find(tail => tail.event === old);
  assert.equal(tail.onsetVisible, false);
  assert.equal(tail.continuesBeforeWindow, true);
  assert.equal(tail.crossesBoundary, true);
  assert.equal(tail.selected, false);
  assert.equal(tail.selectedEndBeat, null);
  assert.equal(view.groups.some(g => g.events.includes(old)), false);
});

test("rests stay empty intervals and song-end silence is retained without phantom attacks", () => {
  const source = [event(0, 1), event(3, .5), event(5, 1)];
  const view = selectLoopBoundaryPreview(createLoopBoundaryPreviewIndex(source, 9), { startBeat: 0, endBeat: 9 }, "end");
  assert.equal(view.boundaryBeat, 9);
  assert.equal(view.toBeat, 9);
  assert.equal(view.firstExcluded, null);
  assert.equal(view.lastIncluded.beat, 5);
  assert.deepEqual(view.rests, [
    { fromBeat: 1, toBeat: 3 }, { fromBeat: 3.5, toBeat: 5 }, { fromBeat: 6, toBeat: 9 }
  ]);
  assert.equal(view.groups.flatMap(g => g.events).length, 3);
});

test("overlapping natural holds merge occupied time, avoiding false rests", () => {
  const source = [event(0, 4), event(1, 1), event(3, 3), event(7, 1)];
  const view = selectLoopBoundaryPreview(createLoopBoundaryPreviewIndex(source, 9), { startBeat: 0, endBeat: 9 }, "end");
  assert.deepEqual(view.rests, [{ fromBeat: 6, toBeat: 7 }, { fromBeat: 8, toBeat: 9 }]);
});

test("a one-note song and its exclusive end still produce finite context", () => {
  const index = createLoopBoundaryPreviewIndex([event(.25, .5)], .75);
  for (const edge of ["start", "end"]) {
    const view = selectLoopBoundaryPreview(index, { startBeat: .25, endBeat: .75 }, edge);
    assert.equal(view.groups.length, 1);
    assert.equal(view.lastIncluded.beat, .25);
    assert.equal(view.firstExcluded, null);
    assert.ok(view.fromBeat <= view.boundaryBeat && view.toBeat >= view.boundaryBeat);
    assert.ok(view.toBeat > view.fromBeat);
  }
});

test("selection is independent of audio flags and never mutates events, ranges, or the index", () => {
  const source = notes.map(note => ({ ...note }));
  const index = createLoopBoundaryPreviewIndex(source, 12);
  const original = JSON.stringify({ source, range, index });
  for (let count = 0; count < 20; count += 1) selectLoopBoundaryPreview(index, range, count % 2 ? "start" : "end");
  assert.equal(JSON.stringify({ source, range, index }), original);
  source[5].demoPlayed = true;
  assert.equal(selectLoopBoundaryPreview(index, range, "end").groups[0].events[0], source[5]);
  assert.equal(selectLoopBoundaryPreview(index, range, "end").groups[0].selected, true);
});

test("index construction sorts only its own records and filters malformed timing", () => {
  const source = [event(3), null, event(1), event(1, 2, "chord"), event(NaN), event(-1), event(2, 0), event(1, Infinity)];
  const original = source.slice();
  const index = createLoopBoundaryPreviewIndex(source, 5);
  assert.deepEqual(source, original);
  assert.deepEqual(index.groups.map(g => g.beat), [1, 3]);
  assert.deepEqual(index.groups[0].records.map(r => r.event.id), [1, "chord"]);
  assert.equal(index.totalBeats, 5);
  assert.equal(createLoopBoundaryPreviewIndex([event(4, 5)], 1).totalBeats, 9);
});

test("empty data, invalid ranges and invalid edges cannot produce misleading previews", () => {
  assert.equal(selectLoopBoundaryPreview(createLoopBoundaryPreviewIndex([], 12), range, "end"), null);
  assert.equal(selectLoopBoundaryPreview(null, range, "start"), null);
  for (const invalid of [null, {}, { startBeat: -1, endBeat: 8 }, { startBeat: 4, endBeat: 4 }, { startBeat: 4, endBeat: 13 }, { startBeat: 4, endBeat: NaN }]) {
    assert.equal(selectLoopBoundaryPreview(indexed, invalid, "start"), null);
  }
  assert.equal(selectLoopBoundaryPreview(indexed, range, "unknown"), null);
});

test("context limits are bounded and every window straddles its requested edge", () => {
  for (const maxOnsets of [0, -4, 3, 4, 5, 9, 100, NaN, Infinity]) {
    for (const selectedRange of [range, { startBeat: 0, endBeat: 1 }, { startBeat: 11, endBeat: 12 }]) {
      for (const edge of ["start", "end"]) {
        const view = selectLoopBoundaryPreview(indexed, selectedRange, edge, { maxOnsets });
        assert.ok(view.groups.length >= 3 && view.groups.length <= 9);
        assert.ok(view.fromBeat <= view.boundaryBeat && view.toBeat >= view.boundaryBeat);
        assert.ok(view.groups.some(g => edge === "start" ? g.firstIncluded : g.lastIncluded));
      }
    }
  }
});

test("a boundary in genuine silence keeps the adjacent attacks separate", () => {
  const source = [event(0, 1), event(3, .5), event(7, 1)];
  const view = selectLoopBoundaryPreview(createLoopBoundaryPreviewIndex(source, 9), { startBeat: 0, endBeat: 5 }, "end");
  assert.equal(view.lastIncluded.beat, 3);
  assert.equal(view.firstExcluded.beat, 7);
  assert.equal(view.groups.some(group => group.atBoundary), false);
  assert.ok(view.rests.some(rest => rest.fromBeat === 3.5 && rest.toBeat === 7));
  assert.equal(view.tails.some(tail => tail.crossesBoundary), false);
});

test("a long ordinary score uses bounded indexed reads per move, without sorting or scanning its past", () => {
  const source = Array.from({ length: 20000 }, (_, beat) => event(beat, .5));
  const index = createLoopBoundaryPreviewIndex(source, 20000);
  let reads = 0;
  const counted = (values) => new Proxy(values, {
    get(target, property, receiver) {
      assert.notEqual(property, "sort", "selection must not sort an existing index");
      if (/^(0|[1-9]\d*)$/.test(String(property))) reads += 1;
      return Reflect.get(target, property, receiver);
    }
  });
  const view = selectLoopBoundaryPreview({ ...index,
    groups: counted(index.groups), records: counted(index.records), prefixEnds: counted(index.prefixEnds)
  }, { startBeat: 15000, endBeat: 15008 }, "end");
  assert.deepEqual(view.groups.map(group => group.beat), [15005, 15006, 15007, 15008, 15009]);
  assert.ok(reads < 200, `Unexpected full-score work: ${reads} indexed reads`);
});
