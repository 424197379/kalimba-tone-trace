import { getSongDisplayTitle } from "../src/song-presentation.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as songStore from "../src/song-store.js";
import { getSongLibrary, getSongReviewNotice, shouldExpandSongReviewNotice, getSongArchiveDownload } from "../src/song-store.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { readSongSpeed } from "../src/practice-preferences.js";

globalThis.localStorage = { getItem: () => null };
const library = getSongLibrary();
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const librarySource = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const cardSource = librarySource.slice(librarySource.indexOf("function getSelectedSongId("), librarySource.indexOf("function renderLocalSongManager("));
const applySource = appSource.match(/^    function applySongMeta\([^]*?^    \}/m)?.[0];
assert.ok(applySource);
const supportSource = ["getSongVariants", "getPracticeAccompanimentSource"].map(name => {
  const body = appSource.match(new RegExp(`^    function ${name}\\([^]*?^    }`, "m"))?.[0];
  assert.ok(body, `Missing actual support helper ${name}`);
  return body;
}).join("\n");
const informative = ["tong-nian", "hong-yan", "qing-cheng-shan-xia-bai-su-zhen", "rang-wo-men-dang-qi-shuang-jiang", "song-bie", "xuan-cao-hua", "ju-ci-lang-de-xia-tian", "ping-fan-zhi-lu", "da-yu", "qing-hua-ci", "ling-er-xiang-ding-dang", "zhu-zhu-xia-theme", "see-you-again", "tai-yang-zhao-chang-sheng-qi", "jasmine", "mi-xue-bing-cheng-theme", "da-yu-xiao-yu", "bie-kan-wo-zhi-shi-yi-zhi-yang"];
const warnings = ["bluebird", "katyusha", "tian-kong-zhi-cheng", "yun-yan-cheng-yu", "interstellar-main-theme"];

function harness(songs = library) {
  const domRequests = [];
  const context = { getSongDisplayTitle, getSongReviewNotice, shouldExpandSongReviewNotice, getSongPracticeHint: songStore.getSongPracticeHint, songLibrary: songs,
    getSongBaseId: songStore.getSongBaseId, getSongVersionRank: songStore.getSongVersionRank,
    hasMatchingPracticeMelody: songStore.hasMatchingPracticeMelody,
    getSongAccompanimentProvider: songStore.getSongAccompanimentProvider,
    document: { title: "", getElementById(id) {
      domRequests.push(id);
      assert.fail(`applySongMeta must not request removed review DOM: ${id}`);
    } },
    practiceTitle: {}, practiceHint: {}, currentSongText: {}, songSpeedBtn: { setAttribute(name, value) { this[name] = value; } },
    applySongVersionControl() {}, applyAccompanimentControl() {},
    getSongDefaultSpeedFactor: () => .9, setCompactIcon() {} };
  runInNewContext(`${supportSource}\n${applySource}`, context);
  return { domRequests, context, apply(song) { context.currentSong = song; context.applySongMeta(); } };
}

function element(tag) {
  return { tag, children: [], textContent: "", className: "", attributes: {}, handlers: {}, classList: { add() {} },
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.handlers[name] = handler; } };
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const text = node => descendants(node).map(item => item.textContent).join(" ");
const oldEditionCta = /可导入还原|旧(?:49音|145音|30小节|长)版|另存(?:资料|归档)|旧版.*(?:下载|恢复|还原|导入)/;

function assertNoCardProse(card, song) {
  const nodes = descendants(card), rendered = text(card);
  assert.equal(nodes.some(node => ["details", "summary", "p"].includes(node.tag)), false, song.id);
  assert.equal(nodes.some(node => /song-card-(?:details|hint|source-title)|song-review-notice/.test(node.className)), false, song.id);
  assert.doesNotMatch(rendered, /谱面名称|详情|开始练习|继续练习/, song.id);
  for (const prose of [song.hint, getSongReviewNotice(song)]) {
    if (prose) assert.equal(rendered.includes(prose), false, song.id);
  }
}
function assertSupportIsInternal(card, song) {
  assert.doesNotMatch(text(card), /伴奏|拍号/, song.id);
}

