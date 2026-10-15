export const KEY_WIDTH_STORAGE_KEY = "kalimba-key-width-v1";
export const LEGACY_KEY_SCALE_STORAGE_KEY = "kalimba-key-scale";
export const PRACTICE_HISTORY_STORAGE_KEY = "kalimba-practice-history-v1";
export const SONG_SPEED_STORAGE_KEY = "kalimba-song-speed-v1";
export const SONG_SPEED_STORAGE_PREFIX = "kalimba-song-speed-v2:";
export const browserPreferenceStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
};

// 新记录保存实际列间距；旧比例只在没有新记录时兼容读取。
export function readKeyWidth(storage) {
  try {
    const raw = storage.getItem(KEY_WIDTH_STORAGE_KEY);
    if (raw !== null) {
      const data = JSON.parse(raw);
      if (data?.schemaVersion !== 1 || !Number.isFinite(data.pitchCssPx) || data.pitchCssPx < 8 || data.pitchCssPx > 200) {
        return { error: "琴键宽度记录异常，请重新捏合调整" };
      }
      return { pitchCssPx: data.pitchCssPx };
    }
    const legacy = storage.getItem(LEGACY_KEY_SCALE_STORAGE_KEY);
    const scale = legacy?.trim() ? Number(legacy) : null;
    return Number.isFinite(scale) && scale >= .72 && scale <= 1.55 ? { scale } : {};
  } catch {
    return { error: "无法读取琴键宽度，本次仍可调整" };
  }
}

export function effectiveKeyScale(pitchCssPx, width, fallback = 1) {
  const scale = Number.isFinite(pitchCssPx) && width > 0 ? pitchCssPx * 21 / width : fallback;
  return Math.max(.72, Math.min(1.55, scale));
}

export function saveKeyWidth(storage, pitchCssPx) {
  if (!Number.isFinite(pitchCssPx) || pitchCssPx < 8 || pitchCssPx > 200) {
    return { error: "当前琴键宽度无法保存，请重试调整" };
  }
  try {
    const text = JSON.stringify({ schemaVersion: 1, pitchCssPx });
    storage.setItem(KEY_WIDTH_STORAGE_KEY, text);
    if (storage.getItem(KEY_WIDTH_STORAGE_KEY) !== text) return { error: "无法确认键宽已保存，本次调整仍有效" };
    return { saved: true };
  } catch {
    return { error: "键宽未保存，本次调整仍有效" };
  }
}

function readHistoryDocument(storage) {
  const raw = storage.getItem(PRACTICE_HISTORY_STORAGE_KEY);
  if (raw === null) return { schemaVersion: 1, songs: {} };
  const data = JSON.parse(raw);
  if (data?.schemaVersion !== 1 || !data.songs || typeof data.songs !== "object" || Array.isArray(data.songs)) {
    throw new Error("Invalid practice history");
  }
  return data;
}

export function readPracticeHistory(storage) {
  try {
    const data = readHistoryDocument(storage);
    const records = Object.create(null);
    for (const [id, value] of Object.entries(data.songs)) {
      if (Number.isSafeInteger(value?.lastPracticedAt) && value.lastPracticedAt > 0) records[id] = value;
    }
    return { records };
  } catch {
    return { records: Object.create(null), error: "最近练习记录读取失败，暂按默认顺序显示" };
  }
}

