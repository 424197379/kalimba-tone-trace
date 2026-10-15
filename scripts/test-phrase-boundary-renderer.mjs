import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createLoopBoundaryRenderer } from "../src/phrase-boundary-renderer.js";
import { DISPLAY_KEYS } from "../src/songs.js";
import { harness, production, element, lifecycle } from "./helpers/practice-startup-harness.mjs";

function dom(tag = "div") {
  return Object.assign(element(), { tag, children: [],
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    replaceChildren(...nodes) { this.children = nodes; } });
}
function fixture({ compact = false, range = { startBeat: 1, endBeat: 4 } } = {}) {
  const h = harness({ beats: [0, 1, 2, 4, 8], range });
  const { c } = h;
  c.DISPLAY_KEYS = DISPLAY_KEYS;
  c.songEvents.forEach((e, i) => { e.notes = [{ name: DISPLAY_KEYS[i].name, lane: i, role: "melody", judge: true }]; });
  c.boardTop = Object.assign(dom(), { clientHeight: compact ? 110 : 260 });
  c.document.createElement = dom;
  for (const name of ["renderDegreeMarkup", "getToneXPercent", "renderEventNotesMarkup"]) production(name, c);
  c.loopBoundaryPreview = createLoopBoundaryRenderer({ document: c.document, board: c.boardShell,
    boardTop: c.boardTop, getEvents: () => c.songEvents, getTotalBeats: () => c.songTotalBeats,
    getRange: () => c.practiceLoopRange, isCompact: () => compact, renderNotes: c.renderEventNotesMarkup });
  const overlay = c.boardTop.children[0], notes = overlay.children[0], marker = overlay.children[1];
  const pointer = (extra = {}) => ({ pointerId: 7, button: 0, isPrimary: true, clientX: 500,
    clientY: 500, currentTarget: c.loopEndHandle, preventDefault() {}, ...extra });
  return { ...h, overlay, notes, marker, pointer };
}
for (const compact of [false, true]) for (const edge of ["start", "end"]) {
  test(`actual ${compact ? "compact" : "wide"} renderer previews ${edge} in key columns without audio/clock changes`, () => {
    const h = fixture({ compact }), { c } = h;
    const before = JSON.stringify(c.songEvents), seconds = c.currentPracticeTime(), checkpoint = c.lastPracticeFrameSeconds;
    const view = c.loopBoundaryPreview.show(edge);
    assert.equal(h.overlay.hidden, false); assert.ok(c.boardShell.classList.contains("loop-previewing"));
    assert.equal(h.marker.children[0].textContent, edge === "start" ? "起" : "终");
    assert.equal(h.overlay.attrs["data-boundary-beat"], String(edge === "start" ? 1 : 4));
    const tiles = h.notes.children.filter(n => n.className.includes("loop-preview-note"));
    assert.ok(tiles.length <= (compact ? 3 : 5));
    for (const tile of tiles) {
      const event = c.songEvents.find(e => String(e.id) === tile.attrs["data-event-id"]);
      assert.equal(parseFloat(tile.style.left), (event.minLane + .08) / 21 * 100);
      assert.ok(tile.innerHTML.includes(DISPLAY_KEYS[event.notes[0].lane].letter));
      assert.equal(tile.attrs["data-selected"], String(event.beat >= 1 && event.beat < 4));
    }
    if (edge === "end") {
      const excluded = tiles.find(n => n.attrs["data-onset-beat"] === "4");
      assert.ok(excluded.className.includes("excluded")); assert.equal(excluded.attrs["data-first-excluded"], "true");
    }
    assert.equal(JSON.stringify(c.songEvents), before); assert.equal(c.currentPracticeTime(), seconds);
    assert.equal(c.lastPracticeFrameSeconds, checkpoint); assert.equal(h.sounds.length, 0);
    assert.equal(view.boundaryBeat, edge === "start" ? 1 : 4);
  });
}
test("held tails are split visually at exclusive end without inserting or replaying onsets", () => {
  const h = fixture(); h.c.songEvents[2].duration = 4;
  const before = JSON.stringify(h.c.songEvents), view = h.c.loopBoundaryPreview.show("end");
  const tails = h.notes.children.filter(n => n.className.includes("loop-preview-tail") && n.attrs["data-event-id"] === "2");
  assert.equal(tails.length, 2); assert.ok(tails.some(n => n.className.includes("excluded")));
  assert.ok(view.tails.some(t => t.sourceBeat === 2 && t.sourceEndBeat === 6 && t.selectedEndBeat === 4));
  assert.equal(JSON.stringify(h.c.songEvents), before); assert.equal(h.sounds.length, 0);
});
test("true rests stay blank and changing songs replaces the cached event index", () => {
  const h = fixture(); const view = h.c.loopBoundaryPreview.show("end");
  assert.ok(view.rests.some(r => r.fromBeat >= 2.25 && r.toBeat === 4));
  h.c.songEvents = [{ ...h.c.songEvents[0], id: "new-song", beat: 6 }];
  h.c.practiceLoopRange = { startBeat: 6, endBeat: 9 };
  h.c.loopBoundaryPreview.show("start");
  assert.ok(h.notes.children.every(n => n.attrs["data-event-id"] === "new-song"));
  h.c.practiceLoopRange = null; h.c.loopBoundaryPreview.show("end");
  assert.equal(h.overlay.hidden, true); assert.equal(h.c.boardShell.classList.contains("loop-previewing"), false);
});
for (const initiallyPlaying of [false, true]) for (const edge of ["start", "end"]) {
  test(`production pointer lifecycle ${edge}, playing=${initiallyPlaying}, keeps preview silent and restores normal preparation`, async () => {
    const h = fixture(), { c } = h;
    if (initiallyPlaying) { await c.playDemo(); h.tick(); }
    c.startLoopDrag(h.pointer(), edge);
    assert.equal(h.overlay.hidden, false); assert.equal(c.shouldLoop(), false);
    const sounds = h.sounds.length;
    c.moveLoopDrag(h.pointer({ clientX: edge === "start" ? 200 : 800 }));
    assert.equal(h.overlay.attrs["data-boundary-beat"], String(edge === "start" ? c.practiceLoopRange.startBeat : c.practiceLoopRange.endBeat));
    const checkpoint = c.lastPracticeFrameSeconds;
    c.renderBoard(999);
    assert.equal(c.lastPracticeFrameSeconds, checkpoint); assert.equal(h.sounds.length, sounds);
    c.finishLoopDrag(h.pointer({ type: "pointerup" }));
    assert.equal(h.overlay.hidden, true); assert.equal(c.loopDragEdge, null);
    assert.equal(c.shouldLoop(), initiallyPlaying);
    assert.equal(c.pausedElapsed, c.practiceLoopRange.startBeat * c.getScaledBeatSeconds() - c.getSessionLeadSeconds());
  });
}
for (const cancel of ["pointercancel", "reset", "speed", "hidden", "navigation"]) {
  test(`production ${cancel} clears the preview without leaving a stale overlay`, async () => {
    const h = fixture(), { c } = h; await c.playDemo(); h.tick(); c.startLoopDrag(h.pointer(), "end");
    if (cancel === "pointercancel") c.finishLoopDrag(h.pointer({ type: cancel }));
    if (cancel === "reset") c.resetPracticeState();
    if (cancel === "speed") { c.speedSlider.value = ".75"; c.applySpeed(); }
    if (cancel === "hidden") lifecycle(h).hide();
    if (cancel === "navigation") c.openSongLibrary();
    assert.equal(h.overlay.hidden, true); assert.equal(c.loopDragEdge, null);
    assert.equal(c.shouldLoop(), false); assert.equal(h.frames.size, 0);
  });
}
test("preview is wired to production event entry and teardown, with hidden styling enforced", async () => {
  const html = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(html, /\.loop-boundary-preview\[hidden\]\s*\{\s*display:\s*none !important/);
  assert.match(html, /\.loop-preview-notes[^}]*scaleX\(var\(--key-scale\)\)/);
});

