import { getSongDisplayTitle } from "../src/song-presentation.js";
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';
import * as store from '../src/song-store.js';
import * as preferences from '../src/practice-preferences.js';
import { getPracticeTotalBeats } from '../src/practice-loop.js';

// Execute the complete, unmodified production library and update entries. Only
// ESM import declarations are removed: their real repository exports are supplied
// below. Browser DOM, storage, navigation, time and Service Workers are isolated
// fakes. These tests neither use a browser nor prove native bfcache/PWA behavior.
// An optional source root allows the same positive assertions to demonstrate the
// pre-fix failure against a privately retained source snapshot, with no fixtures
// or historical production copies committed to the repository.
const sourceRoot = process.env.KALIMBA_DRAFT_SOURCE_ROOT
  ? pathToFileURL(`${resolve(process.env.KALIMBA_DRAFT_SOURCE_ROOT)}/`)
  : new URL('../', import.meta.url);
const sources = Object.fromEntries(await Promise.all([
  'songs.html', 'src/song-library.js', 'src/app-update.js', 'src/app.js'
].map(async name => [name, await readFile(new URL(name, sourceRoot), 'utf8')])));
const withoutImports = source => source.replace(/^import\s[\s\S]+?;\n/gm, '');
const hiddenIds = new Set([...sources['songs.html'].matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)]
  .filter(match => /\shidden(?:\s|>)/.test(match[0])).map(match => match[1]));
const pendingUpdateKey = 'kalimba-pending-update';
const rawDraft = '\n { "title": "QA 原始编辑稿 🪕", "steps": [["C4", 0, 1]], "reviewNote": "原始空格与换行" }\n';
const validScore = JSON.stringify({ id: 'qa-draft-retention', title: 'QA 草稿保存', steps: [['C4', 0, 1]] });
const nextVersion = '99.0.0';
const descendants = node => [node, ...node.children.flatMap(descendants)];
const settle = async () => { for (let n = 0; n < 10; n += 1) await Promise.resolve(); };

