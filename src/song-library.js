import { getPracticeTotalBeats } from "./practice-loop.js";
import { getSongDisplayTitle } from "./song-presentation.js";
import {
  AI_SONG_PROMPT,
  APP_VERSION,
  CUSTOM_SONGS_STORAGE_KEY,
  DIFFICULTY_LABELS,
  DIFFICULTY_LEVELS,
  deleteCustomSongGroup,
  getCustomSongGroupSnapshot,
  getCustomSongsForLibrary,
  getSongLibrary,
  getLocalSongCopyLabel,
  getDuplicateImportNotice,
  getSongBaseId,
  getPracticeSongId,
  getSongAccompanimentProvider,
  getSongVersionRank,
  normalizeDifficulty,
  parseImportedSongs,
  readStoredSongId,
  saveCustomSongs,
  storeSongId,
  withCustomSongWriteLock
} from "./song-store.js";
import { browserPreferenceStorage, readPracticeHistory, readSongSpeed, PRACTICE_HISTORY_STORAGE_KEY, SONG_SPEED_STORAGE_KEY, SONG_SPEED_STORAGE_PREFIX } from "./practice-preferences.js";

const songList = document.getElementById("songList");
const songSearchInput = document.getElementById("songSearchInput");
const songCountText = document.getElementById("songCountText");
const difficultyTabs = document.getElementById("difficultyTabs");
const emptySongText = document.getElementById("emptySongText");
const practiceHistoryMessage = document.getElementById("practiceHistoryMessage");
const libraryRefreshMessage = document.getElementById("libraryRefreshMessage");
const appVersionText = document.getElementById("appVersionText");
const addSongBtn = document.getElementById("addSongBtn");
const importPanel = document.getElementById("importPanel");
const aiPromptText = document.getElementById("aiPromptText");
const copyPromptBtn = document.getElementById("copyPromptBtn");
const songJsonInput = document.getElementById("songJsonInput");
const importSongBtn = document.getElementById("importSongBtn");
const importMessage = document.getElementById("importMessage");
const importDraftMessage = document.getElementById("importDraftMessage");
const aiThinkingModal = document.getElementById("aiThinkingModal");
const localSongCountText = document.getElementById("localSongCountText");
const localSongList = document.getElementById("localSongList");
const localSongEmptyText = document.getElementById("localSongEmptyText");
const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const deleteConfirmTitle = document.getElementById("deleteConfirmTitle");
const deleteConfirmText = document.getElementById("deleteConfirmText");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const AI_THINKING_MIN_MS = 900;
const LIBRARY_REFRESH_ERROR = "无法刷新本地曲库，暂时保留当前列表和选择。请稍后重试。";

let songLibrary = getSongLibrary();
let activeDifficulty = "all";
let selectedSongOverride = null;
let displayedSongId = null;
let importingSong = false;
let deletingSong = false;
let pendingDeleteBaseSongId = null;
let pendingDeleteSnapshot = null;
let pendingDeleteFocusTarget = null;
const IMPORT_DRAFT_STORAGE_KEY = "kalimba-import-draft-v1";
let lastKnownImportDraft;
let lastSyncedImportDraft = "";
let importDraftCleanupPending = false;
let pendingImportDraftRestore = null;
let unpersistedImportDraft = null;
let importDraftSaveRevision = 0;
const LIBRARY_VIEW_STORAGE_KEY = "kalimba-library-view-v1";
const DEFAULT_LIBRARY_VIEW = { schemaVersion: 1, search: "", difficulty: "all", importPanelOpen: null };
let libraryViewState = { ...DEFAULT_LIBRARY_VIEW };
let libraryViewUnsaved = false;
let libraryViewRevision = 0;

function readLibraryViewState() {
  const raw = sessionStorage.getItem(LIBRARY_VIEW_STORAGE_KEY);
  if (raw === null) return { ...DEFAULT_LIBRARY_VIEW };
  const state = JSON.parse(raw);
  if (!state || typeof state !== "object" || Array.isArray(state) || state.schemaVersion !== 1 ||
      typeof state.search !== "string" || !["all", ...DIFFICULTY_LEVELS].includes(state.difficulty) ||
      !(state.importPanelOpen === null || typeof state.importPanelOpen === "boolean")) {
    throw new Error("Invalid library view state");
  }
  return state;
}

function rememberLibraryView(changes) {
  libraryViewState = { ...libraryViewState, ...changes };
  libraryViewRevision += 1;
  libraryViewUnsaved = true;
  try {
    // Re-read before writing: leave malformed/future records untouched, and
    // preserve unknown fields in this supported version. This optional record
    // never writes raw draft text or changes draft-storage success reporting.
    const stored = readLibraryViewState();
    const text = JSON.stringify({ ...stored, search: libraryViewState.search,
      difficulty: libraryViewState.difficulty, importPanelOpen: libraryViewState.importPanelOpen });
    sessionStorage.setItem(LIBRARY_VIEW_STORAGE_KEY, text);
    libraryViewUnsaved = sessionStorage.getItem(LIBRARY_VIEW_STORAGE_KEY) !== text;
  } catch {
    // Keep the working view in this document when session storage is unavailable.
  }
}

