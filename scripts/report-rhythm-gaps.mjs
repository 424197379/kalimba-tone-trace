import { readdir, readFile } from "node:fs/promises";

const SONGS_DIR_URL = new URL("../data/songs/", import.meta.url);
const MIN_REST_BEATS = 1;
const EPSILON = 1e-9;

function roundBeat(value) {
  return Math.round(value * 1000) / 1000;
}

function getSongEvents(song) {
  if (Array.isArray(song.events)) {
    return song.events
      .filter((event) =>
        Array.isArray(event.notes) &&
        event.notes.some((note) => note && note.role === "melody" && note.judge !== false)
      )
      .map((event) => ({
        beat: Number(event.beat),
        duration: Number(event.duration)
      }))
      .filter((event) => Number.isFinite(event.beat) && Number.isFinite(event.duration) && event.duration > 0);
  }

  if (Array.isArray(song.steps)) {
    return song.steps
      .map((step) => ({
        beat: Number(step?.[1]),
        duration: Number(step?.[2])
      }))
      .filter((event) => Number.isFinite(event.beat) && Number.isFinite(event.duration) && event.duration > 0);
  }

  return [];
}

function inferRestWindows(song) {
  const events = getSongEvents(song).sort((a, b) => a.beat - b.beat);
  const windows = [];
  let cursor = 0;

  events.forEach((event) => {
    if (event.beat - cursor >= MIN_REST_BEATS - EPSILON) {
      windows.push({
        beat: roundBeat(cursor),
        duration: roundBeat(event.beat - cursor)
      });
    }
    cursor = Math.max(cursor, event.beat + event.duration);
  });

  return windows;
}

function getRhythmRestWindows(song) {
  return Array.isArray(song.rhythm?.restWindows)
    ? song.rhythm.restWindows
        .map((window) => ({
          beat: Number(window.beat),
          duration: Number(window.duration),
          policy: window.policy || "silent"
        }))
        .filter((window) => Number.isFinite(window.beat) && Number.isFinite(window.duration) && window.duration > 0)
    : [];
}

function getAutoEvents(song) {
  return Array.isArray(song.autoAccompaniment?.events)
    ? song.autoAccompaniment.events
        .map((event) => ({
          beat: Number(event.beat),
          duration: Number(event.duration)
        }))
        .filter((event) => Number.isFinite(event.beat) && Number.isFinite(event.duration) && event.duration > 0)
    : [];
}

function overlaps(event, window) {
  return event.beat < window.beat + window.duration - EPSILON &&
    event.beat + event.duration > window.beat + EPSILON;
}

async function readSongs() {
  const entries = await readdir(SONGS_DIR_URL, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  return Promise.all(
    files.map(async (fileName) => {
      const raw = await readFile(new URL(fileName, SONGS_DIR_URL), "utf8");
      return JSON.parse(raw);
    })
  );
}

const songs = await readSongs();
const report = songs.map((song) => {
  const inferredRestWindows = inferRestWindows(song);
  const rhythmRestWindows = getRhythmRestWindows(song);
  const autoEvents = getAutoEvents(song);
  const checkedWindows = rhythmRestWindows.length ? rhythmRestWindows : inferredRestWindows;
  const conflicts = checkedWindows
    .map((window) => ({
      beat: window.beat,
      duration: window.duration,
      policy: window.policy || "silent",
      autoEventCount: autoEvents.filter((event) => overlaps(event, window)).length
    }))
    .filter((window) => window.autoEventCount > 0);

  return {
    id: song.id,
    title: song.title,
    schemaVersion: song.schemaVersion || 1,
    sourceStatus: song.rhythm?.sourceStatus || "none",
    inferredRestWindows: inferredRestWindows.length,
    rhythmRestWindows: rhythmRestWindows.length,
    autoEvents: autoEvents.length,
    conflicts
  };
});

console.log(JSON.stringify(report, null, 2));