class BrowserEvent {
  constructor(type, options = {}) { this.type = type; this.cancelable = Boolean(options.cancelable); this.defaultPrevented = false; Object.assign(this, options); }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
}
function emitter() {
  const listeners = new Map();
  return { listeners,
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    dispatchEvent(event) {
      for (const callback of [...(listeners.get(event.type) || [])]) callback(event);
      return !event.defaultPrevented;
    },
    emit(name, event = {}) {
      return Promise.all([...(listeners.get(name) || [])].map(callback => callback(event)));
    }
  };
}
function element(tag = 'div') {
  let text = '';
  const classes = new Set();
  return { ...emitter(), tag, children: [], attrs: {}, value: '', hidden: false, disabled: false, className: '',
    classList: { add: (...values) => values.forEach(value => classes.add(value)), remove: value => classes.delete(value),
      toggle(value, force) { if (force ?? !classes.has(value)) classes.add(value); else classes.delete(value); } },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name] ?? null; },
    append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); },
    replaceChildren(...nodes) { this.children = nodes; }, focus() { this.focused = true; }, select() {},
    get textContent() { return text; }, set textContent(value) { text = String(value); this.children = []; }
  };
}
function memoryStorage(initial = [], relevant = () => true) {
  const records = new Map(initial), operations = [];
  return { records, operations, fault: null, propertyDenied: false,
    getItem(key) {
      operations.push({ kind: 'get', key });
      if (relevant(key) && this.fault === 'read-denied') throw Error('QA read denied');
      const raw = records.get(key) ?? null;
      return relevant(key) && this.fault === 'readback-mismatch' && raw !== null ? `${raw}QA mismatched readback` : raw;
    },
    setItem(key, value) {
      operations.push({ kind: 'set', key, value: String(value) });
      if (relevant(key) && this.fault === 'quota') throw Error('QA quota exceeded');
      if (relevant(key) && this.fault === 'write-dropped') return;
      records.set(key, String(value));
    },
    removeItem(key) {
      operations.push({ kind: 'remove', key });
      if (relevant(key) && this.fault === 'remove-denied') throw Error('QA remove denied');
      if (relevant(key) && this.fault === 'remove-dropped') return;
      records.delete(key);
    }
  };
}
const newSession = () => memoryStorage([], key => key !== pendingUpdateKey);
function environment(t) {
  const local = memoryStorage([[store.CUSTOM_SONGS_STORAGE_KEY, '[]'], [store.CURRENT_SONG_STORAGE_KEY, 'birthday']],
    key => key === store.CUSTOM_SONGS_STORAGE_KEY);
  const lock = { held: false, denied: false, requests: [] };
  const navigator = { onLine: true, locks: { async request(name, options, callback) {
    lock.requests.push({ name, ...options });
    assert.deepEqual(options, { mode: 'exclusive', ifAvailable: true });
    // Model the browser scheduling a Web Locks callback later, without changing
    // the production lock implementation or its non-waiting request options.
    if (lock.acquireGate) await lock.acquireGate;
    if (lock.denied) throw Error('QA lock denied');
    if (lock.held) return callback(null);
    lock.held = true;
    try { return await callback({ name }); } finally { lock.held = false; }
  } } };
  const prior = ['localStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  for (const [key, value] of Object.entries({ localStorage: local, navigator })) Object.defineProperty(globalThis, key, { value, configurable: true });
  t.after(() => { for (const [key, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  return { local, navigator, lock, session: newSession(), songs: () => JSON.parse(local.records.get(store.CUSTOM_SONGS_STORAGE_KEY)) };
}
function libraryPage(env, { session = env.session, href = 'https://example.test/songs.html?selected=birthday&keep=1#library',
  version = store.APP_VERSION, latest = version, pwa = true, waiting = false, online = true, holdPaint = false, holdTasks = false, holdThinking = false, fetchGate } = {}) {
  const nodes = new Map(), transitions = [], historyWrites = [], queuedFrames = [], timers = new Set(), queuedTasks = new Map(), queuedThinking = new Map();
  let address = href, framesHeld = holdPaint;
  const location = { get href() { return address; },
    set href(value) { address = new URL(value, address).href; transitions.push({ kind: 'assign', href: address }); },
    get search() { return new URL(address).search; },
    replace(value) { address = new URL(value, address).href; transitions.push({ kind: 'replace', href: address }); }
  };
  const history = { state: { retained: true }, replaceState(state, title, value) {
    address = new URL(value, address).href; historyWrites.push(address);
  } };
  const window = { ...emitter(), location, history };
  const document = { ...emitter(), createElement: element, getElementById(id) {
    if (!nodes.has(id)) { const node = element(); node.hidden = hiddenIds.has(id); nodes.set(id, node); }
    return nodes.get(id);
  } };
  const navigator = { ...env.navigator, onLine: online };
  if (pwa) {
    const sw = { ...emitter() };
    const makeWorker = (workerVersion, state) => ({ ...emitter(), state, version: workerVersion,
      postMessage(message, ports) {
        if (message.type === 'GET_VERSION') ports[0].postMessage({ version: this.version });
        if (message.type === 'SKIP_WAITING') {
          this.state = 'activated'; sw.controller = this; registration.active = this; registration.waiting = null;
          void this.emit('statechange'); void sw.emit('controllerchange');
        }
      }
    });
    const registration = { ...emitter(), active: makeWorker(version, 'activated'), installing: null,
      waiting: waiting ? makeWorker(latest, 'installed') : null,
      async update() { if (latest !== version && !this.waiting && this.active.version !== latest) this.waiting = makeWorker(latest, 'installed'); }
    };
    sw.controller = registration.active; sw.register = async () => registration; navigator.serviceWorker = sw;
  }
  class MessageChannel {
    constructor() {
      this.port1 = { onmessage: null, close() {} };
      this.port2 = { close() {}, postMessage: data => this.port1.onmessage?.({ data }) };
    }
  }
  const globals = { ...store, ...preferences, getSongDisplayTitle, APP_VERSION: version, getPracticeTotalBeats,
    URL, URLSearchParams, AbortController, Event: BrowserEvent, CustomEvent: BrowserEvent, MessageChannel, console,
    performance: { now: () => 0 },
    setTimeout(callback, ms) {
      if (holdThinking && ms === 900) {
        const task = {}; queuedThinking.set(task, callback); return task;
      }
      if (holdTasks && (ms ?? 0) === 0) {
        const task = {}; queuedTasks.set(task, callback); return task;
      }
      const timer = setTimeout(() => { timers.delete(timer); callback(); }, ms <= 1000 ? 0 : ms);
      timers.add(timer); return timer;
    },
    clearTimeout(timer) { queuedThinking.delete(timer); queuedTasks.delete(timer); timers.delete(timer); clearTimeout(timer); },
    requestAnimationFrame(callback) { if (framesHeld) queuedFrames.push(callback); else callback(); },
    localStorage: env.local, navigator, location, history, document, window,
    fetch: async () => { if (fetchGate) await fetchGate; return { ok: true, json: async () => ({ version: latest }) }; }
  };
  for (const target of [globals, window]) Object.defineProperty(target, 'sessionStorage', {
    configurable: true, get() { if (session.propertyDenied) throw Error('QA sessionStorage access denied'); return session; }
  });
  const context = createContext(globals);
  runInContext(withoutImports(sources['src/song-library.js']), context, { filename: 'PRODUCTION:src/song-library.js' });
  runInContext(withoutImports(sources['src/app-update.js']), context, { filename: 'PRODUCTION:src/app-update.js' });
  const page = { env, session, nodes, transitions, historyWrites, window, document, location, context,
    read: expression => runInContext(expression, context),
    text: () => nodes.get('songJsonInput').value,
    async input(raw) {
      nodes.get('songJsonInput').value = raw;
      await nodes.get('songJsonInput').emit('input', { target: nodes.get('songJsonInput'), isTrusted: true });
    },
    async type(raw = rawDraft) {
      if (nodes.get('importPanel').hidden) await this.click('addSongBtn');
      await this.input(raw);
    },
    click: id => nodes.get(id).emit('click'),
    practice(other = false) {
      const button = descendants(nodes.get('songList')).find(node => node.tag === 'button' && /song-action-btn/.test(node.className) && (!other || !/accent/.test(node.className)));
      assert.ok(button, 'practice uses a real rendered button'); return button.emit('click');
    },
    beforeUnload() {
      const event = new BrowserEvent('beforeunload', { cancelable: true });
      window.dispatchEvent(event); return event;
    },
    releasePaint() { framesHeld = false; while (queuedFrames.length) queuedFrames.shift()(); },
    releaseThinking() {
      for (const [task, callback] of [...queuedThinking]) { queuedThinking.delete(task); callback(); }
    },
    async runTasks() {
      // Run one browser task checkpoint. Tasks scheduled by these callbacks are
      // deliberately left for the next checkpoint; production code is untouched.
      for (const [task, callback] of [...queuedTasks]) {
        if (!queuedTasks.delete(task)) continue;
        callback();
      }
      await settle();
      // For ordinary pages, let native zero-delay production tasks actually run.
      await new Promise(resolveTask => setTimeout(resolveTask, 0));
    },
    dispose() { queuedThinking.clear(); queuedTasks.clear(); for (const timer of timers) clearTimeout(timer); timers.clear(); }
  };
  return page;
}
function pageFor(t, env, options) { const page = libraryPage(env, options); t.after(() => page.dispose()); return page; }
function messages(page) {
  return [...page.nodes].filter(([id, node]) => /draft|importMessage|libraryRefreshMessage|updateStatusText/i.test(id) && !node.hidden)
    .map(([, node]) => node.textContent).join('\n');
}
function assertDraft(page, raw, message = 'the exact raw editor text must survive') { assert.equal(page.text(), raw, message); }
function assertRecovered(page, raw) {
  assertDraft(page, raw); assert.equal(page.nodes.get('importPanel').hidden, false, 'recovered draft is visible without hunting');
  assert.match(messages(page), /草稿|原稿|未保存|恢复/, 'recovery is explicitly disclosed');
}
function assertNoNavigation(page, before) {
  assert.equal(page.transitions.length, 0, 'unsafe app navigation must be cancelled');
  assert.equal(page.location.href, before.href, 'blocked practice must not rewrite selection in the URL');
  assert.equal(page.historyWrites.length, before.historyWrites, 'blocked practice must not perform even an intermediate URL rewrite');
  assert.equal(page.env.local.records.get(store.CURRENT_SONG_STORAGE_KEY), before.selected, 'blocked practice must not change remembered song');
}
const selectionSnapshot = page => ({ href: page.location.href, historyWrites: page.historyWrites.length, selected: page.env.local.records.get(store.CURRENT_SONG_STORAGE_KEY) });
function practiceReturn(page) {
  const currentSongId = new URL(page.location.href).searchParams.get('song'), changeSongBtn = element('button');
  const openSource = sources['src/app.js'].match(/    function openSongLibrary\(\) \{\n[\s\S]*?\n    \}/)?.[0];
  const bindSource = sources['src/app.js'].match(/changeSongBtn\.addEventListener\("click", openSongLibrary\);/)?.[0];
  assert.ok(openSource && bindSource, 'original practice change-song handler and binding are present');
  // This draft roundtrip isolates the real navigation binding. Full transport
  // cancellation/retention is exercised in test-practice-navigation.mjs.
  let pauseCalls = 0;
  runInContext(`${openSource}\n${bindSource}`, createContext({ currentSongId, changeSongBtn,
    pausePractice() { pauseCalls += 1; }, window: { location: page.location } }));
  return changeSongBtn.emit('click').then(() => assert.equal(pauseCalls, 1));
}

for (const [label, raw] of [
  ['unparsed JSON', '\n {"title": "没有闭合的 JSON", '],
  ['whitespace only', ' \t\n  \n'],
  ['duplicate fields', '\n{"title":"第一项","title":"第二项","steps":[["C4",0,1]]}\n'],
  ['complete Unicode raw text', rawDraft],
  ['large raw text', ` {"notes":"${'原稿🪕 '.repeat(20000)}"} `]
]) test(`fresh library restores ${label} byte-for-byte without modifying saved songs`, async t => {
  const env = environment(t), page = pageFor(t, env), before = env.local.records.get(store.CUSTOM_SONGS_STORAGE_KEY);
  await page.type(raw);
  assertDraft(page, raw);
  const reopened = pageFor(t, env);
  assertRecovered(reopened, raw);
  assert.equal(env.local.records.get(store.CUSTOM_SONGS_STORAGE_KEY), before);
  assert.ok(!env.local.operations.some(op => op.kind !== 'get'), 'typing must never write saved-song or practice storage');
});

test('real practice and in-app change-song roundtrip restores the latest edit in a new document', async t => {
  const env = environment(t), page = pageFor(t, env);
  await page.type(); await page.input(`${rawDraft}latest keystroke`);
  await page.practice(); assert.equal(page.transitions.length, 1); assert.match(page.location.href, /index\.html\?song=/);
  assert.equal(page.beforeUnload().defaultPrevented, false, 'verified draft must not add an unnecessary unload prompt');
  await practiceReturn(page); assert.match(page.location.href, /songs\.html\?selected=/);
  assertRecovered(pageFor(t, env, { href: page.location.href }), `${rawDraft}latest keystroke`);
});

test('collapse, ordinary storage notifications and unchanged bfcache restoration retain the exact edit', async t => {
  const env = environment(t), page = pageFor(t, env); await page.type();
  await page.click('addSongBtn'); await page.click('addSongBtn');
  await page.window.emit('storage', { key: store.CUSTOM_SONGS_STORAGE_KEY });
  await page.window.emit('pageshow', { persisted: true }); await page.runTasks();
  assertDraft(page, rawDraft); assert.equal(page.transitions.length, 0);
  assertRecovered(pageFor(t, env), rawDraft);
});

for (const [label, raw, failure] of [
  ['invalid JSON', '{unfinished', null], ['duplicate JSON fields', '{"title":"one","title":"two","steps":[["C4",0,1]]}', null],
  ['unsupported note', validScore.replace('C4', 'C#4'), null], ['busy song lock', validScore, 'busy'],
  ['unavailable song lock', validScore, 'missing'], ['denied song lock', validScore, 'denied'],
  ['saved-song quota', validScore, 'quota'], ['saved-song read denied', validScore, 'read-denied']
]) test(`failed import (${label}) preserves the raw draft through a new document`, async t => {
  const env = environment(t), page = pageFor(t, env); await page.type(raw);
  if (failure === 'busy') env.lock.held = true;
  if (failure === 'denied') env.lock.denied = true;
  if (failure === 'missing') delete env.navigator.locks;
  if (['quota', 'read-denied'].includes(failure)) env.local.fault = failure;
  await page.click('importSongBtn');
  assertDraft(page, raw); assert.equal(env.local.records.get(store.CUSTOM_SONGS_STORAGE_KEY), '[]');
  assert.match(page.nodes.get('importMessage').className, /error/);
  env.local.fault = null;
  assertRecovered(pageFor(t, env), raw);
});

for (const fault of ['read-denied', 'quota', 'write-dropped', 'readback-mismatch', 'property-denied']) {
  test(`draft ${fault} cancels practice and update without changing selection, then recovers on retry`, async t => {
    const env = environment(t), page = pageFor(t, env, { latest: nextVersion });
    if (fault === 'property-denied') env.session.propertyDenied = true; else env.session.fault = fault;
    await page.type(); const before = selectionSnapshot(page);
    assertDraft(page, rawDraft); assert.match(messages(page), /草稿|原稿|保留|保存/);
    await page.practice(true); assertNoNavigation(page, before);
    await page.click('refreshAppBtn'); assertNoNavigation(page, before);
    assertDraft(page, rawDraft); assert.equal(page.beforeUnload().defaultPrevented, true, 'unsafe native leave must request a browser warning');
    env.session.fault = null; env.session.propertyDenied = false;
    await page.practice(); assert.equal(page.transitions.length, 1, 'recovered storage permits deliberate retry');
    assertRecovered(pageFor(t, env), rawDraft);
  });
}

test('startup read denial does not erase an unseen stored draft, including when read access later recovers', async t => {
  const env = environment(t), original = pageFor(t, env); await original.type();
  const prior = [...env.session.records]; env.session.fault = 'read-denied';
  const page = pageFor(t, env);
  await page.practice(true); assert.deepEqual([...env.session.records], prior);
  env.session.fault = null;
  await page.window.emit('pageshow', { persisted: true }); await page.runTasks();
  assertDraft(page, rawDraft);
  await page.practice();
  assert.deepEqual([...env.session.records], prior, 'a default empty editor is not a user request to clear an unreadable draft');
  assertRecovered(pageFor(t, env), rawDraft);
});

for (const fault of ['remove-denied', 'remove-dropped']) {
  test(`manual clear with ${fault} preserves stored raw text and explicitly reports the failed clear`, async t => {
    const env = environment(t), page = pageFor(t, env); await page.type();
    env.session.fault = fault; await page.input('');
    assert.equal(page.text(), '', 'honor the user clearing the editor while reporting failed storage cleanup');
    assert.ok([...env.session.records.values()].includes(rawDraft), 'failed cleanup must not silently change stored raw text');
    assert.match(messages(page), /清除|清空/, 'explain that the requested clear did not persist');
    assert.equal(page.beforeUnload().defaultPrevented, true);
    env.session.fault = null; await page.input('');
    assert.equal(page.text(), ''); assert.equal(pageFor(t, env).text(), '');
  });
  test(`successful song save with ${fault} is reported as saved while uncleared draft remains explicit`, async t => {
    const env = environment(t), page = pageFor(t, env); await page.type(validScore);
    env.session.fault = fault; await page.click('importSongBtn');
    assert.equal(env.songs().length, 1, 'song commit succeeded exactly once');
    assert.match(messages(page), /已添加|已保存/);
    assert.match(messages(page), /草稿|原稿/);
    assert.match(messages(page), /清除|保留|未清/);
    assert.equal(page.text(), '', 'the successful save clears the editor, preventing accidental duplicate save');
    assert.ok([...env.session.records.values()].includes(validScore), 'uncleared stored raw text remains intact');
    env.session.fault = null; await page.input('');
    assert.equal(pageFor(t, env).text(), ''); assert.equal(env.songs().length, 1);
  });
}

test('explicit empty input clears the draft, and a successful import never restores it in a new document', async t => {
  const env = environment(t), page = pageFor(t, env); await page.type(); await page.input('');
  assert.equal(pageFor(t, env).text(), '');
  await page.type(validScore); await page.click('importSongBtn');
  assert.equal(env.songs().length, 1); assert.equal(page.text(), '');
  assert.equal(pageFor(t, env).text(), '');
});

test('bfcache document cannot resurrect a draft cleared by a later document in the same tab', async t => {
  const env = environment(t), oldPage = pageFor(t, env); await oldPage.type(validScore); await oldPage.practice();
  const newerPage = pageFor(t, env); await newerPage.click('importSongBtn');
  assert.equal(env.songs().length, 1); assert.equal(newerPage.text(), '');
  await oldPage.window.emit('pageshow', { persisted: true }); await oldPage.runTasks();
  assert.equal(oldPage.text(), '', 'saved old draft must not return through the back/forward cache');
  await oldPage.practice(); assert.equal(pageFor(t, env).text(), ''); assert.equal(env.songs().length, 1);
});

test('bfcache document adopts the later same-tab edit rather than overwriting it with old raw text', async t => {
  const env = environment(t), oldPage = pageFor(t, env); await oldPage.type(); await oldPage.practice();
  const newerPage = pageFor(t, env), newer = `${rawDraft}new document edit`; await newerPage.input(newer);
  await oldPage.window.emit('pageshow', { persisted: true }); await oldPage.runTasks();
  assertDraft(oldPage, newer); await oldPage.practice(); assertRecovered(pageFor(t, env), newer);
});

test('independent tabs keep different drafts; saving one leaves the other raw draft unchanged', async t => {
  const env = environment(t), sessionB = newSession(), a = pageFor(t, env), b = pageFor(t, env, { session: sessionB });
  await a.type(validScore); await b.type(`${rawDraft}other tab`); await a.click('importSongBtn');
  await b.window.emit('storage', { key: store.CUSTOM_SONGS_STORAGE_KEY });
  assert.equal(pageFor(t, env).text(), ''); assertDraft(b, `${rawDraft}other tab`);
  assertRecovered(pageFor(t, env, { session: sessionB }), `${rawDraft}other tab`);
});

for (const [label, options, button] of [
  ['version refresh', { pwa: true }, 'refreshAppBtn'],
  ['waiting-worker immediate update', { pwa: true, waiting: true }, 'updateNowBtn'],
  ['no-Service-Worker fallback', { pwa: false }, 'refreshAppBtn']
]) test(`${label} checks the actual leave guard and restores raw input after new-document initialization`, async t => {
  const env = environment(t), page = pageFor(t, env, { latest: nextVersion, ...options }); await page.type();
  await page.click(button); assert.equal(page.transitions.length, 1); assert.equal(page.transitions[0].kind, 'replace');
  assert.match(page.location.href, /selected=birthday/); assert.match(page.location.href, /keep=1/); assert.match(page.location.href, /app-update=99\.0\.0-/);
  const next = pageFor(t, env, { href: page.location.href, version: nextVersion, latest: nextVersion, ...options });
  assertRecovered(next, rawDraft); assert.equal(env.local.records.get(store.CUSTOM_SONGS_STORAGE_KEY), '[]');
});

test('latest version, offline and later controls retain the draft without a replacement', async t => {
  const env = environment(t);
  for (const options of [{ pwa: true }, { pwa: false }, { online: false, latest: nextVersion }]) {
    const page = pageFor(t, env, options); await page.type(); await page.click('refreshAppBtn'); await page.click('updateLaterBtn');
    assertDraft(page, rawDraft); assert.equal(page.transitions.length, 0);
  }
});

test('edit while version fetch is pending is the text saved by the real reload boundary', async t => {
  const env = environment(t); let finishFetch;
  const gate = new Promise(resolveGate => { finishFetch = resolveGate; });
  const page = pageFor(t, env, { latest: nextVersion, fetchGate: gate }); await page.type();
  const update = page.click('refreshAppBtn'); await settle();
  await page.input(`${rawDraft}edited during update`); finishFetch(); await update;
  assert.equal(page.transitions.length, 1); assertRecovered(pageFor(t, env), `${rawDraft}edited during update`);
});

test('practice and PWA reload cannot leave during an unfinished song import; retry after completion succeeds', async t => {
  const env = environment(t), page = pageFor(t, env, { latest: nextVersion, holdPaint: true });
  await page.type(validScore); const importing = page.click('importSongBtn'); await settle();
  assert.equal(page.nodes.get('songJsonInput').disabled, true);
  const before = selectionSnapshot(page); await page.practice(true); assertNoNavigation(page, before);
  await page.click('updateNowBtn'); assertNoNavigation(page, before); assertDraft(page, validScore);
  page.releasePaint(); await importing;
  assert.equal(env.songs().length, 1); assert.equal(page.text(), '');
  await page.click('refreshAppBtn'); assert.equal(page.transitions.length, 1); assert.equal(pageFor(t, env).text(), '');
});

test('a dirty bfcache editor and newer same-tab draft are both preserved until the user explicitly clears the current edit', async t => {
  const env = environment(t), oldPage = pageFor(t, env); await oldPage.type();
  env.session.fault = 'quota'; const dirty = `${rawDraft}unpersisted old document edit`; await oldPage.input(dirty);
  assert.equal(oldPage.beforeUnload().defaultPrevented, true);
  // Model the user choosing to leave despite the native warning, followed by a
  // newly loaded library. This is not presented as a protected app navigation.
  env.session.fault = null;
  const newerPage = pageFor(t, env), newer = `${rawDraft}new document edit`; await newerPage.input(newer);
  await oldPage.window.emit('pageshow', { persisted: true });
  oldPage.nodes.get('songJsonInput').value = rawDraft;
  await oldPage.runTasks();
  assertDraft(oldPage, dirty); assert.match(messages(oldPage), /草稿|原稿|复制|另一/);
  assertRecovered(pageFor(t, env), newer);
  const before = selectionSnapshot(oldPage); await oldPage.practice(true); assertNoNavigation(oldPage, before);
  assertDraft(oldPage, dirty); assertRecovered(pageFor(t, env), newer);
  await oldPage.input(''); assert.equal(oldPage.text(), '');
  assertRecovered(pageFor(t, env), newer);
});

test('failed draft clear after a successful save is retried as a clear on navigation, never as a write of saved text', async t => {
  const env = environment(t), page = pageFor(t, env); await page.type(validScore);
  env.session.fault = 'remove-denied'; await page.click('importSongBtn');
  assert.equal(env.songs().length, 1); assert.equal(page.text(), '');
  assert.ok([...env.session.records.values()].includes(validScore));
  const before = selectionSnapshot(page); await page.practice(true); assertNoNavigation(page, before);
  env.session.fault = null; await page.practice(true);
  assert.equal(page.transitions.length, 1); assert.equal(pageFor(t, env).text(), ''); assert.equal(env.songs().length, 1);
});

test('the last direct editor mutation is checked at navigation even when an input event has not yet fired', async t => {
  const env = environment(t), page = pageFor(t, env); await page.type();
  const last = `${rawDraft}latest unsignalled text`; page.nodes.get('songJsonInput').value = last;
  await page.practice(true); assert.equal(page.transitions.length, 1); assertRecovered(pageFor(t, env), last);
});

test('editing a new draft after saved-song cleanup failure replaces only the old draft, without duplicating the saved song', async t => {
  const env = environment(t), page = pageFor(t, env); await page.type(validScore);
  env.session.fault = 'remove-denied'; await page.click('importSongBtn'); assert.equal(env.songs().length, 1);
  const nextDraft = `${rawDraft}new song after successful save`; await page.input(nextDraft);
  env.session.fault = null; await page.practice(true);
  assert.equal(page.transitions.length, 1); assertRecovered(pageFor(t, env), nextDraft); assert.equal(env.songs().length, 1);
});

test('stale post-save cleanup in a bfcache page neither deletes a newer same-tab draft nor traps an empty editor', async t => {
  const env = environment(t), oldPage = pageFor(t, env); await oldPage.type(validScore);
  env.session.fault = 'remove-denied'; await oldPage.click('importSongBtn');
  assert.equal(env.songs().length, 1); assert.equal(oldPage.text(), '');
  // The user overrides a browser-native warning. A later document then replaces
  // the obsolete saved draft, so old cleanup no longer owns the stored record.
  env.session.fault = null;
  const newerPage = pageFor(t, env), newer = `${rawDraft}later unsaved song`; await newerPage.input(newer);
  await oldPage.window.emit('pageshow', { persisted: true }); await oldPage.runTasks();
  assertRecovered(pageFor(t, env), newer);
  await oldPage.input(''); await oldPage.practice(true);
  assert.equal(oldPage.transitions.length, 1, 'an explicitly empty old editor can abandon obsolete cleanup without deleting another draft');
  const storedBeforeUnload = [...env.session.records];
  assert.equal(oldPage.beforeUnload().defaultPrevented, false);
  assert.equal(oldPage.beforeUnload().defaultPrevented, false, 'repeated native leave checks are idempotent');
  assert.deepEqual([...env.session.records], storedBeforeUnload, 'later leave checks must never acquire ownership of the newer draft');
  assertRecovered(pageFor(t, env), newer); assert.equal(env.songs().length, 1);
});

for (const phase of ['paint', 'lock callback']) {
  test(`a suspended save at ${phase} imports its clicked raw text, never a newer same-tab draft restored by pageshow`, async t => {
    const env = environment(t); let releaseLock;
    if (phase === 'lock callback') env.lock.acquireGate = new Promise(resolveGate => { releaseLock = resolveGate; });
    const oldPage = pageFor(t, env, { holdPaint: phase === 'paint' });
    const submitted = validScore.replace('QA 草稿保存', 'QA explicitly submitted A');
    const newer = validScore.replace('QA 草稿保存', 'QA later unsaved B');
    await oldPage.type(submitted); const saving = oldPage.click('importSongBtn'); await settle();
    assert.equal(oldPage.nodes.get('songJsonInput').disabled, true);
    assert.equal(env.lock.requests.length, phase === 'paint' ? 0 : 1, 'pause at the intended real asynchronous boundary');
    assert.equal(oldPage.beforeUnload().defaultPrevented, true);
    // Model the user overriding the native warning, then creating another
    // document in this tab. This conditional lifecycle is not native CUA proof.
    const newerPage = pageFor(t, env); await newerPage.input(newer);
    const laterSession = [...env.session.records];
    await oldPage.window.emit('pageshow', { persisted: true }); await oldPage.runTasks();
    assertDraft(oldPage, submitted, 'pageshow must not substitute text in a pending user-authorized save');
    if (releaseLock) releaseLock(); else oldPage.releasePaint();
    await saving;
    assert.equal(env.songs().length, 1);
    assert.equal(env.songs()[0].title, 'QA explicitly submitted A', 'only the text associated with the actual Save click is committed');
    assert.equal(oldPage.text(), '');
    assert.deepEqual([...env.session.records], laterSession, 'finishing an older save cannot clear or replace newer unsaved raw text');
    assertRecovered(pageFor(t, env), newer);
    assert.equal(oldPage.beforeUnload().defaultPrevented, false);
    assert.deepEqual([...env.session.records], laterSession, 'the following leave boundary cannot clear the newer draft either');
  });
}

test('a browser-restored editor value arriving during a save remains a draft while only the clicked submission is committed', async t => {
  const env = environment(t), page = pageFor(t, env, { holdPaint: true });
  const submitted = validScore.replace('QA 草稿保存', 'QA clicked before form restoration');
  const later = validScore.replace('QA 草稿保存', 'QA browser-restored unsaved text');
  await page.type(submitted); const saving = page.click('importSongBtn'); await settle();
  assert.equal(page.nodes.get('songJsonInput').disabled, true);
  // Browser form restoration need not fire input and is distinct from the
  // disabled textarea receiving ordinary user typing.
  page.nodes.get('songJsonInput').value = later;
  page.releasePaint(); await saving;
  assert.equal(env.songs().length, 1);
  assert.equal(env.songs()[0].title, 'QA clicked before form restoration');
  assertDraft(page, later);
  assert.match(messages(page), /后来|变化|另.*输入/);
  assert.match(messages(page), /保留|核对后再保存/);
  assertRecovered(pageFor(t, env), later);
});

test('a pending save, newer same-tab draft and later browser-restored input remain three distinct versions', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdPaint: true });
  const submitted = validScore.replace('QA 草稿保存', 'QA submitted A');
  const storedLater = validScore.replace('QA 草稿保存', 'QA newer tab document B');
  const restoredLater = '\n {"title":"QA restored editor C", "unfinished": ';
  await oldPage.type(submitted); const saving = oldPage.click('importSongBtn'); await settle();
  const newerPage = pageFor(t, env); await newerPage.input(storedLater);
  await oldPage.window.emit('pageshow', { persisted: true }); await oldPage.runTasks();
  oldPage.nodes.get('songJsonInput').value = restoredLater;
  oldPage.releasePaint(); await saving;
  assert.equal(env.songs().length, 1); assert.equal(env.songs()[0].title, 'QA submitted A');
  assertDraft(oldPage, restoredLater); assertRecovered(pageFor(t, env), storedLater);
  assert.match(messages(oldPage), /已添加|已保存/); assert.match(messages(oldPage), /保留|没有覆盖/);
  const before = selectionSnapshot(oldPage); await oldPage.practice(true); assertNoNavigation(oldPage, before);
  assertDraft(oldPage, restoredLater); assertRecovered(pageFor(t, env), storedLater);
});

// Defensive late-replay ordering model: simulate a silent native form value
// appearing after pageshow, then run a controlled zero-delay checkpoint. This
// order was initially hypothesized, not established by CUA. The subsequent real
// CUA trace identified replay BEFORE pageshow in a freshly initialized history
// document; separate tests below cover that observed ordering as well.
test('native form replay after pageshow yields to the newer same-tab draft at the next task', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true }); await oldPage.runTasks();
  const old = `${rawDraft}old form-history A`, newer = `${rawDraft}new same-tab B`;
  await oldPage.type(old); await oldPage.practice(true);
  const newerPage = pageFor(t, env); await newerPage.input(newer);
  const storedBeforeReturn = [...env.session.records];
  await oldPage.window.emit('pageshow', { persisted: true });
  oldPage.nodes.get('songJsonInput').value = old;
  assertDraft(oldPage, old, 'the test actually includes the late native form replay');
  await oldPage.runTasks();
  assertRecovered(oldPage, newer);
  assert.deepEqual([...env.session.records], storedBeforeReturn, 'history replay must never replace the newer session record');
  assert.equal(oldPage.beforeUnload().defaultPrevented, false);
  assertRecovered(pageFor(t, env), newer);
});

