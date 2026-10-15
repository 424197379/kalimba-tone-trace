// Read-only written-timing diagnostics; never mutate a song.
// No result here establishes source fidelity, all-layer silence or an audio cut.
const EPSILON = 1e-8;
const finite = value => typeof value === "number" && Number.isFinite(value);
const own = (value, key) => Object.hasOwn(value || {}, key);
const end = event => event.beat + event.duration;

export function inspectSourceExtent(song, melodyEndBeat) {
  const issues = [];
  const readSpans = (raw, path, tuples = false) => {
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      issues.push({ code: "invalid-timing-array", path });
      return [];
    }
    return raw.flatMap((rawEvent, index) => {
      const event = tuples ? { beat: rawEvent?.[1], duration: rawEvent?.[2] } : rawEvent;
      if (!event || !finite(event.beat) || event.beat < 0
        || !finite(event.duration) || event.duration <= 0 || !finite(end(event))) {
        issues.push({ code: "invalid-written-span", path: `${path}[${index}]` });
        return [];
      }
      return [{ beat: event.beat, duration: event.duration, path: `${path}[${index}]` }];
    });
  };
  const v2 = song.schemaVersion === 2;
  const main = readSpans(v2 ? song.events : song.steps, v2 ? "events" : "steps", !v2);
  const melody = v2 ? main.filter(span => {
    const index = Number(span.path.match(/\[(\d+)\]$/)[1]);
    return song.events[index].notes.some(note => note.role === "melody");
  }) : main;
  const auto = readSpans(song.autoAccompaniment?.events, "autoAccompaniment.events");
  const practice = readSpans(song.practiceAccompaniment?.events, "practiceAccompaniment.events");
  const rests = readSpans(song.rhythm?.restWindows, "rhythm.restWindows");
  const maxEnd = spans => spans.reduce((max, span) => Math.max(max, end(span)), 0);
  const sourceEventEndBeat = maxEnd(main);
  const accompanimentEndBeats = {
    autoAccompaniment: auto.length ? maxEnd(auto) : null,
    practiceAccompaniment: practice.length ? maxEnd(practice) : null
  };
  const allSpans = [...main, ...auto, ...practice, ...rests];
  if (own(song.rhythm, "pickupBeats")) {
    if (finite(song.rhythm.pickupBeats) && song.rhythm.pickupBeats >= 0) {
      allSpans.push({ beat: 0, duration: song.rhythm.pickupBeats, path: "rhythm.pickupBeats" });
    } else issues.push({ code: "invalid-pickup-extent", path: "rhythm.pickupBeats" });
  }
  const hasInvalidTiming = issues.length > 0;
  const present = own(song.sourceFeatures, "sourceTotalBeats");
  const value = song.sourceFeatures?.sourceTotalBeats;
  const declaredSourceTotalBeats = present && finite(value) && value >= 0 ? value : null;
  let sourceExtentStatus = present ? "covers-written-content" : "missing";
  if (present && declaredSourceTotalBeats === null) {
    sourceExtentStatus = "invalid-value";
    issues.push({ code: "invalid-source-total-beats", path: "sourceFeatures.sourceTotalBeats",
      requirement: "finite nonnegative numeric value" });
  } else if (declaredSourceTotalBeats !== null) {
    const beyond = allSpans.filter(span => end(span) > declaredSourceTotalBeats + EPSILON);
    if (beyond.length) {
      sourceExtentStatus = "shorter-than-written-content";
      issues.push({ code: "written-content-beyond-source-extent", path: "sourceFeatures.sourceTotalBeats",
        beyond: beyond.map(span => ({ path: span.path, endBeat: end(span) })) });
    }
  }
  if (hasInvalidTiming && ["missing", "covers-written-content"].includes(sourceExtentStatus)) {
    sourceExtentStatus = "unresolved-timing";
  }
  // Missing metadata has an explicitly labeled MAIN-EVENT fallback. Independent
  // backing is never used to silently enlarge/approve the selected source scope.
  // Invalid or shorter declarations have NO selected extent until reviewed.
  const sourceExtentSelection = sourceExtentStatus === "covers-written-content" ? "declared-source-total"
    : sourceExtentStatus === "missing" ? "encoded-main-event-fallback" : "unresolved";
  const selectedSourceExtentBeats = sourceExtentSelection === "declared-source-total" ? declaredSourceTotalBeats
    : sourceExtentSelection === "encoded-main-event-fallback" ? sourceEventEndBeat : null;
  if (sourceExtentSelection === "encoded-main-event-fallback") {
    // Include pickup as well as backing/rest spans, without enlarging the fallback.
    const beyond = allSpans.filter(span => end(span) > sourceEventEndBeat + EPSILON);
    if (beyond.length) issues.push({ code: "content-beyond-undeclared-main-event-fallback",
      beyond: beyond.map(span => ({ path: span.path, endBeat: end(span) })) });
  }
  // Empty melody is unknown/not reviewable, not proof of an entirely silent song.
  // Detailed gaps retain fractional spans; the legacy `gaps` field stays intact.
  const melodyGaps = melody.length && !hasInvalidTiming ? [] : null;
  if (melodyGaps) {
    let cursor = 0;
    for (const span of [...melody].sort((a, b) => a.beat - b.beat)) {
      if (span.beat > cursor + EPSILON) melodyGaps.push({ beat: cursor, duration: span.beat - cursor,
        position: cursor === 0 ? "initial" : "internal", meaning: "inferred-melody-gap" });
      cursor = Math.max(cursor, end(span));
    }
  }
  const endingMelodyGap = melodyGaps && selectedSourceExtentBeats !== null
    && selectedSourceExtentBeats > melodyEndBeat + EPSILON
    ? { beat: melodyEndBeat, duration: selectedSourceExtentBeats - melodyEndBeat,
      position: "ending", meaning: "inferred-melody-gap", extentBasis: sourceExtentSelection } : null;
  if (endingMelodyGap) melodyGaps.push({ ...endingMelodyGap });
  return { melodyEndBeat, sourceEventEndBeat, accompanimentEndBeats,
    declaredSourceTotalBeats, selectedSourceExtentBeats, sourceExtentStatus, sourceExtentSelection,
    sourceExtentIssues: issues, endingMelodyGap, melodyGaps };
}