function restoreLibraryView(readStored = true) {
  try {
    if (readStored && !libraryViewUnsaved) libraryViewState = readLibraryViewState();
  } catch {
    // Optional UI continuity must never block the library or hide draft errors.
  }
  songSearchInput.value = libraryViewState.search;
  activeDifficulty = libraryViewState.difficulty;
  if (libraryViewState.importPanelOpen !== null &&
      importDraftMessage.className !== "import-message error" &&
      unpersistedImportDraft === null && !importDraftCleanupPending) {
    importPanel.hidden = !libraryViewState.importPanelOpen;
    addSongBtn.textContent = importPanel.hidden ? "添加歌曲" : "收起添加";
  }
}

function restoreLibraryViewAfterPageShow() {
  restoreLibraryView();
  const revision = libraryViewRevision;
  setTimeout(() => {
    // Native history form replay may happen on either side of pageshow. Apply
    // the current view after it. A real edit during this window owns the new
    // in-memory view, even if native replay also trails that input event.
    restoreLibraryView(revision === libraryViewRevision);
    renderSongList();
  }, 0);
}

function showImportDraftMessage(text, kind = "neutral") {
  if (kind === "error") {
    importPanel.hidden = false;
    addSongBtn.textContent = "收起添加";
  }
  if (importDraftMessage.textContent === text && importDraftMessage.className === `import-message ${kind}`) return;
  importDraftMessage.textContent = text;
  importDraftMessage.className = `import-message ${kind}`;
  importDraftMessage.hidden = !text;
}

function showRestoredImportDraft() {
  importPanel.hidden = libraryViewState.importPanelOpen === false;
  addSongBtn.textContent = importPanel.hidden ? "添加歌曲" : "收起添加";
  showImportDraftMessage("已恢复本标签页保留的导入草稿。恢复不代表尚未保存，请先核对本地曲库；草稿不会上传。", "neutral");
}

function readImportDraft() {
  const value = sessionStorage.getItem(IMPORT_DRAFT_STORAGE_KEY);
  if (value !== null && typeof value !== "string") throw new Error("Invalid draft storage value");
  return value;
}

function restoreImportDraft(afterNativeRestore = false) {
  // A bfcache document can contain an older draft that a newer library page
  // already saved/cleared. Only replace a DOM value we last synchronized;
  // never overwrite an unpersisted edit or browser-restored form value.
  // A suspended import still owns the text submitted by its Save click.
  // A newer same-tab document must not substitute another draft mid-transaction.
  if (importingSong || importDraftCleanupPending) return;
  if (!afterNativeRestore && (unpersistedImportDraft !== null || songJsonInput.value !== lastSyncedImportDraft)) {
    try {
      if (readImportDraft() !== lastKnownImportDraft) {
        showImportDraftMessage("本标签页的保留草稿已变化，当前未同步的输入仍在本页。请先复制当前原稿，再重新打开曲库核对。", "error");
      }
    } catch {
      showImportDraftMessage("暂时无法读取本标签页草稿，当前输入仍在本页；离开前请先保留原稿。", "error");
    }
    return;
  }
  try {
    const stored = readImportDraft();
    const changed = lastKnownImportDraft !== undefined && stored !== lastKnownImportDraft;
    lastKnownImportDraft = stored;
    songJsonInput.value = stored ?? "";
    lastSyncedImportDraft = songJsonInput.value;
    unpersistedImportDraft = null;
    if (stored !== null && stored !== "") showRestoredImportDraft();
    else if (changed) showImportDraftMessage("本标签页较新的页面已清除或保存这份草稿，没有恢复旧输入。", "neutral");
  } catch {
    // A browser-restored older form value must not acquire permission to replace
    // a different draft whose current contents could not be read.
    if (afterNativeRestore) {
      lastKnownImportDraft = undefined;
      unpersistedImportDraft = songJsonInput.value;
    }
    showImportDraftMessage("暂时无法读取本标签页草稿。当前输入仍在本页；离开前请先保留原稿。", "error");
  }
}

function restoreImportDraftAfterPageShow() {
  // Native history traversal can restore textarea values before or after
  // pageshow without firing input. Track actual unsynchronized edits rather
  // than mistaking a changed DOM value for a new user draft.
  // Read session state in the next task, after the browser's restoration step.
  // Only a previously synchronized editor may be replaced; real edits during
  // this window invalidate the permission, even in a newly created document.
  const pending = {
    canReplace: unpersistedImportDraft === null && lastKnownImportDraft !== undefined && !importingSong && !importDraftCleanupPending,
    raw: unpersistedImportDraft ?? songJsonInput.value,
    synced: lastSyncedImportDraft,
    known: lastKnownImportDraft,
    importing: importingSong,
    cleanup: importDraftCleanupPending,
    saveRevision: importDraftSaveRevision,
    edited: false,
    editedRaw: null
  };
  pendingImportDraftRestore = pending;
  setTimeout(() => {
    if (pendingImportDraftRestore !== pending) return;
    pendingImportDraftRestore = null;
    if (pending.saveRevision !== importDraftSaveRevision) return;
    if (pending.edited) {
      songJsonInput.value = pending.editedRaw;
      persistImportDraft();
      if (pending.editedRaw === "" && lastKnownImportDraft === undefined && !importDraftCleanupPending) {
        showImportDraftMessage("当前输入已清空；本标签页若有其他保留草稿，未将它删除。重新打开曲库可核对。", "neutral");
      }
    } else {
      // A dirty or cleanup-pending editor also must not lose its real text to a
      // silent browser form restore. Do not undo a save that completed meanwhile.
      if (!pending.canReplace && importingSong === pending.importing &&
          importDraftCleanupPending === pending.cleanup &&
          lastSyncedImportDraft === pending.synced && lastKnownImportDraft === pending.known) {
        songJsonInput.value = pending.raw;
      }
      restoreImportDraft(pending.canReplace);
    }
  }, 0);
}

