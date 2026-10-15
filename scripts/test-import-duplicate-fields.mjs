import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  AI_SONG_PROMPT, CURRENT_SONG_STORAGE_KEY, CUSTOM_SONGS_STORAGE_KEY, getCustomSongs,
  parseImportedSongs, saveCustomSongs
} from "../src/song-store.js";

// Keep duplicate fixtures as raw text. JSON.stringify(object) would silently
// erase precisely the ambiguity these regressions must exercise.
const note = String.raw`{"name":"C4","role":"melody","judge":true}`;
const event = `{"beat":0,"duration":1,"notes":[${note}]}`;
const laterEvent = event.replace('"beat":0', '"beat":2').replace('"C4"', '"D4"');
const backing = String.raw`{"enabledByDefault":false,"volume":0.3,"events":[{"beat":0,"duration":0.5,"notes":[{"name":"G3","role":"bass","velocity":0.32}]}]}`;
const score = (extra = "") => `{"id":"duplicate-fields","title":"完整原稿","schemaVersion":2,"events":[${event}]${extra ? `,${extra}` : ""}}`;
const parse = raw => parseImportedSongs(raw, {});
const errorFor = raw => {
  let thrown;
  assert.throws(() => parse(raw), error => { thrown = error; return true; });
  return thrown;
};
const unsafeDisplay = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u206f\ufeff]/u;
const assertDuplicate = (raw, path) => {
  assert.doesNotThrow(() => JSON.parse(raw), "a duplicate-key fixture must still be syntactically valid JSON");
  const error = errorFor(raw);
  assert.match(error.message, /字段.*重复/);
  assert.match(error.message, /首次第.*行第.*列/);
  assert.match(error.message, /重复第.*行第.*列/);
  if (path) assert.ok(error.message.includes(path), `diagnostic must identify ${path}: ${error.message}`);
  assert.doesNotMatch(error.message, unsafeDisplay, "diagnostic must be safe single-line text");
  assert.ok(error.message.length <= 1000, "untrusted keys and paths cannot bury the useful diagnostic");
  return error;
};

