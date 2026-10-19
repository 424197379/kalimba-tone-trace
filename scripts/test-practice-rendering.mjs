import { selectKeyGuidance } from "../src/key-guidance.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { isBeatInLoop } from "../src/practice-loop.js";
import { NOTE_INDEX, SONG_LIBRARY } from "../src/songs.js";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const renderSource = appSource.slice(appSource.indexOf("    function renderBoard("), appSource.indexOf("    function shouldLoop("));
const compactViewSource = appSource.slice(appSource.indexOf("    function isCompactPracticeView("), appSource.indexOf("    function getSessionLeadSeconds("));
const birthday = JSON.parse(await readFile(new URL("../data/songs/birthday.json", import.meta.url), "utf8"));
const declarations = [...appSource.matchAll(/^    (?:async )?function (\w+)\(/gm)];
const guidanceSource = ["getScaledBeatSeconds", "getEventTime", "getEventDurationSeconds",
  "getEventJudgeWindowSeconds", "getExpectedEvent", "getJudgementEvent", "admitPracticeFrame",
  "clearHighlights", "setActiveBeamLane", "highlightLane", "renderKeyGuidance"].map(name => {
  const index = declarations.findIndex(match => match[1] === name);
  assert.ok(index >= 0, `Missing production function ${name}`);
  return appSource.slice(declarations[index].index, declarations[index + 1]?.index ?? appSource.length);
}).join("\n");
const timingConstants = ["focusWindowSeconds", "lateGraceSeconds", "beamSwitchLeadSeconds"].map(name => {
  const declaration = appSource.match(new RegExp(`^    const ${name} = [^;]+;`, "m"));
  assert.ok(declaration, `Missing production timing constant ${name}`);
  return declaration[0];
}).join("\n");

function classes() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(value => values.add(value)),
    remove: (...names) => names.forEach(value => values.delete(value)),
    contains: value => values.has(value),
    toggle: (value, enabled) => enabled ? values.add(value) : values.delete(value)
  };
}

// 执行实际 renderBoard，防止手机裁剪规则再次丢掉同列或密集音符。
function renderHarness(events, {
  compact = true, height = 165, lead = 1.9,
  scaledBeat = 60 / birthday.bpm / .55, duration = 60, range = null
} = {}) {
  const noteEls = new Map(events.map(event => [event.id, { style: {}, classList: classes() }]));
  const elements = () => Array.from({ length: 21 }, () => ({ classList: classes(), attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } }));
  const beamEls = elements(); const laneEls = elements(); const keyEls = elements();
  const context = {
    selectKeyGuidance, pausedSession: null, seekingWithProgress: false, songEvents: events, noteEls, DISPLAY_KEYS: Array(21), beamEls, laneEls, keyEls, activeBeamLane: "",
    practiceLoopRange: range, isBeatInLoop, beatSeconds: scaledBeat, speedFactor: 1,
    boardTop: { clientHeight: height }, noteLayer: { clientWidth: 840 },
    boardShell: { classList: classes() }, targetText: {},
    activeDetection: { lane: null, candidateLane: null }, activeInputUntil: 0, signalPeakUntil: 0,
    demoMode: false, practiceRunning: false, resumePreparation: null, passPreparation: null, noteLaneInsetRatio: .08,
    performance: { now: () => 0 },
    clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
    resetDetectionReadout() {},
    renderSongProgress() {}, formatEventTargetText: event => String(event.id),
    isCompactPracticeView: () => compact, getVisualFallLeadSeconds: () => lead,
    getSongProgressDuration: () => duration
  };
  runInNewContext(`${timingConstants}\n${guidanceSource}\n${renderSource}`, context);
  const activeIndexes = (elements, kind) => elements.flatMap((element, index) => element.classList.contains(kind) ? [index] : []);
  return {
    context, notes: noteEls, render: seconds => context.renderBoard(seconds),
    beam: () => {
      const active = activeIndexes(beamEls, "active");
      return active.length ? active : null;
    },
    highlighted: (kind = "expected") => activeIndexes(keyEls, kind)
  };
}

function event(id, beat, lane = 14, duration = .25) {
  return { id, beat, duration, lane, minLane: lane, laneSpan: 1, judgeLanes: [lane], notes: [] };
}

