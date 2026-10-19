import { getSongDisplayTitle } from "../src/song-presentation.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as songStore from "../src/song-store.js";
import { getPracticeTotalBeats } from "../src/practice-loop.js";
import { readSongSpeed, saveSongSpeed, readSongAccompaniment, SONG_SPEED_STORAGE_KEY } from "../src/practice-preferences.js";
import { NOTE_INDEX, SONG_LIBRARY } from "../src/songs.js";

const ID = "jue-bie-shu";
const STATUS = "unresolved-full-script-melody-role";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");
const raw = JSON.parse(await read(`data/songs/${ID}.json`));
const previousStorage = globalThis.localStorage;
globalThis.localStorage = { getItem: () => null };
const library = songStore.getSongLibrary();
if (previousStorage === undefined) delete globalThis.localStorage;
else globalThis.localStorage = previousStorage;
const appSource = await read("src/app.js");
const librarySource = await read("src/song-library.js");
const cardSource = librarySource.slice(librarySource.indexOf("function getSelectedSongId("), librarySource.indexOf("function renderLocalSongManager("));
const extract = name => {
  const body = appSource.match(new RegExp(`^    function ${name}\\([^]*?^    \\}`, "m"))?.[0];
  assert.ok(body, `Missing actual production helper ${name}`);
  return body;
};
const scope = song => song?.sourceFeatures?.sourceReview?.currentScopeReview;

function assertWarning(notice) {
  assert.ok(notice, "Juebie must disclose its unresolved melody-role boundary");
  assert.match(notice, /保留.*334.*单音/);
  assert.match(notice, /历史.*(?:跨谱|来源).*仅.*开头主题/);
  assert.match(notice, /15\s*键脚本.*未.*(?:旋律声部|主旋律)/);
  assert.match(notice, /(?:全程|全部).*单音取舍.*待核/);
  assert.match(notice, /完整脚本.*不等于.*完整旋律.*已核准/);
  assert.doesNotMatch(notice, /已证实.*错|确认.*错误|已修正334|已完成全曲复核|可导入还原|旧版.*(?:下载|恢复|还原|导入)/);
}

test("source recovery is explicitly separate from full-span melody certification", () => {
  const current = scope(raw);
  assert.equal(current?.status, STATUS);
  assert.equal(current.reviewScope, "source-recovery-and-melody-role-boundary-only");
  assert.equal(current.productionTupleComparison, false);
  assert.equal(current.fullSpanMelodyReview, false);
  assert.equal(typeof current.historicalEvidenceBoundary, "string");
  assert.ok(current.historicalEvidenceBoundary.trim());
  assert.deepEqual(scope(SONG_LIBRARY[ID]), current, "generated source must carry the same warning metadata");
});

test("the current single-note edition has an unresolved warning that starts expanded", () => {
  assertWarning(songStore.getSongReviewNotice(raw));
  assert.equal(songStore.getSongReviewNotice(library[ID]), songStore.getSongReviewNotice(raw));
  assert.equal(songStore.shouldExpandSongReviewNotice(library[ID]), true);
});

// Frozen v2.4.42 production fingerprints prove non-mutation only. They are not
// source-derived expected notes, recovered-score evidence or musical approval.
const musicFields = ["schemaVersion", "id", "baseSongId", "arrangementKind", "judgementMode", "versionLabel",
  "tuning", "difficulty", "bpm", "defaultSpeedFactor", "beatsPerMeasure", "key", "steps", "events", "rhythm",
  "autoAccompaniment", "practiceAccompaniment"];
const timingFields = ["sourceTotalBeats", "sourceMeasureCount", "meterDisplay", "practiceAccompaniment"];
const music = song => ({
  ...Object.fromEntries(musicFields.filter(key => Object.hasOwn(song, key)).map(key => [key, song[key]])),
  sourceTiming: Object.fromEntries(timingFields.filter(key => Object.hasOwn(song.sourceFeatures || {}, key))
    .map(key => [key, song.sourceFeatures[key]]))
});

test("structural preservation: the original 57 built-in music records remain frozen at v2.4.42", async () => {
  const files = (await readdir(new URL("../data/songs/", import.meta.url))).filter(file => file.endsWith(".json")).sort();
  assert.equal(files.length, 58);
  const songs = await Promise.all(files.map(async file => JSON.parse(await read(`data/songs/${file}`))));
  // The new melody was not part of the frozen v2.4.42 corpus.
  const originalSongs = songs.filter(song => song.id !== "fan-fang-xiang-de-zhong");
  assert.equal(originalSongs.length, 57);
  assert.equal(hash(JSON.stringify(originalSongs.map(music))), "dd25890b394454fcacf9e2b2d87593cc6c8bd8a87d0a60635792fe5aca448a7a");
  for (const song of songs) assert.deepEqual(music(SONG_LIBRARY[song.id]), music(song), `generated music: ${song.id}`);
});