const duplicateCases = [
  ["events cannot discard an earlier illegal pitch", score(`"events":[${event}]`).replace('"C4"', '"C#4"'), "$.events"],
  ["events cannot discard a legitimate earlier melody", score(`"events":[${laterEvent}]`), "$.events"],
  ["notes cannot discard an earlier illegal pitch", score().replace(`"notes":[${note}]`, `"notes":[${note.replace("C4", "C#4")}],"notes":[${note}]`), "$.events[0].notes"],
  ["name cannot hide an unsupported pitch", score().replace('"name":"C4"', '"name":"C#4","name":"C4"'), "$.events[0].notes[0].name"],
  ["name cannot hide a different supported pitch", score().replace('"name":"C4"', '"name":"D4","name":"C4"'), "$.events[0].notes[0].name"],
  ["beat cannot overwrite invalid timing", score().replace('"beat":0', '"beat":-1,"beat":0'), "$.events[0].beat"],
  ["duration cannot overwrite invalid timing", score().replace('"duration":1', '"duration":0,"duration":1'), "$.events[0].duration"],
  ["role cannot overwrite an ambiguous voice", score().replace('"role":"melody"', '"role":"bass","role":"melody"'), "$.events[0].notes[0].role"],
  ["judge cannot overwrite a different target", score().replace('"judge":true', '"judge":false,"judge":true'), "$.events[0].notes[0].judge"],
  ["identical scalar values are still ambiguous", score('"bpm":96,"bpm":96'), "$.bpm"],
  ["identical arrays are still ambiguous", score(`"events":[${event}]`), "$.events"],
  ["titles cannot overwrite source identity", score('"title":"另一份谱"'), "$.title"],
  ["autoAccompaniment cannot discard another arrangement", score(`"autoAccompaniment":${backing.replace("G3", "C#4")},"autoAccompaniment":${backing}`), "$.autoAccompaniment"],
  ["backing events are checked recursively", score(`"autoAccompaniment":${backing.replace('"events":', '"events":[],"events":')}`), "$.autoAccompaniment.events"],
  ["backing note names are checked recursively", score(`"autoAccompaniment":${backing.replace('"name":"G3"', '"name":"C#4","name":"G3"')}`), "$.autoAccompaniment.events[0].notes[0].name"],
  ["backing volume cannot be overwritten", score(`"autoAccompaniment":${backing.replace('"volume":0.3', '"volume":0.9,"volume":0.3')}`), "$.autoAccompaniment.volume"],
  ["rest windows cannot discard a conflicting window", score('"sourceFeatures":{"sourceTotalBeats":3},"rhythm":{"restWindows":[{"beat":0,"duration":1}],"restWindows":[{"beat":1,"duration":2,"policy":"silent"}]}'), "$.rhythm.restWindows"],
  ["rest-window timing is checked recursively", score('"sourceFeatures":{"sourceTotalBeats":3},"rhythm":{"restWindows":[{"beat":0,"beat":1,"duration":2,"policy":"silent"}]}'), "$.rhythm.restWindows[0].beat"],
  ["rest-window policy cannot be overwritten", score('"sourceFeatures":{"sourceTotalBeats":3},"rhythm":{"restWindows":[{"beat":1,"duration":2,"policy":"hold","policy":"silent"}]}'), "$.rhythm.restWindows[0].policy"],
  ["source total cannot silently change scope", score('"sourceFeatures":{"sourceTotalBeats":0.5,"sourceTotalBeats":3}'), "$.sourceFeatures.sourceTotalBeats"],
  ["source labels cannot silently change evidence", score('"sourceFeatures":{"sources":[{"label":"版本甲","label":"版本乙"}]}'), "$.sourceFeatures.sources[0].label"],
  ["ignored unknown metadata is checked", score('"futureMetadata":{"candidate":null,"candidate":false}'), "$.futureMetadata.candidate"],
  ["duplicate metadata nested in arrays is checked", score('"futureMetadata":[null,[{"review":{"status":"inferred","status":"verified"}}]]'), "$.futureMetadata[1][0].review.status"],
  ["prototype-looking own keys are checked", score('"futureMetadata":{"__proto__":null,"__proto__":{}}'), "$.futureMetadata.__proto__"],
  ["Object prototype names do not confuse ownership", score('"futureMetadata":{"constructor":1,"constructor":1}'), "$.futureMetadata.constructor"],
  ["legacy steps cannot discard unsupported pitches", String.raw`{"schemaVersion":1,"steps":[["C#4",0,1]],"steps":[["C4",0,1]]}`, "$.steps"],
  ["legacy notation timing cannot be overwritten", String.raw`{"notation":[{"degree":1,"beat":0,"duration":0,"duration":1}]}`, "$.notation[0].duration"],
  ["root songs cannot discard earlier source songs", `{"songs":[${score().replace("C4", "C#4")}],"songs":[${score()}]}`, "$.songs"],
  ["wrapper metadata is checked before unwrapping", `{"songs":[${score()}],"metadata":{"source":"A","source":"B"}}`, "$.metadata.source"]
];

for (const [label, raw, path] of duplicateCases) {
  test(label, () => assertDuplicate(raw, path));
}

test("decoded escape-equivalent keys collide, including surrogate pairs and slash escapes", () => {
  const cases = [
    [String.raw`"n\u0061me":"C#4","name":"C4"`, "name"],
    [String.raw`"name":"C#4","\u006eame":"C4"`, "name"],
    [String.raw`"\u006Eame":"C#4","n\u0061me":"C4"`, "name"],
    [String.raw`"\ud83c\udfb5":1,"🎵":2`],
    [String.raw`"a\/b":1,"a/b":2`],
    [String.raw`"a\u005cb":1,"a\\b":2`],
    [String.raw`"a\u0022b":1,"a\"b":2`],
    [String.raw`"\u0000":1,"\u0000":2`],
    [String.raw`"\ud800":1,"\ud800":2`],
    [String.raw`"":1,"":2`]
  ];
  for (const [members, key] of cases) {
    assertDuplicate(score(`"futureMetadata":{${members}}`), key ? `$.futureMetadata.${key}` : "$.futureMetadata");
  }
});

