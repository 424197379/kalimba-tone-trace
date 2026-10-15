import { isBeatInLoop } from "./practice-loop.js";

const finite = (value) => typeof value === "number" && Number.isFinite(value);

function lowerBound(values, value, read = (item) => item.beat) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (read(values[middle]) < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * Build once when the melody changes, not on every pointer move. The source
 * events are never changed; mutable playback flags are deliberately ignored.
 * Rebuild after editing musical beat/duration data. All units remain beats.
 */
export function createLoopBoundaryPreviewIndex(events, totalBeats) {
  const records = (Array.isArray(events) ? events : []).flatMap((event, order) => {
    if (!event || !finite(event.beat) || event.beat < 0
      || !finite(event.duration) || event.duration <= 0
      || !finite(event.beat + event.duration)) return [];
    return [{ event, order, beat: event.beat, endBeat: event.beat + event.duration }];
  });
  // Production events already arrive sorted. Accept unsorted callers without
  // changing their array, and never repeat this work in the selector.
  if (records.some((record, index) => index && record.beat < records[index - 1].beat)) {
    records.sort((a, b) => a.beat - b.beat || a.order - b.order);
  }
  const groups = [];
  const prefixEnds = [];
  let end = finite(totalBeats) && totalBeats > 0 ? totalBeats : 0;
  let latestEnd = 0;
  for (const record of records) {
    let group = groups.at(-1);
    if (!group || group.beat !== record.beat) {
      group = { beat: record.beat, records: [] };
      groups.push(group);
    }
    record.groupIndex = groups.length - 1;
    group.records.push(Object.freeze(record));
    latestEnd = Math.max(latestEnd, record.endBeat);
    prefixEnds.push(latestEnd);
    end = Math.max(end, record.endBeat);
  }
  for (const group of groups) {
    Object.freeze(group.records);
    Object.freeze(group);
  }
  return Object.freeze({
    groups: Object.freeze(groups), records: Object.freeze(records),
    prefixEnds: Object.freeze(prefixEnds), totalBeats: end
  });
}

/**
 * A silent, display-only view around 起 or 终. The renderer owns projection
 * and styling; this model neither seeks nor changes playback/cue state.
 *
 * groups: nearby distinct onsets, preserving every event at a chord onset.
 * tails: natural durations intersecting the beat window, including a hold
 *        whose attack is outside it. selectedEndBeat clips selected material
 *        at exclusive 终, without shortening the source event or its sample.
 * rests: genuinely silent intervals, never synthetic note events.
 */
export function selectLoopBoundaryPreview(index, range, edge, { maxOnsets = 5 } = {}) {
  if (!index?.groups?.length || !finite(range?.startBeat) || !finite(range?.endBeat)
    || range.startBeat < 0 || range.endBeat <= range.startBeat
    || range.endBeat > index.totalBeats || !["start", "end"].includes(edge)) return null;

  const { groups, records, prefixEnds, totalBeats } = index;
  const boundaryBeat = edge === "start" ? range.startBeat : range.endBeat;
  const limit = finite(maxOnsets) ? Math.max(3, Math.min(9, Math.floor(maxOnsets))) : 5;
  const pivot = lowerBound(groups, boundaryBeat);
  const before = edge === "end" ? Math.ceil(limit / 2) : Math.floor(limit / 2);
  const start = Math.max(0, Math.min(pivot - before, groups.length - limit));
  const stop = Math.min(groups.length, start + limit);
  const firstIncludedIndex = lowerBound(groups, range.startBeat);
  const firstExcludedIndex = lowerBound(groups, range.endBeat);
  const lastIncludedIndex = firstExcludedIndex - 1;
  const included = firstIncludedIndex <= lastIncludedIndex;
  const describe = (group, groupIndex) => group ? {
    beat: group.beat,
    events: group.records.map((record) => record.event),
    selected: isBeatInLoop(group.beat, range),
    atBoundary: group.beat === boundaryBeat,
    firstIncluded: included && groupIndex === firstIncludedIndex,
    lastIncluded: included && groupIndex === lastIncludedIndex,
    firstExcluded: groupIndex === firstExcludedIndex
  } : null;

  // A small true-time margin keeps the marker readable without admitting an
  // extra onset. Include adjacent gaps in its bound, even outside the slice.
  let smallestGap = Infinity;
  for (let i = Math.max(1, start); i < Math.min(groups.length, stop + 1); i += 1) {
    smallestGap = Math.min(smallestGap, groups[i].beat - groups[i - 1].beat);
  }
  const margin = Number.isFinite(smallestGap) ? smallestGap / 2 : 0.5;
  const fromBeat = Math.max(0, Math.min(boundaryBeat, groups[start].beat) - margin);
  const toBeat = Math.min(totalBeats, Math.max(boundaryBeat, groups[stop - 1].beat) + margin);
  const tails = [];
  // Prefix maximum ends let ordinary non-overlapping scores skip all old
  // notes. Long overlapping holds are retained, rather than re-attacked.
  let recordIndex = lowerBound(prefixEnds, fromBeat, (value) => value);
  while (recordIndex < records.length && prefixEnds[recordIndex] <= fromBeat) recordIndex += 1;
  for (; recordIndex < records.length && records[recordIndex].beat < toBeat; recordIndex += 1) {
    const record = records[recordIndex];
    if (record.endBeat <= fromBeat) continue;
    const selected = isBeatInLoop(record.beat, range);
    const tailStart = Math.max(fromBeat, record.beat);
    const tailEnd = Math.min(toBeat, record.endBeat);
    tails.push({
      event: record.event, sourceBeat: record.beat, sourceEndBeat: record.endBeat,
      fromBeat: tailStart, toBeat: tailEnd, selected,
      selectedEndBeat: selected ? Math.min(tailEnd, range.endBeat) : null,
      onsetVisible: record.groupIndex >= start && record.groupIndex < stop,
      continuesBeforeWindow: record.beat < fromBeat,
      continuesAfterWindow: record.endBeat > toBeat,
      crossesBoundary: record.beat < boundaryBeat && record.endBeat > boundaryBeat
    });
  }

  const rests = [];
  let occupiedUntil = fromBeat;
  for (const tail of tails) {
    if (tail.fromBeat > occupiedUntil) rests.push({ fromBeat: occupiedUntil, toBeat: tail.fromBeat });
    occupiedUntil = Math.max(occupiedUntil, tail.toBeat);
  }
  if (occupiedUntil < toBeat) rests.push({ fromBeat: occupiedUntil, toBeat });

  return {
    edge, boundaryBeat, fromBeat, toBeat,
    groups: groups.slice(start, stop).map((group, offset) => describe(group, start + offset)),
    firstIncluded: included ? describe(groups[firstIncludedIndex], firstIncludedIndex) : null,
    lastIncluded: included ? describe(groups[lastIncludedIndex], lastIncludedIndex) : null,
    firstExcluded: describe(groups[firstExcludedIndex], firstExcludedIndex),
    tails, rests
  };
}
