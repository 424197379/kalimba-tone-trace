import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { selectKeyGuidance } from "../src/key-guidance.js";
import { createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats } from "../src/practice-loop.js";
import { recordPractice, saveSongSpeed } from "../src/practice-preferences.js";
import { DISPLAY_KEYS, NOTE_INDEX } from "../src/songs.js";
import { getSongBaseId } from "../src/song-store.js";

// Supply the pre-fix source to confirm these behavioral regressions reject it.
const source = await readFile(process.env.KALIMBA_RESTART_APP_SOURCE || new URL("../src/app.js", import.meta.url), "utf8");
const names = [
  "beginPassPreparation",
  "buildSongEvents", "resetSongEvents", "resetAccompanimentEvents", "getAccompanimentTime", "getAccompanimentDurationSeconds",
  "syncAccompanimentEventsForSeek", "playAccompanimentEvents", "formatSongTime", "getSongProgressDuration", "renderSongProgress",
  "renderLoopControls", "renderPreparationCue", "prepareLoopStart", "togglePracticeLoop", "setStatus", "currentPracticeTime",
  "getScaledBeatSeconds", "getSessionLeadSeconds", "getEventTime", "getEventDurationSeconds", "getEventJudgeWindowSeconds",
  "getSongEndSeconds", "getProgressSeekSeconds", "resetDetectionReadout", "syncSongEventsForSeek", "seekToSongTime",
  "handleProgressPointer", "startProgressSeek", "moveProgressSeek", "finishProgressSeek", "handleProgressKeydown",
  "getExpectedEvent", "getJudgementEvent", "renderKeyGuidance", "renderBoard", "shouldLoop", "animationLoop", "startLoop",
  "updatePauseControl", "cancelPracticeContinuation", "clearPracticeInteractions", "preservePastAttacks", "continuePractice",
  "togglePausePractice", "startPractice", "pausePractice", "resetPracticeState", "playDemo", "applySpeed", "openSongLibrary",
  "preparePracticeAudio", "getPracticeNoteTiming", "isPracticeNoteCurrent", "admitPracticeFrame", "handleAudioContextStateChange",
  "registerKalimbaVoice", "silenceKalimbaAudio", "playDecodedKalimbaSample", "playKalimbaSample", "playKalimbaNote"
];
function production(name) {
  const match = source.match(new RegExp(`^    (?:async )?function ${name}\\([^]*?^    \\}`, "m"));
  assert.ok(match, `Missing production function ${name}`);
  return match[0];
}
// Restart-specific tests fail explicitly on the pre-fix source. Seek regressions
// still execute against that source instead of failing at harness construction.
const restart = source.match(/^    async function restartPractice\([^]*?^    \}/m)?.[0] || "";
const runtime = names.map(production).join("\n") + "\n" + restart;
const constants = ["practiceOnsetStaleSeconds", "practiceAudioReadyTimeoutMs"].map(name => {
  const match = source.match(new RegExp(`^    const ${name} = [^;]+;`, "m"));
  assert.ok(match, name); return match[0];
}).join("\n");

function element() {
  const classes = new Set(), listeners = new Map();
  let captured = null;
  return {
    attrs: {}, style: { setProperty(name, value) { this[name] = value; } }, disabled: false, hidden: false, textContent: "",
    get className() { return [...classes].join(" "); },
    set className(value) { classes.clear(); value.split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); },
    classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name), toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } },
    setAttribute(name, value) { this.attrs[name] = String(value); }, focus() {},
    addEventListener(name, callback) { listeners.set(name, callback); }, click() { return listeners.get("click")?.(); },
    setPointerCapture(id) { captured = id; }, hasPointerCapture(id) { return captured === id; },
    releasePointerCapture(id) { assert.equal(captured, id); captured = null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 })
  };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

