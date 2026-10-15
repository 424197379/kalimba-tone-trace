import { createPracticeFullscreen } from "../src/practice-fullscreen.js";
import { selectKeyGuidance } from "../src/key-guidance.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats, getPracticeTotalBeats } from "../src/practice-loop.js";
import { saveSongSpeed, readSongSpeed, recordPractice, readSongAccompaniment, saveSongAccompaniment } from "../src/practice-preferences.js";
import { NOTE_INDEX } from "../src/songs.js";
import { getSongLibrary, getPracticeSongId, getEventTotalBeats, getSongBaseId, getSongAccompanimentProvider, hasMatchingPracticeMelody, getSongArchiveDownload, getSongVersionRank } from "../src/song-store.js";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const functions = [
  "beginPassPreparation",
  "startPracticeFromGesture", "playDemoFromGesture", "getFullscreenPlaybackState",
  "setCurrentSong", "buildSongEvents", "buildAutoAccompanimentEvents", "getAccompanimentConfig", "getPracticeAccompanimentConfig",
  "getDefaultAccompanimentEnabled", "getDefaultAccompanimentVolume", "getSongVariants",
  "getPracticeAccompanimentSource", "getSongAccompanimentSignature", "restoreSongAccompaniment",
  "resetSongEvents", "resetAccompanimentEvents", "getAccompanimentTime", "getAccompanimentDurationSeconds",
  "syncAccompanimentEventsForSeek", "playAccompanimentEvents", "formatSongTime", "getSongProgressDuration",
  "renderSongProgress", "renderLoopControls", "renderPreparationCue", "prepareLoopStart", "togglePracticeLoop",
  "startLoopDrag", "moveLoopDrag", "finishLoopDrag", "handleLoopKeydown", "setStatus", "currentPracticeTime",
  "getScaledBeatSeconds", "getSessionLeadSeconds", "getEventTime", "getEventDurationSeconds", "getEventJudgeWindowSeconds",
  "getSongEndSeconds", "resetDetectionReadout", "syncSongEventsForSeek", "seekToSongTime", "getExpectedEvent",
  "getJudgementEvent", "renderKeyGuidance", "renderBoard", "shouldLoop", "animationLoop", "startLoop", "startPractice", "pausePractice",
  "resetPracticeState", "playDemo", "applySpeed", "changeAccompanimentStyle", "applyAccompanimentControl",
  "updatePauseControl", "cancelPracticeContinuation", "clearPracticeInteractions", "preservePastAttacks",
  "continuePractice", "togglePausePractice", "silenceKalimbaAudio", "handleAudioContextStateChange",
  "preparePracticeAudio", "getPracticeNoteTiming", "isPracticeNoteCurrent", "admitPracticeFrame"
];
// Execute the production functions, not a test reimplementation of the scheduler.
const declarations = [...source.matchAll(/^    (?:async )?function (\w+)\(/gm)];
// Initialization has top-level DOM setup after its declaration; load only the
// production function body instead of running the page's unrelated bootstrap.
const initialSongDeclaration = source.match(/^    function getInitialSongId\(\) \{[\s\S]*?^    \}/m);
assert.ok(initialSongDeclaration, "Missing production function getInitialSongId");
const runtime = functions.map(name => {
  const index = declarations.findIndex(match => match[1] === name);
  assert.ok(index >= 0, `Missing production function ${name}`);
  return source.slice(declarations[index].index, declarations[index + 1]?.index ?? source.length);
}).join("\n") + "\n" + initialSongDeclaration[0];

function element() {
  const values = new Set();
  return {
    hidden: false, disabled: false, textContent: "", attrs: {},
    style: { setProperty(name, value) { this[name] = value; } },
    classList: {
      add: (...names) => names.forEach(name => values.add(name)),
      remove: (...names) => names.forEach(name => values.delete(name)),
      contains: name => values.has(name),
      toggle: (name, on) => on ? values.add(name) : values.delete(name)
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    focus() {}, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 })
  };
}