test('native form replay after pageshow cannot resurrect a draft already saved by the newer document', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true }); await oldPage.runTasks();
  await oldPage.type(validScore); await oldPage.practice(true);
  const newerPage = pageFor(t, env); await newerPage.click('importSongBtn');
  assert.equal(env.songs().length, 1); assert.equal(newerPage.text(), '');
  const storedAfterSave = [...env.session.records];
  await oldPage.window.emit('pageshow', { persisted: true });
  oldPage.nodes.get('songJsonInput').value = validScore;
  await oldPage.runTasks();
  assert.equal(oldPage.text(), '', 'the late browser form value must not resurrect a successfully saved draft');
  assert.deepEqual([...env.session.records], storedAfterSave);
  assert.equal(oldPage.beforeUnload().defaultPrevented, false);
  assert.equal(pageFor(t, env).text(), ''); assert.equal(env.songs().length, 1);
});

test('real input before native form reconciliation keeps C in the editor and B in session without silently replacing either', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true }); await oldPage.runTasks();
  const old = `${rawDraft}form-history A`, newer = `${rawDraft}stored B`, userEdit = `${rawDraft}real user edit C`;
  await oldPage.type(old); await oldPage.practice(true);
  const newerPage = pageFor(t, env); await newerPage.input(newer);
  const storedB = [...env.session.records];
  await oldPage.window.emit('pageshow', { persisted: true });
  oldPage.nodes.get('songJsonInput').value = old;
  await oldPage.input(userEdit);
  assertDraft(oldPage, userEdit);
  assert.deepEqual([...env.session.records], storedB, 'input during the unconfirmed history-recovery window must not silently overwrite B');
  oldPage.nodes.get('songJsonInput').value = old; // Native replay may also trail the real input.
  await oldPage.runTasks();
  assertDraft(oldPage, userEdit); assert.deepEqual([...env.session.records], storedB);
  assert.match(messages(oldPage), /复制|另一|冲突|未同步|没有覆盖/);
  // Ignore the earlier intentional practice transition when checking this new,
  // conflicted leave attempt from the restored document.
  oldPage.transitions.length = 0;
  const before = selectionSnapshot(oldPage); await oldPage.practice(true); assertNoNavigation(oldPage, before);
  assertDraft(oldPage, userEdit); assertRecovered(pageFor(t, env), newer);
});

