import { selectKeyGuidance } from "../src/key-guidance.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats, getPracticeTotalBeats } from "../src/practice-loop.js";
import { saveSongSpeed, readSongSpeed, recordPractice, readSongAccompaniment, saveSongAccompaniment } from "../src/practice-preferences.js";
import { NOTE_INDEX } from "../src/songs.js";
import { parseImportedSongs, saveCustomSongs, getSongLibrary, getPracticeSongId, getEventTotalBeats, getSongBaseId, getSongAccompanimentProvider, hasMatchingPracticeMelody, getSongArchiveDownload, getSongVersionRank } from "../src/song-store.js";

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
  "resetPracticeState", "playDemo", "applySpeed", "getSongDefaultSpeedFactor", "applySongDefaultSpeed", "changeAccompanimentStyle", "applyAccompanimentControl", "toggleAccompaniment",
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
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

// Song-library consumers receive normalized V1 events as well as source steps.
// Keep fixtures faithful to that contract, including each melody judge flag.
function melodySongFixture(song) {
  return {
    ...song, schemaVersion: 1, arrangementKind: "melody", judgementMode: "melody",
    events: song.steps.map(([name, beat, duration]) => ({
      beat, duration, notes: [{ name, role: "melody", judge: true, velocity: 1 }]
    }))
  };
}

function endingRestHarness(songId) {
  const h = harness({ range: null }); const { c } = h;
  const previousStorage = globalThis.localStorage;
  try {
    globalThis.localStorage = { getItem: () => null };
    c.songLibrary = getSongLibrary();
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
  c.setCurrentSong(songId);
  c.speedSlider.value = "1"; c.applySpeed();
  return h;
}

for (const [songId, eventEnd, sourceEnd] of [
  ["fan-fang-xiang-de-zhong", 62, 64],
  ["gao-bai-qi-qiu", 129, 132],
  ["ye-de-gang-qin-qu-wu", 129, 132],
  ["qi-feng-le", 77, 80],
  ["yun-yan-cheng-yu", 120, 124],
  ["jasmine", 55, 56],
  ["song-bie", 94, 96],
  ["xuan-cao-hua", 191, 192]
]) {
  for (const mode of ["demo", "practice"]) {
    test(`${songId}: ${mode} preserves all ${sourceEnd - eventEnd} source-ending rest beats without extra onsets or an early finish`, async () => {
      const h = endingRestHarness(songId); const { c } = h;
      const scaledBeat = c.getScaledBeatSeconds();
      const sourceSteps = JSON.stringify(c.currentSong.steps);
      assert.equal(getEventTotalBeats(c.songEvents), eventEnd);
      assert.equal(c.songTotalBeats, sourceEnd);
      assert.equal(c.currentSong.sourceFeatures.sourceTotalBeats, sourceEnd);
      assert.equal(c.songEvents.length, c.currentSong.steps.length);
      assert.ok(c.songEvents.every(event => event.beat + event.duration <= eventEnd));
      near(c.getSongProgressDuration(), sourceEnd * scaledBeat + .9);
      if (mode === "demo") await c.playDemo();
      else await c.startPractice();
      // Deliver each actual onset in order before checking the silent interval.
      for (const event of c.songEvents) {
        h.stepTo(event.beat * scaledBeat + 1e-6); h.tick();
      }
      const heard = h.names();
      assert.equal(heard.length, mode === "demo" ? c.songEvents.length : 0);
      for (const restOffset of [0, .25, .5, .75, .99, 1].map(fraction => fraction * (sourceEnd - eventEnd))) {
        const seconds = (eventEnd + restOffset) * scaledBeat;
        h.stepTo(seconds); h.tick();
        near(c.currentPracticeTime(), seconds);
        assert.equal(c.shouldLoop(), true, `playback must remain active at source beat ${eventEnd + restOffset}`);
        assert.deepEqual(h.names(), heard, "ending rests must not synthesize attacks or replay earlier notes");
      }
      assert.equal(c.songProgress.attrs["aria-valuemax"], String(Math.round(sourceEnd * scaledBeat + .9)));
      h.stepTo(c.getSongEndSeconds() + .001); h.tick();
      assert.equal(c.shouldLoop(), false);
      assert.deepEqual(h.names(), heard);
      assert.equal(JSON.stringify(c.currentSong.steps), sourceSteps, "runtime must not extend note durations to fill ending silence");
    });
  }

  test(`${songId}: loop B reaches the source end and waits through its ending rest before wrapping`, async () => {
    const h = endingRestHarness(songId); const { c } = h;
    const scaledBeat = c.getScaledBeatSeconds();
    c.seekToSongTime((eventEnd - 4) * scaledBeat); c.togglePracticeLoop();
    c.handleLoopKeydown({ key: "End", preventDefault() {} }, "end");
    assert.equal(c.practiceLoopRange.endBeat, sourceEnd);
    assert.ok(c.practiceLoopRange.startBeat < eventEnd);
    near(Number(c.loopEndHandle.attrs["aria-valuenow"]), sourceEnd * scaledBeat);
    await c.playDemo(); h.tick();
    assert.deepEqual(h.names(), []);
    const phraseEvents = c.songEvents.filter(event => isBeatInLoop(event.beat, c.practiceLoopRange));
    for (const event of phraseEvents) {
      h.stepTo(event.beat * scaledBeat + 1e-6); h.tick();
    }
    const heard = h.names(); assert.equal(heard.length, phraseEvents.length);
    for (const beat of [0, .25, .5, .99].map(fraction => eventEnd + fraction * (sourceEnd - eventEnd))) {
      h.stepTo(beat * scaledBeat); h.tick();
      near(c.currentPracticeTime(), beat * scaledBeat);
      assert.equal(c.demoMode, true);
      assert.deepEqual(h.names(), heard, "loop must stay silent without wrapping at the last note's end");
    }
    h.stepTo(sourceEnd * scaledBeat + .001); h.tick();
    near(c.currentPracticeTime(), c.practiceLoopRange.startBeat * scaledBeat - c.getSessionLeadSeconds());
    assert.deepEqual(h.names(), heard, "the new loop's preparation is silent");
    h.healthy(c.getSessionLeadSeconds() + 1e-6);
    assert.equal(h.sounds.length, heard.length + 1, "the next pass starts with exactly one real melody onset");
  });
}

// Use real song-event builders for support tests so selector, scheduler, and
// melody/demo ownership are exercised together rather than with synthetic lanes.
function supportHarness({ range = null } = {}) {
  const h = harness({ range }); const { c } = h;
  const backing = (beats, name) => ({
    enabledByDefault: true, volume: .4,
    events: beats.map(beat => ({ beat, duration: .5, notes: [{ name, role: "harmony", velocity: .5 }] }))
  });
  c.currentSongId = "support-song";
  c.currentSong = melodySongFixture({
    id: c.currentSongId, title: "Support comparison", bpm: 120,
    steps: [0, 1, 2, 3, 3.75, 4, 5].map(beat => ["C4", beat, 1]),
    autoAccompaniment: backing([0, 1, 2, 3, 3.75, 4, 5], "G4"),
    practiceAccompaniment: backing([0, .5, 1, 1.5, 2, 3, 3.75, 4, 5], "A4")
  });
  c.currentSong.practiceAccompaniment.enabledByDefault = false;
  c.songLibrary[c.currentSongId] = c.currentSong;
  c.songEvents = c.buildSongEvents(c.currentSong);
  c.accompanimentEvents = c.buildAutoAccompanimentEvents(c.currentSong, "original");
  c.songTotalBeats = getEventTotalBeats(c.songEvents);
  c.accompanimentTotalBeats = getEventTotalBeats(c.accompanimentEvents);
  c.renderStaticBoard();
  c.resetPracticeState({ preserveLoop: Boolean(range) });
  h.selectSupport = style => {
    c.accompanimentStyleSelect.value = style;
    c.changeAccompanimentStyle();
  };
  return h;
}

function installChordSource(c) {
  c.songLibrary["support-song-v2"] = {
    ...c.currentSong, id: "support-song-v2", baseSongId: "support-song",
    arrangementKind: "chord", judgementMode: "chord",
    events: [{ beat: 0, duration: 1, notes: [
      { name: "C4", role: "melody", judge: true },
      { name: "G4", role: "harmony", judge: true }
    ] }]
  };
}

test("startup resolves legacy chord deep links and stored selections to melody practice", () => {
  const { c } = supportHarness(); installChordSource(c);
  assert.match(source, /let currentSongId = getInitialSongId\(\)/, "page startup must use the canonical initial-song resolver");
  c.window.location.search = "?song=support-song-v2";
  assert.equal(c.getInitialSongId(), "support-song");
  c.window.location.search = "?song=missing-song";
  c.readStoredSongId = () => "support-song-v2";
  assert.equal(c.getInitialSongId(), "support-song");
  c.window.location.search = ""; c.readStoredSongId = () => null;
  assert.equal(c.getInitialSongId(), "birthday");
});

test("song switching canonicalizes a legacy chord id before saving it or building playable notes", () => {
  const h = supportHarness(); const { c } = h; installChordSource(c);
  const savedIds = []; c.storeSongId = id => savedIds.push(id);
  c.setCurrentSong("support-song-v2");
  assert.equal(c.currentSongId, "support-song");
  assert.equal(c.currentSong, c.songLibrary["support-song"]);
  assert.deepEqual(savedIds, ["support-song"]);
  assert.ok(c.songEvents.every(event => event.notes.length === 1 && event.judgeLanes.length === 1));
  assert.equal(c.songEvents.length, c.currentSong.steps.length);
  assert.equal(c.accompanimentStyle, "light");
  assert.equal(c.accompanimentEnabled, false);
  assert.deepEqual(h.names(), []);
});

for (const style of ["off", "light", "original"]) {
  test(`own play with ${style} support never autoplays the melody`, async () => {
    const h = supportHarness(); const { c } = h;
    h.selectSupport(style); await c.startPractice(); h.tick();
    assert.deepEqual(h.names(), [], "support stays silent during the initial count-in");
    h.stepTo(0); h.tick();
    const expected = style === "off" ? [] : [style === "light" ? "A4" : "G4"];
    assert.deepEqual(h.names(), expected);
    assert.equal(c.practiceRunning, true); assert.equal(c.demoMode, false);
    h.stepTo(.5); h.tick();
    assert.equal(h.names().includes("C4"), false);
    assert.equal(h.names().length, style === "off" ? 0 : style === "light" ? 3 : 2);
  });
}

test("support style lookup uses a compatible candidate and missing light never falls back to original", () => {
  const h = supportHarness(); const { c } = h;
  const candidate = c.currentSong.practiceAccompaniment;
  delete c.currentSong.practiceAccompaniment;
  c.songLibrary["support-song-v2"] = { ...c.currentSong, id: "support-song-v2", baseSongId: "support-song", practiceAccompaniment: candidate };
  assert.equal(c.getPracticeAccompanimentConfig(c.currentSong), candidate);
  assert.equal(c.getAccompanimentConfig(c.currentSong, "light"), candidate);
  assert.equal(c.buildAutoAccompanimentEvents(c.currentSong, "light")[0].notes[0].name, "A4");
  c.applyAccompanimentControl();
  assert.equal(c.accompanimentStyleSelect.hidden, false);
  assert.equal(c.accompanimentBtn.hidden, true);
  delete c.songLibrary["support-song-v2"];
  assert.equal(c.getPracticeAccompanimentConfig(c.currentSong), null);
  assert.equal(c.getAccompanimentConfig(c.currentSong, "light"), null);
  c.applyAccompanimentControl();
  assert.equal(c.accompanimentStyleSelect.hidden, true);
  assert.equal(c.accompanimentBtn.hidden, false);
});

test("a replacement melody never schedules incompatible sibling support in either mode", () => {
  const { c } = supportHarness();
  const old = { ...c.currentSong, id: "support-song-v2", baseSongId: "support-song" };
  c.songLibrary[old.id] = old;
  c.currentSong = { ...c.currentSong, steps: c.currentSong.steps.slice(0, 3), events: c.currentSong.events.slice(0, 3) };
  delete c.currentSong.autoAccompaniment;
  delete c.currentSong.practiceAccompaniment;
  c.songLibrary[c.currentSong.id] = c.currentSong;
  assert.equal(c.getPracticeAccompanimentConfig(c.currentSong), null);
  for (const style of ["original", "light"]) {
    assert.equal(c.getAccompanimentConfig(c.currentSong, style), null);
    assert.equal(c.buildAutoAccompanimentEvents(c.currentSong, style).length, 0);
  }
  c.setCurrentSong(c.currentSong.id);
  assert.equal(c.accompanimentEvents.length, 0);
  c.applyAccompanimentControl(); // applySongMeta is intentionally stubbed in this scheduler harness.
  assert.equal(c.accompanimentStyleSelect.hidden, true);
  assert.equal(c.accompanimentBtn.hidden, true);
});

test("a new song stays off even with an old global enabled preference", () => {
  const h = supportHarness(); const { c } = h;
  assert.equal(c.getDefaultAccompanimentEnabled(c.currentSong), false, "candidate defaults take precedence over enabled original backing");
  c.setCurrentSong(c.currentSongId);
  assert.equal(c.accompanimentStyle, "light");
  assert.equal(c.accompanimentEnabled, false);
  assert.equal(c.accompanimentEvents[0].notes[0].name, "A4");
  c.storedAccompanimentEnabled = true; c.setCurrentSong(c.currentSongId);
  assert.equal(c.accompanimentEnabled, false);
  assert.equal(c.accompanimentStyle, "light");
  assert.deepEqual(h.names(), []);
});

test("switching support between onsets skips the new arrangement's backlog and keeps musical time", async () => {
  const h = supportHarness(); const { c } = h;
  await c.startPractice(); h.stepTo(.625); h.tick();
  assert.deepEqual(h.names(), ["G4", "G4"]);
  const before = c.currentPracticeTime();
  h.selectSupport("light"); h.tick();
  near(c.currentPracticeTime(), before);
  assert.deepEqual(h.names(), ["G4", "G4"], "earlier light-support onsets must not be delivered on selection");
  h.stepTo(.75); h.tick();
  assert.deepEqual(h.names(), ["G4", "G4", "A4"]);
  h.tick(); assert.equal(h.sounds.length, 3, "a delivered candidate onset plays only once");
});

test("switching support on an already-delivered onset never repeats that beat, including off and back on", async () => {
  const h = supportHarness(); const { c } = h;
  await c.startPractice(); h.stepTo(.5); h.tick();
  const heard = h.names();
  for (const style of ["light", "off", "original", "light"]) {
    h.selectSupport(style); h.tick();
    near(c.currentPracticeTime(), .5);
    assert.deepEqual(h.names(), heard, `${style} must not retrigger the current beat`);
  }
  h.stepTo(.75); h.tick();
  assert.deepEqual(h.names(), [...heard, "A4"]);
});

test("muted support can be enabled without a burst and its per-song off choice survives switching", async () => {
  const h = supportHarness(); const { c } = h;
  c.storedAccompanimentEnabled = true;
  c.storeAccompanimentEnabled = () => assert.fail("comparison choices must not persist global accompaniment preferences");
  h.selectSupport("off"); await c.startPractice(); h.stepTo(.625); h.tick();
  assert.deepEqual(h.names(), []);
  h.selectSupport("light"); h.tick();
  assert.deepEqual(h.names(), []);
  assert.equal(c.accompanimentEnabled, true);
  assert.equal(c.accompanimentStyleSelect.value, "light");
  h.stepTo(.75); h.tick(); assert.deepEqual(h.names(), ["A4"]);
  h.selectSupport("off"); h.stepTo(1); h.tick();
  assert.deepEqual(h.names(), ["A4"]);
  assert.equal(c.accompanimentStyleSelect.value, "off");
  assert.equal(c.storedAccompanimentEnabled, true);
  assert.equal(c.accompanimentVolume, .6);
  c.setCurrentSong(c.currentSongId);
  assert.equal(c.accompanimentStyle, "light");
  assert.equal(c.accompanimentEnabled, false);
  assert.equal(c.accompanimentEvents[0].notes[0].name, "A4");
});

test("demo plays melody with light support and turning support off changes neither demo ownership nor melody events", async () => {
  const h = supportHarness(); const { c } = h;
  const melodyEvents = c.songEvents;
  h.selectSupport("light"); await c.playDemo(); h.stepTo(0); h.tick();
  assert.deepEqual(h.names(), ["A4", "C4"]);
  h.selectSupport("off"); h.tick();
  assert.equal(c.songEvents, melodyEvents);
  assert.equal(c.demoMode, true); assert.equal(c.practiceRunning, false);
  assert.deepEqual(h.names(), ["A4", "C4"]);
  h.stepTo(.5); h.tick();
  assert.deepEqual(h.names(), ["A4", "C4", "C4"]);
});

for (const style of ["light", "original"]) {
  test(`${style} support respects paused count-in, speed changes, and exclusive phrase boundaries`, async () => {
    const h = supportHarness({ range: { startBeat: 2, endBeat: 4 } }); const { c } = h;
    const name = style === "light" ? "A4" : "G4";
    h.selectSupport(style); c.prepareLoopStart(); await c.startPractice();
    h.advance(.25); h.tick(); c.pausePractice();
    const pausedBeat = c.currentPracticeTime() / c.getScaledBeatSeconds();
    h.advance(20); h.tick();
    c.speedSlider.value = ".55"; c.applySpeed();
    near(c.currentPracticeTime() / c.getScaledBeatSeconds(), pausedBeat);
    assert.deepEqual(h.names(), []);
    await c.startPractice(); h.tick();
    const onset = 2 * c.getScaledBeatSeconds();
    h.healthy(onset - c.currentPracticeTime() - .001);
    assert.deepEqual(h.names(), []);
    h.advance(.002); h.tick(); assert.deepEqual(h.names(), [name]);
    near(h.sounds[0].duration, .5 * c.getScaledBeatSeconds() * .86);
    near(h.sounds[0].velocity, .5 * c.accompanimentVolume);
    h.stepTo(4 * c.getScaledBeatSeconds() + .01); h.tick();
    assert.deepEqual(h.names(), [name, name, name], "healthy frames deliver beats 3 and 3.75, excluding beat 4");
    near(c.currentPracticeTime(), onset - c.getSessionLeadSeconds());
    h.tick(); assert.equal(h.sounds.length, 3);
    h.healthy(c.getSessionLeadSeconds() + 1e-6);
    assert.deepEqual(h.names(), [name, name, name, name]);
  });
}

for (const seconds of [-.75, .5, .625]) {
  test(`demo to own play at ${seconds}s restarts with a complete preparation and one new first backing attack`, async () => {
    const h = supportHarness(); const { c } = h;
    h.selectSupport("light"); await c.playDemo(); h.stepTo(seconds); h.tick();
    const heard = h.names();
    await c.startPractice();
    near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
    assert.equal(c.demoMode, false); assert.equal(c.practiceRunning, true);
    assert.ok(c.accompanimentEvents.every(event => !event.played), "the new pass re-arms its backing attacks");
    h.tick(); assert.deepEqual(h.names(), heard);
    h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), heard);
    h.advance(.02); h.tick(); assert.deepEqual(h.names(), [...heard, "A4"]);
    h.tick(); assert.deepEqual(h.names(), [...heard, "A4"], "first attack belongs to one new pass, never an extra render");
  });
}

