import { getSongDisplayTitle } from "../src/song-presentation.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import {
  CUSTOM_SONGS_STORAGE_KEY, deleteCustomSongGroup, getCustomSongs, getSongLibrary,
  getPracticeSongId, getPracticeSongs, getSongBaseId, getSongAccompanimentProvider, hasMatchingPracticeMelody, getSongArchiveDownload, getSongVersionRank, getSongReviewNotice, getSongPracticeHint, getSongMeterLabel,
  getLocalSongCopyLabel, getEventTotalBeats, DIFFICULTY_LABELS, normalizeDifficulty, parseImportedSongs, saveCustomSongs
} from "../src/song-store.js";
import { SONG_LIBRARY } from "../src/songs.js";
import { readSongSpeed, browserPreferenceStorage } from "../src/practice-preferences.js";

const librarySource = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const selectSource = librarySource.slice(librarySource.indexOf("function getSelectedSongId("), librarySource.indexOf("function getSongTotalBeats("));
const navigateSource = librarySource.slice(librarySource.indexOf("function selectSong("), librarySource.indexOf("function createMeta("));
const cardSource = librarySource.slice(librarySource.indexOf("function getSongTotalBeats("), librarySource.indexOf("function renderLocalSongManager("));

let records;
beforeEach(() => {
  records = new Map();
  globalThis.localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, String(value))
  };
});
const input = (extra = {}) => ({ id: "example", title: "Example", bpm: 90, steps: [["C4", 0, 1], ["E4", 2, 1]], ...extra });
const readRaw = () => JSON.parse(records.get(CUSTOM_SONGS_STORAGE_KEY));

test("V1, notation and V2 imports keep rests and generate playable versions", () => {
  const notation = parseImportedSongs(JSON.stringify({ title: "Notation", notation: [
    { degree: 0, beat: 0, duration: 1 },
    { degree: 1, beat: 1, duration: 1 },
    { degree: "rest", beat: 2, duration: 2 },
    { degree: 3, beat: 4, duration: 1 }
  ] }));
  assert.deepEqual(notation[0].steps, [["C4", 1, 1], ["E4", 4, 1]]);
  const pair = parseImportedSongs(JSON.stringify(input({ schemaVersion: 2, judgementMode: "chord", events: [
    { beat: 0, duration: 1, notes: [{ name: "C4", role: "melody" }, { name: "E4", role: "harmony" }] },
    { beat: 2, duration: 1, notes: [{ name: "G4", role: "melody", judge: true }] }
  ] })));
  assert.equal(pair.length, 2);
  assert.equal(pair[1].steps.length, 3);
  assert.equal(pair[0].baseSongId, pair[1].baseSongId);
  assert.equal(parseImportedSongs(JSON.stringify(input()))[0].steps.length, 2);
});

test("one invalid stored record does not break valid or built-in songs", () => {
  const [song] = parseImportedSongs(JSON.stringify(input()));
  const invalid = [{ steps: [["C4", 0, 1]] }, { id: 42 }, null, [], { id: "" }];
  records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([...invalid, song]));
  assert.deepEqual(getCustomSongs(), [song]);
  const library = getSongLibrary();
  assert.equal(library.birthday.source, "system");
  assert.deepEqual(library[song.id], song);
  assert.equal(library.__proto__, undefined);
  assert.equal(library.toString, undefined);
  assert.deepEqual(readRaw(), [...invalid, song]);
});

test("save and delete preserve unrelated raw records and local ownership", () => {
  const [kept] = parseImportedSongs(JSON.stringify(input({ id: "kept" })));
  const unknown = { id: "future-song", schemaVersion: 99, customMetadata: { keep: true } };
  records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([unknown, { ...kept, source: "system" }]));
  assert.equal(getCustomSongs()[0].source, "local");
  const added = saveCustomSongs(parseImportedSongs(JSON.stringify(input())));
  assert.equal(readRaw().length, 3);
  assert.deepEqual(readRaw()[0], unknown);
  assert.deepEqual(deleteCustomSongGroup(added[0].baseSongId).ids, [added[0].id]);
  assert.deepEqual(readRaw()[0], unknown);
  assert.equal(readRaw()[1].source, "system");
  assert.equal(getCustomSongs()[0].id, kept.id);
});