function persistImportDraft() {
  const raw = songJsonInput.value;
  unpersistedImportDraft = raw;
  // An empty document that never read storage must not erase an unknown draft.
  if (raw === "" && lastKnownImportDraft === undefined && !importDraftCleanupPending) {
    unpersistedImportDraft = null;
    return true;
  }
  try {
    const stored = readImportDraft();
    const desired = raw === "" ? null : raw;
    if (stored === desired) {
      lastKnownImportDraft = stored;
      lastSyncedImportDraft = raw;
      importDraftCleanupPending = false;
      unpersistedImportDraft = null;
      showImportDraftMessage(raw ? "草稿已保留在本标签页；换曲或更新后可恢复。关闭标签页后不保证保留。" : "");
      return true;
    }
    if (raw === "" && importDraftCleanupPending && stored !== lastKnownImportDraft) {
      // The exact old cleanup target no longer exists. A newer document owns
      // this different raw value: do not delete it or trap an empty old page.
      // Keep the old expectation so another leave event cannot erase the new one.
      importDraftCleanupPending = false;
      unpersistedImportDraft = null;
      showImportDraftMessage("旧草稿的清理目标已变化，已保留本标签页的另一份草稿；重新打开曲库可查看。", "neutral");
      return true;
    }
    if (stored !== lastKnownImportDraft && !(lastKnownImportDraft === undefined && stored === null)) {
      // This can be a newer same-tab document, or a previously unreadable
      // record. Keep both versions: current raw DOM and the stored draft.
      if (raw === "" && !importDraftCleanupPending) {
        unpersistedImportDraft = null;
        showImportDraftMessage("本标签页另有保留的草稿，未用当前空输入清除；重新打开曲库可查看。", "neutral");
        return true;
      }
      showImportDraftMessage("本标签页另有一份较新的或尚未读取的草稿，当前输入没有覆盖它。请先复制当前原稿，再重新打开曲库核对。", "error");
      return false;
    }
    if (desired === null) sessionStorage.removeItem(IMPORT_DRAFT_STORAGE_KEY);
    else sessionStorage.setItem(IMPORT_DRAFT_STORAGE_KEY, raw);
    if (readImportDraft() !== desired) throw new Error("Draft write did not round-trip");
    lastKnownImportDraft = desired;
    lastSyncedImportDraft = raw;
    importDraftCleanupPending = false;
    unpersistedImportDraft = null;
    showImportDraftMessage(raw ? "草稿已保留在本标签页；换曲或更新后可恢复。关闭标签页后不保证保留。" : "");
    return true;
  } catch {
    showImportDraftMessage(importDraftCleanupPending
      ? "歌曲已保存，但无法确认旧草稿已清除。请勿重复保存；恢复存储后重试换曲或更新。"
      : raw === ""
        ? "输入已清空，但无法确认保留草稿已清除，下次可能恢复旧输入。请恢复本标签页存储后重试；暂未离开页面。"
        : "草稿暂时无法安全保留，原文仍在本页。请先复制原稿，或恢复本标签页存储后重试；未裁剪任何内容。", "error");
    return false;
  }
}

function prepareImportDraftForLeave() {
  if (pendingImportDraftRestore) {
    showImportDraftMessage("正在恢复本标签页草稿，请稍后再换曲、更新或保存。", "neutral");
    return false;
  }
  if (importingSong || deletingSong) {
    showImportDraftMessage("曲库正在保存或删除，请等操作结束后再换曲或更新。", "error");
    return false;
  }
  if (persistImportDraft()) return true;
  importPanel.hidden = false;
  addSongBtn.textContent = "收起添加";
  songJsonInput.focus();
  return false;
}

function clearImportDraftAfterSave() {
  importDraftCleanupPending = true;
  return persistImportDraft();
}

function getSelectedSongId() {
  const params = new URLSearchParams(window.location.search);
  const selectedSongId = params.get("selected") || params.get("song");
  const storedSongId = readStoredSongId();
  return getPracticeSongId(songLibrary, selectedSongOverride) ||
    getPracticeSongId(songLibrary, selectedSongId) ||
    getPracticeSongId(songLibrary, storedSongId) || "birthday";
}

// Keep this library entry coherent after a choice/import and browser Back.
// URL failure must not prevent practice or revive an old chord selection.
function rememberLibrarySelection(songId) {
  const canonical = getPracticeSongId(songLibrary, songId);
  if (!canonical) return;
  selectedSongOverride = canonical;
  storeSongId(canonical);
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("selected", canonical);
    url.searchParams.delete("song");
    window.history.replaceState(window.history.state, "", url.href);
  } catch {
    // A restricted history API still leaves the current tab's choice intact.
  }
}

