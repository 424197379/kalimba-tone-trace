import { selectKeyGuidance } from "../../src/key-guidance.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats, getPracticeTotalBeats } from "../../src/practice-loop.js";
import { saveSongSpeed, readSongSpeed, recordPractice, readSongAccompaniment, saveSongAccompaniment } from "../../src/practice-preferences.js";
import { NOTE_INDEX } from "../../src/songs.js";
import { getPracticeSongs, getSongLibrary, getPracticeSongId, getEventTotalBeats, getSongBaseId, getSongAccompanimentProvider, hasMatchingPracticeMelody, getSongArchiveDownload, getSongVersionRank } from "../../src/song-store.js";

const source = await readFile(process.env.KALIMBA_STARTUP_APP_SOURCE || new URL("../../src/app.js", import.meta.url), "utf8");
const functions = [
  "restartPractice", "openSongLibrary", "getProgressSeekSeconds", "handleProgressPointer", "startProgressSeek", "moveProgressSeek", "finishProgressSeek", "handleProgressKeydown", "scheduleLayoutRefresh",
  "beginPassPreparation",
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
  const match = source.match(new RegExp(`^    (?:async )?function ${name}\\([^]*?^    \}`, "m"));
  if (!match && name === "beginPassPreparation") return ""; // Pre-fix source still exercises the behavioral assertions.
  assert.ok(match, `Missing production function ${name}`);
  return match[0];
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
    pendingPlayback: null, pausedSession: null, resumePreparation: null, passPreparation: null, lastPracticeFrameSeconds: null,
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
  for (const name of ["boardShell", "targetText", "statusText", "playbackNotice", "pauseBtn", "repeatBtn", "loopSelection", "loopStartHandle", "loopEndHandle", "preparationCue", "songProgress", "songProgressFill", "songProgressThumb", "songElapsed", "songRemaining", "speedSlider", "speedValue", "accompanimentStyleSelect", "accompanimentBtn", "accompanimentVolumeWrap", "accompanimentVolumeSlider", "accompanimentVolumeValue"]) c[name] = element();
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
    healthy(seconds) { this.tick(); const count = Math.max(1, Math.ceil(seconds / .02)); for (let index = 0; index < count; index++) { now += seconds * 1000 / count; this.tick(); } },
    at(seconds) { c.passPreparation = null; c.pausedElapsed = seconds; c.practiceStartAt = now - seconds * 1000; },
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
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

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
  h.healthy(.001);
  assert.equal(c.resumePreparation, null);
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



export { harness, audioHarness, production, lifecycle, element };
