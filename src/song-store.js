import { NOTE_INDEX, SONG_LIBRARY } from "./songs.js";

export const APP_VERSION = "2.2.14";
export const CURRENT_SONG_STORAGE_KEY = "kalimba-current-song";
export const CUSTOM_SONGS_STORAGE_KEY = "kalimba-custom-songs-v1";
export const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];
export const DIFFICULTY_LABELS = {
  all: "全部",
  easy: "简单",
  medium: "中等",
  hard: "困难"
};

const DIFFICULTY_ALIASES = new Map([
  ["easy", "easy"],
  ["simple", "easy"],
  ["beginner", "easy"],
  ["1", "easy"],
  ["简单", "easy"],
  ["容易", "easy"],
  ["入门", "easy"],
  ["初级", "easy"],
  ["medium", "medium"],
  ["normal", "medium"],
  ["moderate", "medium"],
  ["2", "medium"],
  ["中等", "medium"],
  ["普通", "medium"],
  ["中级", "medium"],
  ["hard", "hard"],
  ["difficult", "hard"],
  ["advanced", "hard"],
  ["3", "hard"],
  ["困难", "hard"],
  ["难", "hard"],
  ["高级", "hard"]
]);

const DEGREE_TO_NOTE = {
  1: "C",
  2: "D",
  3: "E",
  4: "F",
  5: "G",
  6: "A",
  7: "B"
};

const NOTE_ROLES = new Set(["melody", "harmony", "bass", "arpeggio", "ornament"]);
const ARRANGEMENT_KINDS = new Set(["melody", "chord"]);
const JUDGEMENT_MODES = new Set(["melody", "chord"]);
const RHYTHM_SOURCE_STATUSES = new Set(["verified", "inferred", "needs-review"]);
const RHYTHM_REST_POLICIES = new Set(["silent", "hold"]);
const ACCOMPANIMENT_MIN_VELOCITY = 0.05;
const ACCOMPANIMENT_MAX_VELOCITY = 1.2;
const MELODY_VERSION_LABEL = "主旋律版";
const CHORD_VERSION_LABEL = "和弦版";