function harness({ beats = [0, 4, 5.75, 6, 8], range = { startBeat: 4, endBeat: 6 } } = {}) {
  let now = 10000;
  let frameId = 0;
  const frames = new Map();
  const sounds = [];
  const saved = new Map();
  const notes = prefix => beats.map((beat, id) => ({
    id, beat, duration: .25, minLane: id, laneSpan: 1, judgeLanes: [id],
    notes: [{ name: `${prefix}${beat}`, velocity: .8 }], demoPlayed: false, played: false
  }));
  const songEvents = notes("melody:");
  const c = {
    console, Math, Number, Set, Map, URLSearchParams, selectKeyGuidance, keyEls: Array.from({ length: 21 }, element),
    createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats, getPracticeTotalBeats, saveSongSpeed, readSongSpeed, recordPractice, readSongAccompaniment, saveSongAccompaniment,
    sessionAccompanimentChoices: new Map(),
    NOTE_INDEX, getPracticeSongId, getEventTotalBeats, getSongBaseId, getSongAccompanimentProvider, hasMatchingPracticeMelody, getSongArchiveDownload, getSongVersionRank,
    storedAccompanimentEnabled: null, storedAccompanimentVolume: null, bpm: 120, songLibrary: {},
    storeSongId() {}, readStoredSongId: () => null, window: { location: { search: "" } }, applySongMeta() {}, setCompactIcon() {},
    renderStaticBoard() { c.noteEls = new Map(c.songEvents.map(event => [event.id, element()])); },
    browserPreferenceStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    currentSongId: "test-song", currentSong: { id: "test-song" },
    APP_NAME: "Test", songEvents, accompanimentEvents: notes("backing:"), noteEls: new Map(songEvents.map(e => [e.id, element()])),
    songTotalBeats: 10, accompanimentTotalBeats: 10, beatSeconds: .5, speedFactor: 1,
    practiceLoopRange: range && { ...range }, practiceRunning: false, demoMode: false,
    pausedElapsed: 0, practiceStartAt: 0, playbackRequestId: 0, rafId: 0,
    pendingPlayback: null, pausedSession: null, resumePreparation: null, passPreparation: null, preparationRetryUsed: false, lastPracticeFrameSeconds: null,
    practiceOnsetStaleSeconds: .15, practiceAudioReadyTimeoutMs: 8000,
    notePlaybackGeneration: 0, activeKalimbaVoices: new Set(), retiredKalimbaOutputs: new Set(),
    kalimbaBus: null, kalimbaDry: null, kalimbaWet: null, kalimbaReverb: null, kalimbaOutput: null, kalimbaOutputNodes: [],
    progressSeekPointerId: null, progressSeekRect: null, clearTimeout() {}, setTimeout() {},
    seekingWithProgress: false, progressSeekAtStart: false, preferredPlaybackMode: "practice", fullscreenControl: null, accompanimentStyle: "original", accompanimentEnabled: true, accompanimentVolume: .6, audioContext: { state: "running" },
    baseFallLeadSeconds: 1.5, fallLeadSeconds: 1.5, focusWindowSeconds: .1, lateGraceSeconds: .1, beamSwitchLeadSeconds: .05,
    activeDetection: { lane: null, candidateLane: null }, activeInputUntil: 0, signalPeakUntil: 0,
    DISPLAY_KEYS: Array(21), noteLaneInsetRatio: .08, boardTop: { clientHeight: 200 }, noteLayer: { clientWidth: 840 },
    loopDragEdge: null, loopDragPointerId: null, loopDragRect: null, loopDragWasPlaying: false, loopDragWasDemo: false,
    performance: { now: () => now }, document: { documentElement: element(), fullscreenElement: null },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
    isCompactPracticeView: () => false, getVisualFallLeadSeconds: () => c.fallLeadSeconds,
    clearHighlights() {}, setActiveBeamLane() {}, highlightLane() {}, formatEventTargetText: e => e.notes[0].name,
    shouldUseLandscapeFullscreen: () => false, ensureAudioContext: async () => {}, preloadKalimbaSamples: async () => {}, ensureKalimbaOutput() {},
    showKeyWidthStatus() {}, playKalimbaNote: (name, duration, velocity) => sounds.push({ name, duration, velocity })
  };
  for (const name of ["boardShell", "targetText", "statusText", "pauseBtn", "repeatBtn", "loopSelection", "loopStartHandle", "loopEndHandle", "preparationCue", "songProgress", "songProgressFill", "songProgressThumb", "songElapsed", "songRemaining", "speedSlider", "speedValue", "accompanimentStyleSelect", "accompanimentBtn", "accompanimentVolumeWrap", "accompanimentVolumeSlider", "accompanimentVolumeValue"]) c[name] = element();
  runInNewContext(runtime, c);
  return {
    c, sounds, frames,
    names: () => sounds.map(sound => sound.name),
    advance(seconds) { now += seconds * 1000; },
    healthy(seconds) { this.tick(); const start = now, count = Math.max(1, Math.ceil(seconds / .02)); for (let index = 0; index < count; index++) { now = start + seconds * 1000 * (index + 1) / count; this.tick(); } },
    // Existing session/lifecycle tests relocate along a healthy frame trace.
    // Raw `advance` still injects genuine callback gaps for interruption tests.
    stepTo(seconds) {
      if ((c.practiceRunning || c.demoMode) && c.lastPracticeFrameSeconds != null && seconds > c.currentPracticeTime()) {
        const initial = [...frames]; frames.clear();
        for (const [, callback] of initial) callback();
        const checkpoints = [...Array.from({ length: Math.max(0, Math.ceil((Math.min(seconds, (c.practiceLoopRange?.startBeat || 0) * c.getScaledBeatSeconds()) - c.currentPracticeTime()) / .1)) }, (_, index) => c.currentPracticeTime() + (index + 1) * .1),
          ...c.songEvents.map(event => c.getEventTime(event)),
          ...c.accompanimentEvents.map(event => c.getAccompanimentTime(event)),
          ...(c.practiceLoopRange ? [c.practiceLoopRange.endBeat * c.getScaledBeatSeconds()] : [])]
          .filter(time => time > c.currentPracticeTime() + 1e-7 && time < seconds - 1e-7).sort((a, b) => a - b);
        for (const time of checkpoints) {
          const previous = c.currentPracticeTime();
          now += Math.max(0, time + 1e-8 - previous) * 1000;
          const pending = [...frames]; frames.clear();
          for (const [, callback] of pending) callback();
          if (!c.shouldLoop() || c.currentPracticeTime() < previous) return;
        }
        now += Math.max(0, seconds - c.currentPracticeTime()) * 1000;
      } else {
        c.pausedElapsed = seconds; c.practiceStartAt = now - seconds * 1000;
        if ((c.practiceRunning || c.demoMode) && c.lastPracticeFrameSeconds == null) {
          c.lastPracticeFrameSeconds = seconds;
          c.preservePastAttacks(seconds);
        }
      }
    },
    tick() {
      const pending = [...frames]; frames.clear();
      for (const [, callback] of pending) callback();
    }
  };
}

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

// Controlled VM probes execute the production transport, DOM callbacks and audio
// functions. They establish runtime invariants, not real-phone interruption QA.
function production(name, c) {
  const index = declarations.findIndex(match => match[1] === name);
  assert.ok(index >= 0, name);
  runInNewContext(source.slice(declarations[index].index, declarations[index + 1]?.index ?? source.length), c);
}