// The production transport, cue selector, renderer, dispatch and asynchronous
// sample player all run. Only browser APIs and decoded audio nodes are controlled.
// This verifies logical attack timing, not physical device/sample latency.
function harness({ speed = 1, range = null, enabled = true, rest = false } = {}) {
  let now = 10000, frameId = 0;
  const frames = new Map(), samples = [], storage = new Map();
  const param = () => ({ setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {} });
  const node = () => ({ gain: param(), pan: param(), connect(next) { return next; }, disconnect() {}, stop() {},
    start() { samples.push({ name: this.buffer.name, seconds: c.currentPracticeTime(), request: c.playbackRequestId }); } });
  const song = { id: "restart-test", title: "Restart test", steps: [["C4", rest ? 1 : 0, .5], ["C4", 2, .25], ["D4", 2.5, .5], ["E4", 4, 1]] };
  const c = {
    console: { warn() {}, error() {} }, selectKeyGuidance, createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats,
    recordPractice, saveSongSpeed, getSongBaseId, DISPLAY_KEYS, NOTE_INDEX, APP_NAME: "Restart test",
    currentSong: song, currentSongId: song.id,
    browserPreferenceStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    songEvents: [], accompanimentEvents: [], songTotalBeats: 6, accompanimentTotalBeats: 6,
    beatSeconds: .5, speedFactor: speed, baseFallLeadSeconds: 1.5, fallLeadSeconds: 1.5 / Math.sqrt(speed),
    practiceLoopRange: range && { ...range }, practiceRunning: false, demoMode: false, preferredPlaybackMode: "practice",
    pausedElapsed: 0, practiceStartAt: 0, playbackRequestId: 0, rafId: 0, pendingPlayback: null, pausedSession: null,
    resumePreparation: null, passPreparation: null, preparationRetryUsed: false, lastPracticeFrameSeconds: null, seekingWithProgress: false, progressSeekAtStart: false, fullscreenControl: null,
    progressSeekPointerId: null, progressSeekRect: null, loopDragEdge: null, loopDragPointerId: null, loopDragRect: null,
    loopDragWasPlaying: false, loopDragWasDemo: false, accompanimentEnabled: enabled, accompanimentVolume: .6,
    notePlaybackGeneration: 0, activeKalimbaVoices: new Set(), retiredKalimbaOutputs: new Set(), kalimbaBus: null,
    kalimbaDry: null, kalimbaWet: null, kalimbaReverb: null, kalimbaOutput: null, kalimbaOutputNodes: [],
    keyEls: Array.from({ length: 21 }, element), noteEls: new Map(), noteLaneInsetRatio: .08,
    boardTop: { clientHeight: 200 }, noteLayer: { clientWidth: 840 }, activeDetection: { lane: null, candidateLane: null },
    activeInputUntil: 0, signalPeakUntil: 0, focusWindowSeconds: .1, lateGraceSeconds: .1, beamSwitchLeadSeconds: .05,
    performance: { now: () => now }, document: { hidden: false, documentElement: element(), fullscreenElement: null },
    window: { location: {} }, audioContext: { state: "running", get currentTime() { return now / 1000; },
      createBufferSource: node, createGain: node, createStereoPanner: node },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout: () => 0, clearTimeout() {}, clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
    isCompactPracticeView: () => false, getVisualFallLeadSeconds: () => c.fallLeadSeconds,
    clearHighlights() {}, setActiveBeamLane() {}, highlightLane() {}, formatEventTargetText: event => event.notes[0].name,
    setCompactIcon() {}, showKeyWidthStatus() {}, shouldUseLandscapeFullscreen: () => false,
    ensureAudioContext: async () => {}, preloadKalimbaSamples: async () => {},
    loadKalimbaSampleBuffer: async name => ({ name, duration: .8 }), ensureKalimbaOutput() { c.kalimbaBus ||= node(); },
    createPluckSynth() { assert.fail("Decoded fixture unexpectedly fell back to synthesis"); }
  };
  for (const name of ["boardShell", "targetText", "statusText", "pauseBtn", "restartBtn", "repeatBtn", "loopSelection", "loopStartHandle", "loopEndHandle", "preparationCue", "songProgress", "songProgressFill", "songProgressThumb", "songElapsed", "songRemaining", "speedSlider", "speedValue"]) c[name] = element();
  runInNewContext(constants + "\n" + runtime, c);
  c.songEvents = c.buildSongEvents(song);
  c.accompanimentEvents = [{ id: "support-0", beat: rest ? 1 : 0, duration: .5, played: false, notes: [{ name: "G3", velocity: .5 }] },
    { id: "support-2", beat: 2, duration: .5, played: false, notes: [{ name: "A3", velocity: .5 }] }];
  c.noteEls = new Map(c.songEvents.map(event => [event.id, element()]));
  const identities = c.songEvents.map(event => ({ event, id: event.id, beat: event.beat, duration: event.duration, notes: event.notes }));
  c.resetPracticeState({ preserveLoop: true });
  const binding = source.match(/^    if \(restartBtn\) restartBtn.addEventListener\("click", restartPractice\);/m);
  if (binding) runInNewContext(binding[0], c);
  function tick() { const pending = [...frames]; frames.clear(); for (const [, callback] of pending) callback(); }
  return {
    c, samples, frames, identities, tick,
    advance(seconds) { now += seconds * 1000; },
    async healthy(seconds) { tick(); const n = Math.max(1, Math.ceil(seconds / .02)); for (let i = 0; i < n; i++) { now += seconds * 1000 / n; tick(); await settle(); } },
    async begin(mode) { await c[mode === "demo" ? "playDemo" : "startPractice"](); tick(); },
    pointer(seconds, pointerId = 17) { return { pointerId, type: "pointerdown", button: 0, isPrimary: true, clientX: 1000 * seconds / c.getSongProgressDuration(), clientY: 0, preventDefault() {} }; },
    finish(type = "pointerup") { c.finishProgressSeek({ pointerId: 17, type }); },
    key(key = "Home", repeat = false) { c.handleProgressKeydown({ key, repeat, preventDefault() {} }); },
    phase(lane = NOTE_INDEX.get("C4")) { return c.keyEls[lane].attrs["data-cue-phase"]; },
    assertIdentities() { for (const old of identities) { assert.equal(c.songEvents.find(event => event.id === old.id), old.event); assert.equal(old.event.notes, old.notes); assert.equal(old.event.beat, old.beat); assert.equal(old.event.duration, old.duration); } }
  };
}
function expectedFirst(mode, enabled) { return [...(enabled ? ["G3"] : []), ...(mode === "demo" ? ["C4"] : [])]; }

