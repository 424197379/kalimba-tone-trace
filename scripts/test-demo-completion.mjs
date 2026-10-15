import assert from "node:assert/strict";
import test from "node:test";
import { harness } from "./helpers/practice-startup-harness.mjs";

function fixture({ total = 6, speed = 1, backing = false, tailRest = false, longHold = false, range = null } = {}) {
  const h = harness({ beats: [0, 1, 2, total - (tailRest ? 3 : 1)], range });
  const c = h.c;
  c.songTotalBeats = total; c.accompanimentTotalBeats = total;
  if (longHold) c.songEvents.at(-1).duration = 1;
  c.accompanimentEnabled = backing;
  c.speedSlider.value = String(speed); c.applySpeed();
  return h;
}
async function complete(h, mode = "demo") {
  const c = h.c;
  await c[mode === "demo" ? "playDemo" : "startPractice"]();
  h.healthy(c.getSessionLeadSeconds() + c.getSongEndSeconds() + .05);
}
function assertCompleted(h, mode = "demo") {
  const c = h.c, duration = c.getSongProgressDuration();
  assert.equal(c.shouldLoop(), false);
  assert.equal(c.statusText.textContent, mode === "demo" ? "示范结束" : "练习结束");
  assert.equal(c.playbackNotice.hidden, false);
  assert.equal(c.pauseBtn.disabled, true);
  assert.equal(c.pausedSession, null);
  assert.equal(c.songProgressFill.style.width, "100.000%");
  assert.equal(c.songProgressThumb.style.left, "100.000%");
  assert.equal(c.songProgress.attrs["aria-valuetext"], `${c.formatSongTime(duration)} / ${c.formatSongTime(duration)}`);
  assert.equal(c.songRemaining.textContent, "剩余 0:00");
  assert.ok(c.currentPracticeTime() >= duration - 1e-7);
  assert.equal(h.frames.size, 0);
}
for (const setup of [{ total: 4 }, { total: 10, tailRest: true }, { total: 12, longHold: true }, { total: 180 }]) {
  for (const backing of [false, true]) for (const speed of [.35, 1, 1.4]) {
    test(`natural demo retains end: ${setup.total} beats, rest${!!setup.tailRest}, hold${!!setup.longHold}, backing${backing}, ${speed}x`, async () => {
      const h = fixture({ ...setup, backing, speed }); await complete(h); assertCompleted(h);
      assert.ok(h.c.songEvents.every(event => event.demoPlayed), "completed melody flags are not reset implicitly");
      if (backing) assert.ok(h.c.accompanimentEvents.every(event => event.played), "completed backing flags are not reset implicitly");
      const sounds = h.sounds.length, position = h.c.currentPracticeTime();
      h.advance(10); h.tick(); h.c.renderBoard(h.c.currentPracticeTime());
      assert.equal(h.c.currentPracticeTime(), position); assert.equal(h.sounds.length, sounds); assertCompleted(h);
    });
  }
}
for (const action of ["playDemo", "startPractice", "restartPractice"]) test(`${action} after demo completion still gives one new preparation`, async () => {
  const h = fixture({ backing: true }); const c = h.c; await complete(h); const before = h.sounds.length;
  await c[action]();
  assert.ok(c.currentPracticeTime() < 0); assert.equal(c.shouldLoop(), true);
  assert.equal(c.playbackNotice.hidden, true);
  h.tick(); h.healthy(c.getSessionLeadSeconds() - .03); assert.equal(h.sounds.length, before);
  h.healthy(.06); assert.ok(c.currentPracticeTime() >= 0 && c.currentPracticeTime() < .06);
});
test("Continue after natural completion is a no-op, not an implicit rewind/resume", async () => {
  const h = fixture(); await complete(h); const end = h.c.currentPracticeTime(), count = h.sounds.length;
  await h.c.continuePractice(); h.tick(); assert.equal(h.c.currentPracticeTime(), end); assert.equal(h.sounds.length, count); assertCompleted(h);
});
for (const seconds of [0, .75]) test(`manual seek${seconds} after completion clears stale ended notice without auto-play`, async () => {
  const h = fixture(); await complete(h); h.c.seekToSongTime(seconds);
  assert.equal(h.c.statusText.textContent, "待开始"); assert.equal(h.c.playbackNotice.hidden, true);
  assert.equal(h.c.shouldLoop(), false); assert.equal(h.c.pauseBtn.disabled, true);
  assert.equal(h.c.pausedSession, null);
  assert.equal(h.c.currentPracticeTime(), seconds === 0 ? -h.c.getSessionLeadSeconds() : seconds);
  await h.c.playDemo(); assert.ok(h.c.currentPracticeTime() < 0);
});
for (const mode of ["demo", "practice"]) test(`${mode}: changing speed while still at completed end keeps completed presentation`, async () => {
  const h = fixture({ backing: true }); await complete(h, mode);
  for (const speed of [1.4, .35, 1]) {
    h.c.speedSlider.value = String(speed); h.c.applySpeed(); assertCompleted(h, mode);
  }
});
for (const backing of [false, true]) test(`positive segment end still wraps and never becomes completed, backing${backing}`, async () => {
  const h = fixture({ total: 8, backing, range: { startBeat: 2, endBeat: 4 } }); const c = h.c;
  await c.playDemo();
  h.healthy((c.getSessionLeadSeconds() + (4 - 2) * c.getScaledBeatSeconds()) * 4 + .1);
  assert.equal(c.shouldLoop(), true); assert.ok(c.practiceLoopRange);
  assert.doesNotMatch(c.statusText.textContent, /结束/); assert.equal(c.playbackNotice.hidden, true);
  assert.ok(c.currentPracticeTime() < 4 * c.getScaledBeatSeconds());
});

for (const mode of ["demo", "practice"]) test(`${mode}: choosing or editing a segment after completion clears the old completion notice`, async () => {
  const h = fixture(); await complete(h, mode); h.c.togglePracticeLoop();
  assert.ok(h.c.practiceLoopRange); assert.equal(h.c.shouldLoop(), false);
  assert.equal(h.c.statusText.textContent, "待开始"); assert.equal(h.c.playbackNotice.hidden, true);
  h.c.handleLoopKeydown({ key: "Home", preventDefault() {} }, "start");
  assert.equal(h.c.practiceLoopRange.startBeat, 0); assert.equal(h.c.statusText.textContent, "待开始");
  await h.c.playDemo(); assert.equal(h.c.shouldLoop(), true); assert.ok(h.c.currentPracticeTime() < 0);
});

for (const shape of ["rest", "hold"]) for (const backing of [false, true]) test(`natural ending waits through the actual ${shape}, backing${backing}`, async () => {
  const h = fixture({ total: 10, backing, tailRest: shape === "rest", longHold: shape === "hold" }); const c = h.c;
  await c.playDemo(); h.healthy(c.getSessionLeadSeconds() + c.songTotalBeats * c.getScaledBeatSeconds() - .05);
  assert.equal(c.shouldLoop(), true); assert.equal(c.statusText.textContent, "示范中");
  assert.equal(c.playbackNotice.hidden, true); assert.notEqual(c.songProgressFill.style.width, "100.000%");
  const emitted = h.sounds.length;
  h.healthy(c.getSongEndSeconds() - c.currentPracticeTime() + .05);
  assert.equal(h.sounds.length, emitted, "natural tail does not invent another attack"); assertCompleted(h);
});
