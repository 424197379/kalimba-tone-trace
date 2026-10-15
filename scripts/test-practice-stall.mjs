import { selectKeyGuidance } from "../src/key-guidance.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats, getPracticeTotalBeats } from "../src/practice-loop.js";
import { saveSongSpeed, readSongSpeed, recordPractice, readSongAccompaniment, saveSongAccompaniment } from "../src/practice-preferences.js";
import { NOTE_INDEX } from "../src/songs.js";
import { getPracticeSongs, getSongLibrary, getPracticeSongId, getEventTotalBeats, getSongBaseId, getSongAccompanimentProvider, hasMatchingPracticeMelody, getSongArchiveDownload, getSongVersionRank } from "../src/song-store.js";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const functions = [
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
    healthy(seconds) { this.tick(); const start = now, count = Math.max(1, Math.ceil(seconds / .02)); for (let index = 0; index < count; index++) { now = start + seconds * 1000 * (index + 1) / count; this.tick(); } },
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


// Stalls are deliberately injected with raw clock advancement. These probes
// execute the production admission, pause, Continue and note-start functions.
for (const gap of [.1, .25, .5, .999999, 1, 1.000001]) {
  test(`dense 59.5 ms spacing: ${gap * 1000} ms frame gap ${gap < 1 ? "advances without stale audio" : "pauses before both streams"}`, async () => {
    const h = harness({ beats: Array.from({ length: 40 }, (_, i) => i * .119047619), range: null });
    const { c } = h;
    await c.playDemo(); h.at(.001); h.tick(); const before = h.names();
    h.advance(gap); h.tick();
    assert.equal(c.shouldLoop(), gap < 1);
    if (gap < 1) {
      const now = .001 + gap;
      const eligible = c.songEvents.filter(event => c.getEventTime(event) > .001 && c.getEventTime(event) <= now
        && now - c.getEventTime(event) < .15).map(event => event.beat);
      assert.deepEqual(h.names().slice(before.length), [
        ...eligible.map(beat => `backing:${beat}`), ...eligible.map(beat => `melody:${beat}`)
      ]);
      near(c.lastPracticeFrameSeconds, now);
      assert.equal(c.pausedSession, null);
    } else {
      assert.deepEqual(h.names(), before); near(c.pausedSession.seconds, .001);
      assert.equal(c.pauseBtn.textContent, "继续"); assert.match(c.statusText.textContent, /卡顿/);
      assert.equal(c.playbackNotice.hidden, false); assert.match(c.playbackNotice.textContent, /继续/);
      const saved = JSON.stringify(c.pausedSession);
      h.advance(10); h.tick(); assert.equal(JSON.stringify(c.pausedSession), saved);
    }
  });
}

for (const age of [.149999, .15, .150001]) {
  test(`nominal audio freshness boundary at ${age * 1000} ms drops only expired attacks, not transport`, async () => {
    const h = harness({ beats: [0, 1, 8], range: null }); const { c } = h;
    await c.playDemo(); h.at(0); h.tick(); const before = h.names();
    h.advance(.5 + age); h.tick();
    assert.equal(c.shouldLoop(), true);
    assert.equal(h.names().length - before.length, age < .15 ? 2 : 0);
    assert.equal(c.songEvents[1].demoPlayed, true); assert.equal(c.accompanimentEvents[1].played, true);
    h.advance(.01); h.tick(); assert.equal(h.names().length - before.length, age < .15 ? 2 : 0);
  });
}

for (const mode of ["demo", "practice"]) for (const entry of ["animationLoop", "renderBoard", "playAccompanimentEvents"]) {
  test(`${mode} direct ${entry} guards real time before moving the checkpoint`, async () => {
    const h = harness({ beats: [0, 1, 2, 3, 8], range: null }); const { c } = h;
    c.accompanimentEnabled = mode === "demo";
    await c[mode === "demo" ? "playDemo" : "startPractice"]();
    h.at(.01); h.tick(); const before = h.names();
    h.advance(1); c[entry](c.currentPracticeTime());
    assert.equal(c.shouldLoop(), false); near(c.pausedSession.seconds, .01);
    assert.deepEqual(h.names(), before); assert.equal(c.pausedSession.mode, mode);
    await finishPreparation(h); near(c.currentPracticeTime(), .01);
    h.advance(.5); h.tick();
    if (mode === "demo") assert.deepEqual(h.names().slice(before.length), ["backing:1", "melody:1"]);
    else assert.deepEqual(h.names(), []);
  });
}

for (const kind of ["rest", "held", "recent-onset"]) {
  test(`one-second gap during ${kind} does not pause without a stale upcoming attack`, async () => {
    const h = harness({ beats: kind === "recent-onset" ? [0, 1.9, 8] : [0, 8], range: null }); const { c } = h;
    if (kind === "held") c.songEvents[0].duration = c.accompanimentEvents[0].duration = 4;
    await c.playDemo(); h.at(.01); h.tick(); const before = h.names();
    h.advance(1); h.tick(); assert.equal(c.shouldLoop(), true);
    assert.equal(h.sounds.length - before.length, kind === "recent-onset" ? 2 : 0);
  });
}

for (const gap of [.05, 1]) {
  test(`exclusive B uses actual clock, preserving near-B onset through ${gap * 1000} ms gap`, async () => {
    const h = harness({ beats: [4, 5.8, 5.95, 6], range: { startBeat: 4, endBeat: 6 } }); const { c } = h;
    await c.playDemo(); h.stepTo(2.96); h.tick(); const before = h.names();
    h.advance(gap); h.tick();
    assert.equal(h.sounds.length - before.length, gap === .05 ? 2 : 0);
    assert.ok(!h.names().includes("melody:6") && !h.names().includes("backing:6"));
    if (gap === 1) {
      near(c.pausedSession.seconds, 2.96);
      await finishPreparation(h); near(c.currentPracticeTime(), 2.96); assert.deepEqual(h.names(), before);
      h.advance(.015); h.tick(); assert.deepEqual(h.names().slice(before.length), ["backing:5.95", "melody:5.95"]);
      h.advance(.025); h.tick(); assert.ok(c.currentPracticeTime() < 2);
    }
  });
}

test("stale next onset during held note pauses without reattacking the hold on Continue", async () => {
  const h = harness({ beats: [0, 2, 2.5, 8], range: null }); const { c } = h;
  c.songEvents[0].duration = c.accompanimentEvents[0].duration = 2;
  await c.playDemo(); h.stepTo(.8); h.tick(); const before = h.names();
  h.advance(1); h.tick(); near(c.pausedSession.seconds, .8);
  await finishPreparation(h); assert.deepEqual(h.names(), before);
  h.advance(.2); h.tick(); assert.deepEqual(h.names().slice(before.length), ["backing:2", "melody:2"]);
  h.advance(.25); h.tick(); assert.deepEqual(h.names().slice(-2), ["backing:2.5", "melody:2.5"]);
});

const previousStorage = globalThis.localStorage;
let library;
try { globalThis.localStorage = { getItem: () => null }; library = getSongLibrary(); }
finally { if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage; }
const melodies = getPracticeSongs(library);
assert.equal(melodies.length, 36);
for (const song of melodies) for (const cadence of ["30fps", "jitter<=100ms"]) {
  test(`${song.id}: densest eight-beat segment at 1.4x, ${cadence}, every true attack once`, async () => {
    const h = harness({ range: null }); const { c } = h;
    c.songLibrary = library; c.setCurrentSong(song.id); c.accompanimentEnabled = false;
    c.speedSlider.value = "1.4"; c.applySpeed();
    let best = { start: 0, end: Math.min(8, c.songTotalBeats), count: 0 };
    for (const event of c.songEvents) {
      const start = event.beat;
      const end = c.songEvents.find(candidate => candidate.beat >= start + 8)?.beat ?? c.songTotalBeats;
      const count = c.songEvents.filter(candidate => candidate.beat >= start && candidate.beat < end).length;
      if (count > best.count) best = { start, end, count };
    }
    c.practiceLoopRange = { startBeat: best.start, endBeat: best.end }; c.prepareLoopStart(); await c.playDemo();
    const expected = Array.from(c.songEvents.filter(event => isBeatInLoop(event.beat, c.practiceLoopRange)).flatMap(event => event.notes.map(note => note.name)));
    const start = best.start * c.getScaledBeatSeconds(), end = best.end * c.getScaledBeatSeconds();
    h.at(start); h.tick(); let time = start, i = 0;
    const jitter = [1 / 60, 1 / 30, .08, 1 / 60, .1, .04];
    while (time < end - 1e-6) {
      const dt = Math.min(cadence === "30fps" ? 1 / 30 : jitter[i++ % jitter.length], end - 1e-6 - time);
      h.advance(dt); time += dt; h.tick(); assert.equal(c.demoMode, true, "short jitter must not trigger a pause");
    }
    assert.deepEqual(h.names(), expected);
    h.advance(2e-6); h.tick(); assert.deepEqual(h.names(), expected); assert.ok(c.currentPracticeTime() < start);
  });
}

const settle = () => new Promise(resolve => setImmediate(resolve));
for (const gap of [.1, .5]) {
  test(`actual sample source.start timeline for ${gap * 1000} ms gap`, async () => {
    const h = audioHarness(harness({ beats: [0, .119047619, .238095238, .357142857, 8], range: null })); const { c } = h;
    await c.playDemo(); h.at(.025); h.tick(); await settle(); const before = h.started().length;
    h.advance(gap); c.audioContext.currentTime += gap; h.tick(); await settle();
    const starts = h.started().slice(before).flatMap(node => node.starts);
    assert.equal(starts.length, gap === .1 ? 4 : 0);
    if (gap === .1) assert.equal(new Set(starts).size, 1, "allowed short jitter can compress adjacent attacks; no lookahead claim");
    else assert.equal(c.shouldLoop(), true, "expired sounds are skipped without a 500 ms false pause");
  });
}

for (const result of [{ duration: 2 }, null]) {
  test(`late ${result ? "decoded sample" : "synth fallback"} is discarded while healthy frames keep moving`, async () => {
    const h = audioHarness(harness({ beats: [0, 4, 8], range: null })); const { c } = h; const gate = deferred();
    c.loadKalimbaSampleBuffer = () => gate.promise;
    await c.startPractice(); h.at(0); h.tick();
    assert.equal(c.accompanimentEvents[0].played, true);
    for (let i = 0; i < 8; i++) { h.advance(.1); c.audioContext.currentTime += .1; h.tick(); }
    near(c.lastPracticeFrameSeconds, .8); assert.equal(c.practiceRunning, true);
    gate.resolve(result); await settle();
    assert.equal(h.started().length, 0); assert.equal(c.shouldLoop(), true);
    assert.equal(c.pausedSession, null); assert.equal(c.accompanimentEvents[0].played, true);
    assert.equal(c.playbackNotice.hidden, true);
    c.loadKalimbaSampleBuffer = async () => ({ duration: 2 });
    h.advance(.6); h.tick(); await settle(); assert.equal(h.started().length, 0);
    h.advance(.6); h.tick(); await settle(); assert.equal(h.started().length, 1);
  });
}

test("buffer resolution before a delayed RAF independently checks nominal onset deadline", async () => {
  const h = audioHarness(harness({ beats: [0, 4], range: null })); const { c } = h; const gate = deferred();
  c.loadKalimbaSampleBuffer = () => gate.promise;
  await c.startPractice(); h.at(.1); h.tick();
  h.advance(.05); gate.resolve({ duration: 2 }); await settle();
  assert.equal(h.started().length, 0); assert.equal(c.shouldLoop(), true);
  assert.equal(c.pausedSession, null); // .15 nominal deadline, not .25 from dispatch.
  near(c.lastPracticeFrameSeconds, .1);
});

test("the final synth boundary rechecks time after sample rejection", async () => {
  const h = audioHarness(); const { c } = h;
  c.practiceRunning = true; h.at(0); c.lastPracticeFrameSeconds = 0;
  c.playKalimbaSample = async () => { h.advance(.2); return false; };
  await c.playKalimbaNote("C4", 1, .8, c.getPracticeNoteTiming(0));
  assert.equal(h.started().length, 0); assert.equal(c.shouldLoop(), true);
  assert.equal(c.pausedSession, null);
});

for (const invalidation of ["pause", "reset", "seek", "newer-demo"]) {
  test(`${invalidation} cancels late request without pausing newer transport`, async () => {
    const h = audioHarness(harness({ beats: [0, 4], range: null })); const { c } = h; const gate = deferred();
    c.loadKalimbaSampleBuffer = () => gate.promise;
    await c.startPractice(); h.at(0); h.tick();
    if (invalidation === "pause") c.pausePractice();
    if (invalidation === "reset") c.resetPracticeState();
    if (invalidation === "seek") c.seekToSongTime(.5);
    if (invalidation === "newer-demo") await c.playDemo();
    const before = JSON.stringify(c.pausedSession), running = c.shouldLoop();
    h.advance(1); gate.resolve({ duration: 2 }); await settle();
    assert.equal(h.started().length, 0); assert.equal(c.shouldLoop(), running); assert.equal(JSON.stringify(c.pausedSession), before);
  });
}

test("manual immediate audition has no transport deadline", () => {
  const h = audioHarness(); const { c } = h;
  c.kalimbaSampleBuffers.set("C4", { duration: 2 }); h.advance(10);
  c.playKalimbaNoteImmediate("C4", 1); assert.equal(h.started().length, 1);
});

for (const mode of ["practice", "demo"]) {
  test(`${mode} awaits sample readiness before transport can advance`, async () => {
    const h = harness({ range: null }); const { c } = h; const gate = deferred();
    c.preloadKalimbaSamples = () => gate.promise; c.resetPracticeState();
    const start = c[mode === "practice" ? "startPractice" : "playDemo"](); await settle();
    assert.equal(c.shouldLoop(), false); assert.equal(c.pendingPlayback.mode, mode); assert.equal(c.statusText.textContent, "准备声音");
    const before = c.currentPracticeTime(); h.advance(.8); h.tick(); near(c.currentPracticeTime(), before); assert.deepEqual(h.names(), []);
    gate.resolve([]); await start; assert.equal(c.shouldLoop(), true); near(c.currentPracticeTime(), before);
  });
  test(`${mode} readiness timeout pauses explicitly; late completion cannot start, retry can use cache`, async () => {
    const h = audioHarness(); const { c } = h; const gate = deferred(); c.console = { warn() {}, error() {} };
    c.preloadKalimbaSamples = () => gate.promise;
    const start = c[mode === "practice" ? "startPractice" : "playDemo"](); await settle();
    const timer = [...h.timers.values()].find(timer => timer.duration === 8000); assert.ok(timer);
    h.advance(8); timer.callback(); await start;
    assert.equal(c.shouldLoop(), false); assert.equal(c.pendingPlayback, null); assert.equal(c.pauseBtn.textContent, "继续");
    assert.match(c.statusText.textContent, /声音未就绪/); const saved = JSON.stringify(c.pausedSession);
    gate.resolve([]); await settle(); assert.equal(c.shouldLoop(), false); assert.equal(JSON.stringify(c.pausedSession), saved);
    await c.continuePractice(); assert.ok(c.resumePreparation); assert.equal(c.resumePreparation.mode, mode);
  });
}

for (const action of ["hidden", "reset", "newer-demo"]) {
  test(`own-play pending sample readiness is invalidated by ${action}`, async () => {
    const h = harness({ range: null }); const { c } = h; const gate = deferred(); const life = lifecycle(h);
    c.preloadKalimbaSamples = () => gate.promise;
    const start = c.startPractice(); await settle();
    if (action === "hidden") life.hide();
    if (action === "reset") c.resetPracticeState();
    if (action === "newer-demo") { c.preloadKalimbaSamples = async () => []; await c.playDemo(); }
    const before = JSON.stringify(c.pausedSession);
    gate.resolve([]); await start;
    assert.equal(c.practiceRunning, false); assert.equal(c.demoMode, action === "newer-demo"); assert.equal(JSON.stringify(c.pausedSession), before);
  });
}

test("resolved sample failure uses existing synth fallback without waiting forever", async () => {
  const h = audioHarness(harness({ beats: [0, 4], range: null })); const { c } = h;
  c.songEvents.forEach(event => event.notes = [{ name: "C4", velocity: .8 }]);
  c.accompanimentEvents.forEach(event => event.notes = [{ name: "C4", velocity: .8 }]);
  c.preloadKalimbaSamples = async () => [null]; c.loadKalimbaSampleBuffer = async () => null;
  await c.startPractice(); h.at(0); h.tick(); await settle();
  assert.equal(c.practiceRunning, true); assert.ok(h.started().length > 0);
});

test("timed-out real sample preparation can finish caching for a later explicit Continue", async () => {
  const h = audioHarness(harness({ beats: [0, 4], range: null })); const { c } = h; const decode = deferred();
  c.console = { warn() {}, error() {} };
  c.accompanimentEvents.forEach(event => event.notes = [{ name: "C4", velocity: .8 }]);
  c.KALIMBA_SAMPLE_PATHS = new Map([["C4", "./assets/samples/c4.mp3"]]);
  c.kalimbaSamplePromises = new Map(); c.kalimbaSampleFailures = new Set(); c.kalimbaSamplePreloadPromise = null;
  c.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  c.audioContext.decodeAudioData = () => decode.promise;
  production("loadKalimbaSampleBuffer", c); production("preloadKalimbaSamples", c);
  const start = c.startPractice(); await settle();
  [...h.timers.values()].find(timer => timer.duration === 8000).callback(); await start;
  assert.equal(c.shouldLoop(), false); assert.equal(h.started().length, 0);
  const buffer = { duration: 2 }; decode.resolve(buffer); await settle();
  assert.equal(c.kalimbaSampleBuffers.get("C4"), buffer); assert.equal(c.kalimbaSampleFailures.size, 0);
  assert.equal(h.started().length, 0); assert.equal(c.shouldLoop(), false);
  await finishPreparation(h); await settle();
  assert.equal(c.practiceRunning, true); assert.equal(h.started().length, 1);
});

test("an older readiness timeout cannot pause a newer running mode", async () => {
  const h = audioHarness(); const { c } = h; const old = deferred();
  c.console = { warn() {}, error() {} }; c.preloadKalimbaSamples = () => old.promise;
  const first = c.startPractice(); await settle();
  const oldTimer = [...h.timers.values()].find(timer => timer.duration === 8000);
  c.preloadKalimbaSamples = async () => [];
  await c.playDemo(); assert.equal(c.demoMode, true);
  oldTimer.callback(); await first;
  assert.equal(c.demoMode, true); assert.equal(c.pausedSession, null);
  old.resolve([]); await settle(); assert.equal(c.demoMode, true);
});

for (const mode of ["demo", "practice"]) {
  test(`${mode}: direct layout commits backing before a later RAF stall`, async () => {
    const h = harness({ beats: [0, 1, 2, 3, 8], range: null }); const { c } = h;
    await c[mode === "demo" ? "playDemo" : "startPractice"](); h.at(.01); h.tick();
    h.advance(.54); c.renderBoard(c.currentPracticeTime());
    assert.equal(c.accompanimentEvents[1].played, true); near(c.lastPracticeFrameSeconds, .55);
    const before = h.names(); assert.equal(before.filter(name => name === "backing:1").length, 1);
    h.advance(1); h.tick(); assert.equal(c.shouldLoop(), false); near(c.pausedSession.seconds, .55);
    assert.deepEqual(h.names(), before);
    await finishPreparation(h); assert.deepEqual(h.names(), before);
    h.advance(.45); h.tick();
    assert.deepEqual(h.names().slice(before.length), ["backing:2", ...(mode === "demo" ? ["melody:2"] : [])]);
  });
}

test("paused, preparation-only, and active seek renders do not schedule backing", async () => {
  const h = harness({ beats: [0, 1, 2, 8], range: null }); const { c } = h;
  c.renderBoard(1); assert.deepEqual(h.names(), []);
  await c.startPractice(); c.pausePractice(); c.renderBoard(1); assert.deepEqual(h.names(), []);
  await c.continuePractice(); c.renderBoard(1); assert.deepEqual(h.names(), []);
  c.resetPracticeState(); await c.startPractice(); h.at(0); c.seekingWithProgress = true;
  c.renderBoard(0); assert.deepEqual(h.names(), []); assert.equal(c.accompanimentEvents[0].played, false);
});

for (const speed of [1, .5, 1.4]) for (const mode of ["practice", "demo"]) {
  test(`${mode}: speed input ${speed} before stalled RAF preserves the paused musical point`, async () => {
    const h = harness({ beats: [0, 1, 2, 3, 8], range: null }); const { c } = h;
    c.accompanimentEnabled = false;
    await c[mode === "demo" ? "playDemo" : "startPractice"](); h.at(.01); h.tick(); const before = h.names();
    h.advance(1); c.speedSlider.value = String(speed); c.applySpeed();
    assert.equal(c.shouldLoop(), false); assert.equal(c.speedFactor, speed); near(c.pausedSession.seconds, .01 / speed);
    assert.equal(c.pausedSession.mode, mode); assert.deepEqual(h.names(), before);
    await finishPreparation(h); near(c.currentPracticeTime(), .01 / speed);
    h.advance(.5 / speed); h.tick();
    if (mode === "demo") assert.deepEqual(h.names().slice(before.length), ["melody:1"]);
  });
}

for (const control of ["style", "toggle", "volume", "pause", "own-play", "demo"]) {
  const explicitRestart = control === "own-play" || control === "demo";
  test(`${control} before stalled RAF ${explicitRestart ? "explicitly begins a new prepared pass" : "cannot consume unheard melody progress"}`, async () => {
    const h = harness({ beats: [0, 1, 2, 3, 8], range: null }); const { c } = h;
    c.storeAccompanimentEnabled = () => {}; c.storeAccompanimentVolume = () => {};
    production("toggleAccompaniment", c); production("applyAccompanimentVolume", c);
    await c.startPractice(); h.at(.01); h.tick(); const before = h.names(); h.advance(1);
    if (control === "style") { c.accompanimentStyleSelect.value = "off"; c.changeAccompanimentStyle(); }
    if (control === "toggle") c.toggleAccompaniment();
    if (control === "volume") { c.accompanimentVolumeSlider.value = ".2"; c.applyAccompanimentVolume(); }
    if (control === "pause") c.pausePractice();
    if (control === "own-play") await c.startPractice();
    if (control === "demo") await c.playDemo();
    assert.deepEqual(h.names(), before, "no old missed attack is backfilled by the control");
    if (explicitRestart) {
      assert.equal(c.shouldLoop(), true); assert.equal(c.pausedSession, null);
      near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
      h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), before);
      h.advance(.02); h.tick();
      assert.deepEqual(h.names().slice(before.length), ["backing:0", ...(control === "demo" ? ["melody:0"] : [])]);
    } else {
      assert.equal(c.shouldLoop(), false); near(c.pausedSession.seconds, .01);
    }
    if (control === "volume") assert.equal(c.accompanimentVolume, .2);
    if (control === "style" || control === "toggle") assert.equal(c.accompanimentEnabled, false);
  });
}