for (const mode of ["practice", "demo"]) for (const speed of [.35, 1, 1.4]) for (const enabled of [false, true]) {
  test(`${mode} ${speed}x backing ${enabled}: zero drag waits for release then one complete count-in and first attack`, async () => {
    const h = harness({ speed, enabled, range: { startBeat: 2, endBeat: 4 } }); const { c } = h;
    await h.begin(mode); c.seekToSongTime(1.2 * c.getScaledBeatSeconds()); await settle(); h.samples.length = 0;
    c.startProgressSeek(h.pointer(0)); const lead = c.getSessionLeadSeconds();
    assert.equal(c.practiceLoopRange, null); near(c.currentPracticeTime(), -lead);
    const frozen = c.noteEls.get(0).style.transform;
    await h.healthy(lead + 2); c.moveProgressSeek(h.pointer(0)); await h.healthy(1);
    near(c.currentPracticeTime(), -lead); assert.equal(c.noteEls.get(0).style.transform, frozen);
    assert.deepEqual(h.samples, []); assert.ok(c.songEvents.every(event => !event.demoPlayed));
    h.finish(); assert.equal(c.seekingWithProgress, false); assert.equal(c.songProgress.hasPointerCapture(17), false);
    near(c.currentPracticeTime(), -lead); await h.healthy(lead - .04); assert.deepEqual(h.samples, []);
    assert.equal(c.preparationCue.textContent, "1"); assert.notEqual(h.phase(), "active-fill");
    await h.healthy(.06); assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(mode, enabled));
    h.tick(); await settle(); assert.equal(h.samples.length, expectedFirst(mode, enabled).length);
    assert.equal(c.demoMode, mode === "demo"); assert.equal(c.speedFactor, speed); h.assertIdentities();
  });
}

