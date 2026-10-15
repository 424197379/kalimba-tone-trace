import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../src/song-library.js", import.meta.url), "utf8");
const names = ["openDeleteConfirm", "restoreDeleteFocus", "closeDeleteConfirm", "confirmDeleteCustomSong"];
const functions = names.map(name => {
  const result = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, "m"));
  assert.ok(result, name); return result[0];
}).join("\n");
const bindings = source.slice(source.indexOf('cancelDeleteBtn.addEventListener("click"'), source.lastIndexOf("\nrefreshLibraryViews();"));

// Execute actual modal handlers and async deletion lifecycle. Only DOM and the
// already separately tested storage transaction are modeled. This does not
// substitute for Chromium focus observation on the final candidate.
function harness() {
  const doc = { body: {}, activeElement: null, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } };
  doc.activeElement = doc.body;
  const button = (id, base = null) => ({ id, base, isConnected: true, disabled: false, hiddenAncestor: false, handlers: {},
    focus() { if (this.isConnected && !this.disabled && !this.hiddenAncestor) doc.activeElement = this; },
    closest() { return this.hiddenAncestor ? {} : null; }, getAttribute(name) { return name === "data-delete-base" ? this.base : null; },
    addEventListener(type, fn) { this.handlers[type] = fn; } });
  const c = { document: doc, pendingDeleteBaseSongId: null, pendingDeleteSnapshot: null, pendingDeleteFocusTarget: null,
    importingSong: false, deletingSong: false, rows: [], songLibrary: { birthday: { id: "birthday" } },
    addSongBtn: button("add"), cancelDeleteBtn: button("cancel"), confirmDeleteBtn: button("confirm"), importSongBtn: button("import"),
    deleteConfirmTitle: {}, deleteConfirmText: {}, libraryRefreshMessage: {},
    getCustomSongGroupSnapshot: variants => ({ baseSongId: variants[0].baseSongId, content: "unchanged music snapshot" }),
    getLocalSongCopyLabel: () => "", formatSongTitleForMessage: title => `《${title}》`,
    getSelectedSongId: () => "birthday", getSongBaseId: song => song.id, readStoredSongId: () => "birthday",
    getSongLibrary: () => c.songLibrary, rememberLibrarySelection() { assert.fail("unrelated selection changed"); }, storeSongId() {},
    showImportMessage(message) { c.message = message; }, reloadLibraryViews() { c.refreshLibraryViews(); },
    withCustomSongWriteLock: async fn => { if (c.wait) await c.wait; if (c.error) throw c.error; return fn(); },
    deleteCustomSongGroup: base => ({ title: "Synthetic", ids: [base] }),
    refreshLibraryViews() { for (const row of c.rows) { row.isConnected = false; if (doc.activeElement === row) doc.activeElement = doc.body; } c.rows = c.nextRows || []; },
  };
  let hidden = true;
  c.deleteConfirmModal = { handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; },
    get hidden() { return hidden; }, set hidden(value) {
      hidden = value;
      if (value && [c.cancelDeleteBtn, c.confirmDeleteBtn].includes(doc.activeElement)) doc.activeElement = doc.body;
    } };
  c.localSongList = { querySelectorAll: () => c.rows };
  runInNewContext(functions + "\n" + bindings, c);
  const group = base => ({ baseSongId: base, primary: { title: base, source: "local", baseSongId: base }, variants: [{ baseSongId: base }] });
  const open = (base = "local-one", target = button("delete-" + base, base)) => {
    c.rows.push(target); target.focus(); c.openDeleteConfirm(group(base), target); return target;
  };
  return { c, doc, button, group, open };
}

for (const way of ["Escape", "Cancel", "backdrop"]) test(`${way} restores the exact initiating Delete button`, () => {
  const h = harness(), trigger = h.open();
  assert.equal(h.doc.activeElement, h.c.cancelDeleteBtn);
  if (way === "Escape") h.doc.handlers.keydown({ key: "Escape" });
  if (way === "Cancel") h.c.cancelDeleteBtn.handlers.click({ type: "click" });
  if (way === "backdrop") h.c.deleteConfirmModal.handlers.click({ target: h.c.deleteConfirmModal });
  assert.equal(h.doc.activeElement, trigger);
  assert.equal(h.c.deleteConfirmModal.hidden, true);
  assert.equal(h.c.pendingDeleteSnapshot, null);
});

test("click inside dialog does not close or restore focus", () => {
  const h = harness(); h.open(); h.c.deleteConfirmModal.handlers.click({ target: h.c.cancelDeleteBtn });
  assert.equal(h.c.deleteConfirmModal.hidden, false); assert.equal(h.doc.activeElement, h.c.cancelDeleteBtn);
});

test("a rerendered same group returns to its replacement Delete, not another row", () => {
  const h = harness(), trigger = h.open(); trigger.isConnected = false;
  const unrelated = h.button("other", "local-other"), replacement = h.button("replacement", "local-one");
  h.c.rows = [unrelated, replacement]; h.c.closeDeleteConfirm(); assert.equal(h.doc.activeElement, replacement);
});

for (const reason of ["removed", "disabled", "collapsed"]) test(`${reason} target safely falls back to Add Song`, () => {
  const h = harness(), target = h.open();
  if (reason === "removed") target.isConnected = false;
  if (reason === "disabled") target.disabled = true;
  if (reason === "collapsed") target.hiddenAncestor = true;
  h.c.closeDeleteConfirm(); assert.equal(h.doc.activeElement, h.c.addSongBtn);
});

test("confirmed deletion restores Add after removal, not the detached old row", async () => {
  const h = harness(), target = h.open(); h.c.confirmDeleteBtn.focus();
  await h.c.confirmDeleteCustomSong();
  assert.equal(target.isConnected, false); assert.equal(h.doc.activeElement, h.c.addSongBtn);
  assert.equal(h.c.deletingSong, false); assert.equal(h.c.importSongBtn.disabled, false);
});

test("failed deletion returns to still-present original trigger", async () => {
  const h = harness(), target = h.open(); h.c.error = Error("storage unavailable"); h.c.confirmDeleteBtn.focus();
  await h.c.confirmDeleteCustomSong(); assert.equal(h.doc.activeElement, target); assert.equal(h.c.message, "storage unavailable");
});

for (const next of ["new dialog", "another control", "new dialog then cancel"]) test(`pending old deletion does not steal focus from ${next}`, async () => {
  const h = harness(); h.open(); let release; h.c.wait = new Promise(resolve => { release = resolve; });
  h.c.confirmDeleteBtn.focus(); const pending = h.c.confirmDeleteCustomSong();
  let expected;
  if (next.startsWith("new dialog")) {
    const other = h.open("local-other"); expected = h.c.cancelDeleteBtn;
    if (next.endsWith("cancel")) { h.c.closeDeleteConfirm(); expected = h.button("newer-replacement", "local-other"); h.c.nextRows = [expected]; }
  } else { expected = h.button("search"); expected.focus(); }
  release(); await pending;
  assert.equal(h.doc.activeElement, expected);
});

test("real row wiring passes its explicit button and stable group identity", () => {
  assert.match(source, /deleteButton\.setAttribute\("data-delete-base", songGroup\.baseSongId\)/);
  assert.match(source, /openDeleteConfirm\(songGroup, deleteButton\)/);
});
