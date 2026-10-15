import { createPracticeFullscreen } from "../src/practice-fullscreen.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { isBeatInLoop } from "../src/practice-loop.js";

// Optional untouched source makes the negative regression independently
// reproducible. Normal runs read the current app and need no private fixtures.
const source = await readFile(process.env.KALIMBA_NAVIGATION_APP_SOURCE || new URL("../src/app.js", import.meta.url), "utf8");
const functionNames = [
  "beginPassPreparation",
  "startPracticeFromGesture", "playDemoFromGesture", "getFullscreenPlaybackState",
  "openSongLibrary", "ensureAudioContext", "preparePracticeAudio", "requestFullscreenMode",
  "startPractice", "playDemo", "continuePractice", "pausePractice", "resetPracticeState",
  "cancelPracticeContinuation", "clearPracticeInteractions", "preservePastAttacks",
  "currentPracticeTime", "shouldLoop", "updatePauseControl", "startLoop", "animationLoop",
  "admitPracticeFrame", "silenceKalimbaAudio", "getPracticeNoteTiming", "isPracticeNoteCurrent",
  "playKalimbaSample", "playKalimbaNote", "handleAudioContextStateChange", "setupKeyScaleGesture"
];
const runtime = functionNames.map(name => {
  const match = source.match(new RegExp(`^    (?:async )?function ${name}\\([^]*?^    \\}`, "m"));
  assert.ok(match, `Missing production function ${name}`);
  return match[0];
}).join("\n");
const constants = ["practiceOnsetStaleSeconds", "practiceAudioReadyTimeoutMs"].map(name => {
  const match = source.match(new RegExp(`^    const ${name} = [^;]+;`, "m"));
  assert.ok(match, `Missing production constant ${name}`);
  return match[0];
}).join("\n");
const navigationBinding = source.match(/^    if \(changeSongBtn\) \{\n[^]*?^    \}/m);
assert.ok(navigationBinding, "Missing Change Song button binding");

