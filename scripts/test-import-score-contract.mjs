import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import {
  AI_SONG_PROMPT, CURRENT_SONG_STORAGE_KEY, CUSTOM_SONGS_STORAGE_KEY, getCustomSongs,
  getSongLibrary, getPracticeSongs, parseImportedSongs, saveCustomSongs
} from "../src/song-store.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";

const event = (name, beat, duration, extra = {}) => ({
  beat, duration, notes: [{ name, role: "melody", judge: true }], ...extra
});
const score = (extra = {}) => ({
  schemaVersion: 2, id: "import-contract", title: "导入契约测试",
  arrangementKind: "melody", judgementMode: "melody", key: "C", tuning: "21-key-c",
  events: [event("C4", 0, 1), event("D4", 1, 1)], ...extra
});
const parse = (value) => parseImportedSongs(JSON.stringify(value), {});
const backing = (extra = {}) => ({
  volume: 0.3,
  events: [{ beat: 0, duration: 0.5, notes: [{ name: "G3", role: "bass", velocity: 0.32 }] }],
  ...extra
});
const exampleStart = AI_SONG_PROMPT.indexOf("\n{\n");
const exampleEnd = AI_SONG_PROMPT.indexOf("\n}\n", exampleStart) + 2;
const example = JSON.parse(AI_SONG_PROMPT.slice(exampleStart, exampleEnd));