test("syntax errors retain the existing message even when duplicate keys occur earlier", () => {
  const cases = [
    "", " ", "{ invalid", '{"a":1,"a":2,}', '{"a":1,"a":2} trailing',
    '{"a":1,"a":2,"unterminated":"', '{"a":1,"a":2,"bad":01}',
    String.raw`{"a":1,"a":2,"bad":"\uZZZZ"}`, '{"a":1,"a":2,"bad":NaN}',
    '{"a":1,"a":2,"bad":Infinity}', '{"a":1,"a":2,"bad":undefined}',
    '{"a":1,"a":2,"bad":/* comment */null}', '{"a":1,"a":2,"bad":1/3}',
    '{"a":1,"a":2,"bad":"literal\nnewline"}', '\uFEFF{"a":1,"a":2}'
  ];
  for (const raw of cases) assert.equal(errorFor(raw).message, "粘贴内容不是合法 JSON", raw);
});

test("duplicates are rejected before schema validation, reserved backing checks and empty unwrapping", () => {
  for (const raw of [
    '{"schemaVersion":99,"unknown":{"x":1,"x":2}}',
    '{"practiceAccompaniment":null,"unknown":{"x":1,"x":2}}',
    '{"songs":[],"unknown":{"x":1,"x":2}}',
    '[null,{"unknown":{"x":1,"x":2}}]',
    `{"songs":[null,${score()}],"unknown":{"x":1,"x":2}}`
  ]) assertDuplicate(raw, raw.startsWith("[") ? "$[1].unknown.x" : "$.unknown.x");
});

test("report the first duplicate in original lexical order without selecting a surviving value", () => {
  const raw = score('"metadata":{"first":{"value":1,"value":2},"last":1,"last":2},"bpm":96,"bpm":100');
  const error = assertDuplicate(raw, "$.metadata.first.value");
  assert.ok(!error.message.includes("$.metadata.last"));
  assert.ok(!error.message.includes("$.bpm"));
});

function position(raw, offset) {
  const lines = raw.slice(0, offset).split(/\r\n|\r|\n/u);
  return { line: lines.length, column: Array.from(lines.at(-1)).length + 1 };
}

function assertLocations(raw, firstToken, repeatedToken) {
  const firstOffset = raw.indexOf(firstToken);
  const repeatedOffset = raw.indexOf(repeatedToken, firstOffset + firstToken.length);
  assert.ok(firstOffset >= 0 && repeatedOffset > firstOffset);
  const first = position(raw, firstOffset), repeated = position(raw, repeatedOffset);
  const error = assertDuplicate(raw);
  assert.match(error.message, new RegExp(`首次第\\s*${first.line}\\s*行第\\s*${first.column}\\s*列`));
  assert.match(error.message, new RegExp(`重复第\\s*${repeated.line}\\s*行第\\s*${repeated.column}\\s*列`));
}

test("coordinates refer to original opening quotes, including surrounding whitespace and escaped spelling", () => {
  const raw = '\n  {\n    "futureMetadata": {\n      "name": 1,\n\t  "n\\u0061me": 2\n    }\n  }\n';
  assertLocations(raw, '"name"', '"n\\u0061me"');
  assertLocations(raw.replaceAll("\n", "\r\n"), '"name"', '"n\\u0061me"');
  assertLocations(raw.replaceAll("\n", "\r"), '"name"', '"n\\u0061me"');
  assertLocations('  { "same": { "same": 0 }, "same": 2 }  ', '"same"', '"same": 2');
});

test("columns count Unicode code points and escaped newline text does not invent source lines", () => {
  const raw = '\r\n{"🎵":"🎼\\n中文\\r\\n", "name":1, "n\\u0061me":2}\n';
  assertLocations(raw, '"name"', '"n\\u0061me"');
  const actualNewline = '{"lead":"🎵"}\n';
  const fixture = `[${actualNewline}, {"name":1,\r\n\t"name":2}]`;
  assertLocations(fixture, '"name"', '"name"');
});

test("nonidentifier path keys are quoted so field names cannot masquerade as path structure", () => {
  for (const [members, path] of [
    ['"0":{"x":1,"x":2}', '$.futureMetadata["0"].x'],
    ['"a.b[0]":{"x":1,"x":2}', '$.futureMetadata["a.b[0]"].x'],
    [String.raw`"a\"b":{"x":1,"x":2}`, String.raw`$.futureMetadata["a\"b"].x`],
    ['"":{"x":1,"x":2}', '$.futureMetadata[""].x']
  ]) assertDuplicate(score(`"futureMetadata":{${members}}`), path);
});