for (const control of ["loop-off", "loop-key", "loop-drag"]) {
  test(`${control} honors its edit after detecting a pre-RAF stall, without automatic restart`, async () => {
    const h = harness({ beats: [4, 4.5, 5, 5.5, 6, 8], range: { startBeat: 4, endBeat: 6 } }); const { c } = h;
    c.accompanimentEnabled = false;
    await c.playDemo(); h.at(2.01); h.tick(); const before = h.names(); h.advance(1);
    if (control === "loop-off") c.togglePracticeLoop();
    if (control === "loop-key") c.handleLoopKeydown({ key: "ArrowRight", preventDefault() {} }, "start");
    if (control === "loop-drag") {
      const pointer = { pointerId: 7, currentTarget: c.loopStartHandle, preventDefault() {} };
      c.startLoopDrag(pointer, "start"); c.finishLoopDrag({ ...pointer, type: "pointerup" });
    }
    assert.equal(c.shouldLoop(), false); assert.equal(c.pausedSession.mode, "demo"); assert.deepEqual(h.names(), before);
    if (control === "loop-off") { assert.equal(c.practiceLoopRange, null); near(c.pausedSession.seconds, 2.01); }
    else near(c.pausedSession.seconds, c.practiceLoopRange.startBeat * c.getScaledBeatSeconds());
  });
}