test("software rotation uses the same compact preview window as native mobile landscape", () => {
  for (const [rotated, landscape, expected] of [[true,false,true], [false,true,true], [false,false,false]]) {
    const context = {
      document: { documentElement: { classList: { contains: () => rotated } } },
      window: { matchMedia: () => ({ matches: landscape }) },
      boardTop: { clientHeight: 165 }, fallLeadSeconds: 4,
      clamp: (n, min, max) => Math.max(min, Math.min(max, n))
    };
    runInNewContext(compactViewSource, context);
    assert.equal(context.isCompactPracticeView(), expected);
    assert.equal(context.getVisualFallLeadSeconds(), expected ? 165 / 86 : 4);
  }
});

test("mobile birthday opening displays both consecutive G4 notes before the first strike", () => {
  const events = birthday.steps.slice(0, 2).map(([, beat, duration], id) => event(id, beat, 14, duration));
  const board = renderHarness(events);
  board.render(-.5);
  for (const note of board.notes.values()) assert.equal(note.classList.contains("visible"), true);
  assert.notEqual(board.notes.get(0).style.transform, board.notes.get(1).style.transform);
});

test("short mobile boards display all in-window notes rather than a four/five-note cap", () => {
  for (const height of [150, 180]) {
    const board = renderHarness(Array.from({ length: 7 }, (_, id) => event(id, id * .1, id)), { height });
    board.render(0);
    assert.equal([...board.notes.values()].filter(note => note.classList.contains("visible")).length, 7);
  }
});

test("entering mobile notes appear as soon as their bottom crosses the top edge", () => {
  const board = renderHarness([event(0, 0)]);
  board.render(-1.7);
  assert.equal(board.notes.get(0).classList.contains("visible"), true);
  assert.ok(Number(board.notes.get(0).style.transform.match(/-?[\d.]+/)[0]) < 0);
  board.render(-1.85);
  assert.equal(board.notes.get(0).classList.contains("visible"), false);
  board.render(.2);
  assert.equal(board.notes.get(0).classList.contains("visible"), false);
});

test("desktop note dimensions and judgement-line timing remain unchanged", () => {
  const board = renderHarness([event(0, 0, 14, .75)], { compact: false, height: 400, lead: 3 });
  board.render(0);
  const note = board.notes.get(0);
  assert.equal(note.classList.contains("visible"), true);
  assert.equal(note.style.height, "58px");
  assert.equal(note.style.transform, "translateY(332px)");
  assert.equal(note.style.opacity, "1");
});

test("a long notated hold keeps its beam after judgement grace, then clears throughout the internal rest", () => {
  const board = renderHarness([event(0, 0, 3, 2), event(1, 4, 8, 1)], { scaledBeat: 1, duration: 8 });
  board.render(0);
  assert.deepEqual(board.beam(), [3]); assert.deepEqual(board.highlighted(), [3]);
  for (const seconds of [.6, 1, 1.999]) {
    assert.equal(board.context.getJudgementEvent(seconds), null, "hold coverage must extend beyond onset judgement grace");
    board.render(seconds); assert.deepEqual(board.beam(), [3]);
  }
  for (const seconds of [2, 2.1, 3, 3.879, 3.95]) {
    board.render(seconds);
    assert.equal(board.beam(), null, `no beam during the notated rest at ${seconds}s`);
    assert.deepEqual(board.highlighted(), [], `no expected-key highlight during the notated rest at ${seconds}s`);
  }
  board.render(4);
  assert.deepEqual(board.beam(), [8]); assert.deepEqual(board.highlighted(), [8]);
});

for (const [songId, restBeats] of [["fan-fang-xiang-de-zhong", 2], ["gao-bai-qi-qiu", 3], ["ye-de-gang-qin-qu-wu", 3], ["qi-feng-le", 3], ["yun-yan-cheng-yu", 4]]) {
  test(`${songId}: its last held note clears before the ${restBeats} source-ending rest beats and stays clear at song end`, () => {
    const song = SONG_LIBRARY[songId];
    const events = song.steps.slice(-2).map(([name, beat, duration], id) => event(id, beat, NOTE_INDEX.get(name), duration));
    const last = events.at(-1);
    const scaledBeat = 60 / song.bpm;
    const noteEnd = last.beat + last.duration;
    const sourceEnd = song.sourceFeatures.sourceTotalBeats;
    const duration = sourceEnd * scaledBeat + .9;
    assert.equal(sourceEnd - noteEnd, restBeats);
    const board = renderHarness(events, { scaledBeat, duration });
    board.render(last.beat * scaledBeat);
    assert.deepEqual(board.beam(), last.judgeLanes);
    assert.deepEqual(board.highlighted(), last.judgeLanes);
    board.render(noteEnd * scaledBeat - 1e-6);
    assert.deepEqual(board.beam(), last.judgeLanes, "do not cut the final held note short");
    for (const seconds of [noteEnd, noteEnd + .5, noteEnd + 1, noteEnd + 2, sourceEnd].map(beat => beat * scaledBeat).concat([duration, duration + .1])) {
      board.render(seconds);
      assert.equal(board.beam(), null, `stale final-note beam at ${seconds}s`);
      assert.deepEqual(board.highlighted(), [], `stale final-note key highlight at ${seconds}s`);
    }
  });
}

