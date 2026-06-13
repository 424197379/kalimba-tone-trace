import { NOTE_INDEX, SONG_LIBRARY } from "./songs.js";

export const APP_VERSION = "1.0.3";
export const CURRENT_SONG_STORAGE_KEY = "kalimba-current-song";
export const CUSTOM_SONGS_STORAGE_KEY = "kalimba-custom-songs-v1";

const DEGREE_TO_NOTE = {
  1: "C",
  2: "D",
  3: "E",
  4: "F",
  5: "G",
  6: "A",
  7: "B"
};

export const AI_SONG_PROMPT = `你需要从我提供的简谱图片中识别主旋律，并输出一个可被卡林巴循音 App 导入的纯 JSON 对象。

只输出 JSON，不要输出 Markdown，不要代码块，不要解释。
JSON 必须使用双引号，不能有注释，不能有尾随逗号。

目标乐器是 21 音 C 调卡林巴，只支持自然音：F3、G3、A3、B3、C4-D6、E6。请把图片中的主旋律转成 C 调简谱后再输出，key 必须为 "C"。

JSON 格式：
{
  "schemaVersion": 1,
  "title": "《歌曲名》",
  "bpm": 96,
  "beatsPerMeasure": 4,
  "defaultSpeedFactor": 0.9,
  "key": "C",
  "hint": "简短说明，可留空",
  "notation": [
    { "degree": "1", "octave": 0, "beat": 0, "duration": 1 },
    { "degree": "2", "octave": 0, "beat": 1, "duration": 0.5 }
  ]
}

notation 规则：
- degree 只能是 "1" 到 "7"，休止不要写成音符，直接通过 beat 留出空拍。
- octave 表示高低音点：0 为无点，1 为上方一点，2 为上方两点，-1 为下方一点。
- beat 是从 0 开始的起始拍，可以是小数。
- duration 是持续拍数，可以是 0.25、0.5、1、1.5、2 等。
- 只识别主旋律，不要加入伴奏、和弦或装饰音。
- 如果图片有调号，例如 1=C、1=D、1=F，请先按原调读谱，再转成 C 调输出，仍然写 "key": "C"。
- 如果图片没有 BPM，请按歌曲风格估计一个适合练习的 bpm，通常在 72 到 120 之间。
- 如果图片有拍号，请填写 beatsPerMeasure；如果没有，请根据小节线和节奏判断，无法判断时用 4。
- 简谱下划线、附点、连音线等节奏信息要体现在 duration 和 beat 上。
- 小节线和换行只用于帮助定位节拍，不要作为音符输出。
- 如果某个音转成 C 调后超出 21 音卡林巴范围，请就近调整到可弹范围，并尽量保持旋律走向。`;

export function readStoredSongId() {
  try {
    return localStorage.getItem(CURRENT_SONG_STORAGE_KEY);
  } catch (error) {
    console.warn("卡林巴循音 无法读取本地曲目", error);
    return null;
  }
}

export function storeSongId(songId) {
  try {
    localStorage.setItem(CURRENT_SONG_STORAGE_KEY, songId);
  } catch (error) {
    console.warn("卡林巴循音 无法保存本地曲目", error);
  }
}

