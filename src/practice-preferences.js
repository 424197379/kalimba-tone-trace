export const KEY_WIDTH_STORAGE_KEY = "kalimba-key-width-v1";
export const LEGACY_KEY_SCALE_STORAGE_KEY = "kalimba-key-scale";
export const PRACTICE_HISTORY_STORAGE_KEY = "kalimba-practice-history-v1";
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