function lifecycle(h) {
  const listeners = new Map();
  const { c } = h;
  let persisted = 0;
  c.boardShell.addEventListener = () => {};
  c.window.addEventListener = (name, callback) => listeners.set(`window:${name}`, callback);
  c.document.addEventListener = (name, callback) => listeners.set(`document:${name}`, callback);
  c.ResizeObserver = class { observe() {} };
  c.persistKeyWidth = () => persisted++;
  production("setupKeyScaleGesture", c);
  c.setupKeyScaleGesture();
  return {
    listeners,
    hide() { c.document.hidden = true; listeners.get("document:visibilitychange")(); },
    show() { c.document.hidden = false; listeners.get("document:visibilitychange")(); },
    pagehide() { listeners.get("window:pagehide")(); },
    persisted: () => persisted
  };
}

async function begin(h, mode, seconds) {
  const { c } = h;
  if (mode === "demo") await c.playDemo();
  else { c.resetPracticeState({ preserveLoop: true }); await c.startPractice(); }
  if (seconds != null) h.stepTo(seconds);
  h.tick();
}

async function finishPreparation(h) {
  const { c } = h;
  await c.continuePractice();
  const duration = c.resumePreparation.duration;
  h.healthy(duration - .001);
  assert.ok(c.resumePreparation, "preparation lasts its full duration");
  h.advance(.001); h.tick();
  assert.equal(c.resumePreparation, null);
}

for (const mode of ["demo", "practice"]) {
  for (const [label, range, seconds] of [
    ["initial countdown", null, -.75],
    ["active song", null, 1.25],
    ["end approach", null, 5.8],
    ["positive A countdown", { startBeat: 4, endBeat: 6 }, 1.25],
    ["active A–B", { startBeat: 4, endBeat: 6 }, 2.6]
  ]) {
    test(`${mode}: hide freezes ${label}; Continue preserves position, mode and all prior attacks`, async () => {
      const h = harness({ beats: [0, 1, 2, 3, 4, 5, 5.75, 6, 8], range });
      const { c } = h; const life = lifecycle(h);
      await begin(h, mode, seconds);
      const before = h.names();
      const delivered = c.songEvents.map(e => e.demoPlayed);
      const backing = c.accompanimentEvents.map(e => e.played);
      const selection = JSON.stringify(c.practiceLoopRange);
      life.hide();
      near(c.currentPracticeTime(), seconds);
      assert.equal(c.shouldLoop(), false); assert.equal(c.rafId, 0); assert.equal(h.frames.size, 0);
      assert.equal(c.pauseBtn.textContent, "继续"); assert.equal(c.pauseBtn.disabled, false);
      h.advance(50); life.show(); h.tick();
      near(c.currentPracticeTime(), seconds); assert.deepEqual(h.names(), before);
      const target = Math.max(seconds, (range?.startBeat || 0) * c.getScaledBeatSeconds());
      await c.continuePractice();
      assert.equal(c.demoMode, false); assert.equal(c.practiceRunning, false);
      const preparation = c.resumePreparation.duration;
      h.healthy(preparation / 2);
      near(c.currentPracticeTime(), target); assert.deepEqual(h.names(), before);
      assert.equal(c.preparationCue.hidden, false); assert.match(c.statusText.textContent, /^继续准备 /);
      assert.equal(c.boardShell.classList.contains("demo-playing"), false);
      h.healthy(preparation / 2);
      near(c.currentPracticeTime(), target);
      assert.equal(c.demoMode, mode === "demo"); assert.equal(c.practiceRunning, mode === "practice");
      assert.equal(c.pauseBtn.textContent, "暂停");
      assert.equal(c.boardShell.classList.contains("demo-playing"), mode === "demo");
      const firstAttack = seconds < target ? [`backing:${target / c.getScaledBeatSeconds()}`, ...(mode === "demo" ? [`melody:${target / c.getScaledBeatSeconds()}`] : [])] : [];
      assert.deepEqual(h.names(), [...before, ...firstAttack]);
      delivered.forEach((played, id) => { if (played) assert.equal(c.songEvents[id].demoPlayed, true); });
      backing.forEach((played, id) => { if (played) assert.equal(c.accompanimentEvents[id].played, true); });
      c.accompanimentEvents.forEach(event => { if (c.getAccompanimentTime(event) > target) assert.equal(event.played, false); });
      assert.equal(JSON.stringify(c.practiceLoopRange), selection); assert.equal(c.speedFactor, 1);
    });
  }
}

for (const stop of ["hide", "pagehide", "statechange", "hidden-before-event"]) {
  test(`${stop}: delayed lifecycle notification freezes last visible frame without a burst`, async () => {
    const h = harness({ beats: [0, 1, 2, 3, 4, 5, 6, 7, 8], range: null });
    const { c } = h; const life = lifecycle(h);
    await begin(h, "demo", .01); const before = h.names();
    h.advance(3.04);
    if (stop === "statechange") { c.audioContext.state = "suspended"; c.handleAudioContextStateChange(); }
    else if (stop === "hidden-before-event") { c.document.hidden = true; h.tick(); }
    else life[stop]();
    near(c.currentPracticeTime(), .01); assert.deepEqual(h.names(), before);
    c.audioContext.state = "running"; life.show();
    await finishPreparation(h);
    near(c.currentPracticeTime(), .01); assert.deepEqual(h.names(), before);
    h.advance(.48); h.tick(); assert.deepEqual(h.names(), before);
    h.advance(.02); h.tick();
    assert.deepEqual(h.names().slice(before.length), ["backing:1", "melody:1"]);
  });
}

