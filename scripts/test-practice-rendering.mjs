import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const renderSource = appSource.slice(appSource.indexOf("    function renderBoard("), appSource.indexOf("    function shouldLoop("));
const compactViewSource = appSource.slice(appSource.indexOf("    function isCompactPracticeView("), appSource.indexOf("    function getSessionLeadSeconds("));
const birthday = JSON.parse(await readFile(new URL("../data/songs/birthday.json", import.meta.url), "utf8"));

function classes() {
  const values = new Set();
  return {
    add: value => values.add(value), remove: value => values.delete(value),
    contains: value => values.has(value),
    toggle: (value, enabled) => enabled ? values.add(value) : values.delete(value)
  };
}

// 执行实际 renderBoard，防止手机裁剪规则再次丢掉同列或密集音符。
function renderHarness(events, { compact = true, height = 165, lead = 1.9 } = {}) {
  const noteEls = new Map(events.map(event => [event.id, { style: {}, classList: classes() }]));
  const context = {
    songEvents: events, noteEls, DISPLAY_KEYS: Array(21),
    boardTop: { clientHeight: height }, noteLayer: { clientWidth: 840 },
    boardShell: { classList: classes() }, targetText: {},
    activeDetection: { lane: null, candidateLane: null }, activeInputUntil: 0, signalPeakUntil: 0,
    demoMode: false, noteLaneInsetRatio: .08,
    performance: { now: () => 0 },
    clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
    clearHighlights() {}, resetDetectionReadout() {}, setActiveBeamLane() {}, highlightLane() {}, renderSongProgress() {},
    isCompactPracticeView: () => compact, getVisualFallLeadSeconds: () => lead,
    getExpectedEvent: () => null, getJudgementEvent: () => null, getSongProgressDuration: () => 60,
    getEventTime: event => event.beat * 60 / birthday.bpm / .55,
    getEventDurationSeconds: event => event.duration * 60 / birthday.bpm / .55
  };
  runInNewContext(renderSource, context);
  return { notes: noteEls, render: seconds => context.renderBoard(seconds) };
}

function event(id, beat, lane = 14, duration = .25) {
  return { id, beat, duration, lane, minLane: lane, laneSpan: 1, judgeLanes: [lane], notes: [] };
}

test("software rotation uses the same compact preview window as native mobile landscape", () => {
  for (const [rotated, landscape, expected] of [[true,false,true], [false,true,true], [false,false,false]]) {
    const context = {
      document: { documentElement: { classList: { contains: () => rotated } } },
      window: { matchMedia: () => ({ matches: landscape }) },
      boardTop: { clientHeight: 165 }, fallLeadSeconds: 4,
      clamp: (n, min, max) => Math.max(min, Math.min(max, n))
    };
    runInNewContext(compactViewSource, context);
    assert.equal(context.isCompactPracticeView(), expected);
    assert.equal(context.getVisualFallLeadSeconds(), expected ? 165 / 86 : 4);
  }
});

test("mobile birthday opening displays both consecutive G4 notes before the first strike", () => {
  const events = birthday.steps.slice(0, 2).map(([, beat, duration], id) => event(id, beat, 14, duration));
  const board = renderHarness(events);
  board.render(-.5);
  for (const note of board.notes.values()) assert.equal(note.classList.contains("visible"), true);
  assert.notEqual(board.notes.get(0).style.transform, board.notes.get(1).style.transform);
});

test("short mobile boards display all in-window notes rather than a four/five-note cap", () => {
  for (const height of [150, 180]) {
    const board = renderHarness(Array.from({ length: 7 }, (_, id) => event(id, id * .1, id)), { height });
    board.render(0);
    assert.equal([...board.notes.values()].filter(note => note.classList.contains("visible")).length, 7);
  }
});

test("entering mobile notes appear as soon as their bottom crosses the top edge", () => {
  const board = renderHarness([event(0, 0)]);
  board.render(-1.7);
  assert.equal(board.notes.get(0).classList.contains("visible"), true);
  assert.ok(Number(board.notes.get(0).style.transform.match(/-?[\d.]+/)[0]) < 0);
  board.render(-1.85);
  assert.equal(board.notes.get(0).classList.contains("visible"), false);
  board.render(.2);
  assert.equal(board.notes.get(0).classList.contains("visible"), false);
});

test("desktop note dimensions and judgement-line timing remain unchanged", () => {
  const board = renderHarness([event(0, 0, 14, .75)], { compact: false, height: 400, lead: 3 });
  board.render(0);
  const note = board.notes.get(0);
  assert.equal(note.classList.contains("visible"), true);
  assert.equal(note.style.height, "58px");
  assert.equal(note.style.transform, "translateY(332px)");
  assert.equal(note.style.opacity, "1");
});