function element() {
  const classes = new Set();
  const listeners = new Map();
  let captured = null;
  return {
    textContent: "", title: "", disabled: false,
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name)
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
    click: () => listeners.get("click")(),
    setPointerCapture: id => { captured = id; },
    hasPointerCapture: id => captured === id,
    releasePointerCapture: id => { assert.equal(captured, id); captured = null; }
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

// Browser APIs, rendering endpoints and audio nodes are controlled substitutes.
// Navigation deliberately emits neither pagehide nor visibilitychange. These
// are production control/continuation tests, not browser or audible playback QA.
function harness({ navigation = "pending" } = {}) {
  let now = 10000, frameId = 0, timerId = 0;
  const frames = new Map(), timers = new Map(), lifecycle = new Map();
  const navigationAttempts = [], renders = [], backing = [], sounds = [];
  const navigationError = new Error("Controlled navigation failure");
  const c = {
    console: { error() {}, warn() {} }, APP_NAME: "Test", Math, Set, isBeatInLoop,
    window: { location: {}, addEventListener: (name, callback) => lifecycle.set(`window:${name}`, callback) },
    document: { hidden: false, fullscreenElement: null, documentElement: {},
      addEventListener: (name, callback) => lifecycle.set(`document:${name}`, callback) },
    ResizeObserver: class { observe() {} }, boardTop: {}, persistKeyWidth() {},
    practiceRunning: false, demoMode: false, playbackRequestId: 0, pendingPlayback: null,
    pausedSession: null, resumePreparation: null, passPreparation: null, preparationRetryUsed: false, practiceStartAt: 0, lastPracticeFrameSeconds: null,
    pausedElapsed: 3.25, rafId: 0, practiceLoopRange: { startBeat: 4, endBeat: 10 }, speedFactor: .55,
    songEvents: [{ beat: 5, demoPlayed: true }, { beat: 8, demoPlayed: false }],
    accompanimentEvents: [{ beat: 5, played: true }, { beat: 8, played: false }],
    accompanimentEnabled: true, signalPeakUntil: 0, activeInputUntil: 0,
    seekingWithProgress: false, progressSeekAtStart: false, preferredPlaybackMode: "practice", fullscreenControl: null, loopDragEdge: null, loopDragPointerId: null, loopDragRect: null,
    loopDragWasPlaying: false, loopDragWasDemo: false, progressSeekPointerId: null, progressSeekRect: null,
    activeDetection: { lane: null, candidateLane: null },
    audioContext: { state: "running", currentTime: 10 },
    currentSongId: "test song/&?", currentSong: { id: "test song/&?" }, browserPreferenceStorage: {},
    notePlaybackGeneration: 0, activeKalimbaVoices: new Set(), retiredKalimbaOutputs: new Set(),
    kalimbaBus: null, kalimbaDry: null, kalimbaWet: null, kalimbaReverb: null, kalimbaOutput: null, kalimbaOutputNodes: [],
    preloadKalimbaSamples: async () => [], ensureKalimbaOutput() {}, shouldUseLandscapeFullscreen: () => false,
    getScaledBeatSeconds: () => .5, getSessionLeadSeconds: () => 2, getSongEndSeconds: () => 100,
    getEventTime: event => event.beat * .5, getAccompanimentTime: event => event.beat * .5,
    recordPractice: () => ({}), getSongBaseId: song => song.id, showKeyWidthStatus() {},
    resetSongEvents() {}, syncSongEventsForSeek() {}, syncAccompanimentEventsForSeek() {},
    renderBoard: seconds => renders.push(seconds), renderSongProgress() {},
    playAccompanimentEvents: seconds => backing.push(seconds),
    prepareLoopStart() { throw new Error("Unexpected loop turnover in navigation probe"); },
    resetDetectionReadout() {}, clearHighlights() {}, setActiveBeamLane() {}, setCompactIcon() {},
    setStatus: text => { c.status = text; },
    loadKalimbaSampleBuffer: async () => ({ duration: 1 }),
    playDecodedKalimbaSample: (name, buffer) => { if (!buffer) return false; sounds.push(`sample:${name}`); return true; },
    createPluckSynth: name => sounds.push(`synth:${name}`),
    performance: { now: () => now },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id)
  };
  for (const name of ["boardShell", "pauseBtn", "targetText", "songProgress", "loopStartHandle", "loopEndHandle", "preparationCue", "changeSongBtn"]) c[name] = element();
  runInNewContext(constants + "\n" + runtime + "\n" + navigationBinding[0], c);
  const state = () => ({
    request: c.playbackRequestId, generation: c.notePlaybackGeneration,
    running: c.practiceRunning, demo: c.demoMode, looping: c.shouldLoop(),
    pending: c.pendingPlayback && { ...c.pendingPlayback },
    preparation: c.resumePreparation && { ...c.resumePreparation },
    paused: c.pausedSession && { ...c.pausedSession }, seconds: c.currentPracticeTime(),
    status: c.status, button: c.pauseBtn.textContent, disabled: c.pauseBtn.disabled,
    raf: c.rafId, frames: frames.size, voices: c.activeKalimbaVoices.size,
    hasOutput: Boolean(c.kalimbaOutput),
    flags: JSON.stringify([c.songEvents, c.accompanimentEvents])
  });
  Object.defineProperty(c.window.location, "href", {
    set(destination) {
      navigationAttempts.push({ destination, state: state() });
      if (navigation === "throws") throw navigationError;
    }
  });
  return {
    c, frames, timers, navigationAttempts, renders, backing, sounds, state,
    installLifecycle() { c.setupKeyScaleGesture(); },
    pagehide() { lifecycle.get("window:pagehide")(); },
    visibility(hidden) { c.document.hidden = hidden; lifecycle.get("document:visibilitychange")(); },
    audioTimeout: runInNewContext("practiceAudioReadyTimeoutMs", c),
    click() {
      if (navigation === "throws") assert.throws(() => c.changeSongBtn.click(), error => error === navigationError);
      else c.changeSongBtn.click();
      assert.equal(navigationAttempts.at(-1).destination, "./songs.html?selected=test%20song%2F%26%3F");
    },
    advance(seconds) { now += seconds * 1000; },
    healthy(seconds) { this.tick(); const start = now, count = Math.max(1, Math.ceil(seconds / .02)); for (let index = 0; index < count; index++) { now = start + seconds * 1000 * (index + 1) / count; this.tick(); } },
    tick() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
    fireTimers(ms) {
      for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); }
    }
  };
}

