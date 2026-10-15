import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { selectKeyGuidance } from "../src/key-guidance.js";
import { getPreparationBeats, isBeatInLoop } from "../src/practice-loop.js";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const declarations = [...source.matchAll(/^    (?:async )?function (\w+)\(/gm)];
function production(name) {
  const index = declarations.findIndex(match => match[1] === name);
  assert.ok(index >= 0, `Missing production function ${name}`);
  return source.slice(declarations[index].index, declarations[index + 1]?.index ?? source.length);
}
const runtime = [
  "beginPassPreparation",
  "getScaledBeatSeconds", "getVisualFallLeadSeconds", "getSessionLeadSeconds", "getEventTime",
  "getEventDurationSeconds", "getEventJudgeWindowSeconds", "getSongEndSeconds", "getSongProgressDuration",
  "currentPracticeTime", "clearHighlights", "setActiveBeamLane", "highlightLane", "setActiveKeyInput",
  "resetDetectionReadout", "getExpectedEvent", "getJudgementEvent", "renderKeyGuidance", "renderBoard",
  "admitPracticeFrame", "shouldLoop", "animationLoop", "startLoop", "updatePauseControl",
  "cancelPracticeContinuation", "clearPracticeInteractions", "preservePastAttacks", "pausePractice",
  "continuePractice", "preparePracticeAudio", "prepareLoopStart", "resetSongEvents", "resetAccompanimentEvents",
  "syncSongEventsForSeek", "syncAccompanimentEventsForSeek", "getAccompanimentTime",
  "getAccompanimentDurationSeconds", "playAccompanimentEvents", "seekToSongTime", "applySpeed", "setStatus",
  "getPracticeNoteTiming", "isPracticeNoteCurrent", "playKalimbaNote", "playKalimbaSample",
  "playDecodedKalimbaSample", "registerKalimbaVoice", "silenceKalimbaAudio"
].map(production).join("\n");
const timingConstants = ["focusWindowSeconds", "lateGraceSeconds", "beamSwitchLeadSeconds", "practiceOnsetStaleSeconds"]
  .map(name => {
    const match = source.match(new RegExp(`^    const ${name} = [^;]+;`, "m"));
    assert.ok(match, `Missing production timing constant ${name}`);
    return match[0];
  }).join("\n");

const EPSILON = 1e-8;
function near(actual, expected, message = "") {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
}
function element() {
  const classes = new Set();
  return {
    attrs: {}, style: {}, disabled: false, hidden: false, textContent: "",
    get className() { return [...classes].join(" "); },
    set className(value) { classes.clear(); value.split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); },
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, force) {
        const add = force === undefined ? !classes.has(name) : Boolean(force);
        if (add) classes.add(name); else classes.delete(name);
        return add;
      }
    },
    setAttribute(name, value) { this.attrs[name] = String(value); }
  };
}
function note(id, beat, duration = .5, lanes = [2]) {
  return {
    id, beat, duration, judgeLanes: lanes, minLane: Math.min(...lanes),
    laneSpan: Math.max(...lanes) - Math.min(...lanes) + 1, demoPlayed: false,
    notes: lanes.map(lane => ({ name: `test-note-${lane}`, lane, velocity: .8, judge: true }))
  };
}