test("334 retained tuples, 85 BPM and the 0.82 suggestion are unchanged, without new score claims", () => {
  assert.equal(raw.id, ID);
  assert.equal(raw.schemaVersion, 1);
  assert.equal(raw.steps.length, 334);
  assert.equal(hash(JSON.stringify(raw.steps)), "ea0e82d5bfbefe662c05edd96c54397da9021bbcd6fc5517fadf7941dc67f684");
  assert.equal(raw.bpm, 85);
  assert.equal(raw.defaultSpeedFactor, .82);
  assert.equal(raw.beatsPerMeasure, 4);
  assert.equal(raw.key, "C");
  assert.equal(raw.difficulty, "hard");
  assert.equal(Math.max(...raw.steps.map(([, beat, duration]) => beat + duration)), 204,
    "204 is the preserved encoded end, not a newly verified source ending");
  for (const field of ["events", "rhythm", "autoAccompaniment", "practiceAccompaniment"]) {
    assert.equal(Object.hasOwn(raw, field), false, `no new playable layer: ${field}`);
  }
  for (const field of ["sourceTotalBeats", "sourceMeasureCount"]) {
    assert.equal(Object.hasOwn(raw.sourceFeatures, field), false, `no new source extent: ${field}`);
  }
});

test("historical metadata and the complete previous V1 JSON remain reconstructible", () => {
  const original = structuredClone(raw);
  delete original.sourceFeatures.sourceReview.currentScopeReview;
  assert.equal(hash(JSON.stringify(original.sourceFeatures)), "c4f002759bcea80afb80a0c91ff54545fd668c371291f041fb34bc0f00f23b96");
  assert.equal(hash(JSON.stringify(original, null, 2) + "\n"), "d25e64984938aa71106508fcefbcc68f5f9a436da3c0ceeafa6d4cf836bacf97");
  assert.equal(original.sourceFeatures.sourceReview.confidence, "high-for-theme-and-script-timing",
    "this historical label is retained as provenance, not promoted to full-span certification");
});

test("the historical chord/source sibling is byte-for-byte unchanged", async () => {
  assert.equal(hash(await read(`data/songs/${ID}-chord.json`)), "e441e4c36f41d1cb2315b24b4ce837e6adb66d0cd3656f62aba9c8896f8a004a");
  assert.equal(songStore.getSongReviewNotice(library[`${ID}-chord`]), "",
    "the preserved source sibling itself does not acquire V1 review certification");
});

test("Juebie's warning requires its song identity and exact unresolved status", () => {
  const current = { id: ID, sourceFeatures: { sourceReview: { currentScopeReview: { status: STATUS } } } };
  assertWarning(songStore.getSongReviewNotice(current));
  for (const id of ["birthday", "unrelated-jue-bie-shu", "constructor", "__proto__"]) {
    const other = structuredClone(current);
    other.id = id;
    other.title = raw.title;
    assert.equal(songStore.getSongReviewNotice(other), "", id);
    assert.equal(songStore.shouldExpandSongReviewNotice(other), false, id);
  }
  for (const status of [undefined, "", "needs-review", "unresolved-melody-source-mapping",
    "reviewed-selected-short-arrangement", "reviewed-vocal-melody-interlude-omitted", "reviewed-selected-complete-vocal-edition"]) {
    const other = structuredClone(current);
    scope(other).status = status;
    assert.equal(songStore.getSongReviewNotice(other), "", String(status));
    assert.equal(songStore.shouldExpandSongReviewNotice(other), false, String(status));
  }
});

test("generic confidence or approval flags never override an unresolved Juebie warning", () => {
  const song = structuredClone(raw);
  song.sourceFeatures.sourceReview.currentScopeReview = { status: STATUS,
    fullSongApproved: true, sourceCalibrated: true, confidence: "high", reviewed: true };
  song.sourceFeatures.sourceReview.confidence = "high-for-theme-and-script-timing";
  song.sourceFeatures.suitability = { status: "suitable" };
  assertWarning(songStore.getSongReviewNotice(song));
  assert.equal(songStore.shouldExpandSongReviewNotice(song), true);
  delete song.sourceFeatures.sourceReview.currentScopeReview;
  assert.equal(songStore.getSongReviewNotice(song), "", "historical confidence alone creates no approval notice");
});

