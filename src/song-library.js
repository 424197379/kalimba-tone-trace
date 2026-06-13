import {
  AI_SONG_PROMPT,
  APP_VERSION,
  DIFFICULTY_LABELS,
  DIFFICULTY_LEVELS,
  deleteCustomSong,
  getCustomSongs,
  getSongLibrary,
  normalizeDifficulty,
  parseImportedSong,
  readStoredSongId,
  saveCustomSong,
  storeSongId
} from "./song-store.js";

const APP_NAME = "卡林巴循音";

const songList = document.getElementById("songList");
const songSearchInput = document.getElementById("songSearchInput");
const songCountText = document.getElementById("songCountText");
const difficultyTabs = document.getElementById("difficultyTabs");
const emptySongText = document.getElementById("emptySongText");
const backToPracticeLink = document.getElementById("backToPracticeLink");
const appVersionText = document.getElementById("appVersionText");
const addSongBtn = document.getElementById("addSongBtn");
const importPanel = document.getElementById("importPanel");
const aiPromptText = document.getElementById("aiPromptText");
const copyPromptBtn = document.getElementById("copyPromptBtn");
const songJsonInput = document.getElementById("songJsonInput");
const importSongBtn = document.getElementById("importSongBtn");
const importMessage = document.getElementById("importMessage");
const aiThinkingModal = document.getElementById("aiThinkingModal");
const localSongCountText = document.getElementById("localSongCountText");
const localSongList = document.getElementById("localSongList");
const localSongEmptyText = document.getElementById("localSongEmptyText");
const deleteConfirmModal = document.getElementById("deleteConfirmModal");
const deleteConfirmTitle = document.getElementById("deleteConfirmTitle");
const deleteConfirmText = document.getElementById("deleteConfirmText");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const updateToast = document.getElementById("updateToast");
const updateNowBtn = document.getElementById("updateNowBtn");
const updateLaterBtn = document.getElementById("updateLaterBtn");
const AI_THINKING_MIN_MS = 900;

let songLibrary = getSongLibrary();
let activeDifficulty = "all";
let importingSong = false;
let pendingDeleteSongId = null;
let waitingServiceWorker = null;
let reloadRequestedForUpdate = false;
let refreshingForUpdate = false;

function getSelectedSongId() {
  const params = new URLSearchParams(window.location.search);
  const selectedSongId = params.get("selected") || params.get("song");
  const storedSongId = readStoredSongId();
  if (songLibrary[selectedSongId]) {
    return selectedSongId;
  }
  if (songLibrary[storedSongId]) {
    return storedSongId;
  }
  return "birthday";
}

function getSongTotalBeats(song) {
  const events = Array.isArray(song.events) ? song.events : [];
  if (events.length) {
    return Math.max(...events.map((event) => event.beat + event.duration));
  }
  if (!song.steps.length) {
    return 0;
  }
  return Math.max(...song.steps.map(([, beat, duration]) => beat + duration));
}