function assertStopped(state) {
  assert.equal(state.running, false, "own-play stopped before navigation assignment");
  assert.equal(state.demo, false, "demo stopped before navigation assignment");
  assert.equal(state.looping, false, "no countdown or transport survives navigation");
  assert.equal(state.pending, null, "pending preparation is cancelled at click time");
  assert.equal(state.preparation, null, "Continue countdown is cancelled at click time");
  assert.equal(state.raf, 0);
  assert.equal(state.frames, 0);
  assert.equal(state.voices, 0);
  assert.equal(state.hasOutput, false);
}

function assertNavigationCancelled(h, previousRequest, previousGeneration) {
  const atAssignment = h.navigationAttempts.at(-1).state;
  assertStopped(atAssignment);
  assert.ok(atAssignment.request > previousRequest, "invalidate old request before assigning href");
  assert.ok(atAssignment.generation > previousGeneration, "invalidate delayed note voices before assigning href");
  assert.equal(h.c.document.hidden, false, "the old page has not received a hidden event");
  assertStopped(h.state());
}

function active(h, mode) {
  const { c } = h;
  c.practiceRunning = mode === "practice";
  c.demoMode = mode === "demo";
  c.practiceStartAt = c.performance.now() - c.pausedElapsed * 1000;
  c.lastPracticeFrameSeconds = c.pausedElapsed;
  c.startLoop();
  c.updatePauseControl();
}

function addVoice(h) {
  const { c } = h;
  const stops = [], ramps = [], disconnects = [];
  const source = { stop: at => stops.push(at), disconnect: () => disconnects.push("source") };
  const output = {
    gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime: (value, at) => ramps.push({ value, at }) },
    disconnect: () => disconnects.push("output")
  };
  c.kalimbaOutput = output;
  c.kalimbaOutputNodes = [output];
  c.activeKalimbaVoices.add({ sources: [source], nodes: [source] });
  return { stops, ramps, disconnects };
}

for (const mode of ["practice", "demo"]) for (const navigation of ["pending", "throws"]) {
  test(`${mode}: Change Song stops active transport, stale RAF and voices before ${navigation} navigation`, () => {
    const h = harness({ navigation }), { c } = h;
    active(h, mode);
    const staleFrame = [...h.frames.values()][0];
    const voice = addVoice(h);
    const request = c.playbackRequestId, generation = c.notePlaybackGeneration;
    h.click();
    assertNavigationCancelled(h, request, generation);
    assert.equal(voice.ramps.length, 1, "existing output receives its normal short silence fade");
    assert.equal(voice.ramps[0].value, 0);
    assert.ok(voice.stops.length > 0, "existing sources are scheduled to stop before href assignment returns");
    const after = h.state(), rendered = h.renders.length, backed = h.backing.length;
    h.advance(20); staleFrame(); h.tick();
    assert.deepEqual(h.state(), after, "an already-dequeued RAF cannot advance the retained page");
    assert.equal(h.renders.length, rendered); assert.equal(h.backing.length, backed);
    h.fireTimers(60);
    assert.equal(c.retiredKalimbaOutputs.size, 0);
    assert.deepEqual(voice.disconnects.sort(), ["output", "source"]);
  });
}

function holdAudio(h, stage) {
  const gate = deferred(), { c } = h;
  if (stage === "resume") {
    c.audioContext.state = "suspended";
    c.audioContext.resume = async () => { await gate.promise; c.audioContext.state = "running"; };
  } else c.preloadKalimbaSamples = () => gate.promise;
  return gate;
}

for (const [operation, continueMode] of [["startPractice"], ["playDemo"], ["continuePractice", "practice"], ["continuePractice", "demo"]]) {
  for (const stage of ["resume", "preload"]) for (const outcome of ["resolves", "rejects", "times out"]) {
    for (const navigation of ["pending", "throws"]) {
      test(`${operation}${continueMode ? ` ${continueMode}` : ""}: late ${stage} ${outcome} cannot revive playback after ${navigation} Change Song`, async () => {
        const h = harness({ navigation }), { c } = h;
        if (operation === "continuePractice") c.pausedSession = { mode: continueMode, seconds: 3.25 };
        const gate = holdAudio(h, stage), pending = c[operation]();
        await settle();
        assert.ok(c.pendingPlayback, "the controlled audio request reached its await");
        const request = c.playbackRequestId, generation = c.notePlaybackGeneration;
        h.click();
        const cancelled = h.state();
        if (outcome === "rejects") gate.reject(new Error(`Controlled ${stage} rejection`));
        else if (outcome === "times out") {
          h.fireTimers(h.audioTimeout); await pending; gate.resolve([]);
        } else gate.resolve([]);
        await pending; await settle();
        assertNavigationCancelled(h, request, generation);
        assert.deepEqual(h.state(), cancelled, "late work cannot alter paused status, mode, position or attack flags");
        assert.equal(h.timers.size, 0, "audio readiness timeout is retired after settlement");
      });
    }
  }
}