function getCustomSongArray() {
  try {
    const raw = localStorage.getItem(CUSTOM_SONGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("卡林巴循音 无法读取本地曲库", error);
    return [];
  }
}

function saveCustomSongArray(songs) {
  localStorage.setItem(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify(songs));
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTitle(title) {
  const value = String(title || "").trim();
  return value || "本地导入歌曲";
}

function slugify(value) {
  const ascii = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return ascii || `song_${Date.now().toString(36)}`;
}

function makeLocalSongId(rawId, title, existingLibrary) {
  const base = slugify(rawId || title);
  let id = base.startsWith("local_") ? base : `local_${base}`;
  let index = 2;

  while (existingLibrary[id]) {
    id = `${base.startsWith("local_") ? base : `local_${base}`}_${index}`;
    index += 1;
  }

  return id;
}

function isRestDegree(degree) {
  const value = String(degree || "").trim().toLowerCase();
  return value === "0" || value === "rest" || value === "-";
}

function getNoteNameFromNotation(item) {
  const degree = String(item.degree || "").trim();
  if (!DEGREE_TO_NOTE[degree]) {
    throw new Error(`发现不支持的简谱音级: ${degree}`);
  }

  const octave = Number.isInteger(item.octave) ? item.octave : Number(item.octave || 0);
  if (!Number.isInteger(octave)) {
    throw new Error(`音级 ${degree} 的 octave 必须是整数`);
  }

  const noteName = `${DEGREE_TO_NOTE[degree]}${4 + octave}`;
  if (!NOTE_INDEX.has(noteName)) {
    throw new Error(`音符 ${noteName} 超出 21 音 C 调卡林巴范围`);
  }

  return noteName;
}

export function compileNotationToSteps(notation) {
  return notation
    .filter((item) => !isRestDegree(item.degree))
    .map((item) => [getNoteNameFromNotation(item), item.beat, item.duration])
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}

function normalizeNotation(rawNotation) {
  if (!Array.isArray(rawNotation) || rawNotation.length === 0) {
    throw new Error("notation 必须是非空数组");
  }

  if (rawNotation.length > 1200) {
    throw new Error("notation 过长，请先导入主旋律版本");
  }

  return rawNotation.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`notation 第 ${index + 1} 项必须是对象`);
    }

    const degree = String(item.degree || "").trim();
    if (!isRestDegree(degree) && !DEGREE_TO_NOTE[degree]) {
      throw new Error(`notation 第 ${index + 1} 项 degree 必须是 1 到 7`);
    }

    const octave = Number(item.octave || 0);
    if (!Number.isInteger(octave) || octave < -1 || octave > 2) {
      throw new Error(`notation 第 ${index + 1} 项 octave 必须是 -1 到 2 的整数`);
    }

    if (!isFiniteNumber(item.beat) || Number(item.beat) < 0) {
      throw new Error(`notation 第 ${index + 1} 项 beat 必须是大于等于 0 的数字`);
    }

    if (!isFiniteNumber(item.duration) || Number(item.duration) <= 0) {
      throw new Error(`notation 第 ${index + 1} 项 duration 必须是大于 0 的数字`);
    }

    const normalized = {
      degree,
      octave,
      beat: Number(item.beat),
      duration: Number(item.duration)
    };

    if (!isRestDegree(degree)) {
      getNoteNameFromNotation(normalized);
    }

    return normalized;
  }).sort((a, b) => a.beat - b.beat);
}

function assertStepSong(song) {
  if (!Array.isArray(song.steps) || !song.steps.length) {
    return false;
  }

  return song.steps.every(([name, beat, duration]) =>
    NOTE_INDEX.has(name) &&
    Number.isFinite(Number(beat)) &&
    Number.isFinite(Number(duration)) &&
    Number(duration) > 0
  );
}

function normalizeStoredSong(song) {
  if (!song || typeof song !== "object" || !assertStepSong(song)) {
    return null;
  }

  return {
    ...song,
    uploader: song.uploader || "local",
    source: song.source || "local"
  };
}

export function getCustomSongs() {
  return getCustomSongArray()
    .map(normalizeStoredSong)
    .filter(Boolean);
}

export function getSongLibrary() {
  const library = { ...SONG_LIBRARY };
  getCustomSongs().forEach((song) => {
    library[song.id] = song;
  });
  return library;
}

export function parseImportedSong(rawText, existingLibrary = getSongLibrary()) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error("粘贴内容不是合法 JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("导入内容必须是单首歌曲 JSON 对象");
  }

  if (Number(parsed.schemaVersion || 1) !== 1) {
    throw new Error("schemaVersion 目前只支持 1");
  }

  const key = String(parsed.key || "C").trim().toUpperCase();
  if (key !== "C") {
    throw new Error('目前仅支持 key: "C"，请让 AI 先转成 C 调简谱');
  }

  const notation = normalizeNotation(parsed.notation);
  const steps = compileNotationToSteps(notation);
  if (!steps.length) {
    throw new Error("没有可导入的音符");
  }

  const title = normalizeTitle(parsed.title);
  const id = makeLocalSongId(parsed.id, title, existingLibrary);
  const bpm = clamp(normalizeNumber(parsed.bpm, 96), 40, 220);
  const beatsPerMeasure = clamp(Math.round(normalizeNumber(parsed.beatsPerMeasure, 4)), 2, 8);
  const defaultSpeedFactor = clamp(normalizeNumber(parsed.defaultSpeedFactor, 0.9), 0.35, 1.4);
  const hint = String(parsed.hint || "本地导入曲谱").trim() || "本地导入曲谱";

  return {
    id,
    title,
    uploader: "local",
    source: "local",
    schemaVersion: 1,
    key,
    bpm,
    defaultSpeedFactor,
    beatsPerMeasure,
    hint,
    practiceTitle: `${title}练习轨道`,
    scoreTitle: `${title}简谱进度`,
    notation,
    steps
  };
}

export function saveCustomSong(song) {
  const songs = getCustomSongs().filter((item) => item.id !== song.id);
  songs.push(song);
  saveCustomSongArray(songs);
  return song;
}