// Only browser/decoded-sample boundaries are controlled. The actual production
// cue selector, renderer, transport controls, note dispatch and sample player run.
// These assertions establish logical timing, not physical sample attack latency.
function harness(events, { speed = 1, beatSeconds = 1, compact = false, range = null,
  totalBeats = 16, mode = "practice", lead = 3, height = compact ? 165 : 400 } = {}) {
  let now = 10000;
  let frameId = 0;
  const frames = new Map();
  const calls = [];
  const samples = [];
  const pendingNotes = [];
  const audioParam = () => ({ setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {} });
  const audioNode = () => ({
    gain: audioParam(), pan: audioParam(), connect(next) { return next; }, disconnect() {}, stop() {},
    start(time) { samples.push({ name: this.buffer.name, time }); }
  });
  const c = {
    selectKeyGuidance, isBeatInLoop, getPreparationBeats, console,
    beatSeconds, speedFactor: speed, baseFallLeadSeconds: lead, fallLeadSeconds: lead / Math.sqrt(speed),
    songEvents: events, accompanimentEvents: [], songTotalBeats: totalBeats, accompanimentTotalBeats: 0,
    practiceLoopRange: range && { ...range }, practiceRunning: mode === "practice", demoMode: mode === "demo",
    pausedElapsed: 0, practiceStartAt: 10000, lastPracticeFrameSeconds: null,
    pendingPlayback: null, pausedSession: null, resumePreparation: null, passPreparation: null, preparationRetryUsed: false, playbackRequestId: 0, rafId: 0,
    seekingWithProgress: false, progressSeekAtStart: false, preferredPlaybackMode: "practice", fullscreenControl: null, progressSeekPointerId: null, progressSeekRect: null,
    loopDragEdge: null, loopDragPointerId: null, loopDragRect: null, loopDragWasPlaying: false, loopDragWasDemo: false,
    accompanimentEnabled: false, accompanimentVolume: 1,
    practiceAudioReadyTimeoutMs: 8000, notePlaybackGeneration: 0,
    activeKalimbaVoices: new Set(), retiredKalimbaOutputs: new Set(),
    kalimbaBus: audioNode(), kalimbaDry: null, kalimbaWet: null, kalimbaReverb: null,
    kalimbaOutput: null, kalimbaOutputNodes: [],
    DISPLAY_KEYS: Array.from({ length: 21 }, (_, lane) => ({ name: `test-note-${lane}` })),
    NOTE_INDEX: new Map(Array.from({ length: 21 }, (_, lane) => [`test-note-${lane}`, lane])),
    keyEls: Array.from({ length: 21 }, element), laneEls: Array.from({ length: 21 }, element),
    beamEls: Array.from({ length: 21 }, element), activeBeamLane: "",
    noteEls: new Map(events.map(event => [event.id, element()])), noteLaneInsetRatio: .08,
    boardTop: { clientHeight: height }, noteLayer: { clientWidth: 840 },
    activeDetection: { lane: null, candidateLane: null }, activeInputUntil: 0, signalPeakUntil: 0,
    performance: { now: () => now }, document: { hidden: false },
    audioContext: { state: "running", get currentTime() { return now / 1000; },
      createBufferSource: audioNode, createGain: audioNode, createStereoPanner: audioNode },
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    isCompactPracticeView: () => compact,
    formatEventTargetText: event => String(event.id), renderSongProgress() {}, renderLoopControls() {},
    setCompactIcon() {}, ensureAudioContext: async () => {}, preloadKalimbaSamples: async () => {},
    loadKalimbaSampleBuffer: async name => ({ name, duration: .8 }),
    ensureKalimbaOutput() { c.kalimbaBus ||= audioNode(); },
    createPluckSynth() { assert.fail("The fixture has decoded samples; fallback synthesis is unexpected"); },
    setTimeout: () => 0, clearTimeout() {},
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    APP_NAME: "Guidance test", currentSongId: "guidance-test", browserPreferenceStorage: {},
    saveSongSpeed: () => ({}), showKeyWidthStatus() {}
  };
  for (const name of ["boardShell", "targetText", "statusText", "pauseBtn", "loopStartHandle", "loopEndHandle",
    "songProgress", "preparationCue", "speedSlider", "speedValue"]) c[name] = element();
  runInNewContext(`${timingConstants}\n${runtime}`, c);
  const phase = lane => c.keyEls[lane].attrs["data-cue-phase"];
  const bottom = id => {
    const el = c.noteEls.get(id);
    return Number(el.style.transform.match(/translateY\(([-\d.e+]+)px\)/)[1]) + Number.parseFloat(el.style.height);
  };
  const realPlay = c.playKalimbaNote;
  c.playKalimbaNote = (...args) => {
    const [name, duration, velocity, timing] = args;
    const lane = c.NOTE_INDEX.get(name);
    const event = c.songEvents.find(value => value.notes.some(n => n.name === name)
      && Math.abs(c.getEventTime(value) - ((timing.expiresAt - c.practiceStartAt) / 1000 - .15)) < 1e-7);
    calls.push({ name, duration, velocity, timing, seconds: c.currentPracticeTime(),
      phase: phase(lane), eventId: event?.id, bottom: event && bottom(event.id) });
    const pending = realPlay(...args);
    pendingNotes.push(pending);
    return pending;
  };
  function setClock(seconds) {
    c.passPreparation = null; // This fixture intentionally selects an exact score checkpoint.
    if (c.practiceRunning || c.demoMode) now = c.practiceStartAt + seconds * 1000;
    else c.pausedElapsed = seconds;
  }
  return {
    c, calls, samples, phase, bottom,
    has: (lane, name) => c.keyEls[lane].classList.contains(name),
    phases: () => c.keyEls.flatMap((key, lane) => key.attrs["data-cue-phase"] && key.attrs["data-cue-phase"] !== "none"
      ? [[lane, key.attrs["data-cue-phase"]]] : []),
    render(seconds) { setClock(seconds); c.renderBoard(seconds); },
    guidance(seconds, visualLead = c.getVisualFallLeadSeconds()) { c.renderKeyGuidance(seconds, visualLead); },
    advanceWall(seconds) { now += seconds * 1000; },
    advancePreparation(seconds) {
      c.animationLoop();
      const remaining = c.resumePreparation ? Math.max(0, c.resumePreparation.duration - (now - c.resumePreparation.startedAt) / 1000) : 0;
      const duration = Math.min(seconds, remaining), start = now, count = Math.max(1, Math.ceil(duration / .02));
      for (let index = 0; index < count; index++) { now = start + duration * 1000 * (index + 1) / count; c.animationLoop(); }
    },
    frame(seconds) { setClock(seconds); c.animationLoop(); },
    async flushAudio() { await Promise.all(pendingNotes); },
    replaceEvents(next) { c.songEvents = next; c.noteEls = new Map(next.map(event => [event.id, element()])); }
  };
}

function expectPhase(h, lane, phase, { held = phase === "active-fill", secondary = false, repeat = false } = {}) {
  assert.equal(h.phase(lane), phase, `lane ${lane}`);
  assert.equal(h.c.keyEls[lane].attrs["data-cue-held"], String(held));
  assert.equal(h.has(lane, "cue-active"), phase === "active-fill");
  assert.equal(h.has(lane, "cue-preview"), phase === "preview-outline");
  assert.equal(h.has(lane, "cue-edge"), phase === "secondary-edge");
  assert.equal(h.has(lane, "cue-dark"), phase === "pre-onset-dark");
  assert.equal(h.has(lane, "cue-secondary"), secondary);
  assert.equal(h.has(lane, "cue-repeat"), repeat && phase !== "pre-onset-dark");
}