for (const mode of ["practice", "demo"]) for (const outcome of ["resolves", "rejects"]) {
  for (const navigation of ["pending", "throws"]) for (const phase of ["audio pending", "audio active", "fullscreen settled"]) {
    test(`${mode}: ${navigation} Change Song with ${phase} cancels transport despite fullscreen ${outcome}`, async () => {
      const h = harness({ navigation }), { c } = h, fullscreen = deferred(), audio = deferred(), calls = [];
      c.shouldAutoEnterLandscapeFromLibrary = () => true;
      c.document.fullscreenEnabled = true;
      c.document.documentElement.requestFullscreen = () => {
        calls.push("fullscreen");
        return fullscreen.promise.then(() => { c.document.fullscreenElement = c.document.documentElement; });
      };
      c.fullscreenControl = createPracticeFullscreen({ document: c.document, button: null,
        getPlaybackState: c.getFullscreenPlaybackState,
        begin() { assert.fail("requestOnStart must not begin duplicate playback"); }, notify() {} });
      c.ensureAudioContext = () => { calls.push("audio"); return audio.promise; };
      const pending = c[mode === "practice" ? "startPracticeFromGesture" : "playDemoFromGesture"]();
      assert.deepEqual(calls, ["fullscreen", "audio"], "ready audio does not wait for browser fullscreen settlement");
      const fullscreenResult = c.fullscreenControl.request();
      const finishFullscreen = () => outcome === "resolves" ? fullscreen.resolve() : fullscreen.reject(new Error("Controlled fullscreen rejection"));
      if (phase === "audio active") {
        audio.resolve(); await pending;
        assert.equal(c.shouldLoop(), true, "hung fullscreen cannot block the single audio preparation");
        assert.equal(h.frames.size, 1);
      } else if (phase === "fullscreen settled") {
        finishFullscreen(); await fullscreenResult;
        assert.ok(c.pendingPlayback, "resolved/rejected fullscreen cannot consume the audio gate");
      }
      const request = c.playbackRequestId, generation = c.notePlaybackGeneration;
      h.click(); const cancelled = h.state();
      if (phase !== "fullscreen settled") { finishFullscreen(); await fullscreenResult; }
      audio.resolve(); await pending; await settle();
      assertNavigationCancelled(h, request, generation);
      assert.deepEqual(h.state(), cancelled, "late API work cannot alter retained mode, time, flags or status");
      assert.deepEqual(calls, ["fullscreen", "audio"], "fullscreen never creates another audio request after navigation");
      assert.deepEqual(h.sounds, []); assert.equal(h.timers.size, 0);
      h.advance(20); h.tick(); assert.deepEqual(h.state(), cancelled);
    });
  }
}

