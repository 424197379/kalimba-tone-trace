import { createLoopBoundaryPreviewIndex, selectLoopBoundaryPreview } from "./phrase-boundary-preview.js";

// A separate visual surface: never call the transport renderer with a boundary
// timestamp. That renderer can dispatch audio and commit playback checkpoints.
export function createLoopBoundaryRenderer({ document, board, boardTop, getEvents,
  getTotalBeats, getRange, isCompact, renderNotes, laneCount = 21, laneInset = .08 }) {
  const overlay = document.createElement("div");
  overlay.className = "loop-boundary-preview";
  overlay.hidden = true;
  overlay.setAttribute("role", "img");
  const notes = document.createElement("div");
  notes.className = "loop-preview-notes";
  const marker = document.createElement("div");
  marker.className = "loop-preview-marker";
  const label = document.createElement("span");
  marker.append(label);
  overlay.append(notes, marker);
  boardTop.appendChild(overlay);
  let indexedEvents = null, indexedTotal = null, index = null;

  function clear() {
    overlay.hidden = true;
    board.classList.remove("loop-previewing");
  }

  function show(edge) {
    const events = getEvents(), total = getTotalBeats();
    if (events !== indexedEvents || total !== indexedTotal) {
      index = createLoopBoundaryPreviewIndex(events, total);
      indexedEvents = events;
      indexedTotal = total;
    }
    const view = selectLoopBoundaryPreview(index, getRange(), edge, { maxOnsets: isCompact() ? 3 : 5 });
    if (!view) { clear(); return null; }
    const height = Math.max(1, boardTop.clientHeight);
    const tileHeight = 28;
    const topAttack = Math.min(height / 2, tileHeight + 8);
    const bottomAttack = Math.max(topAttack + 1, height - 8);
    const available = bottomAttack - topAttack;
    // Keep the nearest onset on either side of the boundary. If distant context
    // would make labels overlap, omit its attack and zoom the remaining real beat
    // interval; never redistribute individual onsets or manufacture rests.
    const before = view.groups.filter(group => group.beat < view.boundaryBeat).at(-1);
    const after = view.groups.find(group => group.beat >= view.boundaryBeat);
    const required = new Set([before, after].filter(Boolean));
    const visibleGroups = [...view.groups];
    let fromBeat, toBeat, pxPerBeat;
    while (true) {
      fromBeat = Math.min(view.boundaryBeat, visibleGroups[0].beat);
      toBeat = Math.max(view.boundaryBeat, visibleGroups.at(-1).beat);
      if (fromBeat === toBeat) { fromBeat = view.fromBeat; toBeat = view.toBeat; }
      pxPerBeat = available / Math.max(1e-9, toBeat - fromBeat);
      const overlaps = visibleGroups.some((group, i) => i && (group.beat - visibleGroups[i - 1].beat) * pxPerBeat < tileHeight + 4);
      if (!overlaps || visibleGroups.length <= required.size) break;
      const removable = visibleGroups.filter(group => !required.has(group));
      if (!removable.length) break;
      const farthest = removable.reduce((a, b) => Math.abs(a.beat - view.boundaryBeat) >= Math.abs(b.beat - view.boundaryBeat) ? a : b);
      visibleGroups.splice(visibleGroups.indexOf(farthest), 1);
    }
    const y = beat => bottomAttack - (beat - fromBeat) * pxPerBeat;
    notes.replaceChildren();
    const box = (className, event, top, bottom) => {
      const node = document.createElement("div");
      node.className = className;
      const minLane = Number.isFinite(event.minLane) ? event.minLane : 0;
      const laneSpan = Number.isFinite(event.laneSpan) ? event.laneSpan : 1;
      node.style.left = `${(minLane + laneInset) / laneCount * 100}%`;
      node.style.width = `${(laneSpan - laneInset * 2) / laneCount * 100}%`;
      node.style.top = `${top}px`;
      node.style.height = `${Math.max(1, bottom - top)}px`;
      node.setAttribute("data-event-id", String(event.id));
      notes.append(node);
      return node;
    };
    const tailFromBeat = Math.max(view.fromBeat, fromBeat - (height - bottomAttack) / pxPerBeat);
    const tailToBeat = Math.min(view.toBeat, toBeat + topAttack / pxPerBeat);
    for (const tail of view.tails) {
      const start = Math.max(tailFromBeat, tail.fromBeat), end = Math.min(tailToBeat, tail.toBeat);
      if (end <= start) continue;
      if (tail.selected && tail.selectedEndBeat > start) {
        box("loop-preview-tail selected", tail.event, y(Math.min(end, tail.selectedEndBeat)), y(start));
      }
      const mutedFrom = tail.selected ? Math.max(start, tail.selectedEndBeat) : start;
      if (end > mutedFrom) box("loop-preview-tail excluded", tail.event, y(end), y(mutedFrom));
    }
    for (const group of visibleGroups) {
      for (const event of group.events) {
        const bottom = y(group.beat);
        const node = box(`loop-preview-note ${group.selected ? "selected" : "excluded"}${group.atBoundary ? " at-boundary" : ""}${event.notes.length > 1 ? " chord-note" : ""}`, event,
          Math.max(0, bottom - tileHeight), bottom);
        node.innerHTML = renderNotes(event, "note");
        node.setAttribute("data-onset-beat", String(group.beat));
        node.setAttribute("data-selected", String(group.selected));
        node.setAttribute("data-first-excluded", String(group.firstExcluded));
      }
    }
    marker.style.top = `${y(view.boundaryBeat)}px`;
    label.textContent = edge === "start" ? "起" : "终";
    overlay.setAttribute("aria-label", `分段${edge === "start" ? "起点" : "终点"}附近的音符，终点起音不包含在本段`);
    overlay.setAttribute("data-boundary-beat", String(view.boundaryBeat));
    overlay.hidden = false;
    board.classList.add("loop-previewing");
    return { ...view, displayedGroups: visibleGroups, displayFromBeat: fromBeat, displayToBeat: toBeat };
  }
  return { show, clear };
}
