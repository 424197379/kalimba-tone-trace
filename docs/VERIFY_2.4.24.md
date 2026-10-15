# 2.4.24 Ordinary Road complete short-edition vocal

Local preview only, no publication. Explicitly selected 破晓/弹琴吧 vocal
m5–21:93 attacks,17 full bars,68 beats, printed80BPM. This retains the whole
vocal verse and chorus in that short edition, with the guitar-only intro and
all guitar support omitted. It is not the complete studio-song form and does
not establish that the previous unavailable 235-note edition was wrong.

## Source/data acceptance

- Independent actual source inspection preceded implementation. All93 adopted
  tuples match the pre-adoption fixture; the private checker passes17 spans
  (96 overlapping comparisons because three cross-bar holds meet both bars).
- Six melody-only rest claims are recognized by the existing generic report;
  no source-all-layer silence is asserted. Last melody ends64, selected end68.
  The source guitar continues in the final vocal rest.
- Original235 JSON remains an exact internal archive. Real importer recovery,
  parsed-history reconstruction and old snapshot hashes are protected. No new
  restore UI, archive serving route or precache; real HTTP rejection is tested.
- Only ping-fan-zhi-lu V1 music changes versus2.4.23. Other55 source files,
  existing archives, samples, app audio/scheduler, preferences and server are
  byte-frozen. Generated56 records match sources;36 canonical cards remain.
- Source edition is editorially medium; shortest .25 beat is187.5ms at80BPM,
  highestA5 and nine-semitone leaps remain. Slow-practice advice is not a claim
  of guaranteed beginner ease. Historical defaultSpeedFactor1 is retained;
  actual initial/saved speed is still controlled by existing app preferences.

## Executable acceptance

Working tree and clean baseline-plus-patch `npm run check` each pass:
**880 runtime +15 compiler tests**, two standalone transcription/suitability
checks, validator and syntax. Independent all-test gate passes **897/897**,
zero failures or skips. Validator:56 records/7054 steps/0 errors/604 existing
warnings; this song has no warning.

27 source/encoding tests protect all93 attacks, occurrence-specific ties and
repetitions, chorus translation, rest scope and historic recovery.17 new actual
runtime/rendering regressions cover .35/.55/1/1.4 speed full tracks and loops,
opening/internal/final rest retention, final extent, held beams and extinction
at true note ends. These are healthy-frame production-function regressions,
not a strict fixed-cadence or acoustic recording assertion.

An initial integration run exposed the old ending-rest cohort missing this
new four-beat rest; it was corrected to six songs while preserving exact
rest values. Independent review also caught an older Porcelain snapshot that
needed archive-based historical reconstruction; the original58-file hash and
count remain unchanged. Both are covered by the final passing gates.

## Own-cloud webpage acceptance

Normal supported update from23 to24 was observed on the private localhost
preview. A second known private loopback origin updated23 to the final24 bytes
after the voice-rest metadata field was finalized; the music tuples and runtime
were identical throughout. The final page shows one93-note card, printed80BPM,
68-beat extent, short-edition title and collapsed informational source note.

- Full1x demo reached 示范结束 after the source51 seconds plus normal release
  allowance. No backing controls became available for the melody-only song.
- Enabled the opening A–B phrase (.375–6.375 seconds at1x). Paused during
  preparation, resumed with preparation, observed wrapping and paused at0:04;
  exit disables the range without trapping playback. Exact onset sequences,
  cross-bar holds and tail-rest loops are separately verified in runtime tests.
- Changed to.55, sought tostart, refreshed and confirmed.55 restored with the
  correct selected title. Existing default-speed button still says1.00x.
- Final screenshots:875×404 practice keyboard and593×511 single-card library.
  Narrow practice layout also inspected at607×524; full title is available in
  the library/source description while the compact control rail truncates it.
- Actual copy button returns5901 characters including the new coherent-vocal
  scope and separate guitar-omission/vocal-rest instructions.

The private Python preview does not replace official Node-server verification:
all43 shell/sample resources have separate real HTTP/MIME tests. No new
reference-recording listening or subjective instrument comfort claim is made.
Raw source scans and full private glyph maps are excluded from the archive.
See ORDINARY_ROAD_REVIEWED_VOCAL.md for source identity and bounded decisions.
