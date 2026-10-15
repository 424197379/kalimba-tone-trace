import { readReportSongs } from "./read-report-songs.mjs";
import { summarizeRhythm } from "./song-report-analysis.mjs";
const songs = await readReportSongs(process.argv.slice(2));
console.log(JSON.stringify(songs.map(summarizeRhythm), null, 2));
