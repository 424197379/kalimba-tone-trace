import { createLoopBoundaryRenderer } from "./phrase-boundary-renderer.js";
import { createPracticeFullscreen } from "./practice-fullscreen.js";
import { getSongDisplayTitle } from "./song-presentation.js";
import { selectKeyGuidance } from "./key-guidance.js";
import { createLoopRange, snapLoopBoundary, isBeatInLoop, getPreparationBeats, getPracticeTotalBeats } from "./practice-loop.js";
import { browserPreferenceStorage, readKeyWidth, effectiveKeyScale, saveKeyWidth, recordPractice, readSongSpeed, saveSongSpeed, readSongAccompaniment, saveSongAccompaniment } from "./practice-preferences.js";
import { DISPLAY_KEYS, NOTE_INDEX } from "./songs.js";
import { APP_VERSION, getSongAccompanimentProvider, getSongPracticeHint, getPracticeSongId, getEventTotalBeats, getSongBaseId, getSongVersionRank, getSongLibrary, readStoredSongId, storeSongId } from "./song-store.js";

const APP_NAME = "卡林巴循音";

    function buildSongEvents(song) {
      const sourceEvents = Array.isArray(song.events)
        ? song.events
        : song.steps.map(([name, beat, duration]) => ({
            beat,
            duration,
            notes: [{ name, role: "melody", judge: true, velocity: 1 }]
          }));

      return sourceEvents
        .map((sourceEvent, index) => {
          const notes = sourceEvent.notes
            .map((note) => {
              const lane = NOTE_INDEX.get(note.name);
              if (lane == null) {
                throw new Error(`${song.title} 包含未知音名: ${note.name}`);
              }
              return {
                name: note.name,
                lane,
                role: note.role || "melody",
                judge: Boolean(note.judge),
                velocity: Number.isFinite(Number(note.velocity)) ? Number(note.velocity) : 1
              };
            })
            .sort((a, b) => a.lane - b.lane);
          const markedJudgeNotes = notes.filter((note) => note.judge);
          const melodyJudgeNotes = markedJudgeNotes.filter((note) => note.role === "melody");
          const judgeNotes = song.judgementMode === "chord"
            ? markedJudgeNotes
            : melodyJudgeNotes.slice(0, 1);
          const primaryNote = judgeNotes[0] || notes.find((note) => note.role === "melody") || notes[0];
          const judgeLanes = [...new Set(judgeNotes.map((note) => note.lane))];

          return {
            id: index,
            name: primaryNote.name,
            lane: primaryNote.lane,
            beat: Number(sourceEvent.beat),
            duration: Number(sourceEvent.duration),
            judgeWindow: Number(sourceEvent.judgeWindow || 0),
            notes,
            judgeNotes,
            judgeLanes,
            minLane: notes[0].lane,
            laneSpan: notes[notes.length - 1].lane - notes[0].lane + 1,
            demoPlayed: false
          };
        })
        .sort((a, b) => a.beat - b.beat || a.id - b.id);
    }

    function getPracticeAccompanimentSource(song) {
      const provider = getSongAccompanimentProvider(song, getSongVariants(song || {}));
      return provider?.kind === "light" ? provider.song : null;
    }

    function getPracticeAccompanimentConfig(song) {
      return getPracticeAccompanimentSource(song)?.practiceAccompaniment || null;
    }

    function getSongAccompanimentSignature(song) {
      const provider = getSongAccompanimentProvider(song, getSongVariants(song || {}));
      if (!provider || provider.kind === "original") return null;
      const config = provider.config;
      if (!config || !Number.isFinite(config.volume) || config.volume < 0 || config.volume > 1 ||
          !Array.isArray(config.events) || !config.events.length || !config.events.every(event =>
        event && Number.isFinite(event.beat) && event.beat >= 0 && Number.isFinite(event.duration) && event.duration > 0 &&
        Array.isArray(event.notes) && event.notes.length && event.notes.every(note => note && NOTE_INDEX.has(note.name) &&
          Number.isFinite(note.velocity) && ["bass", "harmony", "melody", "arpeggio", "ornament"].includes(note.role)))) return null;
      // Exact melody/support content identity, not title, review prose, app version or a lossy hash.
      // The compatibility guard above supplies the real explicitly marked melody.
      const melody = buildSongEvents(song);
      return JSON.stringify([provider.kind === "light" ? "light-v1" : "imported-auto-v1", song.id, song.bpm, getPracticeTotalBeats(melody, song),
        melody.map(event => [event.name, event.beat, event.duration]), provider.song.id, config.volume,
        config.events.map(event => [event.beat, event.duration,
          event.notes.map(note => [note.name, note.role, note.velocity])])]);
    }

    function restoreSongAccompaniment() {
      const signature = getSongAccompanimentSignature(currentSong);
      const temporary = sessionAccompanimentChoices.get(currentSongId);
      const remembered = temporary
        ? { choice: temporary.choice === "off" || (signature && temporary.sourceSignature === signature)
          ? temporary.choice : "off" }
        : readSongAccompaniment(browserPreferenceStorage, currentSongId, signature);
      accompanimentEnabled = remembered.choice === accompanimentStyle && Boolean(signature);
      if (remembered.error) showKeyWidthStatus(remembered.error, true);
    }

    function getAccompanimentConfig(song, style = "original") {
      const provider = getSongAccompanimentProvider(song, getSongVariants(song || {}), style === "original");
      return provider && (style === "original" || provider.kind === style) ? provider.config : null;
    }

    function getDefaultAccompanimentEnabled(song) {
      // Every newly visited song is opt-in, including older default-on imports.
      return false;
    }

    function getDefaultAccompanimentVolume(song) {
      const config = getSongAccompanimentProvider(song, getSongVariants(song || {}))?.config;
      const volume = Number(config?.volume);
      return Number.isFinite(volume) ? clamp(volume, 0, 1) : 0.38;
    }

    function buildAutoAccompanimentEvents(song, style = "original") {
      const config = getAccompanimentConfig(song, style);
      if (!Array.isArray(config?.events) || !config.events.length) {
        return [];
      }

      return config.events
        .map((sourceEvent, index) => {
          if (!sourceEvent || typeof sourceEvent !== "object") {
            return null;
          }

          const beat = Number(sourceEvent.beat);
          const duration = Number(sourceEvent.duration);
          if (!Number.isFinite(beat) || beat < 0 || !Number.isFinite(duration) || duration <= 0) {
            return null;
          }

          const notes = Array.isArray(sourceEvent.notes)
            ? sourceEvent.notes
                .map((note) => {
                  const lane = NOTE_INDEX.get(note.name);
                  if (lane == null) {
                    return null;
                  }

                  const velocity = Number(note.velocity);
                  return {
                    name: note.name,
                    lane,
                    role: note.role || "harmony",
                    velocity: Number.isFinite(velocity) ? velocity : 0.45
                  };
                })
                .filter(Boolean)
                .sort((a, b) => a.lane - b.lane)
            : [];

          if (!notes.length) {
            return null;
          }

          return {
            id: index,
            beat,
            duration,
            notes,
            played: false
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.beat - b.beat || a.id - b.id);
    }

    function getInitialSongId() {
      const params = new URLSearchParams(window.location.search);
      const urlSongId = params.get("song");
      const storedSongId = readStoredSongId();
      return getPracticeSongId(songLibrary, urlSongId)
        || getPracticeSongId(songLibrary, storedSongId)
        || "birthday";
    }

    const songLibrary = getSongLibrary();
    let currentSongId = getInitialSongId();
    let currentSong = songLibrary[currentSongId];
    let songEvents = buildSongEvents(currentSong);
    let accompanimentStyle = getSongAccompanimentProvider(currentSong, getSongVariants(currentSong))?.kind || "original";
    let accompanimentEvents = buildAutoAccompanimentEvents(currentSong, accompanimentStyle);
    let songTotalBeats = getPracticeTotalBeats(songEvents, currentSong);
    let accompanimentTotalBeats = getEventTotalBeats(accompanimentEvents);
    const noteLaneInsetRatio = 0.08;

    let bpm = currentSong.bpm;
    let beatSeconds = 60 / bpm;
    const baseFallLeadSeconds = 3.15;
    let speedFactor = 1;
    let practiceLoopRange = null;
    let loopDragEdge = null;
    let loopDragPointerId = null;
    let loopDragRect = null;
    let loopDragWasPlaying = false;
    let loopDragWasDemo = false;
    let fallLeadSeconds = 4.25;
    const accompanimentVolumeStorageKey = "kalimba-accompaniment-volume";
    const keyScaleMin = 0.72;
    const keyScaleMax = 1.55;
    let keyScale = 1;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    let savedKeyPitch = null;
    let keyWidthDirty = false;
    let keyWidthSaveTimer = 0;
    let keyWidthStatusTimer = 0;
    const focusWindowSeconds = 0.28;
    const lateGraceSeconds = 0.36;
    const beamSwitchLeadSeconds = 0.12;
    const practiceOnsetStaleSeconds = 0.15;
    const practiceAudioReadyTimeoutMs = 8000;

    const laneGrid = document.getElementById("laneGrid");
    const targetStrip = document.getElementById("targetStrip");
    const noteLayer = document.getElementById("noteLayer");
    const keyRow = document.getElementById("keyRow");
    const boardTop = document.getElementById("boardTop");
    const boardShell = document.querySelector(".board-shell");
    const songProgress = document.getElementById("songProgress");
    const songElapsed = document.getElementById("songElapsed");
    const songRemaining = document.getElementById("songRemaining");
    const keyWidthStatus = document.getElementById("keyWidthStatus");
    const songProgressFill = document.getElementById("songProgressFill");
    const songProgressThumb = document.getElementById("songProgressThumb");
    const repeatBtn = document.getElementById("repeatBtn");
    const restartBtn = document.getElementById("restartBtn");
    const loopSelection = document.getElementById("loopSelection");
    const loopStartHandle = document.getElementById("loopStartHandle");
    const loopEndHandle = document.getElementById("loopEndHandle");
    const preparationCue = document.getElementById("preparationCue");

    const statusText = document.getElementById("statusText");
    const playbackNotice = document.getElementById("playbackNotice");
    const targetText = document.getElementById("targetText");
    const secureNotice = document.getElementById("secureNotice");

    const startBtn = document.getElementById("startBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const resetBtn = document.getElementById("resetBtn");
    const demoBtn = document.getElementById("demoBtn");
    const songSpeedBtn = document.getElementById("songSpeedBtn");
    const keyScaleBtn = document.getElementById("keyScaleBtn");
    const currentSongText = document.getElementById("currentSongText");
    const songVersionBtn = document.getElementById("songVersionBtn");
    const changeSongBtn = document.getElementById("changeSongBtn");
    const speedSlider = document.getElementById("speedSlider");
    const speedValue = document.getElementById("speedValue");
    const accompanimentBtn = document.getElementById("accompanimentBtn");
    const accompanimentStyleSelect = document.getElementById("accompanimentStyleSelect");
    const accompanimentVolumeWrap = document.getElementById("accompanimentVolumeWrap");
    const accompanimentVolumeSlider = document.getElementById("accompanimentVolumeSlider");
    const accompanimentVolumeValue = document.getElementById("accompanimentVolumeValue");
    const practiceTitle = document.getElementById("practiceTitle");
    const practiceHint = document.getElementById("practiceHint");
    const landscapeBtn = document.getElementById("landscapeBtn");
    const appVersionText = document.getElementById("appVersionText");
    const portraitPracticeQuery = window.matchMedia("(orientation: portrait) and (max-width: 760px)");

    function setCompactIcon(button, icon, label) {
      if (!button) {
        return;
      }

      button.dataset.compactIcon = icon;
      if (label) {
        button.setAttribute("aria-label", label);
        button.title = label;
      }
    }

    function applyStaticControlIcons() {
      setCompactIcon(startBtn, "弹", "自己弹，手机只播放选定伴奏");
      setCompactIcon(pauseBtn, "Ⅱ", "暂停");
      setCompactIcon(resetBtn, "↺", "重置");
      setCompactIcon(demoBtn, "听", "听示范，手机播放旋律和选定伴奏");
      setCompactIcon(changeSongBtn, "换", "换曲");
    }

    const laneEls = [];
    const keyEls = [];
    const noteEls = new Map();
    const beamEls = [];
    const loopBoundaryPreview = createLoopBoundaryRenderer({
      document, board: boardShell, boardTop,
      getEvents: () => songEvents,
      getTotalBeats: () => Math.max(songTotalBeats, accompanimentTotalBeats),
      getRange: () => practiceLoopRange,
      isCompact: isCompactPracticeView,
      renderNotes: renderEventNotesMarkup,
      laneCount: DISPLAY_KEYS.length,
      laneInset: noteLaneInsetRatio
    });

    const KALIMBA_SAMPLE_PATHS = new Map(
      DISPLAY_KEYS.map((note) => [note.name, `./assets/samples/${note.name.toLowerCase()}.mp3`])
    );

    let audioContext = null;
    let kalimbaBus = null;
    let kalimbaDry = null;
    let kalimbaWet = null;
    let kalimbaReverb = null;
    let kalimbaOutput = null;
    let kalimbaOutputNodes = [];
    const activeKalimbaVoices = new Set();
    const retiredKalimbaOutputs = new Set();
    let notePlaybackGeneration = 0;
    let rafId = 0;

    let practiceRunning = false;
    let demoMode = false;
    let preferredPlaybackMode = "practice";
    let playbackRequestId = 0;
    let pendingPlayback = null;
    let pausedSession = null;
    let resumePreparation = null;
    // A new pass owns a visible count-in before its first onset. Only a main
    // RAF arms that clock; layout/control renders cannot spend it beforehand.
    let passPreparation = null;
    let practiceStartAt = 0;
    let lastPracticeFrameSeconds = null;
    let pausedElapsed = 0;
    let activeBeamLane = null;
    const sessionAccompanimentChoices = new Map();
    let storedAccompanimentVolume = readStoredAccompanimentVolume();
    let accompanimentEnabled = false;
    let accompanimentVolume = storedAccompanimentVolume ?? getDefaultAccompanimentVolume(currentSong);
    let signalPeakUntil = 0;
    let activeInputUntil = 0;
    let seekingWithProgress = false;
    let progressSeekAtStart = false;
    let progressSeekPointerId = null;
    let progressSeekRect = null;
    let kalimbaSamplePreloadPromise = null;
    let fullscreenControl = null;

    const kalimbaSampleBuffers = new Map();
    const kalimbaSamplePromises = new Map();
    const kalimbaSampleFailures = new Set();

    let activeDetection = {
      lane: null,
      candidateLane: null,
      candidateNote: "--",
      note: "--",
      time: 0,
      held: false
    };

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function readStoredAccompanimentVolume() {
      try {
        const storedValue = localStorage.getItem(accompanimentVolumeStorageKey);
        if (storedValue == null) {
          return null;
        }
        const value = Number(storedValue);
        return Number.isFinite(value) ? clamp(value, 0, 1) : null;
      } catch (error) {
        return null;
      }
    }

    function storeAccompanimentVolume(volume) {
      storedAccompanimentVolume = volume;
      try {
        localStorage.setItem(accompanimentVolumeStorageKey, String(volume));
      } catch (error) {
        // Ignore private browsing or storage quota failures.
      }
    }

    function getTouchDistance(touches) {
      const [first, second] = touches;
      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    }

    function getKeyWidthReference() {
      // 用未旋转的网格尺寸计算中心间距，扣除内边距并计入列缝。
      const style = getComputedStyle(keyRow);
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const gap = parseFloat(style.columnGap) || 0;
      return keyRow.clientWidth - padding + gap;
    }

    function showKeyWidthStatus(text, failed = false) {
      clearTimeout(keyWidthStatusTimer);
      keyWidthStatus.textContent = text;
      keyWidthStatus.classList.toggle("failed", failed);
      keyWidthStatus.hidden = false;
      keyWidthStatusTimer = setTimeout(() => { keyWidthStatus.hidden = true; }, failed ? 6000 : 1800);
    }

    function persistKeyWidth() {
      clearTimeout(keyWidthSaveTimer);
      if (!keyWidthDirty) return;
      const result = saveKeyWidth(browserPreferenceStorage, savedKeyPitch);
      if (result.saved) keyWidthDirty = false;
      showKeyWidthStatus(result.error || "键宽已保存", Boolean(result.error));
    }

    function applyKeyScale(nextScale, persist = true) {
      keyScale = clamp(nextScale, keyScaleMin, keyScaleMax);
      document.documentElement.style.setProperty("--key-scale", keyScale.toFixed(5));
      keyScaleBtn.textContent = `键宽 ${Math.round(keyScale * 100)}%`;
      keyScaleBtn.classList?.toggle("key-width-adjusted", Math.abs(keyScale - 1) > 1e-5);
      keyScaleBtn.title = "双指捏合练习区调整琴键宽度，点击恢复 100%";
      setCompactIcon(keyScaleBtn, "↔", `琴键宽度 ${Math.round(keyScale * 100)}%，点击恢复 100%`);
      if (persist) {
        savedKeyPitch = getKeyWidthReference() * keyScale / 21;
        keyWidthDirty = true;
        clearTimeout(keyWidthSaveTimer);
        keyWidthSaveTimer = setTimeout(persistKeyWidth, 300);
      }
    }

    function restoreKeyScale() {
      const saved = readKeyWidth(browserPreferenceStorage);
      savedKeyPitch = saved.pitchCssPx ?? null;
      applyKeyScale(effectiveKeyScale(savedKeyPitch, getKeyWidthReference(), saved.scale ?? 1), false);
      if (saved.error) showKeyWidthStatus(saved.error, true);
    }

    function resetKeyScale() {
      applyKeyScale(1);
      persistKeyWidth();
    }

    function setupKeyScaleGesture() {
      boardShell.addEventListener("touchstart", (event) => {
        if (event.touches.length === 2) {
          pinchStartDistance = getTouchDistance(event.touches);
          pinchStartScale = keyScale;
        }
      }, { passive: true });

      boardShell.addEventListener("touchmove", (event) => {
        if (event.touches.length !== 2 || !pinchStartDistance) return;
        event.preventDefault();
        const nextDistance = getTouchDistance(event.touches);
        applyKeyScale(pinchStartScale * (nextDistance / pinchStartDistance));
      }, { passive: false });

      const finishPinch = (event) => {
        if (event.touches.length < 2) {
          pinchStartDistance = 0;
          persistKeyWidth();
        }
      };
      boardShell.addEventListener("touchend", finishPinch, { passive: true });
      boardShell.addEventListener("touchcancel", finishPinch, { passive: true });
      // 只重算显示比例，不能将临时窗口宽度覆盖到用户已校准的间距。
      new ResizeObserver(() => {
        if (savedKeyPitch !== null && !pinchStartDistance) {
          applyKeyScale(effectiveKeyScale(savedKeyPitch, getKeyWidthReference()), false);
        }
      }).observe(boardTop);
      window.addEventListener("pagehide", () => {
        persistKeyWidth();
        pausePractice({ freezeAtLastFrame: true });
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          persistKeyWidth();
          pausePractice({ freezeAtLastFrame: true });
        }
      });
    }

    function scheduleLayoutRefresh() {
      requestAnimationFrame(() => {
        renderBoard(currentPracticeTime());
      });
    }

    function setSoftwareLandscapeMode(enabled) {
      document.documentElement.classList.toggle("software-landscape", enabled);
      document.body.classList.toggle("software-landscape", enabled);
      scheduleLayoutRefresh();
    }

    function shouldAutoEnterLandscapeFromLibrary() {
      const params = new URLSearchParams(window.location.search);
      return params.get("fromLibrary") === "1" || params.get("landscape") === "1";
    }

    function applyInitialLandscapeMode() {
      if (shouldAutoEnterLandscapeFromLibrary() && portraitPracticeQuery.matches) {
        setSoftwareLandscapeMode(true);
      }
      fullscreenControl?.refresh();
    }

    function refreshLandscapeMode() {
      if (!portraitPracticeQuery.matches) {
        setSoftwareLandscapeMode(false);
        fullscreenControl?.refresh();
        return;
      }

      fullscreenControl?.refresh();
      if (document.documentElement.classList.contains("software-landscape")) {
        scheduleLayoutRefresh();
      }
    }

    function shouldUseLandscapeFullscreen() {
      return window.matchMedia("(orientation: landscape) and (max-height: 760px), (orientation: landscape) and (pointer: coarse)").matches;
    }

    async function requestFullscreenMode() {
      return fullscreenControl ? fullscreenControl.request() : false;
    }

    function getFullscreenPlaybackState() {
      if (pendingPlayback || resumePreparation || practiceRunning || demoMode) return "active";
      return pausedSession ? "paused" : "idle";
    }

    function startPracticeFromGesture() {
      if (shouldAutoEnterLandscapeFromLibrary() || shouldUseLandscapeFullscreen()) fullscreenControl?.requestOnStart();
      return startPractice();
    }

    function playDemoFromGesture() {
      if (shouldAutoEnterLandscapeFromLibrary() || shouldUseLandscapeFullscreen()) fullscreenControl?.requestOnStart();
      return playDemo();
    }

    async function requestNativeLandscapeLock() {
      if (!screen.orientation || !screen.orientation.lock) {
        return false;
      }

      for (const orientation of ["landscape-primary", "landscape"]) {
        try {
          await screen.orientation.lock(orientation);
          return true;
        } catch (error) {
          console.warn(`Landscape lock ${orientation} is not available.`, error);
        }
      }

      return false;
    }

    async function requestLandscapeMode() {
      const previousText = landscapeBtn.textContent;
      landscapeBtn.disabled = true;
      landscapeBtn.textContent = "正在进入横屏";

      await requestFullscreenMode();
      await requestNativeLandscapeLock();
      await new Promise((resolve) => setTimeout(resolve, 420));

      const needsSoftwareLandscape = portraitPracticeQuery.matches;
      setSoftwareLandscapeMode(needsSoftwareLandscape);

      if (needsSoftwareLandscape) {
        console.warn("Native landscape lock was not applied; using software landscape mode.");
      }

      landscapeBtn.textContent = previousText;
      landscapeBtn.disabled = false;
    }

    function applySongMeta() {
      const displayTitle = getSongDisplayTitle(currentSong);
      document.title = `卡林巴听弹练习 - ${displayTitle}`;
      practiceTitle.textContent = `${displayTitle}练习轨道`;
      practiceHint.textContent = getSongPracticeHint(currentSong, getPracticeAccompanimentSource(currentSong));
      if (currentSongText) {
        currentSongText.textContent = displayTitle;
        currentSongText.title = displayTitle;
      }
      applySongVersionControl();
      applyAccompanimentControl();
      songSpeedBtn.textContent = "1.0";
      songSpeedBtn.title = "恢复 1.0 倍原速";
      songSpeedBtn.setAttribute("aria-label", songSpeedBtn.title);
    }

    function getSongDefaultSpeedFactor() {
      return 1; // First-use and the explicit 1.0 marker share normal speed.
    }

    function getSongVariants(song) {
      const baseSongId = getSongBaseId(song);
      return Object.values(songLibrary)
        .filter((candidate) => getSongBaseId(candidate) === baseSongId)
        .sort((a, b) => getSongVersionRank(a) - getSongVersionRank(b) || a.id.localeCompare(b.id, "en"));
    }

    function applySongVersionControl() {
      if (!songVersionBtn) {
        return;
      }

      const variants = getSongVariants(currentSong);
      const hidden = true; // Physical practice is melody-only; chord sources stay available to backing.
      const label = currentSong.versionLabel || "主旋律版";
      const icon = getSongVersionRank(currentSong) > 0 ? "和" : "主";
      const title = hidden
        ? "当前曲目暂无其他版本"
        : `切换到 ${variants.find((song) => song.id !== currentSong.id)?.versionLabel || "其他版本"}`;
      songVersionBtn.hidden = hidden;
      songVersionBtn.disabled = hidden;
      songVersionBtn.textContent = label;
      setCompactIcon(songVersionBtn, icon, label);
      songVersionBtn.title = title;
    }

    function applyAccompanimentControl() {
      const hasAccompaniment = accompanimentEvents.length > 0;
      const provider = getSongAccompanimentProvider(currentSong, getSongVariants(currentSong));
      const hasChoice = provider && provider.kind !== "original";
      if (accompanimentStyleSelect) {
        accompanimentStyleSelect.hidden = !hasChoice;
        accompanimentStyleSelect.innerHTML = provider?.kind === "imported-auto"
          ? '<option value="off">无伴奏</option><option value="imported-auto">导入伴奏</option>'
          : '<option value="off">无伴奏</option><option value="light">轻伴奏</option>';
        accompanimentStyleSelect.value = accompanimentEnabled ? accompanimentStyle : "off";
      }
      if (accompanimentBtn) {
        accompanimentBtn.hidden = !hasAccompaniment || Boolean(hasChoice);
        accompanimentBtn.disabled = !hasAccompaniment;
        accompanimentBtn.classList.toggle("active", hasAccompaniment && accompanimentEnabled);
        accompanimentBtn.textContent = accompanimentEnabled ? "伴奏 开" : "伴奏 关";
        setCompactIcon(accompanimentBtn, "伴", accompanimentEnabled ? "伴奏已开启，点击关闭" : "伴奏已关闭，点击开启");
        accompanimentBtn.title = hasAccompaniment
          ? "切换自动伴奏播放"
          : "当前曲目暂无自动伴奏";
      }

      if (accompanimentVolumeWrap) {
        accompanimentVolumeWrap.hidden = !hasAccompaniment;
      }
      if (accompanimentVolumeSlider) {
        accompanimentVolumeSlider.disabled = !hasAccompaniment;
        accompanimentVolumeSlider.value = accompanimentVolume.toFixed(2);
      }
      if (accompanimentVolumeValue) {
        accompanimentVolumeValue.textContent = `${Math.round(accompanimentVolume * 100)}%`;
      }
    }

    function syncSongUrl(songId) {
      const url = new URL(window.location.href);
      url.searchParams.set("song", songId);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }

    function setCurrentSong(songId, options = {}) {
      currentSongId = getPracticeSongId(songLibrary, songId) || "birthday";
      storeSongId(currentSongId);
      if (options.syncUrl) {
        syncSongUrl(currentSongId);
      }
      currentSong = songLibrary[currentSongId];
      bpm = currentSong.bpm;
      beatSeconds = 60 / bpm;
      songEvents = buildSongEvents(currentSong);
      accompanimentStyle = getSongAccompanimentProvider(currentSong, getSongVariants(currentSong))?.kind || "original";
      accompanimentEvents = buildAutoAccompanimentEvents(currentSong, accompanimentStyle);
      restoreSongAccompaniment();
      accompanimentVolume = storedAccompanimentVolume ?? getDefaultAccompanimentVolume(currentSong);
      songTotalBeats = getPracticeTotalBeats(songEvents, currentSong);
      accompanimentTotalBeats = getEventTotalBeats(accompanimentEvents);
      applySongMeta();
      renderStaticBoard();
      resetPracticeState();
      const rememberedSpeed = readSongSpeed(browserPreferenceStorage, currentSongId);
      speedSlider.value = (rememberedSpeed.speed ?? 1).toFixed(2);
      applySpeed({ persist: false });
      resetPracticeState();
      if (rememberedSpeed.error) showKeyWidthStatus(rememberedSpeed.error, true);
    }

    function renderStaticBoard() {
      noteLayer.replaceChildren();
      noteEls.clear();

      if (!laneEls.length) {
        DISPLAY_KEYS.forEach((note, index) => {
          const lane = document.createElement("div");
          lane.className = "lane";
          lane.dataset.index = String(index);
          laneGrid.appendChild(lane);
          laneEls.push(lane);

          const beam = document.createElement("div");
          beam.className = "target-column";
          targetStrip.appendChild(beam);
          beamEls.push(beam);

          const key = document.createElement("div");
          const distance = Math.abs(index - 10);
          const height = Math.max(104, 172 - distance * 6);
          const mobileHeight = 68 + ((height - 104) / (172 - 104)) * 28;
          key.className = "key";
          key.tabIndex = 0;
          key.setAttribute("role", "button");
          key.setAttribute("aria-label", `Play ${note.name}`);
          key.style.height = `${height}px`;
          key.style.setProperty("--mobile-key-height", `${mobileHeight.toFixed(1)}%`);
          key.innerHTML = `<div class="key-note">${note.letter}</div><div class="key-degree">${renderDegreeMarkup(note)}</div>`;
          key.addEventListener("pointerdown", (event) => {
            if (event.button != null && event.button !== 0) {
              return;
            }
            event.preventDefault();
            key.focus({ preventScroll: true });
            playKeyPreview(note.name, index);
          });
          key.addEventListener("click", (event) => {
            event.preventDefault();
          });
          key.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              playKeyPreview(note.name, index);
            }
          });
          keyRow.appendChild(key);
          keyEls.push(key);
        });
      }

      songEvents.forEach((event) => {
        const noteEl = document.createElement("div");
        noteEl.className = "note";
        if (event.notes.length > 1) {
          noteEl.classList.add("chord-note");
        }
        noteEl.innerHTML = renderEventNotesMarkup(event, "note");
        noteLayer.appendChild(noteEl);
        noteEls.set(event.id, noteEl);
      });
    }

    function resetSongEvents() {
      songEvents.forEach((event) => {
        event.demoPlayed = false;
        const noteEl = noteEls.get(event.id);
        if (noteEl) {
          noteEl.className = "note";
          if (event.notes.length > 1) {
            noteEl.classList.add("chord-note");
          }
          noteEl.style.opacity = "0";
        }
      });
      resetAccompanimentEvents();
    }

    function resetAccompanimentEvents() {
      accompanimentEvents.forEach((event) => {
        event.played = false;
      });
    }

    function getAccompanimentTime(event) {
      return event.beat * getScaledBeatSeconds();
    }

    function getAccompanimentDurationSeconds(event) {
      return event.duration * getScaledBeatSeconds();
    }

    function syncAccompanimentEventsForSeek(seconds, { preservePlayed = false } = {}) {
      const progressSeconds = Math.max(0, seconds);
      accompanimentEvents.forEach((event) => {
        event.played = (preservePlayed && event.played) || getAccompanimentTime(event) < progressSeconds - 1e-7;
      });
    }

    function playAccompanimentEvents(seconds) {
      if (!admitPracticeFrame()) return;
      if (seekingWithProgress || !accompanimentEnabled || !accompanimentEvents.length || !audioContext || document.hidden || audioContext.state !== "running" || seconds < 0) {
        return;
      }

      accompanimentEvents.forEach((event) => {
        if (!isBeatInLoop(event.beat, practiceLoopRange) || event.played || seconds < getAccompanimentTime(event)) {
          return;
        }

        event.played = true;
        if (currentPracticeTime() - getAccompanimentTime(event) >= practiceOnsetStaleSeconds - 1e-7) return;
        const durationSeconds = Math.max(0.18, getAccompanimentDurationSeconds(event) * 0.86);
        event.notes.forEach((note) => {
          playKalimbaNote(note.name, durationSeconds, note.velocity * accompanimentVolume, getPracticeNoteTiming(getAccompanimentTime(event)));
        });
      });
    }

    function renderDegreeMarkup(note) {
      const topDots = note.dotsAbove ? "•".repeat(note.dotsAbove) : "&nbsp;";
      const bottomDots = note.dotsBelow ? "•".repeat(note.dotsBelow) : "&nbsp;";
      return [
        '<span class="degree-stack">',
        `<span class="degree-dots degree-dots-top">${topDots}</span>`,
        `<span class="degree-number">${note.degree}</span>`,
        `<span class="degree-dots degree-dots-bottom">${bottomDots}</span>`,
        '</span>'
      ].join("");
    }

    function formatTargetText(note) {
      if (!note) {
        return "--";
      }
      const topDots = note.dotsAbove ? "•".repeat(note.dotsAbove) : "";
      const bottomDots = note.dotsBelow ? "•".repeat(note.dotsBelow) : "";
      return `${note.letter} ${topDots}${note.degree}${bottomDots}`;
    }

    function formatEventTargetText(event) {
      if (!event || !event.judgeNotes.length) {
        return "--";
      }

      return event.judgeNotes
        .map((note) => formatTargetText(DISPLAY_KEYS[note.lane]))
        .join(" + ");
    }

    function getToneXPercent(lane, minLane, laneSpan) {
      const visibleLaneSpan = Math.max(0.01, laneSpan - noteLaneInsetRatio * 2);
      return ((lane - minLane + 0.5 - noteLaneInsetRatio) / visibleLaneSpan) * 100;
    }

    function renderEventNotesMarkup(event, modifier = "note") {
      const { minLane, laneSpan } = event;
      const alignFallingChordTones = modifier === "note" && event.notes.length > 1;
      const tones = event.notes
        .map((eventNote) => {
          const note = DISPLAY_KEYS[eventNote.lane];
          const classes = [
            `${modifier}-tone`,
            eventNote.role,
            eventNote.judge ? "judge-tone" : "support-tone"
          ].join(" ");
          const toneStyle = alignFallingChordTones
            ? ` style="--tone-x: ${getToneXPercent(eventNote.lane, minLane, laneSpan).toFixed(4)}%;"`
            : "";
          return [
            `<span class="${classes}" data-lane="${eventNote.lane}"${toneStyle}>`,
            `<span class="${modifier}-tone-letter">${note.letter}</span>`,
            `<span class="${modifier}-tone-degree">${renderDegreeMarkup(note)}</span>`,
            "</span>"
          ].join("");
        })
        .join("");

      return `<div class="${modifier}-tone-stack">${tones}</div>`;
    }

    function formatSongTime(seconds) {
      const safeSeconds = Math.max(0, Math.round(seconds || 0));
      const minutes = Math.floor(safeSeconds / 60);
      const remainSeconds = String(safeSeconds % 60).padStart(2, "0");
      return `${minutes}:${remainSeconds}`;
    }

    function getSongProgressDuration() {
      return Math.max(0.1, getSongEndSeconds());
    }

    function renderSongProgress(seconds) {
      if (!songProgress || !songProgressFill || !songProgressThumb) {
        return;
      }

      const duration = getSongProgressDuration();
      const loopStartSeconds = (practiceLoopRange?.startBeat || 0) * getScaledBeatSeconds();
      const progressSeconds = clamp(Math.max(seconds, loopStartSeconds), 0, duration);
      const progressRatio = duration ? progressSeconds / duration : 0;
      const progressPercent = `${(progressRatio * 100).toFixed(3)}%`;
      const valueText = `${formatSongTime(progressSeconds)} / ${formatSongTime(duration)}`;

      songProgress.style.setProperty("--song-progress-percent", progressPercent);
      songProgressFill.style.width = progressPercent;
      songProgressThumb.style.left = progressPercent;
      songProgress.setAttribute("aria-valuemax", String(Math.round(duration)));
      songProgress.setAttribute("aria-valuenow", String(Math.round(progressSeconds)));
      songProgress.setAttribute("aria-valuetext", valueText);
      songProgress.title = valueText;
      renderLoopControls();
      renderPreparationCue(seconds);
      songElapsed.textContent = formatSongTime(progressSeconds);
      songRemaining.textContent = `剩余 ${formatSongTime(duration - progressSeconds)}`;
    }

    function renderLoopControls() {
      const active = Boolean(practiceLoopRange);
      repeatBtn.setAttribute("aria-pressed", String(active));
      repeatBtn.classList.toggle("active", active);
      repeatBtn.title = active ? "关闭分段练习" : "开启分段练习";
      if (repeatBtn.textContent !== "分段练习") repeatBtn.textContent = "分段练习";
      repeatBtn.setAttribute("aria-label", repeatBtn.title);
      for (const element of [loopSelection, loopStartHandle, loopEndHandle]) element.hidden = !active;
      if (!active) return;
      const duration = getSongProgressDuration();
      const start = practiceLoopRange.startBeat * getScaledBeatSeconds();
      const end = practiceLoopRange.endBeat * getScaledBeatSeconds();
      loopSelection.style.left = `${start / duration * 100}%`;
      loopSelection.style.width = `${(end - start) / duration * 100}%`;
      for (const [handle, value, label] of [[loopStartHandle, start, "循环起点"], [loopEndHandle, end, "循环终点"]]) {
        handle.style.left = `${value / duration * 100}%`;
        handle.setAttribute("aria-valuemin", "0");
        handle.setAttribute("aria-valuemax", String(duration));
        handle.setAttribute("aria-valuenow", String(value));
        handle.setAttribute("aria-valuetext", formatSongTime(value));
        handle.title = `${label} ${formatSongTime(value)}，拖动调整`;
      }
    }

    function renderPreparationCue(seconds) {
      if (resumePreparation) {
        const elapsed = resumePreparation.startedAt == null ? 0 : (performance.now() - resumePreparation.startedAt) / 1000;
        const remaining = Math.max(0, resumePreparation.duration - elapsed);
        preparationCue.hidden = false;
        preparationCue.textContent = String(Math.max(1, Math.ceil(remaining / getScaledBeatSeconds() - 1e-7)));
        return;
      }
      const target = (practiceLoopRange?.startBeat || 0) * getScaledBeatSeconds();
      const beats = Math.ceil((target - seconds) / getScaledBeatSeconds() - 1e-7);
      preparationCue.hidden = beats <= 0 || (!shouldLoop() && pauseBtn.disabled && statusText.textContent !== "已暂停");
      if (!preparationCue.hidden) preparationCue.textContent = String(beats);
    }

    function beginPassPreparation() {
      passPreparation = { requestId: playbackRequestId };
      lastPracticeFrameSeconds = pausedElapsed;
    }

    function prepareLoopStart({ preservePending = false } = {}) {
      const savedSession = pausedSession;
      if (!preservePending) {
        cancelPracticeContinuation();
        clearPracticeInteractions();
      }
      const start = practiceLoopRange.startBeat * getScaledBeatSeconds();
      pausedElapsed = start - getSessionLeadSeconds();
      if (savedSession && !practiceRunning && !demoMode) {
        pausedSession = { mode: savedSession.mode, seconds: start };
        updatePauseControl();
        setStatus("已暂停");
      } else if (!shouldLoop() && ["练习结束", "示范结束"].includes(statusText.textContent)) {
        setStatus("待开始");
      }
      if (shouldLoop()) {
        practiceStartAt = performance.now() - pausedElapsed * 1000;
        beginPassPreparation();
      }
      lastPracticeFrameSeconds = pausedElapsed;
      resetSongEvents();
      resetDetectionReadout();
      setActiveBeamLane(null);
      renderBoard(pausedElapsed);
    }

    function togglePracticeLoop() {
      // Admit the old clock before this control can rebase or consume onsets.
      admitPracticeFrame();
      if (practiceLoopRange) {
        const start = practiceLoopRange.startBeat * getScaledBeatSeconds();
        const seconds = currentPracticeTime();
        practiceLoopRange = null;
        // Leaving during the preparation countdown must not replay the preceding phrase.
        const playedMelody = new Set(songEvents.filter(event => event.demoPlayed).map(event => event.id));
        const playedBacking = new Set(accompanimentEvents.filter(event => event.played).map(event => event.id));
        seekToSongTime(Math.max(seconds, start), { render: false, prepareStart: false });
        songEvents.forEach(event => { if (playedMelody.has(event.id)) event.demoPlayed = true; });
        accompanimentEvents.forEach(event => { if (playedBacking.has(event.id)) event.played = true; });
      } else {
        practiceLoopRange = createLoopRange(songEvents, Math.max(songTotalBeats, accompanimentTotalBeats), currentPracticeTime() / getScaledBeatSeconds());
        prepareLoopStart();
      }
      renderBoard(currentPracticeTime());
    }

    function startLoopDrag(event, edge) {
      if (!practiceLoopRange || event.isPrimary === false || (event.button != null && event.button !== 0)) return;
      event.preventDefault();
      admitPracticeFrame();
      const wasPlaying = shouldLoop();
      const wasDemo = demoMode || resumePreparation?.mode === "demo";
      pausePractice();
      const savedSession = pausedSession;
      cancelPracticeContinuation();
      pausedSession = savedSession;
      updatePauseControl();
      loopDragEdge = edge;
      loopDragPointerId = event.pointerId;
      loopDragRect = songProgress.getBoundingClientRect();
      loopDragWasPlaying = wasPlaying;
      loopDragWasDemo = wasDemo;
      event.currentTarget.focus({ preventScroll: true });
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Window listeners handle capture loss. */ }
      if (typeof loopBoundaryPreview !== "undefined") loopBoundaryPreview.show(edge);
    }

    function moveLoopDrag(event) {
      if (!loopDragEdge || event.pointerId !== loopDragPointerId || !practiceLoopRange) return;
      event.preventDefault();
      const rotated = document.documentElement.classList.contains("software-landscape");
      const offset = rotated ? event.clientY - loopDragRect.top : event.clientX - loopDragRect.left;
      const length = rotated ? loopDragRect.height : loopDragRect.width;
      const beat = clamp(offset / Math.max(1, length), 0, 1) * getSongProgressDuration() / getScaledBeatSeconds();
      const nextRange = snapLoopBoundary(songEvents, Math.max(songTotalBeats, accompanimentTotalBeats), practiceLoopRange, loopDragEdge, beat);
      const changed = nextRange.startBeat !== practiceLoopRange.startBeat || nextRange.endBeat !== practiceLoopRange.endBeat;
      practiceLoopRange = nextRange;
      if (changed && pausedSession) {
        // Editing the phrase intentionally selects a fresh A attack. A lifecycle
        // stop during the drag must retain this target, never its pointerup intent.
        pausedSession.seconds = practiceLoopRange.startBeat * getScaledBeatSeconds();
        pausedElapsed = pausedSession.seconds - getSessionLeadSeconds();
        lastPracticeFrameSeconds = pausedElapsed;
        resetSongEvents();
        renderBoard(pausedElapsed);
      }
      renderLoopControls();
      if (typeof loopBoundaryPreview !== "undefined") loopBoundaryPreview.show(loopDragEdge);
    }

    function finishLoopDrag(event) {
      if (!loopDragEdge || event.pointerId !== loopDragPointerId) return;
      if (typeof loopBoundaryPreview !== "undefined") loopBoundaryPreview.clear();
      loopDragEdge = null;
      loopDragPointerId = null;
      loopDragRect = null;
      if (!practiceLoopRange || document.hidden) return;
      // Cancellation keeps the visible selection but never resumes unexpectedly.
      demoMode = loopDragWasPlaying && loopDragWasDemo && event.type !== "pointercancel";
      practiceRunning = loopDragWasPlaying && !loopDragWasDemo && event.type !== "pointercancel";
      updatePauseControl();
      prepareLoopStart();
      if (shouldLoop()) startLoop();
      loopDragWasPlaying = false;
    }

    function handleLoopKeydown(event, edge) {
      if (!practiceLoopRange) return;
      if (event.key === "Escape") {
        event.preventDefault();
        togglePracticeLoop();
        repeatBtn.focus();
        return;
      }
      const total = Math.max(songTotalBeats, accompanimentTotalBeats);
      const boundaries = [...new Set([...songEvents.map(note => note.beat), total])].sort((a, b) => a - b);
      const current = edge === "start" ? practiceLoopRange.startBeat : practiceLoopRange.endBeat;
      let beat;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") beat = boundaries.find(value => value > current + 1e-7) ?? total;
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") beat = boundaries.findLast(value => value < current - 1e-7) ?? 0;
      else if (event.key === "Home") beat = 0;
      else if (event.key === "End") beat = total;
      else return;
      event.preventDefault();
      admitPracticeFrame();
      practiceLoopRange = snapLoopBoundary(songEvents, total, practiceLoopRange, edge, beat);
      prepareLoopStart();
    }

    function setStatus(text) {
      if (statusText.textContent !== text) {
        statusText.textContent = text;
      }
      // The metadata row is hidden in compact/fullscreen layouts. Keep every
      // paused state and its recovery action visible on the practice board too.
      if (typeof playbackNotice !== "undefined" && playbackNotice) {
        const paused = Boolean(pausedSession) && !shouldLoop() && !pendingPlayback;
        const completed = !shouldLoop() && !pendingPlayback && ["练习结束", "示范结束"].includes(text);
        const visible = paused || completed;
        const message = paused ? `${text}，点“继续”恢复` : completed ? text : "";
        if (playbackNotice.hidden === visible) playbackNotice.hidden = !visible;
        if (playbackNotice.textContent !== message) playbackNotice.textContent = message;
      }
    }

    function showNotice(message) {
      secureNotice.style.display = "block";
      secureNotice.innerHTML = message;
    }

    function hideNotice() {
      secureNotice.style.display = "none";
    }

    function currentPracticeTime() {
      if (resumePreparation) return resumePreparation.seconds;
      // Holding the absolute beginning must not spend the user's count-in.
      if (seekingWithProgress && progressSeekAtStart) return pausedElapsed;
      if (!practiceRunning && !demoMode || passPreparation) {
        return pausedElapsed;
      }
      return (performance.now() - practiceStartAt) / 1000;
    }

    function clearHighlights() {
      laneEls.forEach((el) => el.classList.remove("expected", "heard", "soft", "wrong"));
      keyEls.forEach((el) => el.classList.remove("expected", "heard", "soft", "wrong"));
    }

    function setActiveBeamLane(index) {
      const indexes = Array.isArray(index) ? index : index == null ? [] : [index];
      const key = indexes.join("|");
      if (activeBeamLane === key) {
        return;
      }

      beamEls.forEach((beam) => beam.classList.remove("active"));
      activeBeamLane = key;
      indexes.forEach((lane) => {
        if (beamEls[lane]) {
          beamEls[lane].classList.add("active");
        }
      });
    }

    function highlightLane(index, kind) {
      if (index == null || !laneEls[index] || !keyEls[index]) {
        return;
      }
      laneEls[index].classList.add(kind);
      keyEls[index].classList.add(kind);
    }

    function getScaledBeatSeconds() {
      return beatSeconds / speedFactor;
    }

    function isCompactPracticeView() {
      // 竖屏手机的软件旋转也使用现有横屏预告时长，避免按桌面轨道堆叠音块。
      return document.documentElement.classList.contains("software-landscape")
        || window.matchMedia("(orientation: landscape) and (max-height: 560px)").matches;
    }

    function getVisualFallLeadSeconds() {
      if (!isCompactPracticeView()) {
        return fallLeadSeconds;
      }

      const boardHeight = boardTop.clientHeight || 160;
      const readableLead = clamp(boardHeight / 86, 1.55, 2.15);
      return Math.min(fallLeadSeconds, readableLead);
    }

    function getSessionLeadSeconds() {
      return getPreparationBeats(getScaledBeatSeconds(), getVisualFallLeadSeconds()) * getScaledBeatSeconds();
    }

    function getEventTime(event) {
      return event.beat * getScaledBeatSeconds();
    }

    function getEventDurationSeconds(event) {
      return event.duration * getScaledBeatSeconds();
    }

    function getEventJudgeWindowSeconds(event) {
      const windowBeats = Number(event.judgeWindow || 0);
      if (windowBeats > 0) {
        return Math.max(focusWindowSeconds, windowBeats * getScaledBeatSeconds());
      }
      return focusWindowSeconds;
    }

    function getSongEndSeconds() {
      return Math.max(songTotalBeats, accompanimentTotalBeats) * getScaledBeatSeconds() + 0.9;
    }

    function getProgressSeekSeconds(event) {
      if (!songProgress) {
        return 0;
      }
      const targetRect = progressSeekRect || songProgress.getBoundingClientRect();
      // The portrait practice layout rotates the track 90 degrees clockwise.
      const rotated = document.documentElement.classList.contains("software-landscape");
      const position = rotated ? event.clientY - targetRect.top : event.clientX - targetRect.left;
      const length = rotated ? targetRect.height : targetRect.width;
      const ratio = length ? clamp(position / length, 0, 1) : 0;
      return ratio * getSongProgressDuration();
    }

    function resetDetectionReadout() {
      activeDetection = {
        lane: null,
        candidateLane: null,
        candidateNote: "--",
        note: "--",
        time: 0,
        held: false
      };
      activeInputUntil = 0;
    }

    function syncSongEventsForSeek(seconds) {
      const progressSeconds = Math.max(0, seconds);

      songEvents.forEach((event) => {
        const eventTime = getEventTime(event);
        const beforeSeekPoint = eventTime < progressSeconds - 1e-7;
        event.demoPlayed = demoMode && beforeSeekPoint;
      });
    }

    function seekToSongTime(seconds, { render = true, prepareStart = true } = {}) {
      const savedSession = pausedSession || pendingPlayback;
      const preparingMode = resumePreparation?.mode;
      cancelPracticeContinuation();
      clearPracticeInteractions({ keepProgressSeek: true });
      silenceKalimbaAudio();
      const seekSeconds = clamp(seconds, 0, getSongProgressDuration());
      const fromBeginning = prepareStart && seekSeconds === 0;
      if (fromBeginning && preparingMode) {
        demoMode = preparingMode === "demo";
        practiceRunning = !demoMode;
      }
      const wasPlaying = practiceRunning || demoMode;
      if (practiceLoopRange && (fromBeginning || !isBeatInLoop(seekSeconds / getScaledBeatSeconds(), practiceLoopRange))) {
        practiceLoopRange = null;
        renderLoopControls();
      }
      progressSeekAtStart = fromBeginning && seekingWithProgress;
      pausedElapsed = fromBeginning ? -getSessionLeadSeconds() : seekSeconds;
      if (savedSession && !wasPlaying) {
        pausedSession = { mode: savedSession.mode, seconds: seekSeconds };
        updatePauseControl();
        setStatus("已暂停");
      } else if (!wasPlaying && ["练习结束", "示范结束"].includes(statusText.textContent)) {
        setStatus("待开始");
      }
      lastPracticeFrameSeconds = pausedElapsed;
      if (wasPlaying) {
        practiceStartAt = performance.now() - pausedElapsed * 1000;
        if (fromBeginning) {
          beginPassPreparation();
          updatePauseControl();
          setStatus(demoMode ? "示范准备" : "准备");
          startLoop();
        }
      }

      syncSongEventsForSeek(seekSeconds);
      syncAccompanimentEventsForSeek(seekSeconds);
      resetDetectionReadout();
      if (render) renderBoard(pausedElapsed);
    }

    function handleProgressPointer(event) {
      seekToSongTime(getProgressSeekSeconds(event));
    }

    function startProgressSeek(event) {
      if (!songProgress || (event.button != null && event.button !== 0) || event.isPrimary === false) {
        return;
      }

      seekingWithProgress = true;
      progressSeekPointerId = event.pointerId;
      progressSeekRect = songProgress.getBoundingClientRect();
      songProgress.classList.add("seeking");
      songProgress.focus({ preventScroll: true });
      if (songProgress.setPointerCapture) {
        try {
          songProgress.setPointerCapture(event.pointerId);
        } catch (error) {
          // Some mobile browsers reject capture after scroll/zoom gestures; window listeners still handle the drag.
        }
      }
      event.preventDefault();
      handleProgressPointer(event);
    }

    function moveProgressSeek(event) {
      if (!seekingWithProgress || event.pointerId !== progressSeekPointerId) {
        return;
      }

      event.preventDefault();
      handleProgressPointer(event);
    }

    function finishProgressSeek(event) {
      if (!seekingWithProgress || event.pointerId !== progressSeekPointerId) {
        return;
      }

      // Cancellation/backgrounding at the held beginning must never start a
      // delayed count-in. Ordinary nonzero seek releases retain their behavior.
      if (progressSeekAtStart && (event.type === "pointercancel" || document.hidden || (audioContext && audioContext.state !== "running"))) {
        pausePractice({ freezeAtLastFrame: true });
        return;
      }
      // A late release must still preserve a genuine melody stall's checkpoint
      // before retiring any backing suppressed since the last visible frame.
      if (!admitPracticeFrame()) return;
      clearPracticeInteractions();
    }

    function handleProgressKeydown(event) {
      const duration = getSongProgressDuration();
      const currentSeconds = clamp(currentPracticeTime(), 0, duration);
      const smallStep = event.shiftKey ? 10 : 2;
      let nextSeconds = null;

      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        nextSeconds = currentSeconds - smallStep;
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        nextSeconds = currentSeconds + smallStep;
      } else if (event.key === "Home") {
        nextSeconds = 0;
      } else if (event.key === "End") {
        nextSeconds = duration;
      }

      if (nextSeconds == null) {
        return;
      }

      event.preventDefault();
      seekToSongTime(nextSeconds);
    }

    async function ensureAudioContext() {
      if (document.hidden) return audioContext;
      if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("AudioContext is not supported");
        }
        audioContext = new AudioContextClass();
        audioContext.addEventListener("statechange", handleAudioContextStateChange);
      }
      if (audioContext.state === "suspended" || audioContext.state === "interrupted") {
        await audioContext.resume();
      }
      preloadKalimbaSamples();
      return audioContext;
    }

    async function preparePracticeAudio(requestId) {
      // Bound startup without poisoning the shared sample cache. A late decode
      // may populate it, but only a still-current request may start transport.
      let timer;
      try {
        await Promise.race([
          (async () => {
            await ensureAudioContext();
            if (requestId !== playbackRequestId || document.hidden) return;
            await preloadKalimbaSamples();
            // Build the dry/wet output before starting the score clock. The
            // first attack must not pay for a cold reverb graph on the RAF path.
            if (requestId === playbackRequestId && !document.hidden && audioContext?.state === "running") ensureKalimbaOutput();
          })(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Audio preparation timed out")), practiceAudioReadyTimeoutMs);
          })
        ]);
        return requestId === playbackRequestId && !document.hidden;
      } finally {
        clearTimeout(timer);
      }
    }

    function getPracticeNoteTiming(onsetSeconds) {
      return {
        generation: notePlaybackGeneration,
        requestId: playbackRequestId,
        // Use the nominal onset, never a new budget starting at a late RAF.
        expiresAt: practiceStartAt + (onsetSeconds + practiceOnsetStaleSeconds) * 1000
      };
    }

    function isPracticeNoteCurrent(timing) {
      if (!timing) return true; // Manual key audition has no transport deadline.
      if (timing.generation !== notePlaybackGeneration || timing.requestId !== playbackRequestId
        || (!practiceRunning && !demoMode) || resumePreparation || document.hidden || audioContext?.state !== "running") return false;
      if (performance.now() >= timing.expiresAt - 1e-4) {
        // A late decode/short foreground hitch must not stop an otherwise
        // healthy score. Drop only this old attack; never burst stale audio or
        // replay a partial chord. The frame guard owns material interruptions.
        return false;
      }
      return true;
    }

    function admitPracticeFrame() {
      if (resumePreparation || (!practiceRunning && !demoMode)) return true;
      const seconds = currentPracticeTime();
      // 150 ms is an AUDIO freshness budget, not a transport-failure threshold.
      // Visible-browser jitter below one second advances to the live score;
      // old sounds are retired separately. Keep an explicit checkpoint only
      // after a material frame gap also crosses an unshown stale onset.
      const materialFrameGapSeconds = 1;
      if (lastPracticeFrameSeconds == null || seconds - lastPracticeFrameSeconds < materialFrameGapSeconds - 1e-7) return true;
      const stale = (event, onset, upcoming) => upcoming && isBeatInLoop(event.beat, practiceLoopRange)
        && seconds - onset >= practiceOnsetStaleSeconds - 1e-7;
      const missedMelody = songEvents.some(event => stale(event, getEventTime(event),
        demoMode ? !event.demoPlayed : lastPracticeFrameSeconds != null && getEventTime(event) > lastPracticeFrameSeconds + 1e-7));
      // Progress dragging deliberately suppresses backing, but melody still
      // advances and must retain its ordinary stale-onset protection.
      const missedBacking = !seekingWithProgress && accompanimentEnabled && audioContext?.state === "running" && accompanimentEvents.some(event => stale(event, getAccompanimentTime(event), !event.played));
      if (!missedMelody && !missedBacking) return true;
      pausePractice({ freezeAtLastFrame: true });
      setStatus("播放卡顿，已暂停");
      return false;
    }

    function handleAudioContextStateChange() {
      if (audioContext?.state !== "running") pausePractice({ freezeAtLastFrame: true });
    }

    function registerKalimbaVoice(sources, nodes) {
      const voice = { sources, nodes };
      activeKalimbaVoices.add(voice);
      let remaining = sources.length;
      sources.forEach(source => {
        source.onended = () => {
          remaining -= 1;
          if (remaining === 0) {
            activeKalimbaVoices.delete(voice);
            nodes.forEach(node => { try { node?.disconnect(); } catch { /* Already released. */ } });
          }
        };
      });
    }

    function silenceKalimbaAudio() {
      // Invalidate decode continuations even when there are no audible voices yet.
      notePlaybackGeneration += 1;
      const running = audioContext?.state === "running";
      const now = audioContext?.currentTime || 0;
      const finish = retired => {
        clearTimeout(retired.timer);
        try {
          retired.output?.gain.cancelScheduledValues(now);
          retired.output?.gain.setValueAtTime(0, now);
        } catch { /* A closed context is already silent. */ }
        retired.voices.forEach(voice => {
          voice.sources.forEach(source => { try { source.stop(now); } catch { /* Already ended. */ } });
          voice.nodes.forEach(node => { try { node?.disconnect(); } catch { /* Already released. */ } });
        });
        retired.nodes.forEach(node => { try { node?.disconnect(); } catch { /* Already released. */ } });
        retiredKalimbaOutputs.delete(retired);
      };
      // Audio-time fades cannot finish in a suspended context. Permanently detach
      // old dry AND wet graphs; resuming later must never reopen an old tail.
      if (!running) [...retiredKalimbaOutputs].forEach(retired => retired.finish());
      if (!kalimbaOutput && !activeKalimbaVoices.size) return;
      const retired = { output: kalimbaOutput, nodes: kalimbaOutputNodes,
        voices: [...activeKalimbaVoices], timer: 0 };
      retired.finish = () => finish(retired);
      retiredKalimbaOutputs.add(retired);
      activeKalimbaVoices.clear();
      kalimbaBus = kalimbaDry = kalimbaWet = kalimbaReverb = kalimbaOutput = null;
      kalimbaOutputNodes = [];
      if (!running || !retired.output) {
        finish(retired);
        return;
      }
      const gain = retired.output.gain;
      if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
      else {
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
      }
      gain.linearRampToValueAtTime(0, now + 0.035);
      retired.voices.forEach(voice => voice.sources.forEach(source => {
        try { source.stop(now + 0.04); } catch { /* Already ended. */ }
      }));
      // Cleanup is also triggered synchronously on an audio interruption.
      retired.timer = setTimeout(retired.finish, 60);
    }

    function createKalimbaImpulseResponse(context) {
      const length = Math.floor(context.sampleRate * 0.55);
      const impulse = context.createBuffer(2, length, context.sampleRate);

      for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let index = 0; index < length; index += 1) {
          const t = index / length;
          const earlyTap = index < context.sampleRate * 0.035 ? 0.6 : 1;
          const woodFlutter = Math.sin(index * 0.013 + channel * 1.7) * 0.18 + 0.82;
          data[index] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.1) * earlyTap * woodFlutter;
        }
      }

      return impulse;
    }

    function ensureKalimbaOutput() {
      if (!audioContext || kalimbaBus) {
        return;
      }

      kalimbaBus = audioContext.createGain();
      kalimbaDry = audioContext.createGain();
      kalimbaWet = audioContext.createGain();
      kalimbaReverb = audioContext.createConvolver();

      const masterTone = audioContext.createBiquadFilter();
      masterTone.type = "lowpass";
      masterTone.frequency.setValueAtTime(6200, audioContext.currentTime);
      masterTone.Q.setValueAtTime(0.42, audioContext.currentTime);

      const safety = audioContext.createDynamicsCompressor();
      safety.threshold.setValueAtTime(-12, audioContext.currentTime);
      safety.knee.setValueAtTime(20, audioContext.currentTime);
      safety.ratio.setValueAtTime(3, audioContext.currentTime);
      safety.attack.setValueAtTime(0.004, audioContext.currentTime);
      safety.release.setValueAtTime(0.12, audioContext.currentTime);

      kalimbaBus.gain.setValueAtTime(0.86, audioContext.currentTime);
      kalimbaDry.gain.setValueAtTime(0.82, audioContext.currentTime);
      kalimbaWet.gain.setValueAtTime(0.16, audioContext.currentTime);
      kalimbaReverb.buffer = createKalimbaImpulseResponse(audioContext);

      kalimbaBus.connect(kalimbaDry).connect(masterTone);
      kalimbaBus.connect(kalimbaReverb).connect(kalimbaWet).connect(masterTone);
      kalimbaOutput = audioContext.createGain();
      kalimbaOutput.gain.setValueAtTime(1, audioContext.currentTime);
      masterTone.connect(safety).connect(kalimbaOutput).connect(audioContext.destination);
      kalimbaOutputNodes = [kalimbaBus, kalimbaDry, kalimbaWet, kalimbaReverb, masterTone, safety, kalimbaOutput];
    }

    async function loadKalimbaSampleBuffer(noteName) {
      const samplePath = KALIMBA_SAMPLE_PATHS.get(noteName);
      if (!audioContext || !samplePath || kalimbaSampleFailures.has(noteName)) {
        return null;
      }

      if (kalimbaSampleBuffers.has(noteName)) {
        return kalimbaSampleBuffers.get(noteName);
      }

      if (kalimbaSamplePromises.has(noteName)) {
        return kalimbaSamplePromises.get(noteName);
      }

      const promise = fetch(samplePath, { headers: { Range: "bytes=0-" } })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Sample ${samplePath} returned ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
        .then((buffer) => {
          kalimbaSampleBuffers.set(noteName, buffer);
          kalimbaSamplePromises.delete(noteName);
          return buffer;
        })
        .catch((error) => {
          kalimbaSampleFailures.add(noteName);
          kalimbaSamplePromises.delete(noteName);
          console.warn(`${APP_NAME} sample fallback for ${noteName}`, error);
          return null;
        });

      kalimbaSamplePromises.set(noteName, promise);
      return promise;
    }

    function preloadKalimbaSamples() {
      if (!audioContext) {
        return Promise.resolve([]);
      }

      if (!kalimbaSamplePreloadPromise) {
        kalimbaSamplePreloadPromise = Promise.all(
          DISPLAY_KEYS.map((note) => loadKalimbaSampleBuffer(note.name))
        );
      }

      return kalimbaSamplePreloadPromise;
    }

    function playDecodedKalimbaSample(noteName, buffer, velocity = 1, timing = null) {
      if (!Number.isFinite(velocity) || velocity <= 0) return true;
      if (!audioContext || !buffer || document.hidden || audioContext.state !== "running") {
        return false;
      }

      ensureKalimbaOutput();
      if (timing && !isPracticeNoteCurrent(timing)) return true;
      if (!kalimbaBus) {
        return false;
      }

      const now = audioContext.currentTime;
      const source = audioContext.createBufferSource();
      const voice = audioContext.createGain();
      const pan = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;
      const noteIndex = NOTE_INDEX.get(noteName);

      source.buffer = buffer;
      voice.gain.setValueAtTime(0.92 * clamp(velocity, 0, 1.2), now);

      if (pan) {
        pan.pan.setValueAtTime(((noteIndex ?? 10) - 10) / 34, now);
        source.connect(voice).connect(pan).connect(kalimbaBus);
      } else {
        source.connect(voice).connect(kalimbaBus);
      }

      registerKalimbaVoice([source], [source, voice, pan]);
      source.start(now);
      source.stop(now + buffer.duration + 0.04);
      return true;
    }

    async function playKalimbaSample(noteName, velocity = 1, generation = notePlaybackGeneration, timing = null) {
      const buffer = await loadKalimbaSampleBuffer(noteName);
      if (generation !== notePlaybackGeneration || document.hidden || audioContext?.state !== "running") return true;
      if (!isPracticeNoteCurrent(timing)) return true;
      return playDecodedKalimbaSample(noteName, buffer, velocity, timing);
    }

    async function playKalimbaNote(noteName, durationSeconds, velocity = 1, timing = null) {
      if (!audioContext || document.hidden || audioContext.state !== "running") return false;
      const generation = notePlaybackGeneration;
      const playedSample = await playKalimbaSample(noteName, velocity, generation, timing);
      if (!playedSample && generation === notePlaybackGeneration && !document.hidden && audioContext.state === "running" && isPracticeNoteCurrent(timing)) {
        createPluckSynth(noteName, durationSeconds, velocity, timing);
      }
      return playedSample;
    }

    function playKalimbaNoteImmediate(noteName, durationSeconds, velocity = 1) {
      if (!audioContext || document.hidden || audioContext.state !== "running" || resumePreparation) {
        return false;
      }

      const buffer = kalimbaSampleBuffers.get(noteName);
      if (buffer) {
        return playDecodedKalimbaSample(noteName, buffer, velocity);
      }

      loadKalimbaSampleBuffer(noteName);
      createPluckSynth(noteName, durationSeconds, velocity);
      return false;
    }

    function setActiveKeyInput(noteName, lane) {
      const now = performance.now() / 1000;
      activeDetection = {
        lane,
        candidateLane: lane,
        candidateNote: noteName,
        note: noteName,
        time: now,
        held: false
      };
      activeInputUntil = now + 0.18;
      signalPeakUntil = now + 0.16;
    }

    async function playKeyPreview(noteName, lane) {
      if (demoMode || resumePreparation || document.hidden) {
        return;
      }

      const generation = notePlaybackGeneration;
      try {
        await ensureAudioContext();
        if (generation !== notePlaybackGeneration || document.hidden || demoMode || resumePreparation || audioContext?.state !== "running") return;
        playKalimbaNoteImmediate(noteName, 1.2);
        setActiveKeyInput(noteName, lane);
        renderBoard(currentPracticeTime());
      } catch (error) {
        console.warn(`${APP_NAME} could not play ${noteName}`, error);
      }
    }

    function pluckEnvelope(param, now, peak, attackSeconds, decaySeconds) {
      param.cancelScheduledValues(now);
      param.setValueAtTime(0.0001, now);
      param.linearRampToValueAtTime(peak, now + attackSeconds);
      param.exponentialRampToValueAtTime(0.0001, now + decaySeconds);
    }

    function createPluckSynth(noteName, durationSeconds, velocity = 1, timing = null) {
      if (!Number.isFinite(velocity) || velocity <= 0) return;
      if (!audioContext || document.hidden || audioContext.state !== "running") {
        return;
      }

      const note = DISPLAY_KEYS[NOTE_INDEX.get(noteName)];
      if (!note) {
        return;
      }
      ensureKalimbaOutput();
      if (timing && !isPracticeNoteCurrent(timing)) return;

      const now = audioContext.currentTime;
      const freq = note.freq;
      const tailSeconds = Math.max(0.62, Math.min(1.75, durationSeconds * 1.08));
      const voice = audioContext.createGain();
      const highpass = audioContext.createBiquadFilter();
      const lowpass = audioContext.createBiquadFilter();
      const woodBody = audioContext.createBiquadFilter();
      const nasalBody = audioContext.createBiquadFilter();

      voice.gain.setValueAtTime(0.82 * clamp(velocity, 0, 1.2), now);

      highpass.type = "highpass";
      highpass.frequency.setValueAtTime(95, now);

      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(Math.min(7600, Math.max(3600, freq * 8.5)), now);
      lowpass.frequency.exponentialRampToValueAtTime(Math.min(4200, Math.max(2200, freq * 5.2)), now + 0.18);
      lowpass.Q.setValueAtTime(0.55, now);

      woodBody.type = "peaking";
      woodBody.frequency.setValueAtTime(Math.min(780, Math.max(260, freq * 1.45)), now);
      woodBody.Q.setValueAtTime(1.05, now);
      woodBody.gain.setValueAtTime(3.2, now);

      nasalBody.type = "peaking";
      nasalBody.frequency.setValueAtTime(Math.min(1450, Math.max(560, freq * 2.85)), now);
      nasalBody.Q.setValueAtTime(2.1, now);
      nasalBody.gain.setValueAtTime(1.8, now);

      voice.connect(highpass).connect(woodBody).connect(nasalBody).connect(lowpass).connect(kalimbaBus);

      const sources = [];
      const voiceNodes = [voice, highpass, lowpass, woodBody, nasalBody];
      const partials = [
        { ratio: 1, type: "triangle", level: 0.66, detune: -3, attack: 0.004, tail: tailSeconds },
        { ratio: 2.005, type: "sine", level: 0.24, detune: 4, attack: 0.0025, tail: tailSeconds * 0.48 },
        { ratio: 2.74, type: "sine", level: 0.17, detune: -8, attack: 0.002, tail: tailSeconds * 0.32 },
        { ratio: 4.18, type: "sine", level: 0.1, detune: 7, attack: 0.0015, tail: tailSeconds * 0.2 },
        { ratio: 6.32, type: "sine", level: 0.055, detune: -5, attack: 0.001, tail: tailSeconds * 0.12 }
      ];

      partials.forEach((partial, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const pan = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;

        osc.type = partial.type;
        osc.frequency.setValueAtTime(freq * partial.ratio, now);
        osc.detune.setValueAtTime(partial.detune, now);

        pluckEnvelope(gain.gain, now, partial.level, partial.attack, partial.tail);

        if (pan) {
          pan.pan.setValueAtTime((index - 2) * 0.045, now);
          osc.connect(gain).connect(pan).connect(voice);
        } else {
          osc.connect(gain).connect(voice);
        }
        sources.push(osc);
        voiceNodes.push(osc, gain, pan);
        osc.start(now);
        osc.stop(now + partial.tail + 0.05);
      });

      const carrier = audioContext.createOscillator();
      const carrierGain = audioContext.createGain();
      const modulator = audioContext.createOscillator();
      const modDepth = audioContext.createGain();

      carrier.type = "sine";
      carrier.frequency.setValueAtTime(freq, now);
      carrier.detune.setValueAtTime(2.5, now);
      modulator.type = "sine";
      modulator.frequency.setValueAtTime(freq * 2.72, now);
      pluckEnvelope(modDepth.gain, now, Math.min(80, freq * 0.09), 0.001, Math.min(0.22, tailSeconds * 0.28));
      pluckEnvelope(carrierGain.gain, now, 0.16, 0.003, tailSeconds * 0.62);
      modulator.connect(modDepth).connect(carrier.frequency);
      carrier.connect(carrierGain).connect(voice);
      modulator.start(now);
      carrier.start(now);
      modulator.stop(now + tailSeconds * 0.38);
      carrier.stop(now + tailSeconds * 0.7);

      const click = audioContext.createBufferSource();
      const clickGain = audioContext.createGain();
      const clickFilter = audioContext.createBiquadFilter();
      const clickPan = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;
      const sampleCount = Math.max(1, Math.floor(audioContext.sampleRate * 0.022));
      const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
      const data = buffer.getChannelData(0);

      for (let index = 0; index < sampleCount; index += 1) {
        const decay = Math.exp(-index / (sampleCount * 0.16));
        const scrape = Math.sin(index * 0.63) * 0.35 + (Math.random() * 2 - 1) * 0.65;
        data[index] = scrape * decay;
      }

      click.buffer = buffer;
      clickFilter.type = "bandpass";
      clickFilter.frequency.setValueAtTime(Math.min(5200, Math.max(2600, freq * 7)), now);
      clickFilter.Q.setValueAtTime(0.95, now);
      pluckEnvelope(clickGain.gain, now, 0.075, 0.001, 0.045);
      if (clickPan) {
        clickPan.pan.setValueAtTime(((NOTE_INDEX.get(noteName) || 10) - 10) / 80, now);
        click.connect(clickFilter).connect(clickGain).connect(clickPan).connect(voice);
      } else {
        click.connect(clickFilter).connect(clickGain).connect(voice);
      }
      click.start(now);

      const thump = audioContext.createOscillator();
      const thumpGain = audioContext.createGain();
      thump.type = "sine";
      thump.frequency.setValueAtTime(Math.max(90, freq * 0.5), now);
      thump.frequency.exponentialRampToValueAtTime(Math.max(70, freq * 0.34), now + 0.08);
      pluckEnvelope(thumpGain.gain, now, 0.055, 0.002, 0.12);
      thump.connect(thumpGain).connect(voice);
      thump.start(now);
      thump.stop(now + 0.16);

      voice.gain.exponentialRampToValueAtTime(0.0001, now + tailSeconds + 0.08);
      sources.push(carrier, modulator, click, thump);
      voiceNodes.push(carrier, carrierGain, modulator, modDepth, click, clickGain, clickFilter, clickPan, thump, thumpGain);
      registerKalimbaVoice(sources, voiceNodes);
    }

    function getExpectedEvent(seconds) {
      let candidate = null;
      let bestDistance = Infinity;

      songEvents.forEach((event) => {
        if (!isBeatInLoop(event.beat, practiceLoopRange)) return;
        const eventTime = getEventTime(event);
        const eventLateGrace = Math.max(lateGraceSeconds, getEventJudgeWindowSeconds(event));
        const distance = Math.abs(seconds - eventTime);
        if (distance < bestDistance && seconds <= eventTime + eventLateGrace) {
          bestDistance = distance;
          candidate = event;
        }
      });

      return candidate;
    }

    function getJudgementEvent(seconds) {
      let candidate = null;
      let latestEventTime = -Infinity;
      let previousEventTime = -Infinity;

      songEvents.forEach((event) => {
        if (!isBeatInLoop(event.beat, practiceLoopRange)) return;
        const eventTime = getEventTime(event);
        const eventLateGrace = Math.max(lateGraceSeconds, getEventJudgeWindowSeconds(event));
        // A fixed 120 ms anticipation can skip the current tine in fast passages.
        // Keep at least 55% of every onset interval for the current strike.
        const switchLead = Math.min(beamSwitchLeadSeconds, Math.max(0, eventTime - previousEventTime) * 0.45);
        previousEventTime = eventTime;
        const inSwitchWindow = seconds >= eventTime - switchLead && seconds <= eventTime + eventLateGrace;
        if (inSwitchWindow && eventTime >= latestEventTime) {
          latestEventTime = eventTime;
          candidate = event;
        }
      });

      return candidate;
    }

    function renderKeyGuidance(seconds, visualLeadSeconds) {
      const scaledBeat = getScaledBeatSeconds();
      const rangeKey = practiceLoopRange ? `${practiceLoopRange.startBeat}:${practiceLoopRange.endBeat}` : "all";
      const previewSeconds = Math.min(visualLeadSeconds, clamp(scaledBeat, 0.45, 1.2));
      let state = renderKeyGuidance.state;
      const samePass = state && state.events === songEvents && state.rangeKey === rangeKey;
      let awaitingStart = samePass ? state.awaitingStart : null;
      const firstBeat = practiceLoopRange?.startBeat || 0;
      const targetBeat = resumePreparation ? resumePreparation.seconds / scaledBeat : null;
      if (resumePreparation && samePass && (awaitingStart ||
          state.beat < targetBeat - 1e-7 && Math.abs(targetBeat - firstBeat) < 1e-7)) {
        awaitingStart = { targetBeat, cueBeat: awaitingStart?.cueBeat ?? state.beat };
        // An interrupted early count-in still gives a steady near-A outline.
        // It must not be promoted to held fill by Continue's clamped target.
      }
      if (awaitingStart && !resumePreparation && ((practiceRunning || demoMode) || !pausedSession ||
          Math.abs(seconds / scaledBeat - awaitingStart.targetBeat) > 1e-7)) awaitingStart = null;
      if (awaitingStart && (awaitingStart.targetBeat - awaitingStart.cueBeat) * scaledBeat > previewSeconds) {
        awaitingStart.cueBeat = awaitingStart.targetBeat - previewSeconds / scaledBeat / 2;
      }
      const cueSeconds = awaitingStart ? awaitingStart.cueBeat * scaledBeat
        : resumePreparation ? samePass ? state.beat * scaledBeat : seconds - 1e-7 * scaledBeat
        : seconds;
      const beat = cueSeconds / scaledBeat;
      const guidance = selectKeyGuidance(songEvents, cueSeconds, scaledBeat, {
        range: practiceLoopRange, previewSeconds
      });
      if (!state || state.events !== songEvents || state.rangeKey !== rangeKey || beat < state.beat - 1e-7 || seekingWithProgress) {
        state = { events: songEvents, rangeKey, beat, dark: new Map() };
        renderKeyGuidance.state = state;
      }
      state.awaitingStart = awaitingStart;
      // Display-only latch: changing speed cannot reopen a cue after its short
      // pre-onset dark interval began. Paused/resume preparation use this same
      // frozen beat; no wall-clock animation, audio flag or catch-up flash.
      const advancing = (practiceRunning || demoMode) && !resumePreparation && !seekingWithProgress;
      if (advancing) for (const event of guidance.darkEvents) state.dark.set(event.id, event);
      const byLane = new Map(guidance.keys.map(cue => {
        const copy = { ...cue };
        // A stopped seek/preparation displays a usable steady target; only an
        // already observed moving dark interval stays frozen through Pause.
        if (copy.phase === "pre-onset-dark") copy.phase = copy.held ? "active-fill"
          : copy.role === "primary" || guidance.heldEventIds.length ? "preview-outline" : "secondary-edge";
        return [copy.lane, copy];
      }));
      for (const [id, event] of state.dark) {
        if (beat >= event.beat || !isBeatInLoop(event.beat, practiceLoopRange)) {
          state.dark.delete(id);
          continue;
        }
        for (const lane of event.lanes) {
          const cue = byLane.get(lane);
          if (cue) byLane.set(lane, { ...cue, phase: "pre-onset-dark" });
        }
      }
      state.beat = beat;
      keyEls.forEach((key, lane) => {
        const cue = byLane.get(lane);
        const phase = cue?.phase || "none";
        key.classList.toggle("cue-active", phase === "active-fill");
        key.classList.toggle("cue-preview", phase === "preview-outline");
        key.classList.toggle("cue-secondary", Boolean(cue && cue.role === "secondary"));
        key.classList.toggle("cue-edge", phase === "secondary-edge");
        key.classList.toggle("cue-dark", phase === "pre-onset-dark");
        key.classList.toggle("cue-repeat", Boolean(cue?.repeat && phase !== "pre-onset-dark"));
        key.setAttribute("data-cue-phase", phase);
        key.setAttribute("data-cue-held", String(Boolean(cue?.held)));
      });
    }

    function renderBoard(seconds) {
      if (typeof loopBoundaryPreview !== "undefined" && loopDragEdge) {
        loopBoundaryPreview.show(loopDragEdge);
        return;
      }
      // Layout/key/control renders can dispatch melody too. Check real time
      // before changing the last visible checkpoint, including at exclusive B.
      if (!admitPracticeFrame()) return;
      clearHighlights();
      if (!resumePreparation && (practiceRunning || demoMode) && !document.hidden && (!audioContext || audioContext.state === "running")) {
        // A direct layout render also commits musical progress. Dispatch fresh
        // backing first so its checkpoint cannot silently consume that onset.
        if (seekingWithProgress) {
          // Retire only elapsed backing onsets suppressed by this drag. Keep
          // an onset exactly at the selected point eligible on immediate release.
          syncAccompanimentEventsForSeek(seconds, { preservePlayed: true });
        } else playAccompanimentEvents(seconds);
        if (!practiceRunning && !demoMode) return;
      }

      const boardHeight = boardTop.clientHeight;
      const columnWidth = noteLayer.clientWidth / DISPLAY_KEYS.length;
      const judgeLineTop = boardHeight - 10;
      const spawnBottomY = -8;
      const travelDistance = judgeLineTop - spawnBottomY;
      const now = performance.now() / 1000;
      const compactView = isCompactPracticeView();
      const visualFallLeadSeconds = getVisualFallLeadSeconds();
      if (activeDetection.lane != null && now > activeInputUntil) {
        resetDetectionReadout();
      }
      boardShell.classList.toggle("demo-playing", demoMode);
      boardShell.classList.toggle("signal", now < signalPeakUntil);

      const expectedEvent = resumePreparation
        ? songEvents.find(event => isBeatInLoop(event.beat, practiceLoopRange) && !event.demoPlayed && getEventTime(event) >= seconds)
        : seconds >= -visualFallLeadSeconds ? getExpectedEvent(seconds) : null;
      // A notated rest has no current tine, even during the next note's
      // anticipation window. Held notes remain visible without a new attack.
      const heldEvent = !resumePreparation && songEvents.find(event => isBeatInLoop(event.beat, practiceLoopRange)
        && seconds >= getEventTime(event)
        && seconds < getEventTime(event) + getEventDurationSeconds(event));
      const judgementCandidate = !resumePreparation && seconds >= 0 ? getJudgementEvent(seconds) : null;
      const judgementEvent = heldEvent && judgementCandidate
        && seconds < getEventTime(judgementCandidate) + getEventDurationSeconds(judgementCandidate)
        ? judgementCandidate : null;
      if (resumePreparation || seconds < 0 || seconds >= getSongProgressDuration()) {
        setActiveBeamLane(null);
      } else {
        setActiveBeamLane(judgementEvent?.judgeLanes || heldEvent?.judgeLanes || null);
      }

      if (expectedEvent) {
        targetText.textContent = formatEventTargetText(expectedEvent);
      } else {
        targetText.textContent = "--";
      }
      if (judgementEvent) {
        judgementEvent.judgeLanes.forEach((lane) => highlightLane(lane, "expected"));
      }

      renderKeyGuidance(seconds, visualFallLeadSeconds);
      renderSongProgress(seconds);

      if (activeDetection.lane != null) {
        highlightLane(activeDetection.lane, "heard");
      } else if (activeDetection.candidateLane != null) {
        highlightLane(activeDetection.candidateLane, "soft");
      }

      songEvents.forEach((event) => {
        const noteEl = noteEls.get(event.id);
        const eventTime = getEventTime(event);
        const durationSeconds = getEventDurationSeconds(event);
        const spawnTime = eventTime - visualFallLeadSeconds;
        const progress = (seconds - spawnTime) / visualFallLeadSeconds;
        const height = compactView
          ? Math.max(42, Math.min(52, 30 + event.duration * 10))
          : Math.max(58, 34 + event.duration * 20);
        const bottomY = spawnBottomY + progress * travelDistance;
        const topY = bottomY - height;
        const { minLane, laneSpan } = event;
        const left = minLane * columnWidth + columnWidth * noteLaneInsetRatio;
        // 每个音符独立显示；同列重复音不能去重，入场时由轨道裁切露出的部分。
        const visible = isBeatInLoop(event.beat, practiceLoopRange) && progress >= 0 && progress <= 1.04 && (!compactView || bottomY > 0);
        const closeness = clamp(progress, 0, 1);

        noteEl.style.left = `${left}px`;
        noteEl.style.width = `${columnWidth * (laneSpan - noteLaneInsetRatio * 2)}px`;
        noteEl.style.height = `${height}px`;
        noteEl.style.transform = `translateY(${topY}px)`;
        noteEl.style.zIndex = `${10 + Math.round(closeness * 90)}`;
        noteEl.classList.toggle("imminent", judgementEvent && judgementEvent.id === event.id);

        if (visible) {
          noteEl.classList.add("visible");
          const readableOpacity = compactView ? 0.34 + closeness * 0.66 : 1;
          noteEl.style.opacity = `${readableOpacity}`;
        } else {
          noteEl.classList.remove("visible");
          noteEl.classList.remove("imminent");
          noteEl.style.opacity = "0";
        }

        if (demoMode && !document.hidden && audioContext?.state === "running" && isBeatInLoop(event.beat, practiceLoopRange) && !event.demoPlayed && seconds >= eventTime) {
          event.demoPlayed = true;
          if (currentPracticeTime() - eventTime >= practiceOnsetStaleSeconds - 1e-7) return;
          event.notes.forEach((note) => {
            playKalimbaNote(note.name, Math.max(0.24, durationSeconds * 0.9), note.velocity, getPracticeNoteTiming(eventTime));
          });
        }
      });
      // Commit only a successfully rendered position. A thrown renderer keeps
      // the preceding visible checkpoint for the recoverable error pause.
      if (!resumePreparation && (practiceRunning || demoMode) && !document.hidden
        && (!audioContext || audioContext.state === "running")) lastPracticeFrameSeconds = seconds;
    }

    function shouldLoop() {
      return practiceRunning || demoMode || Boolean(resumePreparation);
    }

    function animationLoop() {
      try {
        rafId = 0;
        if (!shouldLoop()) return;
        if (document.hidden || (audioContext && audioContext.state !== "running")) {
          pausePractice({ freezeAtLastFrame: true });
          return;
        }
        if (resumePreparation) {
          const preparation = resumePreparation;
          const now = performance.now();
          if (preparation.startedAt == null) preparation.startedAt = now;
          if (now - preparation.startedAt < preparation.duration * 1000 - 1e-4) {
            renderBoard(preparation.seconds);
            setStatus(`继续准备 ${preparationCue.textContent}`);
            rafId = requestAnimationFrame(animationLoop);
            return;
          }
          resumePreparation = null;
          pausedSession = null;
          demoMode = preparation.mode === "demo";
          practiceRunning = !demoMode;
          // Do not backdate to an overdue RAF: the preserved target starts now.
          practiceStartAt = performance.now() - preparation.seconds * 1000;
          lastPracticeFrameSeconds = preparation.seconds;
          updatePauseControl();
        }
        if (passPreparation && !(seekingWithProgress && progressSeekAtStart)) {
          practiceStartAt = performance.now() - pausedElapsed * 1000;
          lastPracticeFrameSeconds = pausedElapsed;
          passPreparation = null;
        }
        if (!admitPracticeFrame()) return;
        let seconds = practiceRunning || demoMode ? currentPracticeTime() : pausedElapsed;
        if (practiceLoopRange && shouldLoop() && !seekingWithProgress && seconds >= practiceLoopRange.endBeat * getScaledBeatSeconds()) {
          // Deliver the last eligible onset even when a frame straddles the boundary.
          const end = practiceLoopRange.endBeat * getScaledBeatSeconds();
          playAccompanimentEvents(end - 1e-7);
          renderBoard(end - 1e-7);
          if (!shouldLoop()) return;
          // A routine repeat is not a user edit and must not cancel a newer mode request.
          prepareLoopStart({ preservePending: true });
          startLoop();
          return;
        }
        if ((practiceRunning || demoMode) && !seekingWithProgress) {
          playAccompanimentEvents(seconds);
          if (!shouldLoop()) return;
        }
        renderBoard(seconds);
        if (!shouldLoop()) return;
        lastPracticeFrameSeconds = seconds;

        const remainingPreparationBeats = Math.ceil(((practiceLoopRange?.startBeat || 0) * getScaledBeatSeconds() - seconds) / getScaledBeatSeconds() - 1e-7);
        if (shouldLoop() && remainingPreparationBeats > 0) {
          setStatus(`${demoMode ? "示范准备" : "准备"} ${remainingPreparationBeats}`);
        } else if (practiceRunning) {
          setStatus("练习中");
        } else if (demoMode) {
          setStatus("示范中");
        }

        // A held progress seek intentionally delays A/B wrapping. The selected
        // loop still owns its end, even past the ordinary full-song tail.
        if (!practiceLoopRange && practiceRunning && seconds >= getSongEndSeconds()) {
          practiceRunning = false;
          pausedElapsed = seconds;
          updatePauseControl();
          setStatus("练习结束");
        }

        if (!practiceLoopRange && demoMode && seconds >= getSongEndSeconds()) {
          demoMode = false;
          // Natural completion keeps the completed position. Only an explicit
          // Listen/Play/restart/seek action may reposition or reset attacks.
          pausedElapsed = getSongProgressDuration();
          updatePauseControl();
          boardShell.classList.remove("demo-playing");
          renderBoard(pausedElapsed);
          setStatus("示范结束");
        }

        if (shouldLoop()) {
          rafId = requestAnimationFrame(animationLoop);
        }
      } catch (error) {
        console.error(`${APP_NAME} playback frame failed`, error);
        // A broken renderer must not be called recursively while pausing it.
        pausePractice({ freezeAtLastFrame: true, render: false });
        setStatus("播放显示异常，已暂停");
      }
    }

    function startLoop() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(animationLoop);
    }

    function updatePauseControl() {
      const canPause = shouldLoop() || Boolean(pendingPlayback);
      const canContinue = !canPause && Boolean(pausedSession);
      pauseBtn.disabled = !canPause && !canContinue;
      pauseBtn.textContent = canContinue ? "继续" : "暂停";
      pauseBtn.title = canContinue ? "准备后继续原来的练习" : "暂停练习";
      setCompactIcon(pauseBtn, canContinue ? "续" : "停", pauseBtn.title);
      fullscreenControl?.refresh();
    }

    function cancelPracticeContinuation() {
      if (resumePreparation) pausedElapsed = resumePreparation.seconds;
      resumePreparation = null;
      passPreparation = null;
      pausedSession = null;
      pendingPlayback = null;
      playbackRequestId += 1;
      if (!practiceRunning && !demoMode) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      updatePauseControl();
    }

    function clearPracticeInteractions({ keepProgressSeek = false } = {}) {
      if (typeof loopBoundaryPreview !== "undefined") loopBoundaryPreview.clear();
      if (!keepProgressSeek && seekingWithProgress && progressSeekAtStart && (practiceRunning || demoMode)) {
        // Release begins a fresh full count-in even after a long stationary hold.
        practiceStartAt = performance.now() - pausedElapsed * 1000;
      }
      if (!keepProgressSeek && seekingWithProgress && (practiceRunning || demoMode)
        && !document.hidden && (!audioContext || audioContext.state === "running")) {
        // Release/cancel and controls can arrive between RAF checkpoints. Do not
        // replay backing intentionally suppressed since the last visible frame.
        // A lifecycle pause has already frozen its position and consumed only
        // past attacks there; never advance its flags through hidden time.
        syncAccompanimentEventsForSeek(currentPracticeTime(), { preservePlayed: true });
      }
      for (const [element, pointerId] of [[loopStartHandle, loopDragPointerId], [loopEndHandle, loopDragPointerId], [songProgress, keepProgressSeek ? null : progressSeekPointerId]]) {
        if (pointerId != null && element?.hasPointerCapture?.(pointerId)) {
          try { element.releasePointerCapture(pointerId); } catch { /* Capture may already be lost. */ }
        }
      }
      loopDragEdge = null;
      loopDragPointerId = null;
      loopDragRect = null;
      loopDragWasPlaying = false;
      loopDragWasDemo = false;
      if (!keepProgressSeek) {
        seekingWithProgress = false;
        progressSeekAtStart = false;
        progressSeekPointerId = null;
        progressSeekRect = null;
        songProgress?.classList.remove("seeking");
      }
    }

    function preservePastAttacks(seconds) {
      songEvents.forEach(event => { if (getEventTime(event) < seconds - 1e-7) event.demoPlayed = true; });
      accompanimentEvents.forEach(event => { if (getAccompanimentTime(event) < seconds - 1e-7) event.played = true; });
    }

    async function continuePractice() {
      if (!pausedSession || shouldLoop() || document.hidden || pendingPlayback) return;
      const saved = { ...pausedSession };
      clearPracticeInteractions();
      const requestId = ++playbackRequestId;
      pendingPlayback = saved;
      updatePauseControl();
      setStatus("准备声音");
      try {
        if (!await preparePracticeAudio(requestId)) return;
      } catch (error) {
        console.warn(`${APP_NAME} could not continue playback`, error);
        if (requestId !== playbackRequestId || document.hidden) return;
        if (audioContext || saved.mode === "demo") {
          pausePractice();
          setStatus("声音未就绪，已暂停");
          return;
        }
      }
      if (requestId !== playbackRequestId || document.hidden) return;
      if ((audioContext && audioContext.state !== "running") || (!audioContext && saved.mode === "demo")) {
        pausePractice();
        return;
      }
      pendingPlayback = null;
      pausedElapsed = saved.seconds;
      preservePastAttacks(saved.seconds);
      resumePreparation = { ...saved, requestId, startedAt: null, duration: getSessionLeadSeconds() };
      updatePauseControl();
      setStatus("继续准备");
      renderBoard(pausedElapsed);
      startLoop();
    }

    function togglePausePractice() {
      if (shouldLoop() || pendingPlayback) pausePractice();
      else if (pausedSession) continuePractice();
    }

    async function startPractice() {
      if (document.hidden) return;
      preferredPlaybackMode = "practice";
      // Choosing a mode explicitly begins a fresh pass at song start or A.
      // Stop/invalidate the old clock before awaiting audio; Continue alone
      // owns in-place resume, including recovery from a genuine playback stall.
      resetPracticeState({ preserveLoop: true });
      const requestId = ++playbackRequestId;
      pendingPlayback = { mode: "practice", seconds: currentPracticeTime() };
      updatePauseControl();
      setStatus("准备声音");

      try {
        if (!await preparePracticeAudio(requestId)) return;
      } catch (error) {
        console.warn(`${APP_NAME} could not prepare screen keys`, error);
        if (requestId !== playbackRequestId || document.hidden) return;
        if (audioContext) {
          pausePractice();
          setStatus("声音未就绪，已暂停");
          return;
        }
      }
      if (requestId !== playbackRequestId || document.hidden) return;
      if (audioContext && audioContext.state !== "running") { pausePractice(); return; }
      pendingPlayback = null;

      demoMode = false;
      boardShell.classList.remove("demo-playing");
      const historyResult = recordPractice(browserPreferenceStorage, getSongBaseId(currentSong));
      if (historyResult.error) showKeyWidthStatus(historyResult.error, true);
      practiceRunning = true;
      practiceStartAt = performance.now() - pausedElapsed * 1000;
      beginPassPreparation();
      updatePauseControl();
      setStatus("准备");
      startLoop();
    }

    function pausePractice({ freezeAtLastFrame = false, render = true } = {}) {
      if (!freezeAtLastFrame && !admitPracticeFrame()) return;
      const hadActivity = shouldLoop() || Boolean(pendingPlayback);
      if (hadActivity) {
        // Background/interruption notifications can arrive after a long RAF gap.
        // Keep the last visible position, rather than sweeping through hidden time.
        const seconds = resumePreparation ? resumePreparation.seconds
          : freezeAtLastFrame && (practiceRunning || demoMode) && lastPracticeFrameSeconds != null ? lastPracticeFrameSeconds
          : shouldLoop() ? currentPracticeTime() : pendingPlayback.seconds;
        const mode = pendingPlayback?.mode || resumePreparation?.mode || (demoMode ? "demo" : "practice");
        pausedElapsed = seconds;
        const firstPlaySeconds = (practiceLoopRange?.startBeat || 0) * getScaledBeatSeconds();
        // An interrupted initial/A countdown gets one full new preparation,
        // then its first attack. Do not chain the old partial countdown after it.
        pausedSession = { mode, seconds: Math.max(seconds, firstPlaySeconds) };
        preservePastAttacks(seconds);
      }
      playbackRequestId += 1;
      pendingPlayback = null;
      resumePreparation = null;
      passPreparation = null;
      practiceRunning = false;
      demoMode = false;
      cancelAnimationFrame(rafId);
      rafId = 0;
      clearPracticeInteractions();
      silenceKalimbaAudio();
      resetDetectionReadout();
      signalPeakUntil = 0;
      boardShell.classList.remove("demo-playing", "signal");
      updatePauseControl();
      if (hadActivity || pausedSession) {
        setStatus("已暂停");
        if (render) renderBoard(pausedElapsed);
      }
    }

    function resetPracticeState({ preserveLoop = false } = {}) {
      cancelPracticeContinuation();
      clearPracticeInteractions();
      silenceKalimbaAudio();
      cancelAnimationFrame(rafId);
      rafId = 0;
      loopDragEdge = null;
      loopDragPointerId = null;
      loopDragRect = null;
      loopDragWasPlaying = false;
      loopDragWasDemo = false;
      if (!preserveLoop) practiceLoopRange = null;
      playbackRequestId += 1;
      practiceRunning = false;
      demoMode = false;
      pausedElapsed = 0;
      lastPracticeFrameSeconds = null;
      updatePauseControl();

      activeDetection = {
        lane: null,
        candidateLane: null,
        candidateNote: "--",
        note: "--",
        time: 0,
        held: false
      };

      signalPeakUntil = 0;
      activeInputUntil = 0;
      targetText.textContent = "--";
      pausedElapsed = (practiceLoopRange?.startBeat || 0) * getScaledBeatSeconds() - getSessionLeadSeconds();
      setStatus("待开始");
      clearHighlights();
      setActiveBeamLane(null);
      boardShell.classList.remove("signal", "demo-playing");
      resetSongEvents();
      renderBoard(pausedElapsed);
      renderSongProgress(pausedElapsed);
    }

    async function restartPractice() {
      if (document.hidden) return;
      const mode = pendingPlayback?.mode || resumePreparation?.mode || pausedSession?.mode
        || (demoMode ? "demo" : practiceRunning ? "practice" : preferredPlaybackMode);
      // Restart owns the entire song, unlike Continue or the A/B repeat control.
      // Reset invalidates pending decodes/starts before a single fresh request.
      resetPracticeState();
      if (mode === "demo") await playDemo();
      else await startPractice();
    }

    async function playDemo() {
      if (document.hidden) return;
      preferredPlaybackMode = "demo";
      // A repeated Listen click is also a fresh pass. Cancel the prior mode
      // immediately so no old melody or accompaniment runs during audio setup.
      resetPracticeState({ preserveLoop: true });
      const requestId = ++playbackRequestId;
      pendingPlayback = { mode: "demo", seconds: pausedElapsed };
      updatePauseControl();
      setStatus("准备声音");
      try {
        if (!await preparePracticeAudio(requestId)) return;
      } catch (error) {
        console.error(error);
        if (requestId === playbackRequestId) {
          pausePractice();
          setStatus("声音未就绪，已暂停");
        }
        return;
      }
      if (requestId !== playbackRequestId || document.hidden) return;
      if (audioContext && audioContext.state !== "running") { pausePractice(); return; }
      pendingPlayback = null;

      demoMode = true;
      practiceRunning = false;
      updatePauseControl();
      practiceStartAt = performance.now() - pausedElapsed * 1000;
      beginPassPreparation();
      boardShell.classList.add("demo-playing");
      setStatus("示范准备");
      startLoop();
    }

    function applySpeed({ persist = true } = {}) {
      // Admit the old clock before this control can rebase or consume onsets.
      admitPracticeFrame();
      if (resumePreparation || pendingPlayback) pausePractice();
      clearPracticeInteractions();
      const seconds = currentPracticeTime();
      const completedAtEnd = !shouldLoop() && !pausedSession && !pendingPlayback
        && seconds >= getSongProgressDuration() - 1e-7
        && ["练习结束", "示范结束"].includes(statusText.textContent);
      const savedPauseSeconds = pausedSession?.seconds;
      const previousSpeed = speedFactor;
      const freshPreparation = !shouldLoop() && statusText.textContent === "待开始"
        && seconds <= (practiceLoopRange?.startBeat || 0) * getScaledBeatSeconds();
      speedFactor = Number(speedSlider.value || "1");
      fallLeadSeconds = baseFallLeadSeconds / Math.sqrt(speedFactor);
      speedValue.textContent = `${speedFactor.toFixed(2)}x`;
      if (Number.isFinite(seconds)) {
        // Keep the current musical beat when the seconds-per-beat changes.
        pausedElapsed = seconds * previousSpeed / speedFactor;
        if (practiceRunning || demoMode) {
          practiceStartAt = performance.now() - pausedElapsed * 1000;
        }
      }
      if (freshPreparation) {
        pausedElapsed = (practiceLoopRange?.startBeat || 0) * getScaledBeatSeconds() - getSessionLeadSeconds();
      } else if (completedAtEnd) {
        // The fixed audio-tail allowance does not scale with the song's beats.
        pausedElapsed = getSongProgressDuration();
      }
      if (pausedSession) pausedSession.seconds = savedPauseSeconds * previousSpeed / speedFactor;
      lastPracticeFrameSeconds = pausedElapsed;
      if (persist) {
        const result = saveSongSpeed(browserPreferenceStorage, currentSongId, speedFactor);
        if (result.error) showKeyWidthStatus(result.error, true);
      }
      renderBoard(currentPracticeTime());
    }

    function applySongDefaultSpeed() {
      speedSlider.value = getSongDefaultSpeedFactor().toFixed(2);
      applySpeed();
    }

    function changeAccompanimentStyle() {
      // Admit the old clock before this control can rebase or consume onsets.
      admitPracticeFrame();
      const requested = accompanimentStyleSelect.value;
      const signature = getSongAccompanimentSignature(currentSong);
      const provider = getSongAccompanimentProvider(currentSong, getSongVariants(currentSong));
      const selected = requested === provider?.kind && signature ? requested : requested === "original" ? "original" : "off";
      const seconds = currentPracticeTime();
      const playedBeats = new Set(accompanimentEvents.filter(event => event.played).map(event => event.beat));
      accompanimentEnabled = selected !== "off";
      if (selected !== "off") accompanimentStyle = selected;
      accompanimentEvents = buildAutoAccompanimentEvents(currentSong, accompanimentStyle);
      accompanimentTotalBeats = getEventTotalBeats(accompanimentEvents);
      syncAccompanimentEventsForSeek(seconds);
      accompanimentEvents.forEach(event => { if (playedBeats.has(event.beat)) event.played = true; });
      if (selected !== "original") {
        const result = saveSongAccompaniment(browserPreferenceStorage, currentSongId, selected, signature);
        if (result.saved) sessionAccompanimentChoices.delete(currentSongId);
        else {
          sessionAccompanimentChoices.set(currentSongId, { choice: selected, sourceSignature: signature });
          showKeyWidthStatus(result.error, true);
        }
      }
      applyAccompanimentControl();
    }

    function toggleAccompaniment() {
      // Admit the old clock before this control can rebase or consume onsets.
      admitPracticeFrame();
      if (!accompanimentEvents.length) {
        return;
      }

      accompanimentEnabled = !accompanimentEnabled;
      // Legacy original-only backing remains an explicit session choice, never global.
      if (accompanimentEnabled) {
        syncAccompanimentEventsForSeek(currentPracticeTime());
      }
      applyAccompanimentControl();
    }

    function applyAccompanimentVolume() {
      // Admit the old clock before this control can rebase or consume onsets.
      admitPracticeFrame();
      if (!accompanimentVolumeSlider) {
        return;
      }

      accompanimentVolume = clamp(Number(accompanimentVolumeSlider.value || "0.38"), 0, 1);
      storeAccompanimentVolume(accompanimentVolume);
      applyAccompanimentControl();
    }

    function toggleSongVersion() {
      const variants = getSongVariants(currentSong);
      if (variants.length < 2) {
        return;
      }

      const currentIndex = variants.findIndex((song) => song.id === currentSongId);
      const nextSong = variants[(currentIndex + 1) % variants.length] || variants[0];
      setCurrentSong(nextSong.id, { syncUrl: true });
    }

    function openSongLibrary() {
      // Cancel at leave intent: a slow or failed navigation may not emit pagehide.
      // Keep the paused position and Continue available if this document remains.
      pausePractice();
      window.location.href = `./songs.html?selected=${encodeURIComponent(currentSongId)}`;
    }

    fullscreenControl = createPracticeFullscreen({
      document, button: document.getElementById("fullscreenBtn"),
      getPlaybackState: getFullscreenPlaybackState,
      begin: state => state === "paused" ? continuePractice() : startPractice(),
      notify: message => showKeyWidthStatus(message, true)
    });
    applyStaticControlIcons();

    startBtn.addEventListener("click", startPracticeFromGesture);
    pauseBtn.addEventListener("click", togglePausePractice);
    resetBtn.addEventListener("click", () => resetPracticeState());
    if (restartBtn) restartBtn.addEventListener("click", restartPractice);
    demoBtn.addEventListener("click", playDemoFromGesture);
    songSpeedBtn.addEventListener("click", applySongDefaultSpeed);
    keyScaleBtn.addEventListener("click", resetKeyScale);
    if (accompanimentStyleSelect) accompanimentStyleSelect.addEventListener("change", changeAccompanimentStyle);
    if (accompanimentBtn) {
      accompanimentBtn.addEventListener("click", toggleAccompaniment);
    }
    if (accompanimentVolumeSlider) {
      accompanimentVolumeSlider.addEventListener("input", applyAccompanimentVolume);
    }
    if (songVersionBtn) {
      songVersionBtn.addEventListener("click", toggleSongVersion);
    }
    landscapeBtn.addEventListener("click", requestLandscapeMode);
    if (changeSongBtn) {
      changeSongBtn.addEventListener("click", openSongLibrary);
    }
    if (songProgress) {
      songProgress.addEventListener("pointerdown", startProgressSeek);
      songProgress.addEventListener("keydown", handleProgressKeydown);
    }
    speedSlider.addEventListener("input", () => applySpeed());
    repeatBtn.addEventListener("click", togglePracticeLoop);
    for (const [handle, edge] of [[loopStartHandle, "start"], [loopEndHandle, "end"]]) {
      handle.addEventListener("pointerdown", event => startLoopDrag(event, edge));
      handle.addEventListener("keydown", event => handleLoopKeydown(event, edge));
    }
    window.addEventListener("pointermove", moveLoopDrag);
    window.addEventListener("pointerup", finishLoopDrag);
    window.addEventListener("pointercancel", finishLoopDrag);
    window.addEventListener("pointermove", moveProgressSeek);
    window.addEventListener("pointerup", finishProgressSeek);
    window.addEventListener("pointercancel", finishProgressSeek);
    window.addEventListener("resize", refreshLandscapeMode);
    window.addEventListener("orientationchange", refreshLandscapeMode);
    if (portraitPracticeQuery.addEventListener) {
      portraitPracticeQuery.addEventListener("change", refreshLandscapeMode);
    }
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener("change", refreshLandscapeMode);
    }

    restoreKeyScale();
    setupKeyScaleGesture();
    if (appVersionText) {
      appVersionText.textContent = `v${APP_VERSION}`;
    }
    setCurrentSong(currentSongId, { syncUrl: true });
    applyInitialLandscapeMode();
