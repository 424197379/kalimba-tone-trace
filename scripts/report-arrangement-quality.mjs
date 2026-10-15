import { readReportSongs } from "./read-report-songs.mjs";
import { summarizeArrangement } from "./song-report-analysis.mjs";
const songs = await readReportSongs(process.argv.slice(2));
const rows = songs.filter(song => (song.schemaVersion ?? 1) === 2).map(summarizeArrangement);
rows.sort((a, b) => Number(!!b.risk) - Number(!!a.risk)
  || (b.autoDensity ?? 0) - (a.autoDensity ?? 0) || a.id.localeCompare(b.id));
console.table(rows);
