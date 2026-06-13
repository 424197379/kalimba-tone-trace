import { readdir, readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { DISPLAY_KEYS } from "./build-song-library.mjs";

const SONGS_DIR_URL = new URL("../data/songs/", import.meta.url);
const SONGS_DIR_LABEL = "data/songs";
const SONG_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const COMMON_BEAT_UNIT = 0.25;
const LARGE_PHYSICAL_SPAN = 18;
const LARGE_PHYSICAL_JUMP = 18;
const ACCOMPANIMENT_MIN_VELOCITY = 0.05;
const ACCOMPANIMENT_MAX_VELOCITY = 1.2;
const EPSILON = 1e-9;

const REQUIRED_FIELDS = [
  "id",
  "title",
  "uploader",
  "practiceTitle",
  "scoreTitle",
  "hint",
  "difficulty",
  "bpm",
  "defaultSpeedFactor",
  "beatsPerMeasure"
];

const NOTE_ROLES = new Set(["melody", "harmony", "bass", "arpeggio", "ornament"]);
const ARRANGEMENT_KINDS = new Set(["melody", "chord"]);
const JUDGEMENT_MODES = new Set(["melody", "chord"]);
const RHYTHM_SOURCE_STATUSES = new Set(["verified", "inferred", "needs-review"]);
const RHYTHM_REST_POLICIES = new Set(["silent", "hold"]);
const SCHEMA_VALIDATORS = new Map([
  [1, validateSongV1],
  [2, validateSongV2]
]);
const noteNames = new Set(DISPLAY_KEYS.map((note) => note.name));
const notePositions = new Map(DISPLAY_KEYS.map((note, index) => [note.name, index]));

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatValue(value) {
  return JSON.stringify(value);
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function addIssue(issues, filePath, path, message) {
  issues.push(path ? `${filePath} ${path}: ${message}` : `${filePath}: ${message}`);
}

function addError(context, path, message) {
  addIssue(context.errors, context.filePath, path, message);
}

function addWarning(context, path, message) {
  addIssue(context.warnings, context.filePath, path, message);
}

function readJsonString(raw, start) {
  let escaped = false;

  for (let index = start + 1; index < raw.length; index += 1) {
    const char = raw[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      return {
        end: index,
        value: JSON.parse(raw.slice(start, index + 1))
      };
    }
  }

  return null;
}

function getTopLevelKeys(raw) {
  const keys = [];
  let depth = 0;
  let expectingKey = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (char === "\"") {
      const parsedString = readJsonString(raw, index);
      if (!parsedString) {
        return keys;
      }

      if (depth === 1 && expectingKey) {
        keys.push(parsedString.value);
        expectingKey = false;
      }

      index = parsedString.end;
      continue;
    }

    if (char === "{") {
      depth += 1;
      if (depth === 1) {
        expectingKey = true;
      }
      continue;
    }

    if (char === "}") {
      if (depth === 1) {
        expectingKey = false;
      }
      depth -= 1;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      continue;
    }

    if (depth === 1 && char === ",") {
      expectingKey = true;
    }
  }

  return keys;
}

function isMultipleOf(value, unit) {
  return Math.abs(value / unit - Math.round(value / unit)) < EPSILON;
}

function validateRequiredFields(song, context) {
  REQUIRED_FIELDS.forEach((field) => {
    if (!(field in song)) {
      addError(context, field, "missing required field");
    }
  });
}

function validateStringField(song, field, context) {
  if (!(field in song)) {
    return;
  }

  if (typeof song[field] !== "string" || !song[field].trim()) {
    addError(context, field, "must be a non-empty string");
  }
}

function validateNumberRange(song, field, min, max, context) {
  if (!(field in song)) {
    return;
  }

  if (!isFiniteNumber(song[field]) || song[field] < min || song[field] > max) {
    addError(context, field, `must be a finite number from ${min} to ${max}`);
  }
}

function validateIntegerRange(song, field, min, max, context) {
  if (!(field in song)) {
    return;
  }

  if (!Number.isInteger(song[field]) || song[field] < min || song[field] > max) {
    addError(context, field, `must be an integer from ${min} to ${max}`);
  }
}

function validateSongIdentity(song, context, seenIds) {
  if (!("id" in song)) {
    return;
  }

  if (typeof song.id !== "string" || !song.id.trim()) {
    addError(context, "id", `must be a non-empty string matching file name "${context.idFromFile}"`);
    return;
  }

  if (song.id !== context.idFromFile) {
    addError(context, "id", `must match file name "${context.idFromFile}"`);
  }

  if (!SONG_ID_PATTERN.test(song.id)) {
    addError(context, "id", "must use ASCII lowercase letters, numbers, and hyphens");
  }

  const firstFile = seenIds.get(song.id);
  if (firstFile) {
    addError(context, "id", `duplicate id "${song.id}"; first seen in ${firstFile}`);
  } else {
    seenIds.set(song.id, context.filePath);
  }
}

function validateSchemaVersion(song, context) {
  const schemaVersion = "schemaVersion" in song ? song.schemaVersion : 1;

  if (!Number.isInteger(schemaVersion)) {
    addError(context, "schemaVersion", "must be an integer; omit it to use schemaVersion 1");
    return null;
  }

  if (!SCHEMA_VALIDATORS.has(schemaVersion)) {
    addError(context, "schemaVersion", `unsupported schemaVersion ${formatValue(schemaVersion)}`);
    return null;
  }

  return schemaVersion;
}

function validateSongCommon(song, context, seenIds) {
  validateRequiredFields(song, context);
  validateSongIdentity(song, context, seenIds);

  ["title", "uploader", "practiceTitle", "scoreTitle", "hint"].forEach((field) => {
    validateStringField(song, field, context);
  });

  if ("difficulty" in song && !DIFFICULTIES.has(song.difficulty)) {
    addError(context, "difficulty", 'must be "easy", "medium", or "hard"');
  }

  validateNumberRange(song, "bpm", 40, 220, context);
  validateNumberRange(song, "defaultSpeedFactor", 0.35, 1.4, context);
  validateIntegerRange(song, "beatsPerMeasure", 2, 8, context);

  return validateSchemaVersion(song, context);
}

function isChordLikeStep(step) {
  return (
    (Array.isArray(step) && Array.isArray(step[0])) ||
    (isPlainObject(step) && Array.isArray(step.notes) && step.notes.length > 1)
  );
}

function validateStepV1(step, index, context) {
  const stepPath = `steps[${index}]`;

  if (isChordLikeStep(step)) {
    addError(
      context,
      stepPath,
      "schemaVersion 1 only supports single-note steps; chords should wait for schemaVersion 2"
    );
    return null;
  }

  if (!Array.isArray(step) || step.length !== 3) {
    addError(context, stepPath, "must be [noteName, beat, duration]");
    return null;
  }

  const [noteName, beat, duration] = step;

  if (typeof noteName !== "string") {
    addError(context, `${stepPath}[0]`, "must be a note name string");
  } else if (!noteNames.has(noteName)) {
    addError(context, `${stepPath}[0]`, `unknown note ${formatValue(noteName)}`);
  }

  if (!isFiniteNumber(beat) || beat < 0) {
    addError(context, `${stepPath}[1]`, "beat must be a finite number >= 0");
  } else if (!isMultipleOf(beat, COMMON_BEAT_UNIT)) {
    addWarning(context, `${stepPath}[1]`, `beat ${formatNumber(beat)} is not a multiple of ${COMMON_BEAT_UNIT}`);
  }

  if (!isFiniteNumber(duration) || duration <= 0) {
    addError(context, `${stepPath}[2]`, "duration must be a finite number > 0");
  } else {
    if (duration < 0.25) {
      addWarning(context, `${stepPath}[2]`, `duration ${formatNumber(duration)} is shorter than 0.25 beat`);
    }

    if (!isMultipleOf(duration, COMMON_BEAT_UNIT)) {
      addWarning(
        context,
        `${stepPath}[2]`,
        `duration ${formatNumber(duration)} is not a multiple of ${COMMON_BEAT_UNIT}`
      );
    }
  }

  if (
    typeof noteName !== "string" ||
    !noteNames.has(noteName) ||
    !isFiniteNumber(beat) ||
    beat < 0 ||
    !isFiniteNumber(duration) ||
    duration <= 0
  ) {
    return null;
  }

  return { noteName, beat, duration };
}

function validateStepOrder(step, index, previousBeat, context) {
  if (step.beat < previousBeat) {
    addError(context, `steps[${index}][1]`, "steps must be sorted by beat in non-decreasing order");
  }
}

function addStepQualityWarnings(validSteps, song, context) {
  if (validSteps.length > 300) {
    addWarning(context, "steps", `contains ${validSteps.length} notes; review whether it is too long for practice`);
  }

  if (!validSteps.length || !Number.isInteger(song.beatsPerMeasure)) {
    return;
  }

  const positions = validSteps.map((step) => notePositions.get(step.noteName));
  const minPosition = Math.min(...positions);
  const maxPosition = Math.max(...positions);
  const physicalSpan = maxPosition - minPosition;

  if (physicalSpan > LARGE_PHYSICAL_SPAN) {
    addWarning(context, "steps", `uses a physical key span of ${physicalSpan}; review playability`);
  }

  for (let index = 1; index < validSteps.length; index += 1) {
    const previous = validSteps[index - 1];
    const current = validSteps[index];
    const jump = Math.abs(notePositions.get(current.noteName) - notePositions.get(previous.noteName));

    if (jump > LARGE_PHYSICAL_JUMP) {
      addWarning(
        context,
        `steps[${index}]`,
        `large physical key jump of ${jump} from ${previous.noteName} to ${current.noteName}`
      );
    }
  }

  const endBeat = validSteps.reduce((max, step) => Math.max(max, step.beat + step.duration), 0);
  if (!isMultipleOf(endBeat, song.beatsPerMeasure)) {
    addWarning(
      context,
      "steps",
      `total length ${formatNumber(endBeat)} beats does not align to beatsPerMeasure ${song.beatsPerMeasure}`
    );
  }

}

function validateSongVersionFields(song, context) {
  if ("baseSongId" in song) {
    if (typeof song.baseSongId !== "string" || !SONG_ID_PATTERN.test(song.baseSongId)) {
      addError(context, "baseSongId", "must use ASCII lowercase letters, numbers, and hyphens when provided");
    }
  }

  if ("versionLabel" in song) {
    validateStringField(song, "versionLabel", context);
  }

  if ("arrangementKind" in song && !ARRANGEMENT_KINDS.has(song.arrangementKind)) {
    addError(context, "arrangementKind", 'must be "melody" or "chord"');
  }

  if ("judgementMode" in song && !JUDGEMENT_MODES.has(song.judgementMode)) {
    addError(context, "judgementMode", 'must be "melody" or "chord"');
  }

  if ("key" in song && song.key !== "C") {
    addError(context, "key", 'must be "C" when provided');
  }

  if ("tuning" in song && song.tuning !== "21-key-c") {
    addError(context, "tuning", 'must be "21-key-c" when provided');
  }
}

function validateSongV1(song, context) {
  validateSongVersionFields(song, context);

  if ("autoAccompaniment" in song) {
    addError(context, "autoAccompaniment", "is only supported by schemaVersion 2");
  }

  if ("rhythm" in song) {
    addError(context, "rhythm", "is only supported by schemaVersion 2");
  }

  if (!Array.isArray(song.steps)) {
    addError(context, "steps", "must be a non-empty array");
    return;
  }

  if (!song.steps.length) {
    addError(context, "steps", "must contain at least one step");
    return;
  }

  let previousBeat = Number.NEGATIVE_INFINITY;
  const validSteps = [];

  song.steps.forEach((step, index) => {
    const normalizedStep = validateStepV1(step, index, context);

    if (!normalizedStep) {
      return;
    }

    validateStepOrder(normalizedStep, index, previousBeat, context);
    previousBeat = Math.max(previousBeat, normalizedStep.beat);
    validSteps.push(normalizedStep);
  });

  context.stepCount += song.steps.length;
  addStepQualityWarnings(validSteps, song, context);
}

function validateEventNoteV2(note, eventIndex, noteIndex, context) {
  const notePath = `events[${eventIndex}].notes[${noteIndex}]`;

  if (typeof note === "string") {
    if (!noteNames.has(note)) {
      addError(context, notePath, `unknown note ${formatValue(note)}`);
      return null;
    }
    return {
      noteName: note,
      role: "melody",
      judge: false
    };
  }

  if (!isPlainObject(note)) {
    addError(context, notePath, "must be a note name string or note object");
    return null;
  }

  if (typeof note.name !== "string") {
    addError(context, `${notePath}.name`, "must be a note name string");
  } else if (!noteNames.has(note.name)) {
    addError(context, `${notePath}.name`, `unknown note ${formatValue(note.name)}`);
  }

  if ("role" in note && !NOTE_ROLES.has(note.role)) {
    addError(context, `${notePath}.role`, 'must be one of "melody", "harmony", "bass", "arpeggio", or "ornament"');
  }

  if ("judge" in note && typeof note.judge !== "boolean") {
    addError(context, `${notePath}.judge`, "must be a boolean when provided");
  }

  if ("velocity" in note && (!isFiniteNumber(note.velocity) || note.velocity < 0.1 || note.velocity > 1.2)) {
    addError(context, `${notePath}.velocity`, "must be a finite number from 0.1 to 1.2");
  }

  if (typeof note.name !== "string" || !noteNames.has(note.name)) {
    return null;
  }

  return {
    noteName: note.name,
    role: NOTE_ROLES.has(note.role) ? note.role : "melody",
    judge: typeof note.judge === "boolean" ? note.judge : false
  };
}

function validateEventV2(event, index, previousBeat, context) {
  const eventPath = `events[${index}]`;

  if (!isPlainObject(event)) {
    addError(context, eventPath, "must be an object");
    return null;
  }

  if (!isFiniteNumber(event.beat) || event.beat < 0) {
    addError(context, `${eventPath}.beat`, "must be a finite number >= 0");
  } else if (!isMultipleOf(event.beat, COMMON_BEAT_UNIT)) {
    addWarning(context, `${eventPath}.beat`, `beat ${formatNumber(event.beat)} is not a multiple of ${COMMON_BEAT_UNIT}`);
  }

  if (isFiniteNumber(event.beat) && event.beat < previousBeat) {
    addError(context, `${eventPath}.beat`, "events must be sorted by beat in non-decreasing order");
  }

  if (!isFiniteNumber(event.duration) || event.duration <= 0) {
    addError(context, `${eventPath}.duration`, "must be a finite number > 0");
  } else {
    if (event.duration < 0.25) {
      addWarning(context, `${eventPath}.duration`, `duration ${formatNumber(event.duration)} is shorter than 0.25 beat`);
    }
    if (!isMultipleOf(event.duration, COMMON_BEAT_UNIT)) {
      addWarning(
        context,
        `${eventPath}.duration`,
        `duration ${formatNumber(event.duration)} is not a multiple of ${COMMON_BEAT_UNIT}`
      );
    }
  }

  if ("judgeWindow" in event && (!isFiniteNumber(event.judgeWindow) || event.judgeWindow < 0.1 || event.judgeWindow > 2)) {
    addError(context, `${eventPath}.judgeWindow`, "must be a finite number from 0.1 to 2 when provided");
  }

  if (!Array.isArray(event.notes) || !event.notes.length) {
    addError(context, `${eventPath}.notes`, "must be a non-empty array");
    return null;
  }

  const seenNotes = new Set();
  const validNotes = [];
  event.notes.forEach((note, noteIndex) => {
    const normalizedNote = validateEventNoteV2(note, index, noteIndex, context);
    if (!normalizedNote) {
      return;
    }

    if (seenNotes.has(normalizedNote.noteName)) {
      addError(context, `${eventPath}.notes[${noteIndex}].name`, `duplicate note ${formatValue(normalizedNote.noteName)} in event`);
    } else {
      seenNotes.add(normalizedNote.noteName);
    }
    validNotes.push(normalizedNote);
  });

  if (event.notes.length > 4) {
    addWarning(context, `${eventPath}.notes`, `contains ${event.notes.length} notes; review playability`);
  }

  if (
    !isFiniteNumber(event.beat) ||
    event.beat < 0 ||
    !isFiniteNumber(event.duration) ||
    event.duration <= 0 ||
    !validNotes.length
  ) {
    return null;
  }

  return {
    beat: event.beat,
    duration: event.duration,
    notes: validNotes
  };
}

function validateAutoAccompanimentNote(note, eventIndex, noteIndex, context) {
  const notePath = `autoAccompaniment.events[${eventIndex}].notes[${noteIndex}]`;

  if (typeof note === "string") {
    if (!noteNames.has(note)) {
      addError(context, notePath, `unknown note ${formatValue(note)}`);
      return null;
    }
    return {
      noteName: note,
      role: "harmony"
    };
  }

  if (!isPlainObject(note)) {
    addError(context, notePath, "must be a note name string or note object");
    return null;
  }

  if (typeof note.name !== "string") {
    addError(context, `${notePath}.name`, "must be a note name string");
  } else if (!noteNames.has(note.name)) {
    addError(context, `${notePath}.name`, `unknown note ${formatValue(note.name)}`);
  }

  if ("role" in note && !NOTE_ROLES.has(note.role)) {
    addError(context, `${notePath}.role`, 'must be one of "melody", "harmony", "bass", "arpeggio", or "ornament"');
  }

  if ("judge" in note) {
    addError(context, `${notePath}.judge`, "autoAccompaniment notes must not include judge");
  }

  if (
    "velocity" in note &&
    (!isFiniteNumber(note.velocity) || note.velocity < ACCOMPANIMENT_MIN_VELOCITY || note.velocity > ACCOMPANIMENT_MAX_VELOCITY)
  ) {
    addError(
      context,
      `${notePath}.velocity`,
      `must be a finite number from ${ACCOMPANIMENT_MIN_VELOCITY} to ${ACCOMPANIMENT_MAX_VELOCITY}`
    );
  }

  if (typeof note.name !== "string" || !noteNames.has(note.name)) {
    return null;
  }

  return {
    noteName: note.name,
    role: NOTE_ROLES.has(note.role) ? note.role : "harmony"
  };
}

function validateAutoAccompanimentEvent(event, index, previousBeat, context) {
  const eventPath = `autoAccompaniment.events[${index}]`;

  if (!isPlainObject(event)) {
    addError(context, eventPath, "must be an object");
    return null;
  }

  if (!isFiniteNumber(event.beat) || event.beat < 0) {
    addError(context, `${eventPath}.beat`, "must be a finite number >= 0");
  } else if (!isMultipleOf(event.beat, COMMON_BEAT_UNIT)) {
    addWarning(context, `${eventPath}.beat`, `beat ${formatNumber(event.beat)} is not a multiple of ${COMMON_BEAT_UNIT}`);
  }

  if (isFiniteNumber(event.beat) && event.beat < previousBeat) {
    addError(context, `${eventPath}.beat`, "events must be sorted by beat in non-decreasing order");
  }

  if (!isFiniteNumber(event.duration) || event.duration <= 0) {
    addError(context, `${eventPath}.duration`, "must be a finite number > 0");
  } else {
    if (event.duration < 0.25) {
      addWarning(context, `${eventPath}.duration`, `duration ${formatNumber(event.duration)} is shorter than 0.25 beat`);
    }
    if (!isMultipleOf(event.duration, COMMON_BEAT_UNIT)) {
      addWarning(
        context,
        `${eventPath}.duration`,
        `duration ${formatNumber(event.duration)} is not a multiple of ${COMMON_BEAT_UNIT}`
      );
    }
  }

  if ("pattern" in event && (typeof event.pattern !== "string" || !event.pattern.trim())) {
    addError(context, `${eventPath}.pattern`, "must be a non-empty string when provided");
  }

  if (!Array.isArray(event.notes) || !event.notes.length) {
    addError(context, `${eventPath}.notes`, "must be a non-empty array");
    return null;
  }

  const seenNotes = new Set();
  const validNotes = [];
  event.notes.forEach((note, noteIndex) => {
    const normalizedNote = validateAutoAccompanimentNote(note, index, noteIndex, context);
    if (!normalizedNote) {
      return;
    }

    if (seenNotes.has(normalizedNote.noteName)) {
      addError(
        context,
        `${eventPath}.notes[${noteIndex}].name`,
        `duplicate note ${formatValue(normalizedNote.noteName)} in autoAccompaniment event`
      );
    } else {
      seenNotes.add(normalizedNote.noteName);
    }
    validNotes.push(normalizedNote);
  });

  if (event.notes.length > 5) {
    addWarning(context, `${eventPath}.notes`, `contains ${event.notes.length} notes; review accompaniment density`);
  }

  if (
    !isFiniteNumber(event.beat) ||
    event.beat < 0 ||
    !isFiniteNumber(event.duration) ||
    event.duration <= 0 ||
    !validNotes.length
  ) {
    return null;
  }

  return {
    beat: event.beat,
    duration: event.duration,
    notes: validNotes
  };
}

function validateAutoAccompaniment(song, context) {
  if (!("autoAccompaniment" in song)) {
    return [];
  }

  const autoAccompaniment = song.autoAccompaniment;
  if (!isPlainObject(autoAccompaniment)) {
    addError(context, "autoAccompaniment", "must be an object when provided");
    return [];
  }

  if ("enabledByDefault" in autoAccompaniment && typeof autoAccompaniment.enabledByDefault !== "boolean") {
    addError(context, "autoAccompaniment.enabledByDefault", "must be a boolean when provided");
  }

  if (
    "volume" in autoAccompaniment &&
    (!isFiniteNumber(autoAccompaniment.volume) || autoAccompaniment.volume < 0 || autoAccompaniment.volume > 1)
  ) {
    addError(context, "autoAccompaniment.volume", "must be a finite number from 0 to 1 when provided");
  }

  if (!Array.isArray(autoAccompaniment.events)) {
    addError(context, "autoAccompaniment.events", "must be a non-empty array");
    return [];
  }

  if (!autoAccompaniment.events.length) {
    addError(context, "autoAccompaniment.events", "must contain at least one event");
    return [];
  }

  let previousBeat = Number.NEGATIVE_INFINITY;
  const validEvents = [];
  autoAccompaniment.events.forEach((event, index) => {
    const normalizedEvent = validateAutoAccompanimentEvent(event, index, previousBeat, context);
    if (normalizedEvent) {
      previousBeat = Math.max(previousBeat, normalizedEvent.beat);
      validEvents.push(normalizedEvent);
    }
  });

  return validEvents;
}

function validateRhythmSource(source, index, context) {
  const sourcePath = `rhythm.sources[${index}]`;

  if (!isPlainObject(source)) {
    addError(context, sourcePath, "must be an object");
    return;
  }

  if (typeof source.label !== "string" || !source.label.trim()) {
    addError(context, `${sourcePath}.label`, "must be a non-empty string");
  }

  if (typeof source.url !== "string" || !source.url.trim()) {
    addError(context, `${sourcePath}.url`, "must be a non-empty string");
    return;
  }

  try {
    const url = new URL(source.url);
    if (!["http:", "https:"].includes(url.protocol)) {
      addError(context, `${sourcePath}.url`, "must use http or https");
    }
  } catch {
    addError(context, `${sourcePath}.url`, "must be a valid URL");
  }
}

function validateRhythmRestWindow(window, index, previous, totalBeat, context) {
  const windowPath = `rhythm.restWindows[${index}]`;

  if (!isPlainObject(window)) {
    addError(context, windowPath, "must be an object");
    return null;
  }

  if (!isFiniteNumber(window.beat) || window.beat < 0) {
    addError(context, `${windowPath}.beat`, "must be a finite number >= 0");
  } else if (!isMultipleOf(window.beat, COMMON_BEAT_UNIT)) {
    addWarning(context, `${windowPath}.beat`, `beat ${formatNumber(window.beat)} is not a multiple of ${COMMON_BEAT_UNIT}`);
  }

  if (!isFiniteNumber(window.duration) || window.duration <= 0) {
    addError(context, `${windowPath}.duration`, "must be a finite number > 0");
  } else {
    if (window.duration < 1) {
      addWarning(context, `${windowPath}.duration`, "rest windows shorter than 1 beat are usually unnecessary");
    }
    if (!isMultipleOf(window.duration, COMMON_BEAT_UNIT)) {
      addWarning(
        context,
        `${windowPath}.duration`,
        `duration ${formatNumber(window.duration)} is not a multiple of ${COMMON_BEAT_UNIT}`
      );
    }
  }

  const policy = window.policy || "silent";
  if (!RHYTHM_REST_POLICIES.has(policy)) {
    addError(context, `${windowPath}.policy`, 'must be "silent" or "hold"');
  }

  if ("reason" in window && (typeof window.reason !== "string" || !window.reason.trim())) {
    addError(context, `${windowPath}.reason`, "must be a non-empty string when provided");
  }

  if (
    !isFiniteNumber(window.beat) ||
    window.beat < 0 ||
    !isFiniteNumber(window.duration) ||
    window.duration <= 0 ||
    !RHYTHM_REST_POLICIES.has(policy)
  ) {
    return null;
  }

  const endBeat = window.beat + window.duration;
  if (previous) {
    if (window.beat < previous.beat) {
      addError(context, `${windowPath}.beat`, "restWindows must be sorted by beat");
    }
    if (window.beat < previous.endBeat - EPSILON) {
      addError(context, windowPath, `overlaps previous rest window ending at beat ${formatNumber(previous.endBeat)}`);
    }
  }

  if (totalBeat > 0 && endBeat > totalBeat + EPSILON) {
    addError(context, windowPath, `ends at beat ${formatNumber(endBeat)} beyond song length ${formatNumber(totalBeat)}`);
  }

  return {
    beat: window.beat,
    duration: window.duration,
    endBeat,
    policy,
    index
  };
}

function validateRhythm(song, validEvents, context) {
  if (!("rhythm" in song)) {
    return [];
  }

  const rhythm = song.rhythm;
  if (!isPlainObject(rhythm)) {
    addError(context, "rhythm", "must be an object when provided");
    return [];
  }

  if (!RHYTHM_SOURCE_STATUSES.has(rhythm.sourceStatus)) {
    addError(context, "rhythm.sourceStatus", 'must be "verified", "inferred", or "needs-review"');
  }

  if (
    "pickupBeats" in rhythm &&
    (!isFiniteNumber(rhythm.pickupBeats) || rhythm.pickupBeats < 0 || !isMultipleOf(rhythm.pickupBeats, COMMON_BEAT_UNIT))
  ) {
    addError(context, "rhythm.pickupBeats", `must be a finite number >= 0 and a multiple of ${COMMON_BEAT_UNIT}`);
  }

  if ("sources" in rhythm) {
    if (!Array.isArray(rhythm.sources)) {
      addError(context, "rhythm.sources", "must be an array when provided");
    } else {
      rhythm.sources.forEach((source, index) => validateRhythmSource(source, index, context));
    }
  }

  if (rhythm.sourceStatus === "verified" && (!Array.isArray(rhythm.sources) || !rhythm.sources.length)) {
    addWarning(context, "rhythm.sources", 'verified rhythm should include at least one source');
  }

  if (!("restWindows" in rhythm)) {
    return [];
  }

  if (!Array.isArray(rhythm.restWindows)) {
    addError(context, "rhythm.restWindows", "must be an array when provided");
    return [];
  }

  const totalBeat = validEvents.reduce((max, event) => Math.max(max, event.beat + event.duration), 0);
  const validWindows = [];
  rhythm.restWindows.forEach((window, index) => {
    const normalizedWindow = validateRhythmRestWindow(
      window,
      index,
      validWindows[validWindows.length - 1],
      totalBeat,
      context
    );
    if (normalizedWindow) {
      validWindows.push(normalizedWindow);
    }
  });

  return validWindows;
}

function overlapsBeatRange(event, range) {
  return event.beat < range.endBeat - EPSILON && event.beat + event.duration > range.beat + EPSILON;
}

function validateAutoAccompanimentAgainstRhythm(autoEvents, restWindows, context) {
  if (!autoEvents.length || !restWindows.length) {
    return;
  }

  restWindows.forEach((window) => {
    const overlappingEvents = autoEvents.filter((event) => overlapsBeatRange(event, window));
    if (!overlappingEvents.length) {
      return;
    }

    const path = `rhythm.restWindows[${window.index}]`;
    if (window.policy === "silent") {
      addError(
        context,
        path,
        `silent rest window contains ${overlappingEvents.length} autoAccompaniment event(s)`
      );
      return;
    }

    if (window.policy === "hold") {
      if (overlappingEvents.length > 1) {
        addError(context, path, `hold rest window contains ${overlappingEvents.length} autoAccompaniment events`);
      }
      if (overlappingEvents.some((event) => event.beat > window.beat + COMMON_BEAT_UNIT + EPSILON)) {
        addError(context, path, "hold rest window may only contain an event near the rest start");
      }
    }
  });
}

function validateSongV2(song, context) {
  validateSongVersionFields(song, context);

  if (!Array.isArray(song.events)) {
    addError(context, "events", "must be a non-empty array");
    return;
  }

  if (!song.events.length) {
    addError(context, "events", "must contain at least one event");
    return;
  }

  if ("steps" in song) {
    addWarning(context, "steps", "schemaVersion 2 uses events; steps are ignored when present");
  }

  const judgementMode = song.judgementMode || (song.arrangementKind === "chord" ? "chord" : "melody");
  let previousBeat = Number.NEGATIVE_INFINITY;
  const validEvents = [];
  let judgeEventCount = 0;
  let multiJudgeEventCount = 0;

  song.events.forEach((event, index) => {
    const normalizedEvent = validateEventV2(event, index, previousBeat, context);
    if (!normalizedEvent) {
      return;
    }

    previousBeat = Math.max(previousBeat, normalizedEvent.beat);
    validEvents.push(normalizedEvent);
    const markedJudgeNotes = normalizedEvent.notes.filter((note) => note.judge);
    const melodyJudgeNotes = markedJudgeNotes.filter((note) => note.role === "melody");
    const judgeNotes = judgementMode === "chord" ? markedJudgeNotes : melodyJudgeNotes.slice(0, 1);
    if (judgeNotes.length) {
      judgeEventCount += 1;
    }
    if (judgeNotes.length >= 2) {
      multiJudgeEventCount += 1;
    }
  });

  if (!judgeEventCount) {
    addError(context, "events", "must contain at least one judgeable event");
  }

  if (judgementMode === "chord" && !multiJudgeEventCount) {
    addError(context, "events", 'judgementMode "chord" must include at least one event with two or more judge notes');
  }

  const validSteps = validEvents.flatMap((event) =>
    (judgementMode === "chord"
      ? event.notes.filter((note) => note.judge)
      : event.notes.filter((note) => note.judge && note.role === "melody").slice(0, 1)
    ).map((note) => ({
        noteName: note.noteName,
        beat: event.beat,
        duration: event.duration
      }))
  );

  context.stepCount += validSteps.length;
  addStepQualityWarnings(validSteps, song, context);
  const rhythmWindows = validateRhythm(song, validEvents, context);
  const autoEvents = validateAutoAccompaniment(song, context);
  validateAutoAccompanimentAgainstRhythm(autoEvents, rhythmWindows, context);
}

async function listSongFiles(errors) {
  try {
    const songsDirStat = await stat(SONGS_DIR_URL);

    if (!songsDirStat.isDirectory()) {
      errors.push(`${SONGS_DIR_LABEL} exists but is not a directory`);
      return [];
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      errors.push("data/songs directory not found. Run the song library engineering step first.");
    } else {
      errors.push(`cannot access ${SONGS_DIR_LABEL}: ${error.message}`);
    }
    return [];
  }

  const entries = await readdir(SONGS_DIR_URL, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  if (!files.length) {
    errors.push("data/songs must contain at least one .json song file");
  }

  return files;
}

async function readSong(fileName, errors) {
  const idFromFile = fileName.slice(0, -5);
  const filePath = `${SONGS_DIR_LABEL}/${fileName}`;
  const fileUrl = new URL(fileName, SONGS_DIR_URL);

  if (!SONG_ID_PATTERN.test(idFromFile)) {
    addIssue(
      errors,
      filePath,
      null,
      `file name "${basename(fileName, ".json")}" must use ASCII lowercase letters, numbers, and hyphens`
    );
  }

  try {
    const raw = await readFile(fileUrl, "utf8");
    let song;

    try {
      song = JSON.parse(raw);
    } catch (error) {
      addIssue(errors, filePath, null, `invalid JSON: ${error.message}`);
      return null;
    }

    const topLevelKeys = getTopLevelKeys(raw);
    const duplicateIdCount = topLevelKeys.filter((key) => key === "id").length;

    return {
      duplicateIdCount,
      fileName,
      filePath,
      idFromFile,
      song
    };
  } catch (error) {
    addIssue(errors, filePath, null, `cannot read file: ${error.message}`);
    return null;
  }
}

function validateSongFile(songFile, errors, warnings, seenIds) {
  const context = {
    errors,
    fileName: songFile.fileName,
    filePath: songFile.filePath,
    idFromFile: songFile.idFromFile,
    stepCount: 0,
    warnings
  };

  if (!isPlainObject(songFile.song)) {
    addError(context, null, "root JSON value must be an object");
    return context.stepCount;
  }

  if (songFile.duplicateIdCount > 1) {
    addError(context, "id", "duplicate top-level id field");
  }

  const schemaVersion = validateSongCommon(songFile.song, context, seenIds);
  const schemaValidator = SCHEMA_VALIDATORS.get(schemaVersion);

  if (schemaValidator) {
    schemaValidator(songFile.song, context);
  }

  return context.stepCount;
}

function printIssues(label, issues, writer) {
  if (!issues.length) {
    return;
  }

  writer(`${label}:`);
  issues.forEach((issue) => writer(`- ${issue}`));
}

async function main() {
  const errors = [];
  const warnings = [];
  const files = await listSongFiles(errors);
  const songFiles = [];
  const seenIds = new Map();
  let totalSteps = 0;

  for (const fileName of files) {
    const songFile = await readSong(fileName, errors);
    if (songFile) {
      songFiles.push(songFile);
    }
  }

  songFiles.forEach((songFile) => {
    totalSteps += validateSongFile(songFile, errors, warnings, seenIds);
  });

  if (warnings.length) {
    printIssues("Song validation warnings", warnings, console.log);
  }

  if (errors.length) {
    printIssues("Song validation errors", errors, console.error);
    console.error(
      `Song validation failed: ${songFiles.length} songs, ${totalSteps} steps, ${errors.length} errors, ${warnings.length} warnings.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Song validation passed: ${songFiles.length} songs, ${totalSteps} steps, 0 errors, ${warnings.length} warnings.`
  );
}

await main();