test("ordinary focus changes never pause, and visible/pageshow never resume", async () => {
  const h = harness({ range: null }); const life = lifecycle(h); const { c } = h;
  await begin(h, "demo", .1);
  assert.equal(life.listeners.has("window:blur"), false);
  assert.equal(life.listeners.has("window:focus"), false);
  life.listeners.get("window:blur")?.(); assert.equal(c.demoMode, true);
  life.hide(); const saved = JSON.stringify(c.pausedSession);
  life.show(); life.listeners.get("window:pageshow")?.(); h.advance(10); h.tick();
  assert.equal(c.shouldLoop(), false); assert.equal(JSON.stringify(c.pausedSession), saved);
});

test("hide/show/hide and pagehide double delivery preserve the first saved pause", async () => {
  const h = harness({ range: null }); const life = lifecycle(h); const { c } = h;
  await begin(h, "demo", 1.25); life.hide(); const saved = JSON.stringify(c.pausedSession);
  h.advance(100); life.pagehide(); life.show(); life.hide(); life.pagehide();
  assert.equal(JSON.stringify(c.pausedSession), saved);
  assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0);
  assert.equal(life.persisted(), 4);
});

for (const mode of ["demo", "practice"]) {
  for (const gateName of ["audio", "preload"]) {
    test(`${mode}: hidden during pending ${gateName} cannot activate later`, async () => {
      const h = harness({ range: null }); const { c } = h; const life = lifecycle(h); const gate = deferred();
      c.resetPracticeState();
      let audioRequests = 0;
      c.ensureAudioContext = () => { audioRequests++; return gateName === "audio" ? gate.promise : Promise.resolve(); };
      if (gateName === "preload") c.preloadKalimbaSamples = () => gate.promise;
      const start = mode === "demo" ? c.playDemo() : c.startPractice();
      await Promise.resolve(); life.hide(); const saved = JSON.stringify(c.pausedSession);
      life.pagehide(); gate.resolve(); await start;
      assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0);
      assert.equal(JSON.stringify(c.pausedSession), saved); assert.equal(c.pausedSession.mode, mode);
      assert.equal(audioRequests, 1, "only the explicit playback request begins audio preparation");
      life.show(); h.tick(); assert.equal(c.shouldLoop(), false);
    });
  }
}

// Fullscreen and audio are independent promises initiated by one actual play
// gesture. A late browser API result must never acquire a transport continuation.
for (const mode of ["practice", "demo"]) for (const outcome of ["resolves", "rejects"]) {
  for (const phase of ["audio pending", "audio active", "fullscreen settled"]) {
    test(`${mode}: hidden with ${phase} invalidates transport despite fullscreen ${outcome}`, async () => {
      const h = harness({ range: null }), { c } = h, life = lifecycle(h);
      const fullscreen = deferred(), audio = deferred(), calls = [];
      c.resetPracticeState();
      c.shouldAutoEnterLandscapeFromLibrary = () => true;
      c.document.fullscreenEnabled = true;
      c.document.documentElement.requestFullscreen = () => {
        calls.push("fullscreen");
        return fullscreen.promise.then(() => { c.document.fullscreenElement = c.document.documentElement; });
      };
      c.fullscreenControl = createPracticeFullscreen({ document: c.document, button: null,
        getPlaybackState: c.getFullscreenPlaybackState,
        begin() { assert.fail("requestOnStart must not begin a second transport"); }, notify() {} });
      c.ensureAudioContext = () => { calls.push("audio"); return audio.promise; };
      const start = c[mode === "demo" ? "playDemoFromGesture" : "startPracticeFromGesture"]();
      assert.deepEqual(calls, ["fullscreen", "audio"], "request both APIs synchronously in the same gesture");
      const fullscreenResult = c.fullscreenControl.request();
      const finishFullscreen = () => outcome === "resolves" ? fullscreen.resolve() : fullscreen.reject(new Error("Controlled fullscreen denial"));
      if (phase === "audio active") {
        audio.resolve(); await start;
        assert.equal(c.shouldLoop(), true, "a hanging fullscreen request cannot strand ready audio");
        assert.equal(h.frames.size, 1);
      } else if (phase === "fullscreen settled") {
        finishFullscreen(); await fullscreenResult;
        assert.ok(c.pendingPlayback, "fullscreen settlement does not replace the pending audio request");
      }
      life.hide(); const saved = JSON.stringify(c.pausedSession), request = c.playbackRequestId;
      life.pagehide();
      if (phase !== "fullscreen settled") { finishFullscreen(); await fullscreenResult; }
      audio.resolve(); await start; await settle();
      assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0);
      assert.equal(JSON.stringify(c.pausedSession), saved); assert.equal(c.pausedSession.mode, mode);
      assert.ok(c.playbackRequestId >= request);
      assert.deepEqual(calls, ["fullscreen", "audio"], "late fullscreen does not prepare audio again");
      life.show(); h.advance(10); h.tick();
      assert.equal(c.shouldLoop(), false); assert.deepEqual(h.sounds, []);
    });
  }
}

test("untouched and ended sessions have no Continue action", async () => {
  for (const mode of [null, "demo", "practice"]) {
    const h = harness({ range: null }); const { c } = h; const life = lifecycle(h);
    c.resetPracticeState();
    if (mode) { await begin(h, mode, c.getSongEndSeconds()); assert.equal(c.shouldLoop(), false); }
    life.hide(); life.pagehide(); life.show(); await c.continuePractice();
    assert.equal(c.pausedSession, null); assert.equal(c.pauseBtn.disabled, true); assert.equal(c.shouldLoop(), false);
  }
});

test("manual pause and its repeated calls are cancelable and idempotent", async () => {
  const h = harness({ range: null }); const { c } = h;
  await begin(h, "demo", .2); h.advance(.08); c.togglePausePractice();
  near(c.pausedSession.seconds, .28); const saved = JSON.stringify(c.pausedSession);
  h.advance(10); c.pausePractice(); assert.equal(JSON.stringify(c.pausedSession), saved);
  await c.continuePractice(); h.advance(.2); c.togglePausePractice();
  assert.equal(c.shouldLoop(), false); assert.equal(c.resumePreparation, null);
  assert.equal(JSON.stringify(c.pausedSession), saved); assert.equal(h.frames.size, 0);
});

