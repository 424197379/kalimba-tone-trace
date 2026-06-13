import { DISPLAY_KEYS, NOTE_INDEX } from "./songs.js";
import { APP_VERSION, getSongLibrary, readStoredSongId, storeSongId } from "./song-store.js";
import { detectPitch, getNearestNote } from "./pitch.js";

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
            pendingJudgeLanes: new Set(judgeLanes),
            hit: false,
            missed: false,
            skipped: false,
            demoPlayed: false,
            lockedUntil: 0
          };
        })
        .sort((a, b) => a.beat - b.beat || a.id - b.id);
    }

    function getAccompanimentConfig(song) {
      if (song?.autoAccompaniment?.events?.length) {
        return song.autoAccompaniment;
      }

      const variantWithAccompaniment = getSongVariants(song || {})
        .find((variant) => variant.autoAccompaniment?.events?.length);
      return variantWithAccompaniment?.autoAccompaniment || null;
    }

    function getDefaultAccompanimentEnabled(song) {
      const config = getAccompanimentConfig(song);
      return Boolean(config?.events?.length && config.enabledByDefault !== false && song?.judgementMode !== "chord");
    }

    function getDefaultAccompanimentVolume(song) {
      const config = getAccompanimentConfig(song);
      const volume = Number(config?.volume);
      return Number.isFinite(volume) ? clamp(volume, 0, 1) : 0.38;
    }

    function buildAutoAccompanimentEvents(song) {
      const config = getAccompanimentConfig(song);
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

    function getSongTotalBeats(events) {
      if (!events.length) {
        return 0;
      }
      return Math.max(...events.map((event) => event.beat + event.duration));
    }

    function isLaneInEvent(lane, event) {
      return event && event.judgeLanes.includes(lane);
    }

    function getJudgeableEventCount() {
      return songEvents.filter((event) => event.judgeLanes.length > 0).length;
    }

    function getInitialSongId() {
      const params = new URLSearchParams(window.location.search);
      const urlSongId = params.get("song");
      const storedSongId = readStoredSongId();
      if (songLibrary[urlSongId]) {
        return urlSongId;
      }
      if (songLibrary[storedSongId]) {
        return storedSongId;
      }
      return "birthday";
    }

    const songLibrary = getSongLibrary();
    let currentSongId = getInitialSongId();
    let currentSong = songLibrary[currentSongId];
    let songEvents = buildSongEvents(currentSong);
    let accompanimentEvents = buildAutoAccompanimentEvents(currentSong);
    let songTotalBeats = getSongTotalBeats(songEvents);
    const scoreBeatWidth = 78;
    const scoreTrackPadding = 56;
    const noteLaneInsetRatio = 0.08;

    let bpm = currentSong.bpm;
    let beatSeconds = 60 / bpm;
    const baseFallLeadSeconds = 3.15;
    const prepareSeconds = 2.2;
    let speedFactor = 0.55;
    let fallLeadSeconds = 4.25;
    const keyScaleStorageKey = "kalimba-key-scale";
    const accompanimentEnabledStorageKey = "kalimba-accompaniment-enabled";
    const accompanimentVolumeStorageKey = "kalimba-accompaniment-volume";
    const keyScaleMin = 0.72;
    const keyScaleMax = 1.55;
    let keyScale = 1;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    const hitWindowSeconds = 0.28;
    const lateGraceSeconds = 0.36;
    const detectionHoldSeconds = 0.16;
    const wrongFlashSeconds = 0.18;
    const beamSwitchLeadSeconds = 0.12;

    const laneGrid = document.getElementById("laneGrid");
    const targetStrip = document.getElementById("targetStrip");
    const noteLayer = document.getElementById("noteLayer");
    const keyRow = document.getElementById("keyRow");
    const boardTop = document.getElementById("boardTop");
    const boardShell = document.querySelector(".board-shell");
    const scoreStrip = document.getElementById("scoreStrip");
    const scoreGrid = document.getElementById("scoreGrid");
    const scoreNotes = document.getElementById("scoreNotes");
    const scoreCursor = document.getElementById("scoreCursor");
    const scoreNow = document.getElementById("scoreNow");
    const songProgress = document.getElementById("songProgress");
    const songProgressFill = document.getElementById("songProgressFill");
    const songProgressThumb = document.getElementById("songProgressThumb");

    const statusText = document.getElementById("statusText");
    const micText = document.getElementById("micText");
    const heardText = document.getElementById("heardText");
    const targetText = document.getElementById("targetText");
    const scoreText = document.getElementById("scoreText");
    const comboText = document.getElementById("comboText");
    const feedbackText = document.getElementById("feedbackText");
    const centsText = document.getElementById("centsText");
    const freqText = document.getElementById("freqText");
    const levelText = document.getElementById("levelText");
    const secureNotice = document.getElementById("secureNotice");

    const startBtn = document.getElementById("startBtn");
    const micBtn = document.getElementById("micBtn");
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
    const accompanimentVolumeWrap = document.getElementById("accompanimentVolumeWrap");
    const accompanimentVolumeSlider = document.getElementById("accompanimentVolumeSlider");
    const accompanimentVolumeValue = document.getElementById("accompanimentVolumeValue");
    const practiceTitle = document.getElementById("practiceTitle");
    const practiceHint = document.getElementById("practiceHint");
    const scoreTitle = document.getElementById("scoreTitle");
    const landscapeBtn = document.getElementById("landscapeBtn");
    const appVersionText = document.getElementById("appVersionText");
    const updateToast = document.getElementById("updateToast");
    const updateNowBtn = document.getElementById("updateNowBtn");
    const updateLaterBtn = document.getElementById("updateLaterBtn");
    const portraitPracticeQuery = window.matchMedia("(orientation: portrait) and (max-width: 760px)");

    function setCompactIcon(button, icon, label) {
      if (!button) {
        return;
      }

      button.classList.remove("compact-icon-mic", "compact-icon-stop");
      if (icon === "mic" || icon === "stop") {
        button.dataset.compactIcon = "";
        button.classList.add(`compact-icon-${icon}`);
      } else {
        button.dataset.compactIcon = icon;
      }
      if (label) {
        button.setAttribute("aria-label", label);
        button.title = label;
      }
    }

    function applyStaticControlIcons() {
      setCompactIcon(startBtn, "▶", "开始练习");
      setCompactIcon(micBtn, "mic", "麦克风测试");
      setCompactIcon(pauseBtn, "Ⅱ", "暂停");
      setCompactIcon(resetBtn, "↺", "重置");
      setCompactIcon(demoBtn, "♪", "示范播放");
      setCompactIcon(changeSongBtn, "换", "换曲");
      setCompactIcon(songSpeedBtn, "↯", "使用曲目默认速度");
    }

    const laneEls = [];
    const keyEls = [];
    const noteEls = new Map();
    const beamEls = [];
    const scoreNoteEls = new Map();

    const KALIMBA_SAMPLE_PATHS = new Map(
      DISPLAY_KEYS.map((note) => [note.name, `./assets/samples/${note.name.toLowerCase()}.mp3`])
    );

    let audioContext = null;
    let analyser = null;
    let micSource = null;
    let micStream = null;
    let highpass = null;
    let lowpass = null;
    let kalimbaBus = null;
    let kalimbaDry = null;
    let kalimbaWet = null;
    let kalimbaReverb = null;
    let rafId = 0;

    let practiceRunning = false;
    let micTestMode = false;
    let demoMode = false;
    let micJudgingEnabled = false;
    let practiceStartAt = 0;
    let pausedElapsed = 0;
    let totalHits = 0;
    let combo = 0;
    let expectedLanes = [];
    let activeBeamLane = null;
    let storedAccompanimentEnabled = readStoredAccompanimentEnabled();
    let storedAccompanimentVolume = readStoredAccompanimentVolume();
    let accompanimentEnabled = storedAccompanimentEnabled ?? getDefaultAccompanimentEnabled(currentSong);
    let accompanimentVolume = storedAccompanimentVolume ?? getDefaultAccompanimentVolume(currentSong);
    let lastWrongLane = null;
    let lastWrongAt = 0;
    let signalPeakUntil = 0;
    let waitingServiceWorker = null;
    let reloadRequestedForUpdate = false;
    let refreshingForUpdate = false;
    let seekingWithProgress = false;
    let kalimbaSamplePreloadPromise = null;

    const kalimbaSampleBuffers = new Map();
    const kalimbaSamplePromises = new Map();
    const kalimbaSampleFailures = new Set();

    let activeDetection = {
      lane: null,
      candidateLane: null,
      candidateNote: "--",
      note: "--",
      cents: null,
      frequency: 0,
      volume: 0,
      clarity: 0,
      time: 0,
      held: false
    };

    let lastStableDetection = {
      lane: null,
      candidateLane: null,
      candidateNote: "--",
      note: "--",
      cents: null,
      frequency: 0,
      volume: 0,
      clarity: 0,
      time: 0
    };

    const analysisBuffer = new Float32Array(4096);

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function readStoredAccompanimentEnabled() {
      try {
        const value = localStorage.getItem(accompanimentEnabledStorageKey);
        if (value === "true") {
          return true;
        }
        if (value === "false") {
          return false;
        }
      } catch (error) {
        return null;
      }
      return null;
    }

    function storeAccompanimentEnabled(enabled) {
      storedAccompanimentEnabled = enabled;
      try {
        localStorage.setItem(accompanimentEnabledStorageKey, String(enabled));
      } catch (error) {
        // Ignore private browsing or storage quota failures.
      }
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

    function applyKeyScale(nextScale, persist = true) {
      keyScale = clamp(nextScale, keyScaleMin, keyScaleMax);
      document.documentElement.style.setProperty("--key-scale", keyScale.toFixed(3));
      keyScaleBtn.textContent = `键宽 ${Math.round(keyScale * 100)}%`;
      keyScaleBtn.title = "双指捏合练习区调整琴键宽度，点击恢复 100%";
      setCompactIcon(keyScaleBtn, "↔", `琴键宽度 ${Math.round(keyScale * 100)}%，点击恢复 100%`);
      if (persist) {
        localStorage.setItem(keyScaleStorageKey, keyScale.toFixed(3));
      }
    }

    function restoreKeyScale() {
      const savedScale = Number(localStorage.getItem(keyScaleStorageKey));
      applyKeyScale(Number.isFinite(savedScale) ? savedScale : 1, false);
    }

    function resetKeyScale() {
      applyKeyScale(1);
    }

    function setupKeyScaleGesture() {
      boardShell.addEventListener("touchstart", (event) => {
        if (event.touches.length === 2) {
          pinchStartDistance = getTouchDistance(event.touches);
          pinchStartScale = keyScale;
        }
      }, { passive: true });

      boardShell.addEventListener("touchmove", (event) => {
        if (event.touches.length !== 2 || !pinchStartDistance) {
          return;
        }
        event.preventDefault();
        const nextDistance = getTouchDistance(event.touches);
        applyKeyScale(pinchStartScale * (nextDistance / pinchStartDistance));
      }, { passive: false });

      boardShell.addEventListener("touchend", (event) => {
        if (event.touches.length < 2) {
          pinchStartDistance = 0;
        }
      }, { passive: true });
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
    }

    function refreshLandscapeMode() {
      if (!portraitPracticeQuery.matches) {
        setSoftwareLandscapeMode(false);
        return;
      }

      if (document.documentElement.classList.contains("software-landscape")) {
        scheduleLayoutRefresh();
      }
    }

    async function requestFullscreenMode() {
      if (document.fullscreenElement || !document.documentElement.requestFullscreen) {
        return true;
      }

      try {
        await document.documentElement.requestFullscreen();
        return true;
      } catch (error) {
        console.warn("Fullscreen is not available in this browser.", error);
        return false;
      }
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
      document.title = `卡林巴听弹练习 - ${currentSong.title}`;
      practiceTitle.textContent = currentSong.practiceTitle;
      practiceHint.textContent = currentSong.hint;
      scoreTitle.textContent = currentSong.scoreTitle;
      if (currentSongText) {
        currentSongText.textContent = currentSong.title;
      }
      applySongVersionControl();
      applyAccompanimentControl();
      const defaultSpeed = getSongDefaultSpeedFactor();
      songSpeedBtn.textContent = `曲目默认 ${defaultSpeed.toFixed(2)}x`;
      songSpeedBtn.title = `切换到 ${currentSong.title} 适合听旋律的默认速率`;
      setCompactIcon(songSpeedBtn, "速", `使用 ${currentSong.title} 的默认速度 ${defaultSpeed.toFixed(2)}x`);
    }

    function getSongDefaultSpeedFactor() {
      return Number(currentSong.defaultSpeedFactor || 1);
    }

    function getSongBaseId(song) {
      return song.baseSongId || (song.id.endsWith("-chord") ? song.id.slice(0, -6) : song.id);
    }

    function getSongVersionRank(song) {
      if (song.arrangementKind === "chord" || song.judgementMode === "chord") {
        return 1;
      }
      return 0;
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
      const hidden = variants.length < 2;
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
      if (accompanimentBtn) {
        accompanimentBtn.hidden = !hasAccompaniment;
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
      currentSongId = songLibrary[songId] ? songId : "birthday";
      storeSongId(currentSongId);
      if (options.syncUrl) {
        syncSongUrl(currentSongId);
      }
      currentSong = songLibrary[currentSongId];
      bpm = currentSong.bpm;
      beatSeconds = 60 / bpm;
      songEvents = buildSongEvents(currentSong);
      accompanimentEvents = buildAutoAccompanimentEvents(currentSong);
      accompanimentEnabled = storedAccompanimentEnabled ?? getDefaultAccompanimentEnabled(currentSong);
      accompanimentVolume = storedAccompanimentVolume ?? getDefaultAccompanimentVolume(currentSong);
      songTotalBeats = getSongTotalBeats(songEvents);
      applySongMeta();
      renderStaticBoard();
      resetPracticeState();
      applySpeed();
    }

    function renderStaticBoard() {
      noteLayer.replaceChildren();
      scoreGrid.replaceChildren();
      scoreNotes.replaceChildren();
      noteEls.clear();
      scoreNoteEls.clear();

      const scoreTrackWidth = scoreTrackPadding * 2 + (songTotalBeats + 1) * scoreBeatWidth;
      scoreGrid.style.width = `${scoreTrackWidth}px`;
      scoreNotes.style.width = `${scoreTrackWidth}px`;

      for (let beat = 0; beat <= Math.ceil(songTotalBeats); beat += 1) {
        const line = document.createElement("div");
        line.className = `score-grid-line${beat % currentSong.beatsPerMeasure === 0 ? " strong" : ""}`;
        line.style.left = `${scoreTrackPadding + beat * scoreBeatWidth}px`;
        scoreGrid.appendChild(line);
      }

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
          key.addEventListener("click", () => playKeyPreview(note.name));
          key.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              playKeyPreview(note.name);
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

        const chip = document.createElement("div");
        const scoreChipWidth = Math.max(28, event.duration * scoreBeatWidth - 10);
        chip.className = "score-note-chip";
        if (event.notes.length > 1) {
          chip.classList.add("score-chord-chip");
        }
        if (scoreChipWidth < 44) {
          chip.classList.add("compact-score-note");
        }
        chip.style.left = `${scoreTrackPadding + event.beat * scoreBeatWidth}px`;
        chip.style.width = `${scoreChipWidth}px`;
        chip.innerHTML = renderEventNotesMarkup(event, "score-note");
        scoreNotes.appendChild(chip);
        scoreNoteEls.set(event.id, chip);
      });
    }

    function resetSongEvents() {
      songEvents.forEach((event) => {
        event.hit = false;
        event.missed = false;
        event.skipped = false;
        event.demoPlayed = false;
        event.lockedUntil = 0;
        event.pendingJudgeLanes = new Set(event.judgeLanes);
        const noteEl = noteEls.get(event.id);
        if (noteEl) {
          noteEl.className = "note";
          if (event.notes.length > 1) {
            noteEl.classList.add("chord-note");
          }
          noteEl.querySelectorAll(".tone-heard").forEach((tone) => tone.classList.remove("tone-heard"));
          noteEl.style.opacity = "0";
        }
      });
      resetAccompanimentEvents();
      totalHits = 0;
      combo = 0;
      updateScore();
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

    function syncAccompanimentEventsForSeek(seconds) {
      const progressSeconds = Math.max(0, seconds);
      accompanimentEvents.forEach((event) => {
        event.played = getAccompanimentTime(event) < progressSeconds - 0.05;
      });
    }

    function playAccompanimentEvents(seconds) {
      if (!accompanimentEnabled || !accompanimentEvents.length || !audioContext || seconds < 0) {
        return;
      }

      accompanimentEvents.forEach((event) => {
        if (event.played || seconds < getAccompanimentTime(event)) {
          return;
        }

        const durationSeconds = Math.max(0.18, getAccompanimentDurationSeconds(event) * 0.86);
        event.notes.forEach((note) => {
          playKalimbaNote(note.name, durationSeconds, note.velocity * accompanimentVolume);
        });
        event.played = true;
      });
    }

    function updateScore() {
      if (practiceRunning && !micJudgingEnabled) {
        scoreText.textContent = "跟练: 不计分";
        comboText.textContent = "麦克风: 关闭";
        return;
      }

      scoreText.textContent = `命中: ${totalHits} / ${getJudgeableEventCount()}`;
      comboText.textContent = `连击: ${combo}`;
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
      const minLane = Math.min(...event.notes.map((note) => note.lane));
      const maxLane = Math.max(...event.notes.map((note) => note.lane));
      const laneSpan = Math.max(1, maxLane - minLane + 1);
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
      const progressSeconds = clamp(seconds, 0, duration);
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
    }

    function setStatus(text) {
      if (statusText.textContent !== text) {
        statusText.textContent = text;
      }
    }

    function showNotice(message) {
      secureNotice.style.display = "block";
      secureNotice.innerHTML = message;
    }

    function hideNotice() {
      secureNotice.style.display = "none";
    }

    function canRequestMicrophone() {
      return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);
    }

    function getMicrophoneUnavailableMessage() {
      if (!window.isSecureContext) {
        return "当前地址不是安全上下文，手机浏览器通常不会开放麦克风。你仍然可以跟着下落块练习；自动判定需要 HTTPS 页面。";
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return "当前浏览器不支持麦克风采集。你仍然可以跟着下落块练习；自动判定需要换用支持麦克风权限的新版浏览器。";
      }

      return "麦克风暂时不可用。你仍然可以跟着下落块练习；开启麦克风后才会自动判定。";
    }

    function enterFollowMode(message) {
      micJudgingEnabled = false;
      activeDetection = {
        lane: null,
        candidateLane: null,
        candidateNote: "--",
        note: "--",
        cents: null,
        frequency: 0,
        volume: 0,
        clarity: 0,
        time: 0,
        held: false
      };
      micText.textContent = "跟练模式";
      heardText.textContent = "--";
      feedbackText.textContent = "反馈: 跟练模式，不自动判定";
      if (message) {
        showNotice(message);
      }
    }

    async function tryEnableMicrophoneForPractice() {
      if (!canRequestMicrophone()) {
        enterFollowMode(getMicrophoneUnavailableMessage());
        return false;
      }

      try {
        await setupMicrophone();
        micJudgingEnabled = true;
        hideNotice();
        feedbackText.textContent = "反馈: 等待声音";
        return true;
      } catch (error) {
        console.error(error);
        enterFollowMode("麦克风没有开启，已进入跟练模式。下落块和琴键高亮会照常运行，但本次不自动判定命中。");
        return false;
      }
    }

    function currentPracticeTime() {
      if (!practiceRunning && !demoMode) {
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
      return window.matchMedia("(orientation: landscape) and (max-height: 560px)").matches;
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
      return getVisualFallLeadSeconds() + prepareSeconds;
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
        return Math.max(hitWindowSeconds, windowBeats * getScaledBeatSeconds());
      }
      return hitWindowSeconds;
    }

    function getSongEndSeconds() {
      const songEventEnd = songEvents.length
        ? Math.max(...songEvents.map((event) => getEventTime(event) + getEventDurationSeconds(event)))
        : 0;
      const accompanimentEnd = accompanimentEvents.length
        ? Math.max(...accompanimentEvents.map((event) => getAccompanimentTime(event) + getAccompanimentDurationSeconds(event)))
        : 0;
      return Math.max(songEventEnd, accompanimentEnd) + 0.9;
    }

    function renderScoreProgress(seconds, expectedEvent) {
      const stripWidth = scoreStrip.clientWidth;
      const cursorX = Math.max(112, stripWidth * 0.24);
      const currentBeat = seconds / getScaledBeatSeconds();
      const trackOffset = cursorX - (scoreTrackPadding + currentBeat * scoreBeatWidth);
      const visualFallLeadSeconds = getVisualFallLeadSeconds();

      renderSongProgress(seconds);
      scoreCursor.style.left = `${cursorX}px`;
      scoreGrid.style.transform = `translateX(${trackOffset}px)`;
      scoreNotes.style.transform = `translateX(${trackOffset}px)`;

      if (seconds < -visualFallLeadSeconds) {
        scoreNow.textContent = "准备中";
      } else if (seconds < 0) {
        scoreNow.textContent = "音块下落中";
      } else if (expectedEvent) {
        scoreNow.textContent = formatEventTargetText(expectedEvent);
      } else if (seconds >= getSongEndSeconds()) {
        scoreNow.textContent = "结束";
      } else {
        scoreNow.textContent = "--";
      }

      songEvents.forEach((event) => {
        const chip = scoreNoteEls.get(event.id);
        if (!chip) {
          return;
        }
        const eventTime = getEventTime(event);
        const eventEnd = eventTime + getEventDurationSeconds(event);
        chip.classList.toggle("active", expectedEvent && expectedEvent.id === event.id);
        chip.classList.toggle("passed", seconds > eventEnd);
        chip.classList.toggle(
          "current-heard",
          activeDetection.lane != null &&
            isLaneInEvent(activeDetection.lane, event) &&
            Math.abs(seconds - eventTime) <= getEventJudgeWindowSeconds(event)
        );
      });
    }

    function getProgressSeekSeconds(clientX) {
      if (!songProgress) {
        return 0;
      }
      const rect = songProgress.getBoundingClientRect();
      const ratio = rect.width ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
      return ratio * getSongProgressDuration();
    }

    function resetDetectionReadout() {
      activeDetection = {
        lane: null,
        candidateLane: null,
        candidateNote: "--",
        note: "--",
        cents: null,
        frequency: 0,
        volume: 0,
        clarity: 0,
        time: 0,
        held: false
      };

      lastStableDetection = {
        lane: null,
        candidateLane: null,
        candidateNote: "--",
        note: "--",
        cents: null,
        frequency: 0,
        volume: 0,
        clarity: 0,
        time: 0
      };

      heardText.textContent = "--";
      centsText.textContent = "音准偏差: --";
      freqText.textContent = "频率: --";
      levelText.textContent = "输入电平: 0%";
    }

    function syncSongEventsForSeek(seconds) {
      const progressSeconds = Math.max(0, seconds);
      let hitCount = 0;

      songEvents.forEach((event) => {
        const eventTime = getEventTime(event);
        const beforeSeekPoint = eventTime < progressSeconds - lateGraceSeconds;
        const noteEl = noteEls.get(event.id);

        if (beforeSeekPoint) {
          event.skipped = !event.hit && !event.missed;
          event.demoPlayed = demoMode;
        } else {
          event.hit = false;
          event.missed = false;
          event.skipped = false;
          event.demoPlayed = false;
          event.lockedUntil = 0;
          event.pendingJudgeLanes = new Set(event.judgeLanes);
        }

        if (event.hit) {
          hitCount += 1;
        }
        if (noteEl) {
          noteEl.classList.toggle("hit", event.hit);
          noteEl.classList.toggle("missed", event.missed);
          noteEl.classList.remove("partial-hit");
          noteEl.querySelectorAll(".tone-heard").forEach((tone) => tone.classList.remove("tone-heard"));
        }
      });

      totalHits = hitCount;
      combo = 0;
      updateScore();
    }

    function seekToSongTime(seconds) {
      const seekSeconds = clamp(seconds, 0, getSongProgressDuration());
      const wasPlaying = practiceRunning || demoMode;

      pausedElapsed = seekSeconds;
      if (wasPlaying) {
        practiceStartAt = performance.now() - seekSeconds * 1000;
      }

      syncSongEventsForSeek(seekSeconds);
      syncAccompanimentEventsForSeek(seekSeconds);
      resetDetectionReadout();
      expectedLanes = [];
      lastWrongLane = null;
      lastWrongAt = 0;
      renderBoard(seekSeconds);
    }

    function handleProgressPointer(event) {
      seekToSongTime(getProgressSeekSeconds(event.clientX));
    }

    function startProgressSeek(event) {
      if (!songProgress || (event.button != null && event.button !== 0)) {
        return;
      }

      seekingWithProgress = true;
      songProgress.classList.add("seeking");
      songProgress.focus({ preventScroll: true });
      songProgress.setPointerCapture(event.pointerId);
      event.preventDefault();
      handleProgressPointer(event);
    }

    function moveProgressSeek(event) {
      if (!seekingWithProgress) {
        return;
      }

      event.preventDefault();
      handleProgressPointer(event);
    }

    function finishProgressSeek(event) {
      if (!seekingWithProgress) {
        return;
      }

      seekingWithProgress = false;
      songProgress.classList.remove("seeking");
      if (songProgress.hasPointerCapture(event.pointerId)) {
        songProgress.releasePointerCapture(event.pointerId);
      }
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
      if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error("AudioContext is not supported");
        }
        audioContext = new AudioContextClass();
      }
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      preloadKalimbaSamples();
      return audioContext;
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
      masterTone.connect(safety).connect(audioContext.destination);
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

    function playDecodedKalimbaSample(noteName, buffer, velocity = 1) {
      if (!audioContext || !buffer) {
        return false;
      }

      ensureKalimbaOutput();
      if (!kalimbaBus) {
        return false;
      }

      const now = audioContext.currentTime;
      const source = audioContext.createBufferSource();
      const voice = audioContext.createGain();
      const pan = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;
      const noteIndex = NOTE_INDEX.get(noteName);

      source.buffer = buffer;
      voice.gain.setValueAtTime(0.92 * clamp(velocity, 0.1, 1.2), now);

      if (pan) {
        pan.pan.setValueAtTime(((noteIndex ?? 10) - 10) / 34, now);
        source.connect(voice).connect(pan).connect(kalimbaBus);
      } else {
        source.connect(voice).connect(kalimbaBus);
      }

      source.start(now);
      source.stop(now + buffer.duration + 0.04);
      return true;
    }

    async function playKalimbaSample(noteName, velocity = 1) {
      const buffer = await loadKalimbaSampleBuffer(noteName);
      return playDecodedKalimbaSample(noteName, buffer, velocity);
    }

    async function playKalimbaNote(noteName, durationSeconds, velocity = 1) {
      if (!audioContext) {
        return false;
      }

      const playedSample = await playKalimbaSample(noteName, velocity);
      if (!playedSample) {
        createPluckSynth(noteName, durationSeconds, velocity);
      }
      return playedSample;
    }

    async function playKeyPreview(noteName) {
      try {
        await ensureAudioContext();
        await playKalimbaNote(noteName, 1.2);
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

    async function setupMicrophone() {
      if (!window.isSecureContext) {
        showNotice(
          "当前页面不是安全上下文，浏览器通常不会开放麦克风。<br>" +
          "请用 <code>start-kalimba.cmd</code> 或 <code>node serve-kalimba.js</code> 启动本地服务，" +
          "然后访问 <code>http://localhost:8123/index.html</code>。"
        );
        throw new Error("Microphone requires secure context");
      }

      hideNotice();
      const context = await ensureAudioContext();

      if (!micStream) {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 1
          }
        });
      }

      if (!analyser) {
        highpass = context.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 120;

        lowpass = context.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 1800;

        analyser = context.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.05;
      }

      if (!micSource) {
        micSource = context.createMediaStreamSource(micStream);
        micSource.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(analyser);
      }

      micText.textContent = "已连接";
    }

    function createPluckSynth(noteName, durationSeconds, velocity = 1) {
      if (!audioContext) {
        return;
      }

      const note = DISPLAY_KEYS[NOTE_INDEX.get(noteName)];
      if (!note) {
        return;
      }
      ensureKalimbaOutput();

      const now = audioContext.currentTime;
      const freq = note.freq;
      const tailSeconds = Math.max(0.62, Math.min(1.75, durationSeconds * 1.08));
      const voice = audioContext.createGain();
      const highpass = audioContext.createBiquadFilter();
      const lowpass = audioContext.createBiquadFilter();
      const woodBody = audioContext.createBiquadFilter();
      const nasalBody = audioContext.createBiquadFilter();

      voice.gain.setValueAtTime(0.82 * clamp(velocity, 0.1, 1.2), now);

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
      setTimeout(() => {
        try {
          voice.disconnect();
        } catch (error) {
          // Voice may already be disconnected by the browser; ignore cleanup races.
        }
      }, Math.ceil((tailSeconds + 0.25) * 1000));
    }

    function analyzePitch() {
      if (!analyser || !audioContext) {
        return;
      }

      analyser.getFloatTimeDomainData(analysisBuffer);
      const detected = detectPitch(analysisBuffer, audioContext.sampleRate);
      const now = performance.now() / 1000;
      const level = Math.min(100, Math.round((detected.volume / 0.06) * 100));
      const signalPresent = detected.volume > 0.005;

      levelText.textContent = `输入电平: ${Math.max(0, level)}%`;
      if (signalPresent) {
        signalPeakUntil = now + 0.12;
      }

      if (!detected.frequency) {
        if (lastStableDetection.lane != null && now - lastStableDetection.time < detectionHoldSeconds && detected.volume > 0.004) {
          activeDetection = {
            ...lastStableDetection,
            volume: detected.volume,
            time: now,
            held: true
          };
          heardText.textContent = `${activeDetection.note}~`;
          centsText.textContent = `音准偏差: ${activeDetection.cents > 0 ? "+" : ""}${activeDetection.cents} cents`;
          freqText.textContent = `频率: ${activeDetection.frequency.toFixed(1)} Hz`;
          feedbackText.textContent = `反馈: 持续听到 ${activeDetection.note}`;
          micText.textContent = "有输入";
          return;
        }

        activeDetection = {
          lane: null,
          candidateLane: null,
          candidateNote: "--",
          note: "--",
          cents: null,
          frequency: 0,
          volume: detected.volume,
          clarity: detected.clarity,
          time: now,
          held: false
        };
        heardText.textContent = signalPresent ? "收到拨弦" : "--";
        centsText.textContent = "音准偏差: --";
        freqText.textContent = "频率: --";
        feedbackText.textContent = signalPresent ? "反馈: 已收到声音，正在找音高" : "反馈: 等待声音";
        micText.textContent = detected.volume > 0.004 ? "有输入" : "已连接";
        return;
      }

      const nearest = getNearestNote(detected.frequency, DISPLAY_KEYS);
      if (nearest.distance > 48) {
        activeDetection = {
          lane: null,
          candidateLane: nearest.lane,
          candidateNote: nearest.note.name,
          note: "--",
          cents: nearest.cents,
          frequency: detected.frequency,
          volume: detected.volume,
          clarity: detected.clarity,
          time: now,
          held: false
        };
        heardText.textContent = `接近 ${nearest.note.name}`;
        centsText.textContent = `音准偏差: ${nearest.cents > 0 ? "+" : ""}${nearest.cents} cents`;
        freqText.textContent = `频率: ${detected.frequency.toFixed(1)} Hz`;
        feedbackText.textContent = `反馈: 收到声音，接近 ${nearest.note.name}`;
        micText.textContent = "有输入";
        return;
      }

      activeDetection = {
        lane: nearest.lane,
        candidateLane: nearest.lane,
        candidateNote: nearest.note.name,
        note: nearest.note.name,
        cents: nearest.cents,
        frequency: detected.frequency,
        volume: detected.volume,
        clarity: detected.clarity,
        time: now,
        held: false
      };

      lastStableDetection = { ...activeDetection };
      heardText.textContent = nearest.note.name;
      centsText.textContent = `音准偏差: ${nearest.cents > 0 ? "+" : ""}${nearest.cents} cents`;
      freqText.textContent = `频率: ${detected.frequency.toFixed(1)} Hz`;
      feedbackText.textContent = `反馈: 已识别到 ${nearest.note.name}`;
      micText.textContent = "有输入";
    }

    function isEventResolved(event) {
      return !event.judgeLanes.length || event.hit || event.missed || event.skipped;
    }

    function getExpectedEvent(seconds) {
      let candidate = null;
      let bestDistance = Infinity;

      songEvents.forEach((event) => {
        if (isEventResolved(event)) {
          return;
        }
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

      songEvents.forEach((event) => {
        if (isEventResolved(event)) {
          return;
        }
        const eventTime = getEventTime(event);
        const eventLateGrace = Math.max(lateGraceSeconds, getEventJudgeWindowSeconds(event));
        const inSwitchWindow = seconds >= eventTime - beamSwitchLeadSeconds && seconds <= eventTime + eventLateGrace;
        if (inSwitchWindow && eventTime >= latestEventTime) {
          latestEventTime = eventTime;
          candidate = event;
        }
      });

      return candidate;
    }

    function markHit(event) {
      if (isEventResolved(event)) {
        return;
      }
      event.hit = true;
      event.skipped = false;
      event.pendingJudgeLanes.clear();
      totalHits += 1;
      combo += 1;
      updateScore();
      const noteEl = noteEls.get(event.id);
      if (noteEl) {
        noteEl.classList.add("hit");
        noteEl.classList.remove("partial-hit");
      }
    }

    function markMiss(event) {
      if (isEventResolved(event)) {
        return;
      }
      event.missed = true;
      event.skipped = false;
      combo = 0;
      updateScore();
      const noteEl = noteEls.get(event.id);
      if (noteEl) {
        noteEl.classList.add("missed");
        noteEl.classList.remove("partial-hit");
      }
    }

    function markPartialHit(event, lane) {
      event.pendingJudgeLanes.delete(lane);
      const noteEl = noteEls.get(event.id);
      if (!noteEl) {
        return;
      }
      noteEl.classList.add("partial-hit");
      noteEl.querySelectorAll(`[data-lane="${lane}"]`).forEach((tone) => tone.classList.add("tone-heard"));
    }

    function evaluatePractice(seconds) {
      songEvents.forEach((event) => {
        if (isEventResolved(event)) {
          return;
        }

        const eventTime = getEventTime(event);
        const delta = seconds - eventTime;
        const judgeWindow = getEventJudgeWindowSeconds(event);

        if (
          activeDetection.lane != null &&
          Math.abs(delta) <= judgeWindow &&
          event.pendingJudgeLanes.has(activeDetection.lane) &&
          seconds >= event.lockedUntil
        ) {
          event.lockedUntil = seconds + 0.16;
          markPartialHit(event, activeDetection.lane);
          if (!event.pendingJudgeLanes.size) {
            markHit(event);
          }
          return;
        }

        if (delta > Math.max(lateGraceSeconds, judgeWindow)) {
          markMiss(event);
        }
      });
    }

    function renderBoard(seconds) {
      clearHighlights();

      const boardHeight = boardTop.clientHeight;
      const judgeLineTop = boardHeight - 10;
      const spawnBottomY = -8;
      const travelDistance = judgeLineTop - spawnBottomY;
      const now = performance.now() / 1000;
      const compactView = isCompactPracticeView();
      const visualFallLeadSeconds = getVisualFallLeadSeconds();
      const maxCompactVisibleNotes = boardHeight < 155 ? 4 : 5;
      const compactVisibleIds = compactView
        ? new Set(
          (() => {
            const usedLanes = new Set();
            const visibleIds = [];
            songEvents
              .filter((event) => {
                if (event.hit || event.missed) {
                  return false;
                }
                const eventTime = getEventTime(event);
                return eventTime >= seconds - 0.08 && eventTime <= seconds + visualFallLeadSeconds;
              })
              .sort((a, b) => getEventTime(a) - getEventTime(b) || a.id - b.id)
              .forEach((event) => {
                if (visibleIds.length >= maxCompactVisibleNotes || usedLanes.has(event.lane)) {
                  return;
                }
                usedLanes.add(event.lane);
                visibleIds.push(event.id);
              });
            return visibleIds;
          })()
        )
        : null;

      boardShell.classList.toggle("signal", now < signalPeakUntil);

      const expectedEvent = seconds >= -visualFallLeadSeconds ? getExpectedEvent(seconds) : null;
      const judgementEvent = seconds >= 0 ? getJudgementEvent(seconds) : null;
      expectedLanes = judgementEvent ? judgementEvent.judgeLanes : [];
      if (seconds < 0 || seconds >= getSongProgressDuration()) {
        setActiveBeamLane(null);
      } else if (judgementEvent) {
        setActiveBeamLane(judgementEvent.judgeLanes);
      }

      if (expectedEvent) {
        targetText.textContent = formatEventTargetText(expectedEvent);
      } else {
        targetText.textContent = "--";
      }
      if (judgementEvent) {
        judgementEvent.judgeLanes.forEach((lane) => highlightLane(lane, "expected"));
      }

      renderScoreProgress(seconds, expectedEvent);

      if (activeDetection.lane != null) {
        const kind = !expectedLanes.length || expectedLanes.includes(activeDetection.lane) ? "heard" : "wrong";
        highlightLane(activeDetection.lane, kind);
        if (kind === "wrong") {
          lastWrongLane = activeDetection.lane;
          lastWrongAt = now;
        }
      } else if (activeDetection.candidateLane != null) {
        highlightLane(activeDetection.candidateLane, "soft");
      } else if (lastWrongLane != null && performance.now() / 1000 - lastWrongAt < wrongFlashSeconds) {
        highlightLane(lastWrongLane, "wrong");
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
        const columnWidth = noteLayer.clientWidth / DISPLAY_KEYS.length;
        const minLane = Math.min(...event.notes.map((note) => note.lane));
        const maxLane = Math.max(...event.notes.map((note) => note.lane));
        const laneSpan = Math.max(1, maxLane - minLane + 1);
        const left = minLane * columnWidth + columnWidth * noteLaneInsetRatio;
        const visible = progress >= 0 && progress <= 1.04 && (!compactView || (compactVisibleIds.has(event.id) && topY >= 0));
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
          noteEl.style.opacity = event.hit ? "0.2" : event.missed ? "0.4" : `${readableOpacity}`;
        } else {
          noteEl.classList.remove("visible");
          noteEl.classList.remove("imminent");
          noteEl.style.opacity = "0";
        }

        if (demoMode && !event.demoPlayed && seconds >= eventTime) {
          event.notes.forEach((note) => {
            playKalimbaNote(note.name, Math.max(0.24, durationSeconds * 0.9), note.velocity);
          });
          event.demoPlayed = true;
        }
      });
    }

    function shouldLoop() {
      return practiceRunning || micTestMode || demoMode;
    }

    function animationLoop() {
      if (analyser && (micJudgingEnabled || micTestMode)) {
        analyzePitch();
      }

      const seconds = practiceRunning || demoMode ? currentPracticeTime() : pausedElapsed;
      const visualFallLeadSeconds = getVisualFallLeadSeconds();
      if (practiceRunning && micJudgingEnabled && seconds >= 0 && !seekingWithProgress) {
        evaluatePractice(seconds);
      }
      if ((practiceRunning || demoMode) && !seekingWithProgress) {
        playAccompanimentEvents(seconds);
      }
      renderBoard(seconds);

      if ((practiceRunning || demoMode) && seconds < -visualFallLeadSeconds) {
        const remain = Math.max(0, Math.ceil(-visualFallLeadSeconds - seconds));
        setStatus(`${demoMode ? "示范" : "准备"} ${remain}`);
      } else if ((practiceRunning || demoMode) && seconds < 0) {
        setStatus(demoMode ? "示范下落中" : "音块下落中");
      } else if (practiceRunning) {
        setStatus("练习中");
      } else if (demoMode) {
        setStatus("示范中");
      }

      if (practiceRunning && songEvents.every(isEventResolved)) {
        practiceRunning = false;
        demoMode = false;
        pausedElapsed = seconds;
        pauseBtn.disabled = true;
        setStatus(totalHits === getJudgeableEventCount() ? "完成" : "结束");
      }

      if (practiceRunning && !micJudgingEnabled && seconds >= getSongEndSeconds()) {
        practiceRunning = false;
        pausedElapsed = seconds;
        pauseBtn.disabled = true;
        setStatus("跟练结束");
        updateScore();
      }

      if (demoMode && seconds >= getSongEndSeconds()) {
        demoMode = false;
        pausedElapsed = -getSessionLeadSeconds();
        pauseBtn.disabled = true;
        resetSongEvents();
        renderBoard(pausedElapsed);
        setStatus("示范结束");
      }

      if (shouldLoop()) {
        rafId = requestAnimationFrame(animationLoop);
      }
    }

    function startLoop() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(animationLoop);
    }

    function isSongFinished() {
      return songEvents.length > 0 && songEvents.every(isEventResolved);
    }

    async function startPractice() {
      if (accompanimentEnabled && accompanimentEvents.length) {
        try {
          await ensureAudioContext();
          await preloadKalimbaSamples();
        } catch (error) {
          console.warn(`${APP_NAME} could not start accompaniment`, error);
        }
      }
      await tryEnableMicrophoneForPractice();

      if (isSongFinished() || pausedElapsed >= getSongEndSeconds()) {
        resetPracticeState();
        if (accompanimentEnabled && accompanimentEvents.length) {
          try {
            await ensureAudioContext();
            await preloadKalimbaSamples();
          } catch (error) {
            console.warn(`${APP_NAME} could not restart accompaniment`, error);
          }
        }
        await tryEnableMicrophoneForPractice();
      }

      micTestMode = false;
      demoMode = false;
      practiceRunning = true;
      practiceStartAt = performance.now() - pausedElapsed * 1000;
      pauseBtn.disabled = false;
      micBtn.textContent = "麦克风测试";
      setCompactIcon(micBtn, "mic", "麦克风测试");
      setStatus("准备");
      updateScore();
      startLoop();
    }

    async function toggleMicTest() {
      if (micTestMode) {
        micTestMode = false;
        micBtn.textContent = "麦克风测试";
        setCompactIcon(micBtn, "mic", "麦克风测试");
        setStatus(practiceRunning ? "练习中" : "待开始");
        return;
      }

      if (!canRequestMicrophone()) {
        enterFollowMode(getMicrophoneUnavailableMessage());
        setStatus("麦克风不可用");
        return;
      }

      try {
        await setupMicrophone();
      } catch (error) {
        console.error(error);
        enterFollowMode("麦克风没有开启。你仍然可以点击“开始练习”进入跟练模式。");
        setStatus("麦克风不可用");
        return;
      }

      micTestMode = true;
      micJudgingEnabled = false;
      practiceRunning = false;
      demoMode = false;
      pauseBtn.disabled = true;
      micBtn.textContent = "停止测试";
      setCompactIcon(micBtn, "stop", "停止麦克风测试");
      setStatus("麦克风测试中");
      startLoop();
    }

    function pausePractice() {
      if (!practiceRunning && !demoMode) {
        return;
      }
      pausedElapsed = currentPracticeTime();
      practiceRunning = false;
      demoMode = false;
      pauseBtn.disabled = true;
      setStatus("已暂停");
    }

    function resetPracticeState() {
      practiceRunning = false;
      demoMode = false;
      micTestMode = false;
      micJudgingEnabled = false;
      pausedElapsed = 0;
      pauseBtn.disabled = true;
      micBtn.textContent = "麦克风测试";
      setCompactIcon(micBtn, "mic", "麦克风测试");

      activeDetection = {
        lane: null,
        candidateLane: null,
        candidateNote: "--",
        note: "--",
        cents: null,
        frequency: 0,
        volume: 0,
        clarity: 0,
        time: 0,
        held: false
      };

      lastStableDetection = {
        lane: null,
        candidateLane: null,
        candidateNote: "--",
        note: "--",
        cents: null,
        frequency: 0,
        volume: 0,
        clarity: 0,
        time: 0
      };

      expectedLanes = [];
      lastWrongLane = null;
      lastWrongAt = 0;
      signalPeakUntil = 0;
      heardText.textContent = "--";
      targetText.textContent = "--";
      feedbackText.textContent = "反馈: 等待声音";
      centsText.textContent = "音准偏差: --";
      freqText.textContent = "频率: --";
      levelText.textContent = "输入电平: 0%";
      pausedElapsed = -getSessionLeadSeconds();
      setStatus("待开始");
      clearHighlights();
      setActiveBeamLane(null);
      boardShell.classList.remove("signal");
      resetSongEvents();
      renderBoard(pausedElapsed);
      renderScoreProgress(pausedElapsed, null);
    }

    async function playDemo() {
      try {
        await ensureAudioContext();
        await preloadKalimbaSamples();
      } catch (error) {
        console.error(error);
        return;
      }

      resetPracticeState();
      demoMode = true;
      practiceRunning = false;
      pausedElapsed = -getSessionLeadSeconds();
      pauseBtn.disabled = false;
      practiceStartAt = performance.now() - pausedElapsed * 1000;
      setStatus("示范准备");
      startLoop();
    }

    function applySpeed() {
      speedFactor = Number(speedSlider.value || "0.55");
      fallLeadSeconds = baseFallLeadSeconds / Math.sqrt(speedFactor);
      speedValue.textContent = `${speedFactor.toFixed(2)}x`;
      if (!practiceRunning && !demoMode && pausedElapsed <= 0) {
        pausedElapsed = -getSessionLeadSeconds();
      }
      renderBoard(currentPracticeTime());
    }

    function applySongDefaultSpeed() {
      speedSlider.value = getSongDefaultSpeedFactor().toFixed(2);
      applySpeed();
    }

    function toggleAccompaniment() {
      if (!accompanimentEvents.length) {
        return;
      }

      accompanimentEnabled = !accompanimentEnabled;
      storeAccompanimentEnabled(accompanimentEnabled);
      if (accompanimentEnabled) {
        syncAccompanimentEventsForSeek(currentPracticeTime());
      }
      applyAccompanimentControl();
    }

    function applyAccompanimentVolume() {
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
      window.location.href = `./songs.html?selected=${encodeURIComponent(currentSongId)}`;
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
      if (updateNowBtn) {
        updateNowBtn.disabled = false;
      }
      if (updateLaterBtn) {
        updateLaterBtn.disabled = false;
      }
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
      if (updateNowBtn) {
        updateNowBtn.disabled = true;
      }
      if (updateLaterBtn) {
        updateLaterBtn.disabled = true;
      }
      waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    }

    function dismissServiceWorkerUpdate() {
      if (updateToast) {
        updateToast.hidden = true;
      }
      waitingServiceWorker = null;
    }

    applyStaticControlIcons();

    startBtn.addEventListener("click", startPractice);
    micBtn.addEventListener("click", toggleMicTest);
    pauseBtn.addEventListener("click", pausePractice);
    resetBtn.addEventListener("click", resetPracticeState);
    demoBtn.addEventListener("click", playDemo);
    songSpeedBtn.addEventListener("click", applySongDefaultSpeed);
    keyScaleBtn.addEventListener("click", resetKeyScale);
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
      songProgress.addEventListener("pointermove", moveProgressSeek);
      songProgress.addEventListener("pointerup", finishProgressSeek);
      songProgress.addEventListener("pointercancel", finishProgressSeek);
      songProgress.addEventListener("keydown", handleProgressKeydown);
    }
    if (updateNowBtn) {
      updateNowBtn.addEventListener("click", requestServiceWorkerUpdate);
    }
    if (updateLaterBtn) {
      updateLaterBtn.addEventListener("click", dismissServiceWorkerUpdate);
    }
    speedSlider.addEventListener("input", applySpeed);
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
    setCurrentSong(currentSongId);
    applyInitialLandscapeMode();

    if (!canRequestMicrophone()) {
      showNotice(getMicrophoneUnavailableMessage());
      micText.textContent = "跟练模式";
      micBtn.disabled = true;
    }

    if ("serviceWorker" in navigator) {
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
