# v2.4.13 local preview verification

## Musical result

See You Again now follows the selected GuitarWorld 12-bar public treble preview:
86 attacks, 48 quarter beats, C5–E6, printed C / 4/4 / 80 BPM. The correction
restores its register, 12 tie chains with 13 continuation endpoints, and later
phrases' own rhythm rather than copying earlier hooks. The complete old V1 is
reconstructible/importable; old V2 bytes remain unchanged and its incompatible
backing is not reused. Beat 48 is the preview cut, not a full-song conclusion.
See SEE_YOU_PREVIEW_SOURCE_REVIEW.md for exact adopted source and limitations.

Mohe's selected verse already matches all 88 source-authored tuples across
16 bars/64 beats; it remains byte-identical. New bounded regressions preserve
its ties, true repeats, syncopation, low registers and ending. See
MOHE_VERSE_SOURCE_REVIEW.md. Source fidelity is separate from physical comfort.
All other source songs, app.js and all sample files remain unchanged from
frozen 2.4.12. Generated source records match all 53 JSON files.

## Automated and independent acceptance

Final `npm run check`: 604 runtime tests plus 14 compiler evidence tests pass.
Independent all-script execution: 620 pass, including two standalone scripts.
Initial integration checks caught an outdated source-bound count/list, an
outdated notice list and a test ending at floating-point equality rather than
the following frame. They were corrected and the full gates rerun. No melody
attack assertion was relaxed: full sequences remain exactly equal and the
next healthy frame must end playback. These session tests use healthy stepped
trajectories; they are not a strict fixed-frame acoustic timing measurement.
The separate stall suite retains its raw clock-gap probes.

Source regressions compare an independently entered pre-edit expectation,
retain historical hashes and reject false tie attacks, over-merged true repeats,
mixed-octave restoration and copied later phrases. The existing support guard
rejects old V2 reuse. The formal Node server test checks all 42 shell/sample
HTTP resources and MIME, the specific public archive, and blocked private data.

## Actual own-cloud browser checks

The normal update control advanced 2.4.12 to 2.4.13. Search showed the new
12-bar preview title, 86 notes, explicit scope/slow-practice notice and no
backing badge. The practice page had no incompatible backing selector. The
source disclosure started collapsed, expanded correctly and could be closed.
The complete preview demo reached “示范结束” at both 0.55x and 1.4x.
An enabled phrase ran multiple cycles; pause at displayed second 17 followed
by Continue held second 17 through fresh preparation. Loop exit worked.
Mohe completed its unchanged verse demo at 1.00x. Both song speeds were
restored to 0.55x afterward.

The actual copy button pasted 5,021 characters, including the same-page
similar-phrase rule; the temporary input was cleared without importing it.
With the private server stopped, the cached page reloaded with v2.4.13,
the reviewed See You title, 21 keys and idle state. The server was restarted.
Screenshots cover compact 607×524 and wide 860×404. Python visual preview is
not evidence of formal Node release-server behavior.

Browser playback establishes the exercised operational flows. Reference
recording comparison, real physical kalimba, real phone PWA installation,
background interruption and acoustic latency remain unverified. The cloud
visibility limitation and 150 ms short-jitter tolerance described in prior
verification remain applicable. No sample offset is included in this version.

## Portable local artifact

The cumulative patch replays baseline
73041efc803b6c4f16046c8fc0ceaefc08fcc507. Clean replay passes the full gate;
working, replay and ZIP source bytes are compared and recorded in BUILD-INFO.
Branch local/practice-focus retains zero new commits. Node.js 24/npm with no
extra dependency installation: `npm start`, then localhost:8123; `npm run check`.
No push or publication. Private source scans and diagnostic browser pages are excluded. The existing
Git-tracked sample-source recording remains part of the reproducible repository
archive; no new private recording is added. Existing source gaps stay explicit.
