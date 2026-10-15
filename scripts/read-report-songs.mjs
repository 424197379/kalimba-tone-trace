import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export async function readReportSongs(args = []) {
  const dir = args.length === 2 && args[0] === "--songs-dir"
    ? resolve(args[1]) : fileURLToPath(new URL("../data/songs/", import.meta.url));
  if (args.length && !(args.length === 2 && args[0] === "--songs-dir")) throw new Error("Usage: [--songs-dir directory]");
  const files = (await readdir(dir, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .map(entry => entry.name).sort((a, b) => a.localeCompare(b, "en"));
  // Dirent names are literal filesystem names, not URL references: preserve
  // legal #, ?, and % characters instead of treating them as URL syntax.
  return Promise.all(files.map(async file => JSON.parse(await readFile(resolve(dir, file), "utf8"))));
}