function getSongTotalBeats(song, accompaniment) {
  const events = Array.isArray(song.events) && song.events.length
    ? song.events
    : (song.steps || []).map(([, beat, duration]) => ({ beat, duration }));
  // Both layers have already been normalized by getSongLibrary. The practice
  // clock includes the initial backing span even when its sound is switched off.
  return Math.max(getPracticeTotalBeats(events, song), getPracticeTotalBeats(accompaniment?.events));
}

function formatDuration(seconds) {
  const roundedSeconds = Math.max(1, Math.round(seconds));
  if (roundedSeconds < 60) {
    return `约 ${roundedSeconds} 秒`;
  }
  const minutes = Math.floor(roundedSeconds / 60);
  const remainSeconds = String(roundedSeconds % 60).padStart(2, "0");
  return `约 ${minutes}:${remainSeconds}`;
}

function getSongDuration(songGroup, speed) {
  const { primary: song, initialAccompaniment } = songGroup;
  // Match getSongEndSeconds: one full pass, including source-ending silence and
  // the fixed 0.9 s ringout, but excluding preparation and additional loop passes.
  return getSongTotalBeats(song, initialAccompaniment) * (60 / song.bpm) / speed + 0.9;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/[《》]/g, "")
    .trim()
    .toLowerCase();
}

function getSongUploader(song) {
  return song.uploader || song.author || "system";
}

function getGroupedSongs(songs) {
  const groups = new Map();
  songs.forEach((song) => {
    const baseSongId = getSongBaseId(song);
    if (!groups.has(baseSongId)) {
      groups.set(baseSongId, []);
    }
    groups.get(baseSongId).push(song);
  });

  return [...groups.values()].map((variants) => {
    variants.sort((a, b) => getSongVersionRank(a) - getSongVersionRank(b) || a.id.localeCompare(b.id, "en"));
    const practiceSongId = getPracticeSongId(songLibrary, variants[0].id);
    const practiceSong = songLibrary[practiceSongId];
    const primary = variants.find((song) => song.id === practiceSongId) ||
      (practiceSong && getSongBaseId(practiceSong) === getSongBaseId(variants[0]) ? practiceSong : variants[0]);
    const accompanimentProvider = getSongAccompanimentProvider(primary, variants);
    return {
      baseSongId: getSongBaseId(variants[0]),
      primary,
      practiceReady: Boolean(practiceSongId),
      // Match the practice page's actual provider, including imported backing.
      accompanimentProvider,
      initialAccompaniment: accompanimentProvider?.config,
      variants
    };
  });
}

function getSongNoteSummary(song) {
  return String(Number(song.judgeNoteCount || song.steps.length || 0));
}

function hasPracticeAccompaniment(songGroup) {
  return Boolean(songGroup.initialAccompaniment?.events?.length);
}

function formatSongTitleForMessage(title) {
  const text = String(title || "本地歌曲").trim() || "本地歌曲";
  return text.startsWith("《") && text.endsWith("》") ? text : `《${text}》`;
}

function getSongDifficulty(song) {
  return normalizeDifficulty(song.difficulty) || "easy";
}

function getSearchText(songGroup) {
  const { primary, variants } = songGroup;
  return normalizeText([
    getSongDisplayTitle(primary),
    ...variants.map((variant) => variant.id),
    ...variants.map((variant) => variant.title),
    ...variants.map((variant) => variant.hint),
    getSongUploader(primary),
    DIFFICULTY_LABELS[getSongDifficulty(primary)],
    getSongDifficulty(primary)
  ].join(" "));
}

function songGroupMatchesDifficulty(songGroup, difficulty) {
  return difficulty === "all" || getSongDifficulty(songGroup.primary) === difficulty;
}

function selectSong(songId) {
  const practiceSongId = getPracticeSongId(songLibrary, songId);
  if (!practiceSongId || !prepareImportDraftForLeave()) return;
  rememberLibrarySelection(practiceSongId);
  window.location.href = `./index.html?song=${encodeURIComponent(practiceSongId)}&fromLibrary=1`;
}

function createMeta(label, value, modifier = "") {
  const item = document.createElement("span");
  item.className = "song-meta-item";
  if (modifier) {
    item.classList.add(modifier);
  }
  item.textContent = label ? `${label} ${value}` : String(value);
  return item;
}