function storage(songs) {
  const values = new Map();
  if (songs) values.set(SONG_SPEED_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, songs }));
  const writes = [];
  return { values, writes, getItem: key => values.get(key) ?? null,
    setItem(key, value) { writes.push([key, value]); values.set(key, String(value)); } };
}

function element(tag) {
  return { tag, children: [], textContent: "", className: "", attributes: {}, handlers: {},
    classList: { add() {}, toggle() {} },
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(name, handler) { this.handlers[name] = handler; } };
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const cardText = node => descendants(node).map(item => item.textContent).join(" ");

function cards(store = storage()) {
  const context = { ...songStore, getSongDisplayTitle, songLibrary: library, getPracticeTotalBeats, readSongSpeed,
    browserPreferenceStorage: store, document: { createElement: element },
    prepareImportDraftForLeave: () => true, window: { location: { href: "" } } };
  runInNewContext(cardSource, context);
  const remembered = [];
  context.rememberLibrarySelection = id => remembered.push(id);
  const groups = context.getGroupedSongs(Object.values(library));
  const group = groups.find(item => item.primary.id === ID);
  assert.ok(group?.practiceReady);
  return { group, context, remembered,
    card(selected = ID) { return context.createSongCard(group, selected, group.baseSongId); } };
}

// Execute real production selection, metadata, single-note targets, backing and
// speed restoration. Stub only DOM/rendering, clocks and selection persistence.
const runtimeNames = ["setCurrentSong", "applySongMeta", "getSongDefaultSpeedFactor", "applySongVersionControl",
  "applyAccompanimentControl", "getSongVariants", "buildSongEvents", "buildAutoAccompanimentEvents",
  "getPracticeAccompanimentSource", "getPracticeAccompanimentConfig", "getAccompanimentConfig",
  "getDefaultAccompanimentVolume", "getSongAccompanimentSignature", "restoreSongAccompaniment",
  "applySpeed", "getScaledBeatSeconds", "getSongEndSeconds", "getSongProgressDuration", "admitPracticeFrame"];
const runtimeSource = runtimeNames.map(extract).join("\n");

function runtime(store = storage()) {
  const domRequests = [];
  const selected = [];
  const context = { ...songStore, getSongDisplayTitle, NOTE_INDEX, getPracticeTotalBeats, readSongSpeed, saveSongSpeed, readSongAccompaniment,
    songLibrary: library, browserPreferenceStorage: store, sessionAccompanimentChoices: new Map(),
    storedAccompanimentVolume: null, accompanimentStyleSelect: element("select"), accompanimentBtn: element("button"),
    accompanimentVolumeWrap: null, accompanimentVolumeSlider: null, accompanimentVolumeValue: null,
    speedSlider: {}, speedValue: {}, speedFactor: 1, baseFallLeadSeconds: 3.15, statusText: { textContent: "待开始" },
    practiceLoopRange: null, practiceRunning: false, demoMode: false, pendingPlayback: null,
    pausedSession: null, resumePreparation: null, lastPracticeFrameSeconds: null,
    document: { title: "", getElementById(id) {
      domRequests.push(id);
      assert.fail(`practice metadata must not request removed review DOM: ${id}`);
    } },
    practiceTitle: {}, practiceHint: {}, currentSongText: {}, songSpeedBtn: { setAttribute(name, value) { this[name] = value; } }, songVersionBtn: element("button"),
    clearPracticeInteractions() {}, renderStaticBoard() {}, resetPracticeState() {}, showKeyWidthStatus() {},
    storeSongId: id => selected.push(id), setCompactIcon() {}, renderBoard() {},
    currentPracticeTime: () => 0, shouldLoop: () => false, getSessionLeadSeconds: () => 999,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)) };
  runInNewContext(runtimeSource, context);
  return { context, domRequests, selected, apply(id = ID) { context.setCurrentSong(id); } };
}