function libraryCards(songs = library) {
  const context = { ...songStore, getSongDisplayTitle, songLibrary: songs, getPracticeTotalBeats, readSongSpeed,
    browserPreferenceStorage: { getItem: () => null }, document: { createElement: element } };
  runInNewContext(cardSource, context);
  const groups = context.getGroupedSongs(Object.values(songs));
  return id => {
    const group = groups.find(item => item.primary.id === id);
    assert.ok(group?.practiceReady, id);
    return context.createSongCard(group, id, group.baseSongId);
  };
}

test("reviewed informational notices stay intact in source helpers without library prose", () => {
  const cardFor = libraryCards();
  for (const id of informative) {
    const before = getSongReviewNotice(library[id]);
    const h = harness(); h.apply(library[id]);
    assert.ok(before, id);
    assert.deepEqual(h.domRequests, [], id);
    assertNoCardProse(cardFor(id), library[id]);
    assert.equal(getSongReviewNotice(library[id]), before, id);
  }
});

test("practice metadata never queries removed disclosure nodes for unresolved source or instrument-fit warnings", () => {
  for (const id of warnings) {
    const h = harness(); h.apply(library[id]);
    assert.deepEqual(h.domRequests, [], id);
    assert.ok(getSongReviewNotice(library[id]).length > 0, id);
    assert.equal(h.context.currentSongText.textContent, getSongDisplayTitle(library[id]), id);
  }
});

test("every playable source keeps its original title and complete review evidence after compact rendering", () => {
  const cardFor = libraryCards(), before = JSON.stringify(library);
  for (const song of songStore.getPracticeSongs(library)) {
    const title = song.title, evidence = JSON.stringify(song.sourceFeatures), notice = getSongReviewNotice(song);
    const card = cardFor(song.id);
    assertNoCardProse(card, song);
    assert.equal(card.children[0].children[0].textContent, getSongDisplayTitle(song));
    assert.equal(song.title, title, song.id);
    assert.equal(JSON.stringify(song.sourceFeatures), evidence, song.id);
    assert.equal(getSongReviewNotice(song), notice, song.id);
  }
  assert.equal(JSON.stringify(library), before, "presentation cannot rewrite music or source evidence");
});

test("clean library titles leave unresolved source facts available through unchanged source helpers", () => {
  const cardFor = libraryCards();
  for (const id of warnings) {
    const song = library[id], notice = getSongReviewNotice(song), before = JSON.stringify(song);
    const card = cardFor(id);
    assertNoCardProse(card, song);
    assert.equal(card.children[0].children[0].textContent, getSongDisplayTitle(song));
    assert.doesNotMatch(text(card), /待核|改音版|来源|保留现有/, id);
    assert.ok(notice, id);
    assert.equal(getSongReviewNotice(song), notice, id);
    assert.equal(shouldExpandSongReviewNotice(song), true, `${id}: unresolved source classification is unchanged`);
    assert.equal(JSON.stringify(song), before, id);
  }
});

test("Interstellar's mixed-meter label and complete caution stay in source evidence", () => {
  const song = library["interstellar-main-theme"], h = harness(); h.apply(song);
  assert.deepEqual(h.domRequests, []);
  const card = libraryCards()(song.id);
  assertNoCardProse(card, song);
  assert.equal(songStore.getSongMeterLabel(song), "3/4 → 4/4");
  assert.doesNotMatch(text(card), /拍号/);
  const notice = getSongReviewNotice(song);
  assert.match(notice, /恢复三连音.*尾段密集.*慢速分段.*前段声部与音区仍待核.*第42小节起为4\/4/);
  assert.doesNotMatch(notice, /统一按3\/4显示/);
});

