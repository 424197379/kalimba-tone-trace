import assert from "node:assert/strict";
import { test } from "node:test";
import { harness, audioHarness, lifecycle } from "./helpers/practice-startup-harness.mjs";

const settle = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
async function healthy(h, seconds) {
  h.tick(); await settle();
  const count = Math.max(1, Math.ceil(seconds / .02));
  for (let index = 0; index < count; index++) {
    h.advance(seconds / count); h.tick(); await settle();
    assert.ok(h.frames.size <= 1, "one transport RAF chain");
  }
}
function fixture({ speed = 1, range = null } = {}) {
  const h = audioHarness(harness({ beats: [0, 1, 2, 3, 4, 5, 6, 8], range }));
  const { c } = h;
  c.songEvents.forEach(event => { event.notes = [{ name: "C4", velocity: .8 }]; });
  c.accompanimentEvents.forEach(event => { event.notes = [{ name: "C4", velocity: .6 }]; });
  c.accompanimentEnabled = false;
  c.speedSlider.value = String(speed); c.applySpeed();
  return h;
}
async function begin(h, mode) { await h.c[mode === "demo" ? "playDemo" : "startPractice"](); }

for (const mode of ["practice", "demo"]) for (const speed of [.35, 1, 1.4]) for (const range of [null, { startBeat: 2, endBeat: 4 }]) {
  test(`${mode} ${speed}x ${range ? "A/B" : "song"}: late first RAF and layout renders preserve a complete synchronized count-in`, async () => {
    const h = fixture({ speed, range }); const { c } = h;
    await begin(h, mode);
    const initial = c.currentPracticeTime(), lead = c.getSessionLeadSeconds();
    const target = (range?.startBeat || 0) * c.getScaledBeatSeconds();
    h.advance(20); c.renderBoard(c.currentPracticeTime());
    near(c.currentPracticeTime(), initial); near(c.lastPracticeFrameSeconds, initial);
    assert.ok(c.passPreparation); assert.equal(h.started().length, 0);
    h.tick(); near(c.currentPracticeTime(), initial); assert.equal(c.passPreparation, null);
    await healthy(h, lead - .03); assert.equal(h.started().length, 0);
    assert.notEqual(c.keyEls[range ? 2 : 0].attrs["data-cue-phase"], "active-fill");
    await healthy(h, .05);
    assert.equal(c.shouldLoop(), true); assert.equal(c.passPreparation, null);
    assert.equal(h.started().length, mode === "demo" ? 1 : 0);
    near(c.renderKeyGuidance.state.beat, c.lastPracticeFrameSeconds / c.getScaledBeatSeconds());
    assert.ok(c.currentPracticeTime() >= target && c.currentPracticeTime() < target + .05);
    assert.equal(c.keyEls[range ? 2 : 0].attrs["data-cue-phase"], "active-fill");
  });
}

for (const mode of ["practice", "demo"]) for (const entry of ["RAF", "layout", "backing"]) {
  test(`${mode} ${entry}: after clock arming, a material gap actually missing the first onset retains frozen49 pause policy`, async () => {
    const h = fixture(); const { c } = h; await begin(h, mode); h.tick();
    await healthy(h, c.getSessionLeadSeconds() - .1);
    const checkpoint = c.lastPracticeFrameSeconds;
    h.advance(1.1);
    if (entry === "RAF") h.tick();
    else if (entry === "layout") c.renderBoard(c.currentPracticeTime());
    else c.playAccompanimentEvents(c.currentPracticeTime());
    assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0);
    near(c.currentPracticeTime(), checkpoint); near(c.lastPracticeFrameSeconds, checkpoint);
    assert.equal(c.statusText.textContent, "播放卡顿，已暂停");
    assert.equal(c.playbackNotice.hidden, false); assert.match(c.playbackNotice.textContent, /继续/);
    assert.equal(h.started().length, 0); near(c.pausedSession.seconds, 0);
    await c.continuePractice(); await healthy(h, c.resumePreparation.duration + .02);
    assert.equal(c.shouldLoop(), true); assert.equal(h.started().length, mode === "demo" ? 1 : 0);
  });
}

