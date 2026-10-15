# v2.4.10 local preview verification

## Musical result

《太阳照常升起》 now follows the explicitly selected EOP 17-bar right-hand
melody: 56 attacks over 68 beats at the printed 112 BPM, transposed uniformly
from F to C by -5 semitones. Four confirmed same-pitch ties no longer retrigger
at beats 6, 39, 48 and 56. All other 52 tuples stay unchanged, including the
already-correct five-beat A3 tie and genuine repeated notes. The final A3 at
64 holds four beats; no invented ending rest is added.

The numbered and staff notation are two exports of one EOP arrangement, not
two independent musical sources. Original photos and Qupu links were not
reverified. See `SUNRISE_TIES_2.4.10.md` for the adopted full scope, source URLs,
image/evidence hashes, the historical handwritten-bar-9 difference and old
JSON reconstruction. Historical V2 bytes remain unchanged; the content guard
prevents borrowing backing with the old attack sequence. No new accompaniment
or physical chord target is introduced.

## Automated and independent evidence

`npm run check` passes: 355 runtime tests and 14 compiler-evidence tests,
plus source validation, transcription/suitability and syntax checks. An
independent all-script run includes two standalone source scripts: 371 pass.
All 53 generated records equal the JSON sources. Relative to frozen 2.4.9,
only the Sunrise V1 record changes among the 53 song files.

Twelve source tests protect the complete pre-edit 56-note expectation, all
four tie merges, 52 unchanged tuples, true repetitions/different-pitch slurs,
68-beat ending, original complete JSON hash and V2 byte identity. Actual
production scheduling is tested for the complete tune at 0.55x and 1x, and
all four corrected phrase ranges at both speeds; the loops do not retrigger
continuations or duplicate A when wrapping. A synthetic compiler regression
also rejects a barline retrigger and over-merging the next true repeated note.

Internal dry rendering with actual note samples, equal gain and natural tails
is identical before beat 6. At both 0.55x and 1x the entire before/after PCM
difference equals only the four removed attack samples. All four renders have
zero clipped/non-finite samples. New peaks are -4.376 and -2.2605 dBFS. This is
sample scheduling/headroom verification, not reference listening or subjective
musical-quality approval, and not a browser-effects equivalence claim.

The formal Node server checks 42 app-shell/sample resources over HTTP with
correct MIME/nonempty content, the exact public archive and denied unrelated
raw/private data. The separate private Python visual preview does not replace
that release-server gate.

## Browser and package

Own-cloud Chromium updated normally from 2.4.9 to 2.4.10. The card shows
56 notes, 112 BPM and the 0.55x estimate of 1:07 with no inherited backing.
The practice source information begins collapsed, is manually expandable,
and backing controls are disabled. The complete 0.55x demo reached
“示范结束”. A real [4,8) loop continued within its bounds and paused/exited
cleanly. Screenshots cover 860×404 and 607×524 with all 21 keys visible.

The actual copy button pasted all 4,944 prompt characters exactly, including
the cross-bar rule. Temporary pasted text was cleared. With the private
preview server stopped, the cached practice page reloaded as 2.4.10 with its
correct title and disabled backing. The server was restarted and the preview
is left at 待开始. This desktop cached-page check is not a phone install test.

The portable patch replays baseline
73041efc803b6c4f16046c8fc0ceaefc08fcc507. Clean replay passes the same full
check; packaging compares every tracked source byte between working tree,
replay and ZIP and records hashes in BUILD-INFO.json. Branch
local/practice-focus remains at zero new commits.

## Run and limits

Node.js 24/npm, no dependency installation: `npm start`; `npm run check`.
No push or publication. No raw source scans in the delivered repository.
Reference-performance listening, physical-kalimba playing and phone PWA
installation/upgrade remain unverified. Other song-source limits remain.
