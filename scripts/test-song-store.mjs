import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  CUSTOM_SONGS_STORAGE_KEY, deleteCustomSongGroup, getCustomSongs, getSongLibrary,
  parseImportedSongs, saveCustomSongs
} from "../src/song-store.js";

let records;
beforeEach(() => {
  records = new Map();
  globalThis.localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, String(value))
  };
});
const input = (extra = {}) => ({ id: "example", title: "Example", bpm: 90, steps: [["C4", 0, 1], ["E4", 2, 1]], ...extra });
const readRaw = () => JSON.parse(records.get(CUSTOM_SONGS_STORAGE_KEY));

test("V1, notation and V2 imports keep rests and generate playable versions", () => {
  const notation = parseImportedSongs(JSON.stringify({ title: "Notation", notation: [
    { degree: 0, beat: 0, duration: 1 },
    { degree: 1, beat: 1, duration: 1 },
    { degree: "rest", beat: 2, duration: 2 },
    { degree: 3, beat: 4, duration: 1 }
  ] }));
  assert.deepEqual(notation[0].steps, [["C4", 1, 1], ["E4", 4, 1]]);
  const pair = parseImportedSongs(JSON.stringify(input({ schemaVersion: 2, judgementMode: "chord", events: [
    { beat: 0, duration: 1, notes: ["C4", "E4"] },
    { beat: 2, duration: 1, notes: [{ name: "G4", role: "melody", judge: true }] }
  ] })));
  assert.equal(pair.length, 2);
  assert.equal(pair[1].steps.length, 3);
  assert.equal(pair[0].baseSongId, pair[1].baseSongId);
  assert.equal(parseImportedSongs(JSON.stringify(input()))[0].steps.length, 2);
});

test("one invalid stored record does not break valid or built-in songs", () => {
  const [song] = parseImportedSongs(JSON.stringify(input()));
  const invalid = [{ steps: [["C4", 0, 1]] }, { id: 42 }, null, [], { id: "" }];
  records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([...invalid, song]));
  assert.deepEqual(getCustomSongs(), [song]);
  const library = getSongLibrary();
  assert.equal(library.birthday.source, "system");
  assert.deepEqual(library[song.id], song);
  assert.equal(library.__proto__, undefined);
  assert.equal(library.toString, undefined);
  assert.deepEqual(readRaw(), [...invalid, song]);
});

test("save and delete preserve unrelated raw records and local ownership", () => {
  const [kept] = parseImportedSongs(JSON.stringify(input({ id: "kept" })));
  const unknown = { id: "future-song", schemaVersion: 99, customMetadata: { keep: true } };
  records.set(CUSTOM_SONGS_STORAGE_KEY, JSON.stringify([unknown, { ...kept, source: "system" }]));
  assert.equal(getCustomSongs()[0].source, "local");
  const added = saveCustomSongs(parseImportedSongs(JSON.stringify(input())));
  assert.equal(readRaw().length, 3);
  assert.deepEqual(readRaw()[0], unknown);
  assert.deepEqual(deleteCustomSongGroup(added[0].baseSongId).ids, [added[0].id]);
  assert.deepEqual(readRaw()[0], unknown);
  assert.equal(readRaw()[1].source, "system");
  assert.equal(getCustomSongs()[0].id, kept.id);
});

test("unreadable existing storage is never overwritten by a new import", () => {
  const songs = parseImportedSongs(JSON.stringify(input()));
  for (const corrupt of ["{invalid JSON", '{"unexpected":"object"}']) {
    records.set(CUSTOM_SONGS_STORAGE_KEY, corrupt);
    assert.throws(() => saveCustomSongs(songs), /未修改已保存的数据/);
    assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), corrupt);
  }
});

test("quota failures leave existing songs intact for both import and delete", () => {
  const songs = saveCustomSongs(parseImportedSongs(JSON.stringify(input())));
  const before = records.get(CUSTOM_SONGS_STORAGE_KEY);
  localStorage.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  assert.throws(() => saveCustomSongs(songs), /无法保存本地曲库/);
  assert.throws(() => deleteCustomSongGroup(songs[0].baseSongId), /无法保存本地曲库/);
  assert.equal(records.get(CUSTOM_SONGS_STORAGE_KEY), before);
});

test("duplicate imports reserve distinct ids without replacing earlier songs", () => {
  const songs = parseImportedSongs(JSON.stringify([input(), input()]));
  assert.equal(new Set(songs.map((song) => song.id)).size, 2);
  saveCustomSongs(songs);
  assert.equal(getCustomSongs().length, 2);
});