test("legacy warnings cannot be collapsed by another song's informational status", () => {
  for (const [id, unsupported] of [
    ["tian-kong-zhi-cheng", ["#4 and #5 mapped to nearby natural notes"]],
    ["interstellar-main-theme", ["44-49 triplets quantized to 0.25"]],
    ["yun-yan-cheng-yu", ["triplet and grace groups quantized to 0.25"]]
  ]) {
    for (const status of ["reviewed-selected-short-arrangement", "reviewed-vocal-melody-interlude-omitted"]) {
      const song = { id, sourceFeatures: { unsupported, sourceReview: { currentScopeReview: { status } } } };
      assert.ok(getSongReviewNotice(song));
      assert.equal(shouldExpandSongReviewNotice(song), true);
    }
  }
});

test("song changes update clean practice titles without touching review DOM or losing source warnings", () => {
  const h = harness();
  for (const id of ["katyusha", "song-bie", "da-yu-xiao-yu", "tian-kong-zhi-cheng", "birthday", "katyusha"]) {
    const song = library[id], before = JSON.stringify(song), notice = getSongReviewNotice(song);
    h.apply(song);
    assert.equal(h.context.currentSongText.textContent, getSongDisplayTitle(song), id);
    assert.equal(h.context.document.title, `卡林巴听弹练习 - ${getSongDisplayTitle(song)}`, id);
    assert.deepEqual(h.domRequests, [], id);
    assert.equal(getSongReviewNotice(song), notice, id);
    assert.equal(JSON.stringify(song), before, id);
  }
});

test("reviewed Porcelain displays the compatible optional-support hint without rewriting its historical V1", () => {
  const h = harness();
  const song = library["qing-hua-ci"];
  const before = JSON.stringify(song);
  assert.match(song.hint, /无伴奏/);
  h.apply(song);
  assert.equal(h.context.practiceHint.textContent, library["qing-hua-ci-reviewed-support"].hint);
  assert.match(h.context.practiceHint.textContent, /可选轻伴奏.*15.*默认关闭/);
  assert.match(h.context.practiceHint.textContent, /稀疏减配.*不是完整钢琴和声/);
  assert.doesNotMatch(h.context.practiceHint.textContent, /无伴奏/);
  assert.equal(JSON.stringify(song), before);
  h.apply(library.birthday);
  assert.equal(h.context.practiceHint.textContent, library.birthday.hint, "no stale Porcelain hint on song change");
});

test("Porcelain never advertises support when the companion is absent, empty, incompatible or outside reviewed scope", () => {
  for (const mutate of [
    songs => delete songs["qing-hua-ci-reviewed-support"],
    songs => songs["qing-hua-ci-reviewed-support"].practiceAccompaniment.events = [],
    songs => songs["qing-hua-ci-reviewed-support"].events[0].notes[0].name = "E5",
    songs => songs["qing-hua-ci-reviewed-support"].events[0].duration = 1,
    songs => songs["qing-hua-ci-reviewed-support"].bpm = 94,
    songs => songs["qing-hua-ci-reviewed-support"].sourceFeatures.sourceTotalBeats = 65,
    songs => songs["qing-hua-ci-reviewed-support"].baseSongId = "another-song",
    songs => songs["qing-hua-ci"].practiceAccompaniment = structuredClone(songs["qing-hua-ci-reviewed-support"].practiceAccompaniment),
    songs => songs["qing-hua-ci"].sourceFeatures.sourceReview.currentScopeReview.status = "needs-review",
    songs => songs["qing-hua-ci"].sourceFeatures.sourceReview.currentScopeReview.selectedEdition = "another-edition",
    songs => songs["qing-hua-ci-reviewed-support"].sourceFeatures.practiceAccompaniment.candidate = "another-candidate",
    songs => songs["qing-hua-ci-reviewed-support"].hint = " "
  ]) {
    const songs = structuredClone(library);
    mutate(songs);
    const h = harness(songs);
    h.apply(songs["qing-hua-ci"]);
    assert.equal(h.context.practiceHint.textContent, songs["qing-hua-ci"].hint);
    const card = libraryCards(songs)("qing-hua-ci");
    assertNoCardProse(card, songs["qing-hua-ci"]);
    assertSupportIsInternal(card, songs["qing-hua-ci"], songs);
  }
});