test("unreadable existing storage is never overwritten by a new import", () => {
  const songs = parseImportedSongs(JSON.stringify(input()));
  for (const corrupt of ["{invalid JSON", '{"unexpected":"object"}']) {
    records.set(CUSTOM_SONGS_STORAGE_KEY, corrupt);
    assert.throws(() => saveCustomSongs(songs), /未修改已保存的数据/);
    assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), corrupt);
  }
});

test("quota failures leave existing songs intact for both import and delete", () => {
  const songs = saveCustomSongs(parseImportedSongs(JSON.stringify(input())));
  const before = records.get(CUSTOM_SONGS_STORAGE_KEY);
  localStorage.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  assert.throws(() => saveCustomSongs(songs), /无法保存本地曲库/);
  assert.throws(() => deleteCustomSongGroup(songs[0].baseSongId), /无法保存本地曲库/);
  assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), before);
});

test("duplicate imports reserve distinct ids without replacing earlier songs", () => {
  const songs = parseImportedSongs(JSON.stringify([input(), input()]));
  assert.equal(new Set(songs.map((song) => song.id)).size, 2);
  saveCustomSongs(songs);
  assert.equal(getCustomSongs().length, 2);
});

test("all built-in arrangements resolve to authoritative single-note melodies without dropping source data", () => {
  const library = getSongLibrary();
  assert.equal(Object.keys(library).length, Object.keys(SONG_LIBRARY).length);
  const chordSongs = Object.values(library).filter((song) => getSongVersionRank(song) === 1);
  assert.equal(chordSongs.length, 17);
  for (const song of chordSongs) {
    const id = getPracticeSongId(library, song.id);
    assert.equal(id, getSongBaseId(song));
    assert.deepEqual(library[id].steps, SONG_LIBRARY[id].steps);
    assert.equal(library[song.id], song);
    assert.ok(song.events.some((event) => event.notes.length > 1));
  }
  const practiceSongs = getPracticeSongs(library);
  assert.equal(practiceSongs.length, 36);
  assert.equal(new Set(practiceSongs.map(getSongBaseId)).size, practiceSongs.length);
  assert.ok(practiceSongs.every((song) => song.judgementMode === "melody" && song.arrangementKind === "melody"));
  assert.ok(practiceSongs.every((song) => song.events.every((event) => event.notes.filter((note) => note.judge).length === 1)));
  assert.equal(records.has(CUSTOM_SONGS_STORAGE_KEY), false);
});

test("known local melody takes precedence over a differing chord source melody", () => {
  const melody = input({ id: "local_known", baseSongId: "local_known", steps: [["D4", 2, 1]] });
  const chord = input({
    id: "local_known_chord", baseSongId: "local_known", schemaVersion: 2,
    arrangementKind: "chord", judgementMode: "chord",
    events: [{ beat: 0, duration: 1, notes: [
      { name: "E6", role: "harmony", judge: true },
      { name: "C4", role: "melody", judge: true }
    ] }], sourceFeatures: { source: "preserve" }
  });
  records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([chord, melody]));
  const before = records.get(CUSTOM_SONGS_STORAGE_KEY);
  const library = getSongLibrary();
  assert.equal(getPracticeSongId(library, chord.id), melody.id);
  assert.deepEqual(library[melody.id].steps, melody.steps);
  assert.equal(library[chord.id].events[0].notes.length, 2);
  assert.deepEqual(library[chord.id].sourceFeatures, chord.sourceFeatures);
  assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), before);
});

