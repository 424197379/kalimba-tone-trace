import { getSongDisplayTitle } from "../src/song-presentation.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as songStore from "../src/song-store.js";
import { createLoopRange, getPracticeTotalBeats, snapLoopBoundary } from "../src/practice-loop.js";
import { readSongSpeed, SONG_SPEED_STORAGE_KEY } from "../src/practice-preferences.js";

const source = JSON.parse(await readFile(new URL("../data/songs/interstellar-main-theme.json", import.meta.url), "utf8"));
const librarySource = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const cardSource = librarySource.slice(librarySource.indexOf("function getSelectedSongId("), librarySource.indexOf("function renderLocalSongManager("));
const sha = value => createHash("sha256").update(value).digest("hex");
globalThis.localStorage = { getItem: () => null };
const library = songStore.getSongLibrary();

function element(tag) {
  return { tag, children: [], textContent: "", className: "", attrs: {}, handlers: {}, classList: { add() {} },
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, handler) { this.handlers[name] = handler; },
    set innerHTML(value) {
      assert.equal(tag, "button", "metadata must use textContent, never HTML");
      assert.equal(value, '<span class="song-action-icon" aria-hidden="true"></span>');
    } };
}
function cards(songs = library, speed) {
  const writes = [];
  const values = new Map(speed === undefined ? [] : [[SONG_SPEED_STORAGE_KEY,
    JSON.stringify({ schemaVersion: 1, songs: { "interstellar-main-theme": { speed } } })]]);
  const context = { ...songStore, getSongDisplayTitle, songLibrary: songs, getPracticeTotalBeats, readSongSpeed,
    browserPreferenceStorage: { getItem: key => values.get(key) ?? null, setItem: (...args) => writes.push(args) },
    document: { createElement: element } };
  runInNewContext(cardSource, context);
  return { context, writes, groups: context.getGroupedSongs(Object.values(songs)),
    render(group) { return context.createSongCard(group, group.primary.id, group.baseSongId); } };
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const faceMeta = card => card.children[0].children[1].children.map(node => node.textContent);
const disclosure = card => card.children[0].children.find(node => node.tag === "details");
const meta = card => descendants(card).filter(node => node.className === "song-meta-item").map(node => node.textContent);
const assertMeterIsInternal = card => {
  assert.equal(disclosure(card), undefined, "card has no metadata disclosure");
  assert.equal(meta(card).some(value => value.startsWith("拍号 ")), false, "meter remains in source helpers, outside the card");
};

test("the display helper accepts only bounded quarter-note meter labels and trims outer space", () => {
  for (const [value, expected] of [["3/4 → 4/4", "3/4 → 4/4"], ["  3/4 → 4/4\n", "3/4 → 4/4"],
    ["4/4", "4/4"], ["2/4 → 3/4 → 4/4", "2/4 → 3/4 → 4/4"]]) {
    assert.equal(songStore.getSongMeterLabel({ beatsPerMeasure: 3, sourceFeatures: { meterDisplay: value } }), expected);
  }
  const invalid = [undefined, null, 34, true, [], [3, 4], {}, { toString() { assert.fail("must not coerce display objects"); } },
    "", " \t\n ", "3/4 -> 4/4", "3/4→4/4", "3/4\n→ 4/4", "3/4 → 9/4", "3/4 → 4/8", "1/4", "12/4",
    "3/4 → 4/4 (verified)", "<img src=x onerror=alert(1)>", "3/4 → 4/4<script>alert(1)</script>",
    Array(9).fill("3/4").join(" → "), "3/4".repeat(1000)];
  for (const value of invalid) {
    assert.equal(songStore.getSongMeterLabel({ beatsPerMeasure: 3, sourceFeatures: { meterDisplay: value } }), "3/4");
    assert.equal(songStore.getSongMeterLabel({ beatsPerMeasure: 4, sourceFeatures: { meterDisplay: value } }), "4/4");
  }
});

test("missing metadata and ordinary 4/4 songs keep the old scalar label without guessing from prose", () => {
  for (const sourceFeatures of [undefined, {}, { meterMap: [{ beat: 123, beats: 4 }] },
    { unsupported: ["3/4 changes to 4/4"], sourceReview: { currentScopeReview: { sourceMeterInScope: "4/4" } } }]) {
    assert.equal(songStore.getSongMeterLabel({ id: "interstellar-main-theme", title: "3/4 → 4/4", beatsPerMeasure: 3,
      hint: "Change at m42", sourceFeatures }), "3/4");
  }
  assert.equal(songStore.getSongMeterLabel({ beatsPerMeasure: 4 }), "4/4");
});

test("only the canonical Interstellar source declares the optional display field", async () => {
  const declared = [];
  for (const name of await readdir(new URL("../data/songs/", import.meta.url))) {
    if (!name.endsWith(".json")) continue;
    const song = JSON.parse(await readFile(new URL(`../data/songs/${name}`, import.meta.url), "utf8"));
    if (Object.hasOwn(song.sourceFeatures || {}, "meterDisplay")) declared.push(song.id);
  }
  assert.deepEqual(declared, ["interstellar-main-theme"]);
  assert.equal(library["interstellar-main-theme"].sourceFeatures.meterDisplay, "3/4 → 4/4", "generated library is rebuilt");
  assert.equal(songStore.getPracticeSongId(library, "interstellar-main-theme-chord"), "interstellar-main-theme");
  assert.equal(songStore.getSongMeterLabel(library["interstellar-main-theme-chord"]), "3/4", "do not relabel or certify the frozen V2");
});

test("actual compact cards leave canonical meter labels intact only in the source helpers", () => {
  const h = cards();
  const before = JSON.stringify(library);
  for (const group of h.groups) {
    const expected = group.primary.id === "interstellar-main-theme" ? "3/4 → 4/4" : `${group.primary.beatsPerMeasure}/4`;
    assertMeterIsInternal(h.render(group));
    assert.equal(songStore.getSongMeterLabel(group.primary), expected, group.primary.id);
  }
  assert.equal(JSON.stringify(library), before);
  assert.deepEqual(h.writes, []);
});

test("local display declarations are plain labels, invalid markup falls back without changing imported music", () => {
  for (const label of ["3/4 → 4/4", "<img src=x onerror=alert(1)>", "3/4 → 4/4<script>alert(1)</script>"]) {
    const [song] = songStore.parseImportedSongs(JSON.stringify({ schemaVersion: 2, id: "local-meter-test", title: "Local meter test",
      arrangementKind: "melody", judgementMode: "melody", bpm: 90, beatsPerMeasure: 3,
      events: [{ beat: 0, duration: 1, notes: [{ name: "C4", role: "melody", judge: true }] }],
      sourceFeatures: { meterDisplay: label } }));
    const before = JSON.stringify(song);
    const h = cards({ [song.id]: song });
    assertMeterIsInternal(h.render(h.groups[0]));
    assert.equal(songStore.getSongMeterLabel(song), label === "3/4 → 4/4" ? label : "3/4");
    assert.equal(JSON.stringify(song), before);
    assert.equal(song.bpm, 90);
    assert.equal(song.beatsPerMeasure, 3);
    assert.deepEqual(song.steps, [["C4", 0, 1]]);
  }
});

test("removing only the new display fields reconstructs the exact frozen 2.4.26 source", () => {
  const reconstructed = structuredClone(source);
  delete reconstructed.sourceFeatures.meterDisplay;
  delete reconstructed.sourceFeatures.meterDisplayReview;
  assert.equal(sha(JSON.stringify(reconstructed, null, 2) + "\n"), "d273814a619aab0531ffacdea7947839020a7ac71729f1934cb0a99da7462841");
  assert.equal(source.steps.length, 290);
  assert.equal(sha(JSON.stringify(source.steps)), "4f4107796157aebc7fd1259ccd265a048d8069282f2fd8097481f7ef90ccf6f2");
  assert.equal(source.bpm, 90);
  assert.equal(source.beatsPerMeasure, 3);
  assert.equal(source.defaultSpeedFactor, .82);
  assert.deepEqual(source.sourceFeatures.sourceReview.currentScopeReview.reviewedBeatRanges, [[131, 155]]);
  assert.deepEqual(source.sourceFeatures.sourceReview.currentScopeReview.deferredBeatRanges, [[0, 131], [155, 159]]);
});

test("label metadata does not alter first-play or remembered-speed durations, selection or preferences", () => {
  const withoutLabel = structuredClone(library);
  delete withoutLabel["interstellar-main-theme"].sourceFeatures.meterDisplay;
  for (const speed of [undefined, .35, .75, 1, 1.4]) {
    const actual = cards(library, speed), prior = cards(withoutLabel, speed);
    const first = actual.groups.find(group => group.primary.id === "interstellar-main-theme");
    const second = prior.groups.find(group => group.primary.id === "interstellar-main-theme");
    assert.equal(first.primary.id, second.primary.id);
    assert.equal(actual.context.getSongTotalBeats(first.primary, first.initialAccompaniment), 159);
    assert.deepEqual(meta(actual.render(first)).filter(value => !value.startsWith("拍号 ")),
      meta(prior.render(second)).filter(value => !value.startsWith("拍号 ")));
    const card = actual.render(first);
    assert.match(faceMeta(card).find(value => value.startsWith("练习 ")), /^练习 约 /);
    assert.equal(disclosure(card), undefined);
    assert.ok(faceMeta(card).includes(`练习速度 ${(speed ?? 1).toFixed(2)}x · ${Math.round(first.primary.bpm * (speed ?? 1))} BPM`));
    assert.deepEqual(actual.writes, []);
    assert.deepEqual(prior.writes, []);
  }
});

test("onset-aligned loops retain their exact meter-independent and triplet boundaries", () => {
  const song = library["interstellar-main-theme"], events = song.events;
  const end = getPracticeTotalBeats(events, song);
  assert.equal(end, 159);
  for (const [beat, startBeat, endBeat] of [[123, 123, 131], [131, 131, 139], [131.2, 131 + 1 / 6, 139 + 1 / 6], [147, 147, 155]]) {
    assert.deepEqual(createLoopRange(events, end, beat), { startBeat, endBeat });
  }
  assert.deepEqual(snapLoopBoundary(events, end, { startBeat: 131, endBeat: 139 }, "end", 131.2),
    { startBeat: 131, endBeat: 131 + 1 / 6 });
});