test("the real Porcelain card keeps optional support internal without leaking its practice hint or changing source data", () => {
  const before = JSON.stringify(library), song = library["qing-hua-ci"];
  const card = libraryCards()(song.id);
  const h = harness(); h.apply(song);
  const hint = songStore.getSongPracticeHint(song, library["qing-hua-ci-reviewed-support"]);
  assert.equal(hint, h.context.practiceHint.textContent);
  assert.equal(hint, library["qing-hua-ci-reviewed-support"].hint);
  assertSupportIsInternal(card, song);
  assertNoCardProse(card, song);
  assert.equal(text(card).includes(hint), false);
  assert.doesNotMatch(hint, /无伴奏/);
  assert.equal(JSON.stringify(library), before);
  assert.match(song.hint, /无伴奏/, "preserve historical source bytes");
});

test("shared hint helper cannot select a same-name or unselected source on its own", () => {
  const song = library["qing-hua-ci"], provider = library["qing-hua-ci-reviewed-support"];
  const before = JSON.stringify([song, provider]);
  assert.equal(songStore.getSongPracticeHint(song), song.hint);
  assert.equal(songStore.getSongPracticeHint(song, { ...provider, id: "other-support" }), song.hint);
  assert.equal(songStore.getSongPracticeHint(library.birthday, provider), library.birthday.hint);
  assert.equal(songStore.getSongPracticeHint(song, provider), provider.hint);
  assert.equal(JSON.stringify([song, provider]), before);
});

test("both current scores preserve source notices in data without old-edition choices or library prose", () => {
  const cardFor = libraryCards();
  const h = harness();
  for (const [id, source, scope] of [
    ["ling-er-xiang-ding-dang", /Coughlin.*16小节短版副歌主题/, /51个单音、64拍.*80 BPM.*同谱根音轻伴奏/],
    ["jasmine", /黄秀泉.*14小节短版/, /67个单音、56拍.*末尾1拍休止.*仅练主旋律/]
  ]) {
    const song = library[id];
    const card = cardFor(id);
    const nodes = descendants(card);
    assert.equal(nodes.some(node => node.tag === "a"), false, `${id}: no archive anchor`);
    const actions = nodes.filter(node => node.tag === "button");
    assert.equal(actions.length, 1, `${id}: only the existing practice action`);
    assert.equal(actions[0].title, `练习${getSongDisplayTitle(song)}`);
    assert.equal(typeof actions[0].handlers.click, "function");
    assertNoCardProse(card, song);
    assert.equal(text(actions[0]).trim(), "");
    assert.doesNotMatch(text(card), oldEditionCta, id);
    h.apply(song);
    assert.deepEqual(h.domRequests, [], id);
    assert.equal(h.context.practiceHint.textContent, song.hint, id);
    const notice = getSongReviewNotice(song);
    assert.match(notice, source, id);
    assert.match(notice, scope, id);
    assert.doesNotMatch(`${h.context.practiceHint.textContent} ${notice}`, oldEditionCta, id);
  }
});

test("production page templates and runtime contain no old-score link hookup", async () => {
  for (const [name, content] of [
    ["practice runtime", appSource], ["library runtime", librarySource],
    ["practice template", await readFile(new URL("../index.html", import.meta.url), "utf8")],
    ["library template", await readFile(new URL("../songs.html", import.meta.url), "utf8")]
  ]) {
    assert.doesNotMatch(content, /songArchiveLink|song-archive-link|getSongArchiveDownload|data\/archives\//, name);
  }
});

test("practice template and runtime contain no score-description disclosure or DOM hookup", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<details\b|<summary\b|songCaution|song-caution|谱面说明/);
  assert.doesNotMatch(appSource, /songCaution|song-caution|getSongReviewNotice|shouldExpandSongReviewNotice/);
  assert.doesNotMatch(librarySource, /createElement\("(?:details|summary)"\)|song-card-(?:details|hint|source-title)|song-review-notice|getSongReviewNotice|getSongPracticeHint/);
  const h = harness();
  for (const song of songStore.getPracticeSongs(library)) h.apply(song);
  assert.deepEqual(h.domRequests, []);
});

