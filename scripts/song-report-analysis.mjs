// Read-only descriptive analysis. This is not schema/source/harmony/audio approval.
export const EPSILON = 1e-9;
export const MIN_REST_BEATS = 1;
const SUPPORT_LAYERS = ["autoAccompaniment", "practiceAccompaniment"];
const own = (object, key) => Object.hasOwn(object || {}, key);
const finite = value => typeof value === "number" && Number.isFinite(value);
const timingValid = value => value && finite(value.beat) && value.beat >= 0
  && finite(value.duration) && value.duration > 0 && finite(value.beat + value.duration);
const end = event => event.beat + event.duration;
const rounded = number => Math.round(number * 1e6) / 1e6;
const roundDensity = number => Number(number.toFixed(2));
const clone = value => value === undefined ? null : structuredClone(value);
const range = (value, path, extra = {}) => ({ beat: value.beat, duration: value.duration, path, ...extra });

// Half-open written spans: exact end/start contact does not overlap. No PCM/audio
// buffer tail, gain envelope or playback scheduler is read or modified here.
export function overlapsWrittenSpan(first, second) {
  return first.beat < end(second) - EPSILON && end(first) > second.beat + EPSILON;
}

export function mergeWrittenSpans(events) {
  const merged = [];
  for (const event of [...events].sort((a, b) => a.beat - b.beat || end(a) - end(b))) {
    const last = merged.at(-1);
    if (last && event.beat <= end(last) + EPSILON) last.duration = Math.max(end(last), end(event)) - last.beat;
    else merged.push({ beat: event.beat, duration: event.duration });
  }
  return merged;
}

export function subtractWrittenSpans(span, covers) {
  const fragments = [];
  let cursor = span.beat;
  for (const cover of mergeWrittenSpans(covers).filter(cover => overlapsWrittenSpan(span, cover))) {
    if (cover.beat > cursor + EPSILON) fragments.push({ beat: cursor, duration: Math.min(cover.beat, end(span)) - cursor });
    cursor = Math.max(cursor, end(cover));
  }
  if (end(span) > cursor + EPSILON) fragments.push({ beat: cursor, duration: end(span) - cursor });
  return fragments;
}

export function inferMelodyGaps(events, declaredEnd = null) {
  const spans = mergeWrittenSpans(events);
  const gaps = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.beat > cursor + EPSILON) gaps.push({ beat: cursor, duration: span.beat - cursor,
      position: cursor === 0 ? "initial" : "internal", meaning: "inferred-melody-gap" });
    cursor = Math.max(cursor, end(span));
  }
  if (finite(declaredEnd) && declaredEnd > cursor + EPSILON) {
    gaps.push({ beat: cursor, duration: declaredEnd - cursor,
      position: spans.length ? "declared-ending" : "declared-empty-melody",
      meaning: "inferred-melody-gap" });
  }
  return gaps;
}

function collectTiming(song, issues) {
  const source = [];
  const melody = [];
  let melodyComplete = true;
  const version = song.schemaVersion ?? 1;
  if (![1, 2].includes(version)) {
    issues.push({ code: "unsupported-schema", path: "schemaVersion" });
    return { source, melody, melodyComplete: false };
  }
  const key = version === 2 ? "events" : "steps";
  if (!Array.isArray(song[key]) || !song[key].length) {
    issues.push({ code: "missing-melody-data", path: key });
    return { source, melody, melodyComplete: false };
  }
  song[key].forEach((item, index) => {
    const path = `${key}[${index}]`;
    const event = version === 1 && Array.isArray(item)
      ? { beat: item[1], duration: item[2], notes: [{ name: item[0], role: "melody", judge: true }] } : item;
    if (!timingValid(event) || !Array.isArray(event.notes) || !event.notes.length) {
      issues.push({ code: "invalid-main-event", path });
      melodyComplete = false;
      return;
    }
    source.push(range(event, path, { notes: clone(event.notes) }));
    const explicit = event.notes.filter(note => note && typeof note === "object" && note.role === "melody");
    const unknownRoles = event.notes.some(note => !note || typeof note !== "object"
      || !["melody", "harmony", "bass", "arpeggio", "ornament"].includes(note.role));
    if (explicit.length > 1 || unknownRoles) {
      issues.push({ code: "ambiguous-melody", path });
      melodyComplete = false;
    } else if (explicit.length === 1) {
      if (explicit[0].judge !== true || typeof explicit[0].name !== "string" || !explicit[0].name) {
        issues.push({ code: "missing-explicit-judgeable-melody", path });
        melodyComplete = false;
      } else melody.push(range(event, path, { name: explicit[0].name }));
    }
    // Explicit non-melody-only source events are allowed and cannot fill melody gaps.
  });
  if (!melody.length) {
    issues.push({ code: "missing-explicit-melody", path: key });
    melodyComplete = false;
  }
  return { source, melody, melodyComplete };
}

