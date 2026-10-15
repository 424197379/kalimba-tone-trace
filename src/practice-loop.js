const DEFAULT_LENGTH = 8;

function isFiniteBeat(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function getBoundaries(events, totalBeats) {
  const source = Array.isArray(events) ? events : [];
  const validEvents = source.filter((event) => event && isFiniteBeat(event.beat) && event.beat >= 0);
  const inferredEnd = validEvents.reduce((end, event) => {
    const duration = isFiniteBeat(event.duration) && event.duration > 0 ? event.duration : 1;
    const eventEnd = event.beat + duration;
    return Number.isFinite(eventEnd) ? Math.max(end, eventEnd) : end;
  }, 1);
  const end = isFiniteBeat(totalBeats) && totalBeats > 0 ? totalBeats : inferredEnd;
  const starts = [...new Set(validEvents.map((event) => event.beat).filter((beat) => beat < end))]
    .sort((a, b) => a - b);
  // An empty song still needs a usable, nonempty practice interval.
  if (!starts.length) starts.push(0);
  return { starts, boundaries: [...starts, end], end };
}

function nearest(values, beat) {
  return values.reduce((best, value) => Math.abs(value - beat) < Math.abs(best - beat) ? value : best);
}

/** Make an onset-aligned interval. The ending beat is always exclusive. */
export function createLoopRange(events, totalBeats, currentBeat = 0, targetLength = DEFAULT_LENGTH) {
  const { starts, boundaries, end } = getBoundaries(events, totalBeats);
  const length = isFiniteBeat(targetLength) && targetLength > 0 ? targetLength : DEFAULT_LENGTH;
  let position = isFiniteBeat(currentBeat) ? Math.max(0, currentBeat) : 0;
  // At the end of a song, select its final phrase rather than an empty interval.
  const atSongEnd = position >= end;
  if (atSongEnd) position = Math.max(0, end - length);
  const startBeat = starts.filter((beat) => beat <= position).at(-1) ?? starts[0];
  const endBeat = atSongEnd ? end : boundaries.find((beat) => beat > startBeat && beat >= startBeat + length) ?? end;
  return { startBeat, endBeat };
}

/** Move one edge to the nearest legal onset while preserving the other edge. */
export function snapLoopBoundary(events, totalBeats, range, edge, beat) {
  const { starts, boundaries } = getBoundaries(events, totalBeats);
  const fallback = createLoopRange(events, totalBeats);
  const startBeat = isFiniteBeat(range?.startBeat) ? nearest(starts, range.startBeat) : fallback.startBeat;
  const possibleEnds = boundaries.filter((value) => value > startBeat);
  const endBeat = isFiniteBeat(range?.endBeat) ? nearest(possibleEnds, range.endBeat) : nearest(possibleEnds, fallback.endBeat);
  const normalized = { startBeat, endBeat };
  if (!isFiniteBeat(beat)) return normalized;
  if (edge === "start") {
    return { startBeat: nearest(starts.filter((value) => value < endBeat), beat), endBeat };
  }
  if (edge === "end") {
    return { startBeat, endBeat: nearest(possibleEnds, beat) };
  }
  return normalized;
}

export function isBeatInLoop(beat, range) {
  return range == null || (isFiniteBeat(beat) && beat >= range.startBeat && beat < range.endBeat);
}

/** Allow at least three count-in beats and enough time for the visual approach. */
export function getPreparationBeats(scaledBeatSeconds, visualLeadSeconds) {
  if (!isFiniteBeat(scaledBeatSeconds) || scaledBeatSeconds <= 0 || !isFiniteBeat(visualLeadSeconds)) return 3;
  const count = Math.ceil(Math.max(0, visualLeadSeconds) / scaledBeatSeconds);
  return Math.max(3, Math.min(Number.MAX_SAFE_INTEGER, count));
}

/** Include source-notated ending rests without adding attacks or extending notes. */
export function getPracticeTotalBeats(events, song) {
  const eventEnd = (Array.isArray(events) ? events : []).reduce((end, event) => {
    if (!event || !isFiniteBeat(event.beat) || event.beat < 0
      || !isFiniteBeat(event.duration) || event.duration <= 0) return end;
    const candidate = event.beat + event.duration;
    return Number.isFinite(candidate) ? Math.max(end, candidate) : end;
  }, 0);
  const sourceEnd = song?.sourceFeatures?.sourceTotalBeats;
  return isFiniteBeat(sourceEnd) && sourceEnd >= 0 ? Math.max(eventEnd, sourceEnd) : eventEnd;
}