test("compact library card omits review prose while unchanged source evidence keeps Juebie unresolved", () => {
  const before = JSON.stringify(library);
  const warning = songStore.getSongReviewNotice(library[ID]);
  const list = cards(), card = list.card(), nodes = descendants(card);
  assert.equal(nodes.some(node => ["details", "summary", "p"].includes(node.tag)), false);
  assert.equal(nodes.some(node => /song-review-notice|song-card-hint/.test(node.className)), false);
  assert.equal(card.children[0].children[0].textContent, getSongDisplayTitle(library[ID]));
  assert.equal(cardText(card).includes(warning), false);
  assertWarning(songStore.getSongReviewNotice(library[ID]));
  assert.equal(songStore.getSongReviewNotice(library[ID]), warning);
  const app = runtime(); app.apply();
  assert.deepEqual(app.domRequests, []);
  assert.equal(app.context.songVersionBtn.hidden, true);
  assert.equal(app.context.songVersionBtn.disabled, true);
  assert.equal(nodes.some(node => node.tag === "a"), false);
  const buttons = nodes.filter(node => node.tag === "button");
  assert.equal(buttons.length, 1);
  assert.equal(cardText(buttons[0]).trim(), "");
  assert.doesNotMatch(cardText(card), /详情|谱面名称|待核|可导入还原|旧版.*(?:下载|恢复|还原|导入)/);
  assert.equal(songStore.getSongArchiveDownload(library[ID]), null);
  assert.equal(JSON.stringify(library), before, "compact presentation does not mutate the library");
});

test("actual song changes never query removed review nodes and preserve Juebie source evidence", () => {
  const app = runtime(), before = JSON.stringify(library);
  for (const id of [ID, ID, "song-bie", ID, "birthday", ID]) {
    app.apply(id);
    assert.equal(app.context.currentSongText.textContent, getSongDisplayTitle(library[id]), id);
    assert.equal(app.context.document.title, `卡林巴听弹练习 - ${getSongDisplayTitle(library[id])}`, id);
    assert.deepEqual(app.domRequests, [], id);
    if (id === ID) assertWarning(songStore.getSongReviewNotice(library[id]));
    else if (id === "birthday") assert.equal(songStore.getSongReviewNotice(library[id]), "");
    else assert.match(songStore.getSongReviewNotice(library[id]), /24小节教学版.*86个单音/);
  }
  assert.equal(JSON.stringify(library), before);
});

test("legacy chord links still select V1 and every physical target remains a single melody note", () => {
  const requested = `${ID}-chord`;
  assert.equal(songStore.getPracticeSongId(library, requested), ID);
  const app = runtime(); app.apply(requested);
  assert.equal(app.context.currentSongId, ID);
  assert.equal(app.context.currentSong, library[ID]);
  assert.deepEqual(app.selected, [ID]);
  assert.equal(app.context.songEvents.length, 334);
  for (const event of app.context.songEvents) {
    assert.equal(event.notes.length, 1);
    assert.equal(event.judgeNotes.length, 1);
    assert.equal(event.judgeLanes.length, 1);
    assert.equal(event.judgeNotes[0].role, "melody");
    assert.equal(event.judgeNotes[0].judge, true);
  }
  const list = cards();
  const button = descendants(list.card(requested)).find(node => node.tag === "button");
  button.handlers.click();
  assert.equal(list.context.window.location.href, `./index.html?song=${ID}&fromLibrary=1`);
  assert.deepEqual(list.remembered, [ID]);
});

test("compact metadata preserves visible remembered speed and legacy backing behavior", () => {
  const store = storage({ [ID]: { speed: .7, untouched: "keep" }, [`${ID}-chord`]: { speed: 1.2 } });
  const original = store.getItem(SONG_SPEED_STORAGE_KEY);
  const app = runtime(store); app.apply(`${ID}-chord`);
  assert.equal(app.context.speedSlider.value, "0.70");
  assert.equal(app.context.speedFactor, .7);
  assert.equal(app.context.songSpeedBtn.textContent, "1.0");
  assert.equal(app.context.songSpeedBtn["aria-label"], "恢复 1.0 倍原速");
  assert.equal(library[ID].defaultSpeedFactor, .82, "musical recommendation metadata remains unchanged");
  const card = cards(store).card(`${ID}-chord`);
  assert.equal(descendants(card).some(node => node.tag === "details"), false);
  assert.match(cardText(card.children[0].children[1]), /练习速度 0\.70x/);
  app.context.applySongMeta();
  assert.equal(app.context.speedFactor, .7);
  assert.equal(store.getItem(SONG_SPEED_STORAGE_KEY), original);
  assert.deepEqual(store.writes, []);
  assert.equal(app.context.accompanimentStyle, "original");
  assert.equal(app.context.accompanimentEvents.length, 23);
  assert.equal(app.context.accompanimentEnabled, false, "existing opt-in behavior stays unchanged");
  assert.equal(app.context.getPracticeAccompanimentSource(library[ID]), null, "no new reviewed-light provider");
  const fresh = runtime(); fresh.apply();
  assert.equal(fresh.context.speedFactor, 1, "user-requested first-visit normal speed is independent of the retained 0.82 recommendation");
});