// These fixtures prove the import contract, not fidelity to any real song.
test("the actual copied prompt contains a complete conservative example that imports", () => {
  assert.equal(example.schemaVersion, 2);
  assert.equal(example.rhythm.sourceStatus, "needs-review");
  assert.equal(example.autoAccompaniment, undefined);
  const [song] = parse(example);
  assert.equal(song.events.length, 4);
  assert.deepEqual(song.steps.slice(0, 2), [["E4", 0, 1], ["E4", 1, 0.5]]);
  assert.equal(song.events.at(-1).beat + song.events.at(-1).duration, 3);
  assert.equal(song.sourceFeatures.sourceTotalBeats, 4);
  assert.equal(getPracticeTotalBeats(song.events, song), 4);
  assert.deepEqual(song.rhythm.restWindows, [{ beat: 3, duration: 1, policy: "silent", reason: "ending-rest" }]);
  assert.deepEqual(song.sourceFeatures, example.sourceFeatures);
  for (const required of [
    "谱图标题或署名与网页目录冲突时", "核实所选固定图像的版别并记录矛盾", "不能混用歌手或编配标签",
    "序号指输入歌曲", "保留完整原稿后修正",
    "小号倚音不自动规定固定拍值", "不能猜时值、偷减主音或推迟后续起音", "已明确采用省略装饰音的练习版", "若装饰实现不可缺少或取舍未定", "不能暗中省略",
    "同页确实另列的完整回归段也不能因前段已熟悉就省略", "只有实见反复记号及一、二房子", "另行印出的尾声仍须逐次核读", "自行计数的小节号须注明并非原谱印号", "不能删除真实休止来迎合只检查末音终点的旧校验", "旧totalBeats仅指旋律末拍", "旧gaps不含尾部空档", "读取所选总长须同时检查来源声明及状态", "sourceFeatures.meterDisplay", "只作曲卡标签，不改变播放或循环时序", "也不证明未核音符正确", "比较不同版本先对齐拍号、四分音符拍单位", "总拍数少一半不必然代表删去一半旋律", "不能据此擅自加倍时值或混用另一版速度", "选段先确认完整且连贯的主题范围", "不能只为减少音符任意截短熟悉的主歌或副歌", "被省略的器乐前奏与保留的人声休止分别说明", "不把对照候选直接替换原曲", "跨行或跨小节的连线须检查前后端点", "不能到新小节就重新起音", "多版本只有局部证据一致时", "不能因局部一致宣称整段或全曲正确", "共享同一旋律不算独立证据", "不能仅改拍号或分组就称已校准", "不能当作两个独立来源", "不能一律认定某种记谱更正确", "逐小节对照减时线与拍数", "多行歌词本身不等于反复指令", "不将间奏记成休止", "不能悄悄拼接版本", "相邻同音不等于延音", "整条同音链只起音一次", "链外独立同音仍须重拨", "不同音高的圆滑线", "0.3333333333333333", "0.16666666666666666",
    "不要强制规整到 0.25 拍网格", "sourceFeatures.sourceTotalBeats", "不得拉长它伪装结尾休止", "呼吸逗号或分句标记不等于定量休止",
    "不能把必要的升降音改成邻近自然音", "不能盲目混播", "检查已有资料中的每个伴奏层", "完整书面时长与空档", "报告没有冲突不代表和声正确", "不授权裁掉采样自然余音", "enabledByDefault: false",
    "先对照实际谱源", "不能自动证明", "不保证没有转谱错误",
    "界面“导入伴奏”仅说明来自导入资料", "不代表应用已减配、校准和声或降低音量", "禁止输出顶层 practiceAccompaniment", "即使值为 null 或空对象也不接受", "不能仅删除字段而丢失伴奏",
    "不能自动合并、改名或擅自选层", "sourceFeatures.practiceAccompaniment 可以保留来源与复核说明",
    "和弦符号须按弱起、延长、反复与一二房子展开后的时间轴定位", "不等于原谱写明了精确伴奏拨法", "根音减配须明示省略的和声色彩", "注明实际声部与范围", "不能冒称已核准人声", "短版只缩短练习范围", "旋律休止不等于所有声部静音", "不在休止内补一次拨音", "末端短低音不为丰满延长", "筛掉越界音后仍须检查强拍、句末与收束是否成立",
    "先看原音符时值与减时线", "延长记号不规定固定多几拍", "若定拍练习选择不额外延长", "不能把名义拍数称为演唱的精确时长", "不能机械当成多写拍", "不能只凭同名或相同歌曲 id 沿用旧伴奏", "内容相同只说明时间线兼容", "在开发归档或版本历史中保留原始数据及来源", "修订可追溯、可逆", "未见原谱的后续相似句不能自动照前句改音", "多声部中的升降号须先定位声部", "即使后句就在同一页", "不能因旋律相似直接复制前句", "defaultSpeedFactor 是曲谱建议", "不将它拉长填满省略处", "不冒称原谱写了休止或其他声部也静音", "实际倍率以 App 的初次慢速及用户选择/记忆为准"
  ]) assert.ok(AI_SONG_PROMPT.includes(required), required);
});