function createSongCard(songGroup, selectedSongId, selectedBaseSongId) {
  const song = songGroup.primary;
  const displayTitle = getSongDisplayTitle(song);
  const card = document.createElement("article");
  card.className = "card song-card";
  if (getSongBaseId(song) === selectedBaseSongId) {
    card.classList.add("selected");
  }

  const body = document.createElement("div");
  body.className = "song-card-body";

  const title = document.createElement("h2");
  title.textContent = displayTitle;

  const meta = document.createElement("div");
  meta.className = "song-meta";
  const difficulty = getSongDifficulty(song);
  // primary is the canonical practice song, so legacy chord links and imported
  // melody IDs read exactly the same speed record as setCurrentSong.
  const speed = readSongSpeed(browserPreferenceStorage, song.id).speed ?? 1;
  const duration = createMeta("练习", formatDuration(getSongDuration(songGroup, speed)));
  duration.title = "按进入练习时的速度估算全曲一遍，含结尾休止与 0.9 秒余音；不含准备倒数、暂停或循环次数";
  meta.append(
    createMeta("难度", DIFFICULTY_LABELS[difficulty], `difficulty-${difficulty}`),
    duration,
    createMeta("作者", getSongUploader(song)),
    createMeta("练习速度", `${speed.toFixed(2)}x · ${Math.round(song.bpm * speed)} BPM`),
    createMeta("音符", getSongNoteSummary(song))
  );

  const copyLabel = getLocalSongCopyLabel(song);
  if (copyLabel) meta.append(createMeta("", copyLabel));

  // Keep selection cards compact. Full source titles, review boundaries and
  // score evidence remain unchanged in the song records and repository docs.
  body.append(title, meta);

  const isSelected = getSongBaseId(song) === selectedBaseSongId;
  const action = document.createElement("button");
  action.className = `song-action-btn ${isSelected ? "accent" : "ghost"}`;
  action.type = "button";
  action.title = `练习${displayTitle}`;
  action.setAttribute("aria-label", action.title);
  const actionIcon = document.createElement("span");
  actionIcon.className = "song-action-icon";
  actionIcon.setAttribute("aria-hidden", "true");
  action.append(actionIcon);
  action.addEventListener("click", () => selectSong(isSelected ? selectedSongId : song.id));

  card.append(body, action);
  return card;
}

function createLocalSongItem(songGroup) {
  const song = songGroup.primary;
  const item = document.createElement("article");
  item.className = "local-song-item";

  const body = document.createElement("div");
  body.className = "local-song-body";

  const title = document.createElement("strong");
  title.className = "local-song-title";
  title.textContent = song.title;

  const meta = document.createElement("div");
  meta.className = "local-song-meta";
  const difficulty = getSongDifficulty(song);
  meta.append(
    createMeta("难度", DIFFICULTY_LABELS[difficulty], `difficulty-${difficulty}`),
    createMeta("BPM", song.bpm),
    createMeta("音符", getSongNoteSummary(song))
  );
  const copyLabel = getLocalSongCopyLabel(song);
  if (copyLabel) meta.append(createMeta("", copyLabel));
  if (!songGroup.practiceReady) {
    meta.append(createMeta("状态", "主旋律待核对，原始资料已保留"));
  }
  if (hasPracticeAccompaniment(songGroup)) {
    meta.append(createMeta("伴奏", songGroup.accompanimentProvider?.kind === "imported-auto" ? "导入伴奏" : "有"));
  }

  body.append(title, meta);

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-song-btn";
  deleteButton.type = "button";
  deleteButton.textContent = "删除";
  deleteButton.setAttribute("data-delete-base", songGroup.baseSongId);
  deleteButton.addEventListener("click", () => openDeleteConfirm(songGroup, deleteButton));

  const actions = document.createElement("div");
  actions.className = "local-song-actions";
  if (songGroup.practiceReady) {
    const practiceButton = document.createElement("button");
    practiceButton.className = "ghost local-practice-btn";
    practiceButton.type = "button";
    practiceButton.textContent = "练习";
    practiceButton.setAttribute("aria-label", `练习${song.title}`);
    practiceButton.addEventListener("click", () => selectSong(song.id));
    actions.append(practiceButton);
  }
  actions.append(deleteButton);
  item.append(body, actions);
  return item;
}

function renderLocalSongManager() {
  if (!localSongList || !localSongEmptyText || !localSongCountText) {
    return;
  }

  // Use the same read as the displayed practice library; a second storage read
  // could pair an old title with new deletion evidence during a cross-tab edit.
  const localSongs = getCustomSongsForLibrary(songLibrary);
  const localSongGroups = getGroupedSongs(localSongs);
  localSongList.replaceChildren();
  localSongCountText.textContent = `${localSongGroups.length} 首`;
  localSongEmptyText.hidden = localSongGroups.length > 0;

  localSongGroups.forEach((songGroup) => {
    localSongList.appendChild(createLocalSongItem(songGroup));
  });

  if (pendingDeleteSnapshot) {
    const currentGroup = localSongGroups.find((group) => group.baseSongId === pendingDeleteBaseSongId);
    const currentSnapshot = getCustomSongGroupSnapshot(currentGroup?.variants);
    if (currentSnapshot?.content !== pendingDeleteSnapshot.content) {
      closeDeleteConfirm();
      const message = "本地歌曲已变化或不存在，本次未删除。请重新检查列表后再确认删除。";
      showImportMessage(message, "error");
      libraryRefreshMessage.textContent = message;
      libraryRefreshMessage.hidden = false;
    }
  }
}

function createDifficultyButton(difficulty, count) {
  const button = document.createElement("button");
  const isActive = difficulty === activeDifficulty;
  button.type = "button";
  button.className = `difficulty-tab ${isActive ? "accent active" : "ghost"}`;
  button.textContent = `${DIFFICULTY_LABELS[difficulty]} ${count}`;
  button.setAttribute("aria-pressed", String(isActive));
  if (difficulty !== "all" && count === 0) {
    button.disabled = true;
  }

  button.addEventListener("click", () => {
    activeDifficulty = difficulty;
    rememberLibraryView({ difficulty });
    renderSongList();
  });

  return button;
}