test("loop preparation and internal rests cannot inherit a held beam from notes outside A–B", () => {
  const beforeA = event(0, 3, 2, 3);
  const atA = event(1, 4, 7, .25);
  const inside = event(2, 5, 12, .5);
  const atB = event(3, 6, 17, 1);
  const board = renderHarness([beforeA, atA, inside, atB], {
    scaledBeat: 1, duration: 8, range: { startBeat: 4, endBeat: 6 }
  });
  for (const seconds of [2.5, 3, 3.5]) {
    board.render(seconds); assert.equal(board.beam(), null); assert.deepEqual(board.highlighted(), []);
  }
  board.render(4); assert.deepEqual(board.beam(), [7]); assert.deepEqual(board.highlighted(), [7]);
  for (const seconds of [4.25, 4.3, 4.5]) {
    board.render(seconds); assert.equal(board.beam(), null); assert.deepEqual(board.highlighted(), []);
  }
  board.render(5); assert.deepEqual(board.beam(), [12]);
  board.render(5.499); assert.deepEqual(board.beam(), [12], "the eligible inside-range note remains held");
  for (const seconds of [5.5, 5.9, 6, 6.2]) {
    board.render(seconds); assert.equal(board.beam(), null); assert.deepEqual(board.highlighted(), []);
  }
  board.render(3.5); assert.equal(board.beam(), null, "a restarted positive-time count-in clears the previous pass's beam");
});

test("late grace and explicit judge windows never relight a note after its notated duration", () => {
  for (const judgeWindow of [0, .8]) {
    const short = { ...event(0, 1, 5, .05), judgeWindow };
    const board = renderHarness([short], { scaledBeat: 1, duration: 4 });
    board.render(1); assert.deepEqual(board.beam(), [5]); assert.deepEqual(board.highlighted(), [5]);
    assert.equal(board.context.getJudgementEvent(1.2), short, "the real timing selector must still be inside grace for this regression");
    for (const seconds of [1.05, 1.1, 1.2, 1.359, 1.7, 2]) {
      board.render(seconds);
      assert.equal(board.beam(), null, `judge window ${judgeWindow} must not extend the key beam at ${seconds}s`);
      assert.deepEqual(board.highlighted(), [], `judge window ${judgeWindow} must not extend the expected-key highlight at ${seconds}s`);
    }
  }
});

test("Mixue intro omission clears the one-beat C5 target without inventing a chord attack", () => {
  const song = SONG_LIBRARY["mi-xue-bing-cheng-theme"];
  const events = song.steps.filter(([, beat]) => beat >= 8 && beat <= 10)
    .map(([name, beat, duration], id) => event(id, beat, NOTE_INDEX.get(name), duration));
  assert.equal(events[0].duration, 1);
  const scaledBeat = 60 / song.bpm;
  const board = renderHarness(events, { scaledBeat, duration: 42 * scaledBeat });
  board.render(8.5 * scaledBeat);
  assert.deepEqual(board.beam(), [NOTE_INDEX.get("C5")]);
  for (const beat of [9, 9.25, 9.5, 9.99]) {
    board.render(beat * scaledBeat);
    assert.equal(board.beam(), null, `adaptation gap at ${beat}`);
    assert.deepEqual(board.highlighted(), []);
  }
  board.render(10 * scaledBeat);
  assert.deepEqual(board.beam(), [NOTE_INDEX.get(song.steps.find(([, beat]) => beat === 10)[0])]);
});