test('native form reconciliation during a pending save keeps the submitted snapshot and preserves later editor/session drafts', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true, holdPaint: true }); await oldPage.runTasks();
  const submitted = validScore.replace('QA 草稿保存', 'QA save snapshot before native form replay');
  const newer = `${rawDraft}newer session draft B`, browserForm = `${rawDraft}later editor value C`, historyReplay = `${rawDraft}old native history H`;
  await oldPage.type(submitted); const saving = oldPage.click('importSongBtn'); await settle();
  const newerPage = pageFor(t, env); await newerPage.input(newer);
  const storedB = [...env.session.records];
  oldPage.nodes.get('songJsonInput').value = browserForm;
  await oldPage.window.emit('pageshow', { persisted: true });
  oldPage.nodes.get('songJsonInput').value = historyReplay;
  await oldPage.runTasks();
  assertDraft(oldPage, browserForm, 'a pending save must not use deferred restoration to replace later editor text');
  oldPage.releasePaint(); await saving;
  assert.equal(env.songs().length, 1); assert.equal(env.songs()[0].title, 'QA save snapshot before native form replay');
  assertDraft(oldPage, browserForm); assert.deepEqual([...env.session.records], storedB);
  const before = selectionSnapshot(oldPage); await oldPage.practice(true); assertNoNavigation(oldPage, before);
  assertRecovered(pageFor(t, env), newer);
});