test("a mode readiness callback begins a fresh prepared clock after immediately retiring the old pass", async () => {
  const h = harness({ beats: [0, 1, 2, 3, 8], range: null }); const { c } = h; const gate = deferred();
  c.accompanimentEnabled = false;
  await c.startPractice(); h.at(.01); h.tick(); const before = h.names();
  c.preloadKalimbaSamples = () => gate.promise;
  const mode = c.playDemo(); await settle();
  assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0); assert.equal(c.pendingPlayback.mode, "demo");
  h.advance(1); h.tick(); assert.deepEqual(h.names(), before);
  gate.resolve([]); await mode;
  assert.equal(c.shouldLoop(), true); assert.equal(c.pausedSession, null); assert.equal(c.pauseBtn.textContent, "暂停");
  near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
  h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), before);
  h.advance(.02); h.tick(); assert.deepEqual(h.names().slice(before.length), ["melody:0"]);
});

for (const requestedMode of ["practice", "demo"]) {
  test(`an explicit stalled mode switch to ${requestedMode} restarts at zero after full preparation`, async () => {
    const h = harness({ beats: [0, 1, 2, 3, 8], range: null }); const { c } = h;
    c.accompanimentEnabled = false;
    await c[requestedMode === "practice" ? "playDemo" : "startPractice"](); h.at(.01); h.tick(); const before = h.names();
    h.advance(1); await c[requestedMode === "practice" ? "startPractice" : "playDemo"]();
    assert.equal(c.shouldLoop(), true); assert.equal(c.pausedSession, null); assert.equal(c.resumePreparation, null);
    near(c.currentPracticeTime(), -c.getSessionLeadSeconds()); assert.deepEqual(h.names(), before);
    assert.equal(c.practiceRunning, requestedMode === "practice"); assert.equal(c.demoMode, requestedMode === "demo");
    h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), before);
    h.advance(.02); h.tick();
    assert.deepEqual(h.names().slice(before.length), requestedMode === "demo" ? ["melody:0"] : []);
    h.stepTo(.5); h.tick();
    assert.deepEqual(h.names().slice(before.length), requestedMode === "demo" ? ["melody:0", "melody:1"] : []);
  });
}