function renderDifficultyTabs(searchedSongs) {
  if (!difficultyTabs) {
    return;
  }

  const counts = Object.fromEntries(DIFFICULTY_LEVELS.map((difficulty) => [difficulty, 0]));
  searchedSongs.forEach((songGroup) => {
    counts[getSongDifficulty(songGroup.primary)] += 1;
  });

  difficultyTabs.replaceChildren(
    createDifficultyButton("all", searchedSongs.length),
    ...DIFFICULTY_LEVELS.map((difficulty) => createDifficultyButton(difficulty, counts[difficulty]))
  );
}

function renderSongList() {
  const selectedSongId = getSelectedSongId();
  displayedSongId = selectedSongId;
  const selectedSong = songLibrary[selectedSongId] || songLibrary.birthday;
  const selectedBaseSongId = getSongBaseId(selectedSong);
  const query = normalizeText(songSearchInput.value);
  const songs = getGroupedSongs(Object.values(songLibrary)).filter((songGroup) => songGroup.practiceReady);
  const searchedSongs = query
    ? songs.filter((song) => getSearchText(song).includes(query))
    : songs;
  const history = readPracticeHistory(browserPreferenceStorage);
  practiceHistoryMessage.hidden = !history.error;
  practiceHistoryMessage.textContent = history.error || "";
  // 沿用同一首歌的最近练习时间；未练曲目保持原顺序。
  const matchedSongs = searchedSongs
    .filter((songGroup) => songGroupMatchesDifficulty(songGroup, activeDifficulty))
    .sort((a, b) => (history.records[b.baseSongId]?.lastPracticedAt || 0) - (history.records[a.baseSongId]?.lastPracticedAt || 0));

  renderDifficultyTabs(searchedSongs);
  songList.replaceChildren();
  matchedSongs.forEach((song) => {
    songList.appendChild(createSongCard(song, selectedSongId, selectedBaseSongId));
  });

  songCountText.textContent = `显示 ${matchedSongs.length} / ${searchedSongs.length} 首`;
  emptySongText.hidden = matchedSongs.length > 0;
  emptySongText.textContent = "没有找到匹配的歌曲";
  if (!matchedSongs.length && searchedSongs.length && activeDifficulty !== "all") {
    emptySongText.textContent = `“${DIFFICULTY_LABELS[activeDifficulty]}”分类暂无匹配歌曲。`;
    const clearDifficulty = document.createElement("button");
    clearDifficulty.type = "button";
    clearDifficulty.className = "ghost";
    clearDifficulty.textContent = `查看匹配的 ${searchedSongs.length} 首`;
    clearDifficulty.addEventListener("click", () => {
      activeDifficulty = "all";
      rememberLibraryView({ difficulty: "all" });
      renderSongList();
      songSearchInput.focus();
    });
    emptySongText.append(clearDifficulty);
  }
}

function showImportMessage(message, kind = "neutral") {
  importMessage.textContent = message;
  importMessage.className = `import-message ${kind}`;
  importMessage.hidden = false;
}

function getImportSuccessMessage(savedSongs) {
  const [primarySong] = savedSongs;
  if (!primarySong) {
    return "没有可保存的歌曲";
  }

  const titles = getGroupedSongs(savedSongs).map((songGroup) => songGroup.primary.title);
  const duplicateNotice = getDuplicateImportNotice(savedSongs);
  return `已添加 ${titles.join("、")}，练习时只弹主旋律` + (duplicateNotice ? `。${duplicateNotice}` : "");
}

function refreshLibraryViews() {
  renderSongList();
  renderLocalSongManager();
}

function reloadLibraryViews() {
  const previousSelection = displayedSongId;
  try {
    songLibrary = getSongLibrary({ strict: true });
  } catch {
    // A transient read failure is not evidence that a score was deleted. Keep
    // the last good snapshot and selection so the next refresh can recover.
    libraryRefreshMessage.textContent = LIBRARY_REFRESH_ERROR;
    libraryRefreshMessage.hidden = false;
    return;
  }
  // A background tab's import also changes shared "current song" storage. Keep
  // this page's choice, while allowing a temporarily unreadable explicit link
  // to resolve after storage recovers. Never write preferences or rewrite URL.
  const params = new URLSearchParams(window.location.search);
  const explicitSelection = params.get("selected") || params.get("song");
  const selection = getPracticeSongId(songLibrary, selectedSongOverride) ||
    getPracticeSongId(songLibrary, explicitSelection) || getPracticeSongId(songLibrary, previousSelection);
  if (selection) selectedSongOverride = selection;
  libraryRefreshMessage.textContent = "";
  libraryRefreshMessage.hidden = true;
  refreshLibraryViews();
}

