import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
function extract(name, next) {
  return source.slice(source.indexOf(`    function ${name}(`), source.indexOf(next, source.indexOf(`    function ${name}(`)));
}
function harness() {
  const gains = [];
  let starts = 0;
  const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = () => ({ connect(next) { return next; }, disconnect() {}, start() { starts++; }, stop() {},
    gain: param(), frequency: param(), Q: param(), detune: param() });
  const context = {
    audioContext: { state: "running", currentTime: 0, sampleRate: 44100,
      createBufferSource: node, createOscillator: node, createBiquadFilter: node,
      createBuffer: (channels, count) => ({ getChannelData: () => new Float32Array(count) }),
      createGain() { const value = node(); value.gain.setValueAtTime = gain => gains.push(gain); return value; }
    },
    document: { hidden: false }, registerKalimbaVoice() {},
    kalimbaBus: node(), ensureKalimbaOutput() {}, pluckEnvelope() {}, setTimeout() {},
    NOTE_INDEX: new Map([["C4", 0]]), DISPLAY_KEYS: [{ name: "C4", freq: 261.63 }],
    clamp: (value, min, max) => Math.max(min, Math.min(max, value))
  };
  runInNewContext(extract("playDecodedKalimbaSample", "    async function playKalimbaSample(") + extract("createPluckSynth", "    function getExpectedEvent("), context);
  return { context, gains, starts: () => starts };
}

test("zero accompaniment gain creates no new sample or fallback voices", () => {
  for (const velocity of [0, -1, NaN, Infinity]) {
    const h = harness();
    assert.equal(h.context.playDecodedKalimbaSample("C4", { duration: 1 }, velocity), true);
    h.context.createPluckSynth("C4", 1, velocity);
    assert.equal(h.starts(), 0);
    assert.equal(h.gains.length, 0);
  }
});

test("quiet sample and fallback gain respond proportionally below ten percent", () => {
  for (const [method, scale] of [["playDecodedKalimbaSample", .92], ["createPluckSynth", .82]]) {
    for (const velocity of [.01, .05, .1, 1, 2]) {
      const h = harness();
      h.context[method]("C4", method === "playDecodedKalimbaSample" ? { duration: 1 } : 1, velocity);
      assert.equal(h.gains[0], scale * Math.min(1.2, velocity));
      assert.ok(h.starts() > 0);
    }
  }
});