function readSupport(song, key, issues) {
  const present = own(song, key);
  const raw = song[key]?.events;
  if (present && (!Array.isArray(raw) || !raw.length)) issues.push({ code: "invalid-support-layer", path: key });
  const events = [];
  if (Array.isArray(raw)) raw.forEach((event, index) => {
    const path = `${key}.events[${index}]`;
    if (!timingValid(event) || !Array.isArray(event.notes) || !event.notes.length) {
      issues.push({ code: "invalid-support-event", path });
    } else events.push(range(event, path, { noteCount: event.notes.length }));
  });
  return { present, rawEventCount: Array.isArray(raw) ? raw.length : 0, events };
}

function readClaims(song, issues) {
  const features = song.sourceFeatures || {};
  const current = features.sourceReview?.currentScopeReview;
  const practice = features.practiceAccompaniment;
  const readWindows = (value, path, tuple = false) => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) { issues.push({ code: "invalid-claim-array", path }); return []; }
    return value.flatMap((raw, index) => {
      const item = tuple && Array.isArray(raw) ? { beat: raw[0], duration: raw[1] } : raw;
      if (!timingValid(item)) { issues.push({ code: "invalid-claim-span", path: `${path}[${index}]` }); return []; }
      return [range(item, `${path}[${index}]`, { declaration: clone(raw) })];
    });
  };
  // Deliberately explicit adapters for CURRENT metadata paths. Do not recurse
  // through historicalCandidates or infer silence/approval from prose/statuses.
  const allLayerSilent = [
    ...readWindows(current?.silentWindows, "sourceFeatures.sourceReview.currentScopeReview.silentWindows"),
    ...readWindows(practice?.rests?.allLayerSilentWindows, "sourceFeatures.practiceAccompaniment.rests.allLayerSilentWindows")
  ];
  const melodyOnly = [
    ...readWindows(features.melodyOnlyRestWindows, "sourceFeatures.melodyOnlyRestWindows", true),
    ...readWindows(current?.melodyOnlyRestWindows, "sourceFeatures.sourceReview.currentScopeReview.melodyOnlyRestWindows", true),
    ...readWindows(current?.selectedMelodyRests, "sourceFeatures.sourceReview.currentScopeReview.selectedMelodyRests"),
    ...readWindows(current?.sourceConfirmedRestWindows, "sourceFeatures.sourceReview.currentScopeReview.sourceConfirmedRestWindows"),
    ...readWindows(current?.selectedMelody?.melodyRestWindows, "sourceFeatures.sourceReview.currentScopeReview.selectedMelody.melodyRestWindows"),
    ...readWindows(practice?.rests?.melodyRestWindows, "sourceFeatures.practiceAccompaniment.rests.melodyRestWindows")
  ];
  const sourceLowerVoice = readWindows(practice?.rests?.sourceLowerVoiceRestWindows,
    "sourceFeatures.practiceAccompaniment.rests.sourceLowerVoiceRestWindows");
  const omittedGestures = readWindows(current?.omittedSourceGestures,
    "sourceFeatures.sourceReview.currentScopeReview.omittedSourceGestures");
  const adaptationGaps = readWindows(current?.melodyOnlyAdaptationGaps,
    "sourceFeatures.sourceReview.currentScopeReview.melodyOnlyAdaptationGaps");
  const rhythm = readWindows(song.rhythm?.restWindows, "rhythm.restWindows").map(window => {
    const policy = window.declaration.policy ?? "silent";
    if (!["silent", "hold"].includes(policy)) issues.push({ code: "invalid-rest-policy", path: window.path });
    return { ...window, policy };
  });
  return { allLayerSilent, melodyOnly, sourceLowerVoice, omittedGestures, adaptationGaps, rhythm };
}

