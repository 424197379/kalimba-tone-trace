import { pathToFileURL } from "node:url";
import { DISPLAY_KEYS, readSongFiles } from "./build-song-library.mjs";

const pitches = new Map(DISPLAY_KEYS.map((key) => [key.name, Math.round(69 + 12 * Math.log2(key.freq / 440))]));
const decisions = new Set(["recommended", "conditional", "needs-review", "not-recommended"]);
const EPSILON = 1e-8;

// These are review signals from compiled data, not proof of fidelity to a score.
export function inspectSuitability(song) {
  const melody = (song.schemaVersion === 2
    ? (song.events || []).flatMap((event) => event.notes.filter((note) => note.role === "melody")
      .map((note) => [note.name, event.beat, event.duration]))
    : song.steps || []).slice().sort((a, b) => a[1] - b[1]);
  const features = song.sourceFeatures || {};
  const assessment = features.suitability;
  const notes = [...new Set(melody.map(([name]) => name))];
  const unsupported = notes.filter((name) => !pitches.has(name));
  const orderedNotes = notes.filter((name) => pitches.has(name)).sort((a, b) => pitches.get(a) - pitches.get(b));
  const gaps = [];
  const durations = {};
  let end = 0;
  let maxLeap = 0;
  let minOnsetGap = Infinity;
  let overlaps = 0;
  melody.forEach(([name, beat, duration], index) => {
    durations[duration] = (durations[duration] || 0) + 1;
    if (beat - end >= 1 - EPSILON) gaps.push({ beat: end, duration: beat - end });
    if (beat < end - EPSILON) overlaps += 1;
    end = Math.max(end, beat + duration);
    if (index) {
      const previous = melody[index - 1];
      if (pitches.has(name) && pitches.has(previous[0])) {
        maxLeap = Math.max(maxLeap, Math.abs(pitches.get(name) - pitches.get(previous[0])));
      }
      const onsetGap = beat - previous[1];
      if (onsetGap > EPSILON) minOnsetGap = Math.min(minOnsetGap, onsetGap);
    }
  });
  const signals = [];
  const recordedDecision = decisions.has(assessment?.status) ? assessment.status : "needs-review";
  if (!assessment) signals.push("No suitability review recorded; valid JSON is not a musical approval.");
  else if (!decisions.has(assessment.status)) signals.push("Unknown suitability status; review required.");
  if (!melody.length) signals.push("No melody available to review.");
  if (unsupported.length) signals.push(`Unsupported notes: ${unsupported.join(", ")}`);
  if (overlaps) signals.push(`${overlaps} overlapping melody events; check voice extraction.`);
  if (features.unsureMeasures?.length) signals.push(`Unresolved measures: ${features.unsureMeasures.join(", ")}`);
  if (song.rhythm && song.rhythm.sourceStatus !== "verified") signals.push(`Rhythm source: ${song.rhythm.sourceStatus}`);
  if (maxLeap > 12) signals.push("Melody leaps exceed an octave; inspect octave dots, not automatic rejection.");
  if (melody.length >= 8 && (durations[0.75] || 0) / melody.length >= 0.5) {
    signals.push("At least half the durations are 0.75; compare source beams/ties (can be intentional).");
  }
  for (const reason of assessment?.reviewRequired || []) signals.push(reason);
  return {
    id: song.id, title: song.title, recordedDecision, scope: assessment?.scope || "unreviewed",
    reason: assessment?.reason || null,
    melodyNotes: melody.length, range: orderedNotes.length ? `${orderedNotes[0]}-${orderedNotes.at(-1)}` : null,
    unsupported, totalBeats: end, durationHistogram: durations, gaps,
    longNotes: melody.filter(([, , duration]) => duration >= 2).length,
    maxLeapSemitones: maxLeap,
    fastestOnsetSecondsAtScoreTempo: Number.isFinite(minOnsetGap) && song.bpm > 0 ? minOnsetGap * 60 / song.bpm : null,
    signals
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reports = (await readSongFiles()).map(({ song }) => inspectSuitability(song));
  if (process.argv.includes("--json")) console.log(JSON.stringify(reports, null, 2));
  else {
    console.log("Read-only suitability review. Long notes are informational, not a rejection criterion.");
    console.table(reports.map((report) => ({
      id: report.id, review: report.recordedDecision, range: report.range,
      longNotes: report.longNotes, gaps: report.gaps.length, signals: report.signals.length
    })));
    for (const report of reports.filter((item) => item.signals.length)) {
      console.log(`${report.id}: ${[report.reason, ...report.signals].filter(Boolean).join(" | ")}`);
    }
  }
}