test('native form reconciliation never overwrites a dirty draft that existed before pageshow', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true }); await oldPage.runTasks();
  await oldPage.type(rawDraft);
  env.session.fault = 'quota'; const dirty = `${rawDraft}unpersisted before history traversal`; await oldPage.input(dirty);
  env.session.fault = null;
  const newerPage = pageFor(t, env), newer = `${rawDraft}independent newer session text`; await newerPage.input(newer);
  const storedB = [...env.session.records];
  await oldPage.window.emit('pageshow', { persisted: true });
  oldPage.nodes.get('songJsonInput').value = rawDraft;
  await oldPage.runTasks();
  assertDraft(oldPage, dirty); assert.deepEqual([...env.session.records], storedB);
  assert.equal(oldPage.beforeUnload().defaultPrevented, true);
  assertRecovered(pageFor(t, env), newer);
});

test('clearing a replayed old form before reconciliation does not delete the newer stored draft', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true }); await oldPage.runTasks();
  await oldPage.type(rawDraft);
  const newerPage = pageFor(t, env), newer = `${rawDraft}newer session B`; await newerPage.input(newer);
  const storedB = [...env.session.records];
  await oldPage.window.emit('pageshow', { persisted: true });
  oldPage.nodes.get('songJsonInput').value = rawDraft;
  await oldPage.input('');
  oldPage.nodes.get('songJsonInput').value = rawDraft;
  await oldPage.runTasks();
  assert.equal(oldPage.text(), ''); assert.deepEqual([...env.session.records], storedB);
  assert.equal(oldPage.beforeUnload().defaultPrevented, false);
  assertRecovered(pageFor(t, env), newer);
});

