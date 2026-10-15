import { selectKeyGuidance } from "../src/key-guidance.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats, getPracticeTotalBeats } from "../src/practice-loop.js";
import { saveSongSpeed, readSongSpeed, recordPractice, readSongAccompaniment, saveSongAccompaniment } from "../src/practice-preferences.js";
import { NOTE_INDEX } from "../src/songs.js";
import { getSongLibrary, getPracticeSongId, getEventTotalBeats, getSongBaseId, getSongAccompanimentProvider, hasMatchingPracticeMelody, getSongArchiveDownload, getSongVersionRank } from "../src/song-store.js";

// Point at an untouched pre-fix app to verify these regressions reject it.
const source = await readFile(process.env.KALIMBA_PROGRESS_APP_SOURCE || new URL("../src/app.js", import.meta.url), "utf8");
const functions = [
  "beginPassPreparation",
  "handleProgressPointer", "startProgressSeek", "finishProgressSeek", "moveProgressSeek", "getProgressSeekSeconds", "handleProgressKeydown",
  "getSongDefaultSpeedFactor", "applySongDefaultSpeed", "toggleAccompaniment",
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
  let capture = null;
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
    focus() {}, setPointerCapture(id) { capture = id; },
    hasPointerCapture(id) { return capture === id; },
    releasePointerCapture(id) { assert.equal(capture, id); capture = null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 })
  };
}