function openDeleteConfirm(songGroup, returnTarget = document.activeElement) {
  if (!songGroup?.primary || songGroup.primary.source !== "local") {
    return;
  }

  const snapshot = getCustomSongGroupSnapshot(songGroup.variants || [songGroup.primary]);
  if (!snapshot || snapshot.baseSongId !== songGroup.baseSongId) return;
  pendingDeleteBaseSongId = songGroup.baseSongId;
  pendingDeleteSnapshot = snapshot;
  pendingDeleteFocusTarget = returnTarget;
  const copyLabel = getLocalSongCopyLabel(songGroup.primary);
  deleteConfirmTitle.textContent = `确定删除${formatSongTitleForMessage(songGroup.primary.title)}${copyLabel ? `（${copyLabel}）` : ""}？`;
  deleteConfirmText.textContent = "只会从本机曲库移除，不会影响系统内置歌曲。";
  deleteConfirmModal.hidden = false;
  cancelDeleteBtn.focus();
}

function restoreDeleteFocus(target, baseSongId) {
  // A newer dialog owns focus, even if an older async deletion just finished.
  if (!deleteConfirmModal.hidden) return;
  const usable = (node) => node?.isConnected && !node.disabled && !node.closest?.("[hidden]");
  const replacement = Array.from(localSongList?.querySelectorAll?.(".delete-song-btn") || [])
    .find((button) => button.getAttribute("data-delete-base") === baseSongId);
  const destination = usable(target) ? target : usable(replacement) ? replacement : addSongBtn;
  destination?.focus();
}

function closeDeleteConfirm(restoreFocus = true) {
  const target = pendingDeleteFocusTarget;
  const baseSongId = pendingDeleteBaseSongId;
  pendingDeleteBaseSongId = null;
  pendingDeleteSnapshot = null;
  pendingDeleteFocusTarget = null;
  deleteConfirmModal.hidden = true;
  if (restoreFocus !== false) restoreDeleteFocus(target, baseSongId);
}

async function confirmDeleteCustomSong() {
  if (!pendingDeleteBaseSongId || importingSong || deletingSong) return;

  const baseSongId = pendingDeleteBaseSongId;
  const snapshot = pendingDeleteSnapshot;
  const focusTarget = pendingDeleteFocusTarget;
  deletingSong = true;
  confirmDeleteBtn.disabled = true;
  importSongBtn.disabled = true;
  // Close this exact confirmation before the async lock request. A later dialog
  // must not be dismissed by the result of this already-confirmed deletion.
  closeDeleteConfirm(false);
  let focusAtResult = null;
  try {
    const deletedSong = await withCustomSongWriteLock(() => deleteCustomSongGroup(baseSongId, snapshot));
    focusAtResult = document.activeElement;
    if (!deletedSong) {
      showImportMessage("只能删除本地歌曲", "error");
      return;
    }

    const selectedSongId = getSelectedSongId();
    if (getSongBaseId(songLibrary[selectedSongId] || songLibrary.birthday) === baseSongId) {
      rememberLibrarySelection("birthday");
    } else if (deletedSong.ids.includes(readStoredSongId())) {
      // Removing a stale stored choice must not replace an unrelated explicit URL.
      storeSongId(selectedSongId);
    }

    songLibrary = getSongLibrary();
    libraryRefreshMessage.textContent = "";
    libraryRefreshMessage.hidden = true;
    refreshLibraryViews();
    showImportMessage(`已删除 ${formatSongTitleForMessage(deletedSong.title)}`, "success");
  } catch (error) {
    focusAtResult = document.activeElement;
    if (error.code === "STALE_CUSTOM_SONG_GROUP") reloadLibraryViews();
    showImportMessage(error.message, "error");
    // Also keep the error visible if the import panel is later collapsed.
    libraryRefreshMessage.textContent = error.message;
    libraryRefreshMessage.hidden = false;
  } finally {
    deletingSong = false;
    confirmDeleteBtn.disabled = importingSong;
    importSongBtn.disabled = importingSong;
    // Capture ownership before rendering detaches rows: body after rendering
    // does not mean a newer dialog's cancelled trigger belonged to this action.
    if ([document.body, confirmDeleteBtn, cancelDeleteBtn, focusAtResult].includes(document.activeElement)) {
      if ([document.body, confirmDeleteBtn, cancelDeleteBtn, focusTarget].includes(focusAtResult)) {
        restoreDeleteFocus(focusTarget, baseSongId);
      } else {
        const newerBase = focusAtResult?.getAttribute?.("data-delete-base");
        if (newerBase) restoreDeleteFocus(focusAtResult, newerBase);
      }
    }
  }
}