test("Ordinary Road source holds end before vocal rests and never keep a key lit through them",()=>{
  const song=SONG_LIBRARY["ping-fan-zhi-lu"];
  const events=song.steps.map(([name,beat,duration],id)=>event(id,beat,NOTE_INDEX.get(name),duration));
  const scaledBeat=60/song.bpm;
  const board=renderHarness(events,{scaledBeat,duration:68*scaledBeat});
  for(const [held,end,next,name] of [[5.9,6,8.5,"E4"],[21.9,22,24.5,"E4"],[29.9,30,30.5,"C4"],[63.9,64,68,"C5"]]){
    board.render(held*scaledBeat);assert.deepEqual(board.beam(),[NOTE_INDEX.get(name)]);
    for(const beat of [end,(end+next)/2,next-.01]){
      board.render(beat*scaledBeat);assert.equal(board.beam(),null);assert.deepEqual(board.highlighted(),[]);
    }
  }
});

test("Summer source ties remain held but its five melody rests have no active target",()=>{
  const song=SONG_LIBRARY["ju-ci-lang-de-xia-tian"];
  const events=song.steps.map(([name,beat,duration],id)=>event(id,beat,NOTE_INDEX.get(name),duration));
  const scaledBeat=60/96/.4;
  const board=renderHarness(events,{scaledBeat,duration:32*scaledBeat});
  for(const [from,to] of [[0,1],[4,5],[12,13],[21,21.5],[25,25.5]]){
    for(const beat of [from,(from+to)/2,to-.001]){
      board.render(beat*scaledBeat);assert.equal(board.beam(),null);assert.deepEqual(board.highlighted(),[]);
    }
  }
  for(const [beat,name] of [[3.9,"C5"],[7.25,"D5"],[11.9,"C5"],[19.49,"G5"],[23.49,"G5"],[27.49,"E5"],[31.99,"D5"]]){
    board.render(beat*scaledBeat);assert.deepEqual(board.beam(),[NOTE_INDEX.get(name)]);
  }
  board.render(32*scaledBeat);assert.equal(board.beam(),null);assert.deepEqual(board.highlighted(),[]);
});

test("Daylily holds finish naturally before all twenty lyric-voice rests clear the target",()=>{
  const song=SONG_LIBRARY["xuan-cao-hua"];
  const events=song.steps.map(([name,beat,duration],id)=>event(id,beat,NOTE_INDEX.get(name),duration));
  const scaledBeat=60/84/.55;const board=renderHarness(events,{scaledBeat,duration:192*scaledBeat});
  const starts=[14,17,35,38,47,53,59,71,77,83,110,113,131,134,143,158,161,179,182,191];
  for(const from of starts){
    const held=song.steps.find(([,beat,duration])=>beat+duration===from);assert.ok(held);
    board.render((from-.15)*scaledBeat);assert.deepEqual(board.beam(),[NOTE_INDEX.get(held[0])]);
    for(const beat of [from,from+.5,from+.999]){
      // Use the runtime's onset-plus-duration arithmetic at the exact boundary:
      // 13*s + 1*s can differ from 14*s by one floating-point unit.
      const seconds = beat === from ? held[1]*scaledBeat+held[2]*scaledBeat : beat*scaledBeat;
      board.render(seconds);assert.equal(board.beam(),null, `Daylily rest ${from} at ${beat}`);assert.deepEqual(board.highlighted(),[]);
    }
  }
  board.render(192*scaledBeat);assert.equal(board.beam(),null);assert.deepEqual(board.highlighted(),[]);
});

test("Farewell teaching edition clears all six two-beat rests without shortening preceding notes",()=>{
  const song=SONG_LIBRARY["song-bie"];
  const events=song.steps.map(([name,beat,duration],id)=>event(id,beat,NOTE_INDEX.get(name),duration));
  const scaledBeat=60/70/.55;const board=renderHarness(events,{scaledBeat,duration:96*scaledBeat});
  for(const from of [14,30,46,62,78,94]){
    const held=song.steps.find(([,beat,duration])=>beat+duration===from);assert.ok(held);
    board.render((from-.15)*scaledBeat);assert.deepEqual(board.beam(),[NOTE_INDEX.get(held[0])]);
    for(const beat of [from,from+1,from+1.999]){
      const seconds=beat===from?held[1]*scaledBeat+held[2]*scaledBeat:beat*scaledBeat;
      board.render(seconds);assert.equal(board.beam(),null,`Farewell rest ${from} at ${beat}`);assert.deepEqual(board.highlighted(),[]);
    }
  }
  board.render(96*scaledBeat);assert.equal(board.beam(),null);assert.deepEqual(board.highlighted(),[]);
});