for (const mode of ["practice", "demo"]) {
  test(`${mode}: a healthy count-in gives one first onset, and a later real stall still pauses`, async () => {
    const h = fixture(); const { c } = h; await begin(h, mode); h.tick();
    await healthy(h, c.getSessionLeadSeconds() + .02);
    assert.equal(c.passPreparation, null); assert.equal(h.started().length, mode === "demo" ? 1 : 0);
    const checkpoint = c.lastPracticeFrameSeconds; h.advance(1); h.tick();
    assert.equal(c.shouldLoop(), false); near(c.pausedSession.seconds, checkpoint);
    assert.equal(c.statusText.textContent, "播放卡顿，已暂停");
    assert.equal(h.started().length, mode === "demo" ? 1 : 0);
  });

  test(`${mode}: nested backing admission preserves the checkpoint when in-render cost actually misses the first onset`, async () => {
    const h = fixture(); const { c } = h; await begin(h, mode); h.tick();
    await healthy(h, c.getSessionLeadSeconds() - .1);
    const checkpoint = c.lastPracticeFrameSeconds, original = c.clearHighlights; let once = true;
    c.clearHighlights = () => { original(); if (once) { once = false; h.advance(1.1); } };
    h.advance(.02); h.tick();
    assert.equal(c.shouldLoop(), false); assert.equal(c.passPreparation, null);
    near(c.currentPracticeTime(), checkpoint); near(c.lastPracticeFrameSeconds, checkpoint);
    assert.equal(h.frames.size, 0); assert.equal(h.started().length, 0);
    assert.equal(c.statusText.textContent, "播放卡顿，已暂停");
  });

  test(`${mode}: Continue's first late RAF cannot consume its count-in or replay earlier notes`, async () => {
    const h = fixture(); const { c } = h; await begin(h, mode); c.seekToSongTime(.25); c.pausePractice();
    await c.continuePractice(); const duration = c.resumePreparation.duration;
    h.advance(20); c.renderBoard(c.currentPracticeTime());
    assert.equal(c.resumePreparation.startedAt, null); near(c.currentPracticeTime(), .25);
    assert.equal(h.started().length, 0); h.tick();
    await healthy(h, duration - .03); assert.ok(c.resumePreparation); assert.equal(h.started().length, 0);
    await healthy(h, .05); assert.equal(c.resumePreparation, null); assert.ok(c.currentPracticeTime() >= .25 && c.currentPracticeTime() < .28);
    assert.equal(h.started().length, 0);
    await healthy(h, .24); assert.equal(h.started().length, mode === "demo" ? 1 : 0);
  });

  test(`${mode}: Continue tolerates count-in frame gaps and anchors an overdue completion at the preserved target`, async () => {
    const h = fixture({ speed: .35 }); const { c } = h;
    await begin(h, mode); c.pausePractice(); await c.continuePractice();
    const duration = c.resumePreparation.duration; h.tick(); const startedAt = c.resumePreparation.startedAt;
    for (let index = 0; index < 2; index++) {
      h.advance(1); h.tick(); assert.ok(c.resumePreparation);
      assert.equal(c.resumePreparation.startedAt, startedAt);
      assert.equal(c.shouldLoop(), true); assert.equal(h.started().length, 0);
    }
    h.advance(duration - 2 + .5); h.tick(); await settle();
    assert.equal(c.resumePreparation, null); assert.equal(c.shouldLoop(), true);
    near(c.currentPracticeTime(), 0); assert.equal(h.frames.size, 1);
    assert.equal(h.started().length, mode === "demo" ? 1 : 0);
  });

  for (const action of ["pause", "reset", "hidden", "audio", "navigation", "new-mode"]) for (const phase of ["first-frame", "count-in", "Continue"]) {
    test(`${mode} ${phase}: ${action} cancels old preparation even after a long unscheduled interval`, async () => {
      const h = fixture(); const { c } = h; const life = lifecycle(h); await begin(h, mode);
      if (phase === "count-in") { h.tick(); await healthy(h, .1); }
      if (phase === "Continue") { c.pausePractice(); await c.continuePractice(); }
      h.advance(20);
      if (action === "pause") c.pausePractice();
      if (action === "reset") c.resetPracticeState();
      if (action === "hidden") life.hide();
      if (action === "audio") { c.audioContext.state = "suspended"; c.handleAudioContextStateChange(); }
      if (action === "navigation") c.openSongLibrary();
      if (action === "new-mode") await begin(h, mode === "practice" ? "demo" : "practice");
      assert.equal(c.shouldLoop(), action === "new-mode");
      assert.equal(h.frames.size, action === "new-mode" ? 1 : 0);
      assert.equal(h.started().length, 0);
      if (action !== "new-mode") assert.equal(c.passPreparation, null);
      else { h.advance(10); near(c.currentPracticeTime(), -c.getSessionLeadSeconds()); }
      c.document.hidden = false; c.audioContext.state = "running";
      if (action !== "new-mode") { h.advance(10); h.tick(); assert.equal(c.shouldLoop(), false); }
    });
  }
}

