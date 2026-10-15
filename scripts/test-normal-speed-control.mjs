import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { harness, production } from "./helpers/practice-startup-harness.mjs";
import { readSongSpeed } from "../src/practice-preferences.js";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test("one normal-speed marker replaces the conflicting recommendation button", () => {
  assert.equal((html.match(/id="songSpeedBtn"/g) || []).length, 1);
  assert.match(html, /id="speedSlider"[^>]*value="1"/);
  assert.match(html, /id="songSpeedBtn"[^>]*aria-label="恢复 1.0 倍原速"[^>]*>1\.0<\/button>/);
  assert.doesNotMatch(html, /曲目默认速率|曲目默认速度/);
  assert.doesNotMatch(source, /setCompactIcon\(songSpeedBtn/);
  assert.match(source, /songSpeedBtn\.addEventListener\("click", applySongDefaultSpeed\)/);
});
test("1.0 dot aligns with the explicitly sized native thumb's center across track widths", () => {
  const input = html.match(/<input id="speedSlider"[^>]+>/)[0];
  const min = Number(input.match(/min="([^"]+)"/)[1]), max = Number(input.match(/max="([^"]+)"/)[1]);
  const mark = css.match(/\.speed-slider-control #songSpeedBtn \{[^}]+/)[0];
  const [, percent, correction] = mark.match(/left: calc\(([\d.]+)% - ([\d.]+)px\)/).map(Number);
  for (const width of [48, 74, 100, 168, 240, 500]) {
    const thumbCenter = 7 + (width - 14) * (1 - min) / (max - min);
    near(width * percent / 100 - correction, thumbCenter);
  }
  assert.match(css, /#speedSlider::-webkit-slider-thumb[^}]*width: 14px; height: 14px/);
  assert.match(css, /#speedSlider::-moz-range-thumb[^}]*width: 14px; height: 14px/);
});
for (const mode of ["practice", "demo"]) for (const paused of [false, true]) {
  test(`normal-speed action preserves ${mode} ${paused ? "paused" : "running"} musical position and segment`, async () => {
    const h = harness(), { c } = h;
    production("getSongDefaultSpeedFactor", c); production("applySongDefaultSpeed", c);
    c.speedSlider.value = ".55"; c.applySpeed();
    await c[mode === "demo" ? "playDemo" : "startPractice"]();
    c.seekToSongTime(4.2 * c.getScaledBeatSeconds());
    if (paused) c.pausePractice();
    const beat = c.currentPracticeTime() / c.getScaledBeatSeconds(), range = { ...c.practiceLoopRange };
    c.applySongDefaultSpeed();
    assert.equal(c.speedFactor, 1); near(c.currentPracticeTime() / c.getScaledBeatSeconds(), beat);
    assert.deepEqual({ ...c.practiceLoopRange }, range);
    assert.equal(c.shouldLoop(), !paused);
    assert.equal(paused ? c.pausedSession.mode : c.demoMode ? "demo" : "practice", mode);
    assert.equal(readSongSpeed(c.browserPreferenceStorage, c.currentSongId).speed, 1);
  });
}
test("editorial recommendations are not written or used by the normal-speed action", () => {
  const h = harness(), { c } = h;
  production("getSongDefaultSpeedFactor", c); production("applySongDefaultSpeed", c);
  for (const recommendation of [.4, .82, .88, 1.2]) {
    c.currentSong.defaultSpeedFactor = recommendation;
    c.speedSlider.value = ".65"; c.applySpeed(); c.applySongDefaultSpeed();
    assert.equal(c.speedFactor, 1); assert.equal(c.currentSong.defaultSpeedFactor, recommendation);
  }
});


test("compact board reports genuine completion and clears it on a new state", () => {
  const h = harness(), { c } = h;
  c.playbackNotice = { hidden: true, textContent: "" };
  c.practiceRunning = false; c.demoMode = false; c.pausedSession = null;
  for (const text of ["练习结束", "示范结束"]) {
    c.setStatus(text); assert.equal(c.playbackNotice.hidden, false);
    assert.equal(c.playbackNotice.textContent, text);
    c.setStatus("待开始"); assert.equal(c.playbackNotice.hidden, true);
  }
  c.pausedSession = { mode: "practice", seconds: 1 }; c.setStatus("已暂停");
  assert.match(c.playbackNotice.textContent, /点“继续”恢复/);
});