for (const beats of [[4, 8.75, 9], [2.5, 2.75, 5], [3.5, 3.75, 8.5]]) {
  test(`compact mixed-gap context ${beats} retains nearest selected/excluded attacks without overlap`, () => {
    const h = fixture({ compact: true }), { c } = h;
    c.songEvents = beats.map((beat, i) => ({ ...c.songEvents[0], id: i, beat, duration: .125 }));
    c.songTotalBeats = beats.at(-1) + 2;
    c.practiceLoopRange = { startBeat: beats[0], endBeat: beats.at(-1) };
    const view = c.loopBoundaryPreview.show("end");
    assert.deepEqual(view.displayedGroups.map(g => g.beat), beats.slice(-2));
    const tiles = h.notes.children.filter(n => n.className.includes("loop-preview-note"));
    assert.equal(tiles.length, 2);
    const [selected, excluded] = tiles;
    assert.ok(selected.className.includes("selected")); assert.ok(excluded.className.includes("excluded"));
    assert.ok(parseFloat(excluded.style.top) + parseFloat(excluded.style.height) + 3 <= parseFloat(selected.style.top));
    assert.equal(parseFloat(selected.style.height), 28); assert.equal(parseFloat(excluded.style.height), 28);
    const gap = parseFloat(selected.style.top) - parseFloat(excluded.style.top);
    assert.ok(gap > 32, "true local zoom, rather than two labels on one pixel location");
    assert.ok(view.rests.length, "the score's silence is still represented as silence");
  });
}
test("multi-note preview uses physical per-tone positions and a complete compact pitch stack", async () => {
  const h = fixture({ compact: true }), { c } = h;
  c.songEvents = [{ ...c.songEvents[0], beat: 1, minLane: 0, laneSpan: 21,
    notes: [0, 20].map(lane => ({ name: DISPLAY_KEYS[lane].name, lane, role: "melody", judge: true })) },
    { ...c.songEvents[1], beat: 2 }];
  c.practiceLoopRange = { startBeat: 1, endBeat: 2 }; c.loopBoundaryPreview.show("start");
  const chord = h.notes.children.find(n => n.className.includes("chord-note"));
  assert.ok(chord); assert.match(chord.innerHTML, /--tone-x: 2\.0154%/);
  assert.match(chord.innerHTML, /--tone-x: 97\.9846%/);
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.loop-preview-note\.chord-note \.note-tone[^}]*left: var\(--tone-x, 50%\)/);
  assert.match(styles, /\.loop-preview-note \.note-tone \{ min-width: 0/);
  assert.match(styles, /\.loop-preview-note \.degree-dots[^}]*height: 4px; min-height: 4px/);
});