for (const gap of [.2, .5, .999999]) {
  test(`foreground own-play: ${gap * 1000} ms frame jitter keeps transport and progress moving`, async () => {
    const h = harness({ beats: [0, 1, 2, 4, 8], range: null }); const { c } = h;
    c.accompanimentEnabled = false;
    await begin(h, "practice", .49);
    h.advance(gap); h.tick();
    assert.equal(c.practiceRunning, true);
    assert.equal(c.pausedSession, null);
    near(c.lastPracticeFrameSeconds, .49 + gap);
    assert.equal(c.songElapsed.textContent, c.formatSongTime(.49 + gap));
    assert.equal(c.songProgress.attrs["aria-valuenow"], String(Math.round(.49 + gap)));
    assert.equal(c.pauseBtn.textContent, "暂停");
  });
}


for (const cause of ["material-gap", "hidden", "audio-interrupted", "manual"]) {
  test(`visible board notice accompanies ${cause} pause and disappears on prepared Continue`, async () => {
    const h = harness({ beats: [0, 1, 2, 4, 8], range: null }); const { c } = h;
    await begin(h, "practice", .49);
    if (cause === "material-gap") { h.advance(1); h.tick(); }
    if (cause === "hidden") { c.document.hidden = true; h.tick(); }
    if (cause === "audio-interrupted") { c.audioContext.state = "suspended"; c.handleAudioContextStateChange(); }
    if (cause === "manual") c.pausePractice();
    assert.equal(c.shouldLoop(), false); assert.equal(c.pauseBtn.disabled, false);
    assert.equal(c.pauseBtn.textContent, "继续"); assert.equal(c.playbackNotice.hidden, false);
    assert.match(c.playbackNotice.textContent, /已暂停.*继续/);
    c.document.hidden = false; c.audioContext.state = "running";
    await c.continuePractice(); assert.ok(c.resumePreparation);
    assert.equal(c.playbackNotice.hidden, true); assert.equal(c.playbackNotice.textContent, "");
    h.healthy(c.resumePreparation.duration); assert.equal(c.practiceRunning, true);
    assert.equal(c.playbackNotice.hidden, true);
  });
}