// 每次写入重新读取，保留其他曲目及未知记录；不覆盖损坏或未知版本的文档。
export function recordPractice(storage, baseSongId, now = Date.now()) {
  try {
    const data = readHistoryDocument(storage);
    const songs = { ...data.songs };
    songs[baseSongId] = { lastPracticedAt: now };
    const text = JSON.stringify({ ...data, songs });
    storage.setItem(PRACTICE_HISTORY_STORAGE_KEY, text);
    if (storage.getItem(PRACTICE_HISTORY_STORAGE_KEY) !== text) throw new Error("History readback mismatch");
    return { saved: true };
  } catch {
    return { error: "最近练习记录未保存，请稍后重试" };
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// 滑块使用 0.05 步长；只容忍浮点运算误差，不将任意输入舍入为有效速度。
function normalizeSongSpeed(speed) {
  if (!Number.isFinite(speed)) return null;
  const units = Math.round(speed * 20);
  if (units < 7 || units > 28 || Math.abs(speed * 20 - units) > 1e-9) return null;
  return units / 20;
}

function readSongSpeedDocument(storage) {
  const raw = storage.getItem(SONG_SPEED_STORAGE_KEY);
  if (raw === null) return { schemaVersion: 1, songs: {} };
  const data = JSON.parse(raw);
  if (!isRecord(data) || data.schemaVersion !== 1 || !isRecord(data.songs)) {
    throw new Error("Invalid song speed document");
  }
  return data;
}

function getSongSpeedRecord(data, songId) {
  if (typeof songId !== "string" || !songId.trim()) throw new Error("Invalid song id");
  if (!Object.hasOwn(data.songs, songId)) return undefined;
  const record = data.songs[songId];
  if (!isRecord(record) || (Object.hasOwn(record, "speed") && normalizeSongSpeed(record.speed) === null)) {
    throw new Error("Invalid song speed record");
  }
  return record;
}

function songSpeedKey(songId) {
  if (typeof songId !== "string" || !songId.trim()) throw new Error("Invalid song id");
  return SONG_SPEED_STORAGE_PREFIX + encodeURIComponent(songId);
}

function readSongSpeedEnvelope(storage, key) {
  const raw = storage.getItem(key);
  if (raw === null) return undefined;
  const data = JSON.parse(raw);
  if (!isRecord(data) || data.schemaVersion !== 2 || !isRecord(data.record) ||
      !Object.hasOwn(data.record, "speed") || normalizeSongSpeed(data.record.speed) === null) {
    throw new Error("Invalid per-song speed record");
  }
  return data;
}

export function readSongSpeed(storage, songId) {
  try {
    const data = readSongSpeedEnvelope(storage, songSpeedKey(songId));
    const record = data ? data.record : getSongSpeedRecord(readSongSpeedDocument(storage), songId);
    return record && Object.hasOwn(record, "speed") ? { speed: normalizeSongSpeed(record.speed) } : {};
  } catch {
    return { error: "本曲速度记录读取失败，原记录已保留，本次仍可调整速度" };
  }
}

// Each song has its own key: independent pages cannot overwrite another song's speed.
// Only an absent new record falls back to the old document, which stays byte-for-byte
// unchanged. The nested envelope preserves legacy record metadata without name clashes.
export function saveSongSpeed(storage, songId, speed) {
  const normalizedSpeed = normalizeSongSpeed(speed);
  if (normalizedSpeed === null || typeof songId !== "string" || !songId.trim()) {
    return { error: "本曲速度无法保存，请使用 0.35–1.40 倍之间、间隔 0.05 的速度" };
  }
  try {
    const key = songSpeedKey(songId);
    const data = readSongSpeedEnvelope(storage, key);
    const record = data ? data.record : getSongSpeedRecord(readSongSpeedDocument(storage), songId);
    const text = JSON.stringify({ ...data, schemaVersion: 2, record: { ...record, speed: normalizedSpeed } });
    storage.setItem(key, text);
    if (storage.getItem(key) !== text) throw new Error("Song speed readback mismatch");
    return { saved: true, speed: normalizedSpeed };
  } catch {
    return { error: "本曲速度未保存，请检查浏览器存储后重试，本次调整仍有效" };
  }
}

// A separate key per canonical song makes unrelated multi-tab writes independent.
// Do not migrate the old global enable flag into these explicit opt-in choices.
export const SONG_ACCOMPANIMENT_STORAGE_PREFIX = "kalimba-song-accompaniment-v1:";

function songAccompanimentKey(songId) {
  if (typeof songId !== "string" || !songId.trim()) throw new Error("Invalid song id");
  return SONG_ACCOMPANIMENT_STORAGE_PREFIX + encodeURIComponent(songId);
}

function readSongAccompanimentRecord(storage, key) {
  const raw = storage.getItem(key);
  if (raw === null) return undefined;
  const record = JSON.parse(raw);
  if (!isRecord(record) || record.schemaVersion !== 1 ||
      !["off", "light", "imported-auto"].includes(record.choice) ||
      (record.choice !== "off" && (typeof record.sourceSignature !== "string" || !record.sourceSignature))) {
    throw new Error("Invalid song accompaniment record");
  }
  return record;
}

export function readSongAccompaniment(storage, songId, sourceSignature) {
  try {
    const record = readSongAccompanimentRecord(storage, songAccompanimentKey(songId));
    if (!record) return {};
    if (record.choice === "off") return { choice: "off" };
    return sourceSignature && record.sourceSignature === sourceSignature
      ? { choice: record.choice } : { choice: "off", stale: true };
  } catch {
    return { choice: "off", error: "本曲伴奏记录读取失败，已关闭伴奏，本次仍可选择" };
  }
}

// Preserve corrupt/future records and unknown fields, as with the other preferences.
// Read back before claiming success; failed writes never prevent a session choice.
export function saveSongAccompaniment(storage, songId, choice, sourceSignature) {
  if (!["off", "light", "imported-auto"].includes(choice) ||
      (choice !== "off" && (typeof sourceSignature !== "string" || !sourceSignature))) {
    return { error: "本曲伴奏无法保存，请重新选择" };
  }
  try {
    const key = songAccompanimentKey(songId);
    const record = readSongAccompanimentRecord(storage, key);
    const text = JSON.stringify({ ...record, schemaVersion: 1, choice,
      sourceSignature: choice !== "off" ? sourceSignature : undefined });
    storage.setItem(key, text);
    if (storage.getItem(key) !== text) throw new Error("Song accompaniment readback mismatch");
    return { saved: true, choice };
  } catch {
    return { error: "本曲伴奏未保存，本次选择仍有效" };
  }
}