for (const action of ["reset", "seek", "speed", "loop", "loop-key", "song", "own-play", "demo"]) {
  for (const phase of ["await", "preparation"]) {
    test(`${action} cancels old Continue ${phase}`, async () => {
      const h = harness({ range: null }); const { c } = h;
      await begin(h, "demo", 1.25); c.pausePractice();
      const gate = deferred();
      if (phase === "await") c.ensureAudioContext = () => gate.promise;
      const continuation = c.continuePractice();
      if (phase === "preparation") { await continuation; h.advance(.2); h.tick(); }
      c.ensureAudioContext = async () => {};
      if (action === "reset") c.resetPracticeState();
      if (action === "seek") c.seekToSongTime(.75);
      if (action === "speed") { c.speedSlider.value = ".5"; c.applySpeed(); }
      if (action === "loop") c.togglePracticeLoop();
      if (action === "loop-key") {
        c.practiceLoopRange = { startBeat: 4, endBeat: 6 };
        c.handleLoopKeydown({ key: "ArrowRight", preventDefault() {} }, "start");
      }
      if (action === "song") {
        c.songLibrary.new = { id: "new", bpm: 120, title: "new", schemaVersion: 1, arrangementKind: "melody", judgementMode: "melody", steps: [["C4", 0, 1]],
          events: [{ beat: 0, duration: 1, notes: [{ name: "C4", role: "melody", judge: true, velocity: 1 }] }] };
        c.setCurrentSong("new");
      }
      if (action === "own-play") await c.startPractice();
      if (action === "demo") await c.playDemo();
      gate.resolve(); await continuation;
      assert.equal(c.resumePreparation, null);
      if (["own-play", "demo"].includes(action)) {
        assert.equal(c.demoMode, action === "demo"); assert.equal(c.practiceRunning, action === "own-play");
      } else {
        assert.equal(c.shouldLoop(), false); h.advance(30); h.tick(); assert.equal(c.shouldLoop(), false);
      }
      if (action === "speed") { near(c.pausedSession.seconds, 2.5); assert.equal(c.pausedSession.mode, "demo"); }
      else if (["seek", "loop", "loop-key"].includes(action)) {
        assert.equal(c.pausedSession.mode, "demo"); assert.equal(c.pauseBtn.textContent, "继续");
        assert.equal(c.pauseBtn.disabled, false); assert.equal(c.statusText.textContent, "已暂停");
        near(c.pausedSession.seconds, action === "seek" ? .75 : c.practiceLoopRange.startBeat * c.getScaledBeatSeconds());
      } else assert.equal(c.pausedSession, null);
    });
  }
}

test("hide during Continue preparation retains its target and restarts a full preparation on another explicit Continue", async () => {
  const h = harness({ range: null }); const { c } = h; const life = lifecycle(h);
  await begin(h, "demo", 1.25); c.pausePractice(); await c.continuePractice();
  const duration = c.resumePreparation.duration;
  h.healthy(duration - .01); life.hide(); near(c.pausedSession.seconds, 1.25);
  life.show(); h.advance(20); h.tick(); assert.equal(c.shouldLoop(), false);
  await c.continuePractice(); h.advance(.02); h.tick(); assert.ok(c.resumePreparation);
  near(c.currentPracticeTime(), 1.25);
});

test("a delayed preparation RAF starts from the preserved target without catching up preparation elapsed time", async () => {
  const h = harness({ beats: [0,1,2,3,4,5,6,7,8], range: null }); const { c } = h;
  await begin(h, "demo", .01); const before = h.names(); c.pausePractice(); await c.continuePractice();
  h.advance(100); h.tick(); near(c.currentPracticeTime(), .01); assert.deepEqual(h.names(), before);
});

test("held notes are not struck again, and an upcoming true onset remains eligible after Continue", async () => {
  const h = harness({ beats: [0, 4, 6], range: null }); const { c } = h;
  c.songEvents[0].duration = 4;
  await begin(h, "demo", .01); h.stepTo(1.25); h.tick(); const before = h.names(); c.pausePractice();
  await finishPreparation(h); assert.deepEqual(h.names(), before);
  h.advance(.76); h.tick(); assert.deepEqual(h.names().slice(before.length), ["backing:4", "melody:4"]);
});

for (const boundary of [2.999, 3, 3.001]) {
  test(`Continue around exclusive loop B (${boundary}) does not invent a B attack`, async () => {
    const h = harness({ beats: [0,4,5,5.75,6,8] }); const { c } = h;
    await begin(h, "demo", boundary); c.pausePractice();
    await finishPreparation(h);
    assert.ok(!h.names().includes("melody:6")); assert.ok(!h.names().includes("backing:6"));
    h.advance(.01); h.tick();
    assert.ok(!h.names().includes("melody:6")); assert.ok(!h.names().includes("backing:6"));
  });
}