test('pending native form reconciliation blocks stale-form save, practice and update until the next task establishes the current draft', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true, latest: nextVersion }); await oldPage.runTasks();
  const old = validScore.replace('QA 草稿保存', 'QA stale native A'), newer = validScore.replace('QA 草稿保存', 'QA current session B');
  await oldPage.type(old);
  const newerPage = pageFor(t, env); await newerPage.input(newer);
  const storedB = [...env.session.records];
  await oldPage.window.emit('pageshow', { persisted: true }); oldPage.nodes.get('songJsonInput').value = old;
  const before = selectionSnapshot(oldPage);
  await oldPage.click('importSongBtn'); assert.equal(env.songs().length, 0, 'a Save click cannot commit the transient stale native form');
  await oldPage.practice(true); assertNoNavigation(oldPage, before);
  await oldPage.click('updateNowBtn'); assertNoNavigation(oldPage, before);
  assertDraft(oldPage, old); assert.deepEqual([...env.session.records], storedB);
  await oldPage.runTasks(); assertRecovered(oldPage, newer);
  await oldPage.click('importSongBtn');
  assert.equal(env.songs().length, 1); assert.equal(env.songs()[0].title, 'QA current session B');
  assert.equal(oldPage.text(), ''); assert.equal(pageFor(t, env).text(), '');
});