test("nested songs metadata and non-array songs fields do not invent an input-song prefix", () => {
  for (const raw of [
    score('"futureMetadata":{"songs":[{"x":1,"x":2}]}'),
    '{"songs":{"0":{"x":1,"x":2}}}',
    `{"songs":[${score()}],"metadata":{"x":1,"x":2}}`,
    `{"songs":[${score()}],"songs":[${score()}]}`
  ]) assert.doesNotMatch(assertDuplicate(raw).message, /^第\s*\d+\s*首歌曲/u);
});

test("array and songs-wrapper paths retain original input indices despite arrangement expansion", () => {
  for (const wrapper of [songs => `[${songs.join(",")}]`, songs => `{"songs":[${songs.join(",")}]}`]) {
    for (let index = 0; index < 3; index += 1) {
      const inputs = [score(`"autoAccompaniment":${backing}`), score(), score()];
      inputs[index] = score().replace('"name":"C4"', '"name":"C#4","name":"C4"');
      const raw = wrapper(inputs);
      const path = `${raw.startsWith("[") ? "$" : "$.songs"}[${index}].events[0].notes[0].name`;
      const error = assertDuplicate(raw, path);
      const prefix = error.message.match(/^第\s*(\d+)\s*首歌曲/u);
      if (prefix) assert.equal(Number(prefix[1]), index + 1, "optional song label counts input songs, not generated versions");
    }
  }
});

test("identical keys in separate objects are valid and keep every original note and rest", () => {
  const raw = `{"id":"separate-objects","schemaVersion":2,"events":[${event},${laterEvent}],"sourceFeatures":{"sourceTotalBeats":4,"sources":[{"label":"甲","url":"https://example.com/a"},{"label":"乙","url":"https://example.com/b"}]},"rhythm":{"restWindows":[{"beat":1,"duration":1,"policy":"silent"},{"beat":3,"duration":1,"policy":"silent"}]},"futureMetadata":{"left":{"same":1},"right":{"same":2}}}`;
  const [song] = parse(raw);
  assert.deepEqual(song.steps, [["C4", 0, 1], ["D4", 2, 1]]);
  assert.deepEqual(song.rhythm.restWindows, JSON.parse(raw).rhythm.restWindows);
  assert.deepEqual(song.sourceFeatures, JSON.parse(raw).sourceFeatures);
});

test("valid V1, notation, V2 and supported backing remain compatible across import containers", () => {
  const inputs = [
    String.raw`{"id":"legacy-steps","schemaVersion":1,"steps":[["C4",0,1],["C4",2,1]]}`,
    String.raw`{"id":"legacy-notation","notation":[{"degree":1,"beat":0,"duration":1},{"degree":0,"beat":1,"duration":1},{"degree":2,"beat":2,"duration":1}]}`,
    score(`"autoAccompaniment":${backing},"sourceFeatures":{"sourceTotalBeats":3,"practiceAccompaniment":{"note":"metadata only"}},"rhythm":{"restWindows":[{"beat":1,"duration":2,"policy":"silent"}]}`)
  ];
  const expected = inputs.flatMap(parse);
  assert.equal(expected.length, 4);
  assert.deepEqual(expected[0].steps, [["C4", 0, 1], ["C4", 2, 1]]);
  assert.deepEqual(expected[1].steps, [["C4", 0, 1], ["D4", 2, 1]]);
  assert.deepEqual(expected[3].autoAccompaniment, JSON.parse(backing));
  for (const raw of [`[${inputs.join(",")}]`, `{"songs":[${inputs.join(",")}]}`]) assert.deepEqual(parse(raw), expected);
});

test("keys are compared as decoded strings without Unicode normalization or case-folding", () => {
  const metadata = String.raw`{"name":1,"Name":2,"é":3,"e\u0301":4,"a/b":5,"a\\/b":6,"__proto__":7,"constructor":8,"toString":9,"":10,"0":11,"00":12,"🎵":13,"\ud800":14,"\ud801":15}`;
  const [song] = parse(score(`"sourceFeatures":${metadata}`));
  assert.deepEqual(song.sourceFeatures, JSON.parse(metadata));
  assert.equal(Object.hasOwn(song.sourceFeatures, "__proto__"), true);
  assert.equal(Object.getPrototypeOf(song.sourceFeatures), Object.prototype);
});