for (const gesture of ["loop", "progress"]) {
  test(`lifecycle stop releases ${gesture} pointer capture and stale pointerup cannot resume or seek`, async () => {
    const h = harness(); const { c } = h; const life = lifecycle(h);
    let capture = null; let releases = 0;
    for (const element of [c.loopStartHandle, c.songProgress]) {
      element.setPointerCapture = id => { capture = id; };
      element.hasPointerCapture = id => capture === id;
      element.releasePointerCapture = () => { capture = null; releases++; };
    }
    await begin(h, "demo", 2.2);
    const pointer = { pointerId: 7, currentTarget: c.loopStartHandle, clientX: 400, clientY: 0, preventDefault() {} };
    if (gesture === "loop") c.startLoopDrag(pointer, "start");
    else {
      for (const name of ["getProgressSeekSeconds", "handleProgressPointer", "startProgressSeek", "moveProgressSeek", "finishProgressSeek"]) production(name, c);
      c.startProgressSeek(pointer);
    }
    life.hide(); const saved = JSON.stringify(c.pausedSession); const position = c.currentPracticeTime();
    assert.equal(capture, null); assert.equal(releases, 1);
    life.show();
    c.finishLoopDrag({ ...pointer, type: "pointerup" });
    if (gesture === "progress") {
      c.moveProgressSeek({ ...pointer, clientX: 800 });
      c.finishProgressSeek({ ...pointer, type: "pointerup" });
    }
    assert.equal(c.shouldLoop(), false); near(c.currentPracticeTime(), position);
    assert.equal(JSON.stringify(c.pausedSession), saved); assert.equal(h.frames.size, 0);
  });
}

function audioHarness(h = harness({ range: null })) {
  const { c } = h;
  const nodes = []; const sources = []; const timers = new Map();
  let timerId = 0; let resumes = 0;
  const param = () => ({ value: 1, calls: [],
    setValueAtTime(value, time) { this.value = value; this.calls.push(["set", value, time]); },
    cancelScheduledValues(time) { this.calls.push(["cancel", time]); },
    linearRampToValueAtTime(value, time) { this.calls.push(["linear", value, time]); },
    exponentialRampToValueAtTime(value, time) { this.calls.push(["exp", value, time]); }
  });
  const node = (source = false) => {
    const n = { edges: [], disconnected: false, starts: [], stops: [], gain: param(), frequency: param(), Q: param(),
      detune: param(), pan: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
      connect(next) { this.edges.push(next); return next; },
      disconnect() { this.disconnected = true; this.edges = []; },
      start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); }
    };
    nodes.push(n); if (source) sources.push(n); return n;
  };
  c.audioContext = { state: "running", currentTime: 42, sampleRate: 1000, destination: node(),
    createGain: () => node(), createBiquadFilter: () => node(), createDynamicsCompressor: () => node(),
    createStereoPanner: () => node(), createConvolver: () => node(),
    createBufferSource: () => node(true), createOscillator: () => node(true),
    createBuffer: (channels, length) => ({ duration: length / 1000, numberOfChannels: channels, getChannelData: () => new Float32Array(length) }),
    resume: async () => { resumes++; c.audioContext.state = "running"; }, addEventListener() {}
  };
  c.DISPLAY_KEYS = [{ name: "C4", freq: 261.63 }]; c.NOTE_INDEX = new Map([["C4", 0]]);
  c.kalimbaSampleBuffers = new Map();
  c.loadKalimbaSampleBuffer = async () => ({ duration: 2 });
  c.setTimeout = (callback, duration) => { timers.set(++timerId, { callback, duration }); return timerId; };
  c.clearTimeout = id => timers.delete(id);
  for (const name of ["registerKalimbaVoice", "createKalimbaImpulseResponse", "ensureKalimbaOutput", "playDecodedKalimbaSample",
    "playKalimbaSample", "playKalimbaNote", "playKalimbaNoteImmediate", "playKeyPreview", "setActiveKeyInput", "pluckEnvelope", "createPluckSynth"]) production(name, c);
  return { ...h, nodes, sources, timers, resumes: () => resumes,
    started: () => sources.filter(n => n.starts.length),
    flushTimers() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); } }
  };
}

for (const audioState of ["running", "suspended", "interrupted", "closed"]) {
  for (const voice of ["sample", "synth"]) {
    test(`${voice}: pause safely retires full dry/wet output when audio is ${audioState}`, () => {
      const h = audioHarness(); const { c } = h;
      if (voice === "sample") c.playDecodedKalimbaSample("C4", { duration: 2 }, .8);
      else c.createPluckSynth("C4", 2, .8);
      const oldOutput = c.kalimbaOutput; const oldReverb = c.kalimbaReverb; const oldBus = c.kalimbaBus;
      const voices = [...c.activeKalimbaVoices]; assert.ok(voices.length > 0); assert.ok(h.started().length > 0);
      c.audioContext.state = audioState; c.pausePractice();
      assert.equal(c.kalimbaOutput, null); assert.equal(c.kalimbaBus, null); assert.equal(c.activeKalimbaVoices.size, 0);
      assert.equal(h.resumes(), 0);
      if (audioState === "running") {
        assert.ok(oldOutput.gain.calls.some(([kind, value, at]) => kind === "linear" && value === 0 && at === 42.035));
        h.sources.forEach(source => assert.ok(source.stops.includes(42.04)));
        h.flushTimers();
      } else {
        assert.ok(oldOutput.gain.calls.some(([kind, value]) => kind === "set" && value === 0));
        h.sources.forEach(source => assert.ok(source.stops.includes(42)));
        assert.equal(h.timers.size, 0);
      }
      assert.equal(oldOutput.disconnected, true); assert.equal(oldReverb.disconnected, true); assert.equal(oldBus.disconnected, true);
      assert.equal(c.retiredKalimbaOutputs.size, 0);
      c.audioContext.state = "running"; c.playDecodedKalimbaSample("C4", { duration: 1 });
      assert.notEqual(c.kalimbaOutput, oldOutput); assert.notEqual(c.kalimbaReverb, oldReverb);
      assert.equal(oldOutput.disconnected, true); assert.equal(oldReverb.disconnected, true);
    });
  }
}

test("suspension during an unfinished running fade immediately detaches old tails without resuming", () => {
  const h = audioHarness(); const { c } = h;
  c.playDecodedKalimbaSample("C4", { duration: 2 }); const output = c.kalimbaOutput;
  c.pausePractice(); assert.equal(c.retiredKalimbaOutputs.size, 1);
  c.audioContext.state = "suspended"; c.handleAudioContextStateChange();
  assert.equal(output.disconnected, true); assert.equal(c.retiredKalimbaOutputs.size, 0);
  assert.equal(h.resumes(), 0); assert.equal(h.timers.size, 0);
});