for (const speed of [.35, 1, 1.4]) {
  test(`production renderer has exact preview, dark, onset and duration boundaries at ${speed}x`, () => {
    const h = harness([note("a", 2, 1)], { speed });
    const bs = 1 / speed, onset = 2 * bs, end = 3 * bs;
    const preview = Math.min(h.c.getVisualFallLeadSeconds(), Math.max(.45, Math.min(1.2, bs)));
    h.render(onset - preview - EPSILON); expectPhase(h, 2, "none");
    // Subtraction at .35x can round the difference one ULP above preview.
    h.render(onset - preview + EPSILON); expectPhase(h, 2, "preview-outline");
    h.render(onset - .06 - EPSILON); expectPhase(h, 2, "preview-outline");
    h.render(onset - .06); expectPhase(h, 2, "pre-onset-dark");
    h.render(onset - EPSILON); expectPhase(h, 2, "pre-onset-dark");
    h.render(onset); expectPhase(h, 2, "active-fill");
    h.render(onset + .37); expectPhase(h, 2, "active-fill");
    h.render(end - EPSILON); expectPhase(h, 2, "active-fill");
    h.render(end); expectPhase(h, 2, "none");
    assert.equal(h.c.renderKeyGuidance.state.dark.size, 0);
  });

  test(`dense same-key dark interval respects min(60ms, previous IOI * 20%) at ${speed}x`, () => {
    const h = harness([note("first", 0, .25), note("repeat", .125, .25)], { speed });
    const bs = 1 / speed, onset = .125 * bs, darkLead = Math.min(.06, onset * .2);
    h.render(0); expectPhase(h, 2, "active-fill", { repeat: true });
    h.render(onset - darkLead - EPSILON); expectPhase(h, 2, "active-fill", { repeat: true });
    h.render(onset - darkLead); expectPhase(h, 2, "pre-onset-dark", { held: true });
    h.render(onset - EPSILON); expectPhase(h, 2, "pre-onset-dark", { held: true });
    h.render(onset); expectPhase(h, 2, "active-fill");
    assert.ok(darkLead <= .06 && darkLead <= onset * .2);
  });
}

test("without a hold next is an outline, second is an edge, and third stays absent", () => {
  const h = harness([note("a", 1, .5, [1]), note("b", 1.2, .5, [2]), note("c", 1.3, .5, [3])]);
  h.render(.4);
  expectPhase(h, 1, "preview-outline");
  expectPhase(h, 2, "secondary-edge", { secondary: true });
  expectPhase(h, 3, "none");
  h.render(1);
  expectPhase(h, 1, "active-fill");
  expectPhase(h, 2, "preview-outline", { secondary: true });
  expectPhase(h, 3, "none");
});

test("rest preview checks each future onset independently and leaves long/ending rests empty", () => {
  const h = harness([note("a", 0, 1, [1]), note("b", 5, .25, [2]), note("c", 5.8, .25, [3])], { totalBeats: 9 });
  h.render(0); expectPhase(h, 1, "active-fill");
  for (const time of [1, 2, 3, 4 - EPSILON]) { h.render(time); assert.deepEqual(h.phases(), []); }
  h.render(4); expectPhase(h, 2, "preview-outline"); expectPhase(h, 3, "none");
  h.render(4.8 + EPSILON); expectPhase(h, 2, "preview-outline"); expectPhase(h, 3, "secondary-edge", { secondary: true });
  h.render(5); expectPhase(h, 2, "active-fill"); expectPhase(h, 3, "preview-outline", { secondary: true });
  h.render(5.8); expectPhase(h, 3, "active-fill");
  for (const time of [6.05, 7, 9, 9.9]) { h.render(time); assert.deepEqual(h.phases(), []); }
});

test("preview remains bounded by the board's visual window", () => {
  const h = harness([note("a", 1)], { lead: .25 });
  h.render(.75 - EPSILON); expectPhase(h, 2, "none");
  h.render(.75); expectPhase(h, 2, "preview-outline");
});

test("every overlapping hold stays filled to its own end and only first future onset is outlined", () => {
  const h = harness([note("a", 0, 4, [1]), note("b", 1, 2, [2]), note("c", 2, .25, [3]), note("d", 2.1, .25, [4])]);
  h.render(0); h.render(1); h.render(1.5);
  expectPhase(h, 1, "active-fill"); expectPhase(h, 2, "active-fill");
  expectPhase(h, 3, "preview-outline", { secondary: true }); expectPhase(h, 4, "none");
  h.render(2); h.render(2.1); h.render(2.4);
  expectPhase(h, 1, "active-fill"); expectPhase(h, 2, "active-fill");
  expectPhase(h, 3, "none"); expectPhase(h, 4, "none");
  h.render(3); expectPhase(h, 1, "active-fill"); expectPhase(h, 2, "none");
  h.render(4); assert.deepEqual(h.phases(), []);
});

test("past overlaps and simultaneous duplicate lanes do not announce a pending repeated strike", () => {
  const h = harness([note("a", 0, 3), note("simultaneous", 0, 2), note("overlap", 1, 2)]);
  h.render(-.5); expectPhase(h, 2, "preview-outline");
  h.render(0); expectPhase(h, 2, "active-fill", { repeat: true });
  h.render(1); expectPhase(h, 2, "active-fill");
  h.render(1.5); expectPhase(h, 2, "active-fill");
  h.render(2); expectPhase(h, 2, "active-fill");
  h.render(3); expectPhase(h, 2, "none");
});