test("demo to own play preserves phrase and speed while re-arming attacks for a fresh A pass", async () => {
  const h = supportHarness({ range: { startBeat: 2, endBeat: 4 } }); const { c } = h;
  h.selectSupport("light"); c.speedSlider.value = ".55"; c.applySpeed();
  await c.playDemo(); h.stepTo(3 * c.getScaledBeatSeconds()); h.tick();
  const heard = h.names(), range = c.practiceLoopRange;
  await c.startPractice(); h.tick();
  const start = 2 * c.getScaledBeatSeconds();
  near(c.currentPracticeTime(), start - c.getSessionLeadSeconds());
  assert.equal(c.speedFactor, .55); assert.equal(c.practiceLoopRange, range);
  assert.equal(range.startBeat, 2); assert.equal(range.endBeat, 4);
  assert.ok(c.accompanimentEvents.every(event => !event.played)); assert.deepEqual(h.names(), heard);
  h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), heard);
  h.advance(.02); h.tick(); assert.deepEqual(h.names(), [...heard, "A4"]);
  h.stepTo(3 * c.getScaledBeatSeconds()); h.tick();
  assert.deepEqual(h.names(), [...heard, "A4", "A4"], "fresh A and its next note sound once, with no prior-phrase burst");
});

test("own-play audio preparation immediately stops the demo and starts one complete new count-in when ready", async () => {
  const h = supportHarness(); const { c } = h; const gate = deferred();
  h.selectSupport("light"); await c.playDemo(); h.stepTo(.5); h.tick(); const heard = h.names();
  c.ensureAudioContext = () => gate.promise;
  const pending = c.startPractice();
  assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0); assert.equal(c.pendingPlayback.mode, "practice");
  near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
  h.advance(5); h.tick(); assert.deepEqual(h.names(), heard);
  gate.resolve(); await pending; near(c.currentPracticeTime(), -c.getSessionLeadSeconds()); h.tick();
  assert.deepEqual(h.names(), heard); assert.equal(c.practiceRunning, true); assert.equal(c.demoMode, false);
  h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), heard);
  h.advance(.02); h.tick(); assert.deepEqual(h.names(), [...heard, "A4"]);
});

test("pausing exactly on a support onset and using Continue preserves its checkpoint without repeating it", async () => {
  const h = supportHarness(); const { c } = h;
  h.selectSupport("light"); await c.startPractice(); h.stepTo(.5); h.tick(); c.pausePractice();
  const heard = h.names(); h.advance(10); h.tick();
  await c.continuePractice(); near(c.resumePreparation.seconds, .5); near(c.currentPracticeTime(), .5);
  const lead = c.resumePreparation.duration;
  h.healthy(lead - .01); assert.deepEqual(h.names(), heard); assert.ok(c.resumePreparation);
  h.advance(.01); h.tick(); assert.equal(c.resumePreparation, null);
  near(c.currentPracticeTime(), .5); assert.deepEqual(h.names(), heard);
  h.stepTo(.75); h.tick(); assert.deepEqual(h.names(), [...heard, "A4"]);
});

test("switching a running own-play session to demo restarts melody and backing after one full count-in", async () => {
  const h = supportHarness(); const { c } = h;
  h.selectSupport("light"); await c.startPractice(); h.stepTo(.625); h.tick();
  const heard = h.names(); await c.playDemo(); h.tick();
  near(c.currentPracticeTime(), -c.getSessionLeadSeconds()); assert.deepEqual(h.names(), heard);
  assert.equal(c.practiceRunning, false); assert.equal(c.demoMode, true);
  assert.ok(c.songEvents.every(event => !event.demoPlayed));
  h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), heard);
  h.advance(.02); h.tick(); assert.deepEqual(h.names(), [...heard, "A4", "C4"]);
  h.tick(); assert.deepEqual(h.names(), [...heard, "A4", "C4"]);
});

test("a demo to own-play to demo round trip replaces preparation without duplicate early attacks", async () => {
  const h = supportHarness(); const { c } = h;
  h.selectSupport("light"); await c.playDemo(); h.stepTo(.5); h.tick();
  const heard = h.names();
  await c.startPractice(); h.tick(); await c.playDemo(); h.tick();
  near(c.currentPracticeTime(), -c.getSessionLeadSeconds()); assert.deepEqual(h.names(), heard);
  assert.equal(h.frames.size, 1, "only the newest preparation owns a RAF");
  h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), heard);
  h.advance(.02); h.tick(); assert.deepEqual(h.names(), [...heard, "A4", "C4"]);
});

for (const mode of ["practice", "demo"]) {
  test(`${mode}: loop onset is inclusive, end is exclusive, last onset survives a crossed frame`, async () => {
    const h = harness(); const { c } = h;
    if (mode === "demo") await c.playDemo();
    else { c.prepareLoopStart(); await c.startPractice(); }
    h.tick();
    assert.deepEqual(h.names(), []);
    // The initial countdown begins at beat 1, so old beat-zero notes must stay silent.
    near(c.currentPracticeTime(), .5);
    assert.equal(c.preparationCue.textContent, "3");
    assert.equal(c.statusText.textContent, mode === "demo" ? "示范准备 3" : "准备 3");
    h.healthy(1.5);
    assert.equal(c.statusText.textContent, mode === "demo" ? "示范中" : "练习中");
    assert.ok(h.names().includes("backing:4"));
    assert.equal(h.names().includes("melody:4"), mode === "demo");
    h.stepTo(2.86); h.tick();
    h.advance(.15); h.tick(); // A short boundary-straddling frame retains the last onset.
    const expected = mode === "demo" ? ["backing:4", "melody:4", "backing:5.75", "melody:5.75"] : ["backing:4", "backing:5.75"];
    assert.deepEqual(h.names(), expected);
    near(c.currentPracticeTime(), .5);
    h.healthy(.5);
    assert.deepEqual(h.names(), expected, "a restarted countdown must not replay old onsets");
    h.healthy(1);
    assert.equal(h.names().filter(name => name === "backing:4").length, 2);
    assert.equal(h.names().includes("backing:6"), false);
    assert.equal(h.names().includes("melody:6"), false);
  });
}

test("paused countdown stays frozen and a fresh mode click restarts the full musical preparation", async () => {
  const h = harness({ range: null }); const { c } = h;
  c.resetPracticeState(); await c.startPractice(); h.advance(.4); h.tick();
  c.pausePractice(); const paused = c.currentPracticeTime();
  assert.ok(paused < 0);
  h.advance(20); h.tick(); near(c.currentPracticeTime(), paused);
  assert.deepEqual(h.names(), []);
  await c.startPractice(); near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
  h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), []);
  h.advance(.02); h.tick(); assert.deepEqual(h.names(), ["backing:0"]);
});

for (const running of [false, true]) for (const seconds of [-1.25, 2.625]) {
  test(`speed preserves musical beat at ${seconds}s while ${running ? "running" : "paused"}`, () => {
    const h = harness(); const { c } = h;
    c.practiceRunning = running; h.stepTo(seconds);
    const beat = c.currentPracticeTime() / c.getScaledBeatSeconds();
    c.speedSlider.value = "0.55"; c.applySpeed();
    near(c.currentPracticeTime() / c.getScaledBeatSeconds(), beat);
    assert.equal(readSongSpeed(c.browserPreferenceStorage, c.currentSongId).speed, .55);
    assert.equal(c.practiceLoopRange.startBeat, 4); assert.equal(c.practiceLoopRange.endBeat, 6);
    if (running) { h.advance(.2); near(c.currentPracticeTime(), seconds / .55 + .2); }
  });
}

test("seek within repeat preserves it; seeking to the exclusive end or outside exits repeat", () => {
  for (const [seconds, remains] of [[2, true], [2.5, true], [1, false], [3, false], [4, false]]) {
    const { c } = harness(); c.seekToSongTime(seconds);
    assert.equal(Boolean(c.practiceLoopRange), remains);
    near(c.currentPracticeTime(), seconds);
    assert.equal(c.repeatBtn.attrs["aria-pressed"], String(remains));
  }
});

test("reset clears repeat and delivery state and returns to a silent song-start countdown", async () => {
  const h = harness(); const { c } = h;
  await c.playDemo(); h.stepTo(2.1); h.tick(); assert.ok(h.sounds.length);
  c.resetPracticeState(); h.sounds.length = 0;
  assert.equal(c.practiceLoopRange, null); assert.equal(c.shouldLoop(), false);
  near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
  assert.equal(c.repeatBtn.attrs["aria-pressed"], "false");
  assert.ok(c.songEvents.every(event => !event.demoPlayed));
  assert.ok(c.accompanimentEvents.every(event => !event.played));
  h.advance(10); h.tick(); assert.deepEqual(h.names(), []);
});

test("demo starts at the selected range even after seeking ahead inside it", async () => {
  const h = harness(); const { c } = h;
  c.seekToSongTime(2.5); await c.playDemo();
  assert.equal(c.practiceLoopRange.startBeat, 4); assert.equal(c.practiceLoopRange.endBeat, 6);
  near(c.currentPracticeTime(), 2 - c.getSessionLeadSeconds());
  h.tick(); assert.deepEqual(h.names(), []);
});

test("leaving repeat during its positive-time countdown does not replay the preceding phrase", async () => {
  const h = harness(); const { c } = h;
  await c.playDemo(); c.togglePracticeLoop();
  assert.equal(c.practiceLoopRange, null); near(c.currentPracticeTime(), 2);
  h.tick();
  assert.equal(h.names().includes("melody:0"), false);
  assert.equal(h.names().includes("backing:0"), false);
});

for (const action of ["pausePractice", "resetPracticeState"]) for (const start of ["startPractice", "playDemo"]) {
  test(`${action} cancels an unresolved ${start} audio request`, async () => {
    const h = harness(); const gate = deferred(); const { c } = h;
    c.ensureAudioContext = () => gate.promise;
    const pending = c[start](); c[action](); gate.resolve(); await pending;
    assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0); assert.deepEqual(h.names(), []);
  });
}