for (const result of [{ duration: 2 }, null]) {
  test(`buffer ${result ? "success" : "fallback"} after pause cannot create a late voice or attach to a new output graph`, async () => {
    const h = audioHarness(); const { c } = h; const gate = deferred();
    c.loadKalimbaSampleBuffer = () => gate.promise;
    const playing = c.playKalimbaNote("C4", 1, .8);
    c.pausePractice(); c.playDecodedKalimbaSample("C4", { duration: 1 });
    const before = h.started().length; const output = c.kalimbaOutput;
    gate.resolve(result); await playing;
    assert.equal(h.started().length, before); assert.equal(c.kalimbaOutput, output);
  });
}

test("pending screen-key audio preparation is invalidated by lifecycle stop", async () => {
  const h = audioHarness(); const { c } = h; const gate = deferred(); const life = lifecycle(h);
  c.ensureAudioContext = () => gate.promise;
  const preview = c.playKeyPreview("C4", 0); life.hide(); gate.resolve(); await preview;
  assert.equal(h.started().length, 0); assert.equal(c.activeDetection.lane, null);
});

test("a suspended context is paused before dispatch even without a statechange event", async () => {
  const h = harness({ beats: [0,1,2,3,4,5], range: null }); const { c } = h;
  await begin(h, "demo", .01); const before = h.names();
  h.advance(3); c.audioContext.state = "interrupted"; h.tick();
  assert.equal(c.shouldLoop(), false); near(c.currentPracticeTime(), .01); assert.deepEqual(h.names(), before);
});

test("direct layout rendering while hidden or suspended cannot dispatch melody or backing", async () => {
  for (const condition of ["hidden", "suspended"]) {
    const h = harness({ range: null }); const { c } = h;
    await begin(h, "demo", .01); const before = h.names();
    if (condition === "hidden") c.document.hidden = true; else c.audioContext.state = "suspended";
    const delivered = c.songEvents.map(event => event.demoPlayed);
    const backing = c.accompanimentEvents.map(event => event.played);
    const visiblePosition = c.lastPracticeFrameSeconds;
    c.renderBoard(2.9); c.playAccompanimentEvents(2.9);
    assert.deepEqual(h.names(), before);
    assert.deepEqual(c.songEvents.map(event => event.demoPlayed), delivered);
    assert.deepEqual(c.accompanimentEvents.map(event => event.played), backing);
    near(c.lastPracticeFrameSeconds, visiblePosition);
  }
});

for (const moved of [false, true]) {
  test(`hidden during active loop drag retains an explicit Continue target (${moved ? "new A" : "unchanged phrase"})`, async () => {
    const h = harness({ beats: [0, 1, 2, 4, 5, 6, 8] }); const { c } = h; const life = lifecycle(h);
    await begin(h, "demo", 2.2);
    const pointer = { pointerId: 4, currentTarget: c.loopStartHandle, clientX: 250, clientY: 0, preventDefault() {} };
    c.startLoopDrag(pointer, "start");
    if (moved) c.moveLoopDrag(pointer);
    const expected = moved ? c.practiceLoopRange.startBeat * c.getScaledBeatSeconds() : 2.2;
    life.hide(); life.show(); c.finishLoopDrag({ ...pointer, type: "pointerup" });
    assert.equal(c.shouldLoop(), false); assert.equal(c.pausedSession.mode, "demo");
    near(c.pausedSession.seconds, expected); assert.equal(c.pauseBtn.disabled, false);
    await finishPreparation(h); near(c.currentPracticeTime(), expected); assert.equal(c.demoMode, true);
  });
}

for (const action of ["seek", "loop", "loop-key", "loop-drag"]) {
  test(`a completed paused ${action} keeps the original mode and a new explicit Continue target`, async () => {
    const h = harness({ beats: [0,1,2,4,5,6,8], range: action.includes("loop-") ? { startBeat: 4, endBeat: 6 } : null });
    const { c } = h;
    await begin(h, "demo", 2.2); c.pausePractice();
    if (action === "seek") c.seekToSongTime(.5);
    if (action === "loop") c.togglePracticeLoop();
    if (action === "loop-key") c.handleLoopKeydown({ key: "ArrowRight", preventDefault() {} }, "start");
    if (action === "loop-drag") {
      const pointer = { pointerId: 1, currentTarget: c.loopStartHandle, clientX: 250, clientY: 0, preventDefault() {} };
      c.startLoopDrag(pointer, "start"); c.moveLoopDrag(pointer); c.finishLoopDrag({ ...pointer, type: "pointerup" });
    }
    const expected = action === "seek" ? .5 : c.practiceLoopRange.startBeat * c.getScaledBeatSeconds();
    assert.equal(c.shouldLoop(), false); assert.equal(c.pausedSession.mode, "demo"); near(c.pausedSession.seconds, expected);
    assert.equal(c.pauseBtn.textContent, "继续"); assert.equal(c.pauseBtn.disabled, false);
    const before = h.names();
    await finishPreparation(h); assert.equal(c.demoMode, true); near(c.currentPracticeTime(), expected);
    const targetBeat = expected / c.getScaledBeatSeconds();
    assert.deepEqual(h.names().slice(before.length), [`backing:${targetBeat}`, `melody:${targetBeat}`]);
  });
}