function formatDuration(seconds) {
  if (seconds < 60) {
    return `约 ${Math.max(1, Math.round(seconds))} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = Math.round(seconds % 60).toString().padStart(2, "0");
  return `约 ${minutes}:${remainSeconds}`;
}

function getSongDuration(song) {
  const defaultSpeed = Number(song.defaultSpeedFactor || 1);
  return getSongTotalBeats(song) * (60 / song.bpm) / defaultSpeed;
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

function getSongVersionLabel(song) {
  return song.versionLabel || (song.arrangementKind === "chord" ? "和弦版" : "主旋律版");
}

function getSongBaseId(song) {
  return song.baseSongId || (song.id.endsWith("-chord") ? song.id.slice(0, -6) : song.id);
}

function getSongVersionRank(song) {
  return song.arrangementKind === "chord" || song.judgementMode === "chord" ? 1 : 0;
}

function getPrimarySong(songGroup) {
  return [...songGroup].sort((a, b) => getSongVersionRank(a) - getSongVersionRank(b) || a.id.localeCompare(b.id, "en"))[0];
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

  return [...groups.values()].map((variants) => ({
    baseSongId: getSongBaseId(variants[0]),
    primary: getPrimarySong(variants),
    variants: [...variants].sort((a, b) => getSongVersionRank(a) - getSongVersionRank(b) || a.id.localeCompare(b.id, "en"))
  }));
}

function getSongNoteSummary(song) {
  const judgeCount = Number(song.judgeNoteCount || song.steps.length || 0);
  const arrangementCount = Number(song.arrangementNoteCount || judgeCount);
  return arrangementCount > judgeCount ? `${judgeCount} / ${arrangementCount}` : String(judgeCount);
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
    primary.id,
    primary.title,
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
  storeSongId(songId);
  window.location.href = `./index.html?song=${encodeURIComponent(songId)}&fromLibrary=1`;
}

function createMeta(label, value, modifier = "") {
  const item = document.createElement("span");
  item.className = "song-meta-item";
  if (modifier) {
    item.classList.add(modifier);
  }
  item.textContent = `${label} ${value}`;
  return item;
}

function createSongCard(songGroup, selectedSongId, selectedBaseSongId) {
  const song = songGroup.primary;
  const card = document.createElement("article");
  card.className = "card song-card";
  if (getSongBaseId(song) === selectedBaseSongId) {
    card.classList.add("selected");
  }

  const body = document.createElement("div");
  body.className = "song-card-body";

  const title = document.createElement("h2");
  title.textContent = song.title;

  const meta = document.createElement("div");
  meta.className = "song-meta";
  const difficulty = getSongDifficulty(song);
  meta.append(
    createMeta("难度", DIFFICULTY_LABELS[difficulty], `difficulty-${difficulty}`),
    createMeta("作者", getSongUploader(song)),
    createMeta("BPM", song.bpm),
    createMeta("拍号", `${song.beatsPerMeasure}/4`),
    createMeta("音符", song.steps.length),
    createMeta("时长", formatDuration(getSongDuration(song)))
  );

  const hint = document.createElement("p");
  hint.className = "song-card-hint";
  hint.textContent = song.hint;

  body.append(title, meta, hint);

  const isSelected = getSongBaseId(song) === selectedBaseSongId;
  const action = document.createElement("button");
  action.className = `song-action-btn ${isSelected ? "accent" : "ghost"}`;
  action.type = "button";
  action.title = isSelected ? "继续练习" : "开始练习";
  action.setAttribute("aria-label", `${action.title}${song.title}`);
  action.innerHTML = '<span class="song-action-icon" aria-hidden="true"></span>';
  action.addEventListener("click", () => selectSong(isSelected ? selectedSongId : song.id));

  card.append(body, action);
  return card;
}

function createLocalSongItem(song) {
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
    createMeta("音符", song.steps.length)
  );

  body.append(title, meta);

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-song-btn";
  deleteButton.type = "button";
  deleteButton.textContent = "删除";
  deleteButton.addEventListener("click", () => openDeleteConfirm(song));

  item.append(body, deleteButton);
  return item;
}

function renderLocalSongManager() {
  if (!localSongList || !localSongEmptyText || !localSongCountText) {
    return;
  }

  const localSongs = getCustomSongs();
  localSongList.replaceChildren();
  localSongCountText.textContent = `${localSongs.length} 首`;
  localSongEmptyText.hidden = localSongs.length > 0;

  localSongs.forEach((song) => {
    localSongList.appendChild(createLocalSongItem(song));
  });
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
  const selectedSong = songLibrary[selectedSongId] || songLibrary.birthday;
  const selectedBaseSongId = getSongBaseId(selectedSong);
  const query = normalizeText(songSearchInput.value);
  const songs = getGroupedSongs(Object.values(songLibrary));
  const searchedSongs = query
    ? songs.filter((song) => getSearchText(song).includes(query))
    : songs;
  const matchedSongs = searchedSongs.filter((songGroup) => songGroupMatchesDifficulty(songGroup, activeDifficulty));

  renderDifficultyTabs(searchedSongs);
  songList.replaceChildren();
  matchedSongs.forEach((song) => {
    songList.appendChild(createSongCard(song, selectedSongId, selectedBaseSongId));
  });

  songCountText.textContent = `显示 ${matchedSongs.length} / ${searchedSongs.length} 首`;
  emptySongText.hidden = matchedSongs.length > 0;
  backToPracticeLink.href = `./index.html?song=${encodeURIComponent(selectedSongId)}`;
}

function showImportMessage(message, kind = "neutral") {
  importMessage.textContent = message;
  importMessage.className = `import-message ${kind}`;
  importMessage.hidden = false;
}

function refreshLibraryViews() {
  renderSongList();
  renderLocalSongManager();
}

function openDeleteConfirm(song) {
  if (!song || song.source !== "local") {
    return;
  }

  pendingDeleteSongId = song.id;
  deleteConfirmTitle.textContent = `确定删除${formatSongTitleForMessage(song.title)}？`;
  deleteConfirmText.textContent = "只会从本机曲库移除，不会影响系统内置歌曲。";
  deleteConfirmModal.hidden = false;
  cancelDeleteBtn.focus();
}

function closeDeleteConfirm() {
  pendingDeleteSongId = null;
  deleteConfirmModal.hidden = true;
}

function confirmDeleteCustomSong() {
  if (!pendingDeleteSongId) {
    return;
  }

  const songId = pendingDeleteSongId;
  const selectedSongId = getSelectedSongId();
  const deletedSong = deleteCustomSong(songId);
  closeDeleteConfirm();

  if (!deletedSong) {
    showImportMessage("只能删除本地歌曲", "error");
    return;
  }

  if (selectedSongId === songId || readStoredSongId() === songId) {
    storeSongId("birthday");
  }

  songLibrary = getSongLibrary();
  refreshLibraryViews();
  showImportMessage(`已删除 ${formatSongTitleForMessage(deletedSong.title)}`, "success");
}

function toggleImportPanel() {
  importPanel.hidden = !importPanel.hidden;
  addSongBtn.textContent = importPanel.hidden ? "添加歌曲" : "收起添加";
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
  importSongBtn.disabled = enabled;
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
  if (importingSong) {
    return;
  }

  const startedAt = performance.now();
  setImportBusy(true);
  await waitForPaint();

  try {
    const song = parseImportedSong(songJsonInput.value, songLibrary);
    saveCustomSong(song);
    songLibrary = getSongLibrary();
    storeSongId(song.id);
    activeDifficulty = "all";
    songSearchInput.value = "";
    songJsonInput.value = "";
    refreshLibraryViews();
    await waitForThinkingMinimum(startedAt);
    showImportMessage(`已添加 ${song.title}`, "success");
  } catch (error) {
    await waitForThinkingMinimum(startedAt);
    showImportMessage(error.message, "error");
  } finally {
    setImportBusy(false);
  }
}

function hasActiveServiceWorkerController() {
  return Boolean("serviceWorker" in navigator && navigator.serviceWorker.controller);
}

function showUpdatePrompt(worker) {
  if (!worker || !hasActiveServiceWorkerController() || !updateToast) {
    return;
  }

  waitingServiceWorker = worker;
  updateToast.hidden = false;
  updateNowBtn.disabled = false;
  updateLaterBtn.disabled = false;
}

function trackInstallingServiceWorker(worker) {
  if (!worker) {
    return;
  }

  worker.addEventListener("statechange", () => {
    if (worker.state === "installed" && hasActiveServiceWorkerController()) {
      showUpdatePrompt(worker);
    }
  });
}

function setupServiceWorkerUpdatePrompt(registration) {
  if (!registration) {
    return;
  }

  if (registration.waiting && hasActiveServiceWorkerController()) {
    showUpdatePrompt(registration.waiting);
  }

  trackInstallingServiceWorker(registration.installing);
  registration.addEventListener("updatefound", () => {
    trackInstallingServiceWorker(registration.installing);
  });
}

function requestServiceWorkerUpdate() {
  if (!waitingServiceWorker) {
    return;
  }

  reloadRequestedForUpdate = true;
  updateNowBtn.disabled = true;
  updateLaterBtn.disabled = true;
  waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
}

function dismissServiceWorkerUpdate() {
  updateToast.hidden = true;
  waitingServiceWorker = null;
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadRequestedForUpdate || refreshingForUpdate) {
      return;
    }

    refreshingForUpdate = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(setupServiceWorkerUpdatePrompt)
      .catch((error) => {
        console.warn(`${APP_NAME} 离线缓存注册失败`, error);
      });
  });
}

aiPromptText.value = AI_SONG_PROMPT;
if (appVersionText) {
  appVersionText.textContent = `v${APP_VERSION}`;
}

songSearchInput.addEventListener("input", renderSongList);
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
updateNowBtn.addEventListener("click", requestServiceWorkerUpdate);
updateLaterBtn.addEventListener("click", dismissServiceWorkerUpdate);

refreshLibraryViews();
setupServiceWorker();