test('native form reconciliation preserves an empty post-save cleanup-pending editor instead of reviving saved text', async t => {
  const env = environment(t), page = pageFor(t, env, { holdTasks: true }); await page.runTasks();
  await page.type(validScore); env.session.fault = 'remove-denied'; await page.click('importSongBtn');
  assert.equal(env.songs().length, 1); assert.equal(page.text(), '');
  const storedAfterFailedClear = [...env.session.records];
  await page.window.emit('pageshow', { persisted: true });
  page.nodes.get('songJsonInput').value = validScore;
  await page.runTasks();
  assert.equal(page.text(), ''); assert.deepEqual([...env.session.records], storedAfterFailedClear);
  assert.match(messages(page), /已保存|已添加/); assert.equal(page.beforeUnload().defaultPrevented, true);
  env.session.fault = null; await page.practice(true);
  assert.equal(page.transitions.length, 1); assert.equal(pageFor(t, env).text(), ''); assert.equal(env.songs().length, 1);
});

test('a late native form reconciliation task cannot undo a save that completed after pageshow', async t => {
  const env = environment(t), page = pageFor(t, env, { holdTasks: true, holdPaint: true }); await page.runTasks();
  await page.type(validScore); const saving = page.click('importSongBtn'); await settle();
  await page.window.emit('pageshow', { persisted: true });
  page.releasePaint(); await saving;
  assert.equal(env.songs().length, 1); assert.equal(page.text(), '');
  const savedSession = [...env.session.records];
  await page.runTasks();
  assert.equal(page.text(), '', 'deferred restoration cannot replay the text from before the successful save');
  assert.deepEqual([...env.session.records], savedSession); assert.equal(pageFor(t, env).text(), '');
});