test("non-judged accompaniment cannot add a key cue or shorten a judged note's dark interval", () => {
  const support = note("support", .99, 2, [7]);
  support.judgeLanes = []; support.notes[0].judge = false;
  const h = harness([note("a", 0, .5, [1]), support, note("b", 1, .5, [2])]);
  h.render(0); expectPhase(h, 1, "active-fill"); expectPhase(h, 7, "none");
  h.render(.94); expectPhase(h, 2, "pre-onset-dark"); expectPhase(h, 7, "none");
  h.render(1); expectPhase(h, 2, "active-fill"); expectPhase(h, 7, "none");
});

test("a real same-key reattack darkens only its own previous hold, then restores fill", () => {
  const h = harness([note("held", 0, 2, [1, 2]), note("repeat", 1, .5, [1])]);
  h.render(0); h.render(.9);
  expectPhase(h, 1, "active-fill", { repeat: true }); expectPhase(h, 2, "active-fill");
  h.render(.94); expectPhase(h, 1, "pre-onset-dark", { held: true }); expectPhase(h, 2, "active-fill");
  h.render(1); expectPhase(h, 1, "active-fill"); expectPhase(h, 2, "active-fill");
  h.render(1.5); expectPhase(h, 1, "active-fill"); expectPhase(h, 2, "active-fill");
  h.render(2); assert.deepEqual(h.phases(), []);
});

test("one merged tie remains one stable hold across internal beats and never gets a second dark pulse", async () => {
  const h = harness([note("tie", 0, 8, [4])], { mode: "demo" });
  for (const time of [0, .37, .95, 1, 1.95, 2, 3.95, 4, 7.95, 8 - EPSILON]) {
    h.render(time); await h.flushAudio();
    expectPhase(h, 4, "active-fill");
    assert.equal(h.c.renderKeyGuidance.state.dark.size, 0);
  }
  assert.equal(h.calls.length, 1); assert.equal(h.samples.length, 1);
  h.render(8); expectPhase(h, 4, "none");
});

test("a skipped frame cannot replay the previous event's dark interval", () => {
  const h = harness([note("a", 1, .0625, [1]), note("b", 1.0625, .0625, [2]), note("c", 1.125, .25, [3])]);
  h.render(.939); expectPhase(h, 1, "preview-outline");
  h.render(1.08);
  expectPhase(h, 1, "none"); expectPhase(h, 2, "active-fill");
  expectPhase(h, 3, "preview-outline", { secondary: true });
  assert.equal(h.c.renderKeyGuidance.state.dark.size, 0);
  h.render(1.125); expectPhase(h, 3, "active-fill");
  assert.equal(h.c.practiceRunning, true);
});

for (const speed of [.35, 1.4]) {
  for (const compact of [false, true]) {
    test(`same render aligns note bottom, key fill and real audio dispatch at ${speed}x (${compact ? "compact" : "desktop"})`, async () => {
      const event = note("onset", 2, 1, [3, 9]);
      const h = harness([event], { speed, compact, mode: "demo" });
      const onset = 2 / speed;
      h.render(onset - .061); assert.equal(h.calls.length, 0); expectPhase(h, 3, "preview-outline");
      h.render(onset - .03); assert.equal(h.calls.length, 0); expectPhase(h, 3, "pre-onset-dark");
      assert.ok(h.bottom(event.id) < h.c.boardTop.clientHeight - 10);
      h.render(onset);
      assert.equal(h.calls.length, 2);
      assert.equal(h.c.noteEls.get(event.id).classList.contains("visible"), true);
      near(h.bottom(event.id), h.c.boardTop.clientHeight - 10, "note bottom at judgement line");
      for (const [index, lane] of [3, 9].entries()) {
        expectPhase(h, lane, "active-fill");
        const call = h.calls[index];
        assert.equal(call.name, `test-note-${lane}`); assert.equal(call.eventId, event.id);
        assert.equal(call.phase, "active-fill", "key was filled before this exact audio dispatch");
        near(call.bottom, h.c.boardTop.clientHeight - 10, "same-render note geometry");
        near(call.seconds, onset, "same transport seconds");
        near((call.timing.expiresAt - h.c.practiceStartAt) / 1000 - .15, onset, "nominal audio onset");
        near(call.duration, Math.max(.24, .9 / speed), "unchanged audio duration contract");
        assert.equal(call.velocity, .8);
      }
      await h.flushAudio();
      assert.deepEqual(h.samples.map(sample => sample.name), ["test-note-3", "test-note-9"]);
      for (const sample of h.samples) near(sample.time, h.c.audioContext.currentTime, "WebAudio dispatch time");
      h.render(onset + .01); await h.flushAudio(); assert.equal(h.calls.length, 2, "layout rerender does not retrigger");
    });
  }
}

test("a closed loop includes A, excludes B, clips holds at B and clears before the next round", async () => {
  const events = [note("before", 1.99, 4, [1]), note("A", 2, .5, [2]), note("held", 3, 5, [3]), note("B", 4, 1, [4])];
  const h = harness(events, { mode: "demo", range: { startBeat: 2, endBeat: 4 } });
  h.render(1.94); expectPhase(h, 1, "none"); expectPhase(h, 2, "pre-onset-dark");
  h.render(2); await h.flushAudio(); expectPhase(h, 2, "active-fill");
  h.render(3); await h.flushAudio(); expectPhase(h, 3, "active-fill");
  h.render(4 - EPSILON); expectPhase(h, 3, "active-fill"); expectPhase(h, 4, "none");
  h.render(4); assert.deepEqual(h.phases(), []);
  assert.deepEqual(h.calls.map(call => call.eventId), ["A", "held"]);
  h.frame(4); assert.ok(h.c.currentPracticeTime() < 2); assert.deepEqual(h.phases(), []);
  assert.equal(h.c.renderKeyGuidance.state.dark.size, 0);
  h.render(1.94); expectPhase(h, 2, "pre-onset-dark");
  h.render(2); await h.flushAudio(); expectPhase(h, 2, "active-fill");
  assert.deepEqual(h.calls.map(call => call.eventId), ["A", "held", "A"]);
});