test("help and the real textarea/copy flow use the same source-fidelity contract", async () => {
  const html = await readFile(new URL("../songs.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
  assert.match(html, /先核对单音主旋律/);
  assert.match(html, /结构校验通过仍需对照谱源试听，不能保证零错谱/);
  assert.match(script, /aiPromptText\.value = AI_SONG_PROMPT/);
  assert.match(script, /writeText\(AI_SONG_PROMPT\)/);
});

const assertBackingFieldError = error => {
  for (const wording of [
    "顶层 practiceAccompaniment", "内置曲库专用", "外部导入不支持", "schemaVersion: 2", "autoAccompaniment",
    "完整保留伴奏音符", "beat", "duration", "音量与默认开关", "主旋律时间轴", "rhythm.restWindows",
    "silent/hold", "sourceFeatures.sourceTotalBeats", "不要仅删除字段而丢失伴奏",
    "若已有 autoAccompaniment", "不会自动合并、改名或选层"
  ]) assert.ok(error.message.includes(wording), wording);
  return true;
};

test("every own top-level practiceAccompaniment value is rejected across current and legacy import forms", () => {
  const forms = [
    score(),
    { schemaVersion: 1, title: "旧 steps", steps: [["C4", 0, 1], ["D4", 1, 1]] },
    { title: "旧 notation", notation: [{ degree: "1", octave: 0, beat: 0, duration: 1 }] }
  ];
  for (const form of forms) {
    for (const value of [null, false, 0, "", "unsupported", [], {}, { events: [] }, backing(),
      { events: [{ beat: -1, duration: 0, notes: ["F#4"] }] }]) {
      const input = { ...form, practiceAccompaniment: value };
      for (const wrapped of [input, [input], { songs: [input] }, { songs: [form], practiceAccompaniment: value }]) {
        assert.throws(() => parse(wrapped), assertBackingFieldError);
      }
    }
  }
});

test("an existing auto layer never bypasses rejection or triggers automatic merge, rename or selection", () => {
  for (const practiceAccompaniment of [null, {}, backing(), backing({ volume: 0.2 })]) {
    for (const autoAccompaniment of [backing(), null, { events: [] }]) {
      assert.throws(() => parse(score({ practiceAccompaniment, autoAccompaniment })), assertBackingFieldError);
    }
  }
});

test("sourceFeatures practice metadata and unrelated metadata remain legitimate on new imports", () => {
  for (const practiceAccompaniment of [null, {}, { candidate: "source-reviewed", limits: "not playback" }]) {
    const sourceFeatures = { practiceAccompaniment, sourceTotalBeats: 2, customReview: { status: "needs-review" } };
    const [melody, arrangement] = parse(score({
      sourceFeatures, futureMetadata: { practiceAccompaniment: "descriptive only" }, autoAccompaniment: backing()
    }));
    for (const song of [melody, arrangement]) {
      assert.deepEqual(song.sourceFeatures, sourceFeatures);
      assert.equal(Object.hasOwn(song, "practiceAccompaniment"), false);
    }
    assert.equal(arrangement.autoAccompaniment.events.length, 1);
    const wrapper = { songs: [score()], sourceFeatures, futureMetadata: { practiceAccompaniment: "wrapper metadata" } };
    assert.equal(parse(wrapper).length, 1, "wrapper metadata is not an unsupported playback field");
  }
});

test("supported V2, legacy V1 and notation imports without the built-in field still work", () => {
  const inputs = [score(), { schemaVersion: 1, title: "旧 V1", steps: [["C4", 0, 1], ["D4", 1, 1]] },
    { title: "旧简谱", notation: [{ degree: "1", beat: 0, duration: 1 }, { degree: "2", beat: 1, duration: 1 }] }];
  for (const wrapped of [inputs, { songs: inputs }]) {
    const songs = parse(wrapped);
    assert.equal(songs.length, 3);
    for (const song of songs) assert.deepEqual(song.steps, [["C4", 0, 1], ["D4", 1, 1]]);
  }
});

function useMemoryStorage(t, entries = []) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map(entries);
  const writes = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { writes.push([key, value]); records.set(key, value); }
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
  return { records, writes };
}

test("single and mixed batch failures are transactional for library, current selection and unrelated preferences", async t => {
  const existingLibrary = Object.fromEntries(parse(score({ id: "already-saved" })).map(song => [song.id, song]));
  const beforeLibrary = structuredClone(existingLibrary);
  const originalRecords = [...Object.values(existingLibrary), { id: "future-schema", schemaVersion: 99, untouched: true }];
  const { records, writes } = useMemoryStorage(t, [
    [CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(originalRecords)], [CURRENT_SONG_STORAGE_KEY, "already-saved"],
    ["kalimba-test-preferences", "unchanged"]
  ]);
  const beforeStorage = [...records];
  const good = score({ id: "valid-first" });
  const bad = score({ id: "rejected", practiceAccompaniment: backing() });
  const libraryScript = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
  const handler = libraryScript.match(/^async function importSongFromJson\(\) \{[^]*?^\}/m)?.[0];
  assert.ok(handler, "exercise the actual import click handler");
  for (const payload of [bad, [good, bad], [bad, good], { songs: [good, bad] }, { songs: [bad, good] },
    { songs: [good], practiceAccompaniment: backing() }, { songs: [good], practiceAccompaniment: null }]) {
    const raw = JSON.stringify(payload);
    assert.throws(() => parseImportedSongs(raw, existingLibrary), assertBackingFieldError);
    const busy = [], messages = [];
    const context = {
      // Isolate rejected-input transactions after history restoration has settled.
      pendingImportDraftRestore: null,
      importingSong: false, deletingSong: false, performance: { now: () => 0 }, songLibrary: existingLibrary,
      songJsonInput: { value: raw }, songSearchInput: { value: "existing-search" }, activeDifficulty: "easy",
      parseImportedSongs, saveCustomSongs, withCustomSongWriteLock: async write => write(),
      getSongLibrary() { assert.fail("failed import must not refresh the library"); },
      storeSongId() { assert.fail("failed import must not change the current selection"); },
      refreshLibraryViews() { assert.fail("failed import must not replace existing cards"); },
      waitForPaint: async () => {}, waitForThinkingMinimum: async () => {},
      setImportBusy: value => busy.push(value), showImportMessage: (message, kind) => messages.push({ message, kind })
    };
    runInNewContext(handler, context);
    await context.importSongFromJson();
    assert.deepEqual(busy, [true, false]);
    assert.equal(messages.length, 1); assert.equal(messages[0].kind, "error");
    assertBackingFieldError(messages[0]);
    assert.equal(context.songJsonInput.value, raw, "retain the rejected source text for repair");
    assert.equal(context.songSearchInput.value, "existing-search");
    assert.equal(context.activeDifficulty, "easy");
    assert.deepEqual(existingLibrary, beforeLibrary);
    assert.deepEqual([...records], beforeStorage);
    assert.deepEqual(writes, [], "no storage writes, including no partial valid-prefix save");
  }
});

test("deliberately converted supported auto retains every note, attack, hold, rest, ending and setting through storage", t => {
  useMemoryStorage(t);
  const input = score({
    bpm: 96, beatsPerMeasure: 4, defaultSpeedFactor: 0.75,
    events: [event("C5", 0, 1 / 3), event("C5", 1 / 3, 1 / 3), event("D5", 2 / 3, 1 / 3), event("E5", 2, 1)],
    sourceFeatures: { sourceTotalBeats: 4, practiceAccompaniment: { evidence: "synthetic hold, not source approval" } },
    rhythm: { sourceStatus: "needs-review", pickupBeats: 0, restWindows: [
      { beat: 1, duration: 1, policy: "hold", reason: "synthetic retained lower sustain" },
      { beat: 3, duration: 1, policy: "silent", reason: "ending-rest" }
    ] },
    practiceAccompaniment: backing({ enabledByDefault: false, events: [
      { beat: 0, duration: 2, pattern: "retained-hold", notes: [{ name: "G3", role: "bass", velocity: 0.32 }] },
      { beat: 2, duration: 0.5, pattern: "distinct-attack", notes: [
        { name: "G3", role: "bass", velocity: 0.32 }, { name: "C4", role: "harmony", velocity: 0.3 }
      ] }
    ] })
  });
  assert.throws(() => parse(input), assertBackingFieldError);
  // This fixture explicitly chooses its only layer. The importer does not convert it.
  const upload = structuredClone(input);
  upload.autoAccompaniment = upload.practiceAccompaniment;
  delete upload.practiceAccompaniment;
  const saved = saveCustomSongs(parse(upload));
  assert.equal(saved.length, 2);
  const loaded = getCustomSongs();
  assert.deepEqual(loaded, saved);
  const source = loaded.find(song => song.autoAccompaniment);
  assert.deepEqual(source.autoAccompaniment, input.practiceAccompaniment);
  assert.deepEqual(source.rhythm, input.rhythm);
  assert.deepEqual(source.sourceFeatures, input.sourceFeatures);
  const practice = getPracticeSongs(Object.fromEntries(loaded.map(song => [song.id, song])));
  assert.equal(practice.length, 1);
  assert.deepEqual(practice[0].steps, input.events.map(({ notes, beat, duration }) => [notes[0].name, beat, duration]));
  assert.equal(getPracticeTotalBeats(practice[0].events, practice[0]), 4);
  assert.deepEqual([source.bpm, source.beatsPerMeasure, source.defaultSpeedFactor], [96, 4, 0.75]);
});

test("historical stored V2 and built-in playback layers remain readable without migration or storage writes", t => {
  const historical = score({ id: "local-historical-backing", autoAccompaniment: backing({ enabledByDefault: true }),
    practiceAccompaniment: backing({ enabledByDefault: false, volume: 0.2 }),
    sourceFeatures: { practiceAccompaniment: { review: "historical" } } });
  const { records, writes } = useMemoryStorage(t, [
    [CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([historical])], [CURRENT_SONG_STORAGE_KEY, historical.id]
  ]);
  const before = [...records];
  const [loaded] = getCustomSongs();
  assert.deepEqual(loaded.practiceAccompaniment, historical.practiceAccompaniment);
  assert.deepEqual(loaded.autoAccompaniment, historical.autoAccompaniment);
  const library = getSongLibrary();
  assert.deepEqual(library[historical.id].practiceAccompaniment, historical.practiceAccompaniment);
  for (const id of ["qing-hua-ci-reviewed-support", "see-you-again-reviewed-support", "ling-er-xiang-ding-dang-reviewed-support"]) {
    assert.ok(library[id].practiceAccompaniment.events.length > 0, `${id} keeps built-in support`);
  }
  assert.deepEqual([...records], before);
  assert.deepEqual(writes, []);
  assert.throws(() => parse(historical), assertBackingFieldError, "strictness is only for a new import");
});

test("triplet fractions, sixteenth subdivisions and real repeated attacks stay unchanged", () => {
  const events = [
    event("C4", 0, 1 / 3), event("C4", 1 / 3, 1 / 3), event("C4", 2 / 3, 1 / 3),
    event("D4", 1, 1 / 6), event("E4", 1 + 1 / 6, 1 / 6), event("G4", 1 + 2 / 6, 1 / 6),
    event("G4", 1.5, 0.25), event("G4", 1.75, 0.25), event("E4", 2, 0.125), event("D4", 2.125, 0.375)
  ];
  const [song] = parse(score({ events, sourceFeatures: { sourceTotalBeats: 3 } }));
  assert.deepEqual(song.steps, events.map(({ notes, beat, duration }) => [notes[0].name, beat, duration]));
  assert.equal(song.steps.length, 10, "same-pitch attacks are never merged by the importer");
});

test("source-reviewed merged ties and distinct slurred pitches remain the supplied attacks", () => {
  // Source verification happens before import; no tie or slur is inferred here.
  const events = [event("C4", 0, 2), event("D4", 2, 0.5), event("E4", 2.5, 0.5)];
  const [song] = parse(score({ events }));
  assert.deepEqual(song.steps, [["C4", 0, 2], ["D4", 2, 0.5], ["E4", 2.5, 0.5]]);
});

test("every new import note is validated before normalization can silently omit it", () => {
  for (const bad of [
    score({ events: [event("C4", 0, 1), event("F#4", 1, 1), event("E4", 2, 1)] }),
    score({ events: [event("F#4", 0, 1, { notes: [{ name: "F#4", role: "melody" }, { name: "C4", role: "harmony" }] })] }),
    score({ events: [event("C4", 0, 1, { notes: [{ name: "C4", role: "melody" }, { name: "F#4", role: "harmony" }] })] }),
    { schemaVersion: 1, steps: [["C4", 0, 1], ["F#4", 1, 1], ["E4", 2, 1]] },
    score({ autoAccompaniment: backing({ events: [{ beat: 0, duration: 0.5, notes: ["G3", "F#4"] }] }) })
  ]) assert.throws(() => parse(bad), /F#4.*不在固定 21 音 C 调卡林巴范围/);
  assert.throws(() => parse(score({ events: [event("C4", 0, 1), null] })), /第 2 项\s*必须是对象/);
  assert.throws(() => parse(score({ events: [event("C4", 0, 1), event("", 1, 1)] })), /不在固定 21 音/);
});

test("ambiguous or invalid roles fail, including two melody roles with only one judged", () => {
  for (const notes of [
    ["E6", "C4"],
    [{ name: "E6", role: "melody", judge: false }, { name: "C4", role: "melody", judge: true }],
    [{ name: "E6", role: "harmony", judge: true }, { name: "C4", role: "bass", judge: true }]
  ]) assert.throws(() => parse(score({ events: [event("C4", 0, 1, { notes })] })), /明确标注一个主旋律音/);
  assert.throws(() => parse(score({ events: [event("C4", 0, 1, { notes: [{ name: "C4", role: "melodi" }] })] })), /role 无效/);
  const [song] = parse(score({ events: [event("C4", 0, 1, { notes: [
    { name: "E6", role: "harmony", judge: false }, { name: "C4", role: "melody", judge: true }
  ] })] }));
  assert.deepEqual(song.steps, [["C4", 0, 1]], "neither first nor highest pitch becomes the target");
  assert.deepEqual(parse(score({ events: [{ beat: 0, duration: 1, notes: ["C4"] }] }))[0].steps, [["C4", 0, 1]], "legacy implicit single notes remain accepted");
});

test("explicit nonmelody attacks are never promoted into physical practice targets", () => {
  for (const role of ["bass", "harmony", "arpeggio", "ornament"]) {
    for (const judge of [true, false]) {
      assert.throws(() => parse(score({ events: [event("C4", 0, 1), {
        beat: 1, duration: 1, notes: [{ name: "G3", role, judge }]
      }] })), /独立低音或和声请放入 autoAccompaniment/);
    }
  }
});

test("nonfinite, mistyped, negative and overflowing time values fail instead of disappearing", () => {
  for (const value of [null, "1", true, -1]) {
    assert.throws(() => parse(score({ events: [event("C4", 0, 1), event("D4", value, 1)] })), /beat.*有限数字/);
    assert.throws(() => parse(score({ events: [event("C4", 0, 1), event("D4", 1, value)] })), /duration.*有限数字/);
  }
  assert.throws(() => parse(score({ events: [event("C4", Number.MAX_VALUE, Number.MAX_VALUE)] })), /结束拍.*有限数字/);
  assert.throws(() => parseImportedSongs('{"schemaVersion":2,"events":[{"beat":0,"duration":1e309,"notes":["C4"]}]}', {}), /duration.*有限数字/);
  assert.throws(() => parse(score({ bpm: null })), /bpm.*有限数字/);
  assert.throws(() => parse(score({ beatsPerMeasure: 3.5 })), /不要随意取整/);
});

test("source endings reject nonnumeric values and every kind of boundary contradiction", () => {
  for (const sourceTotalBeats of [null, "4", true, -1, 1]) {
    assert.throws(() => parse(score({ sourceFeatures: { sourceTotalBeats } })), /sourceTotalBeats/);
  }
  assert.throws(() => parseImportedSongs(JSON.stringify(score({ sourceFeatures: { sourceTotalBeats: 4 } })).replace('"sourceTotalBeats":4', '"sourceTotalBeats":1e309'), {}), /sourceTotalBeats.*有限数字/);
  assert.throws(() => parse(score({ sourceFeatures: { sourceTotalBeats: 2 }, autoAccompaniment: backing({ events: [{ beat: 2, duration: 1, notes: ["G3"] }] }) })), /sourceTotalBeats 小于/);
  assert.throws(() => parse(score({ sourceFeatures: { sourceTotalBeats: 2 }, rhythm: { restWindows: [{ beat: 2, duration: 1, policy: "silent" }] } })), /sourceTotalBeats 小于/);
  assert.throws(() => parse(score({ sourceFeatures: { sourceTotalBeats: 2 }, rhythm: { pickupBeats: 3 } })), /sourceTotalBeats 小于/);
  assert.throws(() => parse(score({ rhythm: { restWindows: [{ beat: 2, duration: 1, policy: "silent" }] } })), /填写 sourceFeatures.sourceTotalBeats/);
});

test("contradictory silence and same-pitch backing fail without silent layer rewriting", () => {
  assert.throws(() => parse(score({ rhythm: { restWindows: [{ beat: 0.5, duration: 0.5, policy: "silent" }] } })), /休止窗口第 1 项与主旋律重叠/);
  assert.throws(() => parse(score({
    events: [event("C4", 0, 1), event("E4", 3, 1)],
    rhythm: { restWindows: [{ beat: 1, duration: 2, policy: "silent" }] },
    autoAccompaniment: backing({ events: [{ beat: 1, duration: 0.5, notes: ["G3"] }] })
  })), /要求静音.*自动伴奏重叠/);
  assert.throws(() => parse(score({ autoAccompaniment: backing({ events: [{ beat: 0, duration: 0.5, notes: ["C4"] }] }) })), /同拍同音重复起音/);
});

test("valid rest boundaries, source evidence, ending silence and accompaniment choices survive", () => {
  for (const enabledByDefault of [undefined, false, true]) {
    const input = score({
      events: [event("C4", 0, 1 / 3), event("E4", 2, 1)],
      sourceFeatures: { sourceTotalBeats: 4, transcriptionScope: "测试选段", unsureMeasures: ["仅验证结构"], sources: [{ label: "测试夹具" }] },
      rhythm: { sourceStatus: "needs-review", restWindows: [
        { beat: 1 / 3, duration: 5 / 3, policy: "silent" }, { beat: 3, duration: 1, policy: "silent" }
      ] },
      autoAccompaniment: backing({ enabledByDefault, events: [{ beat: 0, duration: 1 / 3, notes: [{ name: "G3", role: "bass", velocity: 0.32 }] }] })
    });
    const [melody, arrangement] = parse(input);
    assert.equal(arrangement.autoAccompaniment.enabledByDefault, enabledByDefault === true);
    assert.equal(arrangement.autoAccompaniment.volume, 0.3);
    assert.deepEqual(melody.sourceFeatures, input.sourceFeatures);
    assert.deepEqual(melody.rhythm.restWindows, input.rhythm.restWindows);
    assert.equal(melody.rhythm.sourceStatus, "needs-review");
    assert.equal(getPracticeTotalBeats(melody.events, melody), 4);
    assert.equal(melody.events.at(-1).duration, 1);
  }
});

test("failed new imports do not mutate existing stored records or apply stricter legacy reads", () => {
  const records = new Map();
  globalThis.localStorage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  saveCustomSongs(parse(score()));
  const before = records.get(CUSTOM_SONGS_STORAGE_KEY);
  assert.throws(() => parse(score({ events: [event("C4", 0, 1), event("F#4", 1, 1)] })), /不在固定 21 音/);
  assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), before);
  const oldRecord = { ...JSON.parse(before)[0], sourceFeatures: { sourceTotalBeats: "4", legacy: true } };
  records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([oldRecord]));
  const legacyBefore = records.get(CUSTOM_SONGS_STORAGE_KEY);
  assert.equal(getCustomSongs()[0].sourceFeatures.sourceTotalBeats, "4");
  assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), legacyBefore);
});
