import { APP_VERSION } from "./song-store.js";

const refreshButton = document.getElementById("refreshAppBtn");
const toast = document.getElementById("updateToast");
const message = document.getElementById("updateStatusText");
const updateButton = document.getElementById("updateNowBtn");
const closeButton = document.getElementById("updateLaterBtn");
const pendingKey = "kalimba-pending-update";
const timeoutMs = 25000;
let busy = false;
let registrationPromise;

function showStatus(text, canUpdate = false) {
  message.textContent = text;
  toast.hidden = false;
  updateButton.hidden = !canUpdate;
  closeButton.textContent = canUpdate ? "稍后" : "关闭";
}

function setBusy(value) {
  busy = value;
  for (const button of [refreshButton, updateButton, closeButton]) button.disabled = value;
  refreshButton.setAttribute("aria-busy", String(value));
}

function rememberTarget(version) {
  try {
    if (version) sessionStorage.setItem(pendingKey, version);
    else sessionStorage.removeItem(pendingKey);
  } catch { /* Updating also works when session storage is unavailable. */ }
}

function atLeast(version, target) {
  const a = version.split(".").map(Number), b = target.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

function withTimeout(promise, text) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(text)), timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}

async function latestVersion() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL("./package.json", location.href);
    // A unique URL also bypasses caches held by older Service Workers.
    url.searchParams.set("version-check", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error("暂时无法获取最新版本，请稍后重试。");
    const { version } = await response.json();
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("版本信息暂时不可用，请稍后重试。");
    return version;
  } finally {
    clearTimeout(timer);
  }
}

function waitForInstall(worker) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("新版下载超时，请检查网络后重试。")), timeoutMs);
    function finish(error) {
      clearTimeout(timer);
      worker.removeEventListener("statechange", check);
      if (error) reject(error); else resolve();
    }
    function check() {
      if (worker.state === "redundant") finish(new Error("新版下载失败，请检查网络后重试。"));
      else if (["installed", "activating", "activated"].includes(worker.state)) finish();
    }
    worker.addEventListener("statechange", check);
    check();
  });
}

function activateWorker(worker) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("新版启用超时，请再次点击刷新。")), timeoutMs);
    function finish(error) {
      clearTimeout(timer);
      worker.removeEventListener("statechange", check);
      navigator.serviceWorker.removeEventListener("controllerchange", check);
      if (error) reject(error); else resolve();
    }
    function check() {
      if (worker.state === "redundant") finish(new Error("更新状态已改变，请再次点击刷新。"));
      else if (worker.state === "activated" && navigator.serviceWorker.controller === worker) finish();
    }
    worker.addEventListener("statechange", check);
    navigator.serviceWorker.addEventListener("controllerchange", check);
    worker.postMessage({ type: "SKIP_WAITING" });
    check();
  });
}

function workerVersion(worker) {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => finish(null), 2500);
    function finish(version) {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(version);
    }
    channel.port1.onmessage = ({ data }) => finish(data?.version || null);
    try { worker.postMessage({ type: "GET_VERSION" }, [channel.port2]); }
    catch { finish(null); }
  });
}

function watchRegistration(registration) {
  function offerUpdate() {
    if (!busy && registration.waiting && navigator.serviceWorker.controller) {
      showStatus("发现新版本，点击更新", true);
    }
  }
  function watch(worker) {
    worker?.addEventListener("statechange", offerUpdate);
  }
  watch(registration.installing);
  registration.addEventListener("updatefound", () => watch(registration.installing));
  offerUpdate();
  return registration;
}

function getRegistration() {
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
      .then(watchRegistration)
      .catch((error) => { registrationPromise = null; throw error; });
  }
  return registrationPromise;
}

async function updateApp() {
  if (busy) return;
  setBusy(true);
  showStatus("正在检查最新版本…");
  try {
    if (!navigator.onLine) throw new Error("当前离线，联网后点击刷新即可更新。");
    const latest = await latestVersion();
    if (!("serviceWorker" in navigator)) {
      if (atLeast(APP_VERSION, latest)) showStatus(`已是最新版本 v${APP_VERSION}`);
      else reloadForVersion(latest);
      return;
    }
    const registration = await withTimeout(getRegistration(), "连接更新服务超时，请稍后重试。");
    await withTimeout(registration.update(), "检查更新超时，请稍后重试。");
    if (registration.installing) {
      showStatus("正在下载最新版本…");
      await waitForInstall(registration.installing);
    }
    // Read the current registration, never a worker retained by an old toast.
    if (registration.waiting) {
      showStatus("正在启用最新版本…");
      await activateWorker(registration.waiting);
    } else if (registration.active?.state === "activating") {
      await activateWorker(registration.active);
    }
    const activeVersion = await workerVersion(navigator.serviceWorker.controller);
    if (activeVersion && !atLeast(activeVersion, latest)) {
      throw new Error("最新版尚未准备好，请稍后再次点击刷新。");
    }
    if (!atLeast(APP_VERSION, latest) || (activeVersion && activeVersion !== APP_VERSION)) {
      if (!activeVersion) throw new Error("新版尚未启用，请稍后再次点击刷新。");
      reloadForVersion(atLeast(activeVersion, latest) ? activeVersion : latest);
    } else {
      showStatus(`已是最新版本 v${APP_VERSION}`);
    }
  } catch (error) {
    rememberTarget(null);
    showStatus(error.name === "AbortError" ? "检查更新超时，请检查网络后重试。"
      : error instanceof TypeError ? "连接失败，请检查网络后重试。" : error.message);
  } finally {
    setBusy(false);
  }
}

function reloadForVersion(version) {
  rememberTarget(version);
  showStatus(`正在打开 v${version}…`);
  // Preserve the selected song and other URL state while bypassing HTML HTTP cache.
  const url = new URL(location.href);
  url.searchParams.set("app-update", `${version}-${Date.now()}`);
  location.replace(url.href);
}

refreshButton.addEventListener("click", updateApp);
updateButton.addEventListener("click", updateApp);
closeButton.addEventListener("click", () => { toast.hidden = true; });
try {
  const target = sessionStorage.getItem(pendingKey);
  if (target) {
    rememberTarget(null);
    showStatus(atLeast(APP_VERSION, target) ? `已更新到 v${APP_VERSION}`
      : `更新尚未完成，当前为 v${APP_VERSION}，请再次点击刷新。`);
  }
} catch { /* Session storage may be disabled by browser preferences. */ }
if (new URL(location.href).searchParams.has("app-update")) {
  const url = new URL(location.href);
  url.searchParams.delete("app-update");
  history.replaceState(history.state, "", url.href);
}
if ("serviceWorker" in navigator) getRegistration().catch(() => { /* Manual retry remains available. */ });
