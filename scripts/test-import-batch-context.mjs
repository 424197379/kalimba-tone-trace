import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  CURRENT_SONG_STORAGE_KEY, CUSTOM_SONGS_STORAGE_KEY, getCustomSongs,
  parseImportedSongs, saveCustomSongs
} from "../src/song-store.js";

const event = (name = "C4", beat = 0, duration = 1) => ({
  beat, duration, notes: [{ name, role: "melody", judge: true }]
});
const score = (extra = {}) => ({
  id: "batch-context", title: "批量测试", schemaVersion: 2,
  events: [event()], ...extra
});
const backing = () => ({
  enabledByDefault: false, volume: 0.3,
  events: [{ beat: 0, duration: 0.5, notes: [{ name: "G3", role: "bass", velocity: 0.32 }] }]
});
const parse = value => parseImportedSongs(JSON.stringify(value), {});
const errorFor = value => {
  let thrown;
  assert.throws(() => parse(value), error => { thrown = error; return true; });
  return thrown;
};
const containers = [songs => songs, songs => ({ songs })];
const invalidPitch = extra => score({ events: [event("C#4")], ...extra });
const librarySource = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const importHandler = librarySource.match(/^async function importSongFromJson\(\) \{[^]*?^\}/m)?.[0];
const messageHandler = librarySource.match(/^function showImportMessage\([^]*?^\}/m)?.[0];
assert.ok(importHandler, "exercise the actual import click handler");
assert.ok(messageHandler, "exercise the actual error message renderer");