for (const mode of ["practice", "demo"]) {
  test(`${mode}: paused Home and pointer zero stay paused; Continue has one preparation with an outline`, async () => {
    const h = harness(); const { c } = h; await h.begin(mode); c.seekToSongTime(.8); c.pausePractice();
    h.key(); c.startProgressSeek(h.pointer(0)); h.finish(); await h.healthy(10);
    assert.equal(c.shouldLoop(), false); assert.equal(c.pausedSession.mode, mode); near(c.pausedSession.seconds, 0);
    near(c.pausedElapsed, -c.getSessionLeadSeconds()); assert.deepEqual(h.samples, []);
    await c.continuePractice(); assert.ok(c.resumePreparation); assert.equal(h.phase(), "preview-outline");
    await h.healthy(c.resumePreparation.duration - .03); assert.deepEqual(h.samples, []); assert.equal(h.phase(), "preview-outline");
    await h.healthy(.05); assert.equal(c.resumePreparation, null); assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(mode, true));
  });

  for (const interruption of ["pointercancel", "hidden", "audio", "reset", "navigation"]) {
    test(`${mode}: ${interruption} during held zero cancels release intent and old attacks`, async () => {
      const h = harness(); const { c } = h; await h.begin(mode); c.startProgressSeek(h.pointer(0)); await h.healthy(2);
      if (interruption === "hidden") { c.document.hidden = true; c.pausePractice({ freezeAtLastFrame: true }); }
      else if (interruption === "audio") { c.audioContext.state = "suspended"; c.handleAudioContextStateChange(); }
      else if (interruption === "reset") c.resetPracticeState();
      else if (interruption === "navigation") c.openSongLibrary();
      else h.finish("pointercancel");
      c.document.hidden = false; c.audioContext.state = "running"; h.finish(); await h.healthy(10);
      assert.equal(c.shouldLoop(), false); assert.equal(c.progressSeekAtStart, false); assert.equal(h.frames.size, 0); assert.deepEqual(h.samples, []);
      if (interruption !== "reset") { assert.equal(c.pausedSession.mode, mode); near(c.pausedSession.seconds, 0); }
    });
  }

  test(`${mode}: zero to nonzero resumes the selected location and discards the old count-in`, async () => {
    const h = harness(); const { c } = h; await h.begin(mode); c.startProgressSeek(h.pointer(0)); await h.healthy(5);
    c.moveProgressSeek(h.pointer(.95)); near(c.currentPracticeTime(), .95); assert.equal(c.progressSeekAtStart, false);
    h.finish(); await h.healthy(.07);
    assert.deepEqual(h.samples.map(sample => sample.name), ["A3", ...(mode === "demo" ? ["C4"] : [])]);
    assert.ok(h.samples.every(sample => sample.seconds >= 1 && sample.seconds < 1.03));
  });

  test(`${mode}: Home during Continue preparation retains mode and replaces the frozen target with song count-in`, async () => {
    const h = harness(); const { c } = h; await h.begin(mode); c.seekToSongTime(.8); c.pausePractice(); await c.continuePractice();
    h.key(); assert.equal(c.resumePreparation, null); near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
    await h.healthy(c.getSessionLeadSeconds() + .02);
    assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(mode, true)); assert.equal(c.demoMode, mode === "demo");
  });

  test(`${mode}: explicit restart button exits loop, preserves mode/speed and resets rather than replaces event identities`, async () => {
    const h = harness({ speed: .55, range: { startBeat: 2, endBeat: 4 } }); const { c } = h; await h.begin(mode);
    assert.equal(typeof c.restartPractice, "function"); await c.restartBtn.click();
    assert.equal(c.practiceLoopRange, null); assert.equal(c.speedFactor, .55); near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
    assert.equal(c.demoMode, mode === "demo"); await h.healthy(c.getSessionLeadSeconds() + .02);
    assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(mode, true)); h.assertIdentities();
  });

  test(`${mode}: restart from paused practice starts one fresh count-in`, async () => {
    const h = harness(); const { c } = h; await h.begin(mode); c.seekToSongTime(.8); c.pausePractice();
    assert.equal(typeof c.restartPractice, "function"); await c.restartPractice();
    assert.equal(c.pausedSession, null); assert.equal(c.resumePreparation, null);
    await h.healthy(c.getSessionLeadSeconds() + .02); assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(mode, true));
  });

  test(`${mode}: seeking zero during pending audio preparation invalidates the old request and retains a safe Continue target`, async () => {
    const h = harness(); const { c } = h; const gate = deferred(); c.ensureAudioContext = () => gate.promise;
    const start = c[mode === "demo" ? "playDemo" : "startPractice"](); c.startProgressSeek(h.pointer(0)); h.finish();
    gate.resolve(); await start; await h.healthy(10);
    assert.equal(c.shouldLoop(), false); assert.equal(c.pausedSession.mode, mode); near(c.pausedSession.seconds, 0); assert.deepEqual(h.samples, []);
    await c.continuePractice(); await h.healthy(c.resumePreparation.duration + .02);
    assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(mode, true));
  });
}

test("idle zero stays ready without autoplay, and starting waits the full preparation", async () => {
  const h = harness(); const { c } = h; c.startProgressSeek(h.pointer(0)); h.finish(); await h.healthy(10);
  assert.equal(c.shouldLoop(), false); assert.equal(c.pausedSession, null); near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
  await c.startPractice(); await h.healthy(c.getSessionLeadSeconds() - .03); assert.deepEqual(h.samples, []);
  await h.healthy(.05); assert.deepEqual(h.samples.map(sample => sample.name), ["G3"]);
});