test("legacy chord-only records derive a temporary explicit-role melody and preserve the original", () => {
  for (const id of ["local_legacy_chord", "local_legacy-chord", "local_legacy"]) {
    const original = input({
      id, schemaVersion: 2, arrangementKind: "chord", judgementMode: "chord",
      events: [{ beat: 2, duration: 1.5, judgeWindow: .4, notes: [
        { name: "E6", role: "harmony", judge: true },
        { name: "C4", role: "melody", judge: true }
      ] }],
      sourceFeatures: { evidence: "preserve" },
      practiceAccompaniment: { events: [{ beat: 2, duration: 1, notes: ["G3"] }] }
    });
    records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([original]));
    const before = records.get(CUSTOM_SONGS_STORAGE_KEY);
    const library = getSongLibrary();
    const practiceId = getPracticeSongId(library, id);
    assert.ok(practiceId);
    assert.notEqual(practiceId, id);
    assert.equal(getPracticeSongId(library, practiceId), practiceId);
    assert.deepEqual(library[practiceId].steps, [["C4", 2, 1.5]]);
    assert.equal(library[practiceId].events[0].judgeWindow, .4);
    assert.equal(library[practiceId].practiceAccompaniment.events[0].notes[0].name, "G3");
    assert.equal(library[id].events[0].notes.length, 2);
    assert.deepEqual(library[practiceId].sourceFeatures, original.sourceFeatures);
    assert.equal(getCustomSongs().length, 1);
    assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), before);
  }
});

test("ambiguous legacy chord-only data remains saved but is excluded from practice", () => {
  const original = input({
    id: "local_ambiguous_chord", schemaVersion: 2, arrangementKind: "chord", judgementMode: "chord",
    events: [{ beat: 0, duration: 1, notes: [{ name: "E6", judge: true }, { name: "C4", judge: true }] }]
  });
  records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([original]));
  const before = records.get(CUSTOM_SONGS_STORAGE_KEY);
  const library = getSongLibrary();
  assert.equal(getPracticeSongId(library, original.id), null);
  assert.ok(library[original.id]);
  assert.equal(getCustomSongs()[0].id, original.id);
  assert.equal(getPracticeSongs(library).some((song) => getSongBaseId(song) === "local_ambiguous"), false);
  assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), before);
});

test("legacy melody-labeled events with harmony extras use a single-note view without changing their source", () => {
  const original = input({
    id: "local_embedded", schemaVersion: 2, arrangementKind: "melody", judgementMode: "melody",
    events: [{ beat: 0, duration: 1, notes: [
      { name: "E6", role: "harmony", judge: false },
      { name: "C4", role: "melody", judge: true }
    ] }]
  });
  const chord = {
    ...original, id: "local_embedded_chord", baseSongId: original.id,
    arrangementKind: "chord", judgementMode: "chord",
    events: [{ beat: 0, duration: 1, notes: [
      { name: "E6", role: "harmony", judge: true },
      { name: "G4", role: "melody", judge: true }
    ] }]
  };
  records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([chord, original]));
  const before = records.get(CUSTOM_SONGS_STORAGE_KEY);
  const library = getSongLibrary();
  const practiceId = getPracticeSongId(library, original.id);
  assert.equal(practiceId, "local_embedded-melody");
  assert.equal(getPracticeSongId(library, chord.id), practiceId);
  assert.deepEqual(library[practiceId].steps, [["C4", 0, 1]]);
  assert.equal(library[practiceId].events[0].notes.length, 1);
  assert.equal(library[original.id].events[0].notes.length, 2);
  assert.equal(library[chord.id].events[0].notes.length, 2);
  assert.ok(getPracticeSongs(library).every((song) => song.events.every((event) => event.notes.length === 1)));
  assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), before);
});