for (const speed of [.35, 1.4]) {
  test(`a ${speed}x speed change before the first frame preserves the prepared musical position`, async () => {
    const h = fixture(); const { c } = h; await begin(h, "demo");
    const beat = c.currentPracticeTime() / c.getScaledBeatSeconds();
    c.speedSlider.value = String(speed); c.applySpeed();
    near(c.currentPracticeTime() / c.getScaledBeatSeconds(), beat); assert.ok(c.passPreparation);
    h.advance(10); near(c.currentPracticeTime() / c.getScaledBeatSeconds(), beat); h.tick();
    assert.equal(c.passPreparation, null);
    await healthy(h, -c.currentPracticeTime() + .02);
    assert.equal(c.shouldLoop(), true); assert.equal(h.started().length, 1);
  });
}

for (const mode of ["practice", "demo"]) for (const range of [null, { startBeat: 2, endBeat: 4 }]) {
  test(`${mode} ${range ? "positive A" : "song"}: two 1-second gaps wholly inside 0.35x count-in neither restart nor pause`, async () => {
    const h = fixture({ speed: .35, range }); const { c } = h; await begin(h, mode); h.tick();
    const initial = c.currentPracticeTime(); assert.ok(c.getSessionLeadSeconds() > 4);
    for (let index = 1; index <= 2; index++) {
      h.advance(1); h.tick();
      assert.equal(c.shouldLoop(), true); assert.equal(c.passPreparation, null);
      near(c.currentPracticeTime(), initial + index); near(c.lastPracticeFrameSeconds, initial + index);
      assert.equal(c.pausedSession, null); assert.equal(h.started().length, 0); assert.equal(h.frames.size, 1);
    }
    const checkpoint = c.lastPracticeFrameSeconds;
    h.advance(c.getSessionLeadSeconds() - 2 + .2); h.tick();
    assert.equal(c.shouldLoop(), false); near(c.currentPracticeTime(), checkpoint);
    assert.equal(c.statusText.textContent, "播放卡顿，已暂停"); assert.equal(h.started().length, 0);
  });
}

test("seek zero and later A/B passes have no spent-gap budget that can stop an untouched count-in", async () => {
  for (const operation of ["seek-zero", "A/B"]) {
    const h = fixture({ speed: .35, range: operation === "A/B" ? { startBeat: 2, endBeat: 4 } : null }); const { c } = h;
    await begin(h, "demo"); h.tick(); h.advance(1); h.tick(); h.advance(1); h.tick();
    await healthy(h, c.getSessionLeadSeconds() - 2 + .02);
    if (operation === "seek-zero") c.seekToSongTime(0);
    else await healthy(h, c.practiceLoopRange.endBeat * c.getScaledBeatSeconds() - c.currentPracticeTime() + .001);
    assert.ok(c.passPreparation); const initial = c.currentPracticeTime(), before = h.started().length;
    h.advance(20); near(c.currentPracticeTime(), initial); h.tick();
    for (let index = 1; index <= 2; index++) {
      h.advance(1); h.tick(); assert.equal(c.shouldLoop(), true);
      near(c.currentPracticeTime(), initial + index); assert.equal(h.started().length, before);
    }
    assert.equal(h.frames.size, 1);
  }
});