test("completed demo retains the chosen mode for the next explicit restart", async () => {
  const h = harness(); const { c } = h; await h.begin("demo"); await h.healthy(c.getSessionLeadSeconds() + c.getSongEndSeconds() + .05);
  assert.equal(c.shouldLoop(), false); assert.equal(c.preferredPlaybackMode, "demo"); h.samples.length = 0;
  assert.equal(typeof c.restartPractice, "function"); await c.restartPractice(); await h.healthy(c.getSessionLeadSeconds() + .02);
  assert.equal(c.demoMode, true); assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4"]);
});

for (const action of ["restart", "pause", "reset", "start", "demo", "hidden", "navigation"]) {
  test(`pending restart followed by ${action} cannot resurrect an obsolete audio request`, async () => {
    const h = harness(); const { c } = h; await h.begin("demo"); const gate = deferred();
    c.ensureAudioContext = () => gate.promise; assert.equal(typeof c.restartPractice, "function"); const first = c.restartPractice();
    let second;
    if (action === "restart") second = c.restartPractice();
    else if (action === "pause") c.pausePractice();
    else if (action === "reset") c.resetPracticeState();
    else if (action === "start") second = c.startPractice();
    else if (action === "demo") second = c.playDemo();
    else if (action === "hidden") { c.document.hidden = true; c.pausePractice({ freezeAtLastFrame: true }); }
    else c.openSongLibrary();
    const request = c.playbackRequestId; gate.resolve(); await first; if (second) await second;
    c.document.hidden = false; await h.healthy(c.getSessionLeadSeconds() + .02);
    if (second) { assert.equal(c.shouldLoop(), true); assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(action === "start" ? "practice" : "demo", true)); }
    else { assert.equal(c.shouldLoop(), false); assert.deepEqual(h.samples, []); }
    assert.ok(h.samples.every(sample => sample.request >= request));
  });
}

test("a decoded old melody/backing attack cannot leak into restart preparation", async () => {
  const h = harness(); const { c } = h; await h.begin("demo"); const gate = deferred();
  c.loadKalimbaSampleBuffer = name => gate.promise.then(() => ({ name, duration: .8 }));
  c.seekToSongTime(1); assert.ok(c.songEvents.some(event => event.demoPlayed));
  assert.equal(typeof c.restartPractice, "function"); await c.restartPractice(); gate.resolve(); await settle();
  assert.deepEqual(h.samples, []); await h.healthy(c.getSessionLeadSeconds() + .02);
  assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4"]);
});

test("speed changes during the held zero/count-in keep musical preparation and exactly one first attack", async () => {
  const h = harness(); const { c } = h; await h.begin("demo"); c.startProgressSeek(h.pointer(0)); await h.healthy(5);
  c.speedSlider.value = ".35"; c.applySpeed(); assert.equal(c.seekingWithProgress, false); assert.ok(c.currentPracticeTime() < 0);
  const remaining = -c.currentPracticeTime(); await h.healthy(remaining + .02);
  assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4"]); h.assertIdentities();
});

test("absolute start exits even an A=0 loop, while turning A/B off is not another restart", async () => {
  const h = harness({ range: { startBeat: 0, endBeat: 4 } }); const { c } = h; await h.begin("demo");
  c.startProgressSeek(h.pointer(0)); h.finish(); assert.equal(c.practiceLoopRange, null);
  c.practiceLoopRange = { startBeat: 0, endBeat: 4 }; c.prepareLoopStart(); c.togglePracticeLoop();
  assert.equal(c.practiceLoopRange, null); near(c.currentPracticeTime(), 0); await settle();
  assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4"]);
});

test("intro rests and distinct repeated-note identities survive full-song restart", async () => {
  const h = harness({ rest: true }); const { c } = h; await h.begin("demo"); assert.equal(typeof c.restartPractice, "function"); await c.restartPractice();
  await h.healthy(c.getSessionLeadSeconds() + .2); assert.deepEqual(h.samples, []); assert.notEqual(h.phase(), "active-fill");
  await h.healthy(.32); assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4"]);
  await h.healthy(.5); assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4", "A3", "C4"]); h.assertIdentities();
});

