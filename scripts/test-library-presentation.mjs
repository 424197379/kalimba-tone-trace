import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as songStore from "../src/song-store.js";
import { getSongDisplayTitle } from "../src/song-presentation.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { readSongSpeed, readPracticeHistory, SONG_SPEED_STORAGE_PREFIX, PRACTICE_HISTORY_STORAGE_KEY } from "../src/practice-preferences.js";

const source = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const production = source.slice(source.indexOf("function getSelectedSongId("), source.indexOf("function showImportMessage("));
const previousStorage = globalThis.localStorage;
globalThis.localStorage = { getItem: () => null };
const library = songStore.getSongLibrary();
if (previousStorage === undefined) delete globalThis.localStorage;
else globalThis.localStorage = previousStorage;

function element(tag = "div") {
  let content = "";
  return { tag, children: [], attrs: {}, handlers: {}, hidden: false, open: false, value: "", className: "",
    classList: { add() {} }, focus() { this.focused = true; },
    setAttribute(key, value) { this.attrs[key] = value; },
    addEventListener(name, handler) { this.handlers[name] = handler; },
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    replaceChildren(...nodes) { this.children = nodes; },
    get textContent() { return content; },
    set textContent(value) { content = String(value); this.children = []; },
    set innerHTML(value) { throw new Error(`Unexpected HTML insertion: ${value}`); }
  };
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const allText = node => descendants(node).map(item => item.textContent).join(" ");
const visibleNodes = node => [node, ...(node.tag === "details" && !node.open
  ? node.children.filter(child => child.tag === "summary") : node.children).flatMap(visibleNodes)];
const visibleText = node => visibleNodes(node).map(item => item.textContent).join(" ");

function harness(songs = library) {
  const values = new Map(), writes = [];
  const nodes = Object.fromEntries(["songList", "songSearchInput", "songCountText", "difficultyTabs", "emptySongText",
    "practiceHistoryMessage", "libraryRefreshMessage", "localSongCountText", "localSongEmptyText", "localSongList"].map(id => [id, element()]));
  const location = { href: "http://localhost/songs.html?selected=birthday", get search() { return new URL(this.href, "http://localhost").search; } };
  const context = { ...songStore, ...nodes, songLibrary: songs, getSongDisplayTitle, getPracticeTotalBeats, readSongSpeed, readPracticeHistory,
    browserPreferenceStorage: { getItem: key => values.get(key) ?? null, setItem: (...args) => writes.push(args) },
    activeDifficulty: "all", selectedSongOverride: null, displayedSongId: null,
    pendingDeleteBaseSongId: null, pendingDeleteSnapshot: null,
    URL, URLSearchParams, document: { createElement: element },
    window: { location, history: { state: {}, replaceState(_state, _title, url) { location.href = url; } } },
    readStoredSongId: () => "birthday", storeSongId: id => writes.push(["selection", id]), prepareImportDraftForLeave: () => true,
    openDeleteConfirm: group => { context.deleteTarget = group; }
  };
  runInNewContext(production, context);
  const groups = context.getGroupedSongs(Object.values(songs)).filter(group => group.practiceReady);
  return { context, nodes, groups, values, writes,
    card(id, selected = "birthday") {
      const group = groups.find(item => item.primary.id === id);
      assert.ok(group, id);
      return context.createSongCard(group, selected, songStore.getSongBaseId(songs[selected] || songs.birthday));
    }
  };
}

test("built-in edition labels become clean presentation titles without mutating source data", () => {
  const expected = { bluebird: "《青鸟》", katyusha: "《喀秋莎》", "tian-kong-zhi-cheng": "《天空之城》",
    jasmine: "《茉莉花》", "see-you-again": "《See You Again》", "sheng-sheng-man": "《声声慢》",
    "mo-he-wu-ting-verse": "《漠河舞厅》", "ju-ci-lang-de-xia-tian": "《菊次郎的夏天》" };
  const before = JSON.stringify(library);
  for (const [id, title] of Object.entries(expected)) assert.equal(getSongDisplayTitle(library[id]), title, id);
  for (const song of songStore.getPracticeSongs(library)) {
    assert.doesNotMatch(getSongDisplayTitle(song), /待核|简化版|改音版|教材|教学版|短版|选段|预览|首主题|声乐版|人声版|戏腔简谱版/);
  }
  assert.equal(getSongDisplayTitle(library["one-summers-day"]), "《那个夏天（One Summer’s Day）》", "legitimate parentheses are part of the name");
  assert.equal(JSON.stringify(library), before);
});

test("title helper preserves imported, unknown and newly changed titles literally", () => {
  for (const title of ["《青鸟》（待核简化版）", "《我的改音版之歌》（现场）", "  我的歌 (Acoustic)  ", "<img src=x onerror=alert(1)> & ‘版本’"]) {
    assert.equal(getSongDisplayTitle({ id: "bluebird", baseSongId: "bluebird", source: "local", title }), title);
    assert.equal(getSongDisplayTitle({ id: "unknown", source: "system", title }), title);
  }
  const changed = "《青鸟》（另一首同名歌曲）";
  assert.equal(getSongDisplayTitle({ ...library.bluebird, title: changed }), changed, "known ID alone cannot rename a future source title");
  assert.equal(getSongDisplayTitle(null), "");
});

test("all 37 cards show clean titles, all useful metadata and one accessible icon-only play button", () => {
  const h = harness(), before = JSON.stringify(library);
  assert.equal(h.groups.length, 37);
  for (const group of h.groups) {
    const song = group.primary, card = h.card(song.id), face = visibleText(card);
    const body = card.children[0], meta = body.children[1];
    assert.equal(body.children.length, 2, `${song.id}: only title and metadata`);
    assert.equal(body.children[0].textContent, getSongDisplayTitle(song), song.id);
    assert.equal(meta.className, "song-meta");
    const expected = [
      `难度 ${songStore.DIFFICULTY_LABELS[h.context.getSongDifficulty(song)]}`,
      `练习 ${h.context.formatDuration(h.context.getSongDuration(group, 1))}`,
      `作者 ${song.uploader || song.author || "system"}`,
      `练习速度 1.00x · ${Math.round(song.bpm)} BPM`,
      `音符 ${song.judgeNoteCount || song.steps.length}`
    ];
    assert.deepEqual(meta.children.map(node => node.textContent), expected, song.id);
    assert.ok(descendants(card).every(node => !node.hidden), `${song.id}: metadata never needs expansion`);
    assert.doesNotMatch(face, /详情|谱面名称|开始练习|继续练习|拍号|伴奏|待核|改音版|保留现有|来源|主旋律版/, song.id);
    assert.equal(descendants(card).some(node => ["details", "summary", "p"].includes(node.tag)), false, song.id);
    const buttons = descendants(card).filter(node => node.tag === "button");
    assert.equal(buttons.length, 1, song.id);
    assert.equal(buttons[0].type, "button");
    assert.equal(buttons[0].attrs["aria-label"], `练习${getSongDisplayTitle(song)}`);
    assert.equal(buttons[0].title, `练习${getSongDisplayTitle(song)}`);
    assert.equal(allText(buttons[0]).trim(), "", `${song.id}: no visible action words`);
    assert.equal(buttons[0].children.length, 1);
    assert.equal(buttons[0].children[0].className, "song-action-icon");
    assert.equal(buttons[0].children[0].attrs["aria-hidden"], "true");
    assert.equal(typeof buttons[0].handlers.click, "function");
  }
  assert.equal(JSON.stringify(library), before);
  assert.deepEqual(h.writes, [], "browsing cannot update speed, history or selection");
});

test("compact cards leave every original title, hint and review boundary intact only in the source helpers", () => {
  const h = harness();
  for (const group of h.groups) {
    const song = group.primary;
    const provider = group.accompanimentProvider?.kind === "light" ? group.accompanimentProvider.song : null;
    const before = JSON.stringify(song);
    const hint = songStore.getSongPracticeHint(song, provider), notice = songStore.getSongReviewNotice(song);
    const card = h.card(song.id), rendered = allText(card);
    assert.equal(JSON.stringify(song), before, song.id);
    assert.equal(songStore.getSongPracticeHint(song, provider), hint, song.id);
    assert.equal(songStore.getSongReviewNotice(song), notice, song.id);
    if (hint) assert.equal(rendered.includes(hint), false, `${song.id}: no score description in card DOM`);
    if (notice) assert.equal(rendered.includes(notice), false, `${song.id}: no source caveat in card DOM`);
    assert.equal(descendants(card).some(node => /song-card-(?:details|hint|source-title)|song-review-notice/.test(node.className)), false);
  }
});

test("saved practice speed and matching duration both stay visible", () => {
  const h = harness(), song = library.bluebird;
  h.values.set(`${SONG_SPEED_STORAGE_PREFIX}${song.id}`, JSON.stringify({ schemaVersion: 2, record: { speed: 0.8 } }));
  const group = h.groups.find(item => item.primary.id === song.id);
  const speed = readSongSpeed(h.context.browserPreferenceStorage, song.id).speed;
  assert.equal(speed, 0.8);
  const card = h.card(song.id), duration = card.children[0].children[1].children[1];
  assert.equal(duration.textContent, `练习 ${h.context.formatDuration(h.context.getSongDuration(group, speed))}`);
  assert.match(duration.title, /全曲一遍.*结尾休止.*0\.9 秒余音.*不含准备倒数.*循环次数/);
  assert.ok(visibleText(card).includes(`练习速度 0.80x · ${Math.round(song.bpm * .8)} BPM`));
  assert.deepEqual(h.writes, []);
});

test("imported titles and metadata use text nodes, and local practice/delete targets stay intact", () => {
  const title = '<img src=x onerror="alert(1)">《改音版》（现场） & 详情';
  const song = { ...library.bluebird, id: "local-test", baseSongId: "local-test", source: "local", title,
    hint: '<script>alert("hint")</script> 原始提示' };
  const h = harness({ ...library, [song.id]: song }), card = h.card(song.id);
  assert.equal(card.children[0].children[0].textContent, title);
  assert.equal(allText(card).includes(`谱面名称：${title}`), false);
  assert.equal(allText(card).includes(song.hint), false);
  assert.equal(card.children[1].attrs["aria-label"], `练习${title}`);
  assert.equal(descendants(card).some(node => ["img", "script"].includes(node.tag)), false);
  const group = h.groups.find(item => item.primary.id === song.id), item = h.context.createLocalSongItem(group);
  const practice = descendants(item).find(node => node.className === "ghost local-practice-btn");
  assert.equal(practice.attrs["aria-label"], `练习${title}`);
  practice.handlers.click();
  assert.equal(h.context.window.location.href, "./index.html?song=local-test&fromLibrary=1");
  const remove = descendants(item).find(node => node.className === "delete-song-btn");
  remove.handlers.click();
  assert.equal(h.context.deleteTarget, group);
});

test("clean cards preserve source-title search, difficulty filtering, recent sorting and canonical navigation", () => {
  const h = harness();
  h.nodes.songSearchInput.value = "待核简化版";
  h.context.renderSongList();
  assert.equal(h.nodes.songList.children.length, 1);
  assert.equal(h.nodes.songList.children[0].children[0].children[0].textContent, "《青鸟》");
  h.context.activeDifficulty = "easy";
  h.context.renderSongList();
  assert.equal(h.nodes.songList.children.length, 0);
  h.context.activeDifficulty = "all";
  h.nodes.songSearchInput.value = "";
  h.values.set(PRACTICE_HISTORY_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, songs: { bluebird: { lastPracticedAt: 200 }, jasmine: { lastPracticedAt: 100 } } }));
  h.context.renderSongList();
  assert.equal(h.nodes.songList.children[0].children[0].children[0].textContent, "《青鸟》");
  assert.equal(h.nodes.songList.children[1].children[0].children[0].textContent, "《茉莉花》");
  assert.deepEqual(h.writes, []);
  const button = h.card("jasmine", "jasmine-chord").children[1];
  assert.equal(button.attrs["aria-label"], "练习《茉莉花》");
  button.handlers.click();
  assert.equal(h.context.window.location.href, "./index.html?song=jasmine&fromLibrary=1");
  assert.deepEqual(h.writes, [["selection", "jasmine"]]);
});

test("every icon-only play action preserves canonical navigation for selected and unselected cards", () => {
  const h = harness();
  for (const group of h.groups) {
    const song = group.primary;
    for (const selected of [song.id, song.id === "birthday" ? "bluebird" : "birthday"]) {
      const button = h.card(song.id, selected).children[1];
      assert.equal(allText(button).trim(), "");
      button.handlers.click();
      assert.equal(h.context.window.location.href, `./index.html?song=${encodeURIComponent(song.id)}&fromLibrary=1`);
      assert.deepEqual(h.writes.at(-1), ["selection", song.id]);
    }
  }
});

test("icon-only play still pauses navigation when the import draft cannot be preserved", () => {
  const h = harness(), before = h.context.window.location.href;
  h.context.prepareImportDraftForLeave = () => false;
  h.card("bluebird").children[1].handlers.click();
  assert.equal(h.context.window.location.href, before);
  assert.deepEqual(h.writes, []);
  h.context.prepareImportDraftForLeave = () => true;
  h.card("bluebird").children[1].handlers.click();
  assert.equal(h.context.window.location.href, "./index.html?song=bluebird&fromLibrary=1");
  assert.deepEqual(h.writes, [["selection", "bluebird"]]);
});
