import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const SONGS_DIR = join(process.cwd(), "data", "songs");
const DENSE_AUTO_THRESHOLD = 0.85;
const FEW_MULTI_RATIO = 0.05;
const MANY_MULTI_RATIO = 0.65;

function getEvents(song) {
  if (Array.isArray(song.events)) {
    return song.events;
  }

  if (Array.isArray(song.steps)) {
    return song.steps.map(([name, beat, duration]) => ({
      beat,
      duration,
      notes: [{ name, role: "melody", judge: true }]
    }));
  }

  return [];
}

function getLongGaps(events) {
  const sortedEvents = [...events]
    .filter((event) => Number.isFinite(Number(event.beat)) && Number.isFinite(Number(event.duration)))
    .sort((a, b) => Number(a.beat) - Number(b.beat));
  const gaps = [];

  for (let index = 1; index < sortedEvents.length; index += 1) {
    const previousEnd = Number(sortedEvents[index - 1].beat) + Number(sortedEvents[index - 1].duration);
    const gapDuration = Number(sortedEvents[index].beat) - previousEnd;
    if (gapDuration >= 1) {
      gaps.push({ beat: previousEnd, duration: gapDuration });
    }
  }

  return gaps;
}

function getTotalBeats(events) {
  if (!events.length) {
    return 0;
  }

  return Math.max(...events.map((event) => Number(event.beat) + Number(event.duration)));
}

function summarize(song) {
  const events = getEvents(song);
  const totalBeats = getTotalBeats(events);
  const autoEvents = Array.isArray(song.autoAccompaniment?.events) ? song.autoAccompaniment.events : [];
  const restWindows = Array.isArray(song.rhythm?.restWindows) ? song.rhythm.restWindows : [];
  const longGaps = getLongGaps(events);
  const multiEvents = events.filter((event) => (event.notes || []).length > 1);
  const judgeMultiEvents = events.filter((event) => (event.notes || []).filter((note) => note.judge).length > 1);
  const multiRatio = events.length ? multiEvents.length / events.length : 0;
  const autoDensity = totalBeats ? autoEvents.length / totalBeats : 0;
  const risks = [];

  if (song.rhythm?.sourceStatus && song.rhythm.sourceStatus !== "verified") {
    risks.push(`source=${song.rhythm.sourceStatus}`);
  } else if (song.schemaVersion === 2 && autoEvents.length && !song.rhythm?.sourceStatus) {
    risks.push("source=none");
  }

  if (autoDensity > DENSE_AUTO_THRESHOLD) {
    risks.push(`denseAuto=${autoDensity.toFixed(2)}`);
  }

  if (longGaps.length > restWindows.length) {
    risks.push(`rests=${restWindows.length}/${longGaps.length}`);
  }

  if (multiRatio < FEW_MULTI_RATIO) {
    risks.push("fewMulti");
  } else if (multiRatio > MANY_MULTI_RATIO) {
    risks.push("manyMulti");
  }

  return {
    id: song.id,
    title: song.title,
    schemaVersion: song.schemaVersion || 1,
    events: events.length,
    multiEvents: multiEvents.length,
    judgeMultiEvents: judgeMultiEvents.length,
    autoEvents: autoEvents.length,
    autoDensity: Number(autoDensity.toFixed(2)),
    longGaps: longGaps.length,
    restWindows: restWindows.length,
    sourceStatus: song.rhythm?.sourceStatus || "none",
    risk: risks.join("; ")
  };
}

const files = (await readdir(SONGS_DIR)).filter((file) => file.endsWith(".json")).sort();
const rows = [];

for (const file of files) {
  const song = JSON.parse(await readFile(join(SONGS_DIR, file), "utf8"));
  if (Number(song.schemaVersion || 1) === 2) {
    rows.push(summarize(song));
  }
}

rows.sort((a, b) => {
  const aRisk = a.risk ? 1 : 0;
  const bRisk = b.risk ? 1 : 0;
  return bRisk - aRisk || b.autoDensity - a.autoDensity || a.id.localeCompare(b.id);
});

console.table(rows);