test("a single escaped spelling of a supported key is valid and keeps ordinary import meaning", () => {
  const raw = score().replace('"schemaVersion"', String.raw`"schem\u0061Version"`)
    .replace('"events"', String.raw`"ev\u0065nts"`)
    .replace('"name"', String.raw`"n\u0061me"`);
  assert.deepEqual(parse(raw), parse(score()));
  assert.deepEqual(parse(`{"so\\u006egs":[${raw}]}`), parse(score()));
});

test("fake keys, braces, commas and escapes inside strings never become JSON tokens", () => {
  const source = String.raw`{"text":"{\"name\":\"C#4\",\"name\":\"C4\"}, [ ] : , ","quoted":"\\\"name\\\":\\\"value\\\"","escaped":"\" \\ \/ \b \f \n \r \t \u0022 \u005c","unicode":"🎵 中文 \u2028 \u2029","empty":""}`;
  const [song] = parse(score(`"sourceFeatures":${source}`));
  assert.deepEqual(song.sourceFeatures, JSON.parse(source));
});

test("valid primitive lexical forms and empty containers in unknown metadata do not disturb scanning", () => {
  const metadata = String.raw`{"null":null,"true":true,"false":false,"zero":0,"negativeZero":-0,"negative":-3,"fraction":0.125,"small":1e-8,"large":2E+8,"overflow":1e400,"underflow":1e-400,"array":[],"object":{},"mixed":[null,true,false,-0,1.25e+2,"end",{},[]]}`;
  const [song] = parse(score(`"sourceFeatures":${metadata}`));
  assert.deepEqual(song.sourceFeatures, JSON.parse(metadata));
  assert.equal(song.sourceFeatures.overflow, Infinity, "the lexical scanner must not add validation of ignored metadata numbers");
});

test("non-song root primitives keep their existing schema failures rather than fake duplicate errors", () => {
  for (const raw of ["null", "true", "false", "0", "-0", "12.5e+2", '"text"', String.raw`"{\"name\":1,\"name\":2}"`]) {
    assert.equal(errorFor(raw).message, "导入内容必须是歌曲 JSON 对象");
  }
  for (const raw of ["[]", '{"songs":[]}']) assert.equal(errorFor(raw).message, "导入内容没有歌曲 JSON");
});

test("long, invisible and markup-looking duplicate keys produce bounded plain-text diagnostics", () => {
  const keys = [
    'line\nnext\t\u0000\u0085\u061c\u200c\u200d\u200e\u202e\u2066tail\u2069\ufeff',
    '<img src=x onerror="alert(1)">', "长".repeat(50_000), "🎵".repeat(50_000),
    'a.b[0]["quoted"]', ""
  ];
  for (const key of keys) {
    const token = JSON.stringify(key);
    assertDuplicate(score(`"futureMetadata":{${token}:1,${token}:2}`), "$.futureMetadata");
  }
});

test("deep metadata scanning stays iterative for both valid and duplicate-bearing containers", () => {
  const depth = 12_000;
  for (const [open, close] of [["[", "]"], ['{"next":', "}"]]) {
    const surround = center => open.repeat(depth) + center + close.repeat(depth);
    assert.deepEqual(parse(score(`"futureMetadata":${surround("null")}`))[0].steps, [["C4", 0, 1]]);
    const raw = score(`"futureMetadata":${surround('{"deep":1,"deep":2}')}`);
    const error = assertDuplicate(raw);
    assert.ok(error.message.includes("deep"), "deep paths must retain the actual conflicting field");
    assertLocations(raw, '"deep"', '"deep"');
  }
});

test("copied prompt and compiler guidance preserve both drafts rather than inventing a duplicate-key fix", async () => {
  for (const wording of [
    "每个字段名只能出现一次", "转义写法解码后同名也算重复", "即使值相同或只是来源元数据",
    "不同音符、事件或歌曲各自的对象使用同名字段是合法的", "保留完整原稿",
    "不能擅自取最后一份、自动合并或直接删除", "它不会替你判定哪份音乐正确"
  ]) assert.ok(AI_SONG_PROMPT.includes(wording), wording);
  const skill = await readFile(new URL("../skills/kalimba-tone-trace-compiler/SKILL.md", import.meta.url), "utf8");
  const schema = await readFile(new URL("../skills/kalimba-tone-trace-compiler/references/song-json-schema.md", import.meta.url), "utf8");
  for (const [document, snippets] of [
    [skill, ["unique within its JSON object", "preserve the complete draft", "Never pick the last value, automatically merge or delete"]],
    [schema.replace(/\s+/gu, " "), ["unique decoded field names", "No case-folding, trimming or Unicode normalization", "Preserve both contents and resolve the intended music against the source", "never simply choose the last value, merge arrays or delete"]]
  ]) for (const snippet of snippets) assert.ok(document.includes(snippet), snippet);
});