test("a loop's initial rest stays blank until the real in-range note's own preview", () => {
  const h = harness([note("outside", 1, 10, [1]), note("first", 4, .5, [2]), note("B", 6, 1, [3])],
    { range: { startBeat: 2, endBeat: 6 } });
  for (const time of [1.9, 2, 2.99]) { h.render(time); assert.deepEqual(h.phases(), []); }
  h.render(3); expectPhase(h, 2, "preview-outline"); expectPhase(h, 1, "none");
  h.render(4); expectPhase(h, 2, "active-fill");
  h.render(4.5); assert.deepEqual(h.phases(), []);
  h.render(6 - EPSILON); expectPhase(h, 3, "none");
});

test("backward time resets a dark display latch for a new pass", () => {
  const h = harness([note("a", 1)]);
  h.render(.95); expectPhase(h, 2, "pre-onset-dark");
  const old = h.c.renderKeyGuidance.state;
  h.render(.8); expectPhase(h, 2, "preview-outline");
  assert.notEqual(h.c.renderKeyGuidance.state, old); assert.equal(h.c.renderKeyGuidance.state.dark.size, 0);
  h.render(.95); expectPhase(h, 2, "pre-onset-dark");
});

test("a replacement songEvents reference clears dark history even with identical event ids and beats", () => {
  const h = harness([note("a", 1)]);
  h.render(.95); expectPhase(h, 2, "pre-onset-dark"); h.c.pausePractice();
  const old = h.c.renderKeyGuidance.state;
  h.replaceEvents([note("a", 1)]);
  h.render(.95); expectPhase(h, 2, "preview-outline");
  assert.notEqual(h.c.renderKeyGuidance.state, old); assert.equal(h.c.renderKeyGuidance.state.dark.size, 0);
});

test("changing a loop's values resets history even when its range object identity is unchanged", () => {
  const h = harness([note("a", 1), note("b", 2, 1, [3])], { range: { startBeat: 0, endBeat: 4 } });
  h.render(.95); expectPhase(h, 2, "pre-onset-dark"); h.c.pausePractice();
  const range = h.c.practiceLoopRange, old = h.c.renderKeyGuidance.state;
  range.endBeat = 3;
  h.render(.95); expectPhase(h, 2, "preview-outline");
  assert.equal(h.c.practiceLoopRange, range); assert.notEqual(h.c.renderKeyGuidance.state, old);
  range.startBeat = 2;
  h.render(.95); expectPhase(h, 2, "none");
});

test("drag seeking drops old darkness and cannot introduce a first black cue while held", () => {
  const h = harness([note("a", 1)]);
  h.render(.95); expectPhase(h, 2, "pre-onset-dark");
  h.c.seekingWithProgress = true;
  h.c.seekToSongTime(.96);
  expectPhase(h, 2, "preview-outline"); assert.equal(h.c.renderKeyGuidance.state.dark.size, 0);
  h.c.seekToSongTime(.98);
  expectPhase(h, 2, "preview-outline"); assert.equal(h.c.renderKeyGuidance.state.dark.size, 0);
  h.c.seekingWithProgress = false;
  h.render(1); expectPhase(h, 2, "active-fill");
});

test("Pause and Continue preparation freeze an observed dark interval until its original onset", async () => {
  const h = harness([note("a", 1)], { mode: "demo" });
  h.render(.95); expectPhase(h, 2, "pre-onset-dark"); h.c.pausePractice();
  const frozen = h.c.currentPracticeTime();
  h.advanceWall(30); h.c.renderBoard(h.c.currentPracticeTime());
  near(h.c.currentPracticeTime(), frozen); expectPhase(h, 2, "pre-onset-dark"); assert.equal(h.calls.length, 0);
  await h.c.continuePractice();
  assert.ok(h.c.resumePreparation); expectPhase(h, 2, "pre-onset-dark");
  h.advancePreparation(h.c.resumePreparation.duration / 2); h.c.animationLoop();
  near(h.c.currentPracticeTime(), frozen); expectPhase(h, 2, "pre-onset-dark"); assert.equal(h.calls.length, 0);
  h.advancePreparation(h.c.resumePreparation.duration); h.c.animationLoop();
  assert.equal(h.c.resumePreparation, null); expectPhase(h, 2, "pre-onset-dark");
  h.render(1); await h.flushAudio(); expectPhase(h, 2, "active-fill"); assert.equal(h.calls.length, 1);
});