test("developer archive lookup keeps exact per-song targets, never arbitrary source paths", () => {
  for (const [id, filename] of [["jasmine", "jasmine-walter-v2.4.3.json"], ["ling-er-xiang-ding-dang", "ling-er-xiang-ding-dang-v2.4.15.json"]]) {
    assert.equal(getSongArchiveDownload(library[id]).href, `./data/archives/${filename}`);
  }
  for (const id of ["constructor", "__proto__", "unlisted", "jasmine"]) {
    const forged = structuredClone(library["ling-er-xiang-ding-dang"]);
    forged.id = forged.baseSongId = id;
    assert.equal(getSongArchiveDownload(forged), null);
  }
  const song = structuredClone(library["ling-er-xiang-ding-dang"]);
  for (const path of ["https://example.test/a.json", "data/archives/unlisted.json", "../private/a.json", "data/archives/jasmine-walter-v2.4.3.json"]) {
    song.sourceFeatures.sourceReview.currentScopeReview.archiveImportPath = path;
    assert.equal(getSongArchiveDownload(song), null);
  }
});

test("Daylily keeps optional support and its opt-in hint in source evidence outside the compact card", () => {
  const before = JSON.stringify(library), id = "xuan-cao-hua";
  const h = harness(); h.apply(library[id]);
  const card = libraryCards()(id), hint = songStore.getSongPracticeHint(library[id], library[`${id}-reviewed-support`]);
  assert.equal(h.context.practiceHint.textContent, library[`${id}-reviewed-support`].hint);
  assert.equal(hint, h.context.practiceHint.textContent);
  assert.match(hint, /可选轻伴奏.*默认关闭/);
  assertSupportIsInternal(card, library[id]);
  assertNoCardProse(card, library[id]);
  assert.equal(text(card).includes(hint), false);
  const notice = getSongReviewNotice(library[id]);
  assert.doesNotMatch(notice, /省略吉他前奏和伴奏/);
  assert.match(library[id].hint, /省略吉他前奏与伴奏/);
  assert.deepEqual(h.domRequests, []);
  assert.equal(JSON.stringify(library), before);
});

test("Daylily's two real surfaces conservatively fall back when reviewed support no longer matches",()=>{
  const id="xuan-cao-hua",sid=`${id}-reviewed-support`;
  for(const mutate of [s=>delete s[sid],s=>s[sid].events[0].duration=.5,
    s=>s[sid].bpm=85,s=>s[sid].sourceFeatures.sourceTotalBeats=193,
    s=>s[sid].sourceFeatures.practiceAccompaniment.candidate="unknown",
    s=>s[id].sourceFeatures.sourceReview.currentScopeReview.selectedEdition="unknown"]){
    const songs=structuredClone(library);mutate(songs);
    const h=harness(songs);h.apply(songs[id]);
    const card=libraryCards(songs)(id);
    assert.equal(h.context.practiceHint.textContent,songs[id].hint);
    assertNoCardProse(card,songs[id]);
    assertSupportIsInternal(card,songs[id],songs);
  }
});


test("historical Childhood opening-only warning stays expanded when its original metadata is read",async()=>{
  const old=JSON.parse(await readFile(new URL("../data/archives/tong-nian-v2.4.37.json",import.meta.url),"utf8"));
  assert.match(getSongReviewNotice(old),/仅修正开头两处.*其余段落仍待核/);
  assert.equal(shouldExpandSongReviewNotice(old),true);
});
