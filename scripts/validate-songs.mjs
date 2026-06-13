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
  "beatsPerMeasure",
  "steps"
];

const SCHEMA_VALIDATORS = new Map([[1, validateSongV1]]);
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

function validateSongV1(song, context) {
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