for (const speed of [.35, 1.4]) {
  for (const startBeat of [0, 4]) {
    for (const dark of [false, true]) {
      test(`interrupted ${startBeat ? "A-loop" : "initial"} count-in freezes ${dark ? "darkness" : "outline"} through Continue at ${speed}x`, async () => {
        const range = startBeat ? { startBeat, endBeat: startBeat + 4 } : null;
        const event = note("first", startBeat, 2);
        const h = harness([event], { speed, range, mode: "demo" });
        const onset = startBeat / speed;
        const preview = Math.min(h.c.getVisualFallLeadSeconds(), Math.max(.45, Math.min(1.2, 1 / speed)));
        // This second event is outside the original cue window, but would enter
        // if Continue incorrectly moved an already-visible preview to half H.
        if (!dark) h.replaceEvents([event, note("next", startBeat + .4 * preview * speed, 1, [3])]);
        const phase = dark ? "pre-onset-dark" : "preview-outline";
        h.render(onset - (dark ? .03 : .75 * preview)); expectPhase(h, 2, phase);
        if (!dark) expectPhase(h, 3, "none");
        const frozenBeat = h.c.renderKeyGuidance.state.beat;
        const frozenPhases = h.phases();
        h.c.pausePractice();
        near(h.c.pausedSession.seconds, onset, "Continue clamps only its restart target to A");
        expectPhase(h, 2, phase);
        h.advanceWall(10); await h.c.continuePractice();
        assert.ok(h.c.resumePreparation); expectPhase(h, 2, phase);
        near(h.c.renderKeyGuidance.state.beat, frozenBeat, "an already visible cue must freeze at its exact beat");
        assert.deepEqual(h.phases(), frozenPhases, "Continue must not introduce another future cue");
        assert.equal(h.calls.length, 0);
        h.advancePreparation(h.c.resumePreparation.duration / 2); h.c.animationLoop();
        expectPhase(h, 2, phase); assert.equal(h.calls.length, 0);
        near(h.c.renderKeyGuidance.state.beat, frozenBeat);
        assert.deepEqual(h.phases(), frozenPhases);
        h.advancePreparation(h.c.resumePreparation.duration); h.c.animationLoop();
        assert.equal(h.c.resumePreparation, null);
        // Clock conversion may land one ULP before A (notably 4 / .35).
        // Never demand an early attack; then render the exact nominal boundary.
        if (h.c.currentPracticeTime() < onset) {
          assert.equal(h.calls.length, 0); expectPhase(h, 2, "pre-onset-dark");
          h.render(onset);
        }
        expectPhase(h, 2, "active-fill");
        near(h.c.currentPracticeTime(), onset); near(h.bottom(event.id), h.c.boardTop.clientHeight - 10);
        await h.flushAudio(); assert.equal(h.calls.length, 1); assert.equal(h.samples.length, 1);
        assert.equal(h.calls[0].phase, "active-fill"); near(h.calls[0].seconds, onset);
      });
    }
  }
}

for (const speed of [.35, 1.4]) {
  for (const startBeat of [0, 4]) {
    test(`changing speed to ${speed}x during interrupted ${startBeat ? "A-loop" : "initial"} preparation keeps an outline through another Continue`, async () => {
      const range = startBeat ? { startBeat, endBeat: startBeat + 4 } : null;
      const h = harness([note("first", startBeat, 2)], { range, mode: "demo" });
      h.render(startBeat - .5); expectPhase(h, 2, "preview-outline");
      const initialCueBeat = h.c.renderKeyGuidance.state.beat;
      h.c.pausePractice(); await h.c.continuePractice();
      assert.ok(h.c.resumePreparation); expectPhase(h, 2, "preview-outline");
      near(h.c.renderKeyGuidance.state.beat, initialCueBeat);
      h.advancePreparation(h.c.resumePreparation.duration / 2); h.c.animationLoop();
      near(h.c.renderKeyGuidance.state.beat, initialCueBeat);
      h.c.speedSlider.value = String(speed); h.c.applySpeed({ persist: false });
      assert.equal(h.c.resumePreparation, null);
      assert.equal(h.c.demoMode, false); assert.equal(h.c.practiceRunning, false);
      near(h.c.pausedSession.seconds, startBeat / speed);
      expectPhase(h, 2, "preview-outline");
      const scaledBeat = h.c.getScaledBeatSeconds();
      const preview = Math.min(h.c.getVisualFallLeadSeconds(), Math.max(.45, Math.min(1.2, scaledBeat)));
      const speedCueBeat = h.c.renderKeyGuidance.state.beat;
      if ((startBeat - initialCueBeat) * scaledBeat <= preview) {
        near(speedCueBeat, initialCueBeat, "speed keeps an in-window cue frozen");
      } else {
        assert.ok(speedCueBeat > initialCueBeat && speedCueBeat < startBeat,
          "only a cue now outside the whole window may move into preview");
      }
      assert.equal(h.calls.length, 0); assert.equal(h.c.songEvents[0].demoPlayed, false);
      h.advanceWall(20); h.c.renderBoard(h.c.currentPracticeTime());
      expectPhase(h, 2, "preview-outline"); assert.equal(h.calls.length, 0);
      await h.c.continuePractice();
      assert.ok(h.c.resumePreparation); expectPhase(h, 2, "preview-outline");
      near(h.c.renderKeyGuidance.state.beat, speedCueBeat, "second Continue keeps the exact visible beat");
      h.advancePreparation(h.c.resumePreparation.duration / 2); h.c.animationLoop();
      expectPhase(h, 2, "preview-outline"); assert.equal(h.calls.length, 0);
      near(h.c.renderKeyGuidance.state.beat, speedCueBeat);
      h.advancePreparation(h.c.resumePreparation.duration); h.c.animationLoop();
      assert.equal(h.c.resumePreparation, null);
      const onset = startBeat / speed;
      if (h.c.currentPracticeTime() < onset) { assert.equal(h.calls.length, 0); h.render(onset); }
      expectPhase(h, 2, "active-fill"); assert.equal(h.c.renderKeyGuidance.state.awaitingStart, null);
      near(h.bottom("first"), h.c.boardTop.clientHeight - 10);
      await h.flushAudio(); assert.equal(h.calls.length, 1); assert.equal(h.samples.length, 1);
      assert.equal(h.calls[0].phase, "active-fill"); near(h.calls[0].seconds, onset);
    });

    test(`far ${startBeat ? "A-loop" : "initial"} countdown resumes with a visible steady preview at ${speed}x`, async () => {
      const range = startBeat ? { startBeat, endBeat: startBeat + 4 } : null;
      const h = harness([note("first", startBeat, 2)], { range, speed, mode: "demo" });
      const onset = startBeat / speed;
      h.render(onset - 3); expectPhase(h, 2, "none");
      h.c.pausePractice(); expectPhase(h, 2, "none");
      await h.c.continuePractice();
      assert.ok(h.c.resumePreparation); expectPhase(h, 2, "preview-outline");
      const cueBeat = h.c.renderKeyGuidance.state.beat;
      assert.ok(cueBeat < startBeat && cueBeat > (onset - 3) * speed);
      assert.equal(h.calls.length, 0); assert.equal(h.c.renderKeyGuidance.state.dark.size, 0);
      h.advancePreparation(h.c.resumePreparation.duration / 2); h.c.animationLoop();
      expectPhase(h, 2, "preview-outline"); near(h.c.renderKeyGuidance.state.beat, cueBeat);
      assert.equal(h.calls.length, 0);
      h.advancePreparation(h.c.resumePreparation.duration); h.c.animationLoop();
      assert.equal(h.c.resumePreparation, null);
      if (h.c.currentPracticeTime() < onset) { assert.equal(h.calls.length, 0); h.render(onset); }
      expectPhase(h, 2, "active-fill"); assert.equal(h.c.renderKeyGuidance.state.awaitingStart, null);
      await h.flushAudio(); assert.equal(h.calls.length, 1); assert.equal(h.samples.length, 1);
    });
  }
}