const librarySource = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const importHandler = librarySource.match(/^async function importSongFromJson\(\) \{[^]*?^\}/m)?.[0];
const messageHandler = librarySource.match(/^function showImportMessage\([^]*?^\}/m)?.[0];
assert.ok(importHandler, "exercise the actual import click handler");
assert.ok(messageHandler, "exercise the actual diagnostic renderer");

test("duplicate diagnostics use textContent, including markup-looking field names", () => {
  const key = '<img src=x onerror="alert(1)">';
  const token = JSON.stringify(key);
  const message = assertDuplicate(score(`"futureMetadata":{${token}:1,${token}:2}`)).message;
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
  assert.equal(importMessage.className, "import-message error");
  assert.equal(importMessage.hidden, false);
});

function useMemoryStorage(t, entries) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map(entries), writes = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { writes.push(["set", key, value]); records.set(key, String(value)); },
    removeItem: key => { writes.push(["remove", key]); records.delete(key); },
    clear: () => { writes.push(["clear"]); records.clear(); }
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
  return { records, writes };
}

test("real duplicate-failed import preserves the entire draft, old library, selection, filters and preferences", async t => {
  const [saved] = parse(score());
  const legacy = { ...saved, id: "legacy-backing", practiceAccompaniment: JSON.parse(backing), autoAccompaniment: JSON.parse(backing) };
  const historical = JSON.stringify({ ...saved, id: "historical-duplicate", sourceFeatures: { review: "last" } })
    .replace('"review":"last"', '"review":"first","review":"last"');
  const stored = `[${JSON.stringify(saved)},${JSON.stringify(legacy)},${historical},{"id":"future","schemaVersion":99,"untouched":true}]`;
  const { records, writes } = useMemoryStorage(t, [
    [CUSTOM_SONGS_STORAGE_KEY, stored], [CURRENT_SONG_STORAGE_KEY, saved.id],
    ["kalimba-key-width-v1", "72"], ["kalimba-song-speed-v1", '{"old-song":0.65}'],
    ["kalimba-practice-history-v1", '[{"id":"old-song","score":83}]'],
    ["kalimba-song-accompaniment-v1:old-song", "on"], ["kalimba-accompaniment-volume", "0.2"]
  ]);
  const existingLibrary = { [saved.id]: saved, [legacy.id]: legacy };
  const originalLibrary = structuredClone(existingLibrary), originalStorage = [...records];
  const originalCustomSongs = getCustomSongs();
  assert.ok(originalCustomSongs.find(song => song.id === legacy.id)?.practiceAccompaniment);
  assert.equal(originalCustomSongs.find(song => song.id === "historical-duplicate")?.sourceFeatures.review, "last",
    "the new-input boundary must not migrate or revalidate historical stored JSON");
  const payloads = duplicateCases.map(([, raw]) => raw);
  for (const wrapper of [songs => `[${songs.join(",")}]`, songs => `{"songs":[${songs.join(",")}]}`]) {
    for (let index = 0; index < 3; index += 1) {
      const songs = [score(`"autoAccompaniment":${backing}`), score(), score()];
      songs[index] = score().replace('"name":"C4"', '"name":"C#4","name":"C4"');
      payloads.push(wrapper(songs));
    }
  }
  for (const payload of payloads) {
    const raw = `\r\n \t${payload} \n\r\n`;
    const expected = assertDuplicate(raw).message;
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
    assert.deepEqual(messages, [{ message: expected, kind: "error" }]);
    assert.equal(context.songJsonInput.value, raw, "retain exact original bytes, including outer whitespace");
    assert.equal(context.songSearchInput.value, "existing-search");
    assert.equal(context.activeDifficulty, "easy");
    assert.strictEqual(context.songLibrary, existingLibrary);
    assert.deepEqual(existingLibrary, originalLibrary);
    assert.deepEqual([...records], originalStorage);
    assert.deepEqual(getCustomSongs(), originalCustomSongs, "historical supported reads remain unchanged");
    assert.deepEqual(writes, [], "no prefix batch save, selection update or preference write");
  }
});