test("a renderer exception retains the last completed frame, stops audio, and exposes recoverable Continue", async () => {
  const h = harness({ beats: [0, 1, 2, 4, 8], range: null }); const { c } = h;
  await begin(h, "practice", .49);
  const renderGuidance = c.renderKeyGuidance, errors = [];
  c.console = { error: (...args) => errors.push(args), warn() {} };
  c.renderKeyGuidance = () => { throw new Error("synthetic renderer failure"); };
  h.advance(.01); h.tick();
  assert.equal(errors.length, 1);
  assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0);
  near(c.currentPracticeTime(), .49); near(c.lastPracticeFrameSeconds, .49);
  assert.equal(c.pauseBtn.disabled, false); assert.equal(c.pauseBtn.textContent, "继续");
  assert.equal(c.playbackNotice.hidden, false); assert.match(c.playbackNotice.textContent, /显示异常.*继续/);
  c.renderKeyGuidance = renderGuidance;
  await finishPreparation(h); assert.equal(c.practiceRunning, true);
  h.advance(.02); h.tick(); assert.ok(c.currentPracticeTime() > .49);
  assert.equal(c.playbackNotice.hidden, true);
});

for (const speed of [.35, 1.4]) {
  test(`a skipped dense attack at ${speed}x cannot leave the next key highlight or progress behind`, async () => {
    const h = harness({ beats: [0, 1, 2, 3, 8], range: null }); const { c } = h;
    c.speedSlider.value = String(speed); c.applySpeed(); c.accompanimentEnabled = false;
    await begin(h, "demo", c.getEventTime(c.songEvents[1]) - .01);
    h.advance(.3); h.tick();
    assert.equal(c.demoMode, true); assert.equal(c.pausedSession, null);
    const seconds = c.currentPracticeTime();
    near(c.renderKeyGuidance.state.beat, seconds / c.getScaledBeatSeconds());
    assert.equal(c.songElapsed.textContent, c.formatSongTime(seconds));
    assert.equal(c.songEvents[1].demoPlayed, true);
    const skippedName = c.songEvents[1].notes[0].name;
    assert.ok(!h.names().includes(skippedName));
    h.stepTo(c.getEventTime(c.songEvents[3]) + 1e-8); h.tick();
    assert.equal(c.songEvents[3].demoPlayed, true);
    assert.equal(h.names().filter(name => name === c.songEvents[3].notes[0].name).length, 1);
    assert.ok(Math.abs(c.renderKeyGuidance.state.beat - 3) < 1e-6);
  });
}