test("new multi-note imports require an explicit melody and never guess the highest or first pitch", () => {
  const makeEvents = (notes) => [{ beat: 0, duration: 1, notes }];
  for (const notes of [
    ["E6", "C4"],
    [{ name: "E6", judge: true }, { name: "C4", judge: true }],
    [{ name: "E6", role: "melody", judge: true }, { name: "C4", role: "melody", judge: true }]
  ]) {
    assert.throws(() => parseImportedSongs(JSON.stringify(input({ schemaVersion: 2, events: makeEvents(notes) }))), /明确标注一个主旋律音/);
  }
  for (const judgementMode of ["melody", "chord"]) {
    const songs = parseImportedSongs(JSON.stringify(input({ schemaVersion: 2, judgementMode, events: makeEvents([
      { name: "E6", role: "harmony" }, { name: "C4", role: "melody" }
    ]) })));
    assert.deepEqual(songs[0].steps, [["C4", 0, 1]]);
    assert.equal(songs[0].events[0].notes.length, 1);
    assert.equal(songs[1].events[0].notes.length, 2);
  }
  const duplicatePitch = parseImportedSongs(JSON.stringify(input({ schemaVersion: 2, judgementMode: "chord", events: makeEvents([
    { name: "E6", role: "harmony", judge: true },
    { name: "C4", role: "harmony", judge: true },
    { name: "C4", role: "melody", judge: true }
  ]) })));
  assert.deepEqual(duplicatePitch[0].steps, [["C4", 0, 1]]);
  assert.equal(records.has(CUSTOM_SONGS_STORAGE_KEY), false);
});

test("separate events at the same onset cannot reintroduce physical chords into practice", () => {
  const legacy = input({ id: "local_same_beat", steps: [["C4", 0, 1], ["E4", 0, 1]] });
  assert.throws(() => parseImportedSongs(JSON.stringify(legacy)), /同一拍有多个主旋律事件/);
  assert.throws(() => parseImportedSongs(JSON.stringify(input({ schemaVersion: 2, events: [
    { beat: 0, duration: 1, notes: [{ name: "C4", role: "melody", judge: true }] },
    { beat: 0, duration: 1, notes: [{ name: "E4", role: "melody", judge: true }] }
  ] }))), /同一拍有多个主旋律事件/);
  records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([legacy]));
  const before = records.get(CUSTOM_SONGS_STORAGE_KEY);
  const library = getSongLibrary();
  assert.ok(library[legacy.id]);
  assert.equal(getPracticeSongId(library, legacy.id), null);
  assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), before);
});

test("standalone bass or harmony events cannot become melody targets on import or legacy read", () => {
  for (const role of ["bass", "harmony", "arpeggio", "ornament"]) {
    for (const arrangementKind of ["melody", "chord"]) {
      const original = input({
        id: "local_backing_event", schemaVersion: 2, arrangementKind, judgementMode: arrangementKind,
        events: [
          { beat: 0, duration: 1, notes: [{ name: "C4", role: "melody", judge: true }] },
          { beat: 1, duration: 1, notes: [{ name: "G3", role, judge: false }] }
        ]
      });
      assert.throws(() => parseImportedSongs(JSON.stringify(original)), /独立低音或和声请放入 autoAccompaniment/);
      records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([original]));
      const before = records.get(CUSTOM_SONGS_STORAGE_KEY);
      const library = getSongLibrary();
      assert.ok(library[original.id]);
      assert.equal(library[original.id].events[1].notes[0].role, role);
      assert.equal(library[original.id].events[1].notes[0].judge, false);
      assert.equal(getPracticeSongId(library, original.id), null);
      assert.equal(getCustomSongs()[0].id, original.id);
      assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), before);
    }
  }
  const [implicitSingleNotes] = parseImportedSongs(JSON.stringify(input({ schemaVersion: 2, events: [
    { beat: 0, duration: 1, notes: ["C4"] },
    { beat: 1, duration: 1, notes: ["E4"] }
  ] })));
  assert.deepEqual(implicitSingleNotes.steps, [["C4", 0, 1], ["E4", 1, 1]]);
});