for (const phase of ["active", "pending audio", "paused", "Continue countdown"]) {
  for (const mode of ["practice", "demo"]) for (const navigation of ["pending", "throws"]) {
    test(`${phase} ${mode}: ${navigation} navigation retains loop, speed, attacks and explicit Continue`, async () => {
      const h = harness({ navigation }), { c } = h;
      if (phase === "active") active(h, mode);
      if (phase === "pending audio") c.pendingPlayback = { mode, seconds: 3.25 };
      if (phase === "paused" || phase === "Continue countdown") c.pausedSession = { mode, seconds: 3.25 };
      if (phase === "Continue countdown") {
        c.resumePreparation = { mode, seconds: 3.25, startedAt: 10000, duration: 2 };
        c.startLoop();
      }
      const range = c.practiceLoopRange, flags = h.state().flags;
      const request = c.playbackRequestId, generation = c.notePlaybackGeneration;
      h.click();
      assertNavigationCancelled(h, request, generation);
      assert.equal(c.practiceLoopRange, range, "the selected range is retained without reset");
      assert.equal(c.speedFactor, .55); assert.equal(c.pausedElapsed, 3.25);
      assert.deepEqual({ ...c.pausedSession }, { mode, seconds: 3.25 });
      assert.equal(h.state().flags, flags, "delivered attacks stay consumed and upcoming attacks stay available");
      assert.equal(c.pauseBtn.textContent, "继续"); assert.equal(c.pauseBtn.disabled, false);
      h.advance(20); h.tick();
      assert.equal(c.currentPracticeTime(), 3.25); assert.equal(c.shouldLoop(), false);
      // A user can explicitly recover if navigation never commits. This is a
      // fresh request with the same existing count-in; no automatic restart.
      await c.continuePractice();
      assert.ok(c.resumePreparation); assert.equal(c.practiceRunning, false); assert.equal(c.demoMode, false);
      h.healthy(c.resumePreparation.duration);
      assert.equal(c.practiceRunning, mode === "practice"); assert.equal(c.demoMode, mode === "demo");
      assert.equal(c.currentPracticeTime(), 3.25); assert.equal(c.practiceLoopRange, range);
      assert.equal(h.state().flags, flags); assert.equal(c.speedFactor, .55);
    });
  }
}

for (const navigation of ["pending", "throws"]) {
  test(`idle and repeated Change Song remain safely idle during ${navigation} navigation`, () => {
    const h = harness({ navigation }), { c } = h;
    const range = c.practiceLoopRange, flags = h.state().flags;
    for (let click = 0; click < 2; click++) {
      const request = c.playbackRequestId, generation = c.notePlaybackGeneration;
      h.click(); assertNavigationCancelled(h, request, generation);
      assert.equal(c.pausedSession, null, "idle navigation does not manufacture a resumable session");
      assert.equal(c.pauseBtn.disabled, true); assert.equal(c.pausedElapsed, 3.25);
      assert.equal(c.practiceLoopRange, range); assert.equal(h.state().flags, flags);
    }
  });
}

for (const mode of ["practice", "demo"]) for (const decoded of [true, false]) {
  test(`${mode}: delayed ${decoded ? "sample" : "fallback"} note cannot create a voice after Change Song`, async () => {
    const h = harness(), { c } = h, gate = deferred();
    active(h, mode);
    c.loadKalimbaSampleBuffer = () => gate.promise;
    const pending = c.playKalimbaNote("C4", 1, 1, c.getPracticeNoteTiming(3.25));
    h.click(); gate.resolve(decoded ? { duration: 1 } : null); await pending;
    assert.deepEqual(h.sounds, []);
  });
}

// Negative controls establish that the harness still allows ordinary current
// requests, and that existing pause/reset/latest-mode cancellation remains intact.
for (const mode of ["practice", "demo"]) for (const action of ["pause", "reset", "newer mode"]) {
  for (const outcome of ["resolves", "rejects"]) {
    test(`${mode}: ${action} still owns the result when older audio ${outcome}`, async () => {
      const h = harness(), { c } = h, gate = holdAudio(h, "resume");
      const pending = c[mode === "practice" ? "startPractice" : "playDemo"]();
      await settle();
      if (action === "pause") c.pausePractice();
      else if (action === "reset") c.resetPracticeState();
      else {
        c.audioContext.state = "running";
        await c[mode === "practice" ? "playDemo" : "startPractice"]();
        assert.equal(c.practiceRunning, mode === "demo"); assert.equal(c.demoMode, mode === "practice");
      }
      const expected = h.state();
      if (outcome === "resolves") gate.resolve([]); else gate.reject(new Error("Controlled old audio rejection"));
      await pending;
      assert.deepEqual(h.state(), expected);
    });
  }
}

for (const operation of ["startPractice", "playDemo", "continuePractice"]) {
  test(`${operation}: a current un-cancelled request still starts normally`, async () => {
    const h = harness(), { c } = h;
    if (operation === "continuePractice") c.pausedSession = { mode: "demo", seconds: 3.25 };
    const gate = holdAudio(h, "resume"), pending = c[operation]();
    await settle(); assert.ok(c.pendingPlayback);
    gate.resolve(); await pending;
    assert.equal(c.shouldLoop(), true); assert.equal(h.frames.size, 1);
    if (operation === "continuePractice") assert.ok(c.resumePreparation);
    else assert.equal(c[operation === "startPractice" ? "practiceRunning" : "demoMode"], true);
    assert.equal(h.navigationAttempts.length, 0);
  });
}