for (const mode of ["practice", "demo"]) {
  test(`${mode}: ended playback sought to zero remains stopped until a new prepared start`, async () => {
    const h = harness(); const { c } = h; await h.begin(mode); await h.healthy(c.getSessionLeadSeconds() + c.getSongEndSeconds() + .05);
    assert.equal(c.shouldLoop(), false); h.samples.length = 0; h.key(); await h.healthy(4);
    assert.equal(c.shouldLoop(), false); near(c.currentPracticeTime(), -c.getSessionLeadSeconds()); assert.deepEqual(h.samples, []);
    await h.begin(mode); await h.healthy(c.getSessionLeadSeconds() - .03); assert.deepEqual(h.samples, []);
    await h.healthy(.05); assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(mode, true));
  });

  test(`${mode}: held Home repeats do not leak attacks, then finish with one complete preparation`, async () => {
    const h = harness(); const { c } = h; await h.begin(mode); c.seekToSongTime(.8); h.key();
    for (let i = 0; i < 20; i++) { await h.healthy(.08); h.key("Home", true); }
    near(c.currentPracticeTime(), -c.getSessionLeadSeconds()); assert.deepEqual(h.samples, []);
    await h.healthy(c.getSessionLeadSeconds() + .02); assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(mode, true));
  });

  test(`${mode}: release before a delayed visibility notification cannot start from zero in a hidden page`, async () => {
    const h = harness(); const { c } = h; await h.begin(mode); c.startProgressSeek(h.pointer(0));
    c.document.hidden = true; h.finish(); c.document.hidden = false; await h.healthy(10);
    assert.equal(c.shouldLoop(), false); assert.equal(c.pausedSession.mode, mode); near(c.pausedSession.seconds, 0); assert.deepEqual(h.samples, []);
  });
}

test("a three-beat lead visibly counts 3, 2, 1 before the first attack", async () => {
  const h = harness(); const { c } = h; await h.begin("demo"); h.key();
  assert.equal(c.preparationCue.textContent, "3"); await h.healthy(.5); assert.equal(c.preparationCue.textContent, "2");
  await h.healthy(.5); assert.equal(c.preparationCue.textContent, "1"); assert.deepEqual(h.samples, []);
  await h.healthy(.52); assert.equal(c.preparationCue.hidden, true); assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4"]);
});

test("ArrowLeft clamped to zero starts the same count-in as Home", async () => {
  const h = harness(); const { c } = h; await h.begin("demo"); c.seekToSongTime(.8); h.key("ArrowLeft");
  near(c.currentPracticeTime(), -c.getSessionLeadSeconds()); await h.healthy(c.getSessionLeadSeconds() + .02);
  assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4"]);
});

test("foreign pointer releases cannot spend or end another pointer's held-zero preparation", async () => {
  const h = harness(); const { c } = h; await h.begin("demo"); c.startProgressSeek(h.pointer(0));
  c.finishProgressSeek({ pointerId: 99, type: "pointerup" }); c.moveProgressSeek(h.pointer(1, 99));
  await h.healthy(3); assert.equal(c.seekingWithProgress, true); near(c.currentPracticeTime(), -c.getSessionLeadSeconds()); assert.deepEqual(h.samples, []);
  h.finish(); await h.healthy(c.getSessionLeadSeconds() + .02); assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4"]);
});

test("a real RAF stall after clock arming that crosses the first onset still pauses rather than backfilling an attack", async () => {
  const h = harness(); const { c } = h; await h.begin("demo"); h.key(); const frozen = c.lastPracticeFrameSeconds;
  h.tick(); // The first visible frame now owns the beginning of preparation.
  h.advance(c.getSessionLeadSeconds() + .5); h.tick(); await settle();
  assert.equal(c.shouldLoop(), false); assert.equal(c.statusText.textContent, "播放卡顿，已暂停");
  near(c.pausedElapsed, frozen); near(c.pausedSession.seconds, 0); assert.deepEqual(h.samples, []);
  await c.continuePractice(); await h.healthy(c.resumePreparation.duration + .02);
  assert.deepEqual(h.samples.map(sample => sample.name), ["G3", "C4"]);
});

