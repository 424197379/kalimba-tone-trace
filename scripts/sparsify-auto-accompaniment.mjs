import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_MAX_DENSITY = 0.55;

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

function getTotalBeats(events) {
  if (!events.length) {
    return 0;
  }
  return Math.max(...events.map((event) => Number(event.beat) + Number(event.duration)));
}

function isMeasureStart(beat, beatsPerMeasure) {
  return Math.abs(beat / beatsPerMeasure - Math.round(beat / beatsPerMeasure)) < 1e-9;
}

function getMelodyStarts(events) {
  return new Set(events.map((event) => Number(event.beat)).filter(Number.isFinite));
}

function overlaps(firstBeat, firstDuration, secondBeat, secondDuration) {
  return firstBeat < secondBeat + secondDuration && secondBeat < firstBeat + firstDuration;
}

function isInsideSilentRest(event, restWindows) {
  return restWindows
    .filter((window) => window.policy !== "hold")
    .some((window) => overlaps(event.beat, event.duration, Number(window.beat), Number(window.duration)));
}

function getEventWeight(event, songEvents, beatsPerMeasure) {
  const beat = Number(event.beat);
  let weight = 0;
  if (isMeasureStart(beat, beatsPerMeasure)) {
    weight += 100;
  }
  if (Math.abs(beat - Math.round(beat)) < 1e-9) {
    weight += 30;
  }
  if (songEvents.has(beat)) {
    weight += 10;
  }
  if ((event.notes || []).some((note) => note.role === "bass")) {
    weight += 8;
  }
  return weight;
}

function sparsify(song, maxDensity = DEFAULT_MAX_DENSITY) {
  const songEvents = getEvents(song);
  const totalBeats = getTotalBeats(songEvents);
  const autoEvents = Array.isArray(song.autoAccompaniment?.events) ? song.autoAccompaniment.events : [];
  if (!totalBeats || !autoEvents.length) {
    return { song, removed: 0, kept: autoEvents.length };
  }

  const maxEvents = Math.max(1, Math.floor(totalBeats * maxDensity));
  const restWindows = Array.isArray(song.rhythm?.restWindows) ? song.rhythm.restWindows : [];
  const melodyStarts = getMelodyStarts(songEvents);
  const candidates = autoEvents
    .filter((event) => !isInsideSilentRest(event, restWindows))
    .map((event, index) => ({
      event,
      index,
      weight: getEventWeight(event, melodyStarts, Number(song.beatsPerMeasure || 4))
    }))
    .sort((a, b) => b.weight - a.weight || Number(a.event.beat) - Number(b.event.beat) || a.index - b.index);

  const keepIndexes = new Set(candidates.slice(0, maxEvents).map((item) => item.index));
  const events = autoEvents
    .filter((_, index) => keepIndexes.has(index))
    .sort((a, b) => Number(a.beat) - Number(b.beat) || (a.notes?.[0]?.name || "").localeCompare(b.notes?.[0]?.name || ""));

  return {
    song: {
      ...song,
      autoAccompaniment: {
        ...song.autoAccompaniment,
        events
      }
    },
    removed: autoEvents.length - events.length,
    kept: events.length
  };
}

const args = process.argv.slice(2);
const write = args.includes("--write");
const files = args.filter((arg) => arg !== "--write" && !arg.startsWith("--max-density="));
const densityArg = args.find((arg) => arg.startsWith("--max-density="));
const maxDensity = densityArg ? Number(densityArg.split("=")[1]) : DEFAULT_MAX_DENSITY;

if (!files.length || !Number.isFinite(maxDensity) || maxDensity <= 0) {
  console.error("Usage: node scripts/sparsify-auto-accompaniment.mjs [--write] [--max-density=0.55] data/songs/*-chord.json");
  process.exit(1);
}

for (const file of files) {
  const song = JSON.parse(await readFile(file, "utf8"));
  const before = Array.isArray(song.autoAccompaniment?.events) ? song.autoAccompaniment.events.length : 0;
  const { song: updatedSong, removed, kept } = sparsify(song, maxDensity);
  console.log(`${file}: ${before} -> ${kept} auto events (${removed} removed)`);
  if (write && removed > 0) {
    await writeFile(file, `${JSON.stringify(updatedSong, null, 2)}\n`);
  }
}