function harness({ beats = [0, 2, 2.4, 2.8, 4, 5, 8], backingBeats = beats, range = null } = {}) {
  let now = 10000;
  let frameId = 0;
  const frames = new Map();
  const sounds = [];
  const saved = new Map();
  const notes = (prefix, onsets = beats) => onsets.map((beat, id) => ({
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
    APP_NAME: "Test", songEvents, accompanimentEvents: notes("backing:", backingBeats), noteEls: new Map(songEvents.map(e => [e.id, element()])),
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
    showKeyWidthStatus() {}, playKalimbaNote: (name, duration, velocity, timing) => sounds.push({ name, duration, velocity, timing, seconds: c.currentPracticeTime() })
  };
  for (const name of ["boardShell", "targetText", "statusText", "pauseBtn", "repeatBtn", "loopSelection", "loopStartHandle", "loopEndHandle", "preparationCue", "songProgress", "songProgressFill", "songProgressThumb", "songElapsed", "songRemaining", "speedSlider", "speedValue", "accompanimentStyleSelect", "accompanimentBtn", "accompanimentVolumeWrap", "accompanimentVolumeSlider", "accompanimentVolumeValue"]) c[name] = element();
  const constants = ["practiceOnsetStaleSeconds", "practiceAudioReadyTimeoutMs"].map(name => {
    const declaration = source.match(new RegExp(`^    const ${name} = [^;]+;`, "m"));
    assert.ok(declaration, name);
    return declaration[0];
  }).join("\n");
  runInNewContext(constants + "\n" + runtime, c);
  return {
    c, sounds, frames,
    names: () => sounds.map(sound => sound.name),
    advance(seconds) { now += seconds * 1000; },
    healthy(seconds) { this.tick(); const start = now, count = Math.max(1, Math.ceil(seconds / .02)); for (let index = 0; index < count; index++) { now = start + seconds * 1000 * (index + 1) / count; this.tick(); } },
    tick() {
      const pending = [...frames]; frames.clear();
      for (const [, callback] of pending) callback();
    }
  };
}

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }

function pointer(h, seconds, pointerId = 17) {
  return { pointerId, button: 0, isPrimary: true, type: "pointerdown",
    clientX: 1000 * seconds / h.c.getSongProgressDuration(), clientY: 0, preventDefault() {} };
}

async function beginSeek(h, mode, seconds) {
  await h.c[mode === "demo" ? "playDemo" : "startPractice"]();
  h.c.startProgressSeek(pointer(h, seconds));
  near(h.c.currentPracticeTime(), seconds);
  assert.equal(h.c.seekingWithProgress, true);
}

function healthyFrames(h, seconds) {
  const count = Math.ceil(seconds / .02);
  for (let i = 0; i < count; i++) { h.advance(seconds / count); h.tick(); }
}

function assertActive(h, mode) {
  assert.equal(h.c.shouldLoop(), true, h.c.statusText.textContent);
  assert.equal(h.c.demoMode, mode === "demo");
  assert.equal(h.c.practiceRunning, mode === "practice");
  assert.equal(h.c.pausedSession, null);
}

function backingNames(h) { return h.names().filter(name => name.startsWith("backing:")); }
function melodyNames(h) { return h.names().filter(name => name.startsWith("melody:")); }
function finish(h, type = "pointerup") { h.c.finishProgressSeek({ ...pointer(h, 0), type }); }

for (const mode of ["practice", "demo"]) {
  for (const enabled of [true, false]) for (const ending of ["pointerup", "pointercancel"]) {
    test(`${mode}, backing ${enabled}, ${ending}: stationary healthy hold skips backing without freezing or replaying`, async () => {
      const h = harness(); const { c } = h;
      c.accompanimentEnabled = enabled;
      await beginSeek(h, mode, .95);
      healthyFrames(h, .6);
      assertActive(h, mode); near(c.currentPracticeTime(), 1.55);
      assert.equal(c.seekingWithProgress, true);
      assert.deepEqual(backingNames(h), []);
      assert.deepEqual(melodyNames(h), mode === "demo" ? ["melody:2", "melody:2.4", "melody:2.8"] : []);
      assert.ok(c.accompanimentEvents.filter(event => event.beat <= 2.8).every(event => event.played));
      assert.equal(c.accompanimentEvents.find(event => event.beat === 4).played, false);
      finish(h, ending);
      assert.equal(c.seekingWithProgress, false);
      assert.equal(c.songProgress.hasPointerCapture(17), false);
      assert.equal(c.songProgress.classList.contains("seeking"), false);
      if (!enabled) c.toggleAccompaniment();
      healthyFrames(h, .51);
      assertActive(h, mode);
      assert.deepEqual(backingNames(h), ["backing:4"]);
      assert.deepEqual(melodyNames(h), mode === "demo" ? ["melody:2", "melody:2.4", "melody:2.8", "melody:4"] : []);
    });
  }

  test(`${mode}: turning backing on/off during a held drag stays silent and leaves only future attacks`, async () => {
    const h = harness(); const { c } = h;
    c.accompanimentEnabled = false;
    await beginSeek(h, mode, .95); healthyFrames(h, .2);
    c.toggleAccompaniment(); healthyFrames(h, .2);
    c.toggleAccompaniment(); c.toggleAccompaniment(); healthyFrames(h, .2);
    assertActive(h, mode); assert.equal(c.accompanimentEnabled, true);
    assert.deepEqual(backingNames(h), []);
    finish(h); healthyFrames(h, .51);
    assertActive(h, mode); assert.deepEqual(backingNames(h), ["backing:4"]);
  });

  for (const ending of ["pointerup", "pointercancel", "speed-control"]) {
    test(`${mode}, ${ending}: suppressed backing between checkpoints is retired before the next frame`, async () => {
      const h = harness({ beats: [0, 6, 8], backingBeats: [0, 2, 2.2, 4, 6, 8] }); const { c } = h;
      await beginSeek(h, mode, .95);
      h.advance(.4); // No melody onset is due, but two suppressed backing attacks elapsed.
      if (ending === "speed-control") { c.speedSlider.value = "1"; c.applySpeed(); }
      else finish(h, ending);
      assert.equal(c.seekingWithProgress, false);
      assert.deepEqual(backingNames(h), []);
      assert.ok(c.accompanimentEvents.filter(event => event.beat <= 2.2).every(event => event.played));
      h.tick(); assertActive(h, mode);
      healthyFrames(h, .7);
      assert.deepEqual(backingNames(h), ["backing:4"]);
    });
  }

  test(`${mode}: direct renders commit the suppressed backing checkpoint; direct scheduler stays silent`, async () => {
    const h = harness(); const { c } = h;
    await beginSeek(h, mode, .95);
    h.advance(.1); c.playAccompanimentEvents(c.currentPracticeTime());
    assert.deepEqual(backingNames(h), []);
    c.renderBoard(c.currentPracticeTime());
    near(c.lastPracticeFrameSeconds, 1.05);
    assert.equal(c.accompanimentEvents.find(event => event.beat === 2).played, true);
    h.advance(.1); c.renderBoard(c.currentPracticeTime());
    assertActive(h, mode);
    finish(h); h.tick();
    assert.deepEqual(backingNames(h), []);
    healthyFrames(h, .1);
    assert.deepEqual(backingNames(h), ["backing:2.4"]);
  });

  test(`${mode}: forward/backward pointer moves reset intentional targets without changing melody seeking`, async () => {
    const h = harness(); const { c } = h;
    await beginSeek(h, mode, .95); healthyFrames(h, .4);
    const beforeForeign = c.currentPracticeTime();
    c.moveProgressSeek(pointer(h, 3, 99)); c.finishProgressSeek({ ...pointer(h, 3, 99), type: "pointerup" });
    near(c.currentPracticeTime(), beforeForeign); assert.equal(c.seekingWithProgress, true);
    c.moveProgressSeek(pointer(h, 1.95)); healthyFrames(h, .2);
    assertActive(h, mode); assert.deepEqual(backingNames(h), []);
    c.moveProgressSeek(pointer(h, .95));
    assert.equal(c.accompanimentEvents.find(event => event.beat === 2).played, false);
    finish(h); healthyFrames(h, .1);
    assertActive(h, mode);
    assert.deepEqual(backingNames(h), ["backing:2"]);
    assert.deepEqual(melodyNames(h), mode === "demo" ? ["melody:2", "melody:2.4", "melody:4", "melody:2"] : []);
  });

  test(`${mode}: an immediate release keeps the exact selected backing onset eligible once`, async () => {
    const h = harness(); const { c } = h;
    await beginSeek(h, mode, 1);
    assert.equal(c.accompanimentEvents.find(event => event.beat === 2).played, false);
    finish(h); h.tick(); h.tick();
    assertActive(h, mode);
    assert.deepEqual(backingNames(h), ["backing:2"]);
    assert.deepEqual(melodyNames(h), mode === "demo" ? ["melody:2"] : []);
  });

  for (const ending of ["holding", "pointerup", "pointercancel"]) {
    test(`${mode}, ${ending}: real melody stalls still pause at the previous visible checkpoint`, async () => {
      const h = harness(); const { c } = h;
      await beginSeek(h, mode, .95);
      h.advance(1);
      if (ending !== "holding") finish(h, ending);
      h.tick();
      assert.equal(c.shouldLoop(), false); assert.equal(c.statusText.textContent, "播放卡顿，已暂停");
      near(c.pausedSession.seconds, .95);
      assert.equal(c.pausedSession.mode, mode);
      assert.deepEqual(h.names(), []);
      assert.equal(c.seekingWithProgress, false);
      assert.equal(c.accompanimentEvents.find(event => event.beat === 2).played, false);
      await c.continuePractice(); h.healthy(c.resumePreparation.duration);
      healthyFrames(h, .1);
      assert.deepEqual(backingNames(h), ["backing:2"]);
      assert.deepEqual(melodyNames(h), mode === "demo" ? ["melody:2"] : []);
    });
  }

  test(`${mode}: backing-only stalls after release retain the ordinary watchdog and explicit recovery`, async () => {
    const h = harness({ beats: [0, 6, 8], backingBeats: [0, 2, 4, 6, 8] }); const { c } = h;
    await beginSeek(h, mode, .95); healthyFrames(h, .6); finish(h);
    const checkpoint = c.lastPracticeFrameSeconds;
    h.advance(1); h.tick();
    assert.equal(c.shouldLoop(), false); assert.equal(c.statusText.textContent, "播放卡顿，已暂停");
    near(c.pausedSession.seconds, checkpoint); assert.equal(c.pausedSession.mode, mode);
    assert.deepEqual(backingNames(h), []);
    assert.equal(c.accompanimentEvents.find(event => event.beat === 4).played, false);
    await c.continuePractice();
    assert.ok(c.resumePreparation);
    h.healthy(c.resumePreparation.duration);
    assertActive(h, mode); near(c.currentPracticeTime(), checkpoint);
    healthyFrames(h, .5);
    assert.deepEqual(backingNames(h), ["backing:4"]);
  });

  for (const interruption of ["hidden", "audio-suspended"]) {
    test(`${mode}, ${interruption}: lifecycle freezes the seek checkpoint without consuming hidden future backing`, async () => {
      const h = harness(); const { c } = h;
      await beginSeek(h, mode, .95); healthyFrames(h, .1);
      const checkpoint = c.lastPracticeFrameSeconds;
      const before = h.names();
      h.advance(1);
      if (interruption === "hidden") c.document.hidden = true;
      else c.audioContext.state = "suspended";
      // A release may arrive before the notification/RAF that observes the interruption.
      finish(h); h.tick();
      assert.equal(c.shouldLoop(), false); near(c.pausedSession.seconds, checkpoint);
      assert.equal(c.accompanimentEvents.find(event => event.beat === 2.4).played, false);
      assert.deepEqual(h.names(), before);
      c.document.hidden = false; c.audioContext.state = "running";
      c.moveProgressSeek(pointer(h, 3)); finish(h); h.tick();
      assert.equal(c.shouldLoop(), false); near(c.pausedSession.seconds, checkpoint);
    });
  }

  test(`${mode}: paused seek release keeps its Continue target and does not auto-start`, async () => {
    const h = harness(); const { c } = h;
    await beginSeek(h, mode, .95); healthyFrames(h, .1); c.pausePractice();
    const before = h.names();
    c.startProgressSeek(pointer(h, 2)); h.advance(.6); h.tick(); finish(h, "pointercancel");
    assert.equal(c.shouldLoop(), false); near(c.pausedSession.seconds, 2);
    assert.equal(c.pausedSession.mode, mode); assert.deepEqual(h.names(), before);
    assert.equal(c.accompanimentEvents.find(event => event.beat === 4).played, false);
    await c.continuePractice(); h.healthy(c.resumePreparation.duration);
    assertActive(h, mode); near(c.currentPracticeTime(), 2);
    assert.equal(backingNames(h).filter(name => name === "backing:4").length, 1);
  });

  for (const duration of [.12, .4]) {
    test(`${mode}: seek hold ${duration}s near exclusive B skips old backing and repeats A once`, async () => {
      const h = harness({ beats: [0, 2, 5.8, 6, 8], range: { startBeat: 2, endBeat: 6 } }); const { c } = h;
      await beginSeek(h, mode, 2.85); healthyFrames(h, duration);
      assertActive(h, mode); assert.deepEqual(backingNames(h), []);
      assert.ok(!h.names().includes("melody:6"));
      finish(h); healthyFrames(h, .2);
      assertActive(h, mode); assert.ok(c.currentPracticeTime() < 1, "loop has entered its A preparation");
      assert.deepEqual(backingNames(h), []);
      assert.ok(!h.names().includes("melody:6"));
      for (let frame = 0; frame < 500 && !backingNames(h).includes("backing:2"); frame++) healthyFrames(h, .02);
      assert.deepEqual(backingNames(h), ["backing:2"]);
      assert.equal(melodyNames(h).filter(name => name === "melody:2").length, mode === "demo" ? 1 : 0);
      assert.ok(!h.names().includes("backing:5.8")); assert.ok(!h.names().includes("backing:6"));
    });
  }

  for (const ending of ["holding", "pointerup"]) {
    test(`${mode}, ${ending}: current async note deadlines still expire and older seek generations stay canceled`, async () => {
      const h = harness({ beats: [0, 6, 8] }); const { c } = h;
      await beginSeek(h, mode, 1);
      const old = c.getPracticeNoteTiming(1);
      c.moveProgressSeek(pointer(h, 1));
      assert.equal(c.isPracticeNoteCurrent(old), false); assertActive(h, mode);
      const current = c.getPracticeNoteTiming(1);
      healthyFrames(h, .14);
      if (ending === "pointerup") finish(h);
      h.advance(.01);
      assert.equal(c.isPracticeNoteCurrent(current), false);
      assertActive(h, mode); assert.equal(c.pausedSession, null);
      near(c.lastPracticeFrameSeconds, 1.14);
    });
  }
}

// The exact field reproduction uses the same normalized song-library/provider
// path as production, rather than an invented approximation of Birthday.
for (const mode of ["practice", "demo"]) for (const enabled of [true, false]) {
  test(`normalized Birthday 0.55/light, ${mode}, backing ${enabled}: 600ms stationary hold and later backing`, async () => {
    const h = harness(); const { c } = h;
    const previousStorage = globalThis.localStorage;
    try { globalThis.localStorage = { getItem: () => null }; c.songLibrary = getSongLibrary(); }
    finally {
      if (previousStorage === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previousStorage;
    }
    c.setCurrentSong("birthday");
    // This regression intentionally stays at 0.55x; first-open now defaults to 1.0x.
    c.speedSlider.value = ".55"; c.applySpeed();
    c.accompanimentStyleSelect.value = "light"; c.changeAccompanimentStyle();
    if (!enabled) { c.accompanimentStyleSelect.value = "off"; c.changeAccompanimentStyle(); }
    assert.equal(c.speedFactor, .55); assert.equal(c.accompanimentEnabled, enabled);
    const skipped = c.accompanimentEvents.find(event => event.beat >= 2);
    assert.equal(skipped.beat, 4);
    const target = c.getAccompanimentTime(skipped) - .05;
    assert.ok(Math.abs(target - 4.1458) < .0001);
    await beginSeek(h, mode, target);
    healthyFrames(h, .6);
    assertActive(h, mode); near(c.currentPracticeTime(), target + .6);
    assert.equal(skipped.played, true);
    // Backing has a distinct scaled velocity in this real song.
    assert.ok(c.songEvents.every(event => event.notes.every(note => note.velocity >= .5)));
    assert.ok(c.accompanimentEvents.every(event => event.notes.every(note => note.velocity * c.accompanimentVolume < .5)));
    assert.equal(h.sounds.filter(sound => sound.velocity < .5).length, 0);
    finish(h);
    if (!enabled) { c.accompanimentStyleSelect.value = "light"; c.changeAccompanimentStyle(); }
    const next = c.accompanimentEvents.find(event => c.getAccompanimentTime(event) > c.currentPracticeTime());
    const nextTime = c.getAccompanimentTime(next);
    healthyFrames(h, nextTime + .04 - c.currentPracticeTime());
    assertActive(h, mode);
    const backing = h.sounds.filter(sound => sound.velocity < .5);
    assert.equal(backing.length, next.notes.length);
    assert.ok(backing.every(sound => sound.seconds >= nextTime && sound.seconds < nextTime + .021));
  });
}

// A held seek can defer the A/B wrap past the ordinary full-song tail. The
// selected loop still owns that boundary: it must not become a finished song.
function birthdayTailHarness(speed, enabled) {
  const h = harness(); const { c } = h;
  const previousStorage = globalThis.localStorage;
  try { globalThis.localStorage = { getItem: () => null }; c.songLibrary = getSongLibrary(); }
  finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
  c.setCurrentSong("birthday");
  c.speedSlider.value = String(speed); c.applySpeed();
  c.accompanimentStyleSelect.value = enabled ? "light" : "off"; c.changeAccompanimentStyle();
  assert.equal(c.accompanimentEnabled, enabled);
  return h;
}

for (const speed of [.55, 1.4]) for (const mode of ["practice", "demo"]) {
  for (const enabled of [true, false]) for (const ending of ["pointerup", "pointercancel"]) {
    test(`Birthday tail-loop held seek ${speed}x, ${mode}, backing ${enabled}, ${ending}: full-song tail cannot end the selected loop`, async () => {
      const h = birthdayTailHarness(speed, enabled); const { c } = h;
      const spb = c.getScaledBeatSeconds(), end = 25 * spb;
      c.seekToSongTime(22 * spb); c.togglePracticeLoop();
      assert.deepEqual(c.practiceLoopRange, { startBeat: 22, endBeat: 25 });
      await beginSeek(h, mode, end - .05);
      healthyFrames(h, 1.2); // Past both B and the ordinary +0.9s full-song tail.
      assertActive(h, mode);
      assert.ok(c.currentPracticeTime() > c.getSongEndSeconds());
      assert.equal(c.seekingWithProgress, true);
      assert.equal(c.pauseBtn.disabled, false);
      assert.deepEqual(c.practiceLoopRange, { startBeat: 22, endBeat: 25 });
      assert.deepEqual(h.names(), [], "no skipped melody/backing is backfilled during the hold");
      finish(h, ending); h.tick();
      assertActive(h, mode); assert.equal(c.seekingWithProgress, false);
      near(c.currentPracticeTime(), 22 * spb - c.getSessionLeadSeconds());
      assert.equal(Number(c.preparationCue.textContent), getPreparationBeats(spb, c.getVisualFallLeadSeconds()));
      assert.deepEqual(c.practiceLoopRange, { startBeat: 22, endBeat: 25 });
      assert.deepEqual(h.names(), []);
      healthyFrames(h, c.getSessionLeadSeconds() + .02);
      assertActive(h, mode);
      const melody = h.sounds.filter(sound => sound.velocity >= .5);
      assert.deepEqual(melody.map(sound => sound.name), mode === "demo" ? ["D5"] : []);
      assert.ok(h.sounds.every(sound => sound.seconds >= 22 * spb && sound.seconds < 22 * spb + .021));
      assert.ok(c.currentPracticeTime() < 23 * spb);
      c.pausePractice();
      assert.equal(c.pausedSession.mode, mode);
      assert.deepEqual(c.practiceLoopRange, { startBeat: 22, endBeat: 25 });
    });
  }
  test(`Birthday ordinary held seek ${speed}x, ${mode}: without A/B it still reaches the real song ending`, async () => {
    const h = birthdayTailHarness(speed, true); const { c } = h;
    await beginSeek(h, mode, 25 * c.getScaledBeatSeconds() - .05);
    healthyFrames(h, 1.2);
    assert.equal(c.shouldLoop(), false);
    assert.equal(c.practiceLoopRange, null);
    assert.equal(c.statusText.textContent, mode === "demo" ? "示范结束" : "练习结束");
    assert.equal(c.pauseBtn.disabled, true);
    finish(h); h.tick();
    assert.equal(c.shouldLoop(), false);
    assert.deepEqual(h.names(), []);
  });
}
