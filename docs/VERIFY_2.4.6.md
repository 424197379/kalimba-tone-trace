# v2.4.6 local preview verification

## Product scope

The selected once-through vocal melody of 《大雨小雨》 retains all 70 pitches and
attacks. Source bars 9 and 10 contain eight eighth notes each; correcting their
previous double-length transcription brings the final phrase eight beats earlier.
The selected 11 bars end at beat 44. A separately parenthesized instrumental bar
on the printed page remains omitted, and is not described as a written rest.
The first 47 tuples are frozen. The tempo 92 BPM is a practice choice, not a
printed source tempo. No accompaniment is added.

See `RAIN_TIMING_2.4.6.md` for actual source evidence, exact differences and
remaining listening/physical checks. Two independent readers inspected the
same recorded source image before the correction.

## Regression scope

The focused source test covers recorded per-measure evidence, all pitches,
unchanged early tuples, exact later timings, the selected ending and history.
Runtime tests exercise the complete corrected melody at 0.55x and 1x, and
all 16 corrected eighth-note attacks through the optional phrase loop at
0.35x, 0.55x and 1x. The B boundary excludes the next phrase and waits for
preparation before replay. These tests verify the implementation against
recorded evidence; they do not read the score or establish subjective quality.

The compiler skill and actual external AI prompt now state that bar-local
rhythm must come from the visible duration lines, lyric rows do not by
themselves authorize repetition, and omitted interludes are distinguished
from rests and selected-scope totals. The import example remains executable.

## Final execution record

Generated 53 source records / 7079 steps; validation has zero errors and 550
existing density/grid warnings. `npm run check` passes 283 runtime and 13
compiler-evidence tests. Independent final review passes 298 checks (the same gate plus two standalone
transcription/suitability scripts). Direct comparison against the frozen 2.4.5
archive confirms that only the Rain source JSON changed among all 53 song
files; all generated records match their JSON sources. Clean baseline patch
replay also passes the complete project gate, including formal-server HTTP/MIME.

Dry real-sample rendering at 0.55x and 1x preserves exact PCM equality before
beat 32, with unchanged gain and natural decay. All four before/after renders
have zero clipped or non-finite samples; corrected peaks are -5.98 and -4.31
dBFS respectively. This is numerical render validation, not a claimed
reference-performance listening comparison.

## Private cloud browser

The normal update toast moved the existing 2.4.5 origin to visible v2.4.6.
At 0.55x the complete melody reaches normal completion (about 53 seconds,
including the app’s ring-out), resets the progress and clears the target beam.
The corrected two-bar interval [32,40) is selectable with musical-boundary
keyboard handles. It wraps with preparation, pauses, and Escape exits the loop
without leaving the player trapped. No additional support controls appear.
The actual copy button and paste into the import text area yield all 4733
characters exactly, including the new measure/interlude safeguards.

Cached reload preserves the selected 1x speed; the complete corrected melody
also finishes after stopping the private preview server, with no target beam
left on. This is cached loopback-page verification, not an installed-phone
PWA or global airplane-mode claim. Final 860×404 and 610×526 views show the
source-scope note and all 21 mapped keys.

## Run and limits

Node.js 24/npm; no dependency installation. Run `npm start` and open its printed
local URL. Run `npm run check` for the full local gate, including actual HTTP
and MIME checks of all service-worker shell resources and samples through the
formal Node server. A Python development preview does not substitute for that
server check.

No push or publication. Raw score images stay outside the repository.
Real-phone installation/update, physical instrument play-through and comparison
to an independently recorded performance remain unverified.