export const AI_SONG_PROMPT = `你需要从我提供的简谱图片中制作一份可被卡林巴循音 App 导入的高质量纯 JSON 乐谱。

只输出 JSON，不要输出 Markdown，不要代码块，不要解释。
JSON 必须使用双引号，不能有注释，不能有尾随逗号。
上传统一使用 schemaVersion 2。即使只能识别主旋律，也请用 events 单音事件表达，不要输出 schemaVersion 1 或 notation。

目标乐器是 21 音 C 调卡林巴，只支持自然音：F3、G3、A3、B3、C4-D6、E6。请先按图片调号读谱，再整体转成 C 调输出，key 必须为 "C"。

编谱流程：
1. 先识别主旋律，严格按小节线、下划线、附点、连音线、休止符和弱起定位 beat 与 duration。
2. 如果图片模糊、不完整、缺少和弦/伴奏/节奏细节，请上网查找同曲简谱、简和谱、五线谱、MIDI 或 MusicXML 交叉验证；优先完整谱，其次简和谱，再其次和弦谱。
3. 主旋律 1 拍以上空档默认保持静音呼吸，不要用自动伴奏填满，除非谱源明确显示伴奏延续。
4. 和弦目标音要适合 21 音 C 调卡林巴实际弹奏，密集和弦请精简为 2 到 4 个关键音。无法确认的装饰音不要强行加入跟弹目标。
5. App 会自动从 events 里抽取主旋律版；只要 events 里有和弦目标音，或 JSON 里有 autoAccompaniment，App 就会生成可切换的和弦/编配版。
6. 除非用户明确要求“只要主旋律”，否则不要只输出单音主旋律。请尽量补充可验证或保守推断的和弦目标音、bass/harmony 与 autoAccompaniment；推断内容要在 hint 或 rhythm.sourceStatus 中标明。

JSON 格式：
{
  "schemaVersion": 2,
  "title": "《歌曲名》",
  "versionLabel": "和弦版",
  "arrangementKind": "chord",
  "judgementMode": "chord",
  "bpm": 96,
  "beatsPerMeasure": 4,
  "defaultSpeedFactor": 0.85,
  "difficulty": "medium",
  "key": "C",
  "tuning": "21-key-c",
  "hint": "简短说明",
  "events": [
    {
      "beat": 0,
      "duration": 1,
      "judgeWindow": 0.6,
      "notes": [
        { "name": "E4", "role": "melody", "judge": true, "velocity": 1 },
        { "name": "C4", "role": "harmony", "judge": true, "velocity": 0.75 },
        { "name": "G3", "role": "bass", "judge": true, "velocity": 0.65 }
      ]
    }
  ],
  "autoAccompaniment": {
    "enabledByDefault": true,
    "volume": 0.38,
    "events": [
      {
        "beat": 4,
        "duration": 0.75,
        "pattern": "source-chord",
        "notes": [
          { "name": "C4", "role": "harmony", "velocity": 0.36 },
          { "name": "G3", "role": "bass", "velocity": 0.32 }
        ]
      }
    ]
  },
  "rhythm": {
    "sourceStatus": "verified",
    "pickupBeats": 0,
    "restWindows": [
      { "beat": 13.5, "duration": 2.5, "policy": "silent", "reason": "phrase-rest" }
    ],
    "sources": [
      { "label": "谱源名称", "url": "https://example.com/source" }
    ]
  }
}

通用规则：
- beat 是从 0 开始的起始拍，可以是小数。
- duration 是持续拍数，可以是 0.25、0.5、1、1.5、2 等。
- events[].notes 至少有一个 role: "melody" 的主旋律音，并设置 judge: true。
- 如果输出的是完整编配，至少应满足以下之一：某些 events 含有 harmony/bass 且 judge: true，或提供 autoAccompaniment.events。
- 不要在 title/versionLabel/arrangementKind 写“主旋律版”后又省略和弦与伴奏，除非用户明确要求只导入主旋律。
- notes[].name 必须是 21 音 C 调卡林巴音名，role 只能是 "melody"、"harmony"、"bass"、"arpeggio"、"ornament"。
- judgementMode 为 "melody" 时只提示主旋律；为 "chord" 时，事件内所有 judge: true 的音都作为用户跟弹目标。
- autoAccompaniment 是 App 自动播放的伴奏，不参与用户演奏目标提示，里面不要写 judge 字段，音量 velocity 通常低于 0.45。
- rhythm.restWindows 表示主旋律长停顿，policy 为 "silent" 的窗口内不要放自动伴奏事件；只有谱源明确延音时才用 "hold"。
- 如果图片有调号，例如 1=C、1=D、1=F，请先按原调读谱，再转成 C 调输出，仍然写 "key": "C"。
- 如果图片没有 BPM，请按歌曲风格估计一个适合练习的 bpm，通常在 72 到 120 之间。
- 如果图片有拍号，请填写 beatsPerMeasure；如果没有，请根据小节线和节奏判断，无法判断时用 4。
- difficulty 只能是 "easy"、"medium"、"hard"。简单表示旋律稳定、跳音少、速度慢；中等表示有少量跳音、速度或节奏变化；困难表示速度快、音符密集、跨键跨度大或节奏复杂。
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeDifficulty(value) {
  const text = String(value || "").trim().toLowerCase();
  return DIFFICULTY_ALIASES.get(text) || null;
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

function normalizeNoteName(value) {
  const noteName = String(value || "").trim();
  return NOTE_INDEX.has(noteName) ? noteName : null;
}

function normalizeEventNote(rawNote, fallbackJudge = false) {
  const source = typeof rawNote === "string" ? { name: rawNote } : rawNote;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const name = normalizeNoteName(source.name);
  if (!name) {
    return null;
  }

  const role = NOTE_ROLES.has(source.role) ? source.role : "melody";
  const velocity = clamp(normalizeNumber(source.velocity, 1), 0.1, 1.2);
  return {
    name,
    role,
    judge: typeof source.judge === "boolean" ? source.judge : fallbackJudge,
    velocity
  };
}

function normalizeStepList(steps) {
  if (!Array.isArray(steps) || !steps.length) {
    return [];
  }

  return steps
    .map((step) => {
      if (!Array.isArray(step) || step.length !== 3) {
        return null;
      }

      const [name, beat, duration] = step;
      const noteName = normalizeNoteName(name);
      const beatNumber = Number(beat);
      const durationNumber = Number(duration);
      if (!noteName || !Number.isFinite(beatNumber) || beatNumber < 0 || !Number.isFinite(durationNumber) || durationNumber <= 0) {
        return null;
      }

      return [noteName, beatNumber, durationNumber];
    })
    .filter(Boolean)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}

function normalizeEventsFromSteps(steps) {
  return normalizeStepList(steps).map(([name, beat, duration]) => ({
    beat,
    duration,
    notes: [
      {
        name,
        role: "melody",
        judge: true,
        velocity: 1
      }
    ]
  }));
}

function normalizeSongEvents(song) {
  if (Number(song.schemaVersion || 1) === 2) {
    if (!Array.isArray(song.events) || !song.events.length) {
      return [];
    }

    return song.events
      .map((event) => {
        if (!event || typeof event !== "object" || Array.isArray(event)) {
          return null;
        }

        const beat = Number(event.beat);
        const duration = Number(event.duration);
        if (!Number.isFinite(beat) || beat < 0 || !Number.isFinite(duration) || duration <= 0) {
          return null;
        }

        const notes = Array.isArray(event.notes)
          ? event.notes.map((note) => normalizeEventNote(note, false)).filter(Boolean)
          : [];
        if (!notes.length) {
          return null;
        }

        const normalized = {
          beat,
          duration,
          notes
        };

        if (Number.isFinite(Number(event.judgeWindow)) && Number(event.judgeWindow) > 0) {
          normalized.judgeWindow = clamp(Number(event.judgeWindow), 0.1, 2);
        }

        return normalized;
      })
      .filter(Boolean)
      .sort((a, b) => a.beat - b.beat || a.notes[0].name.localeCompare(b.notes[0].name));
  }

  return normalizeEventsFromSteps(song.steps);
}

function normalizeAutoAccompanimentNote(rawNote) {
  const source = typeof rawNote === "string" ? { name: rawNote } : rawNote;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const name = normalizeNoteName(source.name);
  if (!name) {
    return null;
  }

  return {
    name,
    role: NOTE_ROLES.has(source.role) ? source.role : "harmony",
    velocity: clamp(normalizeNumber(source.velocity, 0.65), ACCOMPANIMENT_MIN_VELOCITY, ACCOMPANIMENT_MAX_VELOCITY)
  };
}

function normalizeAutoAccompaniment(rawAutoAccompaniment) {
  if (!rawAutoAccompaniment || typeof rawAutoAccompaniment !== "object" || Array.isArray(rawAutoAccompaniment)) {
    return null;
  }

  if (!Array.isArray(rawAutoAccompaniment.events) || !rawAutoAccompaniment.events.length) {
    return null;
  }

  const events = rawAutoAccompaniment.events
    .map((event) => {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        return null;
      }

      const beat = Number(event.beat);
      const duration = Number(event.duration);
      if (!Number.isFinite(beat) || beat < 0 || !Number.isFinite(duration) || duration <= 0) {
        return null;
      }

      const seenNotes = new Set();
      const notes = Array.isArray(event.notes)
        ? event.notes
            .map((note) => normalizeAutoAccompanimentNote(note))
            .filter((note) => {
              if (!note || seenNotes.has(note.name)) {
                return false;
              }
              seenNotes.add(note.name);
              return true;
            })
        : [];
      if (!notes.length) {
        return null;
      }

      const normalized = {
        beat,
        duration,
        notes
      };

      if (typeof event.pattern === "string" && event.pattern.trim()) {
        normalized.pattern = event.pattern.trim();
      }

      return normalized;
    })
    .filter(Boolean)
    .sort((a, b) => a.beat - b.beat || a.notes[0].name.localeCompare(b.notes[0].name));

  if (!events.length) {
    return null;
  }

  return {
    enabledByDefault: Boolean(rawAutoAccompaniment.enabledByDefault),
    volume: clamp(normalizeNumber(rawAutoAccompaniment.volume, 0.55), 0, 1),
    events
  };
}

function normalizeRhythm(rawRhythm) {
  if (!isPlainObject(rawRhythm)) {
    return null;
  }

  const restWindows = Array.isArray(rawRhythm.restWindows)
    ? rawRhythm.restWindows
        .map((window) => {
          if (!isPlainObject(window)) {
            return null;
          }

          const beat = Number(window.beat);
          const duration = Number(window.duration);
          if (!Number.isFinite(beat) || beat < 0 || !Number.isFinite(duration) || duration <= 0) {
            return null;
          }

          const policy = RHYTHM_REST_POLICIES.has(window.policy) ? window.policy : "silent";
          const normalized = { beat, duration, policy };
          if (typeof window.reason === "string" && window.reason.trim()) {
            normalized.reason = window.reason.trim();
          }
          return normalized;
        })
        .filter(Boolean)
        .sort((a, b) => a.beat - b.beat || a.duration - b.duration)
    : [];

  const sources = Array.isArray(rawRhythm.sources)
    ? rawRhythm.sources
        .map((source) => {
          if (!isPlainObject(source)) {
            return null;
          }
          const label = String(source.label || "").trim();
          const url = String(source.url || "").trim();
          if (!label && !url) {
            return null;
          }
          return { label: label || url, url };
        })
        .filter(Boolean)
    : [];

  const rhythm = {
    sourceStatus: RHYTHM_SOURCE_STATUSES.has(rawRhythm.sourceStatus) ? rawRhythm.sourceStatus : "inferred",
    pickupBeats: Math.max(0, normalizeNumber(rawRhythm.pickupBeats, 0)),
    restWindows
  };

  if (sources.length) {
    rhythm.sources = sources;
  }

  return rhythm;
}

function rangesOverlap(firstBeat, firstDuration, secondBeat, secondDuration) {
  return firstBeat < secondBeat + secondDuration && secondBeat < firstBeat + firstDuration;
}

function applyRhythmToAutoAccompaniment(autoAccompaniment, rhythm) {
  if (!autoAccompaniment || !rhythm?.restWindows?.length) {
    return autoAccompaniment;
  }

  const silentWindows = rhythm.restWindows.filter((window) => window.policy === "silent");
  if (!silentWindows.length) {
    return autoAccompaniment;
  }

  const events = autoAccompaniment.events.filter((event) =>
    silentWindows.every((window) => !rangesOverlap(event.beat, event.duration, window.beat, window.duration))
  );

  return events.length ? { ...autoAccompaniment, events } : null;
}

function getJudgeNotesForSong(song, event) {
  const judgeNotes = event.notes.filter((note) => note.judge);
  if (song.judgementMode === "chord") {
    return judgeNotes;
  }

  return judgeNotes.filter((note) => note.role === "melody").slice(0, 1);
}

function buildJudgeSteps(song, events) {
  return events
    .flatMap((event) => getJudgeNotesForSong(song, event).map((note) => [note.name, event.beat, event.duration]))
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}

function countArrangementNotes(events) {
  return events.reduce((total, event) => total + event.notes.length, 0);
}

function getStepTotalBeats(steps) {
  if (!steps.length) {
    return 0;
  }

  return Math.max(...steps.map(([, beat, duration]) => Number(beat) + Number(duration)));
}

function getPhysicalJumpScore(steps) {
  return steps.reduce((maxJump, step, index) => {
    if (index === 0) {
      return maxJump;
    }

    const previousIndex = NOTE_INDEX.get(steps[index - 1][0]);
    const currentIndex = NOTE_INDEX.get(step[0]);
    return Math.max(maxJump, Math.abs(currentIndex - previousIndex));
  }, 0);
}

function getPhysicalSpan(steps) {
  const indexes = steps.map(([name]) => NOTE_INDEX.get(name));
  return Math.max(...indexes) - Math.min(...indexes);
}

export function estimateSongDifficulty(song) {
  const steps = Array.isArray(song.steps)
    ? song.steps.filter(([name, beat, duration]) =>
        NOTE_INDEX.has(name) &&
        Number.isFinite(Number(beat)) &&
        Number.isFinite(Number(duration)) &&
        Number(duration) > 0
      )
    : [];

  if (!steps.length) {
    return "easy";
  }

  const bpm = clamp(normalizeNumber(song.bpm, 96), 40, 220);
  const totalBeats = Math.max(1, getStepTotalBeats(steps));
  const noteDensity = steps.length / totalBeats;
  const minDuration = Math.min(...steps.map(([, , duration]) => Number(duration)));
  const maxJump = getPhysicalJumpScore(steps);
  const span = getPhysicalSpan(steps);

  let score = 0;
  if (bpm >= 136) {
    score += 2;
  } else if (bpm >= 112) {
    score += 1;
  }

  if (noteDensity >= 1.35) {
    score += 2;
  } else if (noteDensity >= 0.95) {
    score += 1;
  }

  if (minDuration <= 0.25) {
    score += 1;
  } else if (minDuration <= 0.5 && noteDensity >= 0.9) {
    score += 1;
  }

  if (maxJump >= 10) {
    score += 2;
  } else if (maxJump >= 6) {
    score += 1;
  }

  if (span >= 16) {
    score += 2;
  } else if (span >= 11) {
    score += 1;
  }

  if (steps.length >= 96) {
    score += 2;
  } else if (steps.length >= 48) {
    score += 1;
  }

  if (score >= 7) {
    return "hard";
  }
  if (score >= 4) {
    return "medium";
  }
  return "easy";
}

function normalizeNotation(rawNotation) {
  if (!Array.isArray(rawNotation) || rawNotation.length === 0) {
    throw new Error("notation 必须是非空数组");
  }

  if (rawNotation.length > 1200) {
    throw new Error("notation 过长，请让 AI 改用 schemaVersion 2 events");
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
  return normalizeStepList(song.steps).length > 0;
}

function normalizeStoredSong(song) {
  if (!song || typeof song !== "object") {
    return null;
  }

  const schemaVersion = Number(song.schemaVersion || 1);
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    return null;
  }

  const arrangementKind = ARRANGEMENT_KINDS.has(song.arrangementKind)
    ? song.arrangementKind
    : schemaVersion === 2
      ? "chord"
      : "melody";
  const judgementMode = JUDGEMENT_MODES.has(song.judgementMode)
    ? song.judgementMode
    : arrangementKind === "chord"
      ? "chord"
      : "melody";

  const events = normalizeSongEvents({ ...song, schemaVersion, arrangementKind, judgementMode });
  if (!events.length) {
    return null;
  }

  const songForJudgement = { ...song, arrangementKind, judgementMode };
  const steps = schemaVersion === 1 ? normalizeStepList(song.steps) : buildJudgeSteps(songForJudgement, events);
  if (!steps.length && !assertStepSong({ steps: song.steps })) {
    return null;
  }

  const judgeNoteCount = steps.length;
  const arrangementNoteCount = countArrangementNotes(events);
  const rhythm = schemaVersion === 2 ? normalizeRhythm(song.rhythm) : null;
  const autoAccompaniment = schemaVersion === 2
    ? applyRhythmToAutoAccompaniment(normalizeAutoAccompaniment(song.autoAccompaniment), rhythm)
    : null;
  const difficulty = normalizeDifficulty(song.difficulty) || estimateSongDifficulty({ ...song, steps });
  const baseSongId = String(song.baseSongId || (song.id.endsWith("-chord") ? song.id.slice(0, -6) : song.id)).trim() || song.id;

  const normalizedSong = {
    ...song,
    schemaVersion,
    baseSongId,
    versionLabel: song.versionLabel || (arrangementKind === "chord" ? CHORD_VERSION_LABEL : MELODY_VERSION_LABEL),
    arrangementKind,
    judgementMode,
    events,
    steps,
    judgeNoteCount,
    arrangementNoteCount,
    difficulty,
    uploader: song.uploader || "local",
    source: song.source || "local"
  };

  if (autoAccompaniment) {
    normalizedSong.autoAccompaniment = autoAccompaniment;
  } else {
    delete normalizedSong.autoAccompaniment;
  }

  if (rhythm) {
    normalizedSong.rhythm = rhythm;
  } else {
    delete normalizedSong.rhythm;
  }

  return normalizedSong;
}

export function getCustomSongs() {
  return getCustomSongArray()
    .map(normalizeStoredSong)
    .filter(Boolean);
}

export function getSongLibrary() {
  const library = Object.fromEntries(
    Object.entries(SONG_LIBRARY)
      .map(([id, song]) => [id, normalizeStoredSong({ ...song, source: "system" })])
      .filter(([, song]) => Boolean(song))
  );
  getCustomSongs().forEach((song) => {
    library[song.id] = song;
  });
  return library;
}

function normalizeImportedEvents(parsed) {
  const schemaVersion = Number(parsed.schemaVersion || 2);
  if (schemaVersion === 2 && Array.isArray(parsed.events)) {
    const events = normalizeSongEvents({ ...parsed, schemaVersion: 2 });
    if (events.length) {
      return events;
    }
  }

  if (Array.isArray(parsed.notation)) {
    const notation = normalizeNotation(parsed.notation);
    return normalizeEventsFromSteps(compileNotationToSteps(notation));
  }

  if (Array.isArray(parsed.steps)) {
    return normalizeEventsFromSteps(parsed.steps);
  }

  return [];
}

function dedupeEventNotes(events) {
  return events
    .map((event) => {
      const seenNotes = new Set();
      const notes = event.notes.filter((note) => {
        if (seenNotes.has(note.name)) {
          return false;
        }
        seenNotes.add(note.name);
        return true;
      });
      return { ...event, notes };
    })
    .filter((event) => event.notes.length);
}

function getMelodyNote(event) {
  return (
    event.notes.find((note) => note.role === "melody" && note.judge) ||
    event.notes.find((note) => note.role === "melody") ||
    event.notes.find((note) => note.judge) ||
    event.notes[0]
  );
}

function ensureImportedJudgement(events, judgementMode) {
  return dedupeEventNotes(events).map((event) => {
    if (event.notes.some((note) => note.judge)) {
      return event;
    }

    const melodyNote = getMelodyNote(event);
    const shouldJudgeChord = judgementMode === "chord" && event.notes.length > 1;
    return {
      ...event,
      notes: event.notes.map((note) => ({
        ...note,
        judge: shouldJudgeChord ? note.role !== "ornament" : note.name === melodyNote.name
      }))
    };
  });
}

function buildMelodyEvents(events) {
  return events.map((event) => {
    const melodyNote = getMelodyNote(event);
    const melodyEvent = {
      beat: event.beat,
      duration: event.duration,
      notes: [
        {
          ...melodyNote,
          role: "melody",
          judge: true,
          velocity: 1
        }
      ]
    };

    if (event.judgeWindow) {
      melodyEvent.judgeWindow = event.judgeWindow;
    }

    return melodyEvent;
  });
}

function hasChordTargets(parsed, events) {
  if (parsed.arrangementKind === "chord" || parsed.judgementMode === "chord") {
    return true;
  }

  return events.some((event) => {
    const judgeCount = event.notes.filter((note) => note.judge).length;
    const playableChordNotes = event.notes.filter((note) => note.role !== "ornament").length;
    return judgeCount > 1 || playableChordNotes > 1;
  });
}

function hasUploadedArrangement(parsed, events, autoAccompaniment) {
  return hasChordTargets(parsed, events) || Boolean(autoAccompaniment?.events?.length);
}

function getImportedBaseId(parsed) {
  const rawId = String(parsed.baseSongId || parsed.id || "").trim();
  if (rawId.endsWith("-chord") || rawId.endsWith("_chord")) {
    return rawId.slice(0, -6);
  }
  return rawId;
}

function buildImportedSongPair(parsed, existingLibrary) {
  if (!isPlainObject(parsed)) {
    throw new Error("导入内容必须是歌曲 JSON 对象");
  }

  const key = String(parsed.key || "C").trim().toUpperCase();
  if (key !== "C") {
    throw new Error('目前仅支持 key: "C"，请让 AI 先转成 C 调');
  }

  const title = normalizeTitle(parsed.title);
  const baseId = makeLocalSongId(getImportedBaseId(parsed), title, existingLibrary);
  const bpm = clamp(normalizeNumber(parsed.bpm, 96), 40, 220);
  const beatsPerMeasure = clamp(Math.round(normalizeNumber(parsed.beatsPerMeasure, 4)), 2, 8);
  const defaultSpeedFactor = clamp(normalizeNumber(parsed.defaultSpeedFactor, 0.9), 0.35, 1.4);
  const rawJudgementMode = JUDGEMENT_MODES.has(parsed.judgementMode) ? parsed.judgementMode : "melody";
  const events = ensureImportedJudgement(normalizeImportedEvents(parsed), rawJudgementMode);
  if (!events.length) {
    throw new Error("没有可导入的 events 音符；请让 AI 输出 schemaVersion 2 events");
  }

  const melodyEvents = buildMelodyEvents(events);
  const melodySteps = buildJudgeSteps({ judgementMode: "melody" }, melodyEvents);
  if (!melodySteps.length) {
    throw new Error("没有可导入的主旋律音符");
  }

  const autoAccompaniment = normalizeAutoAccompaniment(parsed.autoAccompaniment);
  const rhythm = normalizeRhythm(parsed.rhythm);
  const filteredAutoAccompaniment = applyRhythmToAutoAccompaniment(autoAccompaniment, rhythm);
  const hasChordTargetNotes = hasChordTargets(parsed, events);
  const shouldCreateArrangementVersion = hasUploadedArrangement(parsed, events, filteredAutoAccompaniment);
  const difficulty = normalizeDifficulty(parsed.difficulty) || estimateSongDifficulty({ steps: melodySteps, bpm });
  const hint = String(parsed.hint || "本地导入曲谱").trim() || "本地导入曲谱";
  const common = {
    title,
    uploader: "local",
    source: "local",
    schemaVersion: 2,
    baseSongId: baseId,
    key: "C",
    tuning: "21-key-c",
    bpm,
    defaultSpeedFactor,
    beatsPerMeasure,
    difficulty,
    hint
  };

  if (isPlainObject(parsed.sourceFeatures)) {
    common.sourceFeatures = parsed.sourceFeatures;
  }

  const melodySong = normalizeStoredSong({
    ...common,
    id: baseId,
    versionLabel: MELODY_VERSION_LABEL,
    arrangementKind: "melody",
    judgementMode: "melody",
    practiceTitle: `${title}主旋律版练习轨道`,
    scoreTitle: `${title}主旋律版简谱进度`,
    events: melodyEvents,
    ...(!shouldCreateArrangementVersion && filteredAutoAccompaniment ? { autoAccompaniment: filteredAutoAccompaniment } : {}),
    ...(!shouldCreateArrangementVersion && rhythm ? { rhythm } : {})
  });

  if (!melodySong) {
    throw new Error("主旋律版生成失败，请检查 events 的 beat、duration 和 notes");
  }

  if (!shouldCreateArrangementVersion) {
    return [melodySong];
  }

  const chordId = makeLocalSongId(`${baseId}_chord`, `${title} 和弦版`, { ...existingLibrary, [baseId]: melodySong });
  const arrangementVersionLabel = hasChordTargetNotes ? CHORD_VERSION_LABEL : "伴奏版";
  const arrangementJudgementMode = hasChordTargetNotes ? "chord" : "melody";
  const chordSong = normalizeStoredSong({
    ...common,
    id: chordId,
    versionLabel: arrangementVersionLabel,
    arrangementKind: "chord",
    judgementMode: arrangementJudgementMode,
    practiceTitle: `${title}${arrangementVersionLabel}练习轨道`,
    scoreTitle: `${title}${arrangementVersionLabel}简谱进度`,
    events,
    ...(filteredAutoAccompaniment ? { autoAccompaniment: filteredAutoAccompaniment } : {}),
    ...(rhythm ? { rhythm } : {})
  });

  if (!chordSong) {
    throw new Error("和弦版生成失败，请检查 events 里的和弦目标音");
  }

  return [melodySong, chordSong];
}

export function parseImportedSongs(rawText, existingLibrary = getSongLibrary()) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error("粘贴内容不是合法 JSON");
  }

  const rawSongs = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.songs)
      ? parsed.songs
      : [parsed];

  if (!rawSongs.length) {
    throw new Error("导入内容没有歌曲 JSON");
  }

  const reservedLibrary = { ...existingLibrary };
  const songs = rawSongs.flatMap((song) => {
    const importedSongs = buildImportedSongPair(song, reservedLibrary);
    importedSongs.forEach((importedSong) => {
      reservedLibrary[importedSong.id] = importedSong;
    });
    return importedSongs;
  });

  if (!songs.length) {
    throw new Error("没有可导入的歌曲");
  }

  return songs;
}

export function parseImportedSong(rawText, existingLibrary = getSongLibrary()) {
  return parseImportedSongs(rawText, existingLibrary)[0];
}

export function saveCustomSong(song) {
  return saveCustomSongs([song])[0] || null;
}

export function saveCustomSongs(importedSongs) {
  const normalizedSongs = importedSongs
    .map(normalizeStoredSong)
    .filter(Boolean);
  const importedIds = new Set(normalizedSongs.map((song) => song.id));
  const songs = getCustomSongs().filter((item) => !importedIds.has(item.id));
  songs.push(...normalizedSongs);
  saveCustomSongArray(songs);
  return normalizedSongs;
}

export function deleteCustomSong(songId) {
  const id = String(songId || "").trim();
  if (!id) {
    return null;
  }

  const songs = getCustomSongs();
  const deletedSong = songs.find((song) => song.id === id);
  if (!deletedSong) {
    return null;
  }

  saveCustomSongArray(songs.filter((song) => song.id !== id));
  return deletedSong;
}

export function deleteCustomSongGroup(baseSongId) {
  const id = String(baseSongId || "").trim();
  if (!id) {
    return null;
  }

  const songs = getCustomSongs();
  const deletedSongs = songs.filter((song) => song.baseSongId === id || song.id === id);
  if (!deletedSongs.length) {
    return null;
  }

  const deletedIds = new Set(deletedSongs.map((song) => song.id));
  saveCustomSongArray(songs.filter((song) => !deletedIds.has(song.id)));
  return {
    title: deletedSongs[0].title,
    ids: [...deletedIds]
  };
}