test("library old deep links, stored chord ids and practice navigation resolve canonical melody", () => {
  const songLibrary = getSongLibrary();
  for (const [search, stored, expected] of [
    ["?song=birthday-chord", "jasmine-chord", "birthday"],
    ["?selected=jasmine-chord", "birthday-chord", "jasmine"],
    ["?song=missing", "jasmine-chord", "jasmine"],
    ["", "birthday-chord", "birthday"],
    ["?song=__proto__", "constructor", "birthday"]
  ]) {
    let saved = null;
    const context = {
      URLSearchParams, songLibrary, getPracticeSongId, selectedSongOverride: null,
      // This extracted-function check isolates canonical id routing.
      prepareImportDraftForLeave: () => true,
      window: { location: { search, href: "" } },
      readStoredSongId: () => stored, storeSongId: (id) => { saved = id; }
    };
    runInNewContext(selectSource + navigateSource, context);
    assert.equal(context.getSelectedSongId(), expected);
    context.selectSong(`${expected}-chord`);
    assert.equal(saved, expected);
    assert.equal(context.window.location.href, `./index.html?song=${expected}&fromLibrary=1`);
    context.selectSong("missing");
    assert.equal(saved, expected);
  }
  for (const id of [null, undefined, "", "__proto__", "constructor", "missing"]) {
    assert.equal(getPracticeSongId(songLibrary, id), null);
  }
});

test("source-limited and selected-edition melodies visibly disclose current scope", () => {
  const library = getSongLibrary();
  const notices = getPracticeSongs(library).filter((song) => getSongReviewNotice(song));
  assert.deepEqual(notices.map((song) => song.id).sort(), ["bie-kan-wo-zhi-shi-yi-zhi-yang", "bluebird", "da-yu", "da-yu-xiao-yu", "hong-yan", "interstellar-main-theme", "jasmine", "ju-ci-lang-de-xia-tian", "jue-bie-shu", "katyusha", "ling-er-xiang-ding-dang", "mi-xue-bing-cheng-theme", "ping-fan-zhi-lu", "qing-cheng-shan-xia-bai-su-zhen", "qing-hua-ci", "rang-wo-men-dang-qi-shuang-jiang", "see-you-again", "sheng-sheng-man", "song-bie", "tai-yang-zhao-chang-sheng-qi", "tian-kong-zhi-cheng", "tong-nian", "xuan-cao-hua", "yun-yan-cheng-yu", "zhu-zhu-xia-theme"]);
  assert.match(getSongReviewNotice(library["tian-kong-zhi-cheng"]), /MV短版.*88 BPM.*1分22秒.*两处剪接.*无需调音/);
  assert.match(getSongReviewNotice(library["interstellar-main-theme"]), /44–49.*恢复三连音.*尾段密集.*慢速分段.*前段声部与音区仍待核.*第42小节起为4\/4/);
  assert.doesNotMatch(getSongReviewNotice(library["interstellar-main-theme"]), /统一按3\/4显示/);
  assert.match(getSongReviewNotice({ id: "interstellar-main-theme", sourceFeatures: { unsupported: ["44-49 triplets quantized to 0.25"] } }), /44–49.*0\.25拍/);
  assert.match(getSongReviewNotice(library["yun-yan-cheng-yu"]), /第28小节整节暂留旧版.*音高与节奏待核.*4拍旋律休止/);
  assert.doesNotMatch(getSongReviewNotice(library["yun-yan-cheng-yu"]), /三连音和短倚音.*0\.25拍/);
  assert.match(getSongReviewNotice({ id: "yun-yan-cheng-yu", sourceFeatures: { unsupported: ["triplet and grace groups quantized to 0.25"] } }), /三连音和短倚音.*0\.25拍/);
  assert.match(getSongReviewNotice(library["da-yu-xiao-yu"]), /11小节.*第9–10小节.*八分音.*括号间奏/);
  assert.match(getSongReviewNotice(library["mi-xue-bing-cheng-theme"]), /第5小节.*一拍单音.*省略.*琶音和弦.*旧伴奏暂不使用/);
  assert.match(getSongReviewNotice(library["qing-cheng-shan-xia-bai-su-zhen"]), /鞠婧祎版完整30小节.*196次起音、120拍.*原C调G3–D5与82 BPM.*五个无定量倚音.*器乐前后奏/);
  assert.match(getSongReviewNotice(library["rang-wo-men-dang-qi-shuang-jiang"]), /30小节.*63个单音.*60拍.*降E调.*C调.*省略第7小节无定量倚音.*96 BPM/);
  assert.match(getSongReviewNotice(library["tong-nian"]), /完整16小节单遍人声.*79次起音、64拍.*七处延音连接.*三处人声休止.*五排歌词.*105 BPM为练习设定/);
  assert.match(getSongReviewNotice(library["sheng-sheng-man"]), /24个实写小节.*反复走两遍.*252次主旋律起音、192拍.*72 BPM.*14个无定时倚音.*4处波音.*仅单音，无伴奏/);
  assert.match(getSongReviewNotice(library["hong-yan"]), /完整24小节.*98次起音、96个固定练习拍.*D调整体移至C调.*8组无定量倚音.*延长记号不另加拍.*56 BPM为练习设定/);
  assert.match(getSongReviewNotice(library["song-bie"]), /24小节教学版.*86个单音.*降E调移至C调.*六处两拍休止.*70 BPM/);
  assert.match(getSongReviewNotice(library.jasmine), /14小节短版.*67个单音、56拍.*1拍休止.*仅练主旋律/);
  assert.doesNotMatch(getSongReviewNotice(library.jasmine), /145音版|导入还原/);
  for (const song of notices) {
    assert.equal(getSongReviewNotice({ ...song, sourceFeatures: { unsupported: [] } }), "");
  }
});

