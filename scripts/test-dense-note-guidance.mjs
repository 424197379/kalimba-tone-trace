import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { NOTE_INDEX, SONG_LIBRARY } from "../src/songs.js";
import { isBeatInLoop } from "../src/practice-loop.js";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const declarations = [...source.matchAll(/^    (?:async )?function (\w+)\(/gm)];
const runtime = [
  "buildSongEvents", "getScaledBeatSeconds", "getEventTime",
  "getEventJudgeWindowSeconds", "getJudgementEvent"
].map(name => {
  const index = declarations.findIndex(match => match[1] === name);
  assert.ok(index >= 0, `Missing production function ${name}`);
  return source.slice(declarations[index].index, declarations[index + 1]?.index ?? source.length);
}).join("\n");

// Use both the actual event builder and timing constants. A simplified scheduler
// or a smaller test-only switch lead would conceal the fast-passage regression.
const timingConstants = ["focusWindowSeconds", "lateGraceSeconds", "beamSwitchLeadSeconds"]
  .map(name => {
    const declaration = source.match(new RegExp(`^    const ${name} = [^;]+;`, "m"));
    assert.ok(declaration, `Missing production timing constant ${name}`);
    return declaration[0];
  }).join("\n");

const melodySongs = Object.values(SONG_LIBRARY).filter(song => song.schemaVersion === 1);
const speeds = [0.35, 0.55, 1, 1.4];
const epsilon = 1e-8;

function harness(song, speedFactor = 1, practiceLoopRange = null) {
  const context = {
    NOTE_INDEX, isBeatInLoop, beatSeconds: 60 / song.bpm,
    speedFactor, practiceLoopRange, songEvents: []
  };
  runInNewContext(`${timingConstants}\n${runtime}`, context);
  context.songEvents = context.buildSongEvents(song);
  return context;
}

function fixture(beats, names = ["C4", "D4", "E4", "F4"]) {
  return {
    title: "Guidance test", bpm: 60,
    steps: beats.map((beat, index) => [names[index % names.length], beat, 0.05])
  };
}

test("guidance regression covers every built-in V1 melody", () => {
  assert.ok(melodySongs.length >= 36, "The existing 36-song V1 corpus must remain covered");
  for (const song of melodySongs) assert.ok(song.steps.length > 0, `${song.id} needs melody onsets`);
});

for (const speed of speeds) {
  test(`all built-in V1 attacks select their own event at ${speed}x`, () => {
    for (const song of melodySongs) {
      const c = harness(song, speed);
      for (const event of c.songEvents) {
        const selected = c.getJudgementEvent(c.getEventTime(event));
        assert.equal(selected, event,
          `${song.id} at ${speed}x, event ${event.id}, beat ${event.beat}: selected ${selected?.id ?? "nothing"}`);
      }
    }
  });
}

test("dense built-in passages keep the current event through the interval midpoint", () => {
  let checked = 0;
  for (const speed of speeds) {
    for (const song of melodySongs) {
      const c = harness(song, speed);
      for (let index = 1; index < c.songEvents.length; index++) {
        const current = c.songEvents[index - 1];
        const next = c.songEvents[index];
        const currentTime = c.getEventTime(current);
        const nextTime = c.getEventTime(next);
        const interval = nextTime - currentTime;
        if (interval <= 0 || interval >= 0.12 / 0.45) continue;
        assert.equal(c.getJudgementEvent(currentTime + interval / 2), current,
          `${song.id} at ${speed}x switches before the midpoint after event ${current.id}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, "The real song corpus must exercise dense intervals");
});

test("dense guidance switches after 55 percent of the preceding onset interval", () => {
  const c = harness(fixture([0, 0.08, 0.16, 0.24]));
  for (let index = 1; index < c.songEvents.length; index++) {
    const current = c.songEvents[index - 1];
    const next = c.songEvents[index];
    const start = c.getEventTime(current);
    const interval = c.getEventTime(next) - start;
    const switchTime = start + interval * 0.55;
    assert.equal(c.getJudgementEvent(switchTime - epsilon), current);
    assert.equal(c.getJudgementEvent(switchTime + epsilon), next);
  }
});

test("repeated notes retain distinct event identities at every practice speed", () => {
  for (const speed of speeds) {
    const c = harness(fixture([0, 0.08, 0.16, 0.24], ["C4"]), speed);
    assert.equal(new Set(c.songEvents.map(event => event.id)).size, 4);
    assert.equal(new Set(c.songEvents.map(event => event.lane)).size, 1);
    for (const event of c.songEvents) {
      assert.equal(c.getJudgementEvent(c.getEventTime(event)), event,
        `The repeated C4 at beat ${event.beat} must remain a separate strike at ${speed}x`);
    }
  }
});

test("loop A is the first eligible onset and loop B is always excluded", () => {
  const c = harness(fixture([0.99, 1, 1.08, 1.16, 1.24, 1.25]), 1,
    { startBeat: 1, endBeat: 1.24 });
  const [beforeA, atA, middle, final, atB, afterB] = c.songEvents;
  // The close onset outside the loop must not shorten A's normal anticipation.
  assert.equal(c.getJudgementEvent(atA.beat - 0.12 - epsilon), null);
  assert.equal(c.getJudgementEvent(atA.beat - 0.12 + epsilon), atA);
  for (const event of [atA, middle, final]) {
    assert.equal(c.getJudgementEvent(c.getEventTime(event)), event);
  }
  for (const time of [final.beat, atB.beat - epsilon, atB.beat, afterB.beat]) {
    assert.equal(c.getJudgementEvent(time), final);
    assert.notEqual(c.getJudgementEvent(time), beforeA);
    assert.notEqual(c.getJudgementEvent(time), atB);
    assert.notEqual(c.getJudgementEvent(time), afterB);
  }
  c.practiceLoopRange = { startBeat: 3, endBeat: 4 };
  assert.equal(c.getJudgementEvent(3), null);
});

test("slower passages preserve their normal 120 ms anticipation at every speed", () => {
  for (const speed of speeds) {
    const c = harness(fixture([0, 1, 2]), speed);
    for (const event of c.songEvents) {
      const switchTime = c.getEventTime(event) - 0.12;
      assert.equal(c.getJudgementEvent(switchTime - epsilon), null);
      assert.equal(c.getJudgementEvent(switchTime + epsilon), event);
      assert.equal(c.getJudgementEvent(c.getEventTime(event)), event);
    }
  }
});

test("late grace and longer event judge windows remain unchanged", () => {
  const c = harness(fixture([1]));
  const [event] = c.songEvents;
  assert.equal(c.getJudgementEvent(1.36 - epsilon), event);
  assert.equal(c.getJudgementEvent(1.36 + epsilon), null);
  event.judgeWindow = 0.8;
  assert.equal(c.getJudgementEvent(1.8 - epsilon), event);
  assert.equal(c.getJudgementEvent(1.8 + epsilon), null);
  c.songEvents = [];
  assert.equal(c.getJudgementEvent(0), null);
});