for (const order of [["startPractice", "playDemo"], ["playDemo", "startPractice"]]) {
  test(`latest ${order[1]} wins when older ${order[0]} finishes last`, async () => {
    const h = harness(); const { c } = h; const old = deferred(); const latest = deferred(); let call = 0;
    c.ensureAudioContext = () => (++call === 1 ? old.promise : latest.promise);
    const first = c[order[0]](); const second = c[order[1]]();
    latest.resolve(); await second; old.resolve(); await first;
    assert.equal(c.demoMode, order[1] === "playDemo");
    assert.equal(c.practiceRunning, order[1] === "startPractice");
    assert.equal(h.frames.size, 1);
  });
}

test("range drag pauses playback, ignores another pointer, snaps, and restarts with a count-in", async () => {
  const h = harness(); const { c } = h; await c.playDemo();
  const pointer = { pointerId: 7, button: 0, currentTarget: c.loopEndHandle, preventDefault() {} };
  c.startLoopDrag(pointer, "end"); assert.equal(c.shouldLoop(), false);
  const oldEnd = c.practiceLoopRange.endBeat;
  c.moveLoopDrag({ ...pointer, pointerId: 8, clientX: 1000 }); assert.equal(c.practiceLoopRange.endBeat, oldEnd);
  c.moveLoopDrag({ ...pointer, clientX: 1000 }); assert.equal(c.practiceLoopRange.endBeat, 10);
  c.finishLoopDrag({ ...pointer, type: "pointerup" });
  assert.equal(c.demoMode, true); near(c.currentPracticeTime(), 2 - c.getSessionLeadSeconds());
  assert.deepEqual(h.names(), []);
});

test("canceling a range drag cannot unexpectedly resume playback", async () => {
  const { c } = harness(); await c.playDemo();
  const pointer = { pointerId: 7, button: 0, currentTarget: c.loopStartHandle, preventDefault() {} };
  c.startLoopDrag(pointer, "start"); c.finishLoopDrag({ ...pointer, type: "pointercancel" });
  assert.equal(c.shouldLoop(), false); assert.equal(c.pauseBtn.disabled, false);
  assert.equal(c.pauseBtn.textContent, "继续");
  assert.equal(c.pausedSession.mode, "demo");
});

for (const beat of [4, 4.04, 5.8]) {
  test(`exiting repeat at beat ${beat} never bursts previous phrases or repeats a recent note`, async () => {
    const h = harness({ beats: [0, 3.99, 4, 4.15, 5.75, 6, 8] }); const { c } = h;
    await c.playDemo(); h.stepTo(beat * c.getScaledBeatSeconds()); h.tick();
    const heard = h.names();
    assert.ok(heard.includes("melody:4"));
    c.togglePracticeLoop(); h.tick();
    assert.equal(c.practiceLoopRange, null);
    assert.deepEqual(h.names(), heard, "exiting repeat must not replay an onset already delivered");
    h.stepTo(3); h.tick();
    assert.equal(h.names().filter(name => name === "melody:6").length, 1);
    assert.equal(h.names().filter(name => name === "backing:6").length, 1);
    assert.equal(h.names().some(name => /:(0|3\.99)$/.test(name)), false);
  });
}

test("pausing a selected phrase freezes its countdown and a new mode click fully prepares A again", async () => {
  const h = harness(); const { c } = h;
  c.prepareLoopStart(); await c.startPractice(); h.advance(.25); h.tick();
  c.pausePractice(); const paused = c.currentPracticeTime();
  assert.ok(paused > 0 && paused < c.practiceLoopRange.startBeat * c.getScaledBeatSeconds());
  h.advance(60); h.tick(); near(c.currentPracticeTime(), paused);
  const range = c.practiceLoopRange;
  await c.startPractice(); near(c.currentPracticeTime(), 2 - c.getSessionLeadSeconds());
  assert.equal(c.practiceLoopRange, range);
  h.healthy(c.getSessionLeadSeconds() - .01); assert.deepEqual(h.names(), []);
  h.advance(.02); h.tick(); assert.deepEqual(h.names(), ["backing:4"]);
});

test("reset while demo samples are still loading prevents a late demo restart", async () => {
  const h = harness(); const { c } = h; const gate = deferred();
  c.preloadKalimbaSamples = () => gate.promise;
  const pending = c.playDemo(); await Promise.resolve();
  c.resetPracticeState(); gate.resolve(); await pending;
  assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0);
  assert.equal(c.practiceLoopRange, null); assert.deepEqual(h.names(), []);
});

for (const speed of [.35, .55, 1, 1.4]) {
  test(`count-in at ${speed}x has whole beats, covers the visual approach, and ends at the loop onset`, async () => {
    const h = harness(); const { c } = h;
    c.speedSlider.value = String(speed); c.applySpeed();
    c.prepareLoopStart(); await c.startPractice(); h.tick();
    const beatSeconds = c.getScaledBeatSeconds();
    const count = c.getSessionLeadSeconds() / beatSeconds;
    assert.ok(Number.isInteger(count) && count >= 3);
    assert.ok(c.getSessionLeadSeconds() >= c.getVisualFallLeadSeconds());
    assert.equal(c.preparationCue.textContent, String(count));
    h.healthy(beatSeconds);
    assert.equal(c.preparationCue.textContent, String(count - 1));
    assert.deepEqual(h.names(), []);
    h.healthy(c.getSessionLeadSeconds() - beatSeconds + 1e-6);
    assert.equal(c.preparationCue.hidden, true);
    assert.deepEqual(h.names(), ["backing:4"]);
  });
}

function installSwitchSong(c) {
  c.songLibrary["next-song"] = melodySongFixture({
    id: "next-song", title: "Next song", bpm: 144,
    steps: [["C4", 0, 1], ["D4", 1, 1], ["E4", 2, 1]],
    autoAccompaniment: {
      enabledByDefault: true, volume: .4,
      events: [{ beat: 0, duration: 1, notes: [{ name: "G4", velocity: .5 }] }]
    }
  });
}

test("switching songs during a positive-time demo never sounds the new song before Start", async () => {
  const h = harness(); const { c } = h;
  installSwitchSong(c);
  await c.playDemo(); h.stepTo(2.7); h.tick();
  assert.ok(h.sounds.length > 0); h.sounds.length = 0;
  c.setCurrentSong("next-song");
  assert.equal(c.currentSongId, "next-song");
  assert.equal(c.songEvents[0].notes[0].name, "C4");
  assert.equal(c.accompanimentEvents[0].notes[0].name, "G4");
  assert.equal(c.practiceLoopRange, null); assert.equal(c.shouldLoop(), false);
  assert.deepEqual(h.names(), [], "speed application and reset must remain silent during a song switch");
  assert.ok(c.songEvents.every(event => !event.demoPlayed));
  assert.ok(c.accompanimentEvents.every(event => !event.played));
  near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
  h.advance(30); h.tick(); assert.deepEqual(h.names(), []);
  assert.equal(c.accompanimentEnabled, false, "new songs are opt-in");
  c.toggleAccompaniment(); // Explicitly enable the original-only fixture; keep the timing oracle unchanged.
  assert.deepEqual(h.names(), []);
  await c.startPractice(); h.tick(); assert.deepEqual(h.names(), []);
  h.healthy(c.getSessionLeadSeconds() + 1e-6);
  assert.deepEqual(h.names(), ["G4"]);
});

test("switching from a slow song to remembered fast speed creates a fresh full preparation", async () => {
  const h = harness(); const { c } = h;
  installSwitchSong(c);
  c.speedSlider.value = "0.35"; c.applySpeed(); c.resetPracticeState();
  assert.equal(saveSongSpeed(c.browserPreferenceStorage, "next-song", 1.4).saved, true);
  c.setCurrentSong("next-song");
  assert.equal(c.speedFactor, 1.4);
  assert.equal(c.accompanimentEnabled, false, "new songs are opt-in");
  c.toggleAccompaniment(); // This test still exercises backing and melody onsets together.
  const countdown = -c.currentPracticeTime();
  const scaledBeat = c.getScaledBeatSeconds();
  assert.ok(countdown >= c.getVisualFallLeadSeconds(), "old speed's count-in must not be proportionally shortened below the new visual approach");
  near(countdown, c.getSessionLeadSeconds());
  assert.ok(Number.isInteger(countdown / scaledBeat));
  assert.ok(countdown / scaledBeat >= 3);
  assert.equal(readSongSpeed(c.browserPreferenceStorage, "next-song").speed, 1.4);
  await c.playDemo(); h.tick();
  assert.equal(c.preparationCue.textContent, String(countdown / scaledBeat));
  h.healthy(countdown - .001); assert.deepEqual(h.names(), []);
  h.advance(.002); h.tick();
  assert.deepEqual(h.names(), ["G4", "C4"]);
});

for (const range of [null, { startBeat: 4, endBeat: 6 }]) {
  test(`speeding up before first Start refreshes the ${range ? "selected phrase" : "song"} count-in to cover its visual approach`, async () => {
    const h = harness({ range }); const { c } = h;
    c.speedSlider.value = "0.35"; c.applySpeed();
    c.resetPracticeState({ preserveLoop: Boolean(range) });
    assert.equal(c.statusText.textContent, "待开始");
    c.speedSlider.value = "1.4"; c.applySpeed();
    const onset = (range?.startBeat ?? 0) * c.getScaledBeatSeconds();
    const countdown = onset - c.currentPracticeTime();
    assert.ok(countdown >= c.getVisualFallLeadSeconds(), "changing speed before Start needs a fresh full visual approach");
    near(countdown, c.getSessionLeadSeconds());
    assert.ok(Number.isInteger(countdown / c.getScaledBeatSeconds()));
    assert.deepEqual(h.names(), []);
    await c.startPractice(); h.tick();
    assert.equal(c.statusText.textContent, `准备 ${countdown / c.getScaledBeatSeconds()}`);
    h.healthy(countdown - .001); assert.deepEqual(h.names(), []);
    h.advance(.002); h.tick();
    assert.equal(c.statusText.textContent, "练习中");
    assert.deepEqual(h.names(), [`backing:${range?.startBeat ?? 0}`]);
  });
}

test("reset cancels a pending range drag so stale release cannot restart new playback", async () => {
  const { c } = harness();
  await c.playDemo();
  const pointer = { pointerId: 7, button: 0, currentTarget: c.loopStartHandle, preventDefault() {} };
  c.startLoopDrag(pointer, "start");
  c.resetPracticeState();
  c.togglePracticeLoop();
  c.finishLoopDrag({ ...pointer, type: "pointerup" });
  assert.equal(c.shouldLoop(), false);
  assert.equal(c.pauseBtn.disabled, true);
});

test("progress thumb stays at A during a positive-time phrase count-in", async () => {
  const { c } = harness();
  await c.playDemo();
  c.renderSongProgress(c.currentPracticeTime());
  assert.equal(c.songProgress.attrs["aria-valuenow"], "2");
  assert.equal(c.songElapsed.textContent, "0:02");
});


for (const speed of [0.35, 0.55, 1, 1.4]) {
  test(`Interstellar source triplet phrase plays all 144 onsets once at ${speed}x through actual frame scheduling`, async () => {
    const h = endingRestHarness("interstellar-main-theme"); const { c } = h;
    c.accompanimentEnabled = false; // Isolate the unchanged melody-demo scheduler.
    c.speedSlider.value = String(speed); c.applySpeed();
    c.practiceLoopRange = { startBeat: 131, endBeat: 155 };
    c.prepareLoopStart();
    const expected = c.songEvents.filter(event => event.beat >= 131 && event.beat < 155)
      .flatMap(event => event.notes.map(note => note.name));
    assert.equal(expected.length, 144);
    await c.playDemo();
    const start = 131 * c.getScaledBeatSeconds();
    const end = 155 * c.getScaledBeatSeconds();
    // Thirty frames/sec, including fractional onsets between frames. The last
    // sample remains strictly before B, so the next cycle cannot contaminate it.
    for (let time = start; time < end; time += 1 / 30) { h.stepTo(time); h.tick(); }
    h.stepTo(end - 1e-6); h.tick();
    assert.deepEqual(h.names(), Array.from(expected));
    h.stepTo(end + 1e-6); h.tick();
    assert.deepEqual(h.names(), Array.from(expected), "wrap must wait for preparation before the next A attack");
    assert.ok(c.currentPracticeTime() < start);
    c.pausePractice();
  });
}

for (const songId of ["ling-er-xiang-ding-dang", "see-you-again", "mo-he-wu-ting-verse", "song-bie", "mi-xue-bing-cheng-theme", "da-yu-xiao-yu", "tong-nian", "tai-yang-zhao-chang-sheng-qi"]) {
  for (const speed of [.55, 1]) {
    test(`${songId}: complete corrected single-note melody is scheduled once at ${speed}x without incompatible support`, async () => {
      const h = endingRestHarness(songId); const { c } = h;
      c.speedSlider.value = String(speed); c.applySpeed();
      assert.equal(c.accompanimentEvents.length, songId === "see-you-again" ? 24 : songId === "ling-er-xiang-ding-dang" ? 16 : 0);
      if (["see-you-again", "ling-er-xiang-ding-dang"].includes(songId)) assert.equal(c.accompanimentEnabled, false, "reviewed support stays opt-in");
      const expected = c.currentSong.steps.map(([name]) => name);
      await c.playDemo();
      const end = c.getSongEndSeconds();
      for (let frame = 0; frame <= Math.ceil(end * 30); frame++) {
        h.stepTo(frame / 30); h.tick();
      }
      // One actual following frame avoids equality-rounding at an exact 30 Hz end.
      h.stepTo(end + 1 / 30); h.tick();
      assert.deepEqual(h.names(), expected);
      assert.equal(c.shouldLoop(), false);
    });
  }
}

for (const speed of [.35, .55, 1]) {
  test(`Rain corrected repeated eighths preserve every attack and exclusive loop boundary at ${speed}x`, async () => {
    const h = endingRestHarness("da-yu-xiao-yu"); const { c } = h;
    c.speedSlider.value = String(speed); c.applySpeed();
    c.practiceLoopRange = { startBeat: 32, endBeat: 40 };
    c.prepareLoopStart();
    const expected = c.songEvents.filter(event => event.beat >= 32 && event.beat < 40)
      .flatMap(event => event.notes.map(note => note.name));
    assert.equal(expected.length, 16);
    await c.playDemo();
    const start = 32 * c.getScaledBeatSeconds(), end = 40 * c.getScaledBeatSeconds();
    for (let time = start; time < end; time += 1 / 30) { h.stepTo(time); h.tick(); }
    h.stepTo(end - 1e-6); h.tick();
    assert.deepEqual(h.names(), Array.from(expected));
    h.stepTo(end + 1e-6); h.tick();
    assert.deepEqual(h.names(), Array.from(expected), "no bar 11 note or repeated A before count-in");
    assert.ok(c.currentPracticeTime() < start);
    c.pausePractice();
  });
}