test("arrays and songs wrappers identify first, second and last failing input songs", () => {
  const bad = invalidPitch({ title: "需要核对的歌曲" });
  const reason = errorFor(bad).message;
  for (const wrap of containers) {
    for (let index = 0; index < 3; index += 1) {
      const inputs = [score({ id: "first" }), score({ id: "second" }), score({ id: "last" })];
      inputs[index] = bad;
      const error = errorFor(wrap(inputs));
      assert.equal(error.message, `第 ${index + 1} 首歌曲「需要核对的歌曲」：${reason}`);
      assert.equal(error.cause.message, reason);
      assert.match(error.message, /events 第 1 项 第 1 个音/);
      assert.match(error.message, /C#4/);
      assert.match(error.message, /不能删除或替换升降音，请核对谱源及整体转调方案/);
    }
  }
});

test("song positions count source entries rather than generated melody and arrangement versions", () => {
  const first = score({ title: "有伴奏的第一首", autoAccompaniment: backing() });
  assert.equal(parse(first).length, 2);
  for (const wrap of containers) {
    const error = errorFor(wrap([first, score({ id: "second" }), invalidPitch({ title: "第三首" })]));
    assert.match(error.message, /^第 3 首歌曲「第三首」：events/);
  }
});

test("all existing per-song validation reasons survive unchanged after the batch prefix", () => {
  const cases = [
    invalidPitch(),
    score({ key: "D" }),
    score({ schemaVersion: 3 }),
    score({ bpm: "96" }),
    score({ beatsPerMeasure: 3.5 }),
    score({ events: [event("C4", -1)] }),
    score({ events: [{ ...event(), notes: [{ name: "C4", role: "bass", judge: false }] }] }),
    score({ events: [event(), event("D4")] }),
    score({ autoAccompaniment: { events: [event()] } }),
    score({ sourceFeatures: { sourceTotalBeats: 0.5 } }),
    score({ rhythm: { restWindows: [{ beat: 0, duration: 1, policy: "silent" }] } }),
    { title: "旧 steps", schemaVersion: 1, steps: [["C#4", 0, 1]] },
    { title: "旧 notation", notation: [{ degree: 1, beat: 0, duration: 0 }] },
    score({ practiceAccompaniment: null }),
    score({ practiceAccompaniment: {}, autoAccompaniment: backing() }),
    null, false, "not a song", []
  ];
  for (const bad of cases) {
    const reason = errorFor([bad]).message;
    for (const wrap of containers) {
      const error = errorFor(wrap([score(), bad]));
      assert.match(error.message, /^第 2 首歌曲/);
      assert.equal(error.message.slice(error.message.indexOf("：") + 1), reason);
      assert.equal(error.cause.message, reason);
    }
  }
});

test("multiple invalid songs report the first failing source entry without skipping it", () => {
  for (const wrap of containers) {
    const error = errorFor(wrap([
      score(), invalidPitch({ title: "先修复这一首" }), score({ title: "后面的错误", schemaVersion: 99 })
    ]));
    assert.equal(error.message, `第 2 首歌曲「先修复这一首」：${errorFor(invalidPitch()).message}`);
    assert.ok(!error.message.includes("后面的错误"));
  }
});

test("missing, malformed and invisible titles never replace the original error", () => {
  for (const title of [undefined, null, false, 42, {}, [], ["fake"], { toString: null }, "", " \n\t\u202e\u2066\0 "]) {
    const bad = invalidPitch({ title });
    const reason = errorFor(bad).message;
    for (const wrap of containers) {
      const error = errorFor(wrap([score(), bad]));
      assert.equal(error.message, `第 2 首歌曲：${reason}`);
      assert.equal(error.cause.message, reason);
      assert.ok(!error.message.includes("[object Object]"));
    }
  }
});

test("title context is display-only, single-line and bounded, without splitting astral characters", () => {
  const reason = errorFor(invalidPitch()).message;
  const cases = [
    [" \t第一行\r\n第二行\u2028第三行\u2029 \u0000\u0085\u061c\u200e\u202e\u2066尾\u2069 ", "第一行 第二行 第三行 尾"],
    ["曲".repeat(40), "曲".repeat(40)],
    ["曲".repeat(41), `${"曲".repeat(40)}…`],
    ["🎵".repeat(40), "🎵".repeat(40)],
    ["🎵".repeat(50_000), `${"🎵".repeat(40)}…`],
    ["长".repeat(50_000) + "\nignored tail", `${"长".repeat(40)}…`]
  ];
  for (const [title, label] of cases) {
    const input = invalidPitch({ title });
    const before = JSON.stringify(input);
    const error = errorFor([score(), input]);
    assert.equal(error.message, `第 2 首歌曲「${label}」：${reason}`);
    assert.equal(error.cause.message, reason);
    assert.ok(error.message.length - reason.length <= 96, "title cannot bury the actionable reason");
    assert.doesNotMatch(error.message, /[\r\n\u0000\u0085\u061c\u200e\u2028\u2029\u202e\u2066\u2069]/u);
    assert.equal(JSON.stringify(input), before, "display sanitization never edits the source title");
  }
});

test("markup-looking titles are delivered only as text through the real message renderer", () => {
  const title = '<img src=x onerror="alert(1)">';
  const message = errorFor([score(), invalidPitch({ title })]).message;
  let displayed;
  const importMessage = {
    set textContent(value) { displayed = value; },
    set innerHTML(value) { assert.fail(`error content must never become HTML: ${value}`); },
    hidden: true
  };
  const context = { importMessage };
  runInNewContext(messageHandler, context);
  context.showImportMessage(message, "error");
  assert.equal(displayed, message);
  assert.ok(displayed.includes(title));
  assert.equal(importMessage.className, "import-message error");
  assert.equal(importMessage.hidden, false);
});

test("single-song objects and singleton containers preserve their original error messages", () => {
  for (const bad of [invalidPitch(), score({ practiceAccompaniment: null }), null, false]) {
    const original = errorFor(bad);
    for (const value of [bad, [bad], { songs: [bad] }]) {
      const error = errorFor(value);
      assert.equal(error.message, original.message);
      assert.equal(error.cause, undefined);
      assert.doesNotMatch(error.message, /^第 \d+ 首歌曲/);
    }
  }
});

test("reserved wrapper fields still reject before per-song validation, without misleading song context", () => {
  const reason = errorFor(score({ practiceAccompaniment: null })).message;
  for (const practiceAccompaniment of [null, false, 0, "", [], {}, backing()]) {
    const error = errorFor({
      title: "包装器不是歌曲", songs: [invalidPitch(), score()], practiceAccompaniment
    });
    assert.equal(error.message, reason);
    assert.equal(error.cause, undefined);
    assert.match(error.message, /不会自动合并、改名或选层/);
    assert.match(error.message, /不要仅删除字段而丢失伴奏/);
  }
});

test("JSON and empty-container failures keep their established root-level messages", () => {
  assert.throws(() => parseImportedSongs("{ invalid", {}), { message: "粘贴内容不是合法 JSON" });
  for (const value of [[], { songs: [] }]) {
    assert.equal(errorFor(value).message, "导入内容没有歌曲 JSON");
  }
});

test("valid V1, notation and V2 batches preserve exact notes, rests, source data and arrangement generation", () => {
  const inputs = [
    { id: "legacy-steps", title: "旧 V1", schemaVersion: 1, steps: [["C4", 0, 1], ["C4", 2, 1]] },
    { id: "legacy-notation", title: "旧 notation", notation: [
      { degree: 1, beat: 0, duration: 1 }, { degree: 0, beat: 1, duration: 1 }, { degree: 2, beat: 2, duration: 1 }
    ] },
    score({ id: "modern", title: "V2", events: [event("C4", 0, 1 / 3), event("C4", 1 / 3, 1 / 3), event("D4", 2 / 3, 1 / 3)],
      autoAccompaniment: backing(), sourceFeatures: { sourceTotalBeats: 2, practiceAccompaniment: { note: "metadata only" } },
      rhythm: { restWindows: [{ beat: 1, duration: 1, policy: "silent" }] }
    })
  ];
  const expected = inputs.flatMap(parse);
  assert.equal(expected.length, 4);
  for (const wrap of containers) {
    const value = wrap(inputs);
    const before = JSON.stringify(value);
    assert.deepEqual(parse(value), expected);
    assert.equal(JSON.stringify(value), before);
  }
  assert.deepEqual(expected[0].steps, inputs[0].steps);
  assert.deepEqual(expected[1].steps, [["C4", 0, 1], ["D4", 2, 1]]);
  assert.deepEqual(expected[2].steps, [["C4", 0, 1 / 3], ["C4", 1 / 3, 1 / 3], ["D4", 2 / 3, 1 / 3]]);
  assert.deepEqual(expected[3].autoAccompaniment, inputs[2].autoAccompaniment);
});

test("diagnostic title handling introduces no new validation or normalization of valid titles", () => {
  for (const title of [undefined, null, false, 42, {}, [], ["legacy"], " \n long title \n ", "曲".repeat(100)]) {
    const input = score({ id: "title-compatibility", title });
    const single = parse(input);
    for (const wrap of containers) {
      assert.deepEqual(parse(wrap([score({ id: "other" }), input])).slice(1), single);
    }
  }
});

function useMemoryStorage(t, entries) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map(entries);
  const writes = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { writes.push([key, value]); records.set(key, String(value)); }
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
  return { records, writes };
}