test("Continue from inside a genuine long hold preserves fill without replaying the attack", async () => {
  const h = harness([note("held", 0, 8)], { mode: "demo" });
  h.render(0); await h.flushAudio(); h.render(2.5); expectPhase(h, 2, "active-fill");
  h.c.pausePractice(); h.advanceWall(15); await h.c.continuePractice();
  expectPhase(h, 2, "active-fill"); assert.equal(h.calls.length, 1);
  h.advancePreparation(h.c.resumePreparation.duration / 2); h.c.animationLoop();
  expectPhase(h, 2, "active-fill"); assert.equal(h.calls.length, 1);
  h.advancePreparation(h.c.resumePreparation.duration); h.c.animationLoop();
  expectPhase(h, 2, "active-fill"); assert.equal(h.calls.length, 1);
  h.render(8 - EPSILON); expectPhase(h, 2, "active-fill");
  h.render(8); expectPhase(h, 2, "none"); await h.flushAudio(); assert.equal(h.calls.length, 1);
});

test("paused seek into a fresh pre-onset interval uses a steady target, including Continue countdown", async () => {
  const h = harness([note("a", 1)], { mode: "paused" });
  h.c.pausedSession = { mode: "practice", seconds: .2 };
  h.c.seekToSongTime(.96); expectPhase(h, 2, "preview-outline");
  h.advanceWall(20); h.c.renderBoard(h.c.currentPracticeTime()); expectPhase(h, 2, "preview-outline");
  await h.c.continuePractice(); expectPhase(h, 2, "preview-outline");
  h.advancePreparation(h.c.resumePreparation.duration / 2); h.c.animationLoop(); expectPhase(h, 2, "preview-outline");
  h.advancePreparation(h.c.resumePreparation.duration); h.c.animationLoop(); expectPhase(h, 2, "pre-onset-dark");
  h.render(1); expectPhase(h, 2, "active-fill");
});

test("speed changes preserve the same target's dark latch until onset without touching audio flags", () => {
  const h = harness([note("a", 1, 1)]);
  h.render(.95); expectPhase(h, 2, "pre-onset-dark");
  const state = h.c.renderKeyGuidance.state;
  for (const speed of [.35, 1.4, .35, 1]) {
    h.c.speedSlider.value = String(speed); h.c.applySpeed({ persist: false });
    near(h.c.currentPracticeTime() / h.c.getScaledBeatSeconds(), .95, "musical beat retained");
    expectPhase(h, 2, "pre-onset-dark"); assert.equal(h.c.renderKeyGuidance.state, state);
    assert.equal(h.c.songEvents[0].demoPlayed, false); assert.equal(h.calls.length, 0);
  }
  h.render(1); expectPhase(h, 2, "active-fill"); assert.equal(state.dark.size, 0);
  h.render(1.5); expectPhase(h, 2, "active-fill");
});

test("paused speed changes keep observed darkness while a fresh paused target stays outlined", () => {
  for (const observed of [false, true]) {
    const h = harness([note("a", 1)], { mode: observed ? "practice" : "paused" });
    h.render(.95); if (observed) h.c.pausePractice();
    for (const speed of [.35, 1.4]) {
      h.c.speedSlider.value = String(speed); h.c.applySpeed({ persist: false });
      expectPhase(h, 2, observed ? "pre-onset-dark" : "preview-outline");
    }
  }
});