for (const speed of [.35, .55, 1, 1.4]) {
  test(`Childhood selected teaching opening preserves the two shared ties at ${speed}x and wrap safely`, async () => {
    const h = endingRestHarness("tong-nian"); const { c } = h;
    c.speedSlider.value = String(speed); c.applySpeed();
    assert.equal(c.songEvents.length, 79);
    assert.equal(c.accompanimentEvents.length, 0);
    c.practiceLoopRange = { startBeat: 1, endBeat: 8 };
    c.prepareLoopStart();
    const expected = ["E4", "G4", "G4", "E4", "A4", "A4", "B4", "A4", "A4", "A4", "G4"];
    await c.playDemo();
    const start = c.getScaledBeatSeconds(), end = 8 * c.getScaledBeatSeconds();
    for (let time = start; time < end; time += 1 / 30) { h.stepTo(time); h.tick(); }
    h.stepTo(end - 1e-6); h.tick();
    assert.deepEqual(h.names(), expected, "tied continuations are not attacks; true neighbouring repeated notes remain");
    h.stepTo(end + 1e-6); h.tick();
    assert.deepEqual(h.names(), expected, "wrap prepares before reattacking A and excludes next phrase");
    assert.ok(c.currentPracticeTime() < start);
    c.pausePractice();
  });
}


for (const speed of [.55, 1]) {
  for (const [from, to, expected] of [
    [4, 8, ["E4", "E4", "F4", "G4"]],
    [37, 40, ["A4", "G4"]],
    [44, 52, ["E4", "D4", "A4", "G4"]],
    [52, 60, ["E4", "D4", "E4", "D4", "A4", "F4"]]
  ]) {
    test(`Sunrise reviewed tie range [${from},${to}) preserves true attacks at ${speed}x`, async () => {
      const h = endingRestHarness("tai-yang-zhao-chang-sheng-qi"); const { c } = h;
      c.speedSlider.value = String(speed); c.applySpeed();
      assert.equal(c.songEvents.length, 56); assert.equal(c.songTotalBeats, 68);
      assert.equal(c.accompanimentEvents.length, 0);
      c.practiceLoopRange = { startBeat: from, endBeat: to }; c.prepareLoopStart();
      await c.playDemo();
      const start = from * c.getScaledBeatSeconds(), end = to * c.getScaledBeatSeconds();
      for (let time = start; time < end; time += 1 / 30) { h.stepTo(time); h.tick(); }
      h.stepTo(end - 1e-6); h.tick(); assert.deepEqual(h.names(), expected);
      h.stepTo(end + 1e-6); h.tick(); assert.deepEqual(h.names(), expected);
      assert.ok(c.currentPracticeTime() < start); c.pausePractice();
    });
  }
}

for (const speed of [.35, .55, 1, 1.4]) {
  for (const [from, to, expected] of [
    [28, 32, ["D5", "D5", "E5", "C5", "C5", "E5", "G5"]],
    [40, 48, ["A5", "C6", "D6", "E6", "D6", "C6", "A5", "C6", "D6", "D6", "C6", "C6", "A5", "C6"]]
  ]) {
    test(`See You reviewed preview range [${from},${to}) preserves true attacks at ${speed}x`, async () => {
      const h = endingRestHarness("see-you-again"); const { c } = h;
      c.speedSlider.value = String(speed); c.applySpeed();
      assert.equal(c.songEvents.length, 86); assert.equal(c.songTotalBeats, 48);
      assert.equal(c.accompanimentEvents.length, 24, "only new compatible support is available");
      assert.equal(c.accompanimentEnabled, false, "opt-in support does not change default melody test");
      c.practiceLoopRange = { startBeat: from, endBeat: to }; c.prepareLoopStart();
      await c.playDemo();
      const start = from * c.getScaledBeatSeconds(), end = to * c.getScaledBeatSeconds();
      for (let time = start; time < end; time += 1 / 30) { h.stepTo(time); h.tick(); }
      h.stepTo(end - 1e-6); h.tick(); assert.deepEqual(h.names(), expected);
      h.stepTo(end + 1e-6); h.tick(); assert.deepEqual(h.names(), expected);
      assert.ok(c.currentPracticeTime() < start); c.pausePractice();
    });
  }
}

for (const speed of [.55, 1]) {
  for (const mode of ["own", "demo"]) {
    test(`See You optional lower voice plays exactly 24 quiet attacks in ${mode} at ${speed}x`, async () => {
      const h = endingRestHarness("see-you-again"); const { c } = h;
      assert.equal(c.accompanimentEnabled, false); near(c.accompanimentVolume,.30);
      const melody = c.currentSong.steps.map(([name])=>name);
      const bass = c.accompanimentEvents.flatMap(event=>event.notes.map(note=>note.name));
      assert.equal(bass.length,24); assert.equal(c.songEvents.length,86);
      c.speedSlider.value=String(speed);c.applySpeed();
      c.accompanimentStyleSelect.value="light";c.changeAccompanimentStyle();
      await (mode === "demo" ? c.playDemo() : c.startPractice());
      h.stepTo(c.getSongEndSeconds()+1/30);h.tick();
      const low=h.sounds.filter(sound=>["F3","G3","A3"].includes(sound.name));
      assert.deepEqual(low.map(sound=>sound.name),Array.from(bass));
      for(const sound of low) near(sound.velocity,.30*.32);
      assert.deepEqual(h.sounds.filter(sound=>!["F3","G3","A3"].includes(sound.name)).map(sound=>sound.name),mode === "demo" ? melody : []);
      assert.equal(c.shouldLoop(),false);
    });
  }
}
test("light-only support retains global volume but ignores old global enable",()=>{
 const h=endingRestHarness("see-you-again");const {c}=h;
 near(c.getDefaultAccompanimentVolume(c.currentSong),.30);
 c.storedAccompanimentVolume=.07;c.storedAccompanimentEnabled=true;c.setCurrentSong("see-you-again");
 near(c.accompanimentVolume,.07);assert.equal(c.accompanimentEnabled,false);
 c.storedAccompanimentVolume=0;c.storedAccompanimentEnabled=false;c.setCurrentSong("see-you-again");
 assert.equal(c.accompanimentVolume,0);assert.equal(c.accompanimentEnabled,false);
});
for (const speed of [.55,1.4]) {
 test(`See You opt-in support respects A–B [28,32) and exclusive end at ${speed}x`,async()=>{
  const h=endingRestHarness("see-you-again");const {c}=h;
  c.speedSlider.value=String(speed);c.applySpeed();c.accompanimentStyleSelect.value="light";c.changeAccompanimentStyle();
  c.practiceLoopRange={startBeat:28,endBeat:32};c.prepareLoopStart();await c.startPractice();
  const start=28*c.getScaledBeatSeconds(),end=32*c.getScaledBeatSeconds();
  for(let t=start;t<end;t+=1/30){h.stepTo(t);h.tick();}
  h.stepTo(end-1e-6);h.tick();assert.deepEqual(h.names(),["F3","G3"]);
  h.stepTo(end+1e-6);h.tick();assert.deepEqual(h.names(),["F3","G3"]);
  assert.ok(c.currentPracticeTime()<start);c.pausePractice();
 });
}

test("actual selector restores light/off through song switching and a new page without enabling another song", () => {
  const first = supportHarness(); const { c } = first;
  const physical = JSON.stringify(c.songEvents);
  const other = melodySongFixture({ ...structuredClone(c.currentSong), id: "other-song" });
  c.songLibrary[other.id] = other;
  first.selectSupport("light");
  assert.equal(JSON.stringify(c.songEvents), physical, "preference must not change physical notes");
  assert.equal(c.accompanimentEnabled, true);
  c.setCurrentSong(other.id);
  assert.equal(c.accompanimentEnabled, false, "an unseen song never inherits on");
  c.setCurrentSong("support-song");
  assert.equal(c.accompanimentEnabled, true);
  const reloaded = supportHarness();
  reloaded.c.browserPreferenceStorage = c.browserPreferenceStorage;
  reloaded.c.setCurrentSong("support-song");
  assert.equal(reloaded.c.accompanimentEnabled, true);
  reloaded.selectSupport("off");
  c.setCurrentSong("support-song");
  assert.equal(c.accompanimentEnabled, false, "same-song later loads read the latest explicit choice");
  assert.deepEqual(first.names(), []);
});

test("all See You canonical, legacy and reviewed-support entry links share one preference key", () => {
  const h = endingRestHarness("see-you-again"); const { c } = h;
  const writes = [];
  const store = c.browserPreferenceStorage;
  c.browserPreferenceStorage = { getItem: store.getItem, setItem(key, value) { writes.push(key); store.setItem(key, value); } };
  c.accompanimentStyleSelect.value = "light"; c.changeAccompanimentStyle();
  const key = writes.at(-1);
  assert.equal(key, "kalimba-song-accompaniment-v1:see-you-again");
  for (const requested of ["see-you-again", "see-you-again-chord", "see-you-again-reviewed-support"]) {
    const reload = endingRestHarness("birthday");
    reload.c.browserPreferenceStorage = c.browserPreferenceStorage;
    reload.c.window.location.search = `?song=${requested}`;
    reload.c.setCurrentSong(reload.c.getInitialSongId());
    assert.equal(reload.c.currentSongId, "see-you-again");
    assert.equal(reload.c.accompanimentEnabled, true);
    assert.equal(reload.c.accompanimentEvents.length, 24);
    assert.equal(reload.c.songEvents.length, 86);
    assert.ok(reload.c.songEvents.every(event => event.judgeLanes.length === 1 && event.notes.length === 1));
  }
  assert.deepEqual(writes, [key], "restoration never rewrites a record or creates an alias key");
});

test("single-note, tempo, extent, provider and backing changes invalidate remembered light", () => {
  for (const change of [
    song => { song.events[0].notes[0].name = "D4"; song.steps[0][0] = "D4"; },
    song => { song.events[0].beat += .125; song.steps[0][1] += .125; },
    song => { song.events[0].duration += .125; song.steps[0][2] += .125; },
    song => { song.bpm += 1; }, song => { song.sourceFeatures = { sourceTotalBeats: 12 }; },
    song => { song.practiceAccompaniment.events[0].notes[0].name = "G4"; },
    song => { song.practiceAccompaniment.events[0].notes[0].velocity = .4; },
    song => { song.practiceAccompaniment.events[0].duration = .25; },
    song => { song.practiceAccompaniment.volume = .3; },
    song => { delete song.practiceAccompaniment; }
  ]) {
    const h = supportHarness(); const { c } = h;
    h.selectSupport("light"); change(c.currentSong); c.setCurrentSong(c.currentSongId);
    assert.equal(c.accompanimentEnabled, false, String(change));
    assert.deepEqual(h.names(), []);
  }
  const h = supportHarness(); const { c } = h;
  h.selectSupport("light");
  c.songLibrary["different-provider"] = { ...structuredClone(c.currentSong), id: "different-provider", baseSongId: c.currentSongId };
  delete c.currentSong.practiceAccompaniment;
  c.setCurrentSong(c.currentSongId);
  assert.ok(c.getPracticeAccompanimentConfig(c.currentSong));
  assert.equal(c.accompanimentEnabled, false, "a different provider does not inherit approval despite equal sounds");
});

test("unrelated display metadata and suggested defaults do not invalidate the exact sound identity", () => {
  const h = supportHarness(); const { c } = h;
  h.selectSupport("light");
  const signature = c.getSongAccompanimentSignature(c.currentSong);
  Object.assign(c.currentSong, { title: "Revised title", defaultSpeedFactor: .7,
    sourceFeatures: { reviewNote: "Updated prose" } });
  c.currentSong.practiceAccompaniment.enabledByDefault = true;
  c.currentSong.practiceAccompaniment.events[0].pattern = "Annotation only";
  assert.equal(c.getSongAccompanimentSignature(c.currentSong), signature);
  c.setCurrentSong(c.currentSongId);
  assert.equal(c.accompanimentEnabled, true);
});

test("removed or incompatible light stays off even when compatible original backing remains", () => {
  const h = supportHarness(); const { c } = h;
  h.selectSupport("light");
  const provider = { ...structuredClone(c.currentSong), id: "old-support", baseSongId: c.currentSongId };
  provider.events[0].notes[0].name = "D4";
  c.songLibrary[provider.id] = provider;
  delete c.currentSong.practiceAccompaniment;
  c.setCurrentSong(c.currentSongId);
  assert.equal(c.getPracticeAccompanimentConfig(c.currentSong), null);
  assert.equal(c.getAccompanimentConfig(c.currentSong, "light"), null);
  assert.ok(c.getAccompanimentConfig(c.currentSong, "original"));
  assert.equal(c.accompanimentEnabled, false);
  h.selectSupport("light");
  assert.equal(c.accompanimentEnabled, false, "a stale light selection cannot silently play original");
});

test("failed manual saves remain usable and beat defaults within this tab, including off", () => {
  for (const failure of ["read", "write", "readback"]) {
    const h = supportHarness(); const { c } = h;
    const errors = []; c.showKeyWidthStatus = value => errors.push(value);
    c.browserPreferenceStorage = {
      getItem() { if (failure === "read") throw new Error("Denied"); return null; },
      setItem() { if (failure === "write") throw new Error("Quota"); }
    };
    h.selectSupport("light");
    assert.equal(c.accompanimentEnabled, true);
    assert.match(errors[0], /未保存/);
    c.setCurrentSong(c.currentSongId);
    assert.equal(c.accompanimentEnabled, true);
    h.selectSupport("off"); c.setCurrentSong(c.currentSongId);
    assert.equal(c.accompanimentEnabled, false);
    h.selectSupport("light"); c.currentSong.practiceAccompaniment.events[0].notes[0].name = "G4";
    c.setCurrentSong(c.currentSongId);
    assert.equal(c.accompanimentEnabled, false, "even temporary approval is bound to exact source content");
  }
});

test("tab writes affect the next load, never a running tab's current audio choice", async () => {
  const first = supportHarness(); first.selectSupport("light");
  const second = supportHarness(); second.c.browserPreferenceStorage = first.c.browserPreferenceStorage;
  second.c.setCurrentSong(second.c.currentSongId);
  assert.equal(second.c.accompanimentEnabled, true);
  await first.c.startPractice(); first.stepTo(0); first.tick();
  const heard = first.names();
  second.selectSupport("off");
  assert.equal(first.c.accompanimentEnabled, true);
  assert.deepEqual(first.names(), heard);
  first.c.setCurrentSong(first.c.currentSongId);
  assert.equal(first.c.accompanimentEnabled, false);
});