test("actual library cards keep one icon action and leave source evidence out of the requested compact face", () => {
  const songLibrary = getSongLibrary();
  const node = (tag) => ({
    tag, children: [], textContent: "", className: "", attrs: {}, handlers: {},
    classList: { add() {} },
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, handler) { this.handlers[name] = handler; }
  });
  const context = {
    songLibrary, getSongDisplayTitle, readSongSpeed, browserPreferenceStorage, getPracticeSongId, getSongBaseId, getSongAccompanimentProvider, hasMatchingPracticeMelody, getSongArchiveDownload, getSongVersionRank, getSongReviewNotice, getSongPracticeHint, getSongMeterLabel,
    getLocalSongCopyLabel, getEventTotalBeats, getPracticeTotalBeats, DIFFICULTY_LABELS, normalizeDifficulty,
    document: { createElement: node }
  };
  runInNewContext(cardSource, context);
  const text = (element) => [element.textContent, ...element.children.map(text)].join(" ");
  const groups = context.getGroupedSongs(Object.values(songLibrary));
  for (const group of groups) {
    const card = context.createSongCard(group, "birthday", "birthday");
    const cardText = text(card);
    const details = card.children[0].children.find(element => element.tag === "details");
    assert.equal(details, undefined, group.primary.id);
    assert.equal(card.children[0].children[0].textContent, getSongDisplayTitle(group.primary));
    assert.equal(card.children.filter((element) => element.tag === "button").length, 1);
    assert.equal(/和弦版|版本 |chord version/i.test(cardText), false);
    assert.ok(group.primary.title, "source title remains in song data");
  }
  const legacy = { ...songLibrary["birthday-chord"], id: "local_pending_chord", baseSongId: "local_pending", source: "local" };
  songLibrary[legacy.id] = legacy;
  const [pending] = context.getGroupedSongs([legacy]);
  assert.equal(pending.practiceReady, false);
  assert.match(text(context.createLocalSongItem(pending)), /主旋律待核对，原始资料已保留/);
});