test("guidance display alone never mutates events or demo/accompaniment dispatch state", () => {
  const events = [note("a", 1)];
  Object.freeze(events[0].notes); Object.freeze(events[0].judgeLanes); Object.freeze(events[0]); Object.freeze(events);
  const h = harness(events);
  const before = JSON.stringify(events);
  for (const seconds of [.5, .95, 1, 1.4, 1.5, .5]) h.guidance(seconds);
  assert.equal(JSON.stringify(events), before);
  assert.equal(h.calls.length, 0); assert.equal(h.samples.length, 0);
  assert.equal(h.c.practiceRunning, true); assert.equal(h.c.demoMode, false);
});

test("heard touch mark survives guidance changes and full board redraw until its ordinary input expiry", () => {
  const h = harness([note("a", 1, 1)]);
  h.render(.95); h.c.setActiveKeyInput("test-note-2", 2); h.c.renderBoard(h.c.currentPracticeTime());
  expectPhase(h, 2, "pre-onset-dark"); assert.equal(h.has(2, "heard"), true);
  h.render(1); expectPhase(h, 2, "active-fill"); assert.equal(h.has(2, "heard"), true);
  h.c.clearHighlights(); assert.equal(h.has(2, "heard"), false); expectPhase(h, 2, "active-fill");
  h.c.renderBoard(h.c.currentPracticeTime()); assert.equal(h.has(2, "heard"), true);
  h.guidance(2); expectPhase(h, 2, "none"); assert.equal(h.has(2, "heard"), true, "cue clearing does not clear input feedback");
  h.render(1.14); expectPhase(h, 2, "active-fill"); assert.equal(h.has(2, "heard"), false);
});

// Parse nested CSS rule bodies to inspect the production declarations without
// matching comments. This is a static no-animation contract, not a browser
// screenshot, a luminance measurement, or a claim about physical perception.
function cssRules(text, contexts = []) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let cursor = 0;
  while (cursor < clean.length) {
    const open = clean.indexOf("{", cursor);
    if (open < 0) break;
    const selector = clean.slice(cursor, open).trim();
    let depth = 1, end = open + 1;
    for (; end < clean.length && depth; end++) {
      if (clean[end] === "{") depth++;
      if (clean[end] === "}") depth--;
    }
    assert.equal(depth, 0, "CSS braces must be balanced");
    const body = clean.slice(open + 1, end - 1);
    if (selector.startsWith("@")) rules.push(...cssRules(body, [...contexts, selector]));
    else rules.push({ selector, contexts, declarations: Object.fromEntries(body.split(";").filter(value => value.includes(":"))
      .map(value => { const colon = value.indexOf(":"); return [value.slice(0, colon).trim(), value.slice(colon + 1).trim()]; })) });
    cursor = end;
  }
  return rules;
}
const rules = cssRules(cssSource);
const namedRules = selector => rules.filter(rule => rule.selector.split(",").map(value => value.trim()).includes(selector));
const finalDeclarations = selector => Object.assign({}, ...namedRules(selector).filter(rule => !rule.contexts.length).map(rule => rule.declarations));

test("CSS leaves preview interiors unchanged, uses distinct held fill and a separate green touch mark", () => {
  const preview = finalDeclarations(".key.cue-preview::before");
  assert.equal(preview.opacity, "1");
  const secondary = finalDeclarations(".key.cue-preview.cue-secondary::before");
  assert.ok(Number(secondary.opacity) > 0 && Number(secondary.opacity) < 1);
  const edge = finalDeclarations(".key.cue-edge::before");
  assert.ok(Number(edge.opacity) > 0 && Number(edge.opacity) < 1);
  assert.ok(finalDeclarations(".key.cue-active").background, "held state has a filled key face");
  for (const rule of rules.filter(rule => /\.cue-(preview|edge|dark)\b/.test(rule.selector))) {
    assert.equal(rule.declarations.background, undefined, `${rule.selector} must not brighten the interior`);
    assert.equal(rule.declarations["background-color"], undefined);
  }
  assert.equal(finalDeclarations(".key.cue-dark::before").opacity, "0");
  assert.equal(finalDeclarations(".key.cue-dark::after").opacity, "0");
  const heard = finalDeclarations(".key.heard");
  assert.equal(heard.background, undefined); assert.equal(heard["background-color"], undefined);
  assert.match(heard["box-shadow"], /#428d60/i);
  assert.equal(finalDeclarations(".key.expected").background, undefined, "old judgement highlight cannot override cues");
});

test("cue brightness is not animated or interpolated and reduced motion removes key transforms", () => {
  const cueRules = rules.filter(rule => /\.key(?:\b|[.:])/.test(rule.selector));
  for (const rule of cueRules) {
    const decl = rule.declarations;
    assert.ok(!decl.animation || decl.animation === "none", `${rule.selector} has no key animation`);
    assert.ok(!decl["animation-name"] || decl["animation-name"] === "none");
    assert.ok(!decl.filter || !/brightness\(/.test(decl.filter), `${rule.selector} has no dynamic brightness`);
    if (/\.cue-/.test(rule.selector) || rule.selector.includes("::")) {
      assert.ok(!decl.transition || decl.transition === "none", `${rule.selector} changes cue state instantly`);
    }
  }
  const normal = finalDeclarations(".key");
  assert.ok(normal.transition === "none" || /^(?:transform)\s/.test(normal.transition));
  assert.doesNotMatch(normal.transition, /all|background|opacity|filter|box-shadow|border/);
  const reduced = namedRules(".key").filter(rule => rule.contexts.some(context => /prefers-reduced-motion:\s*reduce/.test(context)));
  assert.ok(reduced.length); assert.equal(reduced.at(-1).declarations.transition, "none");
});