test("real failed import handler preserves input, storage, selection and filters for every batch position", async t => {
  const [saved] = parse(score({ id: "already-saved" }));
  const legacy = { ...saved, id: "legacy-backing", practiceAccompaniment: backing(), autoAccompaniment: backing() };
  const stored = JSON.stringify([saved, legacy, { id: "future", schemaVersion: 99, untouched: true }]);
  const { records, writes } = useMemoryStorage(t, [
    [CUSTOM_SONGS_STORAGE_KEY, stored], [CURRENT_SONG_STORAGE_KEY, saved.id],
    ["kalimba-test-preferences", "unchanged"]
  ]);
  const existingLibrary = { [saved.id]: saved };
  const originalLibrary = structuredClone(existingLibrary);
  const originalStorage = [...records];
  const initialCustomSongs = getCustomSongs();
  assert.ok(initialCustomSongs.find(song => song.id === legacy.id)?.practiceAccompaniment);
  const payloads = [];
  for (const wrap of containers) {
    for (let index = 0; index < 3; index += 1) {
      const entries = [score({ autoAccompaniment: backing() }), score(), score()];
      entries[index] = invalidPitch({ title: `失败歌曲 ${index + 1}` });
      payloads.push(wrap(entries));
    }
    payloads.push(wrap([score(), invalidPitch({ title: { toString: null } })]));
    payloads.push(wrap([score(), score({ practiceAccompaniment: null })]));
  }
  payloads.push({ songs: [score(), invalidPitch()], practiceAccompaniment: null });
  for (const payload of payloads) {
    const raw = `\n ${JSON.stringify(payload, null, 2)} \n`;
    const busy = [], messages = [];
    const context = {
      // Isolate rejected-input transactions after history restoration has settled.
      pendingImportDraftRestore: null,
      importingSong: false, deletingSong: false, performance: { now: () => 0 }, songLibrary: existingLibrary,
      songJsonInput: { value: raw }, songSearchInput: { value: "existing-search" }, activeDifficulty: "easy",
      parseImportedSongs, saveCustomSongs, withCustomSongWriteLock: async write => write(),
      getSongLibrary() { assert.fail("failed import must not refresh the library"); },
      storeSongId() { assert.fail("failed import must not change selection"); },
      rememberLibrarySelection() { assert.fail("failed import must not change selection"); },
      refreshLibraryViews() { assert.fail("failed import must not replace cards"); },
      waitForPaint: async () => {}, waitForThinkingMinimum: async () => {},
      setImportBusy: value => busy.push(value), showImportMessage: (message, kind) => messages.push({ message, kind })
    };
    runInNewContext(importHandler, context);
    await context.importSongFromJson();
    assert.deepEqual(busy, [true, false]);
    assert.deepEqual(messages, [{ message: errorFor(payload).message, kind: "error" }]);
    assert.equal(context.songJsonInput.value, raw, "keep exact pasted input, including surrounding whitespace");
    assert.equal(context.songSearchInput.value, "existing-search");
    assert.equal(context.activeDifficulty, "easy");
    assert.deepEqual(existingLibrary, originalLibrary);
    assert.deepEqual([...records], originalStorage);
    assert.deepEqual(getCustomSongs(), initialCustomSongs, "historical supported reads stay unchanged");
    assert.deepEqual(writes, [], "no partial prefix save or preference/storage update");
  }
});
