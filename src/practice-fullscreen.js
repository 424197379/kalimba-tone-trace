const ICON = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;
const ENTER_ICON = ICON("M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5");
const EXIT_ICON = ICON("M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5");
const FALLBACK = "此浏览器未开放网页全屏，仍可正常练习。微信顶部栏不能由网页强制隐藏；可用系统浏览器打开，或尝试添加到主屏幕。";

// A destination document needs its own user gesture. Never request fullscreen
// from a timer, navigation, orientation change or an arbitrary next key press.
export function createPracticeFullscreen({ document, button, getPlaybackState, begin, notify }) {
  let pending = null;
  let unavailable = false;
  let reported = false;
  let disposed = false;
  let startAttempted = false;
  let renderedIcon = null;
  const supported = () => typeof document.documentElement?.requestFullscreen === "function"
    && document.fullscreenEnabled !== false;
  const tell = (message, force = false) => {
    if (disposed || reported && !force) return;
    reported = true;
    notify(message);
  };
  function refresh() {
    if (!button || disposed) return;
    const active = Boolean(document.fullscreenElement);
    const state = getPlaybackState();
    const label = active ? "退出全屏" : unavailable || !supported() ? "全屏说明"
      : state === "paused" ? "全屏继续" : state === "idle" ? "全屏开始" : "全屏";
    const icon = active ? EXIT_ICON : ENTER_ICON;
    if (renderedIcon !== icon) {
      button.innerHTML = icon;
      renderedIcon = icon;
    }
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-busy", String(Boolean(pending)));
    button.title = active ? "退出浏览器全屏，不中断练习"
      : unavailable || !supported() ? "查看当前浏览器的全屏限制"
      : state === "idle" ? "请求浏览器全屏，并倒数后开始自己弹"
      : state === "paused" ? "请求浏览器全屏，并准备后继续原来的练习" : "请求浏览器全屏，不改变播放位置";
  }
  function request() {
    if (disposed) return Promise.resolve(false);
    startAttempted = true;
    if (document.fullscreenElement) return Promise.resolve(true);
    if (pending) return pending;
    if (!supported() || unavailable) {
      unavailable = true;
      tell(FALLBACK);
      refresh();
      return Promise.resolve(false);
    }
    let result;
    // Invoke synchronously, before awaiting audio setup or any other work.
    try { result = document.documentElement.requestFullscreen({ navigationUI: "hide" }); }
    catch (error) { result = Promise.reject(error); }
    pending = Promise.resolve(result).then(() => {
      const entered = Boolean(document.fullscreenElement);
      if (!entered) { unavailable = true; tell(FALLBACK); }
      return entered;
    }, () => {
      unavailable = true;
      tell(FALLBACK);
      return false;
    }).finally(() => { pending = null; refresh(); });
    refresh();
    return pending;
  }
  function activate() {
    if (disposed || pending) return pending || Promise.resolve(false);
    if (document.fullscreenElement) {
      let result;
      try { result = document.exitFullscreen(); }
      catch (error) { result = Promise.reject(error); }
      pending = Promise.resolve(result).then(() => false, () => {
        tell("暂时未能退出全屏，可使用浏览器的退出全屏操作。", true);
        return false;
      }).finally(() => { pending = null; refresh(); });
      refresh();
      return pending;
    }
    if (unavailable || !supported()) {
      unavailable = true;
      tell(FALLBACK, true);
      refresh();
      return Promise.resolve(false);
    }
    const state = getPlaybackState();
    startAttempted = true;
    const attempt = request();
    // Playback preparation is independent of the fullscreen promise. A denied
    // or slow request must not strand the transport or start it a second time.
    if (state === "idle" || state === "paused") begin(state);
    return attempt;
  }
  document.addEventListener("fullscreenchange", refresh);
  button?.addEventListener("click", activate);
  refresh();
  return {
    activate, request, refresh,
    requestOnStart() {
      if (startAttempted || disposed) return Promise.resolve(Boolean(document.fullscreenElement));
      startAttempted = true;
      return request();
    },
    dispose() {
      disposed = true;
      document.removeEventListener("fullscreenchange", refresh);
      button?.removeEventListener("click", activate);
    }
  };
}