// The parent's visible CUA trace established this distinct real ordering:
// fresh document initializes from session B, native form history fills A before
// the pageshow handler starts, then the deferred reconciliation task runs.
test('fresh history initialization followed by native replay before pageshow restores session B rather than misclassifying A as an edit', async t => {
  const env = environment(t), prior = pageFor(t, env);
  const old = `${rawDraft}historical A`, newer = `${rawDraft}latest session B`;
  await prior.type(old); const newerPage = pageFor(t, env); await newerPage.input(newer);
  const freshHistory = pageFor(t, env, { holdTasks: true }); assertRecovered(freshHistory, newer);
  const storedB = [...env.session.records];
  freshHistory.nodes.get('songJsonInput').value = old;
  await freshHistory.window.emit('pageshow', { persisted: false }); await freshHistory.runTasks();
  assertRecovered(freshHistory, newer); assert.deepEqual([...env.session.records], storedB);
  assert.equal(freshHistory.beforeUnload().defaultPrevented, false);
  assertRecovered(pageFor(t, env), newer);
});

test('fresh history initialization with no draft rejects an old native form replay before pageshow after successful save', async t => {
  const env = environment(t), prior = pageFor(t, env); await prior.type(validScore); await prior.click('importSongBtn');
  assert.equal(env.songs().length, 1);
  const freshHistory = pageFor(t, env, { holdTasks: true }); assert.equal(freshHistory.text(), '');
  const cleared = [...env.session.records]; freshHistory.nodes.get('songJsonInput').value = validScore;
  await freshHistory.window.emit('pageshow', { persisted: false }); await freshHistory.runTasks();
  assert.equal(freshHistory.text(), ''); assert.deepEqual([...env.session.records], cleared);
  assert.equal(freshHistory.beforeUnload().defaultPrevented, false);
  assert.equal(pageFor(t, env).text(), ''); assert.equal(env.songs().length, 1);
});

test('a quota-failed real edit C survives native replay before pageshow without losing newer stored B', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true }); await oldPage.runTasks();
  await oldPage.type(rawDraft); env.session.fault = 'quota';
  const dirty = `${rawDraft}real unpersisted C`, newer = `${rawDraft}newer stored B`; await oldPage.input(dirty);
  env.session.fault = null; const newerPage = pageFor(t, env); await newerPage.input(newer);
  const storedB = [...env.session.records];
  oldPage.nodes.get('songJsonInput').value = rawDraft;
  await oldPage.window.emit('pageshow', { persisted: true }); await oldPage.runTasks();
  assertDraft(oldPage, dirty, 'recorded unsynchronized real input must survive a native DOM overwrite before the event');
  assert.deepEqual([...env.session.records], storedB);
  const before = selectionSnapshot(oldPage); await oldPage.practice(true); assertNoNavigation(oldPage, before);
  assertRecovered(pageFor(t, env), newer);
});

for (const keepLaterEditor of [false, true]) {
  test(`restore task during post-commit thinking delay ${keepLaterEditor ? 'preserves later editor C' : 'cannot revive submitted A'} while newer session B remains untouched`, async t => {
    const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true, holdPaint: true, holdThinking: true });
    await oldPage.runTasks();
    const submitted = validScore.replace('QA 草稿保存', 'QA saved A before thinking finishes');
    const storedLater = `${rawDraft}session B`, editorLater = `${rawDraft}later editor C`;
    await oldPage.type(submitted); const saving = oldPage.click('importSongBtn'); await settle();
    const newerPage = pageFor(t, env); await newerPage.input(storedLater);
    const storedB = [...env.session.records];
    await oldPage.window.emit('pageshow', { persisted: true });
    if (keepLaterEditor) oldPage.nodes.get('songJsonInput').value = editorLater;
    oldPage.releasePaint(); await settle();
    assert.equal(env.songs().length, 1, 'commit already happened before the restore callback');
    assert.equal(oldPage.read('importingSong'), true, 'the real minimum-thinking delay is still pending');
    assertDraft(oldPage, keepLaterEditor ? editorLater : '');
    await oldPage.runTasks();
    assertDraft(oldPage, keepLaterEditor ? editorLater : '', 'the restore task must compare commit revision, not just the unchanged busy flag');
    assert.deepEqual([...env.session.records], storedB);
    oldPage.releaseThinking(); await saving;
    assert.equal(env.songs()[0].title, 'QA saved A before thinking finishes');
    assertDraft(oldPage, keepLaterEditor ? editorLater : ''); assertRecovered(pageFor(t, env), storedLater);
  });
}

test('an explicitly unresolved edit equal to the old synchronized text remains dirty through another pageshow', async t => {
  const env = environment(t), oldPage = pageFor(t, env, { holdTasks: true }); await oldPage.runTasks();
  const old = `${rawDraft}old synchronized A`, newer = `${rawDraft}different stored B`;
  await oldPage.type(old); const newerPage = pageFor(t, env); await newerPage.input(newer);
  const storedB = [...env.session.records];
  await oldPage.window.emit('pageshow', { persisted: true });
  await oldPage.input(old); // A real edit can deliberately equal this page's old synchronized text.
  await oldPage.runTasks();
  assertDraft(oldPage, old); assert.deepEqual([...env.session.records], storedB);
  assert.equal(oldPage.beforeUnload().defaultPrevented, true);
  await oldPage.window.emit('pageshow', { persisted: true }); await oldPage.runTasks();
  assertDraft(oldPage, old, 'explicit dirty state must not be inferred away just because its bytes equal a stale synchronized value');
  assert.deepEqual([...env.session.records], storedB);
  assert.equal(oldPage.beforeUnload().defaultPrevented, true);
  assertRecovered(pageFor(t, env), newer);
});