function describeReview(song, key) {
  // Different established shapes stay separate. A rhythm or harmony label never
  // upgrades a reduced practice candidate, and an absent label is not success.
  const metadata = song.sourceFeatures?.[key];
  const fields = key === "practiceAccompaniment"
    ? ["status", "confidence", "scope", "sourcePixels", "browserAudio", "referenceListening", "physicalKalimba", "independentlyVerified", "reviewRequired", "unresolvedConflictBeats", "limits"]
    : ["generatedFrom", "restPolicy", "reviewRequired"];
  return { metadataPath: `sourceFeatures.${key}`, metadataPresent: !!metadata,
    declared: Object.fromEntries(fields.filter(field => own(metadata, field)).map(field => [field, clone(metadata[field])])),
    assessment: "not-assessed-by-report" };
}

function overlapDetails(window, layers) {
  return Object.fromEntries(Object.entries(layers).map(([key, events]) => [key,
    events.filter(event => overlapsWrittenSpan(event, window)).map(event => ({
      path: event.path, beat: event.beat, duration: event.duration
    }))]));
}

export function analyzeSongTiming(song) {
  const issues = [];
  const main = collectTiming(song, issues);
  const supports = Object.fromEntries(SUPPORT_LAYERS.map(key => [key, readSupport(song, key, issues)]));
  const claims = readClaims(song, issues);
  let declaredEnd = null;
  if (own(song.sourceFeatures, "sourceTotalBeats")) {
    const value = song.sourceFeatures.sourceTotalBeats;
    if (finite(value) && value >= 0) declaredEnd = value;
    else issues.push({ code: "invalid-declared-ending", path: "sourceFeatures.sourceTotalBeats" });
  }
  const sourceEnd = main.source.reduce((max, event) => Math.max(max, end(event)), 0);
  const scoreExtent = Math.max(sourceEnd, declaredEnd ?? 0);
  const layers = { melody: main.melody, sourceEvents: main.source,
    ...Object.fromEntries(SUPPORT_LAYERS.map(key => [key, supports[key].events])) };
  const beyondDeclaredEnd = declaredEnd === null ? [] : Object.entries(layers).flatMap(([layer, events]) =>
    events.filter(event => end(event) > declaredEnd + EPSILON).map(event => ({ layer, ...range(event, event.path) })));
  if (beyondDeclaredEnd.length) issues.push({ code: "written-span-beyond-declared-ending", count: beyondDeclaredEnd.length });
  const melodyGaps = main.melodyComplete ? inferMelodyGaps(main.melody, declaredEnd).map(gap => ({
    ...gap,
    declarations: [
      ...claims.melodyOnly.map(value => ({ ...value, meaning: "declared-melody-only-rest" })),
      ...claims.allLayerSilent.map(value => ({ ...value, meaning: "declared-all-layer-silence" })),
      ...claims.adaptationGaps.map(value => ({ ...value, meaning: "declared-adaptation-gap" })),
      ...claims.omittedGestures.filter(value => value.declaration.outsideSelectedScope !== true)
        .map(value => ({ ...value, meaning: "omitted-source-gesture" })),
      ...claims.rhythm.map(value => ({ ...value, meaning: value.policy === "hold" ? "declared-support-hold-policy"
        : value.policy === "silent" ? "declared-support-silence-policy" : "unknown-support-policy" }))
    ].filter(value => overlapsWrittenSpan(value, gap)).map(value => ({ path: value.path, meaning: value.meaning }))
  })) : null;
  const longGaps = melodyGaps?.filter(gap => gap.duration >= MIN_REST_BEATS - EPSILON) ?? null;
  const annotationCovers = [...claims.melodyOnly, ...claims.allLayerSilent, ...claims.adaptationGaps,
    ...claims.omittedGestures.filter(value => value.declaration.outsideSelectedScope !== true),
    ...claims.rhythm.filter(window => ["silent", "hold"].includes(window.policy))];
  const unannotatedLongGaps = longGaps?.flatMap(gap => subtractWrittenSpans(gap, annotationCovers)) ?? null;
  const declaredSilentConflicts = claims.rhythm.filter(window => window.policy === "silent").flatMap(window => {
    const overlaps = overlapDetails(window, Object.fromEntries(SUPPORT_LAYERS.map(key => [key, supports[key].events])));
    return Object.values(overlaps).some(events => events.length)
      ? [{ ...window, kind: "declared-support-silence-violation", overlaps }] : [];
  });
  const allLayerSilenceConflicts = claims.allLayerSilent.flatMap(window => {
    // sourceEvents covers melody plus retained source harmony, without counting
    // the melody twice. Both OPTIONAL layers are examined separately, not mixed.
    const overlaps = overlapDetails(window, { sourceEvents: main.source,
      ...Object.fromEntries(SUPPORT_LAYERS.map(key => [key, supports[key].events])) });
    const contradictoryHolds = claims.rhythm.filter(hold => hold.policy === "hold" && overlapsWrittenSpan(hold, window));
    return Object.values(overlaps).some(events => events.length) || contradictoryHolds.length
      ? [{ ...window, kind: "declared-all-layer-silence-violation", overlaps,
        contradictoryHoldPaths: contradictoryHolds.map(hold => hold.path) }] : [];
  });
  const holdPolicies = claims.rhythm.filter(window => window.policy === "hold").map(window => ({
    ...window, sourceAuthorization: "not-established-by-report",
    layers: Object.fromEntries(SUPPORT_LAYERS.map(key => {
      const hits = supports[key].events.filter(event => overlapsWrittenSpan(event, window));
      return [key, { overlappingEventPaths: hits.map(event => event.path),
        structuralViolations: [
          ...(hits.length > 1 ? ["more-than-one-event"] : []),
          ...(hits.some(event => event.beat > window.beat + 0.25 + EPSILON) ? ["attack-after-rest-start-tolerance"] : [])
        ] }];
    }))
  }));
  const melodyGapSupportOverlaps = melodyGaps?.flatMap(gap => {
    const overlaps = overlapDetails(gap, Object.fromEntries(SUPPORT_LAYERS.map(key => [key, supports[key].events])));
    return Object.values(overlaps).some(events => events.length)
      ? [{ ...gap, overlaps, assessment: "review-required-not-proof-of-source-rest-conflict" }] : [];
  }) ?? null;
  const declaredPracticeSourceVoice = song.sourceFeatures?.practiceAccompaniment?.sourceVoice;
  const adoptsLiteralLowerVoice = declaredPracticeSourceVoice === "literal-bass-clef-lower-voice";
  // This exact current metadata value declares the candidate's voice mapping;
  // it does not prove source fidelity. Other/absent mappings remain unknown.
  // Source lower-voice rests never imply melody or original-auto silence.
  const sourceLowerVoiceRestReview = {
    practiceSourceVoicePath: "sourceFeatures.practiceAccompaniment.sourceVoice",
    declaredPracticeSourceVoice: clone(declaredPracticeSourceVoice),
    practiceApplicability: adoptsLiteralLowerVoice ? "declared-literal-lower-voice" : "not-established",
    overlaps: adoptsLiteralLowerVoice ? claims.sourceLowerVoice.flatMap(window => {
      const overlaps = overlapDetails(window, { practiceAccompaniment: supports.practiceAccompaniment.events });
      return overlaps.practiceAccompaniment.length
        ? [{ ...window, kind: "declared-source-lower-voice-rest-overlap", overlaps }] : [];
    }) : null,
    assessment: "review-only-not-source-approval"
  };
  const supportMetrics = Object.fromEntries(SUPPORT_LAYERS.map(key => {
    const layer = supports[key];
    const writtenBeats = mergeWrittenSpans(layer.events).reduce((total, span) => total + span.duration, 0);
    return [key, { present: layer.present, events: layer.events.length, rawEvents: layer.rawEventCount,
      noteAttacks: layer.events.reduce((total, event) => total + event.noteCount, 0),
      density: scoreExtent > 0 ? roundDensity(layer.events.length / scoreExtent) : null,
      writtenBeats: rounded(writtenBeats),
      writtenCoverage: scoreExtent > 0 ? rounded(writtenBeats / scoreExtent) : null,
      review: describeReview(song, key) }];
  }));
  return { id: song.id, title: song.title, schemaVersion: song.schemaVersion ?? 1,
    melodyComplete: main.melodyComplete, melodyEvents: main.melody.length,
    sourceEventCount: main.source.length, sourceEvents: main.source,
    declaredEnd, sourceEnd, scoreExtent, beyondDeclaredEnd, issues,
    claims, melodyGaps, longGaps, unannotatedLongGaps, support: supportMetrics,
    declaredHarmonyReview: { path: "sourceFeatures.harmonyReview", declaration: clone(song.sourceFeatures?.harmonyReview),
      assessment: "not-assessed-by-report" },
    declaredSilentConflicts, allLayerSilenceConflicts, holdPolicies, melodyGapSupportOverlaps, sourceLowerVoiceRestReview,
    limitation: "Written-span descriptions only. Metadata declarations are not independently verified. No source, harmonic, perceptual, physical-playing, rights or PCM-tail approval." };
}