test("invalid or future saved choices load off without overwriting and manual selection remains available", () => {
  const h = supportHarness(); const { c } = h;
  const key = "kalimba-song-accompaniment-v1:support-song";
  const invalid = JSON.stringify({ schemaVersion: 8, choice: "light", sourceSignature: c.getSongAccompanimentSignature(c.currentSong) });
  c.browserPreferenceStorage.setItem(key, invalid);
  c.setCurrentSong(c.currentSongId);
  assert.equal(c.accompanimentEnabled, false);
  h.selectSupport("light");
  assert.equal(c.accompanimentEnabled, true);
  assert.equal(c.browserPreferenceStorage.getItem(key), invalid);
  c.setCurrentSong(c.currentSongId);
  assert.equal(c.accompanimentEnabled, true);
});

for (const speed of [.35, .55, 1, 1.4]) {
  test(`Jingle short refrain keeps every repeated and paired eighth attack across loop wrap at ${speed}x`, async () => {
    const h = endingRestHarness("ling-er-xiang-ding-dang"); const { c } = h;
    c.speedSlider.value = String(speed); c.applySpeed();
    assert.equal(c.accompanimentEvents.length, 16, "only the compatible new root support is available");
    assert.equal(c.accompanimentEnabled, false, "new root support stays opt-in while melody loop is unchanged");
    assert.deepEqual(Array.from(c.accompanimentEvents, event => event.beat), Array.from({length:16}, (_, index) => index * 4));
    c.practiceLoopRange = { startBeat: 16, endBeat: 24 }; c.prepareLoopStart();
    const expected = ["F5", "F5", "F5", "F5", "F5", "E5", "E5", "E5", "E5"];
    await c.playDemo();
    const start = 16 * c.getScaledBeatSeconds(), end = 24 * c.getScaledBeatSeconds();
    // Healthy stepped trajectory with exact onset callbacks, not a fixed-cadence timing claim.
    for (let time = start; time < end; time += 1 / 30) { h.stepTo(time); h.tick(); }
    h.stepTo(end - 1e-6); h.tick(); assert.deepEqual(h.names(), expected);
    h.stepTo(end + 1e-6); h.tick(); assert.deepEqual(h.names(), expected);
    assert.ok(c.currentPracticeTime() < start);
    h.stepTo(start); h.tick(); assert.deepEqual(h.names(), [...expected, "F5"]);
    c.pausePractice();
  });
}

test("malformed available support cannot become a remembered or manually selected light source", () => {
  for (const change of [
    song => { song.practiceAccompaniment.events[0].notes[0].name = "C#4"; },
    song => { song.practiceAccompaniment.events[0].notes[0].velocity = NaN; },
    song => { song.practiceAccompaniment.events[0].notes = [null]; },
    song => { song.practiceAccompaniment.events[0].duration = 0; },
    song => { song.practiceAccompaniment.volume = Infinity; }
  ]) {
    const h = supportHarness(); const { c } = h; change(c.currentSong);
    assert.equal(c.getSongAccompanimentSignature(c.currentSong), null);
    // Only test the selector on structurally buildable inputs; malformed null
    // notes are rejected at normalization in the actual library/import path.
    if (c.currentSong.practiceAccompaniment.events[0].notes[0]) {
      h.selectSupport("light"); assert.equal(c.accompanimentEnabled, false);
    }
  }
});

test("legacy original-only toggle remains usable for this session without writing a global or light preference", () => {
  const h = harness(); const { c } = h;
  installSwitchSong(c); c.setCurrentSong("next-song");
  const writes = [];
  c.browserPreferenceStorage.setItem = (...args) => writes.push(args);
  assert.equal(c.accompanimentEnabled, false);
  c.toggleAccompaniment(); assert.equal(c.accompanimentEnabled, true);
  c.toggleAccompaniment(); assert.equal(c.accompanimentEnabled, false);
  c.toggleAccompaniment(); c.setCurrentSong("next-song");
  assert.equal(c.accompanimentEnabled, false);
  assert.deepEqual(writes, []);
});

for (const speed of [.35, .55, 1, 1.4]) {
  for (const mode of ["own", "demo"]) {
    test(`Jingle opt-in root support keeps exactly 16 quiet app attacks and 51 physical targets in ${mode} at ${speed}x`, async () => {
      const h = endingRestHarness("ling-er-xiang-ding-dang"); const { c } = h;
      assert.equal(c.accompanimentEnabled, false); near(c.accompanimentVolume, .30);
      assert.equal(c.songEvents.length, 51);
      const roots = ["C4", "C4", "C4", "C4", "F3", "C4", "D4", "G3", "C4", "C4", "C4", "C4", "F3", "C4", "G3", "C4"];
      assert.deepEqual(Array.from(c.accompanimentEvents, event => event.notes[0].name), roots);
      c.speedSlider.value = String(speed); c.applySpeed();
      c.accompanimentStyleSelect.value = "light"; c.changeAccompanimentStyle();
      await (mode === "demo" ? c.playDemo() : c.startPractice());
      h.stepTo(c.getSongEndSeconds() + 1 / 30); h.tick();
      const backing = h.sounds.filter(sound => ["F3", "G3", "C4", "D4"].includes(sound.name));
      assert.deepEqual(backing.map(sound => sound.name), roots);
      for (const sound of backing) near(sound.velocity, .30 * .32);
      const melody = h.sounds.filter(sound => !["F3", "G3", "C4", "D4"].includes(sound.name));
      assert.deepEqual(melody.map(sound => sound.name), mode === "demo" ? Array.from(c.currentSong.steps, step => step[0]) : []);
      assert.equal(c.shouldLoop(), false);
    });
  }
  test(`Jingle root backing A–B [16,24) excludes D4 at B and begins one F3 after wrap at ${speed}x`, async () => {
    const h = endingRestHarness("ling-er-xiang-ding-dang"); const { c } = h;
    c.speedSlider.value = String(speed); c.applySpeed();
    c.accompanimentStyleSelect.value = "light"; c.changeAccompanimentStyle();
    c.practiceLoopRange = { startBeat: 16, endBeat: 24 }; c.prepareLoopStart(); await c.startPractice();
    const start = 16 * c.getScaledBeatSeconds(), end = 24 * c.getScaledBeatSeconds();
    for (let time = start; time < end; time += 1 / 30) { h.stepTo(time); h.tick(); }
    h.stepTo(end - 1e-6); h.tick(); assert.deepEqual(h.names(), ["F3", "C4"]);
    h.stepTo(end + 1e-6); h.tick(); assert.deepEqual(h.names(), ["F3", "C4"]);
    assert.ok(c.currentPracticeTime() < start);
    h.stepTo(start); h.tick(); assert.deepEqual(h.names(), ["F3", "C4", "F3"]);
    c.pausePractice();
  });
}

for (const speed of [.55, 1.4]) {
  test(`Porcelain selected theme preserves all 83 attacks and initial rest at ${speed}x`, async () => {
    const h = endingRestHarness("qing-hua-ci"); const { c } = h;
    assert.equal(c.songEvents.length, 83);
    assert.equal(c.accompanimentEvents.length, 15);
    assert.equal(c.accompanimentEnabled, false, "new support remains opt-in");
    c.speedSlider.value = String(speed); c.applySpeed(); await c.playDemo();
    const beatSeconds = c.getScaledBeatSeconds();
    h.stepTo(2.5 * beatSeconds - 1e-6); h.tick(); assert.deepEqual(h.names(), []);
    h.stepTo(c.getSongEndSeconds() + 1 / 30); h.tick();
    assert.deepEqual(h.names(), Array.from(c.currentSong.steps, step => step[0]));
    assert.equal(c.shouldLoop(), false);
  });
  for (const [from, to] of [[28, 36], [56, 64]]) {
    test(`Porcelain tie/repeat range [${from},${to}) keeps one restart at ${speed}x`, async () => {
      const h = endingRestHarness("qing-hua-ci"); const { c } = h;
      c.speedSlider.value = String(speed); c.applySpeed();
      c.practiceLoopRange = { startBeat: from, endBeat: to };
      c.prepareLoopStart(); await c.playDemo();
      const start = from * c.getScaledBeatSeconds(), end = to * c.getScaledBeatSeconds();
      const expected = Array.from(c.currentSong.steps).filter(([, beat]) => beat >= from && beat < to).map(step => step[0]);
      for (let time = start; time < end; time += 1 / 30) { h.stepTo(time); h.tick(); }
      h.stepTo(end - 1e-6); h.tick(); assert.deepEqual(h.names(), expected);
      h.stepTo(end + 1e-6); h.tick(); assert.deepEqual(h.names(), expected);
      assert.ok(c.currentPracticeTime() < start);
      h.stepTo(start); h.tick(); assert.deepEqual(h.names(), [...expected, expected[0]]);
      c.pausePractice();
    });
  }
}

for (const speed of [.35, .55, 1, 1.4]) {
  for (const mode of ["own", "demo"]) {
    test(`Porcelain opt-in roots preserve 83 physical notes and 15 backing attacks in ${mode} at ${speed}x`, async () => {
      const h = endingRestHarness("qing-hua-ci"); const { c } = h;
      assert.equal(c.songEvents.length,83); assert.equal(c.accompanimentEnabled,false);
      near(c.accompanimentVolume,.30);
      const roots=["F3","G3","E4","A3","D4","G3","C4","C4","F3","G3","E4","A3","D4","G3","C4"];
      assert.deepEqual(Array.from(c.accompanimentEvents,event=>event.notes[0].name),roots);
      c.speedSlider.value=String(speed); c.applySpeed();
      c.accompanimentStyleSelect.value="light"; c.changeAccompanimentStyle();
      await (mode==="demo"?c.playDemo():c.startPractice());
      h.stepTo(c.getSongEndSeconds()+1/30); h.tick();
      const bass=new Set(roots);
      const support=h.sounds.filter(sound=>bass.has(sound.name));
      assert.deepEqual(support.map(sound=>sound.name),roots);
      for(const sound of support) near(sound.velocity,.30*.32);
      assert.deepEqual(h.sounds.filter(sound=>!bass.has(sound.name)).map(sound=>sound.name),mode==="demo"?Array.from(c.currentSong.steps,step=>step[0]):[]);
      assert.equal(c.shouldLoop(),false);
    });
  }
  test(`Porcelain source-backed hold and short terminal root keep [56,64) loop precise at ${speed}x`,async()=>{
    const h=endingRestHarness("qing-hua-ci");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();
    c.accompanimentStyleSelect.value="light";c.changeAccompanimentStyle();
    c.practiceLoopRange={startBeat:56,endBeat:64};c.prepareLoopStart();await c.startPractice();
    const beatSeconds=c.getScaledBeatSeconds();
    h.stepTo(57.5*beatSeconds);h.tick();assert.deepEqual(h.names(),["G3"]);
    h.stepTo(60.5*beatSeconds);h.tick();assert.deepEqual(h.names(),["G3","C4"]);
    h.stepTo(64*beatSeconds-1e-6);h.tick();assert.deepEqual(h.names(),["G3","C4"]);
    h.stepTo(64*beatSeconds+1e-6);h.tick();assert.deepEqual(h.names(),["G3","C4"]);
    assert.ok(c.currentPracticeTime()<56*beatSeconds);
    h.stepTo(56*beatSeconds);h.tick();assert.deepEqual(h.names(),["G3","C4","G3"]);
    c.pausePractice();
  });
}

for (const speed of [.35, .55, 1, 1.4]) {
  test(`Bigfish selected 162-note melody completes without borrowing legacy support at ${speed}x`, async () => {
    const h = endingRestHarness("da-yu"); const {c} = h;
    assert.equal(c.songEvents.length,162);
    assert.equal(c.accompanimentEvents.length,0);
    c.speedSlider.value=String(speed); c.applySpeed(); await c.playDemo();
    h.stepTo(c.getSongEndSeconds()+1/30); h.tick();
    assert.deepEqual(h.names(),Array.from(c.currentSong.steps,step=>step[0]));
    assert.equal(h.names().at(-1),"A3"); assert.equal(c.shouldLoop(),false);
  });
  for (const [from,to,expected] of [
    [76,80,["D4","E4","A3","C4"]],
    [108,120,["E4","E4","G4","C5","B4","E4","E4","D4","C4","C4","D4","E4"]]
  ]) {
    test(`Bigfish source tie and literal repeated/register range [${from},${to}) at ${speed}x`,async()=>{
      const h=endingRestHarness("da-yu");const {c}=h;
      c.speedSlider.value=String(speed);c.applySpeed();
      c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
      const start=from*c.getScaledBeatSeconds(),end=to*c.getScaledBeatSeconds();
      h.stepTo(end-1e-6);h.tick();assert.deepEqual(h.names(),expected);
      h.stepTo(end+1e-6);h.tick();assert.deepEqual(h.names(),expected);
      assert.ok(c.currentPracticeTime()<start);
      // Observe the first actual post-boundary frame, not floating-point equality.
      h.stepTo(start+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);
      c.pausePractice();
    });
  }
}


function externalBackingHarness({ records = new Map(), raw } = {}) {
  const h = harness({ range: null }); const { c } = h;
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let imported;
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    if (!records.size) imported = saveCustomSongs(parseImportedSongs(JSON.stringify(raw || {
      schemaVersion: 2, id: "external-auto-regression", title: "Import runtime fixture", bpm: 96, beatsPerMeasure: 4,
      sourceFeatures: { sourceTotalBeats: 4 },
      events: ["E4", "F4", "G4", "C5"].map((name, beat) => ({ beat, duration: 1, notes: [{ name, role: "melody", judge: true }] })),
      autoAccompaniment: { enabledByDefault: true, volume: .3, events: [
        { beat: 0, duration: .75, notes: [{ name: "G3", role: "bass", velocity: .32 }] },
        { beat: 2, duration: .75, notes: [{ name: "C4", role: "bass", velocity: .32 }] }
      ] }
    }), {}));
    c.songLibrary = getSongLibrary();
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
  c.browserPreferenceStorage = storage;
  const primary = imported?.[0] || Object.values(c.songLibrary).find(song => song.source === "local" && song.id === song.baseSongId);
  c.setCurrentSong(primary.id); c.applyAccompanimentControl();
  h.records = records;
  h.selectImported = (choice = "imported-auto") => { c.accompanimentStyleSelect.value = choice; c.changeAccompanimentStyle(); };
  h.provider = () => getSongAccompanimentProvider(c.currentSong, Object.values(c.songLibrary));
  return h;
}