test("held-zero seek cannot consume first-frame preparation; a nonzero seek cancels it", async () => {
  const h = fixture(); const { c } = h; await begin(h, "demo");
  c.startProgressSeek({ pointerId: 7, button: 0, isPrimary: true, clientX: 0, preventDefault() {} });
  await healthy(h, 5); assert.ok(c.passPreparation); assert.equal(h.started().length, 0);
  c.finishProgressSeek({ pointerId: 7, type: "pointerup" }); h.advance(5);
  near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
  await healthy(h, c.getSessionLeadSeconds() + .02); assert.equal(h.started().length, 1);
  c.seekToSongTime(0); assert.ok(c.passPreparation); c.seekToSongTime(.6);
  assert.equal(c.passPreparation, null); near(c.currentPracticeTime(), .6);
});

for (const mode of ["practice", "demo"]) {
  test(`${mode}: cold output creation is paid before the score clock and first RAF`, async () => {
    const h = fixture(); const { c } = h; const original = c.ensureKalimbaOutput; let builds = 0;
    c.ensureKalimbaOutput = () => { if (!c.kalimbaBus) { builds++; h.advance(1.1); } original(); };
    await begin(h, mode); assert.equal(builds, 1); assert.equal(h.started().length, 0);
    near(c.currentPracticeTime(), -c.getSessionLeadSeconds());
    await healthy(h, c.getSessionLeadSeconds() + .02);
    assert.equal(c.shouldLoop(), true);
    assert.equal(builds, 1); assert.equal(h.started().length, mode === "demo" ? 1 : 0);
  });
}

for (const kind of ["sample", "synth"]) for (const age of [.149999, .15, .150001, 1.1]) {
  test(`${kind}: ${age * 1000} ms cold-output cost cannot launch expired sources`, async () => {
    const h = fixture(); const { c } = h;
    c.loadKalimbaSampleBuffer = async () => kind === "sample" ? { duration: 2 } : null;
    c.practiceRunning = true; h.at(0); c.lastPracticeFrameSeconds = 0;
    const original = c.createKalimbaImpulseResponse;
    c.createKalimbaImpulseResponse = (...args) => { const buffer = original(...args); h.advance(age); return buffer; };
    await c.playKalimbaNote("C4", 1, .8, c.getPracticeNoteTiming(0));
    assert.equal(h.started().length, age < .15 ? kind === "sample" ? 1 : 9 : 0);
    assert.equal(c.shouldLoop(), true, "audio expiry alone never pauses transport");
  });
}

for (const gap of [.999999, 1, 1.000001]) {
  test(`a ${gap * 1000} ms new-pass gap without any missed onset preserves its progressing preparation`, async () => {
    const h = fixture(); const { c } = h; await begin(h, "demo"); h.tick();
    const initial = c.currentPracticeTime(); h.advance(gap); h.tick();
    assert.equal(c.shouldLoop(), true); assert.equal(c.passPreparation, null);
    near(c.currentPracticeTime(), initial + gap); near(c.lastPracticeFrameSeconds, initial + gap);
    assert.equal(h.started().length, 0); assert.equal(h.frames.size, 1);
  });
}

test("a superseded readiness result cannot warm output or arm a former preparation token", async () => {
  const h = fixture(); const { c } = h; let resolve, warm = 0;
  const pending = new Promise(done => { resolve = done; });
  c.preloadKalimbaSamples = () => pending;
  const old = c.playDemo(); await settle();
  const oldRequest = c.playbackRequestId;
  c.preloadKalimbaSamples = async () => [];
  const original = c.ensureKalimbaOutput; c.ensureKalimbaOutput = () => { warm++; original(); };
  await c.startPractice();
  const request = c.playbackRequestId; assert.ok(request > oldRequest);
  assert.equal(c.passPreparation.requestId, request); assert.equal(warm, 1);
  resolve([]); await old;
  assert.equal(c.passPreparation.requestId, request); assert.equal(warm, 1);
  assert.equal(c.practiceRunning, true); assert.equal(c.demoMode, false); assert.equal(h.frames.size, 1);
});