for (const mode of ["demo", "practice"]) for (const range of [null, { startBeat: 4, endBeat: 6 }]) {
  test(`${mode}: interrupted ${range ? "A" : "initial"} count-in has exactly one fresh Continue preparation`, async () => {
    const h = harness({ beats: [0,4,5,6,8], range }); const { c } = h; const life = lifecycle(h);
    const start = (range?.startBeat || 0) * .5;
    await begin(h, mode, start - .75); assert.deepEqual(h.names(), []);
    life.hide(); life.show(); await c.continuePractice();
    near(c.currentPracticeTime(), start);
    const duration = c.resumePreparation.duration;
    h.healthy(duration - .001); assert.deepEqual(h.names(), []);
    h.advance(.001); h.tick();
    near(c.currentPracticeTime(), start); assert.equal(c.resumePreparation, null);
    assert.deepEqual(h.names(), [`backing:${start / .5}`, ...(mode === "demo" ? [`melody:${start / .5}`] : [])]);
    assert.equal(c.preparationCue.hidden, true);
    assert.equal(c.statusText.textContent, mode === "demo" ? "示范中" : "练习中");
  });
}

for (const action of ["seek", "speed", "loop-key", "own-play", "demo"]) {
  test(`${action} invalidates an earlier loop drag's pointerup resume intent`, async () => {
    const h = harness(); const { c } = h;
    await begin(h, "demo", 2.2);
    const pointer = { pointerId: 4, currentTarget: c.loopStartHandle, preventDefault() {} };
    c.startLoopDrag(pointer, "start");
    if (action === "seek") c.seekToSongTime(2.5);
    if (action === "speed") { c.speedSlider.value = ".5"; c.applySpeed(); }
    if (action === "loop-key") c.handleLoopKeydown({ key: "ArrowRight", preventDefault() {} }, "start");
    if (action === "own-play") await c.startPractice();
    if (action === "demo") await c.playDemo();
    const position = c.currentPracticeTime(); const running = c.shouldLoop(); const mode = c.demoMode;
    c.finishLoopDrag({ ...pointer, type: "pointerup" });
    near(c.currentPracticeTime(), position); assert.equal(c.shouldLoop(), running); assert.equal(c.demoMode, mode);
    assert.equal(c.loopDragWasPlaying, false);
  });
}

for (const range of [null, { startBeat: 4, endBeat: 6 }]) {
  test(`changing speed after paused ${range ? "A" : "initial"} countdown retains a single fresh preparation`, async () => {
    const h = harness({ beats: [0,4,5,6,8], range }); const { c } = h;
    await begin(h, "demo", (range?.startBeat || 0) * .5 - .75); c.pausePractice();
    c.speedSlider.value = ".5"; c.applySpeed();
    near(c.pausedSession.seconds, range?.startBeat || 0);
    await finishPreparation(h);
    near(c.currentPracticeTime(), range?.startBeat || 0);
    assert.equal(c.preparationCue.hidden, true);
    assert.deepEqual(h.names(), [`backing:${range?.startBeat || 0}`, `melody:${range?.startBeat || 0}`]);
  });
}

test("lifecycle pause retains the last visible layout-render position as well as RAF positions", async () => {
  const h = harness({ beats: [0,1,2,3,4], range: null }); const { c } = h; const life = lifecycle(h);
  await begin(h, "demo", .01); h.advance(.7); c.renderBoard(c.currentPracticeTime());
  const visible = c.currentPracticeTime(); const before = h.names(); h.advance(10); life.hide();
  near(c.currentPracticeTime(), visible); life.show(); await finishPreparation(h);
  assert.deepEqual(h.names(), before); near(c.currentPracticeTime(), visible);
});

test("production AudioContext setup listens for state changes and never resumes from lifecycle handlers", async () => {
  const h = audioHarness(); const { c } = h; const context = c.audioContext;
  const listeners = new Map(); context.addEventListener = (name, callback) => listeners.set(name, callback);
  context.state = "suspended"; c.audioContext = null;
  c.window.AudioContext = function () { return context; };
  production("ensureAudioContext", c);
  await c.ensureAudioContext();
  assert.equal(h.resumes(), 1); assert.equal(listeners.get("statechange"), c.handleAudioContextStateChange);
  c.practiceRunning = true; c.practiceStartAt = 10000; c.lastPracticeFrameSeconds = 0;
  context.state = "interrupted"; listeners.get("statechange")();
  assert.equal(c.shouldLoop(), false); assert.equal(h.resumes(), 1);
  const saved = JSON.stringify(c.pausedSession);
  context.state = "running"; listeners.get("statechange")();
  assert.equal(c.shouldLoop(), false); assert.equal(JSON.stringify(c.pausedSession), saved);
  c.document.hidden = true; context.state = "suspended"; await c.ensureAudioContext();
  assert.equal(h.resumes(), 1);
});

for (const mode of ["practice", "demo"]) {
  test(`ordinary loop turnover does not cancel a pending explicit ${mode} request`, async () => {
    const h = harness(); const { c } = h;
    await begin(h, mode === "demo" ? "practice" : "demo", 2.9);
    const gate = deferred(); c.ensureAudioContext = () => gate.promise;
    const start = mode === "demo" ? c.playDemo() : c.startPractice();
    h.advance(.11); h.tick(); assert.equal(c.pendingPlayback.mode, mode);
    gate.resolve(); await start;
    assert.equal(c.demoMode, mode === "demo"); assert.equal(c.practiceRunning, mode === "practice");
  });
}

test("visual own-play can Continue when AudioContext is unavailable, retaining the existing physical-practice fallback", async () => {
  const h = harness({ range: null }); const { c } = h;
  c.audioContext = null; c.console = { warn() {} };
  c.ensureAudioContext = async () => { throw new Error("unsupported"); };
  await c.startPractice(); h.stepTo(1.25); h.tick(); c.pausePractice();
  await finishPreparation(h); assert.equal(c.practiceRunning, true); near(c.currentPracticeTime(), 1.25);
  assert.deepEqual(h.names(), []);
});