export function summarizeRhythm(song) {
  const analysis = analyzeSongTiming(song);
  const conflicts = [...analysis.declaredSilentConflicts, ...analysis.allLayerSilenceConflicts].map(conflict => ({
    beat: conflict.beat, duration: conflict.duration, policy: "silent", kind: conflict.kind, path: conflict.path,
    autoEventCount: conflict.overlaps.autoAccompaniment?.length || 0,
    practiceEventCount: conflict.overlaps.practiceAccompaniment?.length || 0,
    sourceEventCount: conflict.overlaps.sourceEvents?.length || 0,
    ...(conflict.contradictoryHoldPaths ? { contradictoryHoldPaths: conflict.contradictoryHoldPaths } : {})
  }));
  const { sourceEvents: _sourceEvents, ...details } = analysis;
  return { id: song.id, title: song.title, schemaVersion: analysis.schemaVersion,
    sourceStatus: song.rhythm?.sourceStatus || "none",
    inferredRestWindows: analysis.longGaps?.length ?? null,
    rhythmRestWindows: analysis.claims.rhythm.length,
    autoEvents: analysis.support.autoAccompaniment.events,
    practiceEvents: analysis.support.practiceAccompaniment.events,
    conflicts, analysis: details };
}

export function summarizeArrangement(song) {
  const analysis = analyzeSongTiming(song);
  const events = analysis.sourceEvents;
  const multiEvents = events.filter(event => event.notes.length > 1).length;
  const judgeMultiEvents = events.filter(event => event.notes.filter(note => note?.judge === true).length > 1).length;
  const multiRatio = events.length ? multiEvents / events.length : 0;
  const effectiveJudgementMode = song.judgementMode || (song.arrangementKind === "chord" ? "chord" : "melody");
  const auto = analysis.support.autoAccompaniment;
  const practice = analysis.support.practiceAccompaniment;
  const risks = [];
  if (song.rhythm?.sourceStatus && song.rhythm.sourceStatus !== "verified") risks.push(`source=${song.rhythm.sourceStatus}`);
  else if ((auto.present || practice.present) && !song.rhythm?.sourceStatus) risks.push("source=none");
  if (analysis.scoreExtent > 0 && auto.events / analysis.scoreExtent > 0.85) risks.push(`denseAuto=${auto.density.toFixed(2)}`);
  if (analysis.scoreExtent > 0 && practice.events / analysis.scoreExtent > 0.85) risks.push(`densePractice=${practice.density.toFixed(2)}`);
  if (analysis.unannotatedLongGaps?.length) risks.push(`unannotatedMelodyGaps=${analysis.unannotatedLongGaps.length}`);
  // Single melody is the goal. Retain dense LEGACY arrangement data warnings;
  // never create a physical chord target or penalize the absence of chords.
  if ((song.arrangementKind === "chord" || effectiveJudgementMode === "chord") && multiRatio > 0.65) risks.push("manyMulti");
  if (effectiveJudgementMode === "melody" && judgeMultiEvents) risks.push(`multiJudgeMelody=${judgeMultiEvents}`);
  if (analysis.declaredSilentConflicts.length || analysis.allLayerSilenceConflicts.length) risks.push(`declaredSilenceConflicts=${analysis.declaredSilentConflicts.length + analysis.allLayerSilenceConflicts.length}`);
  if (analysis.holdPolicies.length) risks.push(`holdSourceReview=${analysis.holdPolicies.length}`);
  if (analysis.melodyGapSupportOverlaps?.length) risks.push(`gapSupportReview=${analysis.melodyGapSupportOverlaps.length}`);
  if (analysis.issues.length) risks.push(`analysisIssues=${analysis.issues.length}`);
  if (practice.present) risks.push(`practiceReview=${practice.review.declared.status || "unspecified"}`);
  return { id: song.id, title: song.title, schemaVersion: analysis.schemaVersion,
    events: events.length, multiEvents, judgeMultiEvents,
    autoEvents: auto.events, autoDensity: auto.density,
    practiceEvents: practice.events, practiceDensity: practice.density,
    practiceWrittenCoverage: practice.writtenCoverage,
    longGaps: analysis.longGaps?.length ?? null, restWindows: analysis.claims.rhythm.length,
    sourceStatus: song.rhythm?.sourceStatus || "none",
    practiceSourceStatus: practice.present ? practice.review.declared.status || "unspecified" : "absent",
    risk: risks.join("; "), assessment: "descriptive-only-not-approval" };
}