for (const mode of ["own", "demo"]) {
  test(`supported external auto import has its own label, exact ${mode} audio, and canonical choice memory`, async () => {
    const h = externalBackingHarness(); const { c } = h;
    assert.equal(c.songEvents.length, 4); assert.equal(c.accompanimentEvents.length, 2);
    assert.equal(c.accompanimentEnabled, false, "fresh imported backing remains opt-in even when the file suggests on");
    assert.match(c.getSongAccompanimentSignature(c.currentSong), /^\["imported-auto-v1"/);
    assert.equal(c.accompanimentStyleSelect.hidden, false);
    assert.match(c.accompanimentStyleSelect.innerHTML, /value="imported-auto">导入伴奏/);
    assert.doesNotMatch(c.accompanimentStyleSelect.innerHTML, /轻伴奏|优化/);
    assert.equal(c.accompanimentBtn.hidden, true);
    h.selectImported(); assert.equal(c.accompanimentEnabled, true);
    assert.ok(c.songEvents.every(event => event.notes.length === 1 && event.judgeLanes.length === 1));
    c.speedSlider.value = "1"; c.applySpeed();
    await (mode === "own" ? c.startPractice() : c.playDemo());
    h.stepTo(c.getSongEndSeconds() + 1/30); h.tick();
    assert.deepEqual(h.names(), mode === "own" ? ["G3", "C4"] : ["G3", "E4", "F4", "C4", "G4", "C5"]);
    for (const sound of h.sounds.filter(sound => ["G3", "C4"].includes(sound.name))) near(sound.velocity, .3 * .32);
    const key = "kalimba-song-accompaniment-v1:" + encodeURIComponent(c.currentSongId);
    assert.equal(JSON.parse(h.records.get(key)).choice, "imported-auto");
    const reload = externalBackingHarness({ records: h.records });
    for (const id of [c.currentSongId, h.provider().song.id]) {
      reload.c.setCurrentSong(id); reload.c.applyAccompanimentControl();
      assert.equal(reload.c.currentSongId, c.currentSongId);
      assert.equal(reload.c.accompanimentEnabled, true);
      assert.equal(reload.c.accompanimentStyleSelect.value, "imported-auto");
    }
    assert.deepEqual([...h.records.keys()].filter(value => value.startsWith("kalimba-song-accompaniment")), [key]);
    reload.selectImported("off");
    const muted = externalBackingHarness({ records: h.records });
    assert.equal(muted.c.accompanimentEnabled, false);
    assert.equal(muted.c.accompanimentStyleSelect.value, "off");
    assert.deepEqual(muted.names(), []);
  });
}

for (const mode of ["own", "demo"]) for (const speed of [.35, 1.4]) {
  test(`imported ${mode} backing respects pause, prepared Continue, speed and exclusive loop B at ${speed}x`, async () => {
    const h = externalBackingHarness(); const { c } = h;
    h.selectImported(); c.speedSlider.value = String(speed); c.applySpeed();
    c.practiceLoopRange = { startBeat: 0, endBeat: 2 }; c.prepareLoopStart();
    await (mode === "own" ? c.startPractice() : c.playDemo());
    h.stepTo(.25 * c.getScaledBeatSeconds()); h.tick(); c.pausePractice();
    const heard = h.names(), beat = c.currentPracticeTime() / c.getScaledBeatSeconds();
    h.advance(20); h.tick(); assert.deepEqual(h.names(), heard);
    c.speedSlider.value = ".55"; c.applySpeed();
    near(c.currentPracticeTime() / c.getScaledBeatSeconds(), beat);
    await c.continuePractice();
    h.healthy(c.resumePreparation.duration); assert.equal(c.resumePreparation, null);
    assert.deepEqual(h.names(), heard, "Continue cannot replay the delivered start attack");
    h.stepTo(2 * c.getScaledBeatSeconds() + .001); h.tick();
    assert.deepEqual(h.names(), mode === "own" ? ["G3"] : ["G3", "E4", "F4"]);
    assert.equal(h.names().includes("C4"), false, "support exactly at B remains excluded");
    h.healthy(c.getSessionLeadSeconds() + 1e-6);
    assert.deepEqual(h.names(), mode === "own" ? ["G3", "G3"] : ["G3", "E4", "F4", "G3", "E4"]);
  });
}

test("imported sound/provider changes invalidate on and never enable a new song or substitute light", () => {
  for (const change of [
    h => { h.c.currentSong.events[0].notes[0].name = "D4"; },
    h => { h.c.currentSong.events[0].beat += .125; },
    h => { h.c.currentSong.events[0].duration += .125; },
    h => { h.c.currentSong.bpm += 1; },
    h => { h.c.currentSong.sourceFeatures.sourceTotalBeats += 1; },
    h => { h.provider().config.events[0].notes[0].name = "F3"; },
    h => { h.provider().config.events[0].notes[0].velocity = .8; },
    h => { h.provider().config.events[0].duration = .5; },
    h => { h.provider().config.events[0].beat = .125; },
    h => { h.provider().config.volume = .6; },
    h => { h.provider().song.id += "-changed"; },
    h => { h.provider().song.source = "system"; },
    h => { h.c.currentSong.source = "system"; },
    h => { const provider = h.provider(); provider.song.practiceAccompaniment = structuredClone(provider.config); }
  ]) {
    const h = externalBackingHarness(); h.selectImported(); change(h);
    h.c.setCurrentSong(h.c.currentSongId);
    assert.equal(h.c.accompanimentEnabled, false, String(change));
    assert.deepEqual(h.names(), []);
  }
  const h = externalBackingHarness(); h.selectImported();
  h.c.setCurrentSong("birthday"); assert.equal(h.c.accompanimentEnabled, false);
  const h2 = externalBackingHarness(); h2.selectImported();
  const signature = h2.c.getSongAccompanimentSignature(h2.c.currentSong);
  h2.provider().config.enabledByDefault = false; h2.provider().config.events[0].pattern = "descriptive only";
  h2.c.currentSong.title = "Changed label";
  assert.equal(h2.c.getSongAccompanimentSignature(h2.c.currentSong), signature);
  h2.c.setCurrentSong(h2.c.currentSongId); assert.equal(h2.c.accompanimentEnabled, true);
});

test("imported storage failures preserve manual in-tab on/off without changing corrupt or future records", () => {
  for (const failure of ["read", "write", "readback", "corrupt", "future"]) {
    const h = externalBackingHarness(); const { c } = h;
    const key = "kalimba-song-accompaniment-v1:" + encodeURIComponent(c.currentSongId);
    const raw = failure === "corrupt" ? "{" : JSON.stringify({ schemaVersion: 99, choice: "imported-auto", sourceSignature: "future" });
    const errors = []; c.showKeyWidthStatus = text => errors.push(text);
    if (["corrupt", "future"].includes(failure)) h.records.set(key, raw);
    else c.browserPreferenceStorage = {
      getItem() { if (failure === "read") throw new Error("Denied"); return null; },
      setItem() { if (failure === "write") throw new Error("Quota"); }
    };
    c.setCurrentSong(c.currentSongId); assert.equal(c.accompanimentEnabled, false);
    h.selectImported(); assert.equal(c.accompanimentEnabled, true);
    c.setCurrentSong(c.currentSongId); assert.equal(c.accompanimentEnabled, true);
    h.selectImported("off"); c.setCurrentSong(c.currentSongId); assert.equal(c.accompanimentEnabled, false);
    h.selectImported(); h.provider().config.volume = .7;
    c.setCurrentSong(c.currentSongId); assert.equal(c.accompanimentEnabled, false);
    assert.ok(errors.some(text => /未保存/.test(text)));
    if (["corrupt", "future"].includes(failure)) assert.equal(h.records.get(key), raw);
  }
});

test("imported tab choices never hot-switch active audio and existing gain wins over imported defaults", async () => {
  const first = externalBackingHarness(); first.selectImported();
  const second = externalBackingHarness({ records: first.records });
  assert.equal(second.c.accompanimentEnabled, true);
  await first.c.startPractice(); first.stepTo(0); first.tick();
  const heard = first.names(); second.selectImported("off");
  assert.equal(first.c.accompanimentEnabled, true); assert.deepEqual(first.names(), heard);
  first.c.setCurrentSong(first.c.currentSongId); assert.equal(first.c.accompanimentEnabled, false);
  for (const gain of [0, .07, .93]) {
    first.c.storedAccompanimentVolume = gain; first.c.setCurrentSong(first.c.currentSongId);
    near(first.c.accompanimentVolume, gain);
  }
});

test("imported dense backing keeps every supplied event, note, duration, volume and velocity", () => {
  const h = externalBackingHarness(); const { c } = h; const config = h.provider().config;
  config.volume = .83;
  config.events = [0, .25, .5, .75, 1, 1.5, 2, 2.5, 3].map((beat, index) => ({ beat, duration: .125,
    notes: ["C4", "G3", "E4"].map((name, note) => ({ name, role: note ? "harmony" : "bass", velocity: .6 + index * .01 + note * .05 })) }));
  const before = JSON.stringify(config); c.setCurrentSong(c.currentSongId); h.selectImported();
  near(c.accompanimentVolume, .83); assert.equal(c.accompanimentEvents.length, 9);
  for (const event of c.accompanimentEvents) {
    near(event.duration, .125); assert.equal(event.notes.length, 3);
    for (const note of event.notes) near(note.velocity, config.events[event.id].notes.find(source => source.name === note.name).velocity);
  }
  assert.equal(JSON.stringify(config), before); assert.equal(c.songEvents.length, 4);
  assert.doesNotMatch(c.accompanimentStyleSelect.innerHTML, /轻伴奏|优化/);
});

for (const speed of [.35,.55,1,1.4]) {
  test(`Ordinary Road complete vocal selection preserves 93 attacks and the final rest at ${speed}x`,async()=>{
    const h=endingRestHarness("ping-fan-zhi-lu");const {c}=h;
    assert.equal(c.songEvents.length,93);assert.equal(c.accompanimentEvents.length,0);
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();
    const beatSeconds=c.getScaledBeatSeconds();
    h.stepTo(.49*beatSeconds);h.tick();assert.deepEqual(h.names(),[],"written opening rest is not deleted");
    h.stepTo(64*beatSeconds+1/120);h.tick();
    assert.deepEqual(h.names(),Array.from(c.currentSong.steps,step=>step[0]));
    assert.equal(h.names().length,93);assert.equal(c.shouldLoop(),true,"progress continues through the last vocal rest");
    h.stepTo(67.9*beatSeconds);h.tick();assert.equal(h.names().length,93);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();assert.equal(h.names().length,93);assert.equal(c.shouldLoop(),false);
  });
  for(const [from,to,expected] of [
    [0,8,["E4","E4","A4","A4","C4","D4","E4","E4"]],
    [16,24,["E4","E4","A4","C4","C4","D4","E4"]],
    [56,68,["C5","C5","D5","C5","G4","B4","C5","D5","C5","B4","C5","C5"]]
  ]) {
    test(`Ordinary Road distinct repetitions/ties and vocal rests loop [${from},${to}) at ${speed}x`,async()=>{
      const h=endingRestHarness("ping-fan-zhi-lu");const {c}=h;
      c.speedSlider.value=String(speed);c.applySpeed();
      c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
      const beatSeconds=c.getScaledBeatSeconds();
      h.stepTo(to*beatSeconds-1e-6);h.tick();assert.deepEqual(h.names(),expected);
      h.stepTo(to*beatSeconds+1e-6);h.tick();assert.deepEqual(h.names(),expected);
      assert.ok(c.currentPracticeTime()<from*beatSeconds);
      const firstBeat=from===56?56:from+.5;
      if(firstBeat>from){h.stepTo((firstBeat-.01)*beatSeconds);h.tick();assert.deepEqual(h.names(),expected);}
      h.stepTo(firstBeat*beatSeconds+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);
      c.pausePractice();
    });
  }
}

test("every existing light source keeps its exact frozen 2.4.24 signature bytes", async () => {
  const baseline = JSON.parse(await readFile(new URL("./fixtures/light-signatures-v2.4.24.json", import.meta.url), "utf8"));
  assert.equal(baseline.sourceVersion, "2.4.24");
  assert.deepEqual(Object.keys(baseline.signatures).sort(), ["birthday", "ling-er-xiang-ding-dang", "qing-hua-ci", "see-you-again", "xiao-xing-xing"]);
  const h = endingRestHarness("birthday"); const { c } = h;
  for (const [id, signature] of Object.entries(baseline.signatures)) {
    c.setCurrentSong(id);
    assert.equal(c.getSongAccompanimentSignature(c.currentSong), signature, id);
    saveSongAccompaniment(c.browserPreferenceStorage, id, "light", signature);
    c.setCurrentSong(id); assert.equal(c.accompanimentEnabled, true, id);
  }
});

test("removed imported config stays off instead of borrowing another candidate or builtin source", () => {
  for (const source of ["local", "system"]) {
    const h = externalBackingHarness(); const { c } = h;
    h.selectImported(); const provider = h.provider();
    const alternate = structuredClone(provider.song);
    alternate.id += "-alternate"; alternate.source = source;
    c.songLibrary[alternate.id] = alternate;
    delete provider.song.autoAccompaniment;
    c.setCurrentSong(c.currentSongId);
    assert.equal(c.accompanimentEnabled, false);
    assert.deepEqual(h.names(), []);
    if (source === "local") assert.equal(h.provider().song.id, alternate.id, "a different compatible provider needs a fresh choice");
    else {
      assert.equal(h.provider(), null, "built-in data cannot be imported fallback");
      assert.equal(c.getAccompanimentConfig(c.currentSong, "original"), null);
    }
  }
});

test("Normal-speed marker uses 1.0 while the 0.4 editorial suggestion stays in unchanged music data",()=>{
  const h=harness({range:null});const {c}=h;
  const before=globalThis.localStorage;
  try{globalThis.localStorage={getItem:()=>null};c.songLibrary=getSongLibrary();}
  finally{if(before===undefined)delete globalThis.localStorage;else globalThis.localStorage=before;}
  c.setCurrentSong("ju-ci-lang-de-xia-tian");
  assert.equal(c.currentSong.beatsPerMeasure,2);assert.equal(c.currentSong.defaultSpeedFactor,.4);assert.equal(c.getSongDefaultSpeedFactor(),1);
  assert.equal(c.speedFactor,1,"first visit is normal speed independently of editorial metadata");
  c.speedSlider.value="0.75";c.applySpeed();
  c.setCurrentSong("birthday");c.setCurrentSong("ju-ci-lang-de-xia-tian");
  assert.equal(c.speedFactor,.75,"returning to the new source edition preserves the user's chosen speed");
  c.applySongDefaultSpeed();assert.equal(c.speedFactor,1,"clicking the 1.0 marker restores normal speed");
  c.setCurrentSong("birthday");c.setCurrentSong("ju-ci-lang-de-xia-tian");assert.equal(c.speedFactor,1);
});

for(const speed of [.35,.4,.55,1,1.4]){
  test(`Summer first theme keeps 61 attacks, 2/4 quarter timing and the opening rest at ${speed}x`,async()=>{
    const h=endingRestHarness("ju-ci-lang-de-xia-tian");const {c}=h;
    assert.equal(c.songEvents.length,61);assert.equal(c.accompanimentEvents.length,0);
    assert.equal(c.currentSong.beatsPerMeasure,2);assert.equal(c.songTotalBeats,32);
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();
    const beatSeconds=c.getScaledBeatSeconds();near(beatSeconds,60/96/speed);
    assert.ok(c.currentPracticeTime()<0,"preparation precedes the preserved written rest");
    h.stepTo(.99*beatSeconds);h.tick();assert.deepEqual(h.names(),[]);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();
    assert.deepEqual(h.names(),Array.from(c.currentSong.steps,step=>step[0]));
    assert.equal(h.names().length,61);assert.equal(h.names().at(-1),"D5");assert.equal(c.shouldLoop(),false);
  });
  for(const [from,to,expected] of [
    [0,8,["G4","C5","D5","E5","D5","C5","C5","G4","C5","D5","E5","D5","C5","D5","E5"]],
    [24,32,["G5","E5","C5","C5","D5","E5","E5","E5","E5","E5","A5","E5","C5","D5"]]
  ]){
    test(`Summer ties and independent repetitions loop [${from},${to}) at ${speed}x`,async()=>{
      const h=endingRestHarness("ju-ci-lang-de-xia-tian");const {c}=h;
      c.speedSlider.value=String(speed);c.applySpeed();
      c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
      const beatSeconds=c.getScaledBeatSeconds();
      h.stepTo(to*beatSeconds-1e-6);h.tick();assert.deepEqual(h.names(),expected);
      h.stepTo(to*beatSeconds+1e-6);h.tick();assert.deepEqual(h.names(),expected);
      assert.ok(c.currentPracticeTime()<from*beatSeconds);
      const firstBeat=from===0?1:from;
      if(from===0){h.stepTo(.99*beatSeconds);h.tick();assert.deepEqual(h.names(),expected);}
      h.stepTo(firstBeat*beatSeconds+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);
      c.pausePractice();
    });
  }
}

test("Daylily selected 3/4 edition keeps the user's speed instead of forcing its editorial suggestion",()=>{
  const h=harness({range:null});const {c}=h;const before=globalThis.localStorage;
  try{globalThis.localStorage={getItem:()=>null};c.songLibrary=getSongLibrary();}
  finally{if(before===undefined)delete globalThis.localStorage;else globalThis.localStorage=before;}
  c.setCurrentSong("xuan-cao-hua");assert.equal(c.currentSong.beatsPerMeasure,3);
  assert.equal(c.currentSong.defaultSpeedFactor,.9);assert.equal(c.getSongDefaultSpeedFactor(),1);assert.equal(c.speedFactor,1);
  c.speedSlider.value="0.65";c.applySpeed();c.setCurrentSong("birthday");c.setCurrentSong("xuan-cao-hua");
  assert.equal(c.speedFactor,.65);assert.equal(c.accompanimentEvents.length,16);
  assert.equal(c.accompanimentEnabled,false,"new compatible support remains off; old differently timed V2 is not used");
});
for(const speed of [.35,.55,1,1.4]){
  test(`Daylily's full selected vocal route has 183 true attacks and the ending rest at ${speed}x`,async()=>{
    const h=endingRestHarness("xuan-cao-hua");const {c}=h;
    assert.equal(c.songEvents.length,183);assert.equal(c.songTotalBeats,192);
    assert.equal(c.currentSong.beatsPerMeasure,3);assert.equal(c.accompanimentEvents.length,16);assert.equal(c.accompanimentEnabled,false);
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();
    const bs=c.getScaledBeatSeconds();near(bs,60/84/speed);
    h.stepTo(191*bs);h.tick();assert.deepEqual(h.names(),Array.from(c.currentSong.steps,step=>step[0]));
    assert.deepEqual(h.names().slice(0,3),["E4","E4","E4"]);
    assert.equal(h.names().at(-1),"C4");assert.equal(c.shouldLoop(),true);
    h.stepTo(191.99*bs);h.tick();assert.equal(h.names().length,183);assert.equal(c.shouldLoop(),true);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();assert.equal(h.names().length,183);assert.equal(c.shouldLoop(),false);
  });
  for(const [from,to,expected]of[
    [0,6,["E4","E4","E4","G4","A4","G4"]],
    [186,192,["D4","A3","C4","D4","C4"]]
  ])test(`Daylily loop [${from},${to}) keeps true repeats and final silence at ${speed}x`,async()=>{
    const h=endingRestHarness("xuan-cao-hua");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
    const bs=c.getScaledBeatSeconds();h.stepTo(to*bs-1e-6);h.tick();assert.deepEqual(h.names(),expected);
    h.stepTo(to*bs+1e-6);h.tick();assert.deepEqual(h.names(),expected);assert.ok(c.currentPracticeTime()<from*bs);
    h.stepTo(from*bs+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);c.pausePractice();
  });
}

for(const speed of [.35,.55,1,1.4]){
  test(`Farewell complete teaching melody keeps 86 attacks and two final rest beats at ${speed}x`,async()=>{
    const h=endingRestHarness("song-bie");const {c}=h;
    assert.equal(c.songEvents.length,86);assert.equal(c.songTotalBeats,96);
    assert.equal(c.currentSong.beatsPerMeasure,4);assert.equal(c.accompanimentEvents.length,0);
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();
    const bs=c.getScaledBeatSeconds();near(bs,60/70/speed);
    h.stepTo(94*bs);h.tick();assert.deepEqual(h.names(),Array.from(c.currentSong.steps,step=>step[0]));
    assert.equal(h.names().at(-1),"C4");assert.equal(c.shouldLoop(),true);
    h.stepTo(95.99*bs);h.tick();assert.equal(h.names().length,86);assert.equal(c.shouldLoop(),true);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();assert.equal(h.names().length,86);assert.equal(c.shouldLoop(),false);
  });
  for(const [from,to,expected]of[
    [32,36,["A4","C5","C5"]],
    [88,96,["G4","D4","E4","F4","B3","C4"]]
  ])test(`Farewell loop [${from},${to}) preserves independent repeats and silence at ${speed}x`,async()=>{
    const h=endingRestHarness("song-bie");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
    const bs=c.getScaledBeatSeconds();h.stepTo(to*bs-1e-6);h.tick();assert.deepEqual(h.names(),expected);
    h.stepTo(to*bs+1e-6);h.tick();assert.deepEqual(h.names(),expected);assert.ok(c.currentPracticeTime()<from*bs);
    h.stepTo(from*bs+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);c.pausePractice();
  });
}

// Real production transport, with healthy-frame onset checkpoints. These assert
// scheduled attacks/gain, not PCM tail cutoff or subjective listening quality.
for (const speed of [.35, .55, 1, 1.4]) {
  for (const mode of ["own", "demo"]) {
    test(`Daylily optional 16 roots keep 183 physical targets in ${mode} at ${speed}x`, async () => {
      const h=endingRestHarness("xuan-cao-hua"); const {c}=h;
      const roots=["C4","F3","C4","F3","A3","A3","A3","F3","C4","F3","C4","F3","C4","F3","C4","F3"];
      assert.equal(c.songEvents.length,183); assert.equal(c.accompanimentEnabled,false);
      near(c.accompanimentVolume,.28);
      assert.deepEqual(Array.from(c.accompanimentEvents,e=>e.notes[0].name),roots);
      c.speedSlider.value=String(speed); c.applySpeed();
      c.accompanimentStyleSelect.value="light"; c.changeAccompanimentStyle();
      await (mode==="demo"?c.playDemo():c.startPractice());
      h.stepTo(191*c.getScaledBeatSeconds()); h.tick();
      const rootsHeard=h.sounds.filter(s=>Math.abs(s.velocity-.084)<1e-9);
      assert.deepEqual(rootsHeard.map(s=>s.name),roots);
      assert.deepEqual(h.sounds.filter(s=>Math.abs(s.velocity-.084)>=1e-9).map(s=>s.name),
        mode==="demo"?Array.from(c.currentSong.steps,s=>s[0]):[]);
      const count=h.sounds.length;
      h.stepTo(191.99*c.getScaledBeatSeconds()); h.tick(); assert.equal(h.sounds.length,count);
      h.stepTo(c.getSongEndSeconds()+1/30); h.tick();
      assert.equal(h.sounds.length,count); assert.equal(c.shouldLoop(),false);
    });
  }
  test(`Daylily final root/ending-rest loop has no extra attack at ${speed}x`,async()=>{
    const h=endingRestHarness("xuan-cao-hua");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();
    c.accompanimentStyleSelect.value="light";c.changeAccompanimentStyle();
    c.practiceLoopRange={startBeat:180,endBeat:192};c.prepareLoopStart();await c.startPractice();
    const bs=c.getScaledBeatSeconds();
    h.stepTo(191.99*bs);h.tick();assert.deepEqual(h.names(),["F3"]);
    h.stepTo(192*bs+1e-6);h.tick();assert.deepEqual(h.names(),["F3"]);
    assert.ok(c.currentPracticeTime()<180*bs);
    h.stepTo(180*bs+1e-8);h.tick();assert.deepEqual(h.names(),["F3","F3"]);
    c.pausePractice();
  });
}

// Source reading is frozen separately in test-rowing-textbook-edition.mjs.
// Here the actual practice clock must preserve that complete selected timeline.
for (const speed of [.35,.55,1,1.4]) {
  test(`Rowing textbook melody preserves all 63 attacks and final tied note at ${speed}x`,async()=>{
    const h=endingRestHarness("rang-wo-men-dang-qi-shuang-jiang");const {c}=h;
    assert.equal(c.songEvents.length,63);assert.equal(c.songTotalBeats,60);
    assert.equal(c.accompanimentEvents.length,0);assert.equal(c.accompanimentEnabled,false);
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();
    const bs=c.getScaledBeatSeconds();near(bs,60/96/speed);
    h.stepTo(.49*bs);h.tick();assert.deepEqual(h.names(),[]);
    h.stepTo(56*bs+1/120);h.tick();assert.deepEqual(h.names(),Array.from(c.currentSong.steps,step=>step[0]));
    assert.equal(h.names().at(-1),"A4");assert.equal(c.shouldLoop(),true);
    h.stepTo(59.99*bs);h.tick();assert.equal(h.names().length,63);assert.equal(c.shouldLoop(),true);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();assert.equal(c.shouldLoop(),false);assert.equal(h.names().length,63);
  });
  for (const [from,to,first,expected] of [
    [14,18,14,["E4","E4","G4"]],
    [48,52,49,["C4","D4","E4","G4","G4"]]
  ]) test(`Rowing textbook loop [${from},${to}) retains tie, genuine repeats and rest at ${speed}x`,async()=>{
    const h=endingRestHarness("rang-wo-men-dang-qi-shuang-jiang");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
    const bs=c.getScaledBeatSeconds();h.stepTo(to*bs-1e-6);h.tick();assert.deepEqual(h.names(),expected);
    h.stepTo(to*bs+1e-6);h.tick();assert.deepEqual(h.names(),expected);assert.ok(c.currentPracticeTime()<from*bs);
    if(first>from){h.stepTo((first-.01)*bs);h.tick();assert.deepEqual(h.names(),expected);}
    h.stepTo(first*bs+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);c.pausePractice();
  });
}

test("Rowing canonical entry preserves saved speed without forcing the textbook suggestion",()=>{
  const h=harness({range:null});const {c}=h;const before=globalThis.localStorage;
  try{globalThis.localStorage={getItem:()=>null};c.songLibrary=getSongLibrary();}
  finally{if(before===undefined)delete globalThis.localStorage;else globalThis.localStorage=before;}
  c.setCurrentSong("rang-wo-men-dang-qi-shuang-jiang");
  assert.equal(c.currentSong.defaultSpeedFactor,.9);assert.equal(c.getSongDefaultSpeedFactor(),1);assert.equal(c.speedFactor,1);
  c.speedSlider.value="0.65";c.applySpeed();c.setCurrentSong("birthday");c.setCurrentSong("rang-wo-men-dang-qi-shuang-jiang");
  assert.equal(c.speedFactor,.65);assert.equal(c.accompanimentEvents.length,0);assert.equal(c.practiceLoopRange,null);
});

// Qingcheng's full selected lyric line is source-frozen independently; this
// exercises production transport, including written reattacks and omitted grace.
for (const speed of [.35,.55,1,1.4]) {
  test(`Qingcheng selected vocal melody plays all 196 principal attacks through beat 120 at ${speed}x`,async()=>{
    const h=endingRestHarness("qing-cheng-shan-xia-bai-su-zhen");const {c}=h;
    assert.equal(c.songEvents.length,196);assert.equal(c.songTotalBeats,120);
    assert.equal(c.currentSong.beatsPerMeasure,4);assert.equal(c.accompanimentEvents.length,0);
    assert.equal(c.accompanimentEnabled,false);
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();
    const bs=c.getScaledBeatSeconds();near(bs,60/82/speed);
    h.stepTo(118*bs+1/120);h.tick();
    assert.deepEqual(h.names(),Array.from(c.currentSong.steps,step=>step[0]));
    assert.deepEqual(h.names().slice(-2),["C4","C4"]);assert.equal(c.shouldLoop(),true);
    h.stepTo(119.99*bs);h.tick();assert.equal(h.names().length,196);assert.equal(c.shouldLoop(),true);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();assert.equal(h.names().length,196);assert.equal(c.shouldLoop(),false);
  });
  for (const [from,to,expected] of [
    [0,4,["C5","A4","C5","G4","G4","A4","G4","A4"]],
    [32,36,["A4","C5","D5","C5","A4","G4","G4","A4","G4","E4"]],
    [116,120,["D4","C4","A3","C4","C4"]]
  ]) test(`Qingcheng loop [${from},${to}) keeps exact principal attacks without invented ornament at ${speed}x`,async()=>{
    const h=endingRestHarness("qing-cheng-shan-xia-bai-su-zhen");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();
    c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
    const bs=c.getScaledBeatSeconds();h.stepTo(to*bs-1e-6);h.tick();assert.deepEqual(h.names(),expected);
    h.stepTo(to*bs+1e-6);h.tick();assert.deepEqual(h.names(),expected);assert.ok(c.currentPracticeTime()<from*bs);
    h.stepTo(from*bs+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);c.pausePractice();
  });
}

test("Qingcheng selected edition retains canonical saved speed without forcing the source BPM suggestion",()=>{
  const h=harness({range:null});const {c}=h;const before=globalThis.localStorage;
  try{globalThis.localStorage={getItem:()=>null};c.songLibrary=getSongLibrary();}
  finally{if(before===undefined)delete globalThis.localStorage;else globalThis.localStorage=before;}
  c.setCurrentSong("qing-cheng-shan-xia-bai-su-zhen");
  assert.equal(c.currentSong.defaultSpeedFactor,.9);assert.equal(c.getSongDefaultSpeedFactor(),1);assert.equal(c.speedFactor,1);
  c.speedSlider.value="0.65";c.applySpeed();c.setCurrentSong("birthday");c.setCurrentSong("qing-cheng-shan-xia-bai-su-zhen");
  assert.equal(c.speedFactor,.65);assert.equal(c.currentSong.bpm,82);
  assert.equal(c.accompanimentEvents.length,0);assert.equal(c.practiceLoopRange,null);
});

// The selected school edition uses explicit fixed written beats: no guessed
// grace attacks or discretionary fermata delay. Source fidelity is tested
// separately; here the production clock must execute the selected timeline.
for (const speed of [.35,.55,1,1.4]) {
  test(`Hongyan school fixed-beat edition preserves 98 attacks and the full 96 beats at ${speed}x`,async()=>{
    const h=endingRestHarness("hong-yan");const {c}=h;
    assert.equal(c.songEvents.length,98);assert.equal(c.songTotalBeats,96);
    assert.equal(c.currentSong.beatsPerMeasure,4);assert.equal(c.accompanimentEvents.length,0);
    assert.equal(c.accompanimentEnabled,false);
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();
    const bs=c.getScaledBeatSeconds();near(bs,60/56/speed);
    h.stepTo(92*bs+1/120);h.tick();
    assert.deepEqual(h.names(),Array.from(c.currentSong.steps,step=>step[0]));
    assert.equal(h.names().at(-1),"A3");assert.equal(c.shouldLoop(),true);
    h.stepTo(95.99*bs);h.tick();assert.equal(h.names().length,98);assert.equal(c.shouldLoop(),true);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();assert.equal(h.names().length,98);assert.equal(c.shouldLoop(),false);
  });
  for (const [from,to,expected] of [
    [8,16,["A4","G4","E4","C4","D4","G4","E4","D4"]],
    [88,96,["E4","C4","A3","G3","A3","E4","A3"]]
  ]) test(`Hongyan school loop [${from},${to}) keeps merged ties and the complete ending at ${speed}x`,async()=>{
    const h=endingRestHarness("hong-yan");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();
    c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
    const bs=c.getScaledBeatSeconds();h.stepTo(to*bs-1e-6);h.tick();assert.deepEqual(h.names(),expected);
    h.stepTo(to*bs+1e-6);h.tick();assert.deepEqual(h.names(),expected);assert.ok(c.currentPracticeTime()<from*bs);
    h.stepTo(from*bs+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);c.pausePractice();
  });
  test(`Hongyan cross-bar tie does not retrigger at the new bar at ${speed}x`,async()=>{
    const h=endingRestHarness("hong-yan");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();const bs=c.getScaledBeatSeconds();
    h.stepTo(11.5*bs+1e-6);h.tick();assert.equal(h.names().at(-1),"E4");const before=h.names().length;
    h.stepTo(12.49*bs);h.tick();assert.equal(h.names().length,before,"cross-system continuation is not a new attack");
    h.stepTo(12.5*bs+1e-6);h.tick();assert.equal(h.names().length,before+1);assert.equal(h.names().at(-1),"D4");
    h.stepTo(15.99*bs);h.tick();assert.equal(h.names().length,before+1,"intra-bar continuation also remains one attack");
    c.pausePractice();
  });
}

test("Hongyan school selection retains the canonical saved speed rather than forcing its suggestion",()=>{
  const h=harness({range:null});const {c}=h;const before=globalThis.localStorage;
  try{globalThis.localStorage={getItem:()=>null};c.songLibrary=getSongLibrary();}
  finally{if(before===undefined)delete globalThis.localStorage;else globalThis.localStorage=before;}
  c.setCurrentSong("hong-yan");assert.equal(c.getSongDefaultSpeedFactor(),1);assert.equal(c.speedFactor,1);
  c.speedSlider.value="0.65";c.applySpeed();c.setCurrentSong("birthday");c.setCurrentSong("hong-yan");
  assert.equal(c.speedFactor,.65);assert.equal(c.currentSong.bpm,56);
  assert.equal(c.accompanimentEvents.length,0);assert.equal(c.practiceLoopRange,null);
});

// Full selected textbook vocal strophe. These production transport checks are
// separate from the independently source-authored notation regression.
for(const speed of [.35,.55,1,1.4]){
  test(`Childhood teaching strophe keeps 79 attacks and all 64 beats at ${speed}x`,async()=>{
    const h=endingRestHarness("tong-nian");const {c}=h;
    assert.equal(c.songEvents.length,79);assert.equal(c.songTotalBeats,64);
    assert.equal(c.currentSong.beatsPerMeasure,4);assert.equal(c.accompanimentEvents.length,0);
    assert.equal(c.accompanimentEnabled,false);
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();
    const bs=c.getScaledBeatSeconds();near(bs,60/105/speed);
    h.stepTo(.99*bs);h.tick();assert.deepEqual(h.names(),[],"the source opening vocal rest is retained");
    h.stepTo(60*bs+1/120);h.tick();assert.deepEqual(h.names(),Array.from(c.currentSong.steps,s=>s[0]));
    assert.equal(h.names().at(-1),"C5");assert.equal(c.shouldLoop(),true);
    h.stepTo(63.99*bs);h.tick();assert.equal(h.names().length,79);assert.equal(c.shouldLoop(),true);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();assert.equal(h.names().length,79);assert.equal(c.shouldLoop(),false);
  });
  for(const [from,to,first,expected]of[
    [0,4,1,["E4","G4","G4","E4"]],
    [32,40,32,["G5","G5","G5","G5","E5","D5","C5","C5","A4","C5","A4","C5"]],
    [40,44,40,["D5","D5","D5","D5","D5","C5","E5","D5"]]
  ])test(`Childhood teaching loop [${from},${to}) preserves its rests, ties and true reattacks at ${speed}x`,async()=>{
    const h=endingRestHarness("tong-nian");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
    const bs=c.getScaledBeatSeconds();h.stepTo(to*bs-1e-6);h.tick();assert.deepEqual(h.names(),expected);
    h.stepTo(to*bs+1e-6);h.tick();assert.deepEqual(h.names(),expected);assert.ok(c.currentPracticeTime()<from*bs);
    if(first>from){h.stepTo((first-.01)*bs);h.tick();assert.deepEqual(h.names(),expected);}
    h.stepTo(first*bs+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);c.pausePractice();
  });
  test(`Childhood three-head tie chain has one attack without swallowing its independent neighbour at ${speed}x`,async()=>{
    const h=endingRestHarness("tong-nian");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();const bs=c.getScaledBeatSeconds();
    h.stepTo(36*bs+1e-6);h.tick();assert.equal(h.names().at(-1),"C5");const before=h.names().length;
    h.stepTo(36.5*bs+1e-6);h.tick();assert.equal(h.names().length,before+1);assert.equal(h.names().at(-1),"C5");
    h.stepTo(37.99*bs);h.tick();assert.equal(h.names().length,before+1,"both inner tie continuations remain silent");
    h.stepTo(38*bs+1e-6);h.tick();assert.equal(h.names().length,before+2);assert.equal(h.names().at(-1),"A4");c.pausePractice();
  });
  test(`Childhood explicit half-beat vocal rest has no invented main-note attack at ${speed}x`,async()=>{
    const h=endingRestHarness("tong-nian");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();const bs=c.getScaledBeatSeconds();
    h.stepTo(33.5*bs+1e-6);h.tick();assert.equal(h.names().at(-1),"G5");const count=h.names().length;
    h.stepTo(34.49*bs);h.tick();assert.equal(h.names().length,count);
    h.stepTo(34.5*bs+1e-6);h.tick();assert.equal(h.names().length,count+1);assert.equal(h.names().at(-1),"G5");c.pausePractice();
  });
}
test("Childhood teaching selection retains the canonical remembered speed and never borrows old backing",()=>{
  const h=harness({range:null});const {c}=h;const before=globalThis.localStorage;
  try{globalThis.localStorage={getItem:()=>null};c.songLibrary=getSongLibrary();}
  finally{if(before===undefined)delete globalThis.localStorage;else globalThis.localStorage=before;}
  c.setCurrentSong("tong-nian");assert.equal(c.currentSong.defaultSpeedFactor,.9);assert.equal(c.getSongDefaultSpeedFactor(),1);assert.equal(c.speedFactor,1);
  c.speedSlider.value="0.70";c.applySpeed();c.setCurrentSong("birthday");c.setCurrentSong("tong-nian");
  assert.equal(c.speedFactor,.7);assert.equal(c.currentSong.bpm,105);assert.equal(c.accompanimentEvents.length,0);assert.equal(c.practiceLoopRange,null);
});

// Yitu's selected xiqiang principal edition is independently source-frozen in
// test-shengshengman-xiqiang-edition.mjs. This is actual production transport,
// not another source reader or a subjective/physical listening acceptance.
for(const speed of [.35,.55,1,1.4]){
  test(`Shengshengman xiqiang demo keeps exactly two passes,252 targets and the full192 beats at ${speed}x`,async()=>{
    const h=endingRestHarness("sheng-sheng-man");const {c}=h;
    assert.equal(c.songEvents.length,252);assert.equal(c.songTotalBeats,192);
    assert.equal(c.currentSong.beatsPerMeasure,4);assert.equal(c.accompanimentEvents.length,0);assert.equal(c.accompanimentEnabled,false);
    assert.ok(c.songEvents.every(e=>e.notes.length===1&&e.judgeLanes.length===1));
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();
    const bs=c.getScaledBeatSeconds();near(bs,60/72/speed);
    h.stepTo(1*bs+1e-6);h.tick();assert.deepEqual(h.names(),["E5","G5","G5"],"independent repeated G5 attacks survive");
    h.stepTo(95.99*bs);h.tick();assert.equal(h.names().length,126);assert.equal(h.names().at(-1),"C5");assert.equal(c.shouldLoop(),true);
    h.stepTo(96*bs+1e-6);h.tick();assert.equal(h.names().length,127);assert.equal(h.names().at(-1),"E5","the source repeat starts once at96");
    h.stepTo(190*bs+1/120);h.tick();assert.deepEqual(h.names(),Array.from(c.currentSong.steps,s=>s[0]));
    assert.equal(h.names().at(-1),"C5");assert.equal(c.shouldLoop(),true);
    h.stepTo(191.99*bs);h.tick();assert.equal(h.names().length,252);assert.equal(c.shouldLoop(),true);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();assert.equal(h.names().length,252);assert.equal(c.shouldLoop(),false);
  });
  test(`Shengshengman xiqiang physical-practice mode exposes252 single-note targets without automatic backing at ${speed}x`,async()=>{
    const h=endingRestHarness("sheng-sheng-man");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();await c.startPractice();
    const bs=c.getScaledBeatSeconds();assert.equal(c.practiceRunning,true);assert.equal(c.demoMode,false);
    assert.equal(c.songEvents.length,252);assert.ok(c.songEvents.every(e=>e.notes.length===1&&e.judgeLanes.length===1));
    h.stepTo(96*bs+1e-6);h.tick();assert.equal(c.shouldLoop(),true);assert.deepEqual(h.names(),[]);
    h.stepTo(191.99*bs);h.tick();assert.equal(c.shouldLoop(),true);assert.deepEqual(h.names(),[]);
    h.stepTo(c.getSongEndSeconds()+1/30);h.tick();assert.equal(c.shouldLoop(),false);assert.deepEqual(h.names(),[]);
  });
  for(const [from,to,expected]of[
    [0,4,["E5","G5","G5","C5","D5","C5"]],
    [43.5,48,["G5","E5"]],
    [92,100,["D5","A4","B4","C5","E5","G5","G5","C5","D5","C5"]],
    [188,192,["D5","A4","B4","C5"]]
  ])test(`Shengshengman xiqiang loop [${from},${to}) keeps source attacks and one restart at ${speed}x`,async()=>{
    const h=endingRestHarness("sheng-sheng-man");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();c.practiceLoopRange={startBeat:from,endBeat:to};c.prepareLoopStart();await c.playDemo();
    const bs=c.getScaledBeatSeconds();h.stepTo(to*bs-1e-6);h.tick();assert.deepEqual(h.names(),expected);
    h.stepTo(to*bs+1e-6);h.tick();assert.deepEqual(h.names(),expected);assert.ok(c.currentPracticeTime()<from*bs);
    h.stepTo(from*bs+1/120);h.tick();assert.deepEqual(h.names(),[...expected,expected[0]]);c.pausePractice();
  });
  test(`Shengshengman cross-system and in-bar ties never retrigger in either pass at ${speed}x`,async()=>{
    const h=endingRestHarness("sheng-sheng-man");const {c}=h;
    c.speedSlider.value=String(speed);c.applySpeed();await c.playDemo();const bs=c.getScaledBeatSeconds();
    for(const delta of [0,96])for(const [start,split,next,end,first,second]of[
      [43.5,44,44.5,48,"G5","E5"],[59.5,60,60.5,64,"D5","C5"]
    ]){
      h.stepTo((start+delta)*bs+1e-6);h.tick();assert.equal(h.names().at(-1),first);const count=h.names().length;
      h.stepTo((split+delta)*bs+1e-6);h.tick();assert.equal(h.names().length,count,"cross-boundary continuation is silent");
      h.stepTo((next+delta)*bs+1e-6);h.tick();assert.equal(h.names().length,count+1);assert.equal(h.names().at(-1),second);
      h.stepTo((end+delta-.01)*bs);h.tick();assert.equal(h.names().length,count+1,"the3.5-beat within-bar tie has one attack");
    }
    c.pausePractice();
  });
}

test("Shengshengman retains remembered canonical speed, source72 BPM and no support after switching songs",()=>{
  const h=harness({range:null});const {c}=h;const previous=globalThis.localStorage;
  try{globalThis.localStorage={getItem:()=>null};c.songLibrary=getSongLibrary();}
  finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
  c.setCurrentSong("sheng-sheng-man");assert.equal(c.getSongDefaultSpeedFactor(),1);assert.equal(c.speedFactor,1);
  c.speedSlider.value="0.65";c.applySpeed();c.setCurrentSong("birthday");c.setCurrentSong("sheng-sheng-man");
  assert.equal(c.currentSongId,"sheng-sheng-man");assert.equal(c.speedFactor,.65);assert.equal(c.currentSong.bpm,72);
  assert.equal(c.songEvents.length,252);assert.equal(c.songTotalBeats,192);assert.equal(c.accompanimentEvents.length,0);assert.equal(c.practiceLoopRange,null);
});