for (const mode of ["practice", "demo"]) {
  test(`${mode}: repeated Change Song then pagehide/hidden remains paused at the first retained position`, () => {
    const h = harness(), { c } = h;
    h.installLifecycle(); active(h, mode);
    h.click();
    const before = h.state(), range = c.practiceLoopRange;
    assertStopped(before);
    h.advance(20); h.click(); h.pagehide(); h.visibility(true); h.visibility(false); h.tick();
    assertStopped(h.state());
    assert.equal(c.currentPracticeTime(), before.seconds);
    assert.deepEqual({ ...c.pausedSession }, before.paused);
    assert.equal(c.practiceLoopRange, range); assert.equal(h.state().flags, before.flags);
    assert.equal(c.pauseBtn.textContent, "继续"); assert.equal(c.pauseBtn.disabled, false);
  });
  for (const [label, range, seconds, target] of [
    ["initial", null, -.75, 0],
    ["positive A", { startBeat: 4, endBeat: 10 }, 1.25, 2]
  ]) {
    test(`${mode}: Change Song retains the existing ${label} count-in Continue target`, async () => {
      const h = harness(), { c } = h;
      c.practiceLoopRange = range; c.pausedElapsed = seconds; active(h, mode);
      h.click(); assertStopped(h.state());
      assert.equal(c.currentPracticeTime(), seconds, "the frozen visible position is retained");
      assert.deepEqual({ ...c.pausedSession }, { mode, seconds: target }, "Continue retains the existing first-attack clamp");
      await c.continuePractice();
      assert.equal(c.resumePreparation.seconds, target);
      assert.equal(c.resumePreparation.duration, c.getSessionLeadSeconds());
      h.healthy(c.resumePreparation.duration);
      assert.equal(c.currentPracticeTime(), target);
      assert.equal(c.demoMode, mode === "demo"); assert.equal(c.practiceRunning, mode === "practice");
    });
  }
  test(`${mode}: Change Song after a missed onset preserves the existing last-frame stall checkpoint`, () => {
    const h = harness(), { c } = h;
    active(h, mode);
    const before = h.state();
    h.advance(1); // Upcoming beat 8 is now late, with no intervening RAF.
    h.click();
    assertNavigationCancelled(h, before.request, before.generation);
    assert.equal(c.currentPracticeTime(), 3.25);
    assert.deepEqual({ ...c.pausedSession }, { mode, seconds: 3.25 });
    assert.equal(h.state().flags, before.flags, "missed future attacks are not swept through");
    assert.equal(c.status, "播放卡顿，已暂停");
  });
}

for (const oldMode of ["practice", "demo"]) for (const stage of ["resume", "preload"]) {
  for (const outcome of ["resolves", "rejects"]) {
    test(`${oldMode}: Change Song retains a newer pending mode when ${stage} ${outcome}`, async () => {
      const h = harness(), { c } = h;
      active(h, oldMode);
      const newMode = oldMode === "demo" ? "practice" : "demo";
      const gate = holdAudio(h, stage);
      const pending = c[newMode === "practice" ? "startPractice" : "playDemo"]();
      await settle(); assert.equal(c.pendingPlayback.mode, newMode);
      h.click(); const cancelled = h.state();
      if (outcome === "resolves") gate.resolve([]); else gate.reject(new Error("Controlled mode-switch rejection"));
      await pending;
      assertStopped(h.state());
      // The new mode explicitly selected a fresh A pass before awaiting audio.
      assert.deepEqual({ ...c.pausedSession }, { mode: newMode, seconds: 2 });
      assert.deepEqual(h.state(), cancelled);
    });
  }
}

for (const decoded of [true, false]) {
  test(`a current delayed ${decoded ? "sample" : "fallback"} note still reaches its audio endpoint`, async () => {
    const h = harness(), { c } = h, gate = deferred();
    active(h, "demo"); c.loadKalimbaSampleBuffer = () => gate.promise;
    const pending = c.playKalimbaNote("C4", 1, 1, c.getPracticeNoteTiming(3.25));
    gate.resolve(decoded ? { duration: 1 } : null); await pending;
    assert.deepEqual(h.sounds, [decoded ? "sample:C4" : "synth:C4"]);
  });
}