for (const previousMode of ["practice", "demo"]) for (const nextMode of ["practice", "demo"]) {
  for (const phase of ["running", "paused", "Continue preparation"]) for (const loop of [false, true]) {
    test(`${previousMode} → ${nextMode}, ${phase}, ${loop ? "A/B" : "song"}: every mode click immediately resets then counts in once`, async () => {
      const h = harness({ range: loop ? { startBeat: 2, endBeat: 4 } : null }); const { c } = h;
      await h.begin(previousMode); c.seekToSongTime(loop ? 1.15 : .75); await settle();
      if (phase !== "running") c.pausePractice();
      if (phase === "Continue preparation") await c.continuePractice();
      h.samples.length = 0;
      const range = c.practiceLoopRange, first = loop ? 1 : 0, lead = c.getSessionLeadSeconds();
      const gate = deferred(); c.ensureAudioContext = () => gate.promise;
      const pending = c[nextMode === "demo" ? "playDemo" : "startPractice"]();
      assert.equal(c.shouldLoop(), false, "the old pass stops before audio setup resolves");
      assert.equal(c.pendingPlayback.mode, nextMode); near(c.pendingPlayback.seconds, first - lead);
      assert.equal(c.pausedSession, null); assert.equal(c.resumePreparation, null); assert.equal(c.practiceLoopRange, range);
      near(c.currentPracticeTime(), first - lead); assert.equal(h.frames.size, 0);
      await h.healthy(5); assert.deepEqual(h.samples, []); near(c.currentPracticeTime(), first - lead);
      gate.resolve(); await pending;
      assert.equal(c.demoMode, nextMode === "demo"); assert.equal(c.practiceRunning, nextMode === "practice");
      near(c.currentPracticeTime(), first - lead);
      await h.healthy(lead - .03); assert.deepEqual(h.samples, []);
      await h.healthy(.05);
      assert.deepEqual(h.samples.map(sample => sample.name), [loop ? "A3" : "G3", ...(nextMode === "demo" ? ["C4"] : [])]);
      assert.ok(h.samples.every(sample => sample.seconds >= first && sample.seconds < first + .03));
      assert.equal(c.practiceLoopRange, range); h.assertIdentities();
    });
  }
}

for (const mode of ["practice", "demo"]) for (const loop of [false, true]) {
  test(`${mode}, ${loop ? "A/B" : "song"}: an explicit mode restart supersedes a stale old frame without backfill`, async () => {
    const h = harness({ range: loop ? { startBeat: 2, endBeat: 4 } : null }); const { c } = h;
    await h.begin("demo"); c.seekToSongTime(loop ? 1.2 : .95); await settle(); h.samples.length = 0;
    h.advance(.5); // The next old onset is stale, but this action intentionally abandons that pass.
    await c[mode === "demo" ? "playDemo" : "startPractice"]();
    assert.equal(c.pausedSession, null); assert.equal(c.pendingPlayback, null);
    near(c.currentPracticeTime(), (loop ? 1 : 0) - c.getSessionLeadSeconds());
    assert.deepEqual(h.samples, []); await h.healthy(c.getSessionLeadSeconds() + .02);
    assert.deepEqual(h.samples.map(sample => sample.name), [loop ? "A3" : "G3", ...(mode === "demo" ? ["C4"] : [])]);
  });
}

for (const nextMode of ["practice", "demo"]) {
  test(`${nextMode}: delayed old decoded voices cannot leak into a mode restart`, async () => {
    const h = harness(); const { c } = h; await h.begin("demo"); const gate = deferred();
    c.loadKalimbaSampleBuffer = name => gate.promise.then(() => ({ name, duration: .8 }));
    c.seekToSongTime(1); assert.ok(c.songEvents.some(event => event.demoPlayed));
    await c[nextMode === "demo" ? "playDemo" : "startPractice"](); gate.resolve(); await settle();
    assert.deepEqual(h.samples, []); await h.healthy(c.getSessionLeadSeconds() + .02);
    assert.deepEqual(h.samples.map(sample => sample.name), expectedFirst(nextMode, true));
  });
}

test("Continue alone preserves the paused middle position instead of selecting song start or A", async () => {
  const h = harness({ range: { startBeat: 2, endBeat: 4 } }); const { c } = h;
  await h.begin("demo"); c.seekToSongTime(1.1); c.pausePractice(); const range = c.practiceLoopRange;
  await c.continuePractice(); near(c.resumePreparation.seconds, 1.1); near(c.currentPracticeTime(), 1.1);
  await h.healthy(c.resumePreparation.duration + .02); assert.equal(c.practiceLoopRange, range);
  assert.ok(c.currentPracticeTime() >= 1.1 && c.currentPracticeTime() < 1.14); assert.deepEqual(h.samples, []);
});