function toggleImportPanel() {
  importPanel.hidden = !importPanel.hidden;
  addSongBtn.textContent = importPanel.hidden ? "添加歌曲" : "收起添加";
  rememberLibraryView({ importPanelOpen: !importPanel.hidden });
  if (!importPanel.hidden) {
    songJsonInput.focus();
  }
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(AI_SONG_PROMPT);
    showImportMessage("提示词已复制", "success");
  } catch (error) {
    aiPromptText.focus();
    aiPromptText.select();
    showImportMessage("复制失败，可以手动全选提示词", "error");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function setImportBusy(enabled) {
  importingSong = enabled;
  importSongBtn.disabled = enabled || deletingSong;
  confirmDeleteBtn.disabled = enabled || deletingSong;
  songJsonInput.disabled = enabled;
  if (aiThinkingModal) {
    aiThinkingModal.hidden = !enabled;
  }
}

async function waitForThinkingMinimum(startTime) {
  const elapsed = performance.now() - startTime;
  await delay(Math.max(0, AI_THINKING_MIN_MS - elapsed));
}

async function importSongFromJson() {
  if (pendingImportDraftRestore) {
    showImportDraftMessage("正在恢复本标签页草稿，请稍后再换曲、更新或保存。", "neutral");
    return;
  }
  if (importingSong || deletingSong) {
    return;
  }

  const submittedRaw = songJsonInput.value;
  const startedAt = performance.now();
  setImportBusy(true);
  await waitForPaint();

  try {
    const savedSongs = await withCustomSongWriteLock(() => {
      const importedSongs = parseImportedSongs(submittedRaw);
      return saveCustomSongs(importedSongs);
    });
    // A completed write advances the transaction even while its short feedback
    // remains busy. A pending history task must not undo this completion later.
    const pendingRestore = pendingImportDraftRestore;
    if (pendingRestore?.edited) songJsonInput.value = pendingRestore.editedRaw;
    else if (pendingRestore && !pendingRestore.canReplace && pendingRestore.raw !== submittedRaw &&
        pendingRestore.saveRevision === importDraftSaveRevision) {
      songJsonInput.value = pendingRestore.raw;
    }
    importDraftSaveRevision += 1;
    const song = savedSongs[0];
    songLibrary = getSongLibrary();
    rememberLibrarySelection(song.id);
    activeDifficulty = "all";
    songSearchInput.value = "";
    rememberLibraryView({ search: "", difficulty: "all" });
    let draftSafe, draftResult = "";
    if (songJsonInput.value === submittedRaw) {
      songJsonInput.value = "";
      draftSafe = clearImportDraftAfterSave();
      if (!draftSafe) draftResult = "；旧草稿尚未清除，请勿重复保存。";
    } else {
      // Browser form restoration or a later edit is not part of this Save.
      // Never clear that different text just because the submitted draft saved.
      draftSafe = persistImportDraft();
      draftResult = "；后来变化的输入已保留在本页，请核对后再保存。";
    }
    refreshLibraryViews();
    await waitForThinkingMinimum(startedAt);
    showImportMessage(getImportSuccessMessage(savedSongs) + draftResult, draftSafe ? "success" : "neutral");
  } catch (error) {
    await waitForThinkingMinimum(startedAt);
    showImportMessage(error.message, "error");
  } finally {
    setImportBusy(false);
  }
}

aiPromptText.value = AI_SONG_PROMPT;
if (appVersionText) {
  appVersionText.textContent = `v${APP_VERSION}`;
}

restoreLibraryView();
restoreImportDraft();
songJsonInput.addEventListener("input", () => {
  unpersistedImportDraft = songJsonInput.value;
  // A new edit is a new draft, even after the previous song was saved.
  if (songJsonInput.value !== "") importDraftCleanupPending = false;
  if (pendingImportDraftRestore) {
    pendingImportDraftRestore.edited = true;
    pendingImportDraftRestore.editedRaw = songJsonInput.value;
    // The visible baseline may be native historical text rather than the draft
    // read during initialization. Retain this real edit without assuming it owns
    // the other stored draft; the next task will compare both before any write.
    lastKnownImportDraft = undefined;
    showImportDraftMessage("页面恢复期间的输入已留在本页，正在核对本标签页保留的草稿。", "neutral");
    return;
  }
  persistImportDraft();
});
window.addEventListener("pageshow", restoreLibraryViewAfterPageShow);
window.addEventListener("pageshow", restoreImportDraftAfterPageShow);
window.addEventListener("kalimba:before-page-leave", (event) => {
  if (!prepareImportDraftForLeave()) event.preventDefault();
});
window.addEventListener("beforeunload", (event) => {
  if (prepareImportDraftForLeave()) return;
  event.preventDefault();
  event.returnValue = "";
});
songSearchInput.addEventListener("input", () => {
  rememberLibraryView({ search: songSearchInput.value });
  renderSongList();
});
window.addEventListener("pageshow", reloadLibraryViews);
window.addEventListener("storage", (event) => {
  if (event.key === CUSTOM_SONGS_STORAGE_KEY || event.key === null) reloadLibraryViews();
  else if (event.key === PRACTICE_HISTORY_STORAGE_KEY || event.key === SONG_SPEED_STORAGE_KEY ||
      (typeof event.key === "string" && event.key.startsWith(SONG_SPEED_STORAGE_PREFIX))) renderSongList();
});
addSongBtn.addEventListener("click", toggleImportPanel);
copyPromptBtn.addEventListener("click", copyPrompt);
importSongBtn.addEventListener("click", importSongFromJson);
cancelDeleteBtn.addEventListener("click", closeDeleteConfirm);
confirmDeleteBtn.addEventListener("click", confirmDeleteCustomSong);
deleteConfirmModal.addEventListener("click", (event) => {
  if (event.target === deleteConfirmModal) {
    closeDeleteConfirm();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !deleteConfirmModal.hidden) {
    closeDeleteConfirm();
  }
});

refreshLibraryViews();
